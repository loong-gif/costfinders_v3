'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-stone-400 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5
            bg-stone-900
            border rounded-xl
            text-stone-100 placeholder:text-stone-500
            transition-all duration-200
            focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              error
                ? 'border-error/50 focus:border-error'
                : 'border-stone-800 hover:border-stone-700 focus:border-amber-400/50'
            }
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-xs text-error-text">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
