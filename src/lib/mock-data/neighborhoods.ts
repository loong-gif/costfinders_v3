import type { LocationArea } from '@/types/location'
import type { AnonymousDeal } from '@/types/deal'
import {
  getAreaById,
  getAreasForCity,
  getCityById,
} from './locations'
import { getStateBySlug, SUPPORTED_STATES } from './states'
import { getCityBySlug, slugifyNeighborhood, getAllCitiesWithState } from './cities'
import { deals, toAnonymousDeal } from './deals'
import { businesses } from './businesses'

/**
 * Get a neighborhood by state slug, city slug, and neighborhood slug
 * @param stateSlug - State URL slug (e.g., 'texas')
 * @param citySlug - City URL slug (e.g., 'austin')
 * @param neighborhoodSlug - Neighborhood URL slug (e.g., 'downtown-austin')
 * @returns LocationArea object if found, undefined otherwise
 */
export function getNeighborhoodBySlug(
  stateSlug: string,
  citySlug: string,
  neighborhoodSlug: string
): LocationArea | undefined {
  // Validate state exists
  const state = getStateBySlug(stateSlug)
  if (!state) return undefined

  // Validate city exists in state
  const city = getCityBySlug(stateSlug, citySlug)
  if (!city) return undefined

  // Find matching neighborhood in city
  const neighborhoods = getAreasForCity(city.id)
  return neighborhoods.find(
    (area) =>
      area.isActive !== false &&
      slugifyNeighborhood(area.name) === neighborhoodSlug
  )
}

/**
 * Get aggregated stats for a neighborhood
 * @param neighborhoodId - LocationArea ID (e.g., 'area-austin-downtown')
 * @returns Object with dealCount and businessCount
 */
export function getNeighborhoodStats(neighborhoodId: string): {
  dealCount: number
  businessCount: number
} {
  const neighborhood = getAreaById(neighborhoodId)
  if (!neighborhood) return { dealCount: 0, businessCount: 0 }

  // Find businesses in this neighborhood
  const neighborhoodBusinesses = businesses.filter(
    (b) => b.locationArea === neighborhood.name
  )

  const businessCount = neighborhoodBusinesses.length
  const businessIds = neighborhoodBusinesses.map((b) => b.id)

  // Find active deals for these businesses
  const neighborhoodDeals = deals.filter(
    (d) => businessIds.includes(d.businessId) && d.isActive
  )

  return {
    dealCount: neighborhoodDeals.length,
    businessCount,
  }
}

/**
 * Get all deals for a neighborhood as anonymous deals
 * @param neighborhoodId - LocationArea ID (e.g., 'area-austin-downtown')
 * @returns Array of AnonymousDeal objects
 */
export function getDealsForNeighborhood(neighborhoodId: string): AnonymousDeal[] {
  const neighborhood = getAreaById(neighborhoodId)
  if (!neighborhood) return []

  // Find businesses in this neighborhood
  const neighborhoodBusinesses = businesses.filter(
    (b) => b.locationArea === neighborhood.name
  )

  const businessIds = neighborhoodBusinesses.map((b) => b.id)

  // Find active deals for these businesses
  const neighborhoodDeals = deals.filter(
    (d) => businessIds.includes(d.businessId) && d.isActive
  )

  // Convert to anonymous deals
  return neighborhoodDeals.map(toAnonymousDeal)
}

/**
 * Get all neighborhoods with their city and state info for generateStaticParams
 * @returns Array of { neighborhood, city, state, slugs } objects
 */
export function getAllNeighborhoodsWithCityAndState(): Array<{
  neighborhood: LocationArea
  cityId: string
  cityName: string
  stateCode: string
  stateSlug: string
  citySlug: string
  neighborhoodSlug: string
}> {
  const result: Array<{
    neighborhood: LocationArea
    cityId: string
    cityName: string
    stateCode: string
    stateSlug: string
    citySlug: string
    neighborhoodSlug: string
  }> = []

  const citiesWithState = getAllCitiesWithState()

  for (const { city, stateCode, stateSlug, citySlug } of citiesWithState) {
    const neighborhoods = getAreasForCity(city.id)
    const activeNeighborhoods = neighborhoods.filter((n) => n.isActive !== false)

    for (const neighborhood of activeNeighborhoods) {
      result.push({
        neighborhood,
        cityId: city.id,
        cityName: city.name,
        stateCode,
        stateSlug,
        citySlug,
        neighborhoodSlug: slugifyNeighborhood(neighborhood.name),
      })
    }
  }

  return result
}
