import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * What /auth/callback can try, server-side, for a given query string.
 *
 * Lives here rather than in the route because a `route.ts` may only export HTTP methods, and
 * the ordering below is the part worth pinning down in a test: it decides whether a magic link
 * opened on a different device than it was requested on works at all. See
 * tests/unit/authCallbackParams.test.ts.
 */
export type CallbackAttempt =
  | { kind: 'token_hash'; token_hash: string; type: EmailOtpType }
  | { kind: 'code'; code: string }

/** The `type` values verifyOtp accepts for an email link. Anything else is not ours. */
const OTP_TYPES = new Set<EmailOtpType>([
  'magiclink',
  'signup',
  'invite',
  'recovery',
  'email_change',
  'email',
])

/**
 * Validate the `type` query param against the set verifyOtp accepts.
 *
 * An allowlist, not a cast: the value arrives from a URL, so `as EmailOtpType` on unvalidated
 * input would hand Supabase whatever a caller typed and trade a TypeScript error for a runtime
 * one.
 */
export function parseOtpType(value: string | null): EmailOtpType | null {
  return value && OTP_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null
}

/**
 * The server-side attempts available for this callback, in the order to try them.
 *
 * `token_hash` comes FIRST on purpose. PKCE's `code` can only be redeemed on the device that
 * requested the link — `signInWithOtp` leaves the code verifier in a cookie there — so a link
 * requested on a laptop and opened on a phone fails that exchange. verifyOtp needs no verifier
 * and works cross-device, which is how magic links are actually used.
 *
 * An empty list means the query string carries nothing usable. That is the NORMAL state for an
 * implicit-flow link, whose tokens are in the fragment and therefore never reach a server, so
 * the caller hands off to /auth/complete instead of declaring failure.
 */
export function callbackAttempts(params: URLSearchParams): CallbackAttempt[] {
  const attempts: CallbackAttempt[] = []

  const tokenHash = params.get('token_hash')
  const otpType = parseOtpType(params.get('type'))
  if (tokenHash && otpType) {
    attempts.push({ kind: 'token_hash', token_hash: tokenHash, type: otpType })
  }

  const code = params.get('code')
  if (code) {
    attempts.push({ kind: 'code', code })
  }

  return attempts
}
