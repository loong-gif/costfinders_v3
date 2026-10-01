'use client'

import { X } from '@phosphor-icons/react'
import { type ReactNode, useEffect, useId, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  mobileVariant?: 'default' | 'fullscreen' | 'bottom'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

// Spelled out, not `md:${sizes[size]}`: Tailwind only generates classes it can read in the
// source, so the interpolated form never existed and the cap silently did nothing.
const mdSizes = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
}

// Mobile variant classes for responsive behavior.
//
// The `animation` strings below are inert: `animate-in`, `fade-in`,
// `zoom-in-95` and `slide-in-from-bottom` come from `tailwindcss-animate`,
// which is not installed (no `@plugin` in globals.css, no dependency in
// package.json) — the compiled stylesheet contains zero matches for any of
// them. So dialogs currently appear with no entrance animation, and there is
// nothing here for `prefers-reduced-motion` to suppress. Left in place because
// they are the intended design if the plugin is ever added; anyone adding it
// must extend the reduced-motion block in globals.css at the same time.
const mobileVariants = {
  // Every variant caps the panel to the viewport and scrolls its content (see the Content div
  // below). Without the cap the overlay grew past the window with body scroll locked, and the
  // claim form's Cancel and "Claim deal" sat below the fold with no way to reach them.
  // 7rem = the container's pt-24 + pb-4.
  default: {
    container: 'flex items-start justify-center pt-24 px-4 pb-4',
    modal: 'max-h-[calc(100dvh-7rem)]',
    animation: 'animate-in fade-in zoom-in-95 duration-200',
  },
  fullscreen: {
    container:
      'flex items-start justify-center pt-[env(safe-area-inset-top)] md:pt-24 px-0 md:px-4 pb-0 md:pb-4',
    modal:
      // md:w-full, not md:w-auto: a shrink-to-fit dialog sized itself to its content and
      // squeezed the claim form's two buttons onto two lines each. md:max-w-* caps it.
      'inset-0 md:inset-auto w-full h-full md:h-auto md:max-h-[calc(100dvh-7rem)] rounded-none md:rounded-2xl',
    animation: 'animate-in fade-in md:zoom-in-95 duration-200',
  },
  bottom: {
    container:
      'flex items-end md:items-start justify-center md:pt-24 px-0 md:px-4 pb-0 md:pb-4',
    modal:
      'w-full rounded-t-2xl md:rounded-2xl max-h-[90dvh] md:max-h-[calc(100dvh-7rem)]',
    animation:
      'animate-in slide-in-from-bottom md:fade-in md:zoom-in-95 duration-200',
  },
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.getClientRects().length > 0)
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  mobileVariant = 'default',
}: ModalProps) {
  const variant = mobileVariants[mobileVariant]
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Keep the latest onClose without re-running the focus effect (callers
  // commonly pass an inline arrow, which would otherwise steal focus back
  // to the first field on every render).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Remember what to restore focus to, captured on the opening render:
  // children commit their own focus (an `autoFocus` field, say) before this
  // component's effects run, so reading it in the effect below would record
  // an element inside the dialog instead of the trigger.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  if (isOpen && !restoreFocusRef.current && typeof document !== 'undefined') {
    restoreFocusRef.current = document.activeElement as HTMLElement | null
  }

  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return

      // Focus trap: keep Tab / Shift+Tab inside the dialog
      const focusable = getFocusable(dialog)
      if (focusable.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!dialog.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog, unless the content already claimed it
    if (dialog && !dialog.contains(document.activeElement)) {
      const [firstFocusable] = getFocusable(dialog)
      ;(firstFocusable ?? dialog).focus()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
      const restoreTo = restoreFocusRef.current
      restoreFocusRef.current = null
      if (restoreTo?.isConnected) restoreTo.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 ${variant.container}`}>
      {/* Backdrop — Escape and the close button cover the keyboard path,
          so it stays out of the tab order and the accessibility tree */}
      <button
        type="button"
        className="absolute inset-0 bg-[var(--color-bg-overlay)] backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        className={`
          relative flex flex-col w-full ${mobileVariant === 'default' ? sizes[size] : mdSizes[size]}
          bg-bg-elevated
          border border-border-default
          ${mobileVariant === 'default' ? 'rounded-2xl' : ''} shadow-lg
          ${variant.modal}
          ${variant.animation}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-border-default">
            <h2
              className="font-display text-lg font-semibold text-text-primary"
              id={titleId}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2.5 -mr-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
              type="button"
              aria-label="Close"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        )}

        {/* Content: the scroll region. The header above stays in view; the bottom padding clears
            the home indicator on a notched phone and is 1.5rem everywhere else. */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${title ? '' : 'pt-4'}`}
        >
          {!title && (
            <button
              onClick={onClose}
              // bg: the content scrolls under this button now, and a field passing beneath the
              // bare X made it hard to read.
              className="absolute top-4 right-4 p-2.5 rounded-lg bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
              type="button"
              aria-label="Close"
            >
              <X size={20} weight="bold" />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
