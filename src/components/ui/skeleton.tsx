interface SkeletonProps {
  className?: string
}

/**
 * Base skeleton component with animated pulse effect.
 * Uses warm stone styling to match design system.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[#f2ebe2] rounded-lg ${className}`}
      aria-hidden="true"
    />
  )
}

/**
 * Skeleton card matching deal card layout (4:3 aspect ratio).
 * Reserves exact space to prevent CLS.
 */
export function SkeletonCard() {
  return (
    <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  )
}

/**
 * Skeleton text line for loading content areas.
 */
export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />
}

/**
 * Skeleton avatar for profile/user loading states.
 */
export function SkeletonAvatar({ className = '' }: SkeletonProps) {
  return <Skeleton className={`rounded-full w-10 h-10 ${className}`} />
}
