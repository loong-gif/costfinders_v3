import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityDealsPage } from '@/components/features/deals/cityDealsPage'
import { DealDetailPage } from '@/components/features/deals/dealDetailPage'
import { TreatmentCityPage } from '@/components/features/deals/treatmentCityPage'
import {
  getBusinessCountForCity,
  getDealById,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getDealWithBusinessId,
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getTreatmentLabel,
  getUnifiedCities,
} from '@/lib/data/unified'
import {
  generateCityDealsMetadata,
  generateTreatmentCityMetadata,
} from '@/lib/seo/metadata'
import { buildDealsListSchema, buildTreatmentServiceSchema } from '@/lib/seo/schemas'
import type { TreatmentCategory } from '@/types/deal'

export const revalidate = 3600 // ISR: regenerate every hour

// Valid treatment slugs for route matching
const VALID_TREATMENTS: Set<string> = new Set([
  'botox',
  'fillers',
  'facials',
  'laser',
  'body',
  'skincare',
])

interface DealsPageProps {
  params: Promise<{ slugs?: string[] }>
}

// Determine the route type from slugs
type RouteType =
  | { type: 'redirect' }
  | { type: 'city'; citySlug: string; cityName: string }
  | {
      type: 'treatment-city'
      treatmentSlug: TreatmentCategory
      treatmentName: string
      citySlug: string
      cityName: string
    }
  | { type: 'deal'; dealId: string }
  | { type: 'not-found' }

const resolveRoute = cache(async function resolveRoute(slugs?: string[]): Promise<RouteType> {
  // No slugs = redirect to detected city
  if (!slugs || slugs.length === 0) {
    return { type: 'redirect' }
  }

  // Single slug - could be city or deal ID
  if (slugs.length === 1) {
    const slug = slugs[0]

    // Check if it's a city
    const cities = await getUnifiedCities()
    const city = cities.find((c) => c.slug === slug)
    if (city) {
      return { type: 'city', citySlug: slug, cityName: city.name }
    }

    // Check if it's a deal ID (numeric IDs from Supabase)
    const deal = await getDealById(slug)
    if (deal) {
      return { type: 'deal', dealId: slug }
    }

    // Not found
    return { type: 'not-found' }
  }

  // Two slugs - treatment/city combination
  if (slugs.length === 2) {
    const [first, second] = slugs

    // Check if first is a valid treatment category slug
    if (VALID_TREATMENTS.has(first)) {
      const treatmentSlug = first as TreatmentCategory
      // Check if second is a city
      const cities = await getUnifiedCities()
      const city = cities.find((c) => c.slug === second)
      if (city) {
        return {
          type: 'treatment-city',
          treatmentSlug,
          treatmentName: getTreatmentLabel(treatmentSlug),
          citySlug: second,
          cityName: city.name,
        }
      }
    }

    // Not found
    return { type: 'not-found' }
  }

  // More than 2 slugs - not found
  return { type: 'not-found' }
})

// Generate metadata dynamically based on route
export async function generateMetadata({
  params,
}: DealsPageProps): Promise<Metadata> {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'city': {
      const dealCount = await getDealCountForCitySlug(route.citySlug)
      const cityName = route.citySlug.replace(/-/g, ' ')
      const businessCount = await getBusinessCountForCity(cityName)
      const minPrice = await getMinPriceForCitySlug(route.citySlug)
      return generateCityDealsMetadata(route.cityName, route.citySlug, {
        dealCount,
        businessCount,
        minPrice: minPrice ?? undefined,
      })
    }

    case 'treatment-city': {
      const dealCount = await getDealCountForTreatmentAndCity(
        route.treatmentSlug,
        route.citySlug,
      )
      const cityName = route.citySlug.replace(/-/g, ' ')
      const businessCount = await getBusinessCountForCity(cityName)
      const minPrice = await getMinPriceForTreatmentAndCity(
        route.treatmentSlug,
        route.citySlug,
      )
      return generateTreatmentCityMetadata(
        route.treatmentName,
        route.treatmentSlug,
        route.cityName,
        route.citySlug,
        { dealCount, businessCount, minPrice: minPrice ?? undefined },
      )
    }

    case 'deal': {
      const deal = await getDealById(route.dealId)
      if (deal) {
        return {
          title: `${deal.title} | CostFinders`,
          description: deal.description,
        }
      }
      return {}
    }

    default:
      return {
        title: 'Find Medspa Deals | CostFinders',
        description:
          'Discover and compare medspa deals near you. Find the best prices on Botox, fillers, and aesthetic treatments.',
      }
  }
}

export default async function DealsRoutingPage({ params }: DealsPageProps) {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'redirect': {
      const allCities = await getUnifiedCities()
      return (
        <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold text-[#451a03] mb-2">
                Browse Deals by City
              </h1>
              <p className="text-[#78350f]">
                Select a city to explore medspa deals and savings
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCities.map((city) => (
                <a
                  key={city.slug}
                  href={`/deals/${city.slug}`}
                  className="group flex items-center gap-4 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-5 py-4 hover:border-[#c4b09a] hover:bg-[#faf5ee] transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#faf5ee] group-hover:bg-amber-800/8 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" className="text-[#78350f] group-hover:text-amber-800 transition-colors">
                      <path fill="currentColor" d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88m0 56a32 32 0 1 1-32 32 32 32 0 0 1 32-32" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-[#5c2d0a] group-hover:text-[#451a03]">
                      {city.name}
                    </p>
                    <p className="text-sm text-[#92400e]">
                      {city.stateCode} &middot; {city.businessCount} {city.businessCount === 1 ? 'provider' : 'providers'}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </main>
      )
    }

    case 'city': {
      const [cityDeals, allCities, cityBusinessCount] = await Promise.all([
        getDealsForCitySlug(route.citySlug),
        getUnifiedCities(),
        getBusinessCountForCity(route.citySlug.replace(/-/g, ' ')),
      ])
      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildDealsListSchema(
                  cityDeals.map((d) => ({
                    id: d.id,
                    title: d.title,
                    description: d.description,
                    dealPrice: d.dealPrice,
                    locationArea: route.cityName,
                  })),
                  route.cityName,
                ),
              ),
            }}
          />
          <CityDealsPage
            citySlug={route.citySlug}
            cityName={route.cityName}
            initialDeals={cityDeals}
            dealCount={cityDeals.length}
            businessCount={cityBusinessCount}
          />
        </>
      )
    }

    case 'treatment-city': {
      const [treatmentCityDeals, tcBusinessCount] = await Promise.all([
        getDealsForTreatmentAndCity(route.treatmentSlug, route.citySlug),
        getBusinessCountForCity(route.citySlug.replace(/-/g, ' ')),
      ])
      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildTreatmentServiceSchema(
                  route.treatmentName,
                  route.cityName,
                  {
                    dealCount: treatmentCityDeals.length,
                    minPrice: treatmentCityDeals.length > 0 ? Math.min(...treatmentCityDeals.map((d) => d.dealPrice)) : undefined,
                    maxPrice: treatmentCityDeals.length > 0 ? Math.max(...treatmentCityDeals.map((d) => d.dealPrice)) : undefined,
                  },
                ),
              ),
            }}
          />
          <TreatmentCityPage
            treatmentSlug={route.treatmentSlug}
            treatmentName={route.treatmentName}
            citySlug={route.citySlug}
            cityName={route.cityName}
            initialDeals={treatmentCityDeals}
            dealCount={treatmentCityDeals.length}
            businessCount={tcBusinessCount}
          />
        </>
      )
    }

    case 'deal': {
      const dealWithBiz = await getDealWithBusinessId(route.dealId)
      if (!dealWithBiz) {
        notFound()
      }
      // dealWithBiz has all AnonymousDeal fields + businessId from the raw offer
      const { businessId, ...anonymousDeal } = dealWithBiz
      const fullDeal = { ...anonymousDeal, businessId }
      return <DealDetailPage deal={anonymousDeal} fullDeal={fullDeal} />
    }
    default:
      notFound()
  }
}
