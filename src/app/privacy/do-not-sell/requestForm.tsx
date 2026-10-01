'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitDoNotSellAction } from './actions'

/** Colocated with its only page, like the listing-request form. */
export function DoNotSellForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      const result = await submitDoNotSellAction({ email, message })
      if (!result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle
          size={22}
          weight="duotone"
          className="text-savings shrink-0 mt-0.5"
        />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
            Request received
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            We&apos;ve recorded your request for{' '}
            <span className="font-medium text-text-primary">{email}</span>. A
            person handles these, and we&apos;ll write to that address if we
            need anything else to act on it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Your email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        hint="Use the address on your CostFinders account, if you have one."
        disabled={submitting}
        required
      />
      <Textarea
        label="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={2000}
        disabled={submitting}
      />
      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        isLoading={submitting}
        disabled={submitting}
      >
        Send request
      </Button>
    </form>
  )
}
