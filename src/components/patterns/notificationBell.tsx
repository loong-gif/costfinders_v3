'use client'

import { Bell } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationPanel } from '@/components/patterns/notificationPanel'
import { useNotifications } from '@/lib/hooks/useNotifications'

export function NotificationBell() {
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

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClose])

  // Format badge count
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-amber-800/10 transition-colors cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell
          size={20}
          weight={isOpen ? 'fill' : 'light'}
          className="text-[#451a03]"
        />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
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
        />
      )}
    </div>
  )
}
