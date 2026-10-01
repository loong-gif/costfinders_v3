import {
  isOwnAddress,
  recipientHash,
  verifiedResendEvent,
} from '@/lib/email/inbound'
import { logger } from '@/lib/logger'

const ACTION = 'resend-delivery-webhook'

/**
 * Resend delivery webhook: hard bounces and spam complaints.
 *
 * Before this, nobody could see a delivery problem. costfinders.ai ran a ~20% bounce rate in
 * September (all test sends to made-up @costfinders.ai addresses) and no webhook existed, so
 * a real one, such as a lead notice bouncing, would have been equally invisible.
 *
 * A hard bounce or a complaint goes through logger.error, which is what reaches
 * ALERT_WEBHOOK_URL. The log carries the Resend email id (open it in the Resend dashboard)
 * and a 12-character hash of each recipient, never the address.
 *
 * Subscribe this endpoint to email.bounced and email.complained only; anything else is
 * acknowledged and ignored. Setup and rotation: docs/OPERATIONS.md, "Bounce and inbound
 * webhooks".
 */
export async function POST(request: Request) {
  const event = await verifiedResendEvent(
    request,
    process.env.RESEND_WEBHOOK_SECRET,
    'RESEND_WEBHOOK_SECRET',
    ACTION,
  )
  if (event instanceof Response) return event

  const { data } = event
  // Account-wide webhook on a shared Resend account: other clients' mail arrives here too.
  if (!isOwnAddress(data.from ?? '')) return new Response('Ignored: not ours')

  const context = {
    action: ACTION,
    emailId: data.email_id,
    recipients: (data.to ?? []).map(recipientHash),
  }

  if (event.type === 'email.bounced') {
    const { type, subType } = data.bounce ?? {}
    // Permanent means the address will never accept mail, and Resend now suppresses it.
    // Transient and Undetermined usually clear on their own, so they stay out of the pager.
    if (type === 'Permanent') {
      logger.error(`Email hard-bounced (Resend email ${data.email_id})`, {
        ...context,
        code: `bounce:${subType ?? 'unknown'}`,
      })
    } else {
      logger.warn('Email bounced, not permanently', {
        ...context,
        code: `bounce:${type ?? 'unknown'}/${subType ?? 'unknown'}`,
      })
    }
  } else if (event.type === 'email.complained') {
    logger.error(`Email marked as spam (Resend email ${data.email_id})`, {
      ...context,
      code: 'complaint',
    })
  }

  return new Response('OK')
}
