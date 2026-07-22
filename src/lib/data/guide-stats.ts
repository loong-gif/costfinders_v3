import type { TreatmentCategory } from '@/types/deal'
import type { GuidePricingStats } from '@/types/guide'
import { offerToAnonymousDeal, treatmentToDbCategories } from './adapters'
import { getOffersWithBusinesses } from './offers'
import { getCityNameFromSlug } from './unified'

/**
 * Compute detailed pricing statistics for a treatment+city combination.
 * Used by guide pages to display real-time pricing data from Supabase.
 */
export async function getGuidePricingStats(
  treatment: TreatmentCategory,
  citySlug: string,
): Promise<GuidePricingStats> {
  const dbCategories = treatmentToDbCategories(treatment)
  if (dbCategories.length === 0) return emptyStats()

  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return emptyStats()

  const allOffers = await Promise.all(
    dbCategories.map((dbCat) =>
      getOffersWithBusinesses({ serviceCategory: dbCat, city: cityName }),
    ),
  )
  const offers = allOffers.flat()

  if (offers.length === 0) return emptyStats()

  // Collect prices (prefer discount_price, fall back to original_price)
  const prices = offers
    .map((o) => o.discount_price ?? o.original_price ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b)

  // Unique providers
  const providerIds = new Set(offers.map((o) => o.business_id).filter(Boolean))

  // Template type breakdown
  const templateMap = new Map<string, { prices: number[]; count: number }>()
  for (const offer of offers) {
    const tt = offer.template_type ?? 'OTHER'
    const entry = templateMap.get(tt) ?? { prices: [], count: 0 }
    entry.count++
    const price = offer.discount_price ?? offer.original_price ?? 0
    if (price > 0) entry.prices.push(price)
    templateMap.set(tt, entry)
  }

  // Unit type breakdown
  const unitMap = new Map<string, { prices: number[]; count: number }>()
  for (const offer of offers) {
    const ut = offer.unit_type ?? 'unspecified'
    const entry = unitMap.get(ut) ?? { prices: [], count: 0 }
    entry.count++
    const price = offer.discount_price ?? offer.original_price ?? 0
    if (price > 0) entry.prices.push(price)
    unitMap.set(ut, entry)
  }

  return {
    dealCount: offers.length,
    providerCount: providerIds.size,
    minPrice: prices.length > 0 ? prices[0] : null,
    maxPrice: prices.length > 0 ? prices[prices.length - 1] : null,
    avgPrice: prices.length > 0 ? Math.round(avg(prices)) : null,
    medianPrice: prices.length > 0 ? Math.round(median(prices)) : null,
    byTemplateType: Array.from(templateMap.entries()).map(
      ([templateType, data]) => ({
        templateType,
        count: data.count,
        avgPrice: data.prices.length > 0 ? Math.round(avg(data.prices)) : null,
        minPrice: data.prices.length > 0 ? Math.min(...data.prices) : null,
        maxPrice: data.prices.length > 0 ? Math.max(...data.prices) : null,
      }),
    ),
    byUnitType: Array.from(unitMap.entries()).map(([unitType, data]) => ({
      unitType,
      count: data.count,
      avgPrice: data.prices.length > 0 ? Math.round(avg(data.prices)) : null,
    })),
  }
}

/**
 * Get top deals by savings for the "How to Save" section.
 * Returns deals sorted by discount percentage (highest first).
 */
export async function getGuideDealsPreview(
  treatment: TreatmentCategory,
  citySlug: string,
  limit = 3,
) {
  const dbCategories = treatmentToDbCategories(treatment)
  if (dbCategories.length === 0) return []

  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []

  const allOffers = await Promise.all(
    dbCategories.map((dbCat) =>
      getOffersWithBusinesses({ serviceCategory: dbCat, city: cityName }),
    ),
  )
  const offers = allOffers.flat()

  // Sort by savings percentage (highest first)
  const withSavings = offers
    .filter(
      (o) =>
        o.discount_price != null &&
        o.original_price != null &&
        o.discount_price > 0 &&
        o.original_price > o.discount_price,
    )
    .sort((a, b) => {
      const savingsA =
        ((a.original_price! - a.discount_price!) / a.original_price!) * 100
      const savingsB =
        ((b.original_price! - b.discount_price!) / b.original_price!) * 100
      return savingsB - savingsA
    })

  return withSavings.slice(0, limit).map(offerToAnonymousDeal)
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function emptyStats(): GuidePricingStats {
  return {
    dealCount: 0,
    providerCount: 0,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    medianPrice: null,
    byTemplateType: [],
    byUnitType: [],
  }
}
