import type { Business } from '@/types/business'
import type { Claim, ClaimStatus } from '@/types/claim'
import type { AnonymousDeal, Deal, TreatmentCategory } from '@/types/deal'
import type { City, LocationArea } from '@/types/location'
import { businesses } from './businesses'
import { claims, consumers } from './consumers'
import { deals, toAnonymousDeal } from './deals'
import { cities, locationAreas, getCityBySlug, slugifyCity } from './locations'

// Deal queries
export function getActiveDeals(): AnonymousDeal[] {
  return deals.filter((d) => d.isActive).map(toAnonymousDeal)
}

export function getDealsByCategory(
  category: TreatmentCategory,
): AnonymousDeal[] {
  return deals
    .filter((d) => d.isActive && d.category === category)
    .map(toAnonymousDeal)
}

export function getDealsByCity(cityName: string): AnonymousDeal[] {
  const cityBusinessIds = businesses
    .filter((b) => b.city.toLowerCase() === cityName.toLowerCase())
    .map((b) => b.id)

  return deals
    .filter((d) => d.isActive && cityBusinessIds.includes(d.businessId))
    .map(toAnonymousDeal)
}

export function getFeaturedDeals(): AnonymousDeal[] {
  return deals.filter((d) => d.isActive && d.isFeatured).map(toAnonymousDeal)
}

export function getSponsoredDeals(): AnonymousDeal[] {
  return deals.filter((d) => d.isActive && d.isSponsored).map(toAnonymousDeal)
}

export function getDealById(id: string): Deal | undefined {
  return deals.find((d) => d.id === id)
}

export function getAnonymousDealById(id: string): AnonymousDeal | undefined {
  const deal = deals.find((d) => d.id === id)
  return deal ? toAnonymousDeal(deal) : undefined
}

// Business queries (only for revealed/logged-in views)
export function getBusinessById(id: string): Business | undefined {
  return businesses.find((b) => b.id === id)
}

export function getBusinessForDeal(dealId: string): Business | undefined {
  const deal = deals.find((d) => d.id === dealId)
  return deal ? businesses.find((b) => b.id === deal.businessId) : undefined
}

// Location queries
export function getActiveCities(): City[] {
  return cities.filter((c) => c.isActive)
}

export function getAreasForCity(cityId: string): LocationArea[] {
  return locationAreas.filter((a) => a.cityId === cityId)
}

export function getCityByName(name: string): City | undefined {
  return cities.find((c) => c.name.toLowerCase() === name.toLowerCase())
}

export function getCityById(id: string): City | undefined {
  return cities.find((c) => c.id === id)
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Find the nearest active city to given coordinates
 * Returns the first active city as fallback if no cities exist
 */
export function findNearestCity(lat: number, lng: number): City {
  const activeCities = getActiveCities()
  if (activeCities.length === 0) {
    return cities[0] // Fallback to first city even if inactive
  }

  let nearestCity = activeCities[0]
  let minDistance = haversineDistance(
    lat,
    lng,
    nearestCity.latitude,
    nearestCity.longitude,
  )

  for (let i = 1; i < activeCities.length; i++) {
    const city = activeCities[i]
    const distance = haversineDistance(lat, lng, city.latitude, city.longitude)
    if (distance < minDistance) {
      minDistance = distance
      nearestCity = city
    }
  }

  return nearestCity
}

/**
 * Default city to use when no location is available
 * Returns the first active city
 */
export const DEFAULT_CITY: City = cities.find((c) => c.isActive) || cities[0]

// Consumer queries
export function getConsumerById(id: string) {
  return consumers.find((c) => c.id === id)
}

// Claim queries
export function getClaimsByConsumer(consumerId: string): Claim[] {
  return claims.filter((c) => c.consumerId === consumerId)
}

export function getClaimsByStatus(status: ClaimStatus): Claim[] {
  return claims.filter((c) => c.status === status)
}

export function getClaimById(id: string): Claim | undefined {
  return claims.find((c) => c.id === id)
}

// Filter and sort helpers
export interface DealFilters {
  category?: TreatmentCategory
  city?: string
  minPrice?: number
  maxPrice?: number
  minDiscount?: number
}

export function filterDeals(filters: DealFilters): AnonymousDeal[] {
  let result = getActiveDeals()

  if (filters.category) {
    result = result.filter((d) => d.category === filters.category)
  }

  if (filters.city) {
    const cityBusinessIds = businesses
      .filter((b) => b.city.toLowerCase() === filters.city!.toLowerCase())
      .map((b) => b.id)
    result = result.filter((d) => {
      const deal = deals.find((dd) => dd.id === d.id)
      return deal && cityBusinessIds.includes(deal.businessId)
    })
  }

  if (filters.minPrice !== undefined) {
    result = result.filter((d) => d.dealPrice >= filters.minPrice!)
  }

  if (filters.maxPrice !== undefined) {
    result = result.filter((d) => d.dealPrice <= filters.maxPrice!)
  }

  if (filters.minDiscount !== undefined) {
    result = result.filter((d) => d.discountPercent >= filters.minDiscount!)
  }

  return result
}

export type SortOption =
  | 'price-asc'
  | 'price-desc'
  | 'discount'
  | 'popular'
  | 'newest'

export function sortDeals(
  dealsToSort: AnonymousDeal[],
  sortBy: SortOption,
): AnonymousDeal[] {
  const sorted = [...dealsToSort]

  switch (sortBy) {
    case 'price-asc':
      return sorted.sort((a, b) => a.dealPrice - b.dealPrice)
    case 'price-desc':
      return sorted.sort((a, b) => b.dealPrice - a.dealPrice)
    case 'discount':
      return sorted.sort((a, b) => b.discountPercent - a.discountPercent)
    case 'popular':
      return sorted.sort((a, b) => b.claimCount - a.claimCount)
    case 'newest':
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    default:
      return sorted
  }
}

// SEO Page Queries

/**
 * Get deals for a city by URL slug
 * Used by /deals/[city] pages
 */
export function getDealsForCitySlug(citySlug: string): AnonymousDeal[] {
  const city = getCityBySlug(citySlug)
  if (!city) return []

  const cityBusinessIds = businesses
    .filter((b) => b.city.toLowerCase() === city.name.toLowerCase())
    .map((b) => b.id)

  return deals
    .filter((d) => d.isActive && cityBusinessIds.includes(d.businessId))
    .map(toAnonymousDeal)
}

/**
 * Get deals filtered by both treatment category AND city slug
 * Used by /deals/[treatment]/[city] pages
 */
export function getDealsForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
): AnonymousDeal[] {
  const city = getCityBySlug(citySlug)
  if (!city) return []

  const cityBusinessIds = businesses
    .filter((b) => b.city.toLowerCase() === city.name.toLowerCase())
    .map((b) => b.id)

  return deals
    .filter(
      (d) =>
        d.isActive &&
        d.category === category &&
        cityBusinessIds.includes(d.businessId),
    )
    .map(toAnonymousDeal)
}

/**
 * Get deal count for a city by slug
 * Used for SEO metadata
 */
export function getDealCountForCitySlug(citySlug: string): number {
  return getDealsForCitySlug(citySlug).length
}

/**
 * Get deal count for treatment+city combo
 * Used for SEO metadata
 */
export function getDealCountForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
): number {
  return getDealsForTreatmentAndCity(category, citySlug).length
}

/**
 * Get min deal price for a city
 * Used for SEO metadata
 */
export function getMinPriceForCitySlug(citySlug: string): number | undefined {
  const cityDeals = getDealsForCitySlug(citySlug)
  if (cityDeals.length === 0) return undefined
  return Math.min(...cityDeals.map((d) => d.dealPrice))
}

/**
 * Get min deal price for treatment+city
 * Used for SEO metadata
 */
export function getMinPriceForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
): number | undefined {
  const cityDeals = getDealsForTreatmentAndCity(category, citySlug)
  if (cityDeals.length === 0) return undefined
  return Math.min(...cityDeals.map((d) => d.dealPrice))
}

/**
 * Get business count for a city
 * Used for SEO metadata and page stats
 */
export function getBusinessCountForCitySlug(citySlug: string): number {
  const city = getCityBySlug(citySlug)
  if (!city) return 0

  return businesses.filter(
    (b) => b.city.toLowerCase() === city.name.toLowerCase(),
  ).length
}
