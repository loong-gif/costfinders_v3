'use client'

import { CheckCircle, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useClaims } from '@/lib/context/claimsContext'

interface ClaimDealModalProps {
  isOpen: boolean
  onClose: () => void
  dealId: string
  businessId: string
  dealTitle: string
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
}: ClaimDealModalProps) {
  const { createClaim } = useClaims()
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState<TimePreference>('flexible')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate date if provided
    if (preferredDate) {
      const selectedDate = new Date(preferredDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate < today) {
        setError('Please select a future date')
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      createClaim(
        dealId,
        businessId,
        preferredDate || undefined,
        preferredTime !== 'flexible' ? preferredTime : undefined,
        notes.trim() || undefined,
      )

      setIsSuccess(true)

      // Auto-close after 3 seconds
      setTimeout(() => {
        handleClose()
      }, 3000)
    } catch {
      setError('Failed to submit claim. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Reset form state
    setPreferredDate('')
    setPreferredTime('flexible')
    setNotes('')
    setIsSubmitting(false)
    setIsSuccess(false)
    setError('')
    onClose()
  }

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Modal isOpen={isOpen} onClose={handleClose} mobileVariant="fullscreen">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#451a03]">
            {isSuccess ? 'Claim Submitted!' : 'Claim This Deal'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-[#78350f] hover:text-[#451a03] transition-colors"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {isSuccess ? (
          /* Success State */
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-20 h-20 rounded-full bg-emerald-600/10 flex items-center justify-center mb-6">
              <CheckCircle
                size={48}
                weight="fill"
                className="text-emerald-600"
              />
            </div>
            <h3 className="text-lg font-semibold text-[#451a03] mb-2">
              Claim submitted!
            </h3>
            <p className="text-[#78350f] mb-6">
              The business will contact you soon to confirm your appointment.
            </p>
            <Button onClick={handleClose} variant="secondary">
              Close
            </Button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Deal Title */}
            <div className="p-3 bg-[#faf5ee] rounded-xl">
              <p className="text-sm text-[#78350f]">Deal:</p>
              <p className="font-medium text-[#451a03]">{dealTitle}</p>
            </div>

            {/* Preferred Date */}
            <div>
              <label
                htmlFor="preferredDate"
                className="block text-sm font-medium text-[#78350f] mb-2"
              >
                Preferred Date (optional)
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
                className="block text-sm font-medium text-[#78350f] mb-2"
              >
                Preferred Time (optional)
              </label>
              <select
                id="preferredTime"
                value={preferredTime}
                onChange={(e) =>
                  setPreferredTime(e.target.value as TimePreference)
                }
                className="w-full px-4 py-3 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition-all duration-200"
              >
                {timeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-[#78350f] mb-2"
              >
                Message to Business (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Any special requests or questions?"
                rows={3}
                className="w-full px-4 py-3 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition-all duration-200 resize-none"
              />
              <p className="text-xs text-[#92400e] mt-1 text-right">
                {notes.length}/500
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-400/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
