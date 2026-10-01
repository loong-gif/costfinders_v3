'use server'

import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { retryAfterPhrase, throttleAuthAttempt } from '@/lib/rate-limit'
import { getSiteOrigin } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Per-caller ceiling on the admin login — the highest-value credential-stuffing target on
 * the site, since admin_profiles membership IS the admin privilege.
 *
 * Tighter than the consumer numbers in src/lib/actions/auth.ts on purpose: the argument for a
 * loose per-IP ceiling there is shared egress (an office or campus NAT reaches us as one
 * address), and an admin login has a handful of legitimate users, so that argument does not
 * apply. No perEmail bucket, for the same reason as consumer sign-in: an address-only bucket
 * would let anyone lock the admin out of their own console.
 *
 * ponytail: the ceiling is the one in src/lib/rate-limit.ts's header — counters are in-memory,
 * so the real cap is `limit x running instances` and it resets on a cold start. A bound, not a
 * guarantee; a shared store (Postgres counter behind a SECURITY DEFINER function, or Redis
 * INCR) is the upgrade, and only rateLimit()'s internals would change.
 */
const ADMIN_SIGNIN_THROTTLE = {
  perIp: 30,
  perIpEmail: 5,
  windowMs: 15 * 60 * 1000,
} as const

/**
 * Per-caller ceiling on the admin sign-in link. Same numbers as the consumer magic link
 * (THROTTLE.magicLink in src/lib/actions/auth.ts): what this bounds is mail sent to an address
 * the caller does not own, and that cost is the same whoever the address belongs to. The link
 * itself grants no privilege — see sendAdminMagicLinkAction below — so this is a spam ceiling,
 * not the access control.
 */
const ADMIN_MAGIC_LINK_THROTTLE = {
  perIp: 20,
  perEmail: 3,
  windowMs: 60 * 60 * 1000,
} as const

/**
 * Sign in as an admin.
 * Verifies the user has role: 'admin' in metadata after successful auth.
 */
export async function adminSignInAction(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    // Before Supabase is touched, so the refusal cannot become an account-existence oracle.
    const throttle = await throttleAuthAttempt(
      'admin-signin',
      email,
      ADMIN_SIGNIN_THROTTLE,
    )
    if (!throttle.allowed) {
      return {
        success: false,
        error: `Too many attempts. ${retryAfterPhrase(throttle.retryAfterSeconds)}`,
      }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logSupabaseError('adminSignInAction', error)
      if (error.message === 'Invalid login credentials') {
        return { success: false, error: 'Invalid email or password.' }
      }
      if (error.message === 'Email not confirmed') {
        return {
          success: false,
          error: 'Please verify your email before signing in.',
        }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't sign you in. Please try again.",
        ),
      }
    }

    // Verify admin status against the admin_profiles table. user_metadata is
    // client-writable at signup, so it can never be the source of authorization.
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (isAdmin !== true) {
      // Sign out immediately — wrong role
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'This account is not registered as an admin.',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('adminSignInAction failed', {
      action: 'adminSignInAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Send an admin a sign-in link.
 *
 * `shouldCreateUser: false` is the hard security property here, not a nicety. signInWithOtp()
 * defaults to creating the account it cannot find; on this endpoint that would mean anyone who
 * types an address into the admin form gets a mailbox-holder a live session — and while a session
 * is not admin, an endpoint that mints accounts from the admin console is not a thing to ship.
 * With the flag, an address with no account gets nothing at all.
 *
 * A link from here confers no privilege either. It ends at /auth/callback, which only exchanges
 * the code for a session; admin authorization is a separate, server-side check against
 * admin_profiles via is_admin() — src/proxy.ts on every /admin/dashboard request, requireAdmin()
 * in src/lib/auth/guards.ts on every admin action. A non-admin who follows this link is signed in
 * and still bounced off the dashboard.
 *
 * Answers identically whether or not the address exists, for the reason spelled out in
 * sendMagicLinkAction() (src/lib/actions/auth.ts). On this surface the oracle would be worth
 * more than elsewhere: it would enumerate WHICH addresses are admin candidates, which is the
 * first step of a targeted phish.
 */
export async function sendAdminMagicLinkAction(
  email: string,
): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt(
      'admin-magic-link',
      email,
      ADMIN_MAGIC_LINK_THROTTLE,
    )
    if (!throttle.allowed) {
      return {
        success: false,
        error: `Too many attempts. ${retryAfterPhrase(throttle.retryAfterSeconds)}`,
      }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getSiteOrigin()}/auth/callback?next=/admin/dashboard`,
      },
    })

    if (error) {
      logSupabaseError('sendAdminMagicLinkAction', error)
    }

    return { success: true }
  } catch (error) {
    logger.error('sendAdminMagicLinkAction failed', {
      action: 'sendAdminMagicLinkAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
