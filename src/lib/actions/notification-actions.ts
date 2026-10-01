'use server'

import { revalidatePath } from 'next/cache'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

interface NotificationResult {
  success: boolean
  error?: string
}

interface NotificationsListResult {
  success: boolean
  error?: string
  notifications?: NotificationRow[]
}

interface UnreadCountResult {
  success: boolean
  error?: string
  count?: number
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a notification for a given user.
 *
 * Called by other server actions on behalf of users (e.g. after a claim status
 * change). Writes via public.create_notification(), which requires an authenticated
 * caller — the previous direct insert relied on an INSERT policy that permitted anyone,
 * including anon, to write into any user's feed.
 */
export async function createNotificationAction(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
): Promise<NotificationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // Routed through a SECURITY DEFINER function. The notifications INSERT policy was
    // WITH CHECK (true) for role `public`, so anyone — signed in or not — could write a
    // notification with a click-through link into any user's feed. The policy is gone;
    // the function requires an authenticated caller.
    const { error } = await supabase.rpc('create_notification', {
      target_user_id: userId,
      notification_type: type,
      notification_title: title,
      notification_body: body,
      notification_link: link ?? null,
    })

    if (error) {
      logSupabaseError('createNotificationAction', error, { userId })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't create the notification.",
        ),
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('createNotificationAction failed', {
      action: 'createNotificationAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch notifications for the current authenticated user, newest first.
 */
export async function getNotificationsAction(
  limit = 20,
): Promise<NotificationsListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logSupabaseError('getNotificationsAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your notifications. Please try again.",
        ),
      }
    }

    return { success: true, notifications: (data ?? []) as NotificationRow[] }
  } catch (error) {
    logger.error('getNotificationsAction failed', {
      action: 'getNotificationsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get the count of unread notifications for the current user.
 */
export async function getUnreadCountAction(): Promise<UnreadCountResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      logSupabaseError('getUnreadCountAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't count your unread notifications.",
        ),
      }
    }

    return { success: true, count: count ?? 0 }
  } catch (error) {
    logger.error('getUnreadCountAction failed', {
      action: 'getUnreadCountAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Mark a single notification as read.
 * RLS ensures the user can only update their own notifications.
 */
export async function markAsReadAction(
  notificationId: string,
): Promise<NotificationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) {
      logSupabaseError('markAsReadAction', error, {
        userId: user.id,
        notificationId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't mark this notification as read.",
        ),
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('markAsReadAction failed', {
      action: 'markAsReadAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllReadAction(): Promise<NotificationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      logSupabaseError('markAllReadAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't mark your notifications as read.",
        ),
      }
    }

    revalidatePath('/dashboard')

    return { success: true }
  } catch (error) {
    logger.error('markAllReadAction failed', {
      action: 'markAllReadAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
