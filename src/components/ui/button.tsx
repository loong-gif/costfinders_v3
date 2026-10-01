'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

// MASTER.md: primary is the coral pill; secondary is the header's hairline pill.
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white font-semibold',
  secondary:
    'bg-bg-elevated hover:bg-bg-surface border border-border-default hover:border-border-hover text-text-primary',
  ghost: 'hover:bg-bg-surface text-text-secondary hover:text-text-primary',
  danger: 'bg-error-bg hover:bg-error/15 text-error',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 text-sm min-h-[44px]',
  md: 'px-5 text-sm min-h-[44px]',
  lg: 'px-6 text-base min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    // text-balance + text-center: a label that wraps at 320px splits evenly instead of leaving
    // "account" alone on line two (device matrix, 2026-09-28). A one-line label is untouched:
    // balance only acts on text that already wraps.
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center gap-2
          text-center text-balance
          font-medium rounded-full cursor-pointer
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
