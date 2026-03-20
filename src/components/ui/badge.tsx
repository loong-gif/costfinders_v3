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

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[#f2ebe2] border-[#d4c4b0] text-[#78350f]',
  success: 'bg-success/10 border-success/20 text-success-text',
  warning: 'bg-warning/10 border-warning/20 text-warning-text',
  error: 'bg-error/10 border-error/20 text-error-text',
  info: 'bg-info/10 border-info/20 text-info-text',
  brand: 'bg-amber-800/8 border-amber-800/15 text-amber-800',
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
