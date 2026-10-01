import { type SendEmailResult, sendEmail } from '@/lib/email/send'

/**
 * Requests from the public (listing changes, privacy requests) go to one inbox:
 * LISTING_REQUEST_EMAIL, then CLAIM_NOTIFICATION_EMAIL, then support@, which the inbound
 * webhook forwards once docs/OPERATIONS.md "Mail routing" is set up.
 *
 * A plain module, not `'use server'`: every export of a server-action module is a public HTTP
 * endpoint, and a function that emails our inbox must not be one.
 */
const OPS_INBOX =
  process.env.LISTING_REQUEST_EMAIL ??
  process.env.CLAIM_NOTIFICATION_EMAIL ??
  'support@costfinders.ai'

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email a labelled table to the ops inbox. Plain HTML rather than buildEmailHtml: that
 * template's footer carries a subscriber's unsubscribe link, which ops mail has no use for.
 * Always `essential`: the inbox is not a subscriber, and an opt-out on an operator address
 * must not swallow a request.
 */
export function sendOpsNotice(
  subject: string,
  intro: string,
  rows: [label: string, value: string][],
  action: string,
): Promise<SendEmailResult> {
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;font-weight:600;">${esc(label)}</td><td style="padding:4px 0;">${esc(value)}</td></tr>`,
    )
    .join('')
  return sendEmail(
    OPS_INBOX,
    subject,
    `<p>${esc(intro)}</p><table>${table}</table>`,
    action,
    { essential: true },
  )
}
