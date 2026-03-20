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
  getOffers,
  getOffersWithBusinesses,
} from './offers'

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

  // Query each DB category and merge results
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

  const offers = await getOffersWithBusinesses()
  const match = offers.find((o) => o.id === numericId)
  return match ? offerToAnonymousDeal(match) : null
}

export async function getDealsForCitySlug(citySlug: string) {
  // Convert slug back to city name (e.g., "oklahoma-city" → "Oklahoma City")
  const cityName = citySlug.replace(/-/g, ' ')
  return getDealsByCity(cityName)
}

export async function getDealCountForCitySlug(citySlug: string) {
  const deals = await getDealsForCitySlug(citySlug)
  return deals.length
}

export async function getDealsForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
) {
  const dbCategories = treatmentToDbCategories(category)
  if (dbCategories.length === 0) return []

  const cityName = citySlug.replace(/-/g, ' ')
  const results = await Promise.all(
    dbCategories.map((dbCat) =>
      getOffersWithBusinesses({ serviceCategory: dbCat, city: cityName }),
    ),
  )
  return results.flat().map(offerToAnonymousDeal)
}

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
// DB-category-slug queries (for URL slugs from getAllTreatmentCityCombos)
// These accept the slug from CATEGORY_MAP (e.g. "neurotoxins", "facials-lasers")
// rather than the TreatmentCategory enum (e.g. "botox", "facials")
// ────────────────────────────────────────────────────────

export async function getDealsForDbCategoryAndCity(
  categorySlug: string,
  citySlug: string,
) {
  const dbCategory = getDbCategoryFromSlug(categorySlug)
  if (!dbCategory) return []

  const cityName = citySlug.replace(/-/g, ' ')
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

export async function getUnifiedCities() {
  const cities = await getBusinessCities()
  return cities.map((c) => {
    const { state, stateCode } = inferState(c.city)
    const slug = c.city
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    return {
      name: c.city,
      slug,
      state,
      stateCode,
      businessCount: c.count,
    }
  })
}

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

export async function getBusinessCountForCity(cityName: string) {
  const businesses = await getBusinesses(cityName)
  return businesses.length
}

// ────────────────────────────────────────────────────────
// SSG: Get all valid city slugs from real data
// ────────────────────────────────────────────────────────

export async function getAllActiveCitySlugs() {
  const cities = await getBusinessCities()
  return cities.map((c) =>
    c.city
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
  )
}

export async function getAllTreatmentCityCombos() {
  const categories = await getOfferCategories()
  const cities = await getBusinessCities()

  // Deduplicate: multiple DB categories can map to the same TreatmentCategory
  const treatmentSlugs = new Set<TreatmentCategory>()
  for (const cat of categories) {
    treatmentSlugs.add(dbCategoryToTreatment(cat.service_category))
  }

  const combos: { treatment: string; city: string }[] = []
  for (const treatment of treatmentSlugs) {
    for (const c of cities) {
      const citySlug = c.city
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      combos.push({ treatment, city: citySlug })
    }
  }
  return combos
}
