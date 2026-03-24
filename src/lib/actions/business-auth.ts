'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface AuthResult {
  success: boolean
  error?: string
  needsEmailVerification?: boolean
}

/**
 * Register a new business owner account.
 * Sets role: 'business' in user_metadata to trigger business_profiles auto-creation.
 */
export async function businessSignUpAction(
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
          role: 'business',
          first_name: firstName?.trim() ?? '',
          last_name: lastName?.trim() ?? '',
        },
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    const needsEmailVerification = !!data.user && !data.user.email_confirmed_at

    return { success: true, needsEmailVerification }
  } catch (error) {
    logger.error('businessSignUpAction failed', {
      action: 'businessSignUpAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Sign in as a business owner.
 * Verifies the user has role: 'business' in metadata after successful auth.
 */
export async function businessSignInAction(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
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

    // Verify the user has a business role
    const userRole = data.user?.user_metadata?.role as string | undefined
    if (userRole !== 'business') {
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
 * Sign out the current business owner.
 */
export async function businessSignOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('businessSignOutAction failed', {
      action: 'businessSignOutAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
