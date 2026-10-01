'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { submitListingRequestAction } from './actions'

/**
 * Colocated with its route rather than in src/components/features/: it is used by exactly
 * one page and has no reuse surface, and keeping it here keeps the route self-contained.
 */

interface RequestFormProps {
  /** Prefilled from the query string so a link from a deal or provider page arrives ready. */
  defaultType?: string
  defaultBusinessName?: string
  /** Set only when the page resolved ?business= to a real listing. */
  businessId?: number
  defaultPageUrl?: string
}

const OPTIONS = [
  { value: 'add', label: 'Add my business to CostFinders' },
  {
    value: 'correction',
    label: 'Correct my listing (name, address, phone, website)',
  },
  {
    value: 'price_dispute',
    label: 'A price shown for my business is wrong',
  },
  { value: 'removal', label: 'Remove my business from CostFinders' },
  { value: 'other', label: 'Something else' },
] as const

// Matches the Input primitive so the textarea does not read as a foreign control.
const FIELD_CLASS =
  'w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder:text-text-muted transition-all duration-200 hover:border-border-hover focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15 disabled:opacity-50 disabled:cursor-not-allowed'

export function ListingRequestForm({
  defaultType,
  defaultBusinessName,
  businessId,
  defaultPageUrl,
}: RequestFormProps) {
  const detailsId = useId()

  // No silent default. This used to fall back to 'removal', so every link without a ?type=
  // opened a form pre-set to "Remove my business" — including the "Request a listing" buttons
  // an owner used to ask to be listed.
  const [requestType, setRequestType] = useState(
    OPTIONS.some((o) => o.value === defaultType) ? (defaultType as string) : '',
  )
  const [businessName, setBusinessName] = useState(defaultBusinessName ?? '')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [pageUrl, setPageUrl] = useState(defaultPageUrl ?? '')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(undefined)

    const result = await submitListingRequestAction({
      requestType,
      businessName,
      businessId,
      contactName,
      contactEmail,
      contactRole,
      pageUrl,
      details,
    })

    setSubmitting(false)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    setSent(true)
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
            We've got your request
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            It's on record and a person will review it. We'll reply to{' '}
            <span className="font-medium text-text-primary">
              {contactEmail}
            </span>
            .
          </p>
          {/* No turnaround time: nobody has committed to one, so stating one here
              would be a promise the product cannot keep. */}
          <p className="mt-2 text-sm text-text-secondary">
            Reviews are handled by a person rather than automatically, so we
            can't tell you how long it will take. If you need to add anything,
            reply to the confirmation we send.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* The Select primitive, not a hand-styled <select>: this one kept WebKit's native look
          and drew 25px tall on iOS beside 46px inputs (device matrix, 2026-09-28). */}
      <Select
        label="What do you need?"
        value={requestType}
        onChange={(e) => setRequestType(e.target.value)}
        disabled={submitting}
        required
      >
        <option value="" disabled>
          Choose one
        </option>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Input
        label="Business name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="As it appears on CostFinders"
        disabled={submitting}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Your name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          disabled={submitting}
          required
        />
        <Input
          label="Your role (optional)"
          value={contactRole}
          onChange={(e) => setContactRole(e.target.value)}
          placeholder="Owner, manager, agency"
          disabled={submitting}
        />
      </div>

      <Input
        label="Your email"
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        placeholder="you@yourclinic.com"
        hint="We'll only use this to reply about this request."
        disabled={submitting}
        required
      />

      <Input
        label="Link to the page or price (optional)"
        value={pageUrl}
        onChange={(e) => setPageUrl(e.target.value)}
        placeholder="https://costfinders.ai/..."
        disabled={submitting}
      />

      <div className="w-full">
        <label
          htmlFor={detailsId}
          className="block text-sm font-medium text-text-secondary mb-1.5"
        >
          Details
        </label>
        <textarea
          id={detailsId}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="To add your business, tell us its address and website. For a wrong price, tell us the price we show and the correct one. For a removal, just say so."
          disabled={submitting}
          required
          className={FIELD_CLASS}
        />
      </div>

      {error && (
        <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg">
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
