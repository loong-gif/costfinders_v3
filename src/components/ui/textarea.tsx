'use client'

import {
  forwardRef,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  error?: string
  hint?: string
}

/**
 * The `<textarea>` half of the `Input` primitive. Same contract, same styling,
 * same aria wiring — a raw `<textarea>` gets none of it, which is why seven of
 * them shipped with a visible error or hint that no screen reader could reach.
 *
 * `label` is a ReactNode, not a string, because real labels here carry markup
 * (a required asterisk, an "(optional)" span). Callers whose label styling
 * differs from the design-system default keep their own `<label htmlFor>` and
 * pass `id` instead — the label is only rendered when `label` is given.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
    // ponytail: the id + describedBy plumbing is copied from input.tsx
    // rather than shared, because input.tsx belongs to another change in
    // flight. Extract a `useFieldAria` hook once one person owns all three.
    const generatedId = useId()
    const textareaId = id ?? generatedId
    const errorId = `${textareaId}-error`
    const hintId = `${textareaId}-hint`

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
            htmlFor={textareaId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
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

Textarea.displayName = 'Textarea'
