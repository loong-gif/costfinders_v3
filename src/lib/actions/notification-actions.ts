'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
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
 * This is a SERVICE-level insert — it does NOT check the caller's auth.
 * Intended to be called by other server actions on behalf of users
 * (e.g. after a claim status change, deal expiry, etc.).
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

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      type,
      title,
      body,
    }

    if (link) {
      insertPayload.link = link
    }

    const { error } = await supabase.from('notifications').insert(insertPayload)

    if (error) {
      return { success: false, error: error.message }
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
      return { success: false, error: error.message }
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
      return { success: false, error: error.message }
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
      return { success: false, error: error.message }
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
      return { success: false, error: error.message }
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
