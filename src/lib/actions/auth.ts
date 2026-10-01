'use server'

import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { retryAfterPhrase, throttleAuthAttempt } from '@/lib/rate-limit'
import { getSiteOrigin, safeNextPath } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Where an emailed link lands after /auth/callback. `next` is caller-supplied (these are public
 * endpoints), so it goes through safeNextPath() here as well as in the callback: an off-site
 * value falls back to /dashboard instead of being written into an email we send.
 */
function callbackUrl(next?: string): string {
  return `${getSiteOrigin()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`
}

interface AuthResult {
  success: boolean
  error?: string
  needsEmailVerification?: boolean
}

// ---------------------------------------------------------------------------
// Throttling
// ---------------------------------------------------------------------------

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Per-caller ceilings on the four auth entry points. See throttleAuthAttempt() in
 * src/lib/rate-limit.ts for why this cannot be left to Supabase: these calls are made
 * server-side, so upstream per-IP limits see Vercel's egress addresses and every visitor
 * shares one bucket.
 *
 * The numbers are chosen to be invisible to a person and expensive for a script. Note that a
 * whole office, hotel or campus reaches us as ONE address, so the `perIp` ceilings are
 * deliberately loose; the tight number is `perIpEmail` — ten guesses at one account from one
 * host per quarter hour — which is what actually bounds credential stuffing and which a NAT
 * full of different users never touches. Sign-in has no `perEmail` bucket on purpose: an
 * address-only bucket there would let anyone lock a victim out by spending the victim's budget.
 *
 * A distributed run spreading one account's guesses across many addresses is NOT caught by
 * this, and cannot be by anything per-IP. Supabase's leaked-password protection is the control
 * for that half, and it is currently disabled — a dashboard setting, not code (see the
 * security-authz findings).
 */
const THROTTLE = {
  signIn: { perIp: 60, perIpEmail: 10, windowMs: FIFTEEN_MINUTES_MS },
  signUp: { perIp: 10, windowMs: FIFTEEN_MINUTES_MS },
  resetPassword: { perIp: 20, perEmail: 3, windowMs: ONE_HOUR_MS },
  magicLink: { perIp: 20, perEmail: 3, windowMs: ONE_HOUR_MS },
} as const

/**
 * Refusal copy. Identical for every action and independent of whether the address exists,
 * so the throttle cannot be read as an account-existence oracle.
 */
function throttledResult(retryAfterSeconds: number): AuthResult {
  return {
    success: false,
    error: `Too many attempts. ${retryAfterPhrase(retryAfterSeconds)}`,
  }
}

/**
 * Register a new consumer account.
 * Supabase sends the confirmation email; its link lands on /auth/callback,
 * which exchanges the code for a session and forwards to `next` (the deal they signed up from,
 * or /dashboard).
 *
 * `ageAttested` is required and re-checked here, not merely in the form. Both legal documents
 * require 18+ (src/app/privacy/page.tsx, src/app/terms/page.tsx), the treatments listed are
 * aesthetic medical services, and claiming a deal relays the claimant's contact details to a
 * clinic — so a checkbox that a direct POST to this action can skip makes the "not knowingly"
 * qualifier in the policy unsupportable. This module is a `'use server'` file: every export is
 * a public HTTP endpoint, and a client-side gate in front of one is decoration.
 *
 * Deliberately NOT persisted to user_metadata: that field is client-writable, so a record of
 * the attestation stored there would be forgeable and therefore worse than no record. A real
 * audit trail needs a server-written column (`profiles.age_attested_at`), which is a schema
 * change no caller here can make.
 *
 * Typed optional only because TypeScript forbids a required parameter after an optional one;
 * `!== true` is the actual gate, and it is the only one that means anything to a caller that
 * never went through the type system in the first place.
 */
export async function signUpAction(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  ageAttested?: boolean,
  /** Path to land on after confirming, e.g. the deal they signed up from. */
  next?: string,
): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt('signup', email, THROTTLE.signUp)
    if (!throttle.allowed) return throttledResult(throttle.retryAfterSeconds)

    if (ageAttested !== true) {
      return {
        success: false,
        error: 'You must be 18 or older to create an account.',
      }
    }

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl(next),
        data: {
          first_name: firstName?.trim() ?? '',
          last_name: lastName?.trim() ?? '',
        },
      },
    })

    if (error) {
      logSupabaseError('signUpAction', error)
      return {
        success: false,
        error:
          error.code === 'weak_password'
            ? error.message
            : publicErrorMessage(
                error,
                "We couldn't create your account. Please try again.",
              ),
      }
    }

    // Supabase returns a user with an `identities` array.
    // If email confirmations are on and the email is already taken,
    // identities will be empty (fake success to prevent enumeration).
    const needsEmailVerification = !!data.user && !data.user.email_confirmed_at

    return { success: true, needsEmailVerification }
  } catch (error) {
    logger.error('signUpAction failed', {
      action: 'signUpAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Sign in with email and password.
 */
export async function signInAction(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt('signin', email, THROTTLE.signIn)
    if (!throttle.allowed) return throttledResult(throttle.retryAfterSeconds)

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logSupabaseError('signInAction', error)
      // Normalize Supabase's error messages to user-friendly text
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

    return { success: true }
  } catch (error) {
    logger.error('signInAction failed', {
      action: 'signInAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Send a password reset email.
 * The link in the email redirects to /auth/callback which exchanges the code,
 * then forwards to /auth/reset-password where the user enters a new password.
 */
export async function resetPasswordAction(email: string): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt(
      'reset-password',
      email,
      THROTTLE.resetPassword,
    )
    if (!throttle.allowed) return throttledResult(throttle.retryAfterSeconds)

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteOrigin()}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      logSupabaseError('resetPasswordAction', error)
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't send the reset email. Wait a minute and try again.",
        ),
      }
    }

    // Always return success to prevent email enumeration
    return { success: true }
  } catch (error) {
    logger.error('resetPasswordAction failed', {
      action: 'resetPasswordAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Send a consumer sign-in link.
 *
 * `shouldCreateUser: false` is load-bearing on all three magic-link actions (see also
 * sendBusinessMagicLinkAction and sendAdminMagicLinkAction): a sign-in request must never mint
 * an account. Without it, signInWithOtp() registers any address typed into the form, and the
 * holder of that mailbox arrives with a live session nobody signed up for.
 *
 * The caller learns nothing about whether the address exists. Supabase answers an unknown
 * address with "Signups not allowed for otp", and returning that — as this action used to, as
 * "No account found with this email." — made a `'use server'` export anyone can POST to into a
 * free account-existence oracle: enumerate a mailing list against it and you know who has an
 * account here, which for a site about medical treatments is the sensitive part. So every
 * Supabase refusal is logged server-side and answered identically, and the UI copy is
 * conditional ("if that address has an account") rather than a claim that mail went out.
 *
 * That means a real send failure — SMTP down, project-level mail cap — also reads as success to
 * the caller. Deliberate: the alternative is a distinguishable response, and the failure is
 * visible in logSupabaseError() output where it belongs. Password sign-in stays available in
 * every case.
 */
export async function sendMagicLinkAction(
  email: string,
  /** Path to land on after following the link. */
  next?: string,
): Promise<AuthResult> {
  try {
    const throttle = await throttleAuthAttempt(
      'magic-link',
      email,
      THROTTLE.magicLink,
    )
    if (!throttle.allowed) return throttledResult(throttle.retryAfterSeconds)

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl(next),
      },
    })

    if (error) {
      logSupabaseError('sendMagicLinkAction', error)
    }

    return { success: true }
  } catch (error) {
    logger.error('sendMagicLinkAction failed', {
      action: 'sendMagicLinkAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
