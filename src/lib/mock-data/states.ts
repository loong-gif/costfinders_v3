import {
  getBusinessCountForCity,
  getCities,
  getDealCountForCity,
} from './locations'

// State data structure
export interface StateInfo {
  name: string
  slug: string
  code: string
}

// Supported states for SEO landing pages
export const SUPPORTED_STATES: StateInfo[] = [
  { name: 'California', slug: 'california', code: 'CA' },
  { name: 'Texas', slug: 'texas', code: 'TX' },
  { name: 'New York', slug: 'new-york', code: 'NY' },
  { name: 'Florida', slug: 'florida', code: 'FL' },
]

/**
 * Get all supported states
 */
export function getStates(): StateInfo[] {
  return [...SUPPORTED_STATES]
}

/**
 * Find a state by its URL slug
 * @param slug - URL slug (e.g., 'california', 'new-york')
 */
export function getStateBySlug(slug: string): StateInfo | undefined {
  return SUPPORTED_STATES.find((state) => state.slug === slug)
}

/**
 * Get all active cities for a given state code
 * @param stateCode - State code (e.g., 'CA', 'TX')
 */
export function getCitiesForState(stateCode: string) {
  const cities = getCities()
  return cities.filter(
    (city) => city.stateCode === stateCode && city.isActive === true,
  )
}

/**
 * Get aggregated stats for a state
 * @param stateCode - State code (e.g., 'CA', 'TX')
 */
export function getStateStats(stateCode: string) {
  const cities = getCitiesForState(stateCode)

  const cityCount = cities.length
  const dealCount = cities.reduce(
    (sum, city) => sum + getDealCountForCity(city.id),
    0,
  )
  const businessCount = cities.reduce(
    (sum, city) => sum + getBusinessCountForCity(city.id),
    0,
  )

  return { cityCount, dealCount, businessCount }
}

/**
 * Convert a city name to a URL-safe slug
 * @param cityName - City name (e.g., 'Los Angeles')
 * @returns URL slug (e.g., 'los-angeles')
 */
export function slugifyCity(cityName: string): string {
  return cityName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
}
