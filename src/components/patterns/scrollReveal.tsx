'use client'

import type { ReactNode } from 'react'
import { useScrollReveal } from '@/lib/hooks/useScrollReveal'

type Animation = 'fadeInUp' | 'fadeIn' | 'scaleIn' | 'slideInLeft'

interface ScrollRevealProps {
  children: ReactNode
  animation?: Animation
  delay?: number
  duration?: number
  stagger?: number
  className?: string
  threshold?: number
}

export function ScrollReveal({
  children,
  animation = 'fadeInUp',
  delay = 0,
  duration = 600,
  stagger = 0,
  className = '',
  threshold = 0.15,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal({ threshold })

  return (
    <div
      ref={ref}
      data-scroll-reveal={animation}
      data-visible={isVisible ? 'true' : undefined}
      className={className}
      style={
        {
          '--scroll-delay': `${delay}ms`,
          '--scroll-duration': `${duration}ms`,
          '--scroll-stagger': `${stagger}ms`,
          animationDuration: `${duration}ms`,
          animationDelay: `${delay}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

interface ScrollRevealItemProps {
  children: ReactNode
  index?: number
  animation?: Animation
  duration?: number
  stagger?: number
  className?: string
}

export function ScrollRevealItem({
  children,
  index = 0,
  animation = 'fadeInUp',
  duration = 600,
  stagger = 100,
  className = '',
}: ScrollRevealItemProps) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 })

  return (
    <div
      ref={ref}
      data-scroll-reveal={animation}
      data-visible={isVisible ? 'true' : undefined}
      className={className}
      style={{
        animationDuration: `${duration}ms`,
        animationDelay: `${index * stagger}ms`,
      }}
    >
      {children}
    </div>
  )
}
