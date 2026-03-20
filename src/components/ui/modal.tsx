'use client'

import { X } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect } from 'react'

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

// Mobile variant classes for responsive behavior
const mobileVariants = {
  default: {
    container: 'flex items-start justify-center pt-24 px-4 pb-4',
    modal: '',
    animation: 'animate-in fade-in zoom-in-95 duration-200',
  },
  fullscreen: {
    container:
      'flex items-start justify-center md:pt-24 px-0 md:px-4 pb-0 md:pb-4',
    modal:
      'inset-0 md:inset-auto w-full h-full md:w-auto md:h-auto rounded-none md:rounded-2xl',
    animation: 'animate-in fade-in md:zoom-in-95 duration-200',
  },
  bottom: {
    container:
      'flex items-end md:items-start justify-center md:pt-24 px-0 md:px-4 pb-0 md:pb-4',
    modal:
      'w-full md:w-auto rounded-t-2xl md:rounded-2xl max-h-[90vh] md:max-h-none',
    animation:
      'animate-in slide-in-from-bottom md:fade-in md:zoom-in-95 duration-200',
  },
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
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 ${variant.container}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#451a03]/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose()
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div
        className={`
          relative w-full ${mobileVariant === 'default' ? sizes[size] : `md:${sizes[size]}`}
          bg-[#f2ebe2]
          border border-[#d4c4b0]
          ${mobileVariant === 'default' ? 'rounded-2xl' : ''} shadow-elevated
          ${variant.modal}
          ${variant.animation}
        `}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4c4b0]">
            <h2 className="text-lg font-semibold text-[#451a03]">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#92400e] hover:text-[#451a03] hover:bg-[#faf5ee] transition-colors"
              type="button"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={title ? 'p-6' : 'p-6 pt-4'}>
          {!title && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#92400e] hover:text-[#451a03] hover:bg-[#faf5ee] transition-colors"
              type="button"
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
