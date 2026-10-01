import { US_STATE_NAMES } from '@/lib/data/adapters'
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

/**
 * The state VOCABULARY — every code a business address can resolve to, not the set of states that
 * have pages.
 *
 * This was a hand-written four (AZ, CA, CO, OK) and that was the second half of a silent failure.
 * `generateStaticParams` for `/[state]/[city]` does `states.find(s => s.code === city.stateCode)`
 * and pushes nothing when that returns undefined, so on 2026-09-16 there were 104 visible deals
 * across 14 states — PA 22, GA 23, TX 22, TN 8, FL 7, OR, KS, VA, IL, OH, LA, NE, ND, NY — that
 * could not be reached from any URL on the site. A curated list plus a silent `find` is a page that
 * vanishes without an error, twice over: once in CITY_STATE_MAP and once here.
 *
 * Derived from `US_STATE_NAMES` so it cannot fall behind the data again. It does NOT mean 51 state
 * pages ship: `/[state]`'s generateStaticParams and `sitemap.ts` both intersect this with the
 * states that actually have cities, so an empty state gets no page and 404s under
 * `dynamicParams = false`.
 */
export const SUPPORTED_STATES: StateInfo[] = Object.entries(US_STATE_NAMES)
  .map(([code, name]) => ({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

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
