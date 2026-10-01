interface SkeletonProps {
  className?: string
}

/**
 * Base skeleton component with animated pulse effect.
 * Grey block on the surface token; loading shapes only, no content.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-bg-surface rounded-lg ${className}`}
      aria-hidden="true"
    />
  )
}
