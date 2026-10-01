/**
 * Production error alerting — the push half of observability.
 *
 * Issue #21: Sentry was added, then removed on the reasoning that "Vercel native logs are
 * sufficient". They are not. Runtime Logs are a PULL surface: somebody has to go and look.
 * Nothing pushes. On 2026-09-03 the homepage, every deal listing and all med spa signups
 * broke simultaneously and the only thing that noticed was a manual audit.
 *
 * This is deliberately NOT a vendor SDK. It POSTs a compact JSON payload to whatever
 * ALERT_WEBHOOK_URL points at — a Slack/Discord incoming webhook, a Vercel Log Drain
 * receiver, an internal endpoint. The payload shape is Slack-compatible (`text`) while
 * still carrying structured fields, so the common case needs no glue code.
 *
 * Server-only. Imported by src/lib/logger.ts and src/instrumentation.ts, both of which are
 * only ever reached from server code — verified: no 'use client' module imports either.
 *
 * DEGRADES SILENTLY BY DESIGN. With ALERT_WEBHOOK_URL unset this is a no-op with no warning
 * on every request, because that is the state of every local dev machine and every preview
 * deploy. Absence of the variable is a supported configuration, not a misconfiguration.
 */

import { waitUntil } from '@vercel/functions'

// Read as a static property access. Next inlines NEXT_PUBLIC_* at build time and a dynamic
// process.env[name] lookup resolves to undefined at runtime; this one is server-only so it
// is read at call time, but the static form is the house convention either way.
const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL

/** Give up rather than hold a serverless invocation open on a slow webhook. */
const TIMEOUT_MS = 3000

/**
 * Alert budget. An outage produces the same error on every request, and a webhook that
 * fires thousands of times is worse than one that fires ten: the channel gets muted, which
 * is how you end up back where this issue started. One build of this app emitted 316
 * copies of a single defect (#28), which is the concrete case this bounds.
 *
 * Per-instance, in memory. Vercel Fluid Compute runs several instances, so the real ceiling
 * is MAX_PER_WINDOW × instances — a bound, not a guarantee. That is fine: the goal is to
 * stop a flood, not to count precisely. Upgrade path if it matters: move the counter into
 * Postgres, the same way a durable rate limit would be done.
 */
const WINDOW_MS = 5 * 60_000
const MAX_PER_WINDOW = 20

/** fingerprint -> last sent (ms). Also bounds repeat alerts for the SAME error. */
const lastSent = new Map<string, number>()
let windowStart = 0
let sentInWindow = 0

export interface AlertContext {
  action?: string
  code?: string
  route?: string
  digest?: string
  [key: string]: unknown
}

/**
 * Fields safe to forward off-box.
 *
 * An allowlist, not a blocklist. The log context these calls carry is rich and some of it
 * is personal: src/lib/email/send.ts puts a truncated Resend response body — which contains
 * recipient addresses — into its error context, and dozens of call sites pass userId. None
 * of that needs to leave the building for someone to know the app is broken.
 */
const FORWARDED_FIELDS = [
  'action',
  'code',
  'route',
  'digest',
  'routeType',
  'duration',
]

function shouldSend(fingerprint: string, now: number): boolean {
  if (now - windowStart > WINDOW_MS) {
    windowStart = now
    sentInWindow = 0
    lastSent.clear()
  }

  // Same error already alerted this window: the first one is the signal.
  if (lastSent.has(fingerprint)) return false
  if (sentInWindow >= MAX_PER_WINDOW) return false

  lastSent.set(fingerprint, now)
  sentInWindow += 1
  return true
}

/**
 * Push an error alert. Never throws, never rejects, never blocks the caller — an alerting
 * failure must not become an outage of its own.
 */
export function reportError(message: string, context?: AlertContext): void {
  if (!WEBHOOK_URL) return

  const now = Date.now()
  const fingerprint = `${context?.action ?? ''}|${context?.code ?? ''}|${message}`
  if (!shouldSend(fingerprint, now)) return

  const fields: Record<string, unknown> = {}
  for (const key of FORWARDED_FIELDS) {
    if (context?.[key] !== undefined) fields[key] = context[key]
  }

  const summary = [
    'CostFinders error',
    context?.action ? `[${context.action}]` : null,
    message,
  ]
    .filter(Boolean)
    .join(' ')

  // `text` makes this work as-is with a Slack or Discord incoming webhook; the structured
  // fields ride alongside for anything that parses JSON.
  const body = JSON.stringify({
    text: summary.slice(0, 500),
    level: 'error',
    message: message.slice(0, 500),
    timestamp: new Date(now).toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    ...fields,
  })

  // Fire and forget, but keep the function alive until the POST has gone out. A Vercel
  // function is frozen the moment it returns its response, and the first real alert through
  // this path (a hard bounce, logged 2026-09-26 18:51:24Z) never reached Slack for exactly that
  // reason: the fetch was scheduled, the response went back, the instance was gone. waitUntil
  // extends the invocation until the promise settles. Without a request context (a build, the
  // tests, `next dev`) it does nothing and the promise simply runs, which is the old behaviour.
  // `after()` from next/server would do the same but cannot be imported here: this module is
  // reachable from instrumentation and the build refuses it there.
  // A swallowing catch either way: an unhandled rejection here would crash the very request
  // we are trying to report on.
  const send = fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    // Deliberately silent. Logging here would recurse through logger.error -> reportError.
  })
  try {
    waitUntil(send)
  } catch {
    // No request context to extend; `send` is already in flight.
  }
}
