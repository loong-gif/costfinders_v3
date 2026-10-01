/**
 * Everything Resend sends TO us: webhook verification, and reading a received email's body.
 * Used by src/app/api/webhooks/resend (bounces, complaints) and .../resend-inbound (mail to
 * leads@ and support@).
 *
 * A plain server-only module, not `'use server'`: every export of a `'use server'` module is
 * a public HTTP endpoint (see src/lib/email/send.ts for the incident that taught this).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { logger } from '@/lib/logger'

const RESEND_API_KEY = process.env.RESEND_API_KEY

/** Standard Webhooks (Svix) rejects anything signed more than 5 minutes either side of now. */
const TOLERANCE_SECONDS = 5 * 60

/**
 * The Resend account is shared agency-wide (13 domains on 2026-09-23), and Resend webhooks are
 * account-wide. Every client's bounces reach the delivery route, and every receiving-enabled
 * domain's mail reaches the inbound route. Only this domain's traffic is ours to act on.
 */
// ponytail: the one verified sending domain. Derive it from RESEND_FROM_ADDRESS if a second ships.
export const OWN_DOMAIN = 'costfinders.ai'

export interface ResendEvent {
  type: string
  data: {
    email_id: string
    from?: string
    to?: string[]
    cc?: string[]
    subject?: string
    bounce?: { type?: string; subType?: string; message?: string }
  }
}

/**
 * Verify a Resend webhook: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`, keyed
 * with the base64 part of the `whsec_` secret, compared against each `v1,<base64>` entry of
 * the space-separated `svix-signature` header. The same scheme the Resend SDK delegates to
 * (`standardwebhooks`); this repo talks to Resend over fetch and has no SDK to borrow it from.
 */
export function verifyResendSignature(
  secret: string,
  headers: Headers,
  body: string,
  nowMs = Date.now(),
): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatures = headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false

  const seconds = Number(timestamp)
  if (
    !Number.isInteger(seconds) ||
    Math.abs(nowMs / 1000 - seconds) > TOLERANCE_SECONDS
  ) {
    return false
  }

  // .trim(): a pasted env value with a trailing newline took production down once already.
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest()

  // Several entries appear while a secret rotates; any one valid v1 signature is enough.
  return signatures.split(' ').some((entry) => {
    const [version, signature] = entry.split(',')
    if (version !== 'v1' || !signature) return false
    const given = Buffer.from(signature, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/**
 * The front door both routes share. Returns the event, or the Response to send instead:
 * 503 naming the variable when the secret is unset, 401 on a bad or stale signature, 400 on
 * a body that is not an event. The secret is passed in by the route so that each one reads
 * its own variable as a static `process.env.X` access.
 */
export async function verifiedResendEvent(
  request: Request,
  secret: string | undefined,
  secretName: string,
  action: string,
): Promise<ResendEvent | Response> {
  if (!secret?.trim()) {
    // warn, not error: this is the state until the owner creates the webhook, and an
    // unauthenticated caller must not be able to page anyone.
    logger.warn(`Resend webhook refused — ${secretName} is not set`, { action })
    return new Response(`${secretName} is not set`, { status: 503 })
  }

  const body = await request.text()
  if (!verifyResendSignature(secret, request.headers, body)) {
    // A rotated secret that never reached Vercel looks exactly like this, forever.
    logger.warn('Resend webhook refused — bad or stale signature', { action })
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const event = JSON.parse(body) as ResendEvent
    if (typeof event?.type === 'string' && event.data) return event
  } catch {
    // fall through
  }
  return new Response('Not a Resend event', { status: 400 })
}

/** `CostFinders <notifications@costfinders.ai>` or a bare address, lower-cased. */
export function addressOf(value: string): string {
  const bracketed = value.match(/<([^>]+)>/)
  return (bracketed ? bracketed[1] : value).trim().toLowerCase()
}

export function isOwnAddress(value: string): boolean {
  return addressOf(value).endsWith(`@${OWN_DOMAIN}`)
}

/** Correlates repeat bounces in the logs without writing the address down. */
export function recipientHash(value: string): string {
  return createHash('sha256')
    .update(addressOf(value))
    .digest('hex')
    .slice(0, 12)
}

export interface ReceivedEmail {
  from: string
  to: string[]
  subject: string | null
  text: string | null
  headers: Record<string, string> | null
}

/**
 * The `email.received` webhook carries metadata only; the body comes from
 * GET /emails/receiving/{id}. That endpoint needs a FULL-access key: a sending-only key
 * answers 401 `restricted_api_key`, which is surfaced verbatim in `error`.
 */
export async function getReceivedEmail(
  id: string,
): Promise<{ email?: ReceivedEmail; error?: string }> {
  if (!RESEND_API_KEY) return { error: 'RESEND_API_KEY is not configured' }

  try {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${RESEND_API_KEY.trim()}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300)
      return { error: `Resend returned ${response.status}: ${detail}` }
    }
    return { email: (await response.json()) as ReceivedEmail }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/** RFC 3834: auto-replies, vacation notices and bounces carry `Auto-Submitted` != `no`. */
export function isAutoSubmitted(email: ReceivedEmail): boolean {
  const entry = Object.entries(email.headers ?? {}).find(
    ([name]) => name.toLowerCase() === 'auto-submitted',
  )
  return Boolean(entry && entry[1].trim().toLowerCase() !== 'no')
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The forwarded copy: who wrote, to which of our addresses, and the plain-text body, all
 * escaped because every byte of it came from a stranger. Deliberately not buildEmailHtml:
 * that adds the consumer footer and an unsubscribe link, and this is internal ops mail.
 */
export function forwardedEmail(
  email: ReceivedEmail,
  emailId: string,
  ownRecipients: string[],
): { subject: string; html: string; replyTo?: string } {
  // Reply-To the sender, so answering the forward reaches them. A bare address only: Resend
  // answers a malformed reply_to with 422, and Resend would then retry the forward for a day.
  const sender = addressOf(email.from ?? '')
  const replyTo = /^[^\s@<>",;]+@[^\s@<>",;]+\.[a-z]{2,}$/i.test(sender)
    ? sender
    : undefined
  // A header value carries no line breaks; cap it so a hostile subject cannot bloat ours.
  const subject = (email.subject ?? '(no subject)')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200)
  const text =
    email.text ??
    '(No plain-text part. Open it in Resend: Emails → Receiving, id above.)'

  const html = `<p style="font-family:sans-serif;font-size:14px;margin:0 0 12px">
<strong>From:</strong> ${esc(email.from)}<br>
<strong>To:</strong> ${esc(ownRecipients.join(', '))}<br>
<strong>Resend id:</strong> ${esc(emailId)}<br>
${replyTo ? 'Reply to this message to answer the sender.' : 'Replying to this message does not reach the sender. Write to the From address above.'}</p>
<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;margin:0">${esc(text.slice(0, 50_000))}</pre>`

  return { subject: `[${ownRecipients.join(', ')}] ${subject}`, html, replyTo }
}
