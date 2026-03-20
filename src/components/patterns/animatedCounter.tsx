'use client'

import { useEffect, useState } from 'react'
import { useScrollReveal } from '@/lib/hooks/useScrollReveal'

interface AnimatedCounterProps {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function AnimatedCounter({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3, once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)

      setCount(Math.round(easedProgress * end))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [isVisible, end, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}
