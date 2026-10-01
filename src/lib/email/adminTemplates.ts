// ---------------------------------------------------------------------------
// Emails an admin triggers by hand
// ---------------------------------------------------------------------------
// Same Price Engine shell as templates.ts (buildEmailHtml). Links use the coral text colour
// #cc3714 as a literal, because email clients read no CSS variables.

import { buildEmailHtml } from '@/lib/email/templates'
import { getSiteOrigin } from '@/lib/siteUrl'
import { displayWebsite, telHref, websiteHref } from '@/lib/utils/contactLinks'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import { formatPhone } from '@/lib/utils/phone'

// ponytail: a fourth copy of the five-line escaper (templates.ts, claimNotification.ts and the
// listing-request action each keep one). Export one from templates.ts if a fifth appears.
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const LINK_STYLE = 'color: #cc3714; text-decoration: underline;'

export interface LeadRelayedEmailInput {
  consumerName: string | null
  clinicName: string
  dealTitle: string | null
  preferredDate: string | null
  preferredTime: string | null
  notes: string | null
  clinicPhone: string | null
  clinicWebsite: string | null
}

/**
 * Sent to the customer when the admin ticks "Tell the customer we passed this on" while
 * recording a relay. The clinic is named here: the customer has already claimed, which is the
 * point at which the clinic's identity is revealed to them.
 *
 * It says what we passed on, not what the clinic will do. We don't control the clinic's reply.
 */
export function leadRelayedEmail(input: LeadRelayedEmailInput): {
  subject: string
  html: string
} {
  const clinic = input.clinicName
  const subject = `We passed your request to ${clinic}`

  const sent: string[] = ['Your name and contact details']
  if (input.dealTitle)
    sent.push(`The deal you claimed: ${esc(input.dealTitle)}`)
  if (input.preferredDate || input.preferredTime) {
    const when = [
      input.preferredDate ? formatDateOnly(input.preferredDate) : null,
      input.preferredTime,
    ]
      .filter(Boolean)
      .join(', ')
    sent.push(`When you'd like to come in: ${esc(when)}`)
  }
  if (input.notes) sent.push(`Your note: &ldquo;${esc(input.notes)}&rdquo;`)

  const phoneHref = telHref(input.clinicPhone)
  const siteHref = websiteHref(input.clinicWebsite)
  const siteLabel = displayWebsite(input.clinicWebsite)
  const direct: string[] = []
  if (input.clinicPhone && phoneHref) {
    direct.push(
      `Phone: <a href="${esc(phoneHref)}" style="${LINK_STYLE}">${esc(formatPhone(input.clinicPhone))}</a>`,
    )
  }
  if (siteHref && siteLabel) {
    direct.push(
      `Website: <a href="${esc(siteHref)}" target="_blank" style="${LINK_STYLE}">${esc(siteLabel)}</a>`,
    )
  }

  const greeting = input.consumerName
    ? `Hi ${esc(input.consumerName)},`
    : 'Hi there,'

  const html = buildEmailHtml({
    title: `We passed your request to ${clinic}`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">${greeting}</p>
      <p style="margin: 0 0 12px 0;">
        We've passed your request to <strong>${esc(clinic)}</strong>.
      </p>
      <p style="margin: 0 0 4px 0;"><strong>What we sent them:</strong></p>
      <ul style="margin: 8px 0 16px 0; padding-left: 20px; color: #0b1220;">
        ${sent.map((line) => `<li style="margin-bottom: 6px;">${line}</li>`).join('')}
      </ul>
      ${
        direct.length > 0
          ? `<p style="margin: 0 0 4px 0;"><strong>You can also reach them directly:</strong></p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #0b1220;">
        ${direct.map((line) => `<li style="margin-bottom: 6px;">${line}</li>`).join('')}
      </ul>`
          : `<p style="margin: 0;">You can also reach them directly. Their details are on your claims page.</p>`
      }`,
    ctaUrl: `${getSiteOrigin()}/dashboard/claims`,
    ctaText: 'View your claims',
  })

  return { subject, html }
}
