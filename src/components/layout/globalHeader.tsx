'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)

import { List, User, X } from '@phosphor-icons/react'
import { SkipToContent } from '@/components/layout/skipToContent'
import { NotificationBell } from '@/components/patterns/notificationBell'
import { useAuth } from '@/lib/context/authContext'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { useScrolled } from '@/lib/hooks/useScrolled'

type AuthView = 'signUp' | 'signIn'

const NAV_LINKS = [
  { href: '/deals', label: 'Deals' },
  { href: '/treatments', label: 'Treatments' },
  { href: '/guides', label: 'Guides' },
  { href: '/business', label: 'For providers' },
]

const REQUEST_LISTING_HREF = '/business/listing-request?type=add'

const wordmark = (
  <span className="font-display font-bold text-xl tracking-tight text-text-primary">
    CostFinders
    <span aria-hidden="true" className="text-accent-graphic">
      .
    </span>
  </span>
)

/** Link styled as a secondary Button — avoids nesting <button> inside <a>. */
// Focus ring intentionally omitted: globals.css gives every control the same
// visible `:focus-visible` outline. The amber ring that used to live here
// measured 1.8:1 against sand, below the 3:1 WCAG 1.4.11 requires.
const secondaryLink =
  'inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 rounded-full text-sm font-medium bg-bg-base hover:bg-bg-surface border border-border-default text-text-primary transition-colors'

const iconButton =
  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-text-primary hover:bg-bg-surface transition-colors cursor-pointer'

export function GlobalHeader() {
  const pathname = usePathname()
  const { state } = useAuth()
  const { state: businessState } = useBusinessAuth()
  const scrolled = useScrolled(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<AuthView>('signIn')

  // Phone menu. A modal <dialog> brings focus-in, Escape and an inert page
  // behind it with no code here.
  const menuRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // The browser only hands focus back to the trigger if the trigger had it, and
  // a tap (or a click in Safari) never focuses a button, so focus fell to <body>.
  // When `close` fires, Chrome still reports focus on the now-hidden control
  // inside the dialog. "Sign in" may already have moved focus into its modal,
  // so only reclaim focus that is going nowhere.
  const handleMenuClosed = () => {
    setIsMenuOpen(false)
    const focused = document.activeElement
    if (
      !focused ||
      focused === document.body ||
      menuRef.current?.contains(focused)
    ) {
      menuButtonRef.current?.focus()
    }
  }

  // Close on route change — back/forward included, which no link click sees.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intended trigger
  useEffect(() => {
    menuRef.current?.close()
  }, [pathname])

  // The page behind a modal dialog is inert but still scrolls; stop that.
  useEffect(() => {
    if (!isMenuOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  // Hide on all dashboard pages (they have their own navigation)
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/business/dashboard') ||
    pathname.startsWith('/admin/dashboard')
  ) {
    return null
  }

  const handleSignIn = () => {
    setModalView('signIn')
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
  }

  const openMenu = () => {
    menuRef.current?.showModal()
    setIsMenuOpen(true)
  }

  // Escape reaches state through onClose; this path also does the work now,
  // because `close` lands a frame later — after "Sign in" has opened its modal,
  // which by then has recorded a hidden menu button as its focus-return target
  // and whose scroll lock the menu's cleanup would undo.
  const closeMenu = () => {
    menuRef.current?.close()
    setIsMenuOpen(false)
    menuButtonRef.current?.focus()
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  // Route signed-in people to THEIR dashboard. `businessState` only turns
  // authenticated once the server returns this session's business_profiles row
  // (RLS-gated), so it is a server-controlled signal, not user_metadata.
  // Admins have no app-wide provider, so they fall through to the consumer
  // dashboard — they reach /admin/dashboard from /admin, not from here.
  const isBusinessOwner = businessState.isAuthenticated
  const isSignedIn = state.isAuthenticated || isBusinessOwner
  const dashboardHref = isBusinessOwner ? '/business/dashboard' : '/dashboard'
  const dashboardLabel = isBusinessOwner ? 'Business dashboard' : 'Dashboard'
  // Hold a fixed-width slot until we know who this is: while the session
  // resolves (otherwise a signed-in visitor sees "Sign in" first), and while
  // business auth lags consumer auth (otherwise an owner is offered the wrong
  // dashboard).
  const authPending = !state.isReady || (isSignedIn && businessState.isLoading)

  return (
    <>
      {/* Solid, not bg-bg-base/95 with a blur: on WebKit the text scrolling underneath stayed
          legible through it and read as overlapping the nav (2026-09-28). */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-bg-base border-b border-border-default transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}
      >
        {/* First focusable control on every public page */}
        <SkipToContent />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo + primary nav */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              {wordmark}
            </Link>

            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-7 ml-10"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`text-sm font-medium transition-colors min-h-[44px] inline-flex items-center ${
                    isActive(href)
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side: Auth + phone menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {authPending ? (
              <div
                className="h-11 w-24 sm:w-52 rounded-md bg-bg-surface animate-pulse"
                aria-hidden="true"
              />
            ) : isSignedIn ? (
              <>
                <NotificationBell />
                <Link href={dashboardHref} className={secondaryLink}>
                  <User size={18} weight="bold" />
                  <span className="sr-only sm:not-sr-only">
                    {dashboardLabel}
                  </span>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors inline-flex items-center justify-center min-h-[44px] px-3 cursor-pointer"
                >
                  Sign in
                </button>
                <Link
                  href={REQUEST_LISTING_HREF}
                  className="hidden sm:inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-text-primary text-sm font-semibold text-text-primary hover:bg-bg-surface transition-colors"
                >
                  Request a listing
                </Link>
              </div>
            )}

            <button
              type="button"
              ref={menuButtonRef}
              onClick={openMenu}
              aria-label="Menu"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
              className={`md:hidden -mr-2 ${iconButton}`}
            >
              <List size={24} weight="light" />
            </button>
          </div>
        </div>
      </header>

      {/* Not md:hidden: a hidden modal dialog would leave the page inert if a
          tablet rotates past md with the menu open. */}
      <dialog
        ref={menuRef}
        id={menuId}
        aria-label="Menu"
        onClose={handleMenuClosed}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg-base text-text-primary"
      >
        <div className="flex h-16 items-center justify-between border-b border-border-default px-4 sm:px-6">
          <span aria-hidden="true">{wordmark}</span>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className={`-mr-2 ${iconButton}`}
          >
            <X size={24} weight="light" />
          </button>
        </div>

        <nav aria-label="Site" className="px-4 py-2 sm:px-6">
          <ul className="divide-y divide-border-default">
            {[
              ...NAV_LINKS,
              { href: REQUEST_LISTING_HREF, label: 'Request a listing' },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={closeMenu}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`flex min-h-[52px] items-center font-display text-lg font-semibold ${
                    isActive(href) ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {authPending ? (
              <div
                className="h-11 w-full rounded-full bg-bg-surface animate-pulse"
                aria-hidden="true"
              />
            ) : isSignedIn ? (
              <Link
                href={dashboardHref}
                onClick={closeMenu}
                className={`${secondaryLink} w-full`}
              >
                <User size={18} weight="bold" />
                {dashboardLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  handleSignIn()
                }}
                className={`${secondaryLink} w-full cursor-pointer`}
              >
                Sign in
              </button>
            )}
          </div>
        </nav>
      </dialog>

      <AuthModal
        isOpen={isModalOpen}
        onClose={handleClose}
        initialView={modalView}
        onSuccess={handleClose}
      />
    </>
  )
}
