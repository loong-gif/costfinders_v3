import type { City, LocationArea } from '@/types/location'
import {
  getCities,
  getCityById,
  getAreasForCity,
  getDealCountForCity,
  getBusinessCountForCity,
} from './locations'
import { getStateBySlug, slugifyCity, SUPPORTED_STATES } from './states'

/**
 * Get a city by state slug and city slug
 * @param stateSlug - State URL slug (e.g., 'texas')
 * @param citySlug - City URL slug (e.g., 'austin')
 * @returns City object if found, undefined otherwise
 */
export function getCityBySlug(
  stateSlug: string,
  citySlug: string
): City | undefined {
  const state = getStateBySlug(stateSlug)
  if (!state) return undefined

  const cities = getCities()
  return cities.find(
    (city) =>
      city.stateCode === state.code &&
      city.isActive &&
      slugifyCity(city.name) === citySlug
  )
}

/**
 * Get all neighborhoods for a city
 * @param cityId - City ID (e.g., 'city-austin')
 * @returns Array of active LocationAreas
 */
export function getNeighborhoodsForCity(cityId: string): LocationArea[] {
  const areas = getAreasForCity(cityId)
  return areas.filter((area) => area.isActive !== false)
}

/**
 * Get aggregated stats for a city
 * @param cityId - City ID (e.g., 'city-austin')
 * @returns Object with neighborhoodCount, dealCount, businessCount
 */
export function getCityStats(cityId: string): {
  neighborhoodCount: number
  dealCount: number
  businessCount: number
} {
  const neighborhoods = getNeighborhoodsForCity(cityId)
  const neighborhoodCount = neighborhoods.length
  const dealCount = getDealCountForCity(cityId)
  const businessCount = getBusinessCountForCity(cityId)

  return { neighborhoodCount, dealCount, businessCount }
}

/**
 * Convert a neighborhood name to a URL-safe slug
 * @param name - Neighborhood name (e.g., 'Downtown Austin')
 * @returns URL slug (e.g., 'downtown-austin')
 */
export function slugifyNeighborhood(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
}

/**
 * Get all cities with their state info for generateStaticParams
 * @returns Array of { city, state, stateSlug, citySlug } objects
 */
export function getAllCitiesWithState(): Array<{
  city: City
  stateCode: string
  stateSlug: string
  citySlug: string
}> {
  const allCities = getCities()
  const result: Array<{
    city: City
    stateCode: string
    stateSlug: string
    citySlug: string
  }> = []

  for (const state of SUPPORTED_STATES) {
    const stateCities = allCities.filter(
      (city) => city.stateCode === state.code && city.isActive
    )

    for (const city of stateCities) {
      result.push({
        city,
        stateCode: state.code,
        stateSlug: state.slug,
        citySlug: slugifyCity(city.name),
      })
    }
  }

  return result
}
