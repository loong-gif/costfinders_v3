'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  phone: string | null
  phone_verified_at: string | null
  verification_status: string
  location_city: string | null
  location_state: string | null
  alerts_email: boolean
  alerts_sms: boolean
  favorite_categories: string[]
  status: string
  created_at: string
  updated_at: string
  last_login_at: string | null
}

interface ProfileResult {
  success: boolean
  error?: string
  profile?: Profile
}

interface ProfileUpdatePayload {
  first_name?: string
  last_name?: string
  phone?: string
  location_city?: string
  location_state?: string
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch the authenticated user's profile row.
 */
export async function getProfileAction(): Promise<ProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      // PGRST116 = no rows found — profile may not exist yet
      if (error.code === 'PGRST116') {
        return { success: true, profile: undefined }
      }
      return { success: false, error: error.message }
    }

    return { success: true, profile: data as Profile }
  } catch (error) {
    logger.error('getProfileAction failed', {
      action: 'getProfileAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Update the current user's profile.
 * Only allows a controlled set of fields. Strips HTML and trims whitespace.
 */
export async function updateProfileAction(
  updates: ProfileUpdatePayload,
): Promise<ProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Sanitize: trim and strip HTML tags from each field
    const sanitized: Record<string, string> = {}
    const allowedFields: (keyof ProfileUpdatePayload)[] = [
      'first_name',
      'last_name',
      'phone',
      'location_city',
      'location_state',
    ]

    for (const field of allowedFields) {
      const value = updates[field]
      if (value !== undefined) {
        sanitized[field] = stripHtml(value.trim())
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/account')

    return { success: true, profile: data as Profile }
  } catch (error) {
    logger.error('updateProfileAction failed', {
      action: 'updateProfileAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Update alert preferences (email and SMS).
 * Enabling SMS alerts requires a verified phone number.
 */
export async function updateAlertPrefsAction(
  alertsEmail: boolean,
  alertsSms: boolean,
): Promise<ProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // If enabling SMS, verify phone is confirmed
    if (alertsSms) {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('phone_verified_at')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        return { success: false, error: fetchError.message }
      }

      if (!profile?.phone_verified_at) {
        return {
          success: false,
          error: 'Please verify your phone number before enabling SMS alerts.',
        }
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        alerts_email: alertsEmail,
        alerts_sms: alertsSms,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/account')

    return { success: true, profile: data as Profile }
  } catch (error) {
    logger.error('updateAlertPrefsAction failed', {
      action: 'updateAlertPrefsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove HTML tags from a string to prevent XSS via stored data. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
