'use server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Stub actions — will be replaced by the notification-actions agent
// ---------------------------------------------------------------------------

export async function getNotificationsAction(
  _limit: number,
): Promise<NotificationRow[]> {
  return []
}

export async function getUnreadCountAction(): Promise<number> {
  return 0
}

export async function markAsReadAction(
  _id: string,
): Promise<{ success: boolean }> {
  return { success: true }
}

export async function markAllReadAction(): Promise<{ success: boolean }> {
  return { success: true }
}
