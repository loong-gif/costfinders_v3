import { ArrowRight, BookOpen } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { GuideSummary } from '@/types/guide'

interface GuideCtaProps {
  treatmentLabel: string
  cityLabel: string
  citySlug: string
  dealCount: number
  dealsLink: string
  relatedGuides: GuideSummary[]
  treatmentSlug: string
}

const MAX_RELATED_PER_GROUP = 4

export function GuideCta({
  treatmentLabel,
  cityLabel,
  citySlug,
  dealCount,
  dealsLink,
  relatedGuides,
  treatmentSlug,
}: GuideCtaProps) {
  // Same treatment, elsewhere: "where else can I get this, and is it cheaper?"
  const otherCities = relatedGuides
    .filter((g) => g.treatment === treatmentSlug && g.city !== citySlug)
    .slice(0, MAX_RELATED_PER_GROUP)

  // Same city, other treatments. This used to filter on treatment alone, with no city
  // predicate, so a Tucson guide's "related" list was mostly other cities' treatments —
  // links that were irrelevant to the reader and diluted the city's internal link graph.
  const otherTreatments = relatedGuides
    .filter((g) => g.city === citySlug && g.treatment !== treatmentSlug)
    .slice(0, MAX_RELATED_PER_GROUP)

  return (
    <section aria-labelledby="guide-cta-heading" className="mb-10">
      <div className="bg-bg-surface rounded-2xl p-6 sm:p-8 mb-10">
        <h2
          className="font-display text-2xl font-bold tracking-tight text-text-primary mb-2"
          id="guide-cta-heading"
        >
          {dealCount > 0
            ? `Compare ${dealCount} ${treatmentLabel.toLowerCase()} ${dealCount === 1 ? 'deal' : 'deals'} in ${cityLabel}`
            : `Browse medspa deals in ${cityLabel}`}
        </h2>
        <p className="text-text-secondary mb-6">
          Real costs, as local providers advertise them. Claim a deal to see who
          is offering it.
        </p>
        <Link
          className="inline-flex items-center gap-2 min-h-[44px] rounded-full bg-accent px-6 text-center text-balance font-semibold text-white hover:bg-accent-hover transition-colors"
          href={dealCount > 0 ? dealsLink : `/deals/${citySlug}`}
        >
          {dealCount > 0
            ? `See ${treatmentLabel} deals in ${cityLabel}`
            : `See all ${cityLabel} deals`}
          <ArrowRight size={18} weight="bold" />
        </Link>
      </div>

      {(otherCities.length > 0 || otherTreatments.length > 0) && (
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-text-primary mb-4">
            Related cost guides
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherTreatments.map((guide) => (
              <RelatedGuideLink
                key={guide.slug}
                label={`${guide.treatmentLabel} cost in ${guide.cityLabel}`}
                slug={guide.slug}
              />
            ))}
            {otherCities.map((guide) => (
              <RelatedGuideLink
                key={guide.slug}
                label={`${guide.treatmentLabel} cost in ${guide.cityLabel}, ${guide.stateCode}`}
                slug={guide.slug}
              />
            ))}
          </div>
          <Link
            className="inline-flex min-h-[44px] items-center mt-2 text-sm font-medium text-accent hover:text-accent-hover underline underline-offset-4"
            href="/guides"
          >
            All medspa treatment cost guides
          </Link>
        </div>
      )}
    </section>
  )
}

function RelatedGuideLink({ label, slug }: { label: string; slug: string }) {
  return (
    <Link
      className="group flex items-center gap-3 bg-bg-elevated border border-border-default rounded-xl p-4 hover:border-border-hover hover:shadow-md transition-all"
      href={`/guides/${slug}`}
    >
      <BookOpen className="text-text-muted shrink-0" size={18} weight="fill" />
      <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
        {label}
      </span>
    </Link>
  )
}
