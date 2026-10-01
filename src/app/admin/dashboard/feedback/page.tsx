'use client'

import {
  ArrowSquareOut,
  Flag,
  NotePencil,
  Warning,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  type AdminDealReport,
  type AdminFeedbackResult,
  type AdminOfferCorrection,
  type FeedbackStatusFilter,
  getDealReportsAction,
  getOfferCorrectionsAction,
  type OfferSnapshot,
  resolveDealReportAction,
  resolveOfferCorrectionAction,
} from '@/lib/actions/admin-deal-reports'
import {
  type FeedbackStatus,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'
import { formatPercentOff, formatPrice } from '@/lib/data/adapters'

/**
 * The queue behind "Report a problem", "Did the clinic honor this price?" and an owner's
 * "Suggest a correction" (spec §5). Nothing here edits a deal: a correction is applied in the
 * Deals editor, and this screen records what was decided (audit-logged by the actions).
 */

const STATUS_TABS: { value: FeedbackStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
]

const STATUS_BADGE: Record<
  FeedbackStatus,
  { label: string; variant: 'info' | 'success' | 'default' }
> = {
  open: { label: 'Open', variant: 'info' },
  resolved: { label: 'Resolved', variant: 'success' },
  dismissed: { label: 'Dismissed', variant: 'default' },
}

interface Feedback {
  tone: 'success' | 'error'
  text: string
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Who sent a report: the one thing about the reporter this screen needs. */
function reporterType(report: AdminDealReport): string {
  if (report.source === 'claim') return 'From a claim'
  return report.reporterId ? 'Signed in' : 'Signed out'
}

/** The deal's prices as the database captured them when the owner wrote the correction. */
function snapshotText(s: OfferSnapshot): string {
  const parts = [
    s.discountPrice != null && `deal ${formatPrice(s.discountPrice)}`,
    s.regularPrice != null && `regular ${formatPrice(s.regularPrice)}`,
    s.discountPercent != null && formatPercentOff(s.discountPercent),
    s.discountAmount != null && `${formatPrice(s.discountAmount)} off`,
    s.priceModel && `price type ${s.priceModel}`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'no prices'
}

const ACTION_LABEL: Record<FeedbackStatus, string> = {
  resolved: 'Mark resolved',
  dismissed: 'Dismiss',
  open: 'Reopen',
}

/**
 * Resolve, dismiss or reopen one item. Choosing an outcome opens an inline step with the optional
 * admin note, which doubles as the confirmation: nothing is sent on the first click, and there is
 * no browser dialog. The note starts as the item's current one: the action writes whatever is
 * sent, so an empty box would silently erase the earlier admin's note on every reopen.
 *
 * Opening the step unmounts the clicked button, so focus goes to the note; Cancel returns it to
 * the button that opened the step. Both moves run after the render that mounts the target.
 *
 * `dismissWarning`, when given, is shown in the Dismiss step and the button becomes
 * "Dismiss anyway".
 */
function ResolveControls({
  status,
  currentNote,
  onSubmit,
  dismissWarning,
}: {
  status: FeedbackStatus
  currentNote: string | null
  onSubmit: (status: FeedbackStatus, note: string) => Promise<boolean>
  dismissWarning?: ReactNode
}) {
  const [target, setTarget] = useState<FeedbackStatus | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const buttonRefs = useRef<Partial<Record<FeedbackStatus, HTMLButtonElement>>>(
    {},
  )
  /** The status whose button gets focus back after Cancel. */
  const returnTo = useRef<FeedbackStatus | null>(null)

  useEffect(() => {
    if (target) {
      noteRef.current?.focus()
    } else if (returnTo.current) {
      buttonRefs.current[returnTo.current]?.focus()
      returnTo.current = null
    }
  }, [target])

  const targets: FeedbackStatus[] =
    status === 'open' ? ['resolved', 'dismissed'] : ['open']

  if (!target) {
    return (
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <Button
            key={t}
            ref={(el) => {
              if (el) buttonRefs.current[t] = el
            }}
            variant={t === 'resolved' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setNote(currentNote ?? '')
              setTarget(t)
            }}
          >
            {ACTION_LABEL[t]}
          </Button>
        ))}
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    const ok = await onSubmit(target, note)
    setBusy(false)
    if (ok) {
      setTarget(null)
      setNote('')
    }
  }

  const warning = target === 'dismissed' ? dismissWarning : undefined

  return (
    <div className="space-y-2">
      {warning && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl bg-warning-bg px-4 py-3 text-sm text-text-secondary"
        >
          <Warning
            size={20}
            weight="light"
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div>{warning}</div>
        </div>
      )}
      <Textarea
        ref={noteRef}
        label="Admin note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX.admin}
        rows={2}
        hint="Only admins see this."
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit} isLoading={busy} disabled={busy}>
          {warning ? 'Dismiss anyway' : ACTION_LABEL[target]}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            returnTo.current = target
            setTarget(null)
          }}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function DealLink({
  offerId,
  title,
}: {
  offerId: number | null
  title: string | null
}) {
  const text = title ?? (offerId ? `Deal ${offerId}` : 'A deleted deal')
  if (!offerId) return <span>{text}</span>
  // The public page; a deal that is off the site answers 404 there.
  return (
    <Link
      href={`/deals/${offerId}`}
      target="_blank"
      className="inline-flex items-center gap-1 hover:text-accent transition-colors"
    >
      {text}
      <ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </Link>
  )
}

function Item({
  title,
  badges,
  children,
  status,
  adminNote,
  resolvedAt,
  onSubmit,
  dismissWarning,
}: {
  title: ReactNode
  badges: ReactNode
  children: ReactNode
  status: FeedbackStatus
  adminNote: string | null
  resolvedAt: string | null
  onSubmit: (status: FeedbackStatus, note: string) => Promise<boolean>
  dismissWarning?: ReactNode
}) {
  return (
    <Card variant="glass" padding="lg" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-text-primary min-w-0">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {badges}
          <Badge variant={STATUS_BADGE[status].variant} size="sm">
            {STATUS_BADGE[status].label}
          </Badge>
        </div>
      </div>
      <div className="space-y-2 text-sm text-text-secondary">{children}</div>
      {(adminNote || resolvedAt) && (
        <p className="text-xs text-text-muted">
          {resolvedAt &&
            `${STATUS_BADGE[status].label} ${formatWhen(resolvedAt)}. `}
          {adminNote && `Admin note: ${adminNote}`}
        </p>
      )}
      <div className="pt-3 border-t border-border-default">
        <ResolveControls
          status={status}
          currentNote={adminNote}
          onSubmit={onSubmit}
          dismissWarning={dismissWarning}
        />
      </div>
    </Card>
  )
}

export default function DealFeedbackPage() {
  const [filter, setFilter] = useState<FeedbackStatusFilter>('open')
  const [reports, setReports] = useState<AdminDealReport[]>([])
  const [corrections, setCorrections] = useState<AdminOfferCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const correctionsHeading = useRef<HTMLHeadingElement>(null)
  const reportsHeading = useRef<HTMLHeadingElement>(null)

  /**
   * `quiet` is the refresh after an action: the lists stay mounted while it runs. Swapping them
   * for "Loading..." shrank the page to a line, so the browser clamped the scroll to the top and
   * an admin working down the queue started over after every item. A filter change is not quiet:
   * another tab's items must not stay on screen, with live controls, while the new tab loads.
   */
  const load = useCallback(
    async (status: FeedbackStatusFilter, quiet = false) => {
      if (!quiet) setLoading(true)
      setLoadError(null)
      const [r, c] = await Promise.all([
        getDealReportsAction(status),
        getOfferCorrectionsAction(status),
      ])
      // A failed read must not render as an empty queue: that reads as "nothing to do".
      if (!(r.success && c.success)) {
        setReports([])
        setCorrections([])
        setLoadError(r.error ?? c.error ?? 'Something went wrong.')
      } else {
        setReports(r.reports ?? [])
        setCorrections(c.corrections ?? [])
      }
      setLoading(false)
    },
    [],
  )

  useEffect(() => {
    load(filter)
  }, [load, filter])

  // One timer: an earlier message's timer must not clear a newer message early.
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(
      () => setFeedback(null),
      next.tone === 'success' ? 4000 : 12000,
    )
  }, [])

  /**
   * Run one resolve action; on success reload, so the list shows what the database now holds.
   * The item's card can unmount (a resolved item leaves the Open view), so focus goes to its
   * section's heading, without scrolling: the next Tab reaches the next item in that section.
   */
  const run = useCallback(
    async (
      action: () => Promise<AdminFeedbackResult>,
      done: string,
      section: 'corrections' | 'reports',
    ): Promise<boolean> => {
      const result = await action()
      if (!result.success) {
        showFeedback({
          tone: 'error',
          text: result.error ?? "We couldn't update that item.",
        })
        return false
      }
      showFeedback({ tone: 'success', text: done })
      await load(filter, true)
      const heading =
        section === 'corrections' ? correctionsHeading : reportsHeading
      heading.current?.focus({ preventScroll: true })
      return true
    },
    [filter, load, showFeedback],
  )

  const doneText = (status: FeedbackStatus) =>
    status === 'open'
      ? 'Reopened.'
      : status === 'resolved'
        ? 'Marked resolved.'
        : 'Dismissed.'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          Deal feedback
        </h1>
        <p className="text-text-secondary mt-1">
          Problems shoppers report on deal pages, their answers after a claim,
          and corrections clinics ask for.
        </p>
        {/* Always mounted, so "Dismissed." is announced: a status region mounted with its text
            already in it is often skipped. An alert is announced either way. */}
        <output className="sr-only">
          {feedback?.tone === 'success' ? feedback.text : ''}
        </output>
      </div>

      {/* Sticks under the 64px header, so an admin deep in the queue sees the result too. The
          white backing keeps the tinted banner opaque over the cards scrolling under it. */}
      {feedback && (
        <div className="sticky top-20 z-30 rounded-xl bg-bg-elevated shadow-sm">
          <div
            role={feedback.tone === 'error' ? 'alert' : undefined}
            aria-hidden={feedback.tone === 'success' || undefined}
            className={`px-4 py-3 rounded-xl text-sm font-medium ${
              feedback.tone === 'success'
                ? 'bg-success-bg border border-success/20 text-success'
                : 'bg-error-bg border border-error/20 text-error'
            }`}
          >
            {feedback.text}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={filter === tab.value}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-secondary">Loading...</p>
      ) : loadError ? (
        <Card variant="glass" padding="lg" className="text-center space-y-4">
          <p className="text-text-primary font-medium">
            Couldn&apos;t load the queue
          </p>
          <p className="text-sm text-text-secondary">{loadError}</p>
          <Button onClick={() => load(filter)}>Try again</Button>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2
              ref={correctionsHeading}
              tabIndex={-1}
              className="font-display text-lg font-semibold text-text-primary flex items-center gap-2 outline-none"
            >
              <NotePencil size={20} aria-hidden="true" />
              Corrections from clinics ({corrections.length})
            </h2>
            <p className="text-sm text-text-secondary max-w-3xl">
              Apply a correction by hand in{' '}
              <Link
                href="/admin/dashboard/deals"
                className="text-accent hover:text-accent-hover font-medium"
              >
                Deals
              </Link>
              , then mark it resolved here. Deals we collect from clinic
              websites are refreshed by the data pipeline, which may overwrite
              your edit on its next run, so check the deal again later.
            </p>
            {corrections.length === 0 ? (
              <p className="text-sm text-text-muted">
                No {filter === 'all' ? '' : `${filter} `}corrections.
              </p>
            ) : (
              corrections.map((c) => (
                <Item
                  key={c.id}
                  title={<DealLink offerId={c.offerId} title={c.offerTitle} />}
                  badges={
                    <Badge variant="default" size="sm">
                      {c.businessName ?? 'Unknown business'}
                    </Badge>
                  }
                  status={c.status}
                  adminNote={c.adminNote}
                  resolvedAt={c.resolvedAt}
                  // The badge is the latest confirmation or correction that is not dismissed
                  // (public_offer_confirmations), so a dismissal uncovers the one before it.
                  dismissWarning={
                    <>
                      <span className="font-semibold text-text-primary">
                        Dismissing brings back an earlier badge.{' '}
                      </span>
                      If the clinic confirmed this deal before sending the
                      correction, the deal shows &ldquo;Confirmed by the
                      clinic&rdquo; again, as long as the deal hasn&apos;t
                      changed since. If the correction stands, apply it in Deals
                      and mark it resolved instead.
                    </>
                  }
                  onSubmit={(status, note) =>
                    run(
                      () => resolveOfferCorrectionAction(c.id, status, note),
                      doneText(status),
                      'corrections',
                    )
                  }
                >
                  <p className="whitespace-pre-wrap text-text-primary">
                    {c.note}
                  </p>
                  <p className="text-xs text-text-muted">
                    Sent {formatWhen(c.createdAt)}. The deal then read:{' '}
                    {snapshotText(c.snapshot)}.
                  </p>
                </Item>
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2
              ref={reportsHeading}
              tabIndex={-1}
              className="font-display text-lg font-semibold text-text-primary flex items-center gap-2 outline-none"
            >
              <Flag size={20} aria-hidden="true" />
              Reports from shoppers ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <p className="text-sm text-text-muted">
                No {filter === 'all' ? '' : `${filter} `}reports.
              </p>
            ) : (
              reports.map((r) => (
                <Item
                  key={r.id}
                  title={r.reasonLabel}
                  badges={
                    <Badge variant="default" size="sm">
                      {reporterType(r)}
                    </Badge>
                  }
                  status={r.status}
                  adminNote={r.adminNote}
                  resolvedAt={r.resolvedAt}
                  onSubmit={(status, note) =>
                    run(
                      () => resolveDealReportAction(r.id, status, note),
                      doneText(status),
                      'reports',
                    )
                  }
                >
                  <p>
                    <DealLink offerId={r.offerId} title={r.offerTitle} />
                  </p>
                  {r.note && (
                    <p className="whitespace-pre-wrap text-text-primary">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-text-muted">
                    {formatWhen(r.createdAt)}
                    {/* updated_at moves on a changed answer and on an admin's update alike. */}
                    {r.updatedAt !== r.createdAt &&
                      `, updated ${formatWhen(r.updatedAt)}`}
                  </p>
                </Item>
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}
