import {
  addressOf,
  forwardedEmail,
  getReceivedEmail,
  isAutoSubmitted,
  isOwnAddress,
  verifiedResendEvent,
} from '@/lib/email/inbound'
import { sendEmail } from '@/lib/email/send'
import { logger } from '@/lib/logger'

const ACTION = 'resend-inbound-forward'

/**
 * Resend inbound webhook: forwards mail sent to leads@ and support@costfinders.ai to a person.
 *
 * The domain's MX points at Resend, which accepts that mail silently and keeps it. Nothing
 * read it: lead notices, account-deletion requests and "Do Not Sell or Share" requests all sat
 * unread in the Resend dashboard. This forwards each one to SUPPORT_FORWARD_EMAIL.
 *
 * Status codes are chosen for Resend's retry schedule. A 5xx makes Resend retry for about a
 * day. A 200 means "handled", including every deliberate skip below.
 *
 * Subscribe this endpoint to email.received only. It uses its own signing secret, because each
 * Resend webhook gets its own. Setup: docs/OPERATIONS.md, "Bounce and inbound webhooks".
 */
export async function POST(request: Request) {
  const event = await verifiedResendEvent(
    request,
    process.env.RESEND_INBOUND_WEBHOOK_SECRET,
    'RESEND_INBOUND_WEBHOOK_SECRET',
    ACTION,
  )
  if (event instanceof Response) return event
  if (event.type !== 'email.received') return new Response('Ignored')

  const { data } = event
  // Another client's domain on this shared Resend account also receives mail, and the webhook
  // is account-wide. Never forward theirs. A Bcc-only copy to us has no own address in to/cc
  // and is skipped too. That is an accepted gap.
  const ownRecipients = [...(data.to ?? []), ...(data.cc ?? [])]
    .filter(isOwnAddress)
    .map(addressOf)
  if (ownRecipients.length === 0) return new Response('Ignored: not ours')

  const context = { action: ACTION, emailId: data.email_id }
  const forwardTo = process.env.SUPPORT_FORWARD_EMAIL?.trim()
  if (!forwardTo) {
    logger.warn(
      'Inbound email not forwarded — SUPPORT_FORWARD_EMAIL is not set',
      context,
    )
    return new Response('SUPPORT_FORWARD_EMAIL is not set; not forwarded')
  }
  // Forwarding to our own domain lands back here and forwards again, forever.
  if (isOwnAddress(forwardTo)) {
    logger.error(
      'SUPPORT_FORWARD_EMAIL is an address on our own domain, which would loop; not forwarded',
      context,
    )
    return new Response('Forward target would loop; not forwarded')
  }
  // A reply or autoresponder from the forward mailbox itself would ping-pong the same way.
  if (addressOf(data.from ?? '') === addressOf(forwardTo)) {
    logger.warn(
      'Inbound email came from the forward mailbox; not forwarded',
      context,
    )
    return new Response('Sent by the forward mailbox; not forwarded')
  }

  const { email, error } = await getReceivedEmail(data.email_id)
  if (!email) {
    logger.error('Could not fetch a received email from Resend', {
      ...context,
      error,
    })
    return new Response('Could not fetch the email', { status: 502 })
  }
  if (isAutoSubmitted(email)) {
    logger.info('Auto-submitted inbound email not forwarded', context)
    return new Response('Auto-submitted; not forwarded')
  }

  const { subject, html, replyTo } = forwardedEmail(
    email,
    data.email_id,
    ownRecipients,
  )
  // Ops mail to a person, not a subscriber: essential, so no opt-out can swallow it.
  const result = await sendEmail(forwardTo, subject, html, ACTION, {
    essential: true,
    replyTo,
  })
  if (result.suppressed) {
    // sendEmail's opt-out gate: the forward address has a CostFinders account with email
    // notifications turned off. Loud, because the alternative is mail that silently stops.
    logger.error(
      'Inbound email not forwarded — the SUPPORT_FORWARD_EMAIL account has email notifications off',
      context,
    )
  }
  // sendEmail already logged any failure. Answer 502 so Resend retries it.
  return result.success
    ? new Response('Forwarded')
    : new Response('Forward failed', { status: 502 })
}
