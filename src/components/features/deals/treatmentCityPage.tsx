'use client'

import { ArrowLeft, BookOpen, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  DEFAULT_SORT,
  treatmentLink,
} from '@/components/features/deals/cityDealsPage'
import { DealsGrid } from '@/components/features/dealsGrid'
import { FilterPanel } from '@/components/features/filterPanel'
import { CategoryFilter } from '@/components/patterns/categoryFilter'
import { Faq } from '@/components/ui/faq'
import { getTreatmentLabel } from '@/lib/data/adapters'
import type { TypicalPrice } from '@/lib/data/typicalPrice'
import { getTreatmentCityFaqs } from '@/lib/seo/faq-content'
import {
  type DealFilters,
  type SortOption,
  sortDeals,
  TREATMENT_SLUGS,
  withinPriceRange,
} from '@/lib/utils/deal-sorting'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'

interface TreatmentCityPageProps {
  treatmentSlug: TreatmentCategory
  treatmentName: string
  citySlug: string
  cityName: string
  initialDeals: AnonymousDeal[]
  dealCount: number
  /**
   * Whether a cost guide exists for this treatment+city. The guide link used to render
   * unconditionally, so every treatment/city page without a guide — most of them — shipped
   * an internal link straight into a 404.
   */
  hasGuide: boolean
  /** Deals per treatment in this city: the "other treatments" links go only where there are some. */
  treatmentCounts: Record<string, number>
  /**
   * This treatment's typical price in this city; null outside TYPICAL_TREATMENTS (neurotoxins
   * only) or below the floor.
   */
  typical?: TypicalPrice | null
}

/**
 * The discount a reader can check against the two prices on the card: `$149` struck through
 * from `$399`. Deliberately NOT the scraped `discountPercent`, which contradicts those prices
 * on 12 of the 65 treatment-city pages — 4 offers carry discount_percent = 100 with
 * regular_price === discount_price, and 1 carries 63.7 on `$49 -> $49`. A hero sentence built
 * on that field would announce "100% off" over a card showing no price cut at all.
 *
 * The cards' "Save N%" chip goes through dealPricing(), which needs both prices too, so the
 * sentence and the chips agree.
 */
function priceCutPercent(deal: AnonymousDeal): number {
  if (
    deal.originalPrice > 0 &&
    deal.dealPrice > 0 &&
    deal.originalPrice > deal.dealPrice
  ) {
    return (1 - deal.dealPrice / deal.originalPrice) * 100
  }
  return 0
}

export function TreatmentCityPage({
  treatmentSlug,
  treatmentName,
  citySlug,
  cityName,
  initialDeals,
  dealCount,
  hasGuide,
  treatmentCounts,
  typical,
}: TreatmentCityPageProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<DealFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT)

  // Get data
  const faqs = getTreatmentCityFaqs(treatmentName, cityName)
  const otherTreatments = TREATMENT_SLUGS.filter(
    (slug) => slug !== treatmentSlug && (treatmentCounts[slug] ?? 0) > 0,
  )

  /**
   * The largest price cut actually listed on this page, or 0 when nothing here is discounted.
   *
   * Replaces a hardcoded "save up to 50%" that shipped into all 65 treatment-city heroes
   * regardless of city or treatment. Measured against the live corpus: only 7 of those 65
   * pages contain a deal that reaches 50%, the median page tops out at 27%, and 30 pages
   * carry no discounted deal at all — so those omit the sentence rather than soften it.
   *
   * Read from initialDeals, not filteredDeals: the sentence describes the page, and a reader
   * narrowing the price filter has not changed what the page lists.
   */
  const maxPriceCut = useMemo(
    () => Math.round(Math.max(0, ...initialDeals.map(priceCutPercent))),
    [initialDeals],
  )

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.minPrice !== undefined) count++
    if (filters.maxPrice !== undefined) count++
    return count
  }, [filters.minPrice, filters.maxPrice])

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    const { minPrice, maxPrice } = filters
    const deals = initialDeals.filter((d) =>
      withinPriceRange(d, minPrice, maxPrice),
    )

    // Apply sorting
    return sortDeals(deals, sortBy)
  }, [initialDeals, filters, sortBy])

  const handleResetFilters = () => {
    setFilters({})
    setSortBy(DEFAULT_SORT)
  }

  // The city page's chips, with this treatment selected: a shopper who tapped "Fillers" there
  // lands here and can still switch treatment, or go back to all of the city's deals.
  const handleCategoryChange = (category: TreatmentCategory | 'all') => {
    if (category === treatmentSlug) return
    router.push(
      category === 'all'
        ? `/deals/${citySlug}`
        : `/deals/${category}/${citySlug}`,
    )
  }

  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={`/deals/${citySlug}`}
          className="inline-flex items-center gap-1.5 min-h-[44px] mb-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          All {cityName} deals
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            {treatmentName} in {cityName}
          </h1>
          <p className="mt-3 text-text-secondary max-w-2xl">
            Compare {dealCount} {treatmentName.toLowerCase()} deals from{' '}
            {cityName} providers, at the prices they advertise publicly.
            {maxPriceCut > 0 &&
              ` The biggest price cut listed on this page is ${maxPriceCut}% off.`}
          </p>
          {hasGuide && (
            <Link
              href={`/guides/${treatmentSlug}-cost-${citySlug}`}
              className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              <BookOpen size={16} weight="bold" />
              {treatmentName} cost guide for {cityName}
              <CaretRight size={12} weight="bold" />
            </Link>
          )}
        </div>

        <FilterPanel
          filters={filters}
          sortBy={sortBy}
          onFiltersChange={setFilters}
          onSortChange={setSortBy}
          onReset={handleResetFilters}
          activeFilterCount={activeFilterCount}
          // On /deals/botox/* a deal compares per unit or not at all (comparablePrice): flat
          // prices, bundles and unpriced rows have no per-unit figure (10 of 21 on Tucson) and
          // drop out while a bound is set. The bounds are dollars per unit; the legend says so.
          priceLabel={treatmentSlug === 'botox' ? 'Price per unit' : undefined}
          chips={
            <CategoryFilter
              selected={treatmentSlug}
              onChange={handleCategoryChange}
              available={TREATMENT_SLUGS.filter(
                (slug) =>
                  slug === treatmentSlug || (treatmentCounts[slug] ?? 0) > 0,
              )}
            />
          }
        />

        <DealsGrid
          deals={filteredDeals}
          totalCount={initialDeals.length}
          onClearFilters={
            activeFilterCount > 0 ? handleResetFilters : undefined
          }
          typical={typical}
        />

        {/* Other Treatments in Same City — only pages that list something */}
        {otherTreatments.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-bold tracking-tight text-text-primary mb-4">
              Other treatments in {cityName}
            </h2>
            <div className="flex flex-wrap gap-2">
              {otherTreatments.map((slug) => (
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
        )}

        {/* FAQ Section */}
        <Faq items={faqs} className="mt-12" />
      </div>
    </main>
  )
}
