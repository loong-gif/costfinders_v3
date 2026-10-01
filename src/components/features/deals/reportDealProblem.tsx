'use client'

import { Flag } from '@phosphor-icons/react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitDealReportAction } from '@/lib/actions/deal-feedback'
import {
  DEAL_REPORT_REASON_LABELS,
  DEAL_REPORT_REASONS,
  type DealReportReason,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'

const FAILED_MESSAGE = "We couldn't send your report. Please try again."
const NO_REASON_MESSAGE = "Please choose what's wrong."

/**
 * Report a problem (spec §3), under How we read this deal. Works signed out: the action records
 * the reporter only when there is one. Every state is inline — no alert(), confirm() or prompt(),
 * which a phone browser can suppress and a screen reader loses the page behind.
 */
export function ReportDealProblem({ offerId }: { offerId: number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<DealReportReason | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const sentRef = useRef<HTMLOutputElement>(null)

  // The form, and the button that had focus, unmount on success; without this focus drops to
  // <body> and a keyboard or screen-reader user never hears that the report went.
  useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])

  // At 1280x800 and 1440x900 the form opened wholly below the fold, with nothing moving to
  // show it had (2026-09-28). Focusing the first reason scrolls it into view.
  useEffect(() => {
    if (open) firstReasonRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setError(null)
    toggleRef.current?.focus()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!reason) {
      setError(NO_REASON_MESSAGE)
      return
    }

    setSending(true)
    let result: { success: boolean; error?: string }
    try {
      result = await submitDealReportAction({ offerId, reason, note })
    } catch {
      // Rejected outright (offline, the request refused before the action ran).
      result = { success: false }
    } finally {
      setSending(false)
    }

    if (result.success) setSent(true)
    // The action's own refusals are worth showing as they are: "You've sent several reports
    // already. Try again in 9 minutes." tells the reporter to wait rather than to resend.
    else setError(result.error ?? FAILED_MESSAGE)
  }

  if (sent) {
    return (
      <output
        ref={sentRef}
        tabIndex={-1}
        className="block rounded-lg bg-success-bg px-3 py-2 text-sm text-success"
      >
        Report sent. Thank you for letting us know.
      </output>
    )
  }

  return (
    <div>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <Flag size={16} weight="bold" />
        Report a problem
      </button>

      {open && (
        <form
          id={formId}
          onSubmit={submit}
          className="mt-2 space-y-4 rounded-xl border border-border-default bg-bg-elevated p-4"
        >
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              What&apos;s wrong?
            </legend>
            {DEAL_REPORT_REASONS.map((value, index) => (
              <label
                key={value}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-text-primary hover:bg-bg-surface"
              >
                <input
                  ref={index === 0 ? firstReasonRef : undefined}
                  type="radio"
                  name={`${formId}-reason`}
                  value={value}
                  checked={reason === value}
                  onChange={() => {
                    setReason(value)
                    setError(null)
                  }}
                  className="size-4 shrink-0 accent-accent"
                />
                {DEAL_REPORT_REASON_LABELS[value]}
              </label>
            ))}
          </fieldset>

          <Textarea
            label={
              <>
                Add a note{' '}
                <span className="font-normal text-text-muted">(optional)</span>
              </>
            }
            rows={3}
            value={note}
            maxLength={NOTE_MAX.report}
            onChange={(event) => setNote(event.target.value)}
            hint={`${note.length.toLocaleString('en-US')}/${NOTE_MAX.report.toLocaleString('en-US')}`}
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" isLoading={sending}>
              Send report
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={close}
              disabled={sending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
