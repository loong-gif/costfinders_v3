import type { Business } from '@/types/business'
import type { AnonymousDeal } from '@/types/deal'
import { businesses } from './businesses'
import { getCityBySlug } from './cities'
import { deals, toAnonymousDeal } from './deals'
import { getStateBySlug, SUPPORTED_STATES, slugifyCity } from './states'

/**
 * Get a provider by its slug within a specific state and city context.
 * Validates the full chain: state → city → provider.
 */
export function getProviderBySlug(
  stateSlug: string,
  citySlug: string,
  providerSlug: string,
): Business | undefined {
  // Validate state exists
  const state = getStateBySlug(stateSlug)
  if (!state) return undefined

  // Validate city exists in this state
  const city = getCityBySlug(stateSlug, citySlug)
  if (!city) return undefined

  // Find business with matching slug in this city and state
  return businesses.find(
    (business) =>
      business.slug === providerSlug &&
      slugifyCity(business.city) === citySlug &&
      business.state === state.code,
  )
}

/**
 * Get all active deals for a specific provider/business.
 * Returns anonymous deals (business details hidden until user commits).
 */
export function getDealsForProvider(businessId: string): AnonymousDeal[] {
  return deals
    .filter((deal) => deal.businessId === businessId && deal.isActive)
    .map(toAnonymousDeal)
}

/**
 * Get all providers with their city and state context for SSG.
 * Used by generateStaticParams to create all provider pages.
 */
export function getAllProvidersWithCityAndState(): Array<{
  business: Business
  stateSlug: string
  citySlug: string
}> {
  const result: Array<{
    business: Business
    stateSlug: string
    citySlug: string
  }> = []

  for (const business of businesses) {
    // Find the state for this business
    const state = SUPPORTED_STATES.find((s) => s.code === business.state)
    if (!state) continue

    // Build the city slug
    const citySlug = slugifyCity(business.city)

    result.push({
      business,
      stateSlug: state.slug,
      citySlug,
    })
  }

  return result
}

/**
 * Get provider stats for display.
 */
export function getProviderStats(businessId: string): {
  dealCount: number
  activeDealCount: number
} {
  const allDeals = deals.filter((deal) => deal.businessId === businessId)
  const activeDeals = allDeals.filter((deal) => deal.isActive)

  return {
    dealCount: allDeals.length,
    activeDealCount: activeDeals.length,
  }
}
