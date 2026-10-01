'use client'

import { DotsThreeCircle, SignOut, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

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
  const overflowItems = hasOverflow ? navItems.slice(mobileNavCount) : []

  // Close the mobile "More" menu after navigating. pathname is the trigger, not a value
  // the body reads, so biome sees it as extraneous — removing it would leave the menu
  // open over the new page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intended trigger
  useEffect(() => {
    setMoreMenuOpen(false)
  }, [pathname])

  // Close menu on escape key, and hand focus back to the trigger — the panel
  // unmounts under the user otherwise, dropping them at the top of the document.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMoreMenuOpen(false)
      moreTriggerRef.current?.focus()
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
      {/* top-16 = flush under the 64px DashboardHeader; anything larger leaves
          a strip of page background between the header border and the rail. */}
      <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-16 flex-col items-center bg-bg-base border-r border-border-default z-40">
        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          className="flex-1 py-4 space-y-2 flex flex-col items-center"
        >
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`
                    flex items-center justify-center w-12 h-12 rounded-xl
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-bg-surface text-text-primary'
                        : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'
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
          <div className="py-2 border-t border-border-default flex flex-col items-center">
            {extraActions}
          </div>
        )}

        {/* User Section */}
        <div className="py-4 border-t border-border-default space-y-2 flex flex-col items-center">
          {/* Avatar */}
          <Tooltip content={user?.displayName || 'User'} side="right">
            <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center cursor-default">
              <span className="text-sm font-semibold text-text-primary">
                {user?.initial || 'U'}
              </span>
            </div>
          </Tooltip>

          {/* Sign Out */}
          <Tooltip content="Sign out" side="right">
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="flex items-center justify-center w-12 h-12 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200"
            >
              <SignOut size={24} weight="light" />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Main navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-base/95 backdrop-blur-sm border-t border-border-default z-50 safe-bottom"
      >
        <div className="flex items-center justify-around py-2">
          {visibleMobileItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                  transition-all duration-200 min-w-0
                  ${
                    active
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
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
              ref={moreTriggerRef}
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                transition-all duration-200
                ${
                  moreMenuOpen ||
                  overflowItems.some((item) => isActive(item.href))
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }
              `}
              aria-label="More navigation options"
              aria-expanded={moreMenuOpen}
            >
              <DotsThreeCircle
                size={24}
                weight={
                  moreMenuOpen ||
                  overflowItems.some((item) => isActive(item.href))
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
          {/* Backdrop — Escape and the close button cover the keyboard path,
              so it stays out of the tab order and the accessibility tree */}
          <button
            type="button"
            className="md:hidden fixed inset-0 bg-[var(--color-bg-overlay)] z-[55]"
            onClick={() => setMoreMenuOpen(false)}
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Menu panel — sits above the bottom nav *and* the home indicator */}
          <div className="md:hidden fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-4 right-4 bg-bg-elevated border border-border-default rounded-2xl shadow-lg z-[60] max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
              <span className="text-sm font-semibold text-text-primary">
                More
              </span>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false)
                  moreTriggerRef.current?.focus()
                }}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
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
                          ? 'bg-bg-surface text-text-primary'
                          : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'
                      }
                    `}
                  >
                    <Icon size={22} weight={active ? 'fill' : 'light'} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}

              {/* Sign Out in overflow menu */}
              <div className="border-t border-border-default mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    onSignOut()
                  }}
                  className="flex items-center gap-3 px-4 py-3 w-full text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors duration-200"
                >
                  <SignOut size={22} weight="light" />
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
