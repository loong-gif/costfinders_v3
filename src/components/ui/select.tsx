'use client'

import { CaretDown } from '@phosphor-icons/react'
import {
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
} from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  error?: string
  hint?: string
}

/**
 * The `<select>` half of the `Input` primitive. See `textarea.tsx` for why the
 * label is a ReactNode and why `label` is optional.
 *
 * Native `<select>` on purpose: it gets the platform's own keyboard handling,
 * type-ahead and mobile picker for free, which a hand-rolled listbox has to
 * re-implement and never quite does.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      className = '',
      id,
      children,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    // ponytail: the id + describedBy plumbing is copied from input.tsx
    // rather than shared, because input.tsx belongs to another change in
    // flight. Extract a `useFieldAria` hook once one person owns all three.
    const generatedId = useId()
    const selectId = id ?? generatedId
    const errorId = `${selectId}-error`
    const hintId = `${selectId}-hint`

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
            htmlFor={selectId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        {/* appearance-none + our own caret: WebKit drew the native control 25px tall beside
            46px inputs on iOS and iPadOS (device matrix, 2026-09-28). The caret is placed as
            in heroSearch.tsx. */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`
              w-full min-h-[44px] pl-4 pr-10 py-2.5
              appearance-none cursor-pointer
              bg-bg-surface
              border rounded-xl
              text-text-primary
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
          >
            {children}
          </select>
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>
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

Select.displayName = 'Select'
