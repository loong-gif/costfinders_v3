'use client'

import { DotsThreeCircle, SignOut, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Tooltip } from '@/components/ui/tooltip'

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'light' | 'fill' }>
}

export interface BaseSidebarProps {
  navItems: NavItem[]
  baseRoute: string // e.g., '/dashboard', '/business/dashboard', '/admin/dashboard'
  user: {
    displayName: string
    initial: string
  } | null
  onSignOut: () => void
  mobileNavCount?: number // defaults to 4 (reserving 1 slot for "More" when needed)
  /** Optional slot rendered above the user section (e.g. NotificationBell) */
  extraActions?: React.ReactNode
}

export function BaseSidebar({
  navItems,
  baseRoute,
  user,
  onSignOut,
  mobileNavCount = 4,
  extraActions,
}: BaseSidebarProps) {
  const pathname = usePathname()
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === baseRoute) {
      return pathname === baseRoute
    }
    return pathname.startsWith(href)
  }

  const hasOverflow = navItems.length > mobileNavCount + 1
  const visibleMobileItems = hasOverflow
    ? navItems.slice(0, mobileNavCount)
    : navItems
  const overflowItems = hasOverflow
    ? navItems.slice(mobileNavCount)
    : []

  // Close menu on route change
  useEffect(() => {
    setMoreMenuOpen(false)
  }, [pathname])

  // Close menu on escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMoreMenuOpen(false)
    }
  }, [])

  useEffect(() => {
    if (moreMenuOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [moreMenuOpen, handleKeyDown])

  return (
    <>
      {/* Desktop Sidebar - Icon Only */}
      <aside className="hidden md:flex fixed left-0 top-20 bottom-0 w-16 flex-col items-center bg-[#f2ebe2] border-r border-[#d4c4b0] z-40">
        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-2 flex flex-col items-center">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                <Link
                  href={item.href}
                  className={`
                    flex items-center justify-center w-12 h-12 rounded-xl
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-amber-800/8 text-amber-800'
                        : 'text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03]'
                    }
                  `}
                >
                  <Icon size={24} weight={active ? 'fill' : 'light'} />
                </Link>
              </Tooltip>
            )
          })}
        </nav>

        {/* Extra actions (e.g. notifications) */}
        {extraActions && (
          <div className="py-2 border-t border-[#d4c4b0] flex flex-col items-center">
            {extraActions}
          </div>
        )}

        {/* User Section */}
        <div className="py-4 border-t border-[#d4c4b0] space-y-2 flex flex-col items-center">
          {/* Avatar */}
          <Tooltip content={user?.displayName || 'User'} side="right">
            <div className="w-10 h-10 rounded-full bg-amber-800/15 flex items-center justify-center cursor-default">
              <span className="text-sm font-semibold text-amber-800">
                {user?.initial || 'U'}
              </span>
            </div>
          </Tooltip>

          {/* Sign Out */}
          <Tooltip content="Sign Out" side="right">
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-center w-12 h-12 rounded-xl text-[#78350f] hover:text-[#451a03] hover:bg-[#faf5ee] transition-all duration-200"
            >
              <SignOut size={24} weight="light" />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#f2ebe2] border-t border-[#d4c4b0] z-50">
        <div className="flex items-center justify-around py-2">
          {visibleMobileItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                  transition-all duration-200 min-w-0
                  ${
                    active
                      ? 'text-amber-800'
                      : 'text-[#78350f] hover:text-[#451a03]'
                  }
                `}
              >
                <Icon size={24} weight={active ? 'fill' : 'light'} />
                <span className="text-xs font-medium truncate max-w-[64px]">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* More button for overflow items */}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                transition-all duration-200
                ${
                  moreMenuOpen || overflowItems.some((item) => isActive(item.href))
                    ? 'text-amber-800'
                    : 'text-[#78350f] hover:text-[#451a03]'
                }
              `}
              aria-label="More navigation options"
              aria-expanded={moreMenuOpen}
            >
              <DotsThreeCircle
                size={24}
                weight={
                  moreMenuOpen || overflowItems.some((item) => isActive(item.href))
                    ? 'fill'
                    : 'light'
                }
              />
              <span className="text-xs font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile "More" overlay menu */}
      {hasOverflow && moreMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-[55]"
            onClick={() => setMoreMenuOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMoreMenuOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close menu"
          />

          {/* Menu panel */}
          <div className="md:hidden fixed bottom-[72px] left-4 right-4 bg-[#f2ebe2] border border-[#d4c4b0] rounded-2xl shadow-xl z-[60] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4c4b0]">
              <span className="text-sm font-semibold text-[#451a03]">
                More
              </span>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                className="p-1 rounded-lg text-[#78350f] hover:text-[#451a03] hover:bg-[#faf5ee] transition-colors"
                aria-label="Close menu"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="py-2">
              {overflowItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3
                      transition-colors duration-200
                      ${
                        active
                          ? 'bg-amber-800/8 text-amber-800'
                          : 'text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03]'
                      }
                    `}
                  >
                    <Icon size={22} weight={active ? 'fill' : 'light'} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}

              {/* Sign Out in overflow menu */}
              <div className="border-t border-[#d4c4b0] mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    onSignOut()
                  }}
                  className="flex items-center gap-3 px-4 py-3 w-full text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03] transition-colors duration-200"
                >
                  <SignOut size={22} weight="light" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
