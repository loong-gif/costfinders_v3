'use client'

import { X } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

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

/** Minimum drag distance (px) to trigger close */
const DISMISS_THRESHOLD = 100

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  height = 'auto',
}: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

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

  // Reset drag state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setDragY(0)
      isDragging.current = false
    }
  }, [isOpen])

  // --- Swipe-to-dismiss gesture handlers ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const sheet = sheetRef.current
    if (!sheet) return
    // Only activate on the drag handle zone (top 48px of sheet)
    const sheetTop = sheet.getBoundingClientRect().top
    if (e.clientY - sheetTop > 48) return

    isDragging.current = true
    startY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const delta = e.clientY - startY.current
    // Only allow downward drag
    if (delta > 0) setDragY(delta)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (dragY > DISMISS_THRESHOLD) {
      onClose()
    }
    setDragY(0)
  }, [dragY, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#451a03]/40 backdrop-blur-sm animate-in fade-in duration-200"
        style={{ opacity: dragY > 0 ? Math.max(0.2, 1 - dragY / 300) : undefined }}
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
        ref={sheetRef}
        className={`
          fixed bottom-0 left-0 right-0 z-50
          ${heights[height]}
          bg-[#f2ebe2]
          border-t border-[#d4c4b0]
          rounded-t-2xl shadow-elevated
          animate-in slide-in-from-bottom duration-200
          flex flex-col
          ${isDragging.current ? '' : 'transition-transform duration-200'}
        `}
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Drag handle — always visible for swipe affordance */}
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none">
          <div className="w-10 h-1.5 bg-stone-400/60 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#d4c4b0] shrink-0">
            <h2 className="text-lg font-semibold text-[#451a03]">{title}</h2>
            <button
              onClick={onClose}
              className="p-2.5 -mr-1.5 rounded-lg text-[#92400e] hover:text-[#451a03] hover:bg-[#faf5ee] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              type="button"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${title ? 'p-6' : 'p-6 pt-2'}`}>
          {!title && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg text-[#92400e] hover:text-[#451a03] hover:bg-[#faf5ee] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
