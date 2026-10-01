'use client'

import { forwardRef, type InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      className = '',
      id,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    // Every field gets a real id. The id used to be derived from the label
    // (`label?.toLowerCase()`), which produced `undefined` for the two
    // verification-code fields — no id, so no <label> rendered — and collided
    // whenever two forms on a page shared a label like "Email".
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    // Associating the hint and the error with the field is what makes them
    // reachable at all to a screen reader: before this, both were painted on
    // screen and absent from the accessibility tree.
    const describedBy =
      [
        error ? errorId : null,
        hint && !error ? hintId : null,
        ariaDescribedBy ?? null,
      ]
        .filter(Boolean)
        .join(' ') || undefined

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            w-full px-4 py-2.5
            bg-bg-surface
            border rounded-xl
            text-text-primary placeholder:text-text-muted
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              error
                ? 'border-error/50 focus:border-error'
                : 'border-border-default hover:border-border-hover focus:border-border-accent'
            }
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-xs text-text-muted">
            {hint}
          </p>
        )}
        {/* role="alert" so the message is announced when it appears on submit,
            not only when the user happens to browse back over the field. */}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
