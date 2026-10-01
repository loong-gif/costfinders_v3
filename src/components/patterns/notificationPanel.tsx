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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { NotificationRow } from '@/lib/actions/notification-actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  notifications: NotificationRow[]
  isLoading: boolean
  onMarkAsRead: (id: string) => void
  onMarkAllRead: () => void
  onClose: () => void
  /**
   * Where the panel opens relative to its trigger.
   * 'below'  — drops beneath the bell, right-aligned (header triggers).
   * 'beside' — opens to the right of the bell (the 64px icon rail, where a
   *            right-aligned 320px panel would render off the left edge).
   */
  placement?: 'below' | 'beside'
}

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
      return <Tag size={18} weight="fill" className="text-accent-hover" />
    case 'approval':
    case 'claim_approved':
      return <CheckCircle size={18} weight="fill" className="text-success" />
    case 'rejection':
    case 'claim_rejected':
      return <XCircle size={18} weight="fill" className="text-error" />
    case 'deal':
    case 'new_deal':
      return (
        <Storefront size={18} weight="fill" className="text-text-secondary" />
      )
    default:
      return <Bell size={18} weight="fill" className="text-accent-hover" />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPanel({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllRead,
  onClose,
  placement = 'below',
}: NotificationPanelProps) {
  const router = useRouter()

  const hasUnread = notifications.some((n) => !n.is_read)

  const handleItemClick = (notification: NotificationRow) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
      onClose()
    }
  }

  // Deliberately no role on the panel root: role="menu" would be wrong (a menu
  // may only contain menuitems, and this holds a heading, a list and a link),
  // and a disclosure's revealed content needs no accessible name of its own —
  // the heading below already gives it structure. What was actually missing was
  // Escape and aria-expanded, both of which live on the trigger in
  // notificationBell.tsx.
  return (
    <div
      className={`absolute w-80 ${
        placement === 'beside'
          ? 'left-full bottom-0 ml-2'
          : 'right-0 top-full mt-2'
      } bg-bg-elevated border border-border-default rounded-xl shadow-lg z-50 overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h3 className="font-display text-sm font-semibold text-text-primary">
          Notifications
        </h3>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-accent hover:text-text-primary transition-colors cursor-pointer focus-visible:-outline-offset-2"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <CircleNotch
              size={24}
              weight="bold"
              className="text-text-secondary animate-spin"
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Bell size={32} weight="light" className="text-text-muted" />
            <p className="text-sm text-text-secondary">No notifications yet</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent-muted transition-colors cursor-pointer focus-visible:-outline-offset-2 ${
                    !notification.is_read
                      ? 'border-l-2 border-l-accent bg-accent-muted'
                      : 'border-l-2 border-l-transparent'
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
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-[11px] text-text-muted mt-1">
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
                      onMarkAsRead(notification.id)
                    }}
                    className="absolute top-2 right-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-accent hover:bg-bg-surface opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:-outline-offset-2 transition-all cursor-pointer"
                    aria-label="Mark as read"
                  >
                    <Check size={14} weight="bold" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* View all link */}
      <div className="border-t border-border-default">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="block text-center text-xs font-medium text-accent hover:text-text-primary py-2.5 transition-colors focus-visible:-outline-offset-2"
        >
          View all notifications
        </Link>
      </div>
    </div>
  )
}
