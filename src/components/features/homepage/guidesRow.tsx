import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { formatPrice } from '@/lib/data/adapters'
import type { FeaturedGuide } from '@/lib/data/homepage'
import { minBrandText } from '@/lib/data/typicalPrice'

interface GuidesRowProps {
  guides: FeaturedGuide[]
}

/**
 * The cost guides (src/content/guides/) were reachable only from the footer. Each card
 * carries the guide's own computed stats — the same getGuidePricingStats() the guide page
 * prints — so the number on the card and the number on the page cannot disagree.
 */
export function GuidesRow({ guides }: GuidesRowProps) {
  if (guides.length === 0) return null

  return (
    <section className="w-full bg-bg-surface py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Cost guides
            </h2>
            <p className="mt-1 text-text-secondary">
              What a treatment costs in a city, worked out from the prices
              advertised there.
            </p>
          </div>
          <Link
            href="/guides"
            className="group hidden items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors sm:inline-flex"
          >
            All guides
            <ArrowRight
              size={16}
              weight="bold"
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g, index) => (
            // Three guides on a phone, six from `sm`.
            <li key={g.slug} className={index >= 3 ? 'hidden sm:block' : ''}>
              <Link
                href={g.href}
                className="group flex h-full flex-col rounded-xl border border-border-default bg-bg-elevated p-5 transition-all duration-200 hover:border-border-hover hover:shadow-md"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {g.cityLabel}, {g.stateCode}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {g.treatmentLabel} cost in {g.cityLabel}
                </h3>
                <p className="mt-4 font-display text-2xl font-bold tabular-nums tracking-tight text-text-primary">
                  {formatPrice(g.medianPrice)}
                  <span className="ml-1.5 text-sm font-normal text-text-muted">
                    median{g.perUnit ? ' per unit' : ''}
                  </span>
                </p>
                <p className="mt-1 text-sm text-text-secondary tabular-nums">
                  {/* The guide's pooled range; its low end names a brand other than Botox. Not
                      "lowest is": that is the floor, and Dysport can sit below this range. */}
                  {formatPrice(g.minPrice)}
                  {minBrandText(g.minBrand)} – {formatPrice(g.maxPrice)} across{' '}
                  {g.pricedDealCount} priced deals
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            All guides
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
