'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClaimAction } from '@/lib/actions/claims'
import { trackEvent } from '@/lib/analytics'
import { useAuth } from '@/lib/context/authContext'

interface ClaimDealModalProps {
  isOpen: boolean
  onClose: () => void
  dealId: string
  businessId: string
  dealTitle: string
  /** Called once the claim is saved. The deal page then shows the clinic's details. */
  onSuccess?: () => void
}

type TimePreference = 'morning' | 'afternoon' | 'evening' | 'flexible'

const timeOptions: { value: TimePreference; label: string }[] = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'morning', label: 'Morning (9am - 12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm - 5pm)' },
  { value: 'evening', label: 'Evening (5pm - 8pm)' },
]

export function ClaimDealModal({
  isOpen,
  onClose,
  dealId,
  businessId,
  dealTitle,
  onSuccess,
}: ClaimDealModalProps) {
  // Modal renders nothing while closed, so the form below mounts fresh on every open and
  // picks up the current profile without an effect.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      mobileVariant="fullscreen"
      title="Claim this deal"
    >
      <ClaimForm
        dealId={dealId}
        businessId={businessId}
        dealTitle={dealTitle}
        onCancel={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

function ClaimForm({
  dealId,
  businessId,
  dealTitle,
  onCancel,
  onSuccess,
}: {
  dealId: string
  businessId: string
  dealTitle: string
  onCancel: () => void
  onSuccess?: () => void
}) {
  const { state: authState, updateProfile } = useAuth()
  const user = authState.user

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState<TimePreference>('flexible')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // The visitor's own calendar day, 'YYYY-MM-DD'. toISOString() is UTC, which after 5pm on
  // the US west coast is already tomorrow and blocked picking today.
  const today = new Date().toLocaleDateString('en-CA')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!firstName.trim()) {
      setError('Please add your first name.')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please add a phone number the clinic can reach you on.')
      return
    }
    // Both are 'YYYY-MM-DD', so string order is date order — no Date parsing, no timezone.
    if (preferredDate && preferredDate < today) {
      setError('Please pick today or a later date.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createClaimAction(
        Number(dealId),
        Number(businessId),
        preferredDate || undefined,
        preferredTime !== 'flexible' ? preferredTime : undefined,
        notes.trim() || undefined,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        },
      )

      if (!result.success) {
        setError(
          result.message ??
            result.error ??
            'Failed to submit claim. Please try again.',
        )
        return
      }

      trackEvent('deal_claimed', { dealId, businessId })

      // The server saved (and read back) the name and phone. This only brings the signed-in
      // state in step so the next claim form and the dashboard show them; it repeats the same
      // write, which is harmless.
      if (
        firstName.trim() !== (user?.firstName ?? '') ||
        lastName.trim() !== (user?.lastName ?? '') ||
        phone.trim() !== (user?.phone ?? '')
      ) {
        updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        })
      }

      onSuccess?.()
    } catch {
      setError('Failed to submit claim. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Deal Title */}
        <div className="p-3 bg-bg-surface rounded-xl">
          <p className="text-sm text-text-secondary">Deal:</p>
          <p className="font-medium text-text-primary">{dealTitle}</p>
        </div>

        {/* Who is claiming — this is what our team passes to the clinic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            maxLength={60}
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={60}
          />
        </div>
        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          required
          maxLength={30}
          hint="Saved to your profile for your next claim."
        />

        <p className="text-sm text-text-secondary">
          The details below are optional. We pass them on to the clinic when we
          relay your request.
        </p>

        {/* Preferred Date */}
        <div>
          <label
            htmlFor="preferredDate"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            Preferred date (optional)
          </label>
          <Input
            id="preferredDate"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={today}
          />
        </div>

        {/* Preferred Time */}
        <div>
          <label
            htmlFor="preferredTime"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            Preferred time (optional)
          </label>
          <Select
            id="preferredTime"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value as TimePreference)}
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            Note for the clinic (optional)
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Anything the clinic should know?"
            rows={3}
            className="resize-none"
            // The counter stays where the design puts it (right-aligned,
            // below); this is what makes it reachable, since a visible
            // character limit nobody can hear is not a limit.
            aria-describedby="notes-count"
          />
          <p
            id="notes-count"
            className="text-xs text-text-muted mt-1 text-right"
          >
            {notes.length}/500
          </p>
        </div>

        {/* Point-of-claim disclosure. The sign-up form says it too; this is where it happens. */}
        <p className="text-xs text-text-muted">
          When you claim, we share your name and contact details with this
          provider.
        </p>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Claiming...' : 'Claim deal'}
          </Button>
        </div>
      </form>
    </div>
  )
}
