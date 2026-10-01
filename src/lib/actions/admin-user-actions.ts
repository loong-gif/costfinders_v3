'use server'

import { revalidatePath } from 'next/cache'
import { fetchUserEmails } from '@/lib/actions/admin-user-emails'
import { logAdminAction } from '@/lib/actions/audit'
import type { Profile } from '@/lib/actions/profile'
import { requireAdmin } from '@/lib/auth/guards'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A profile plus its sign-in email, which lives in auth.users rather than profiles. */
export type AdminConsumer = Profile & { email: string | null }

interface ConsumersResult {
  success: boolean
  error?: string
  consumers?: AdminConsumer[]
}

interface CountResult {
  success: boolean
  error?: string
  count?: number
}

interface ActionResult {
  success: boolean
  error?: string
}

interface ConsumerFilters {
  status?: string
  verificationStatus?: string
}

/**
 * Every field of `Profile`, and nothing else. Deliberately omits
 * profiles.unsubscribe_token — a bearer credential the subject-access export in
 * src/lib/actions/profile.ts already strips for the same reason.
 */
const PROFILE_COLUMNS =
  'id, first_name, last_name, avatar_url, phone, phone_verified_at, verification_status, location_city, location_state, alerts_email, alerts_sms, favorite_categories, status, created_at, updated_at, last_login_at, deletion_requested_at'

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch all consumer profiles with optional filters.
 */
export async function getConsumersAction(
  filters?: ConsumerFilters,
): Promise<ConsumersResult> {
  try {
    const { supabase } = await requireAdmin()

    // Explicit column list, not select('*'): profiles carries unsubscribe_token,
    // the sole authenticator on /unsubscribe — anyone holding it can change that
    // person's email preferences without signing in. select('*') shipped it to
    // every admin browser even though nothing here reads it, and it is not even a
    // field of Profile. An explicit list also stops the next column added to
    // profiles from silently joining the payload.
    let query = supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.verificationStatus) {
      query = query.eq('verification_status', filters.verificationStatus)
    }

    const { data, error } = await query

    if (error) {
      logSupabaseError('getConsumersAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load users."),
      }
    }

    // A customer who writes in identifies themselves by email, so the list carries it.
    // A failed lookup fails the screen rather than showing every row as "no email".
    const profiles = (data ?? []) as Profile[]
    const lookup = await fetchUserEmails(
      supabase,
      profiles.map((profile) => profile.id),
    )
    if (lookup.error)
      return {
        success: false,
        error: publicErrorMessage(
          lookup.error,
          "We couldn't load users' email addresses.",
        ),
      }
    const emails = lookup.emails ?? new Map<string, string>()

    return {
      success: true,
      consumers: profiles.map((profile) => ({
        ...profile,
        email: emails.get(profile.id) ?? null,
      })),
    }
  } catch (err) {
    logger.error('getConsumersAction failed', {
      action: 'getConsumersAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Update a consumer's account status (active / suspended).
 */
export async function updateConsumerStatusAction(
  userId: string,
  status: 'active' | 'suspended',
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin()

    // profiles.status is no longer writable by the client — a direct UPDATE let any
    // suspended user reinstate themselves. It goes through a SECURITY DEFINER function
    // that re-checks admin membership server-side instead.
    const { error } = await supabase.rpc('admin_set_user_status', {
      target_user_id: userId,
      new_status: status,
    })

    if (error) {
      logSupabaseError('updateConsumerStatusAction', error, { userId })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't update this user's status.",
        ),
      }
    }

    revalidatePath('/admin/dashboard/users')
    await logAdminAction('user_status_updated', 'user', userId, { status })
    return { success: true }
  } catch (err) {
    logger.error('updateConsumerStatusAction failed', {
      action: 'updateConsumerStatusAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Get total consumer count from profiles table.
 */
export async function getConsumerCountAction(): Promise<CountResult> {
  try {
    const { supabase } = await requireAdmin()

    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (error) {
      logSupabaseError('getConsumerCountAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't count users."),
      }
    }

    return { success: true, count: count ?? 0 }
  } catch (err) {
    logger.error('getConsumerCountAction failed', {
      action: 'getConsumerCountAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Get count of pending business claims from business_profiles table.
 */
export async function getPendingClaimsCountAction(): Promise<CountResult> {
  try {
    const { supabase } = await requireAdmin()

    const { count, error } = await supabase
      .from('business_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('claim_status', 'pending')

    if (error) {
      logSupabaseError('getPendingClaimsCountAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't count pending claims."),
      }
    }

    return { success: true, count: count ?? 0 }
  } catch (err) {
    logger.error('getPendingClaimsCountAction failed', {
      action: 'getPendingClaimsCountAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}
