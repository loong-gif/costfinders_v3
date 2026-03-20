import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAllActiveCitySlugs,
  getCityBySlug,
  getCategories,
  getActiveDeals,
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getBusinessCountForCitySlug,
  getCategoryBySlug,
  getAnonymousDealById,
  getDealById,
  getAllTreatmentCityCombos,
} from '@/lib/mock-data'
import {
  generateCityDealsMetadata,
  generateTreatmentCityMetadata,
} from '@/lib/seo/metadata'
import type { TreatmentCategory } from '@/types/deal'
import { DealsRedirect } from '@/components/features/deals/dealsRedirect'
import { CityDealsPage } from '@/components/features/deals/cityDealsPage'
import { TreatmentCityPage } from '@/components/features/deals/treatmentCityPage'
import { DealDetailPage } from '@/components/features/deals/dealDetailPage'

interface DealsPageProps {
  params: Promise<{ slugs?: string[] }>
}

// Determine the route type from slugs
type RouteType =
  | { type: 'redirect' }
  | { type: 'city'; citySlug: string; cityName: string }
  | { type: 'treatment-city'; treatmentSlug: TreatmentCategory; treatmentName: string; citySlug: string; cityName: string }
  | { type: 'deal'; dealId: string }
  | { type: 'not-found' }

function resolveRoute(slugs?: string[]): RouteType {
  // No slugs = redirect to detected city
  if (!slugs || slugs.length === 0) {
    return { type: 'redirect' }
  }

  // Single slug - could be city or deal ID
  if (slugs.length === 1) {
    const slug = slugs[0]

    // Check if it's a city
    const city = getCityBySlug(slug)
    if (city) {
      return { type: 'city', citySlug: slug, cityName: city.name }
    }

    // Check if it's a deal ID (deal IDs start with "deal-")
    const deal = getAnonymousDealById(slug)
    if (deal) {
      return { type: 'deal', dealId: slug }
    }

    // Not found
    return { type: 'not-found' }
  }

  // Two slugs - treatment/city combination
  if (slugs.length === 2) {
    const [first, second] = slugs

    // Check if first is a treatment category
    const category = getCategoryBySlug(first as TreatmentCategory)
    if (category) {
      // Check if second is a city
      const city = getCityBySlug(second)
      if (city) {
        return {
          type: 'treatment-city',
          treatmentSlug: category.slug,
          treatmentName: category.name,
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
}

// Generate static params for all routes
export async function generateStaticParams() {
  const cities = getAllActiveCitySlugs()
  const treatmentCityCombos = getAllTreatmentCityCombos()
  const deals = getActiveDeals()

  const params: Array<{ slugs: string[] }> = [
    // Empty slugs for redirect page (handled client-side)
    // { slugs: [] }, // Optional catch-all handles this

    // City pages: /deals/houston
    ...cities.map((city) => ({ slugs: [city] })),

    // Treatment+city pages: /deals/botox/houston
    ...treatmentCityCombos.map((combo) => ({
      slugs: [combo.treatment, combo.city],
    })),

    // Deal detail pages: /deals/deal-123
    ...deals.map((deal) => ({ slugs: [deal.id] })),
  ]

  return params
}

// Generate metadata dynamically based on route
export async function generateMetadata({
  params,
}: DealsPageProps): Promise<Metadata> {
  const { slugs } = await params
  const route = resolveRoute(slugs)

  switch (route.type) {
    case 'city': {
      const dealCount = getDealCountForCitySlug(route.citySlug)
      const businessCount = getBusinessCountForCitySlug(route.citySlug)
      const minPrice = getMinPriceForCitySlug(route.citySlug)
      return generateCityDealsMetadata(route.cityName, route.citySlug, {
        dealCount,
        businessCount,
        minPrice,
      })
    }

    case 'treatment-city': {
      const dealCount = getDealCountForTreatmentAndCity(
        route.treatmentSlug,
        route.citySlug
      )
      const businessCount = getBusinessCountForCitySlug(route.citySlug)
      const minPrice = getMinPriceForTreatmentAndCity(
        route.treatmentSlug,
        route.citySlug
      )
      return generateTreatmentCityMetadata(
        route.treatmentName,
        route.treatmentSlug,
        route.cityName,
        route.citySlug,
        { dealCount, businessCount, minPrice }
      )
    }

    case 'deal': {
      const deal = getAnonymousDealById(route.dealId)
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
  const route = resolveRoute(slugs)

  switch (route.type) {
    case 'redirect':
      return <DealsRedirect />

    case 'city':
      return (
        <CityDealsPage citySlug={route.citySlug} cityName={route.cityName} />
      )

    case 'treatment-city':
      return (
        <TreatmentCityPage
          treatmentSlug={route.treatmentSlug}
          treatmentName={route.treatmentName}
          citySlug={route.citySlug}
          cityName={route.cityName}
        />
      )

    case 'deal':
      const deal = getAnonymousDealById(route.dealId)
      const fullDeal = getDealById(route.dealId)
      if (!deal || !fullDeal) {
        notFound()
      }
      return <DealDetailPage deal={deal} fullDeal={fullDeal} />

    case 'not-found':
    default:
      notFound()
  }
}
