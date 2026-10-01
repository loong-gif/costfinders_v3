'use client'

import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  type ClaimFeedback,
  submitClaimFeedbackAction,
} from '@/lib/actions/deal-feedback'
import {
  CLAIM_FEEDBACK_ANSWERS,
  CLAIM_FEEDBACK_LABELS,
  type ClaimFeedbackAnswer,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'

const NOTE_LABELS: Record<Exclude<ClaimFeedbackAnswer, 'honored'>, string> = {
  different_price: 'What price did the clinic give you? (optional)',
  not_honored: 'What happened? (optional)',
}

interface ClaimHonorQuestionProps {
  claimId: string
  /** The customer's current answer, or undefined when they haven't answered. */
  saved: ClaimFeedback | undefined
  onSaved: (feedback: ClaimFeedback) => void
}

/**
 * "Did the clinic honor this price?" inside one ClaimCard (spec §5). One answer per claim,
 * changeable: submitClaimFeedbackAction upserts on claim_id and returns the row it selected back,
 * and only that row moves the answer shown here. "Yes" sends at once; the other two ask for an optional
 * note first, because "No" alone gives our team nothing to act on.
 *
 * Switching between asking and answered unmounts the button that has focus ("Change answer",
 * an answer, Cancel, Send answer), so focus is moved on purpose once the other side has mounted:
 * to the answers, back to "Change answer", or to the "Thanks. You answered …" line, which a
 * screen reader then reads. A live region mounted with its text already in it is often skipped.
 */
export function ClaimHonorQuestion({
  claimId,
  saved,
  onSaved,
}: ClaimHonorQuestionProps) {
  const headingId = useId()
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState<Exclude<
    ClaimFeedbackAnswer,
    'honored'
  > | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const focusNext = useRef<'answers' | 'summary' | 'change' | null>(null)
  const answersRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const changeRef = useRef<HTMLButtonElement>(null)

  const send = async (answer: ClaimFeedbackAnswer, text?: string) => {
    setPending(true)
    setError(null)
    const result = await submitClaimFeedbackAction({
      claimId,
      answer,
      note: text,
    })
    setPending(false)
    if (!result.success || !result.feedback) {
      setError(
        result.error ?? "We couldn't save your answer. Please try again.",
      )
      // The answer that had focus was disabled while it sent; back to the choices.
      focusNext.current = 'answers'
      return
    }
    focusNext.current = 'summary'
    setEditing(false)
    setChoice(null)
    setJustSaved(true)
    onSaved(result.feedback)
  }

  const pick = (answer: ClaimFeedbackAnswer) => {
    setJustSaved(false)
    if (answer === 'honored') {
      void send(answer)
      return
    }
    setChoice(answer)
    setNote(saved?.answer === answer ? (saved.note ?? '') : '')
  }

  const submitNote = (event: FormEvent) => {
    event.preventDefault()
    if (choice) void send(choice, note)
  }

  const asking = !saved || editing

  // After the render a handler asked for (no deps: a ref, not state, says whether to move), so
  // the target has mounted, or been re-enabled, by the time it is focused.
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    if (target === 'answers') answersRef.current?.focus()
    else if (target === 'summary') summaryRef.current?.focus()
    else changeRef.current?.focus()
  })

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl bg-bg-surface px-4 py-3 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium text-text-primary">
          Did the clinic honor this price?
        </h3>
        {!asking && (
          <Button
            ref={changeRef}
            variant="ghost"
            size="sm"
            onClick={() => {
              focusNext.current = 'answers'
              setEditing(true)
              setJustSaved(false)
            }}
          >
            Change answer
          </Button>
        )}
      </div>

      {!asking && saved && (
        <div className="space-y-1 text-sm text-text-secondary">
          <p ref={summaryRef} tabIndex={-1} className="outline-none">
            {justSaved ? 'Thanks. ' : ''}You answered{' '}
            <span className="font-medium text-text-primary">
              {CLAIM_FEEDBACK_LABELS[saved.answer]}
            </span>
            .
          </p>
          {saved.note && (
            <p className="line-clamp-3">&ldquo;{saved.note}&rdquo;</p>
          )}
        </div>
      )}

      {asking && (
        <>
          <p className="text-xs text-text-secondary">
            Tell us once you&apos;ve spoken to the clinic. It helps our team
            keep prices on CostFinders accurate.
          </p>
          <fieldset className="flex flex-wrap gap-2" disabled={pending}>
            <legend className="sr-only">
              Did the clinic honor this price?
            </legend>
            {CLAIM_FEEDBACK_ANSWERS.map((answer, i) => {
              const selected =
                choice === answer ||
                (choice === null && saved?.answer === answer)
              // Focus lands on the current answer, or the first when there is none.
              const focusHere = saved ? saved.answer === answer : i === 0
              return (
                <Button
                  key={answer}
                  ref={focusHere ? answersRef : undefined}
                  variant={selected ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={selected}
                  isLoading={pending && answer === 'honored' && !choice}
                  onClick={() => pick(answer)}
                >
                  {CLAIM_FEEDBACK_LABELS[answer]}
                </Button>
              )
            })}
            {saved && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  focusNext.current = 'change'
                  setEditing(false)
                  setChoice(null)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            )}
          </fieldset>

          {choice && (
            <form onSubmit={submitNote} className="space-y-2">
              <Textarea
                label={NOTE_LABELS[choice]}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX.report}
                rows={2}
              />
              <Button type="submit" size="sm" isLoading={pending}>
                Send answer
              </Button>
            </form>
          )}
        </>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg border border-error/20 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}
    </section>
  )
}
