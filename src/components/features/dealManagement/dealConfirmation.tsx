'use client'

import {
  CheckCircle,
  ClockCounterClockwise,
  NotePencil,
  Warning,
} from '@phosphor-icons/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NOTE_MAX } from '@/lib/actions/deal-feedback-rules'
import {
  confirmOfferAction,
  type OfferConfirmationState,
  requestOfferCorrectionAction,
} from '@/lib/actions/offer-confirmations'

/** A timestamptz, in the owner's own zone. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Where the owner's latest word on a deal stands. `stale` comes from the database
 * (latest_offer_confirmations compares the deal now with what was confirmed), never from here.
 * A dismissed confirmation no longer shows publicly (public_offer_confirmations skips it), so it
 * must not read as confirmed here either.
 */
function StatusLine({ state }: { state: OfferConfirmationState }) {
  const date = formatDate(state.createdAt)
  if (state.kind === 'correction') {
    const outcome =
      state.status === 'resolved'
        ? ' Our team has handled it.'
        : state.status === 'dismissed'
          ? ' Our team closed it without a change.'
          : ''
    return (
      <span className="flex items-start gap-1.5 text-sm text-text-secondary">
        <NotePencil size={16} className="mt-0.5 shrink-0 text-info" />
        <span>
          Correction sent on {date}.{outcome}
        </span>
      </span>
    )
  }
  if (state.status === 'dismissed') {
    return (
      <span className="flex items-start gap-1.5 text-sm text-text-secondary">
        <Warning size={16} className="mt-0.5 shrink-0 text-warning" />
        Our team removed your confirmation. Check the deal and confirm it again,
        or suggest a correction.
      </span>
    )
  }
  if (state.stale) {
    return (
      <span className="flex items-start gap-1.5 text-sm text-warning">
        <ClockCounterClockwise size={16} className="mt-0.5 shrink-0" />
        Changed since you confirmed on {date}
      </span>
    )
  }
  return (
    <span className="flex items-start gap-1.5 text-sm text-success">
      <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
      Confirmed on {date}
    </span>
  )
}

interface DealConfirmationProps {
  offerId: number
  /** The owner's latest confirmation or correction for this deal; undefined when there is none. */
  state: OfferConfirmationState | undefined
  /** Only a deal on the site can carry the public badge, so only it is offered the actions. */
  onSite: boolean
  onSaved: (state: OfferConfirmationState) => void
}

/**
 * "Confirm it's correct" and "Suggest a correction" for one deal (spec §5). A state changes only
 * from the row the action selected back, never optimistically: the insert can be refused by the
 * trigger or the policy, and the owner must not see "Confirmed" for a confirmation that isn't
 * there.
 *
 * Every step unmounts the control that has focus (the buttons give way to the form and back, a
 * confirmed deal loses its Confirm button), so focus is moved on purpose: to the note, back to
 * "Suggest a correction", or to the status line, which is an always-mounted live region so the
 * new "Confirmed on …" is also announced. The move runs in an effect, after the target mounts.
 */
export function DealConfirmation({
  offerId,
  state,
  onSite,
  onSaved,
}: DealConfirmationProps) {
  const [pending, setPending] = useState<'confirm' | 'correction' | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<
    'note' | 'suggest' | 'status' | null
  >(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const suggestRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLOutputElement>(null)

  useEffect(() => {
    if (!focusTarget) return
    const target = { note: noteRef, suggest: suggestRef, status: statusRef }[
      focusTarget
    ]
    target.current?.focus()
    setFocusTarget(null)
  }, [focusTarget])

  const confirmedNow =
    state?.kind === 'confirmed' && !state.stale && state.status !== 'dismissed'

  const confirm = async () => {
    setPending('confirm')
    setError(null)
    const result = await confirmOfferAction(offerId)
    setPending(null)
    if (!result.success || !result.confirmation) {
      setError(result.error ?? "We couldn't save that. Please try again.")
      return
    }
    onSaved(result.confirmation)
    setFocusTarget('status')
  }

  const sendCorrection = async (event: FormEvent) => {
    event.preventDefault()
    setPending('correction')
    setError(null)
    const result = await requestOfferCorrectionAction(offerId, note)
    setPending(null)
    if (!result.success || !result.confirmation) {
      setError(result.error ?? "We couldn't send that. Please try again.")
      // The Send button was disabled while it ran, which dropped focus; back to the note.
      setFocusTarget('note')
      return
    }
    setCorrecting(false)
    setNote('')
    onSaved(result.confirmation)
    setFocusTarget('status')
  }

  if (!onSite && !state) {
    return <span className="text-sm text-text-muted">—</span>
  }

  return (
    <div className="space-y-2">
      {/* <output>: role="status" implicitly (the repo's idiom). StatusLine renders spans, as
          <output> takes phrasing content only. */}
      <output
        ref={statusRef}
        tabIndex={-1}
        className="block outline-none empty:hidden"
      >
        {state && <StatusLine state={state} />}
      </output>

      {onSite && !correcting && (
        <div className="flex flex-wrap gap-2">
          {!confirmedNow && (
            <Button
              variant="secondary"
              size="sm"
              onClick={confirm}
              isLoading={pending === 'confirm'}
              disabled={pending !== null}
            >
              Confirm it&apos;s correct
            </Button>
          )}
          <Button
            ref={suggestRef}
            variant="ghost"
            size="sm"
            onClick={() => {
              setCorrecting(true)
              setError(null)
              setFocusTarget('note')
            }}
            disabled={pending !== null}
          >
            Suggest a correction
          </Button>
        </div>
      )}

      {correcting && (
        <form onSubmit={sendCorrection} className="space-y-2">
          <Textarea
            ref={noteRef}
            label="What needs to change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX.correction}
            rows={3}
            required
            hint="For example the right price, the number of units, or the conditions. Our team reviews it and may update the deal by hand."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              isLoading={pending === 'correction'}
              disabled={pending !== null}
            >
              Send correction
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCorrecting(false)
                setError(null)
                setFocusTarget('suggest')
              }}
              disabled={pending !== null}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg border border-error/20 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}
    </div>
  )
}
