/**
 * Next.js instrumentation hook.
 *
 * Issue #21: the 2026-09-03 audit found the homepage, every deal listing and all med spa
 * signups broken at once, and nothing surfaced it. Those pages returned HTTP 200 with a
 * valid <title> while rendering an error boundary — so an uptime check that asserts a 200
 * sees a healthy site, and the structured logger never ran because the throw happened
 * during render rather than inside an action's try/catch.
 *
 * `onRequestError` is the one hook that sees those. Next calls it for every server-side
 * error in the App Router — render, route handler, server action and proxy alike — after
 * the error boundary has already swallowed it for the user. It is a first-party Next 16
 * API (node_modules/next/dist/server/instrumentation/types.d.ts), so this needs no vendor
 * SDK and no build-time route wrapping.
 *
 * Deliberately NOT Sentry: the owner declined a third-party error tracker. The alerting
 * transport is a plain webhook (src/lib/alerting.ts) that no-ops when unconfigured.
 */
import type { Instrumentation } from 'next'
import { reportError } from '@/lib/alerting'

export function register(): void {
  // Nothing to initialise. The hook below is the whole integration; `register` exists
  // because Next only loads this module when the file is present, and keeping the export
  // makes that contract explicit for the next reader.
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const message = error instanceof Error ? error.message : String(error)

  // Next assigns the same digest it hands to the error boundary, so an alert can be tied
  // to the page the user actually saw. It is a non-standard property on the error object.
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest?: unknown }).digest)
      : undefined

  // console.error first so the detail lands in Vercel Runtime Logs even when no webhook is
  // configured — that is still the record you read during an incident.
  console.error(
    JSON.stringify({
      level: 'error',
      message: `Unhandled ${context.routeType} error: ${message}`,
      timestamp: new Date().toISOString(),
      route: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      method: request.method,
      path: request.path,
      digest,
      stack: error instanceof Error ? error.stack : undefined,
    }),
  )

  reportError(message, {
    action: `render:${context.routePath}`,
    route: context.routePath,
    routeType: context.routeType,
    digest,
  })
}
