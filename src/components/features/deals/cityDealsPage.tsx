'use client'

import { Buildings, CaretRight, MapPin, Tag } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DealsGrid } from '@/components/features/dealsGrid'
import { FilterPanel } from '@/components/features/filterPanel'
import { CategoryFilter } from '@/components/patterns/categoryFilter'
import { Card } from '@/components/ui/card'
import { Faq } from '@/components/ui/faq'
import {
  type DealFilters,
  getAllActiveCitySlugs,
  getBusinessCountForCitySlug,
  getCategories,
  getCityBySlug,
  getDealCountForCitySlug,
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  type SortOption,
  sortDeals,
} from '@/lib/mock-data'
import { getCityDealsFaqs } from '@/lib/seo/faq-content'
import type { TreatmentCategory } from '@/types/deal'

interface CityDealsPageProps {
  citySlug: string
  cityName: string
}

export function CityDealsPage({ citySlug, cityName }: CityDealsPageProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<
    TreatmentCategory | 'all'
  >('all')
  const [filters, setFilters] = useState<DealFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>('popular')

  // Get data
  const dealCount = getDealCountForCitySlug(citySlug)
  const businessCount = getBusinessCountForCitySlug(citySlug)
  const categories = getCategories().filter((c) => c.isActive)
  const otherCities = getAllActiveCitySlugs()
    .filter((slug) => slug !== citySlug)
    .slice(0, 4)
    .map((slug) => {
      const city = getCityBySlug(slug)
      return city ? { slug, name: city.name } : null
    })
    .filter(Boolean) as Array<{ slug: string; name: string }>
  const faqs = getCityDealsFaqs(cityName)

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.minPrice !== undefined) count++
    if (filters.maxPrice !== undefined) count++
    return count
  }, [filters.minPrice, filters.maxPrice])

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    let deals =
      selectedCategory !== 'all'
        ? getDealsForTreatmentAndCity(selectedCategory, citySlug)
        : getDealsForCitySlug(citySlug)

    // Apply price filters
    if (filters.minPrice !== undefined) {
      deals = deals.filter((d) => d.dealPrice >= filters.minPrice!)
    }
    if (filters.maxPrice !== undefined) {
      deals = deals.filter((d) => d.dealPrice <= filters.maxPrice!)
    }

    // Apply sorting
    return sortDeals(deals, sortBy)
  }, [citySlug, selectedCategory, filters, sortBy])

  const handleDealClick = (dealId: string) => {
    router.push(`/deals/${dealId}`)
  }

  const handleCategoryChange = (category: TreatmentCategory | 'all') => {
    if (category !== 'all') {
      // Navigate to treatment+city page
      router.push(`/deals/${category}/${citySlug}`)
    } else {
      setSelectedCategory(category)
    }
  }

  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#451a03]">
            Medspa Deals in {cityName}
          </h1>
          <p className="mt-2 text-[#78350f] max-w-2xl">
            Compare {dealCount} medspa deals from {businessCount} verified
            providers in {cityName}. Find the best prices on Botox, fillers, and
            more.
          </p>

          {/* Stats Row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#78350f]">
            <div className="flex items-center gap-1.5">
              <MapPin size={16} weight="fill" className="text-amber-800" />
              <span>{cityName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag size={16} weight="fill" className="text-green-400" />
              <span>{dealCount} active deals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Buildings size={16} weight="fill" className="text-blue-600" />
              <span>{businessCount} providers</span>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <CategoryFilter
            selected={selectedCategory}
            onChange={handleCategoryChange}
          />
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

        {/* Treatment Links Section */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Popular Treatments in {cityName}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

        {/* Other Cities Section */}
        {otherCities.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-[#451a03] mb-4">
              Deals in Other Cities
            </h2>
            <div className="flex flex-wrap gap-3">
              {otherCities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/deals/${city.slug}`}
                  className="px-4 py-2 rounded-full bg-[#f2ebe2] border border-[#d4c4b0] text-sm text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03] transition-colors"
                >
                  {city.name}
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
