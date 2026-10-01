'use server'

import { revalidatePath } from 'next/cache'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
  /** Set once the user has run the deletion flow; the row is already anonymised. */
  deletion_requested_at: string | null
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

interface DataExportResult {
  success: boolean
  error?: string
  /** Everything the account holds about the caller, ready to serialise as JSON. */
  data?: Record<string, unknown>
}

interface AccountDeletionResult {
  success: boolean
  error?: string
  /** What was actually removed, so the UI can report facts rather than a promise. */
  removed?: {
    savedDeals: number
    notifications: number
    claimsRetained: number
    messagesRetained: number
  }
}

/** The literal a user must type to confirm deletion. Checked server-side. */
const DELETE_CONFIRMATION = 'DELETE'

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
      logSupabaseError('getProfileAction', error, { userId: user.id })
      // PGRST116 = no rows found — profile may not exist yet
      if (error.code === 'PGRST116') {
        return { success: true, profile: undefined }
      }
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load your profile."),
      }
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
      logSupabaseError('updateProfileAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't save your profile."),
      }
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
 * SMS alerts are not available yet, so enabling them is always rejected server-side.
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

    if (alertsSms) {
      return {
        success: false,
        error: "SMS alerts aren't available yet.",
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
      logSupabaseError('updateAlertPrefsAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't save your notification settings.",
        ),
      }
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
// Data rights
// ---------------------------------------------------------------------------

/**
 * Assemble everything this account holds about the caller, for the portability right
 * src/app/privacy/page.tsx promises ("a copy of the personal information you provided to
 * us, in a portable format"). There was no export path of any kind before this.
 *
 * Identity comes from the session only. This is a Server Action, i.e. a public HTTP
 * endpoint, so a caller-supplied user id would be an "export anyone's data" button.
 */
export async function exportMyDataAction(): Promise<DataExportResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Every query is filtered by the caller's own id AND constrained again by RLS, so a
    // policy change cannot silently widen this.
    const [
      profile,
      claims,
      savedDeals,
      conversations,
      messages,
      notifications,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('claims')
        .select('*')
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('saved_deals').select('*').eq('consumer_id', user.id),
      // Either side: an owner's conversations are their data too.
      supabase
        .from('conversations')
        .select('*')
        .or(`consumer_id.eq.${user.id},business_owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      // Only messages the user SENT. The counterparty's replies are someone else's
      // words; they are readable in the thread but they are not this user's data.
      supabase
        .from('messages')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const firstError =
      profile.error ??
      claims.error ??
      savedDeals.error ??
      conversations.error ??
      messages.error ??
      notifications.error

    if (firstError) {
      logSupabaseError('exportMyDataAction', firstError, { userId: user.id })
      return {
        success: false,
        error: "We couldn't build your export. Please try again.",
      }
    }

    // Strip the opt-out bearer token: it is the user's own, so this is tidiness rather
    // than a leak, but an export file gets forwarded and stored in places a live
    // credential should not go.
    const profileRow = profile.data as Record<string, unknown> | null
    if (profileRow) delete profileRow.unsubscribe_token

    return {
      success: true,
      data: {
        exported_at: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
        },
        profile: profileRow,
        claims: claims.data ?? [],
        saved_deals: savedDeals.data ?? [],
        conversations: conversations.data ?? [],
        messages_sent: messages.data ?? [],
        notifications: notifications.data ?? [],
        notes: [
          'messages_sent contains only messages you sent. Replies from a business are that business\u2019s record.',
          'Businesses you claimed a deal from hold a copy of the contact details we passed them. We cannot recall data already delivered \u2014 see the Privacy Policy.',
        ],
      },
    }
  } catch (error) {
    logger.error('exportMyDataAction failed', {
      action: 'exportMyDataAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Delete the caller's account: the login itself, not just the profile fields.
 *
 * `delete_own_account()` (migration 20260924040003) is SECURITY DEFINER, reads auth.uid()
 * itself and takes no argument, so there is nothing for a caller to substitute. It deletes
 * the caller's auth.users row; profiles, saved_deals, notifications, claims, conversations
 * and messages go with it by ON DELETE CASCADE, so nothing is left for a business owner's
 * contact reveal to hand out. Admin accounts are refused (42501): deleting the last admin
 * from a settings screen would lock everyone out of the admin console.
 *
 * The earlier version could only anonymise the profile, because removing the login needed a
 * service-role key this deployment does not hold. The login survived, could still sign in
 * by magic link, and its email stayed readable through old leads.
 */
export async function requestAccountDeletionAction(
  confirmation: string,
): Promise<AccountDeletionResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Re-checked here and not only in the browser: the client cannot be the gate on an
    // irreversible action reachable by POST.
    if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      return {
        success: false,
        error: `Type ${DELETE_CONFIRMATION} to confirm.`,
      }
    }

    const { data, error } = await supabase.rpc('delete_own_account')

    if (error) {
      logSupabaseError('requestAccountDeletionAction', error, {
        userId: user.id,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't delete your account. Please contact support.",
        ),
      }
    }

    // A write is not done until a read proves it. The session's JWT is still signed, but
    // GoTrue resolves it against auth.users, so once the row is gone getUser() finds nobody.
    const check = await supabase.auth.getUser()
    if (check.data.user) {
      logger.error('Account deletion left the login in place', {
        action: 'requestAccountDeletionAction',
        userId: user.id,
      })
      return {
        success: false,
        error: "We couldn't delete your account. Please contact support.",
      }
    }

    const result = (data ?? {}) as Record<string, number>

    logger.info('Account deleted', {
      action: 'requestAccountDeletionAction',
      userId: user.id,
      authCheck: check.error?.code ?? check.error?.status,
    })

    // Clears the session cookies. GoTrue answers 403 for a deleted user and auth-js still
    // removes the local session on that.
    await supabase.auth.signOut()

    revalidatePath('/dashboard')

    return {
      success: true,
      removed: {
        savedDeals: Number(result.saved_deals_deleted ?? 0),
        notifications: Number(result.notifications_deleted ?? 0),
        // Claims and messages are deleted with the account now, not retained.
        claimsRetained: 0,
        messagesRetained: 0,
      },
    }
  } catch (error) {
    logger.error('requestAccountDeletionAction failed', {
      action: 'requestAccountDeletionAction',
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
