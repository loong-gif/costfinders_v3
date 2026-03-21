'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getNotificationsAction,
  getUnreadCountAction,
  markAllReadAction,
  markAsReadAction,
} from '@/lib/actions/notification-actions'
import type { NotificationRow } from '@/lib/actions/notification-actions'

const POLL_INTERVAL_MS = 60_000

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch unread count (used on mount + polling)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadCountAction()
      if (result.success) {
        setUnreadCount(result.count ?? 0)
      }
    } catch {
      // Silently fail — bell just won't update
    }
  }, [])

  // On mount: get initial count + start polling
  useEffect(() => {
    fetchUnreadCount()

    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchUnreadCount])

  // Load full notification list (called when panel opens)
  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getNotificationsAction(20)
      if (result.success && result.notifications) {
        setNotifications(result.notifications)
        const unread = result.notifications.filter((n) => !n.is_read).length
        setUnreadCount(unread)
      }
    } catch {
      // Keep existing notifications on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Mark a single notification as read (optimistic)
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))

    try {
      await markAsReadAction(id)
    } catch {
      // Revert on failure — refetch
      const result = await getNotificationsAction(20)
      if (result.success && result.notifications) {
        setNotifications(result.notifications)
        const unread = result.notifications.filter((n) => !n.is_read).length
        setUnreadCount(unread)
      }
    }
  }, [])

  // Mark all notifications as read (optimistic)
  const markAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)

    try {
      await markAllReadAction()
    } catch {
      // Revert on failure — refetch
      const result = await getNotificationsAction(20)
      if (result.success && result.notifications) {
        setNotifications(result.notifications)
        const unread = result.notifications.filter((n) => !n.is_read).length
        setUnreadCount(unread)
      }
    }
  }, [])

  return {
    unreadCount,
    notifications,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllRead,
  }
}
