'use client'

import { X } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  height?: 'auto' | 'half' | 'full'
}

const heights = {
  auto: 'max-h-[85vh]',
  half: 'h-[50vh]',
  full: 'h-[90vh]',
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  height = 'auto',
}: BottomSheetProps) {
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
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#451a03]/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose()
        }}
        role="button"
        tabIndex={0}
        aria-label="Close bottom sheet"
      />

      {/* Sheet */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50
          ${heights[height]}
          bg-[#f2ebe2]
          border-t border-[#d4c4b0]
          rounded-t-2xl shadow-elevated
          animate-in slide-in-from-bottom duration-200
          flex flex-col
        `}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle indicator */}
        {height === 'full' && (
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 bg-stone-500/50 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4c4b0] shrink-0">
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
        <div className={`flex-1 overflow-y-auto ${title ? 'p-6' : 'p-6 pt-4'}`}>
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
