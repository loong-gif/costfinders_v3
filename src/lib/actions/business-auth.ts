'use server'

import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { retryAfterPhrase, throttleAuthAttempt } from '@/lib/rate-limit'
import { getSiteOrigin } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface AuthResult {
  success: boolean
  error?: string
  needsEmailVerification?: boolean
}

/**
 * Per-caller ceiling on the business login. Same numbers as consumer sign-in
 * (src/lib/actions/auth.ts) rather than the tighter admin ones: a clinic's staff share one
 * office address, so this surface does have the shared-egress problem that makes a loose
 * `perIp` necessary. `perIpEmail` is the control that actually bounds credential stuffing.
 * No `perEmail` bucket — it would let anyone lock an owner out by spending their budget.
 *
 * ponytail: the ceiling is the one in src/lib/rate-limit.ts's header — counters are in-memory,
 * so the real cap is `limit x running instances` and it resets on a cold start. A bound, not a
 * guarantee; a shared store is the upgrade and only rateLimit()'s internals would change.
 */
const BUSINESS_SIGNIN_THROTTLE = {
  perIp: 60,
  perIpEmail: 10,
  windowMs: 15 * 60 * 1000,
} as const

/**
 * Per-caller ceiling on the business sign-in link. Same numbers as the consumer magic link
 * (THROTTLE.magicLink in src/lib/actions/auth.ts) because the cost being bounded is the same
 * one: mail volume at an address the caller does not own. `perEmail` is safe here and would not
 * be on the password login — exhausting it costs the owner nothing, since password sign-in
 * still works.
 */
const BUSINESS_MAGIC_LINK_THROTTLE = {
  perIp: 20,
  perEmail: 3,
  windowMs: 60 * 60 * 1000,
} as const

// businessSignUpAction was removed: business onboarding is closed at launch. Every export
// here is a public endpoint whether or not the app calls it, so an unused sign-up action was
// still a way in. Owner accounts that exist keep signing in below.

/**
 * Sign in as a business owner.
 * Authorization is the existence of a business_profiles row for the signed-in
 * user, never the user_metadata role claim (which the account holder can set).
 */
export async function businessSignInAction(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    // Before Supabase is touched, so the refusal cannot become an account-existence oracle.
    const throttle = await throttleAuthAttempt(
      'business-signin',
      email,
      BUSINESS_SIGNIN_THROTTLE,
    )
    if (!throttle.allowed) {
      return {
        success: false,
        error: `Too many attempts. ${retryAfterPhrase(throttle.retryAfterSeconds)}`,
      }
    }

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logSupabaseError('businessSignInAction', error)
      if (error.message === 'Invalid login credentials') {
        return { success: false, error: 'Invalid email or password.' }
      }
      if (error.message === 'Email not confirmed') {
        return {
          success: false,
          error: 'Please verify your email before signing in.',
          needsEmailVerification: true,
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

    // Verify against business_profiles, never user_metadata: that field is
    // client-writable, so anyone could PUT role='business' onto themselves.
    // The row is written by the handle_new_business_user trigger at signup.
    // Not filtered on claim_status — an owner mid-claim must still be able to
    // sign in and see the claim-status screens.
    const signedInId = data.user?.id
    const { data: profile } = signedInId
      ? await supabase
          .from('business_profiles')
          .select('id')
          .eq('id', signedInId)
          .maybeSingle()
      : { data: null }

    if (!profile) {
      // Sign out immediately — wrong role
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'This account is not registered as a business owner.',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('businessSignInAction failed', {
      action: 'businessSignInAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Send a business owner a sign-in link.
 *
 * Mirrors sendMagicLinkAction() in src/lib/actions/auth.ts — read the reasoning there; the
 * two properties that matter are `shouldCreateUser: false` (a sign-in request never creates an
 * account) and one indistinguishable answer for every Supabase refusal, so this endpoint cannot
 * be used to test whether an address has an account here.
 *
 * Deliberately does NOT check for a business_profiles row before sending, and could not: doing
 * so would answer "is this address a business owner" to an anonymous caller, which is the same
 * oracle in a narrower form. The link therefore establishes a session and nothing more — a
 * consumer who follows one gets a session and is bounced off /business/dashboard by src/proxy.ts,
 * which authorizes that route on the business_profiles row, not on how the session was created.
 */
export async function sendBusinessMagicLinkAction(
  email: string,
): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt(
      'business-magic-link',
      email,
      BUSINESS_MAGIC_LINK_THROTTLE,
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
        emailRedirectTo: `${getSiteOrigin()}/auth/callback?next=/business/dashboard`,
      },
    })

    if (error) {
      logSupabaseError('sendBusinessMagicLinkAction', error)
    }

    return { success: true }
  } catch (error) {
    logger.error('sendBusinessMagicLinkAction failed', {
      action: 'sendBusinessMagicLinkAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
