import { createHash } from 'node:crypto'
import {
  getRecipientEmailPrefs,
  isEssentialEmail,
  listUnsubscribeHeaders,
  UNSUBSCRIBE_URL,
} from '@/lib/email/optOut'
import { logger } from '@/lib/logger'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ??
  'CostFinders <notifications@costfinders.ai>'

export interface SendEmailResult {
  success: boolean
  error?: string
  /** True when the recipient has opted out and this message was not essential. */
  suppressed?: boolean
}

/**
 * Send a transactional email via Resend.
 *
 * This is deliberately NOT a Server Action. It previously lived in
 * src/lib/actions/notifications.ts, a `'use server'` module — which meant Next.js
 * exposed it as a public HTTP endpoint, so anyone who discovered the action id could
 * send arbitrary HTML to any recipient from our domain. Every caller is server-side,
 * so it belongs in a plain server-only module instead of the action surface.
 *
 * Callers treat delivery as best-effort and should not fail the primary operation
 * when an email cannot be sent — but this returns an honest result either way. It
 * used to return `{ success: true }` when no API key was configured, which made six
 * flows silently no-op while reporting success.
 *
 * `action` names the calling flow and is REQUIRED, because this log line is the only
 * record a best-effort send leaves. Five call sites were `sendEmail(...).catch(() => {})`
 * — a catch that can never fire, since this resolves rather than rejects, wrapped around a
 * `{ success: false }` nobody read — so a claim receipt or a lead notice that Resend
 * refused was invisible to everyone. It goes into the log context as `action` rather than
 * a field of its own because src/lib/alerting.ts forwards an allowlist off-box and
 * `action` is on it. The recipient is logged as a user id or a short hash, never as an
 * address: Runtime Logs are readable by everyone on the Vercel team.
 *
 * Every non-essential send checks the recipient's opt-out first, and every send gets the
 * recipient's own one-click unsubscribe link. Both need to know WHICH account the mail is
 * for, so pass `recipientUserId` whenever the recipient is not the signed-in caller (an
 * admin mailing an owner, a consumer's request mailing the owner). Without it the check is
 * skipped, fail-open, and a warning names the call site.
 *
 * Best-effort callers whose primary write has already landed must NOT await this inline:
 * wrap it in `after()` from `next/server`. A bare floating promise can be cut off when the
 * serverless invocation returns, so the old form did not merely hide failures — it could
 * skip the send with nothing logged either way.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  action: string,
  options?: {
    /** Send even when the recipient opted out (a receipt they need, not an alert). */
    essential?: boolean
    /** The recipient's auth user id, when they are not the signed-in caller. */
    recipientUserId?: string
    /** Where a reply goes. Unset, replies go to FROM_ADDRESS. */
    replyTo?: string
  },
): Promise<SendEmailResult> {
  const essential = isEssentialSend(subject, options?.essential)

  if (!RESEND_API_KEY) {
    logger.error('Email not sent — RESEND_API_KEY is not configured', {
      action,
      recipient: options?.recipientUserId ?? addressHash(to),
      subject,
    })
    return { success: false, error: 'Email delivery is not configured.' }
  }

  // The suppression gate. It belongs here rather than at the call sites because a guard in
  // the shared sender is the only version the next caller cannot forget. Fails open (see
  // getRecipientEmailPrefs) — an opt-out that misses one message is recoverable, a sender
  // that drops every message when Postgres hiccups is not.
  const prefs = await getRecipientEmailPrefs(to, options?.recipientUserId)
  const recipient = prefs.userId ?? addressHash(to)

  if (!prefs.userId && !essential) {
    logger.warn(
      'Email recipient not resolved to an account — opt-out not checked',
      {
        action,
        recipient,
      },
    )
  }

  if (prefs.suppressed && !essential) {
    logger.info('Email suppressed — recipient turned off email notifications', {
      action,
      recipient,
      subject,
    })
    return { success: true, suppressed: true }
  }

  // Point the template's footer link at this recipient's own one-click token. The templates
  // render the untokenised UNSUBSCRIBE_URL because they have no recipient context.
  const htmlBody = html
    .split(`href="${UNSUBSCRIBE_URL}"`)
    .join(`href="${prefs.unsubscribeUrl}"`)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html: htmlBody,
        ...(options?.replyTo && { reply_to: options.replyTo }),
        // RFC 8058: what makes Gmail and Yahoo render their own Unsubscribe affordance.
        headers: listUnsubscribeHeaders(prefs.unsubscribeUrl),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      logger.error('Resend rejected the message', {
        action,
        recipient,
        status: response.status,
        // Resend echoes the reason (unverified domain, invalid recipient, rate limit). The
        // logger replaces any address in it.
        body: body.slice(0, 500),
        subject,
      })
      return {
        success: false,
        error: `Email provider returned ${response.status}`,
      }
    }

    return { success: true }
  } catch (err) {
    logger.error('Could not reach the email provider', {
      action,
      recipient,
      subject,
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: false, error: 'Could not reach the email provider.' }
  }
}

/**
 * Whether this message goes out even to a recipient who opted out: a receipt they need or ops
 * mail (the explicit flag, or a subject optOut.ts lists). Alerts respect the opt-out. Exported
 * so tests/unit/leadEmails.test.ts can pin it; sendEmail is its only caller.
 */
export function isEssentialSend(subject: string, essential?: boolean): boolean {
  return essential === true || isEssentialEmail(subject)
}

/** Enough to tell two recipients apart in the logs; not the address itself. */
function addressHash(to: string): string {
  return `sha256:${createHash('sha256').update(to.trim().toLowerCase()).digest('hex').slice(0, 12)}`
}
