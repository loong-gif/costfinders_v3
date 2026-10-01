'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SkipToContent } from '@/components/layout/skipToContent'
import { NotificationBell } from '@/components/patterns/notificationBell'
import { useAuth } from '@/lib/context/authContext'
import { useScrolled } from '@/lib/hooks/useScrolled'

const navLinks = [
  { href: '/deals', label: 'Deals' },
  { href: '/treatments', label: 'Treatments' },
]

export function DashboardHeader() {
  const { state } = useAuth()
  const scrolled = useScrolled(20)
  const pathname = usePathname()
  const user = state.user

  // One source, the profile. "Account" is for a profile with no first name, not for
  // "still loading" — rendering it during the fetch made the name flip on every load.
  const displayName = !state.isReady ? null : user?.firstName || 'Account'
  const initial = !state.isReady
    ? ''
    : user?.firstName?.[0]?.toUpperCase() ||
      user?.email?.[0]?.toUpperCase() ||
      'U'

  // This header is shared by the consumer, business and admin dashboards, so
  // the avatar has to open the settings page for the dashboard you are in —
  // not always the consumer one. The path is the reliable signal here.
  const inAdmin = pathname.startsWith('/admin/dashboard')
  const inBusiness = pathname.startsWith('/business/dashboard')
  const settingsHref = inAdmin
    ? '/admin/dashboard/settings'
    : inBusiness
      ? '/business/dashboard/settings'
      : '/dashboard/settings'

  // The consumer browse links only make sense on the consumer dashboard; in the
  // business/admin shells they collide with same-named items in the icon rail.
  const showBrowseLinks = !inAdmin && !inBusiness

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-bg-base/95 backdrop-blur-sm border-b border-border-default transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}
    >
      {/* First focusable control on every dashboard page — ahead of the icon
          rail's nine links, which a keyboard user otherwise re-traverses on
          every navigation. */}
      <SkipToContent />
      {/* Full-bleed bar so the border and scroll shadow run edge to edge; the
          inner offset keeps the content column aligned with <main>. */}
      <div className="md:pl-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-6">
            {/* The global header's wordmark: ink, with the coral dot. */}
            <Link href="/" className="flex items-center">
              <span className="font-display font-bold text-xl tracking-tight text-text-primary">
                CostFinders
                <span aria-hidden="true" className="text-accent-graphic">
                  .
                </span>
              </span>
            </Link>

            {/* Nav links — hidden on mobile (the bottom nav covers this there) */}
            {showBrowseLinks && (
              <nav className="hidden md:flex items-center gap-4">
                {navLinks.map((link) => {
                  const isActive = pathname.startsWith(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              href={settingsHref}
              aria-label={
                displayName
                  ? `Account settings for ${displayName}`
                  : 'Account settings'
              }
              className="flex items-center gap-2.5 min-h-[44px] px-1.5 -mr-1.5 rounded-full hover:bg-bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                <span className="text-xs font-semibold text-text-primary">
                  {initial}
                </span>
              </div>
              {displayName ? (
                <span className="hidden sm:block text-sm font-medium text-text-primary">
                  {displayName}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="hidden sm:block h-4 w-16 rounded bg-bg-surface"
                />
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
