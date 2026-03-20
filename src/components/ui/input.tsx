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
            className="block text-sm font-medium text-[#78350f] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5
            bg-[#f2ebe2]
            border rounded-xl
            text-[#451a03] placeholder:text-[#92400e]
            transition-all duration-200
            focus:outline-none focus:border-amber-800/40 focus:ring-1 focus:ring-amber-800/15
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              error
                ? 'border-error/50 focus:border-error'
                : 'border-[#d4c4b0] hover:border-[#c4b09a] focus:border-amber-800/40'
            }
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[#92400e]">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-xs text-error-text">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
