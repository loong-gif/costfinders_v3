'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

interface AuthResult {
  success: boolean
  error?: string
  needsEmailVerification?: boolean
}

/**
 * Register a new consumer account.
 * Supabase will send a confirmation email automatically if email confirmations are enabled.
 */
export async function signUpAction(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName?.trim() ?? '',
          last_name: lastName?.trim() ?? '',
        },
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Supabase returns a user with an `identities` array.
    // If email confirmations are on and the email is already taken,
    // identities will be empty (fake success to prevent enumeration).
    const needsEmailVerification = !!data.user && !data.user.email_confirmed_at

    return { success: true, needsEmailVerification }
  } catch {
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
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
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
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Sign out the current user and clear the session cookie.
 */
export async function signOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
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
    const supabase = await createSupabaseServerClient()

    const origin = getOrigin()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Always return success to prevent email enumeration
    return { success: true }
  } catch {
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Send a magic link to an existing user's email.
 * `shouldCreateUser: false` prevents account creation for unknown emails.
 */
export async function sendMagicLinkAction(email: string): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      // Supabase returns "Signups not allowed for otp" when user doesn't exist
      if (error.message.includes('Signups not allowed')) {
        return { success: false, error: 'No account found with this email.' }
      }
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the app origin for redirect URLs.
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to Vercel URL, then localhost.
 */
function getOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
