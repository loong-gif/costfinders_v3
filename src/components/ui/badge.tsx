import type { ReactNode } from 'react'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'brand'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

// `text-success-text` / `-warning-text` / `-error-text` / `-info-text` used to
// live here: four tokens that were never defined, so Tailwind emitted no CSS at
// all and every status badge fell through to the inherited body brown. The base
// tokens are now dark enough to serve as the label colour themselves (see the
// semantic block in globals.css), so the label points at those instead — one
// value per semantic colour rather than a second name that can rot.
const variants: Record<BadgeVariant, string> = {
  default: 'bg-bg-surface border-border-default text-text-secondary',
  success: 'bg-success/10 border-success/20 text-success',
  warning: 'bg-warning/10 border-warning/20 text-warning',
  error: 'bg-error/10 border-error/20 text-error',
  info: 'bg-info/10 border-info/20 text-info',
  brand: 'bg-accent-muted border-border-accent text-accent-hover',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        font-medium rounded-full
        border
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
