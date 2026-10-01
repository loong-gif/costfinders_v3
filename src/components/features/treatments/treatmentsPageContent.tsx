import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { PriceRangeTiles } from '@/components/features/homepage/priceRangeStrip'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import type { TreatmentPriceRange } from '@/lib/data/homepage'

interface Category {
  slug: string
  label: string
  count: number
  providerCount: number
}

interface TreatmentsPageContentProps {
  categories: Category[]
  totalDeals: number
  ranges: TreatmentPriceRange[]
}

/**
 * The treatments hub. It used to open on a stock spa photo under a brown wash; the header is
 * now the price picture itself — one range tile per treatment with enough priced offers, each
 * linking to its browse page — and the category list below carries the counts.
 */
export function TreatmentsPageContent({
  categories,
  totalDeals,
  ranges,
}: TreatmentsPageContentProps) {
  return (
    <main className="pt-20">
      <section className="pb-10 sm:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: 'Home', href: '/' }, { label: 'Treatments' }]}
          />
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
            What treatments cost
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-text-secondary">
            The range providers advertise for each treatment, across every
            provider we list. Neurotoxins are per unit; everything else is the
            price you pay.
          </p>
          <p className="mt-4 text-sm text-text-muted">
            <span className="font-semibold text-text-secondary tabular-nums">
              {totalDeals.toLocaleString('en-US')}
            </span>{' '}
            deals
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <span className="font-semibold text-text-secondary tabular-nums">
              {categories.length}
            </span>{' '}
            categories
          </p>
        </div>
      </section>

      {ranges.length > 0 && (
        <section className="bg-bg-surface py-12 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PriceRangeTiles ranges={ranges} />
          </div>
        </section>
      )}

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Browse by category
          </h2>
          <p className="mt-1 text-text-secondary">
            Every deal we list, by treatment category.
          </p>
          <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/treatments/${category.slug}`}
                  className="group flex h-full items-center justify-between gap-4 rounded-xl border border-border-default bg-bg-elevated px-5 py-4 transition-all duration-200 hover:border-border-hover hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {category.label}
                    </p>
                    <p className="mt-0.5 text-sm text-text-muted tabular-nums">
                      {category.count} deals · {category.providerCount}{' '}
                      {category.providerCount === 1 ? 'provider' : 'providers'}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    weight="bold"
                    className="shrink-0 text-text-muted group-hover:text-accent transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-default pt-8">
            <p className="text-text-secondary">Looking for a city instead?</p>
            <Link
              href="/deals"
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-text-primary text-sm font-semibold text-text-primary hover:bg-bg-surface transition-colors"
            >
              Browse deals by city
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
