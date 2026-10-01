import type { GuideContent } from '@/types/guide'

interface CityMarketContextProps {
  content: GuideContent['cityContext']
  cityLabel: string
  treatmentLabel: string
}

/**
 * The researched market context for this city.
 *
 * These four fields were being written into every guide JSON and rendered on no page at all —
 * the single most city-specific block in the file, and the strongest defence against the
 * cluster reading as templated, sitting unused.
 */
export function CityMarketContext({
  content,
  cityLabel,
  treatmentLabel,
}: CityMarketContextProps) {
  const rows = [
    content.costOfLivingIndex != null && {
      term: 'Cost of living',
      detail: `Index ${content.costOfLivingIndex} against a US average of 100, which sets the floor under local rent, staffing and overhead.`,
    },
    content.medspaDensity && {
      term: 'Provider density',
      detail: content.medspaDensity,
    },
    content.competitionNotes && {
      term: 'Competition',
      detail: content.competitionNotes,
    },
    content.demographicNotes && {
      term: 'Who books here',
      detail: content.demographicNotes,
    },
  ].filter((row): row is { term: string; detail: string } => Boolean(row))

  if (rows.length === 0) return null

  return (
    <section aria-labelledby="market-context-heading" className="mb-10">
      <h2
        className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3"
        id="market-context-heading"
      >
        The {cityLabel} market at a glance
      </h2>
      <p className="text-text-secondary mb-6">
        What makes {treatmentLabel.toLowerCase()} cost here different from the
        market next door.
      </p>

      {/* items-start: stretched, a one-sentence card grew ~250px of empty border to match a
          long neighbour (2026-09-28). */}
      <dl className="grid items-start gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="bg-bg-elevated border border-border-default rounded-xl p-4"
            key={row.term}
          >
            <dt className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
              {row.term}
            </dt>
            <dd className="text-sm text-text-primary">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
