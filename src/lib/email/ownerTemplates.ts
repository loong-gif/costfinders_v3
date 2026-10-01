// ---------------------------------------------------------------------------
// Emails to a business owner — the two the owner Settings page promises
// ---------------------------------------------------------------------------
// Neither carries the customer's name, email or phone. Those sit behind "Mark Contacted" on the
// lead page, and an email is the one place that rule would otherwise leak around.

import { buildEmailHtml } from '@/lib/email/templates'
import { getSiteOrigin } from '@/lib/siteUrl'
import { formatDateOnly } from '@/lib/utils/dateOnly'

const SITE_URL = getSiteOrigin()

// ponytail: a fourth copy of the escaper (templates.ts keeps its own private). Export it from
// templates.ts when a fifth caller appears.
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function leadUrl(claimId: string): string {
  return `${SITE_URL}/business/dashboard/leads/${encodeURIComponent(claimId)}`
}

/** "Saturday, October 2, afternoon" — the calendar date never shifts a day (formatDateOnly). */
function preferredWhen(
  date: string | null,
  time: string | null,
): string | null {
  const day = date
    ? formatDateOnly(date, { weekday: 'long', month: 'long', day: 'numeric' })
    : ''
  const parts = [day, time?.trim() ?? ''].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function newLeadEmail(input: {
  claimId: string
  dealTitle: string
  preferredDate: string | null
  preferredTime: string | null
}): { subject: string; html: string } {
  const when = preferredWhen(input.preferredDate, input.preferredTime)

  const html = buildEmailHtml({
    title: 'You have a new lead',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">A customer claimed <strong>${esc(input.dealTitle)}</strong> on CostFinders.</p>
      <p style="margin: 0 0 12px 0;">${
        when
          ? `They asked for ${esc(when)}.`
          : 'They did not give a preferred date or time.'
      }</p>
      <p style="margin: 0;">Open the lead to see their name and contact details. They appear once you mark the lead contacted.</p>`,
    ctaUrl: leadUrl(input.claimId),
    ctaText: 'Open the lead',
  })

  return { subject: `New lead: ${input.dealTitle}`, html }
}

export function newMessageEmail(input: {
  claimId: string
  dealTitle: string | null
}): { subject: string; html: string } {
  const about = input.dealTitle
    ? ` about <strong>${esc(input.dealTitle)}</strong>`
    : ''

  const html = buildEmailHtml({
    title: 'A customer sent you a message',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">A customer sent you a message on CostFinders${about}.</p>
      <p style="margin: 0;">We email you at most once an hour for each conversation, so there may be more waiting in the thread.</p>`,
    ctaUrl: leadUrl(input.claimId),
    ctaText: 'Read and reply',
  })

  return {
    subject: input.dealTitle
      ? `New message: ${input.dealTitle}`
      : 'New message from a customer',
    html,
  }
}
