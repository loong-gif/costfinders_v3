import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityDealsPage } from '@/components/features/deals/cityDealsPage'
import { DealDetailPage } from '@/components/features/deals/dealDetailPage'
import { DealsRedirect } from '@/components/features/deals/dealsRedirect'
import { TreatmentCityPage } from '@/components/features/deals/treatmentCityPage'
import {
  getBusinessCountForCity,
  getDealById,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getTreatmentLabel,
  getUnifiedCities,
} from '@/lib/data/unified'
import {
  generateCityDealsMetadata,
  generateTreatmentCityMetadata,
} from '@/lib/seo/metadata'
import type { TreatmentCategory } from '@/types/deal'

export const dynamic = 'force-dynamic'

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

async function resolveRoute(slugs?: string[]): Promise<RouteType> {
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
}

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

    case 'deal': {
      const deal = await getDealById(route.dealId)
      if (!deal) {
        notFound()
      }
      // Construct a Deal-compatible object for DealSidebar
      // The unified layer returns AnonymousDeal shape; add businessId for Deal type
      const fullDeal = {
        ...deal,
        businessId: route.dealId, // Supabase offer ID as reference
      }
      return <DealDetailPage deal={deal} fullDeal={fullDeal} />
    }
    default:
      notFound()
  }
}
