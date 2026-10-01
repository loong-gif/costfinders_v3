import { logger } from '@/lib/logger'
import { callerIp, rateLimit } from '@/lib/rate-limit'
import { supabase } from '@/lib/supabase'

/**
 * Records an email opt-out.
 *
 * POST only. A GET that wrote would let a link scanner, a prefetch or a corporate
 * URL-rewriter opt someone out on their behalf — every one of which fetches links in
 * mail before a human ever clicks.
 *
 * Serves two callers:
 *   - The form on /unsubscribe (browser) → 303 back to the page with a result.
 *   - A mailbox provider's RFC 8058 one-click POST, which sends
 *     `List-Unsubscribe=One-Click` as the body and expects a plain 200. It carries no
 *     cookies, hence the token in the URL and the anon client here.
 *
 * The token is 122 bits of randomness held on the profile row, and the RPC behind this
 * only ever sets alerts_email = false, so a guessed token could not enable anything.
 */

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const url = new URL(request.url)

  // Not brute-force defence (see the token note above) — this is so an anonymous
  // endpoint that writes to Postgres cannot be looped as a cheap amplifier.
  const limit = rateLimit(`unsubscribe:${await callerIp()}`, 20, 60_000)
  if (!limit.allowed) {
    return new Response('Too many requests.', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    })
  }

  let token = url.searchParams.get('token')?.trim() ?? ''
  let isOneClick = false

  if ((request.headers.get('content-type') ?? '').includes('form')) {
    const form = await request.formData().catch(() => null)
    if (form) {
      // RFC 8058: the provider posts this exact field and expects a bare 200.
      isOneClick = form.get('List-Unsubscribe') === 'One-Click'
      token = (form.get('token') as string | null)?.trim() || token
    }
  }

  const redirectTo = (state: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `/unsubscribe?state=${state}` },
    })

  if (!UUID_RE.test(token)) {
    return isOneClick
      ? new Response('Invalid unsubscribe token.', { status: 400 })
      : redirectTo('invalid')
  }

  const { data, error } = await supabase.rpc('unsubscribe_by_token', {
    p_token: token,
  })

  if (error) {
    logger.error('Unsubscribe failed', {
      action: 'unsubscribeConfirm',
      code: error.code,
      // Never the token itself: it is a bearer credential and logs are a pull surface.
    })
    return isOneClick
      ? new Response('Could not process the request.', { status: 500 })
      : redirectTo('invalid')
  }

  if (data !== true) {
    // Unknown token — expired link, or a hand-mangled URL.
    return isOneClick
      ? new Response('Unknown unsubscribe token.', { status: 400 })
      : redirectTo('invalid')
  }

  return isOneClick
    ? new Response('Unsubscribed.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    : redirectTo('done')
}
