'use client'

import {
  Bell,
  Check,
  CheckCircle,
  CircleNotch,
  Storefront,
  Tag,
  XCircle,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  getNotificationsAction,
  markAllReadAction,
  markAsReadAction,
} from '@/lib/actions/notification-actions'
import type { NotificationRow } from '@/lib/actions/notification-actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'claim':
    case 'claim_submitted':
      return <Tag size={20} weight="fill" className="text-amber-700" />
    case 'approval':
    case 'claim_approved':
      return (
        <CheckCircle size={20} weight="fill" className="text-emerald-600" />
      )
    case 'rejection':
    case 'claim_rejected':
      return <XCircle size={20} weight="fill" className="text-red-500" />
    case 'deal':
    case 'new_deal':
      return <Storefront size={20} weight="fill" className="text-amber-800" />
    default:
      return <Bell size={20} weight="fill" className="text-amber-700" />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const hasUnread = notifications.some((n) => !n.is_read)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getNotificationsAction(50)
      if (result.success && result.notifications) {
        setNotifications(result.notifications)
      }
    } catch {
      // Keep empty state on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    try {
      await markAsReadAction(id)
    } catch {
      loadNotifications()
    }
  }

  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await markAllReadAction()
    } catch {
      loadNotifications()
    }
  }

  const handleItemClick = (notification: NotificationRow) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
            <Bell size={20} weight="duotone" className="text-amber-800" />
          </div>
          <h1 className="text-xl font-bold text-[#451a03]">Notifications</h1>
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-amber-800 hover:text-[#451a03] transition-colors cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="bg-[#faf5ee] border border-[#d4c4b0] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <CircleNotch
              size={28}
              weight="bold"
              className="text-amber-800 animate-spin"
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell size={40} weight="light" className="text-[#78350f]/30" />
            <p className="text-sm text-[#78350f]/60">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#d4c4b0]/50">
            {notifications.map((notification) => (
              <li key={notification.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`w-full text-left px-5 py-4 flex gap-4 hover:bg-amber-800/5 transition-colors cursor-pointer ${
                    !notification.is_read
                      ? 'border-l-3 border-l-amber-800 bg-amber-800/[0.03]'
                      : 'border-l-3 border-l-transparent'
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-snug ${
                        !notification.is_read
                          ? 'font-semibold text-[#451a03]'
                          : 'font-normal text-[#78350f]'
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-sm text-[#78350f]/70 mt-1">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-[#78350f]/50 mt-1.5">
                      {getRelativeTime(notification.created_at)}
                    </p>
                  </div>
                </button>

                {/* Per-item mark-as-read button (unread only) */}
                {!notification.is_read && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkAsRead(notification.id)
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-[#78350f]/40 hover:text-amber-800 hover:bg-amber-800/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    aria-label="Mark as read"
                  >
                    <Check size={16} weight="bold" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
