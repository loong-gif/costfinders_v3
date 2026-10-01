import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface CityCardProps {
  name: string
  slug: string
  stateSlug: string
  stateName: string
  dealCount: number
  businessCount: number
}

/**
 * A city on its state page: name, then the two counts, linking to the city's provider hub.
 *
 * The provider figure is the directory's (every listed clinic, as the hub prints it), not the
 * clinics with deals, so it says "listed": "156 deals · 67 providers" read as a contradiction of
 * the deals page's "156 deals from 21 providers". A city with no deal says so in words; "0 deals"
 * looked broken, and the card stays because the hub still lists its providers (2026-09-28).
 */
export function CityCard({
  name,
  slug,
  stateSlug,
  stateName,
  dealCount,
  businessCount,
}: CityCardProps) {
  return (
    <Link
      href={`/${stateSlug}/${slug}`}
      className="group flex h-full items-center justify-between gap-4 rounded-xl border border-border-default bg-bg-elevated px-5 py-4 transition-all duration-200 hover:border-border-hover hover:shadow-md"
    >
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
          {name}
          <span className="sr-only">, {stateName}</span>
        </h3>
        <p className="mt-0.5 text-sm text-text-muted tabular-nums">
          {/* Each half unbroken, so a narrow card wraps at the dot. */}
          <span className="whitespace-nowrap">
            {dealCount === 0
              ? 'No deals listed yet ·'
              : `${dealCount} ${dealCount === 1 ? 'deal' : 'deals'} ·`}
          </span>{' '}
          <span className="whitespace-nowrap">
            {businessCount}{' '}
            {businessCount === 1 ? 'provider listed' : 'providers listed'}
          </span>
        </p>
      </div>
      <ArrowRight
        size={16}
        weight="bold"
        className="shrink-0 text-text-muted group-hover:text-accent transition-colors"
      />
    </Link>
  )
}
