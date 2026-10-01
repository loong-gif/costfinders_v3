/**
 * Lead notification to the operator inbox when a consumer claims a deal.
 *
 * Deliberately NOT a Server Action. This lived in src/lib/actions/notifications.ts, a
 * `'use server'` module, and every exported async function of such a module is a public
 * HTTP endpoint: anyone who read the action id out of a client chunk could POST at it and
 * make the server spend our RESEND_API_KEY. The recipient is fixed (CLAIM_NOTIFICATION_EMAIL,
 * default leads@costfinders.ai) and the body is assembled here from the caller's fields, so
 * the exposure was operator-inbox spam with attacker-chosen contents — not an open relay to
 * arbitrary addresses. Still an unauthenticated endpoint that costs us money and pollutes the
 * inbox the sales process reads, and there is no reason for it to be reachable at all: the
 * only caller, src/lib/actions/claims.ts, is server-side.
 *
 * Sending goes through sendEmail() rather than a second copy of the Resend fetch — the same
 * consolidation notifications.ts's own closing comment asked for.
 */

import { type SendEmailResult, sendEmail } from '@/lib/email/send'
import { getSiteOrigin } from '@/lib/siteUrl'
import {
  addressLine,
  displayWebsite,
  mapsUrlForAddress,
  websiteHref,
} from '@/lib/utils/contactLinks'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import { formatPhone } from '@/lib/utils/phone'
import type { ClaimClinic } from '@/types/claim'

interface ClaimNotificationData {
  customerName: string
  customerEmail: string
  customerPhone: string
  dealTitle: string
  priceLabel?: string | null
  /** The clinic the claim revealed; null only if even the live lookup failed. */
  clinic: ClaimClinic | null
  /** 'YYYY-MM-DD' — a calendar date, printed with formatDateOnly so it never shifts a day. */
  preferredDate?: string
  preferredTime?: string
  notes?: string
  /** claims.expires_at: the 7-day window the relay queue is ordered by. */
  relayBy: string
}

const OPS_EMAIL = process.env.CLAIM_NOTIFICATION_EMAIL ?? 'leads@costfinders.ai'

/**
 * Tell the operator inbox that a claim came in. Best-effort: the caller must not fail the
 * claim when this does, and reaches this through `after()` so a refused lead notice is
 * logged rather than cut off mid-flight. sendEmail() reports honestly rather than
 * pretending to have sent, and logs every failure under the action name passed here.
 *
 * The subject must keep starting "New claim:" — isEssentialEmail() matches on it so an opt-out
 * on the ops address can never swallow a lead.
 */
export async function sendClaimNotificationEmail(
  data: ClaimNotificationData,
): Promise<SendEmailResult> {
  const clinic = data.clinic?.name ?? 'an unknown clinic'
  const city = data.clinic?.city ? ` (${data.clinic.city})` : ''
  const subject = `New claim: ${data.dealTitle} at ${clinic}${city}`
  return sendEmail(
    OPS_EMAIL,
    subject,
    buildHtmlEmail(data),
    'sendClaimNotificationEmail',
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHtmlEmail(data: ClaimNotificationData): string {
  const { clinic } = data
  const address = clinic ? addressLine(clinic.address, clinic.city) : null
  const site = websiteHref(clinic?.website)
  const maps = mapsUrlForAddress(address)
  // An instant, not a calendar date, so the zone is printed rather than assumed.
  const relayBy = new Date(data.relayBy).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })

  const rows = [
    row('Customer', esc(data.customerName)),
    row('Email', esc(data.customerEmail)),
    row('Phone', esc(data.customerPhone)),
    row('Deal', esc(data.dealTitle)),
  ]
  if (data.priceLabel) rows.push(row('Price shown', esc(data.priceLabel)))
  if (data.preferredDate) {
    rows.push(row('Preferred date', esc(formatDateOnly(data.preferredDate))))
  }
  if (data.preferredTime) {
    rows.push(row('Preferred time', esc(data.preferredTime)))
  }
  if (data.notes) rows.push(row('Message', esc(data.notes)))

  rows.push(row('Clinic', esc(clinic?.name ?? 'Not found — check the lead')))
  if (clinic?.phone)
    rows.push(row('Clinic phone', esc(formatPhone(clinic.phone))))
  if (site) {
    rows.push(row('Clinic website', link(site, displayWebsite(site) ?? site)))
  }
  if (address) {
    rows.push(row('Clinic address', maps ? link(maps, address) : esc(address)))
  }
  rows.push(row('Relay by', `${esc(relayBy)} (7 days from the claim)`))

  const leadsUrl = `${getSiteOrigin()}/admin/dashboard/leads`

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">New deal claim</h2>
      <p style="color: #333; font-size: 14px;">
        The customer has the clinic's details and was told to contact the clinic directly.
        Relay this claim to the clinic before the deadline below.
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows.join('')}
      </table>
      <p style="margin-top: 20px;">
        ${link(leadsUrl, 'Open the relay queue')}
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Sent by CostFinders Lead Notification System
      </p>
    </div>
  `.trim()
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #333; white-space: nowrap; vertical-align: top;">${label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #555;">${value}</td>
    </tr>`
}

function link(href: string, text: string): string {
  return `<a href="${esc(href)}" style="color: #cc3714;">${esc(text)}</a>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
