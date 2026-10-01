'use client'

import { ArrowLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DealsGrid } from '@/components/features/dealsGrid'
import { FilterPanel } from '@/components/features/filterPanel'
import { CategoryFilter } from '@/components/patterns/categoryFilter'
import { Faq } from '@/components/ui/faq'
import { getTreatmentLabel } from '@/lib/data/adapters'
import type { TypicalPrice } from '@/lib/data/typicalPrice'
import { getCityDealsFaqs } from '@/lib/seo/faq-content'
import {
  type DealFilters,
  type SortOption,
  sortDeals,
  TREATMENT_SLUGS,
  withinPriceRange,
} from '@/lib/utils/deal-sorting'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'

export const treatmentLink =
  'inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-border-default text-sm font-medium text-text-primary hover:border-border-hover hover:bg-bg-surface transition-colors'

/**
 * The default order: what you pay, low to high (sortDeals groups per-unit rates and unpriced
 * offers after it). "Most Popular" was the default and ranked on a claim count that is 0 for
 * every deal, so the order was arbitrary.
 */
export const DEFAULT_SORT: SortOption = 'price-asc'

interface CityDealsPageProps {
  citySlug: string
  cityName: string
  initialDeals: AnonymousDeal[]
  dealCount: number
  businessCount: number
  /** Path to this city's /{state}/{city} provider hub, or null when no served state owns it. */
  cityHubPath: string | null
  /**
   * Deals per treatment in this city. Tiles render only for treatments with at least one,
   * matching the rule the sitemap already applies — it refuses to declare a zero-deal
   * treatment/city URL, while this grid was linking to ~25 of them.
   */
  treatmentCounts: Record<string, number>
  /** Typical price per treatment in this city — typicalPrices() of its offers. */
  typical?: Partial<Record<TreatmentCategory, TypicalPrice>>
}

export function CityDealsPage({
  citySlug,
  cityName,
  initialDeals,
  dealCount,
  businessCount,
  cityHubPath,
  treatmentCounts,
  typical,
}: CityDealsPageProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<DealFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT)

  // Get data
  const faqs = getCityDealsFaqs(cityName)

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.minPrice !== undefined) count++
    if (filters.maxPrice !== undefined) count++
    return count
  }, [filters.minPrice, filters.maxPrice])

  // Filter and sort deals. The groups keep this order, so the sort applies inside each.
  const filteredDeals = useMemo(() => {
    // Price bounds compare comparablePrice(), not dealPrice — so on this mixed page a Botox
    // deal is still ranged PER UNIT ("Max $12" keeps $10/unit Botox and a $12 facial). The
    // legend stays the generic "Price range"; FilterPanel's note says which is which.
    const { minPrice, maxPrice } = filters
    const deals = initialDeals.filter((d) =>
      withinPriceRange(d, minPrice, maxPrice),
    )
    return sortDeals(deals, sortBy)
  }, [initialDeals, filters, sortBy])

  const hasDeals = initialDeals.length > 0

  const handleResetFilters = () => {
    setFilters({})
    setSortBy(DEFAULT_SORT)
  }

  // A chip is a page: /deals/{treatment}/{city}. "All deals" is this one.
  const handleCategoryChange = (category: TreatmentCategory | 'all') => {
    if (category !== 'all') router.push(`/deals/${category}/${citySlug}`)
  }

  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Exits: the city index, and this city's provider hub. /{state}/{city} and
            /deals/{city} describe the same city and neither used to reference the other. */}
        <div className="flex flex-wrap items-center gap-x-5 mb-4 text-sm">
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 min-h-[44px] text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            All cities
          </Link>
          {cityHubPath && (
            <Link
              href={cityHubPath}
              className="inline-flex items-center min-h-[44px] font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Browse {cityName} medspas by provider
            </Link>
          )}
        </div>

        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Medspa deals in {cityName}
          </h1>
          <p className="mt-3 text-text-secondary max-w-2xl">
            {hasDeals
              ? // Not "verified providers": business_claims is empty and business_profiles
                // holds only the test owner account, so no provider here has been vetted.
                // These are the prices providers publish on their own pages.
                // No "from 1 provider": beside a directory that names every clinic in the
                // city, it says every deal here is one clinic's (see provider/[slug]/page.tsx).
                `Compare ${dealCount} medspa ${dealCount === 1 ? 'deal' : 'deals'}${businessCount > 1 ? ` from ${businessCount} providers` : ''} in ${cityName}, at the prices they advertise publicly.`
              : `We don't list any ${cityName} deals right now.`}
          </p>
        </div>

        {/* Hidden when there is nothing to filter, so it can't produce a dead control. */}
        {hasDeals && (
          <FilterPanel
            filters={filters}
            sortBy={sortBy}
            onFiltersChange={setFilters}
            onSortChange={setSortBy}
            onReset={handleResetFilters}
            activeFilterCount={activeFilterCount}
            chips={
              <CategoryFilter
                selected="all"
                onChange={handleCategoryChange}
                // Each chip opens /deals/{treatment}/{city}, which exists only with deals behind it.
                available={TREATMENT_SLUGS.filter(
                  (slug) => (treatmentCounts[slug] ?? 0) > 0,
                )}
              />
            }
          />
        )}

        <DealsGrid
          deals={filteredDeals}
          totalCount={initialDeals.length}
          onClearFilters={
            activeFilterCount > 0 ? handleResetFilters : undefined
          }
          // treatmentCounts: the unfiltered count behind each group's "See all N".
          groups={{ citySlug, typical, totals: treatmentCounts }}
        />

        {/* Treatment Links Section — every link is empty when the city has no
            deals, so it only appears when there is something to find */}
        {hasDeals && (
          <>
            <section className="mt-14">
              <h2 className="font-display text-xl font-bold tracking-tight text-text-primary mb-4">
                Popular treatments in {cityName}
              </h2>
              <div className="flex flex-wrap gap-2">
                {TREATMENT_SLUGS.filter(
                  (slug) => (treatmentCounts[slug] ?? 0) > 0,
                ).map((slug) => (
                  <Link
                    key={slug}
                    href={`/deals/${slug}/${citySlug}`}
                    className={treatmentLink}
                  >
                    {getTreatmentLabel(slug)}
                    <CaretRight size={12} weight="bold" />
                  </Link>
                ))}
              </div>
            </section>

            {/* FAQ Section */}
            <Faq items={faqs} className="mt-12" />
          </>
        )}
      </div>
    </main>
  )
}
