import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { ReportDealProblem } from '@/components/features/deals/reportDealProblem'
import {
  CONFIRMED_ICON as ConfirmedIcon,
  TIER_ICONS,
} from '@/components/patterns/treatmentIcons'
import { describeInterpretation, TIER_LABELS } from '@/lib/data/interpretation'
import type { AnonymousDeal, InterpretationNote } from '@/types/deal'

/**
 * What a shopper has to be to get the price. Listed apart from what we worked out, because they
 * are this page's only terms: offerTerms() states nothing beyond these two booleans, so the old
 * Terms & conditions section is gone rather than saying them a second time.
 */
const CONDITIONS: InterpretationNote[] = ['members-only', 'new-patients-only']

/**
 * "January 5, 2026". Pinned to UTC so a build and a browser print the same day.
 * ponytail: a confirmation made after 4pm Pacific reads as the next day; take the clinic's own
 * time zone once the directory carries one.
 */
function confirmedOn(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const EYEBROW = 'text-xs font-semibold uppercase tracking-wider text-text-muted'

/**
 * How we read this deal (spec §3.2): the tier, the clinic's own words, what we worked out from
 * them, the conditions, and a way to tell us we got it wrong. `description` is the offer text
 * after scrubProviderIdentity(), so quoting it names no clinic.
 */
export function HowWeReadThisDeal({ deal }: { deal: AnonymousDeal }) {
  const { tier, reasons, notes } = deal.interpretation
  const { headline, lines } = describeInterpretation(deal)
  // describeInterpretation() returns one line per reason, then one per note, in that order.
  const noteLines = notes.map((note, i) => ({
    note,
    line: lines[reasons.length + i],
  }))
  const readings = [
    ...lines.slice(0, reasons.length),
    ...noteLines.filter((n) => !CONDITIONS.includes(n.note)).map((n) => n.line),
  ]
  const conditions = noteLines
    .filter((n) => CONDITIONS.includes(n.note))
    .map((n) => n.line)
  const words = deal.description.trim()
  const confirmed = deal.clinicConfirmedAt
    ? confirmedOn(deal.clinicConfirmedAt)
    : null
  const TierIcon = TIER_ICONS[tier]

  return (
    <section
      id="how-we-read"
      aria-labelledby="how-we-read-heading"
      className="scroll-mt-24 space-y-5"
    >
      <h2
        id="how-we-read-heading"
        className="font-display text-xl font-bold tracking-tight text-text-primary"
      >
        How we read this deal
      </h2>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
              tier === 'check'
                ? 'bg-warning-bg text-warning'
                : 'bg-bg-surface text-text-primary'
            }`}
          >
            <TierIcon size={16} weight="bold" className="shrink-0" />
            {TIER_LABELS[tier].label}
          </span>
          {confirmed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-sm font-semibold text-success">
              <ConfirmedIcon size={16} weight="bold" className="shrink-0" />
              Confirmed by the clinic on {confirmed}
            </span>
          )}
        </div>
        <p className="text-text-secondary">{headline}</p>
      </div>

      {words && (
        <figure className="rounded-xl bg-bg-surface px-4 py-3">
          <figcaption className={EYEBROW}>The clinic&apos;s words</figcaption>
          <blockquote className="mt-1.5 whitespace-pre-line text-text-primary">
            &ldquo;{words}&rdquo;
          </blockquote>
        </figure>
      )}

      {readings.length > 0 && (
        <ul className="list-disc space-y-2 pl-5 text-text-secondary marker:text-text-muted">
          {readings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {conditions.length > 0 && (
        <div>
          <h3 className={EYEBROW}>Conditions</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-text-secondary marker:text-text-muted">
            {conditions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 border-t border-border-default pt-3">
        <Link
          href="/how-it-works#how-we-read-deals"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
        >
          How CostFinders reads deals
          <ArrowRight size={14} weight="bold" />
        </Link>
        <ReportDealProblem offerId={Number(deal.id)} />
      </div>
    </section>
  )
}
