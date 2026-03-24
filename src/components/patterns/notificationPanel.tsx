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
      return <Tag size={18} weight="fill" className="text-amber-700" />
    case 'approval':
    case 'claim_approved':
      return (
        <CheckCircle size={18} weight="fill" className="text-emerald-600" />
      )
    case 'rejection':
    case 'claim_rejected':
      return <XCircle size={18} weight="fill" className="text-red-500" />
    case 'deal':
    case 'new_deal':
      return <Storefront size={18} weight="fill" className="text-amber-800" />
    default:
      return <Bell size={18} weight="fill" className="text-amber-700" />
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

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[#faf5ee] border border-[#d4c4b0] rounded-xl shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4c4b0]">
        <h3 className="text-sm font-semibold text-[#451a03]">Notifications</h3>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-amber-800 hover:text-[#451a03] transition-colors cursor-pointer"
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
              className="text-amber-800 animate-spin"
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Bell size={32} weight="light" className="text-[#78350f]/40" />
            <p className="text-sm text-[#78350f]/60">No notifications yet</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-amber-800/5 transition-colors cursor-pointer ${
                    !notification.is_read
                      ? 'border-l-2 border-l-amber-800 bg-amber-800/[0.03]'
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
                          ? 'font-semibold text-[#451a03]'
                          : 'font-normal text-[#78350f]'
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-xs text-[#78350f]/70 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-[11px] text-[#78350f]/50 mt-1">
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
                    className="absolute top-2 right-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[#78350f]/40 hover:text-amber-800 hover:bg-amber-800/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
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
      <div className="border-t border-[#d4c4b0]">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="block text-center text-xs font-medium text-amber-800 hover:text-[#451a03] py-2.5 transition-colors"
        >
          View all notifications
        </Link>
      </div>
    </div>
  )
}
