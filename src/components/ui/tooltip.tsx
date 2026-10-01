'use client'

import {
  cloneElement,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
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
  const contentId = useId()

  // Several icon-only buttons (the analytics dashboard's `Info` glyphs) carry no
  // text of their own and rely on this tooltip for their whole meaning, which
  // never reached assistive tech: the tooltip was purely visual. The description
  // is now always in the DOM as sr-only text, so `aria-describedby` resolves
  // whether or not the visual bubble happens to be showing — waiting for the
  // 200ms hover/focus delay to mount it would be too late for a screen reader
  // announcing on focus.
  const describedChild = isValidElement<{ 'aria-describedby'?: string }>(
    children,
  )
    ? cloneElement(children, {
        'aria-describedby': children.props['aria-describedby'] ?? contentId,
      })
    : children

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
      default:
        return 'translate(0, -50%)'
    }
  }

  const tooltipContent =
    isVisible && mounted ? (
      <div
        className={`
        fixed z-[9999]
        px-3 py-1.5
        bg-bg-elevated
        border border-border-default
        rounded-lg
        text-sm text-text-primary
        shadow-md
        whitespace-nowrap
        pointer-events-none
        animate-in fade-in zoom-in-95 duration-150
      `}
        style={{
          top: position.top,
          left: position.left,
          transform: getTransformOrigin(),
        }}
        // The sr-only copy below is the one assistive tech reads; this is the
        // visual duplicate, so hiding it avoids announcing the text twice.
        aria-hidden="true"
      >
        {content}
      </div>
    ) : null

  return (
    // Passive wrapper that surfaces a tooltip for its child; the child is the real
    // control. Giving this div a role would misreport it to assistive tech.
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper, not a control
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // Keyboard parity: the tooltip was mouse-only, so keyboard users never saw it.
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className="inline-flex"
    >
      {describedChild}
      <span className="sr-only" id={contentId}>
        {content}
      </span>
      {mounted && tooltipContent && createPortal(tooltipContent, document.body)}
    </div>
  )
}
