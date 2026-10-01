'use client'

import { Bell } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationPanel } from '@/components/patterns/notificationPanel'
import { useNotifications } from '@/lib/hooks/useNotifications'

interface NotificationBellProps {
  /** Forwarded to NotificationPanel. Use 'beside' inside the narrow icon rail. */
  placement?: 'below' | 'beside'
}

export function NotificationBell({
  placement = 'below',
}: NotificationBellProps) {
  const {
    unreadCount,
    notifications,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllRead,
  } = useNotifications()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    const willOpen = !isOpen
    setIsOpen(willOpen)
    if (willOpen) {
      loadNotifications()
    }
  }

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Close panel on outside click, and on Escape. Escape was missing entirely:
  // a keyboard user who opened the panel had to Tab through every notification
  // to get out of it, and it stayed open over the page.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      handleClose()
      // Without this, focus is stranded on a button that just unmounted.
      triggerRef.current?.focus()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  // Format badge count
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-bg-surface transition-colors cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        // Was absent, so a screen reader never reported that this button opens
        // anything, let alone whether it is open.
        aria-expanded={isOpen}
      >
        <Bell
          size={20}
          weight={isOpen ? 'fill' : 'light'}
          className="text-text-primary"
        />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1 leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onMarkAllRead={markAllRead}
          onClose={handleClose}
          placement={placement}
        />
      )}
    </div>
  )
}
