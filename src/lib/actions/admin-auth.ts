'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Sign in as an admin.
 * Verifies the user has role: 'admin' in metadata after successful auth.
 */
export async function adminSignInAction(
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
        }
      }
      return { success: false, error: error.message }
    }

    // Verify the user has an admin role
    const userRole = data.user?.user_metadata?.role as string | undefined
    if (userRole !== 'admin') {
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
 * Sign out the current admin.
 */
export async function adminSignOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('adminSignOutAction failed', {
      action: 'adminSignOutAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
