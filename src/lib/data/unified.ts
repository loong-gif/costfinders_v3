import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import type { TreatmentCategory } from '@/types/deal'
import {
  businessToProvider,
  dbCategoryToTreatment,
  inferState,
  offerToAnonymousDeal,
  treatmentToDbCategories,
} from './adapters'
import { getBusinessById, getBusinessCities, getBusinesses } from './businesses'
import {
  getCategoryLabel,
  getCategorySlug,
  getDbCategoryFromSlug,
} from './categories'
import {
  getOfferCategories,
  getOffersByBusiness,
  getOffersWithBusinesses,
} from './offers'

// ────────────────────────────────────────────────────────
// Slug utilities (single source of truth)
// ────────────────────────────────────────────────────────

/** Convert a city name to a URL slug: "Oklahoma City" → "oklahoma-city" */
export function cityToSlug(cityName: string): string {
  return cityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Resolve a city slug back to the exact DB city name.
 * Uses ilike query to handle case differences.
 * Returns null if no matching city found.
 */
export const getCityNameFromSlug = cache(async function getCityNameFromSlug(
  slug: string,
): Promise<string | null> {
  const cities = await getBusinessCities()
  const match = cities.find((c) => c.city && cityToSlug(c.city) === slug)
  return match?.city ?? null
})

// ────────────────────────────────────────────────────────
// Deal / Offer queries (replaces mock-data/utils.ts)
// ────────────────────────────────────────────────────────

export async function getActiveDeals(limit?: number) {
  const offers = await getOffersWithBusinesses(limit ? { limit } : undefined)
  return offers.map(offerToAnonymousDeal)
}

export async function getDealsByCity(cityName: string) {
  const offers = await getOffersWithBusinesses({ city: cityName })
  return offers.map(offerToAnonymousDeal)
}

export async function getDealsByCategory(category: TreatmentCategory) {
  const dbCategories = treatmentToDbCategories(category)
  if (dbCategories.length === 0) return []

  const results = await Promise.all(
    dbCategories.map((dbCat) =>
      getOffersWithBusinesses({ serviceCategory: dbCat }),
    ),
  )
  return results.flat().map(offerToAnonymousDeal)
}

export async function getDealById(id: string) {
  const numericId = Number(id)
  if (Number.isNaN(numericId)) return null

  const { getOfferById } = await import('./offers')
  const offer = await getOfferById(numericId)
  return offer ? offerToAnonymousDeal(offer) : null
}

/**
 * Fetch a deal by ID and include the business_id from the raw offer.
 * Used by the deal detail page to pass businessId to DealSidebar/ClaimCTA.
 */
export async function getDealWithBusinessId(id: string) {
  const numericId = Number(id)
  if (Number.isNaN(numericId)) return null

  const { getOfferById } = await import('./offers')
  const offer = await getOfferById(numericId)
  if (!offer) return null

  const anonymousDeal = offerToAnonymousDeal(offer)
  return {
    ...anonymousDeal,
    businessId: offer.business_id ? String(offer.business_id) : '',
  }
}

export const getDealsForCitySlug = cache(async function getDealsForCitySlug(
  citySlug: string,
) {
  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []
  return getDealsByCity(cityName)
})

export async function getDealCountForCitySlug(citySlug: string) {
  const deals = await getDealsForCitySlug(citySlug)
  return deals.length
}

export const getDealsForTreatmentAndCity = cache(
  async function getDealsForTreatmentAndCity(
    category: TreatmentCategory,
    citySlug: string,
  ) {
    const dbCategories = treatmentToDbCategories(category)
    if (dbCategories.length === 0) return []

    const cityName = await getCityNameFromSlug(citySlug)
    if (!cityName) return []

    const results = await Promise.all(
      dbCategories.map((dbCat) =>
        getOffersWithBusinesses({ serviceCategory: dbCat, city: cityName }),
      ),
    )
    return results.flat().map(offerToAnonymousDeal)
  },
)

export async function getDealCountForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
) {
  const deals = await getDealsForTreatmentAndCity(category, citySlug)
  return deals.length
}

export async function getMinPriceForCitySlug(
  citySlug: string,
): Promise<number | null> {
  const deals = await getDealsForCitySlug(citySlug)
  if (deals.length === 0) return null
  const prices = deals.map((d) => d.dealPrice).filter((p) => p > 0)
  return prices.length > 0 ? Math.min(...prices) : null
}

export async function getMinPriceForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
): Promise<number | null> {
  const deals = await getDealsForTreatmentAndCity(category, citySlug)
  if (deals.length === 0) return null
  const prices = deals.map((d) => d.dealPrice).filter((p) => p > 0)
  return prices.length > 0 ? Math.min(...prices) : null
}

/** Map TreatmentCategory slugs to user-friendly labels */
const TREATMENT_LABELS: Record<TreatmentCategory, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

export function getTreatmentLabel(slug: TreatmentCategory): string {
  return TREATMENT_LABELS[slug] ?? slug
}

// ────────────────────────────────────────────────────────
// DB-category-slug queries
// ────────────────────────────────────────────────────────

export async function getDealsForDbCategoryAndCity(
  categorySlug: string,
  citySlug: string,
) {
  const dbCategory = getDbCategoryFromSlug(categorySlug)
  if (!dbCategory) return []

  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []

  const offers = await getOffersWithBusinesses({
    serviceCategory: dbCategory,
    city: cityName,
  })
  return offers.map(offerToAnonymousDeal)
}

export async function getDealCountForDbCategoryAndCity(
  categorySlug: string,
  citySlug: string,
) {
  const deals = await getDealsForDbCategoryAndCity(categorySlug, citySlug)
  return deals.length
}

export async function getMinPriceForDbCategoryAndCity(
  categorySlug: string,
  citySlug: string,
): Promise<number | null> {
  const deals = await getDealsForDbCategoryAndCity(categorySlug, citySlug)
  if (deals.length === 0) return null
  const prices = deals.map((d) => d.dealPrice).filter((p) => p > 0)
  return prices.length > 0 ? Math.min(...prices) : null
}

export async function getDealsByDbCategorySlug(categorySlug: string) {
  const dbCategory = getDbCategoryFromSlug(categorySlug)
  if (!dbCategory) return []

  const offers = await getOffersWithBusinesses({ serviceCategory: dbCategory })
  return offers.map(offerToAnonymousDeal)
}

// ────────────────────────────────────────────────────────
// Category queries
// ────────────────────────────────────────────────────────

export async function getUnifiedCategories() {
  const raw = await getOfferCategories()
  return raw.map((c) => ({
    slug: getCategorySlug(c.service_category),
    label: getCategoryLabel(c.service_category),
    dbCategory: c.service_category,
    count: c.count,
  }))
}

// ────────────────────────────────────────────────────────
// City queries (from real business data)
// ────────────────────────────────────────────────────────

export const getUnifiedCities = cache(async function getUnifiedCities() {
  const cities = await getBusinessCities()
  return cities
    .filter((c) => c.city?.trim())
    .map((c) => {
      const { state, stateCode } = inferState(c.city)
      return {
        name: c.city,
        slug: cityToSlug(c.city),
        state,
        stateCode,
        businessCount: c.count,
      }
    })
})

/**
 * Get deal counts per city (only priced deals).
 * M1: Uses RPC for SQL-side aggregation (~20 rows vs entire offers+businesses dataset).
 */
export const getCityDealCounts = cache(async function getCityDealCounts() {
  // Try RPC first (returns ~20 rows instead of 347+ with joins)
  const { data, error } = await supabase.rpc('get_city_deal_counts')

  if (!error && data) {
    return (
      data as { city: string; deal_count: number; provider_count: number }[]
    ).map((row) => {
      const { state, stateCode } = inferState(row.city)
      return {
        city: row.city,
        slug: cityToSlug(row.city),
        state,
        stateCode,
        dealCount: Number(row.deal_count),
        providerCount: Number(row.provider_count),
      }
    })
  }

  // Fallback: JS-side aggregation if RPC doesn't exist
  const offers = await getOffersWithBusinesses()
  const cityMap = new Map<
    string,
    { dealCount: number; providerIds: Set<number> }
  >()

  for (const offer of offers) {
    const city = offer.master_business_info?.city
    if (!city?.trim()) continue

    const entry = cityMap.get(city) ?? { dealCount: 0, providerIds: new Set() }
    entry.dealCount++
    if (offer.business_id) entry.providerIds.add(offer.business_id)
    cityMap.set(city, entry)
  }

  return Array.from(cityMap.entries())
    .map(([city, cityData]) => {
      const { state, stateCode } = inferState(city)
      return {
        city,
        slug: cityToSlug(city),
        state,
        stateCode,
        dealCount: cityData.dealCount,
        providerCount: cityData.providerIds.size,
      }
    })
    .sort((a, b) => b.dealCount - a.dealCount)
})

export async function getCityOfferCount(cityName: string) {
  const offers = await getOffersWithBusinesses({ city: cityName })
  return offers.length
}

// ────────────────────────────────────────────────────────
// Business / Provider queries
// ────────────────────────────────────────────────────────

export async function getProviderById(id: number) {
  const biz = await getBusinessById(id)
  return biz ? businessToProvider(biz) : null
}

export async function getProvidersByCity(city: string) {
  const businesses = await getBusinesses(city)
  return businesses.map(businessToProvider)
}

export const getBusinessCountForCity = cache(
  async function getBusinessCountForCity(cityName: string) {
    // M1: Use RPC to get count without fetching full business objects
    const { data, error } = await supabase.rpc('get_business_count_for_city', {
      city_name: cityName,
    })

    if (!error && data != null) {
      return Number(data)
    }

    // Fallback: fetch full objects and count
    const businesses = await getBusinesses(cityName)
    return businesses.length
  },
)

/** Get deals for a specific business by its Supabase ID */
export async function getDealsForBusiness(businessId: number) {
  const offers = await getOffersByBusiness(businessId)
  // getOffersByBusiness returns Offer[], not OfferWithBusiness[]
  // We need to fetch the business separately for the adapter
  const biz = await getBusinessById(businessId)
  return offers.map((offer) =>
    offerToAnonymousDeal({
      ...offer,
      master_business_info: biz
        ? {
            business_id: biz.business_id,
            name: biz.name,
            address: biz.address,
            city: biz.city,
            score: biz.score,
            review_count: biz.review_count,
            category: biz.category,
            website: biz.website ?? biz.website_clean ?? null,
          }
        : null,
    }),
  )
}

// ────────────────────────────────────────────────────────
// SSG: Get all valid city slugs from real data
// ────────────────────────────────────────────────────────

export async function getAllActiveCitySlugs() {
  const cities = await getBusinessCities()
  return cities.filter((c) => c.city?.trim()).map((c) => cityToSlug(c.city))
}

export async function getAllTreatmentCityCombos() {
  const categories = await getOfferCategories()
  const cities = await getBusinessCities()

  const treatmentSlugs = new Set<TreatmentCategory>()
  for (const cat of categories) {
    treatmentSlugs.add(dbCategoryToTreatment(cat.service_category))
  }

  const combos: { treatment: string; city: string }[] = []
  for (const treatment of treatmentSlugs) {
    for (const c of cities) {
      if (!c.city?.trim()) continue
      combos.push({ treatment, city: cityToSlug(c.city) })
    }
  }
  return combos
}
