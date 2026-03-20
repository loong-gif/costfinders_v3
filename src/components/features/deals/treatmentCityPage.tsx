'use client'

import {
  ArrowLeft,
  Buildings,
  CaretRight,
  MapPin,
  Tag,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DealsGrid } from '@/components/features/dealsGrid'
import { FilterPanel } from '@/components/features/filterPanel'
import { Card } from '@/components/ui/card'
import { Faq } from '@/components/ui/faq'
import {
  type DealFilters,
  getAllActiveCitySlugs,
  getBusinessCountForCitySlug,
  getCategories,
  getCityBySlug,
  getDealCountForTreatmentAndCity,
  getDealsForTreatmentAndCity,
  type SortOption,
  sortDeals,
} from '@/lib/mock-data'
import { getTreatmentCityFaqs } from '@/lib/seo/faq-content'
import type { TreatmentCategory } from '@/types/deal'

interface TreatmentCityPageProps {
  treatmentSlug: TreatmentCategory
  treatmentName: string
  citySlug: string
  cityName: string
}

export function TreatmentCityPage({
  treatmentSlug,
  treatmentName,
  citySlug,
  cityName,
}: TreatmentCityPageProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<DealFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>('popular')

  // Get data
  const dealCount = getDealCountForTreatmentAndCity(treatmentSlug, citySlug)
  const businessCount = getBusinessCountForCitySlug(citySlug)
  const categories = getCategories()
    .filter((c) => c.isActive && c.slug !== treatmentSlug)
    .slice(0, 5)
  const otherCities = getAllActiveCitySlugs()
    .filter((slug) => slug !== citySlug)
    .slice(0, 4)
    .map((slug) => {
      const city = getCityBySlug(slug)
      return city ? { slug, name: city.name } : null
    })
    .filter(Boolean) as Array<{ slug: string; name: string }>
  const faqs = getTreatmentCityFaqs(treatmentName, cityName)

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.minPrice !== undefined) count++
    if (filters.maxPrice !== undefined) count++
    return count
  }, [filters.minPrice, filters.maxPrice])

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    let deals = getDealsForTreatmentAndCity(treatmentSlug, citySlug)

    // Apply price filters
    if (filters.minPrice !== undefined) {
      deals = deals.filter((d) => d.dealPrice >= filters.minPrice!)
    }
    if (filters.maxPrice !== undefined) {
      deals = deals.filter((d) => d.dealPrice <= filters.maxPrice!)
    }

    // Apply sorting
    return sortDeals(deals, sortBy)
  }, [treatmentSlug, citySlug, filters, sortBy])

  const handleDealClick = (dealId: string) => {
    router.push(`/deals/${dealId}`)
  }

  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Link */}
        <Link
          href={`/deals/${citySlug}`}
          className="inline-flex items-center gap-2 text-sm text-[#78350f] hover:text-[#451a03] transition-colors mb-6"
        >
          <ArrowLeft size={16} weight="bold" />
          All {cityName} Deals
        </Link>

        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#451a03]">
            {treatmentName} in {cityName}
          </h1>
          <p className="mt-2 text-[#78350f] max-w-2xl">
            Compare {dealCount} {treatmentName.toLowerCase()} deals from
            verified {cityName} providers. Find the best prices and save up to
            50%.
          </p>

          {/* Stats Row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#78350f]">
            <div className="flex items-center gap-1.5">
              <MapPin size={16} weight="fill" className="text-amber-800" />
              <span>{cityName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag size={16} weight="fill" className="text-green-400" />
              <span>
                {dealCount} {treatmentName.toLowerCase()} deals
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Buildings size={16} weight="fill" className="text-blue-600" />
              <span>{businessCount} providers</span>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="mb-6">
          <FilterPanel
            filters={filters}
            sortBy={sortBy}
            onFiltersChange={setFilters}
            onSortChange={setSortBy}
            onReset={() => {
              setFilters({})
              setSortBy('popular')
            }}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Deals Grid */}
        <DealsGrid deals={filteredDeals} onDealClick={handleDealClick} />

        {/* Same Treatment in Other Cities */}
        {otherCities.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-[#451a03] mb-4">
              {treatmentName} in Other Cities
            </h2>
            <div className="flex flex-wrap gap-3">
              {otherCities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/deals/${treatmentSlug}/${city.slug}`}
                  className="px-4 py-2 rounded-full bg-[#f2ebe2] border border-[#d4c4b0] text-sm text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03] transition-colors"
                >
                  {treatmentName} in {city.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Other Treatments in Same City */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Other Treatments in {cityName}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/deals/${category.slug}/${citySlug}`}
                className="group"
              >
                <Card
                  variant="glass"
                  padding="md"
                  className="bg-[#f2ebe2] border-[#d4c4b0] hover:bg-[#faf5ee] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#451a03] group-hover:text-amber-800 transition-colors">
                      {category.name}
                    </span>
                    <CaretRight
                      size={14}
                      weight="bold"
                      className="text-[#92400e] group-hover:text-amber-800 transition-colors"
                    />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <Faq items={faqs} className="mt-12" />
      </div>
    </main>
  )
}
