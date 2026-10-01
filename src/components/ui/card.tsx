import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'glass' | 'solid' | 'outline'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

// A card is white with a hairline (MASTER.md); grey is for bands, pills and inputs. The
// variant names are Warm Sand's — 'glass' is just the default card now.
const variants = {
  glass: 'bg-bg-elevated border border-border-default',
  solid: 'bg-bg-elevated border border-border-default shadow-md',
  outline: 'bg-transparent border border-border-default',
}

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({
  children,
  variant = 'glass',
  padding = 'md',
  hover = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl
        ${variants[variant]}
        ${paddings[padding]}
        ${hover ? 'transition-all duration-200 hover:border-border-hover hover:shadow-md cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function CardTitle({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3
      className={`font-display text-lg font-semibold text-text-primary ${className}`}
    >
      {children}
    </h3>
  )
}

export function CardDescription({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`text-sm text-text-secondary mt-1 ${className}`}>
      {children}
    </p>
  )
}

export function CardContent({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function CardFooter({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mt-4 pt-4 border-t border-border-default ${className}`}>
      {children}
    </div>
  )
}
