'use client'

import {
  Bell,
  Check,
  CheckCircle,
  Storefront,
  Tag,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { NotificationRow } from '@/lib/actions/notification-actions'
import {
  getNotificationsAction,
  markAllReadAction,
  markAsReadAction,
} from '@/lib/actions/notification-actions'

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
      return <Tag size={20} weight="fill" className="text-accent-hover" />
    case 'approval':
    case 'claim_approved':
      return <CheckCircle size={20} weight="fill" className="text-success" />
    case 'rejection':
    case 'claim_rejected':
      return <XCircle size={20} weight="fill" className="text-error" />
    case 'deal':
    case 'new_deal':
      return (
        <Storefront size={20} weight="fill" className="text-text-secondary" />
      )
    default:
      return <Bell size={20} weight="fill" className="text-accent-hover" />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const hasUnread = notifications.some((n) => !n.is_read)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const result = await getNotificationsAction(50)
      if (result.success && result.notifications) {
        setNotifications(result.notifications)
      } else {
        // A failed fetch must not masquerade as "no notifications"
        setHasError(true)
      }
    } catch {
      setHasError(true)
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
          <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
            <Bell size={20} weight="duotone" className="text-text-secondary" />
          </div>
          <h1 className="font-display text-xl font-bold text-text-primary tracking-tight">
            Notifications
          </h1>
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="min-h-[44px] px-2 -mr-2 text-sm font-medium text-accent hover:text-text-primary transition-colors cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="bg-bg-elevated border border-border-default rounded-2xl overflow-hidden">
        {isLoading ? (
          /* Skeleton rows mirror the real list so nothing shifts on load */
          <ul className="divide-y divide-border-default">
            {[1, 2, 3].map((i) => (
              <li key={i} className="px-5 py-4 flex gap-4">
                <div className="w-5 h-5 rounded-full bg-bg-surface animate-pulse shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-bg-surface animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-bg-surface animate-pulse" />
                  <div className="h-3 w-16 rounded bg-bg-surface animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
            <WarningCircle
              size={40}
              weight="light"
              className="text-text-muted"
            />
            <p className="text-sm text-text-secondary max-w-xs">
              We couldn&apos;t load your notifications. Check your connection
              and try again.
            </p>
            <Button variant="secondary" size="sm" onClick={loadNotifications}>
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
            <Bell size={40} weight="light" className="text-text-muted" />
            <h2 className="font-display text-base font-semibold text-text-primary tracking-tight">
              No notifications yet
            </h2>
            {/* Say only what exists: the one in-app notification a customer gets is
                "Claim submitted". There are no deal alerts. The relay email is optional
                per relay (markLeadRelayedAction's notifyCustomer), so this names the
                channel without promising a message. */}
            <p className="text-sm text-text-secondary max-w-xs">
              When you claim a deal, a confirmation shows up here. Anything else
              from our team, such as word that we&apos;ve passed your request to
              the clinic, comes by email.
            </p>
            <Link
              href="/dashboard/settings"
              className="text-sm font-medium text-accent hover:text-text-primary transition-colors"
            >
              Manage email preferences
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border-default">
            {notifications.map((notification) => (
              <li key={notification.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`w-full text-left pl-5 py-4 flex gap-4 hover:bg-accent-muted transition-colors cursor-pointer ${
                    !notification.is_read
                      ? 'border-l-3 border-l-accent bg-accent-muted pr-16'
                      : 'border-l-3 border-l-transparent pr-5'
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
                          ? 'font-semibold text-text-primary'
                          : 'font-normal text-text-secondary'
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-sm text-text-muted mt-1">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-1.5">
                      {getRelativeTime(notification.created_at)}
                    </p>
                  </div>
                </button>

                {/* Per-item mark-as-read button (unread only). Always visible
                    on touch — hover-only would strand it on mobile. */}
                {!notification.is_read && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkAsRead(notification.id)
                    }}
                    className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-surface sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-all cursor-pointer"
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
