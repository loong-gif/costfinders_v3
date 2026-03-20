'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}

export function Tooltip({
  content,
  children,
  side = 'right',
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  const calculatePosition = () => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const offset = 8

    let top = 0
    let left = 0

    switch (side) {
      case 'top':
        top = rect.top - offset
        left = rect.left + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + offset
        left = rect.left + rect.width / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - offset
        break
      case 'right':
      default:
        top = rect.top + rect.height / 2
        left = rect.right + offset
        break
    }

    setPosition({ top, left })
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      calculatePosition()
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTransformOrigin = () => {
    switch (side) {
      case 'top':
        return 'translate(-50%, -100%)'
      case 'bottom':
        return 'translate(-50%, 0)'
      case 'left':
        return 'translate(-100%, -50%)'
      case 'right':
      default:
        return 'translate(0, -50%)'
    }
  }

  const tooltipContent = isVisible && mounted ? (
    <div
      className={`
        fixed z-[9999]
        px-3 py-1.5
        bg-[#f2ebe2]/95 backdrop-blur-md
        border border-[#d4c4b0]
        rounded-lg
        text-sm text-[#451a03]
        shadow-lg
        whitespace-nowrap
        pointer-events-none
        animate-in fade-in zoom-in-95 duration-150
      `}
      style={{
        top: position.top,
        left: position.left,
        transform: getTransformOrigin(),
      }}
    >
      {content}
    </div>
  ) : null

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-flex"
    >
      {children}
      {mounted && tooltipContent && createPortal(tooltipContent, document.body)}
    </div>
  )
}
