import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { callbackAttempts } from '@/lib/auth/callbackParams'
import { assertSupabaseEnv } from '@/lib/env'
import { logSupabaseError } from '@/lib/logger'
import { safeNextPath } from '@/lib/siteUrl'

/**
 * Supabase hands a signed-in user back in one of three shapes, and this route has to survive
 * all of them. It used to handle only the first, which meant a link opened on a different
 * device than it was requested on silently bounced to `/?auth_error=true` — verified live.
 *
 * 1. `?code=`       — PKCE. Requires the code-verifier cookie that `signInWithOtp` set on the
 *                     device that REQUESTED the link. Cross-device, that cookie does not exist,
 *                     so this path cannot be the only one.
 * 2. `?token_hash=` — verifyOtp. Needs no verifier, so it works when the link is opened on a
 *                     phone after being requested on a laptop, which is how magic links are
 *                     actually used. Preferred when present. Requires the Supabase email
 *                     template to emit `{{ .TokenHash }}` (dashboard-managed — see
 *                     docs/OPERATIONS.md).
 * 3. `#access_token=…` — implicit. The tokens arrive in the URL FRAGMENT, which is never sent
 *                     to a server, so this route cannot see it at all. It hands off to
 *                     /auth/complete, a client component that can read the hash. The fragment
 *                     rides along through the redirect because the target carries none.
 *
 * Which of 1 and 2 to try, and in which order, is callbackAttempts() in
 * src/lib/auth/callbackParams.ts — a route file cannot export it for a test to reach.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const attempts = callbackAttempts(searchParams)
  // Anyone can put anything in `next` — it arrives from a link in an email.
  // safeNextPath() keeps the redirect on this origin; see src/lib/siteUrl.ts.
  const next = safeNextPath(searchParams.get('next'))

  if (attempts.length > 0) {
    const cookieStore = await cookies()

    // Read statically (not via process.env[name]) — Next inlines NEXT_PUBLIC_*
    // at build time, and a dynamic lookup would be undefined at runtime.
    // assertSupabaseEnv names the missing variable and trims the value; see src/lib/env.ts.
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = assertSupabaseEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    })

    // In callbackAttempts() order — token_hash first, because it is the shape that survives a
    // cross-device open. A failed attempt is logged and the next one tried.
    for (const attempt of attempts) {
      const { error } =
        attempt.kind === 'token_hash'
          ? await supabase.auth.verifyOtp({
              token_hash: attempt.token_hash,
              type: attempt.type,
            })
          : await supabase.auth.exchangeCodeForSession(attempt.code)

      if (error) {
        logSupabaseError(`authCallback.${attempt.kind}`, error, {
          otpType: attempt.kind === 'token_hash' ? attempt.type : undefined,
        })
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Nothing usable in the query string. That is the normal state for an implicit-flow link,
  // whose tokens are in the fragment, so hand off to the client rather than declaring failure
  // here — /auth/complete decides between "there is a hash, sign in" and a real error.
  return NextResponse.redirect(
    `${origin}/auth/complete?next=${encodeURIComponent(next)}`,
  )
}
