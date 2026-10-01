import { cache } from 'react'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'
import type { OfferView } from '@/types/supabase'
import {
  businessToProvider,
  type ComparablePrice,
  comparablePrice,
  inferState,
  offerMembershipTerms,
  offerToAnonymousDeal,
  treatmentToDbCategories,
} from './adapters'
import { getBusinessCities, getBusinesses, getCityStates } from './businesses'
import { getCategoryBucket, getDbCategoriesFromSlug } from './categories'
import {
  getClinicConfirmations,
  getOffersByBusiness,
  getOffersWithBusinesses,
  isPubliclyVisible,
} from './offers'
import { floorPrice } from './typicalPrice'

export { getTreatmentLabel } from './adapters'

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

/**
 * Offers as the deals every consumer surface holds, each stamped with its clinic's confirmation
 * (getClinicConfirmations) — the rows' and the deal page's "Confirmed by the clinic". Every deal
 * this module returns comes through here, so no path can show a deal without asking.
 */
async function toDeals(offers: OfferView[]): Promise<AnonymousDeal[]> {
  const deals = offers.map(offerToAnonymousDeal)
  if (deals.length === 0) return deals
  const confirmed = await getClinicConfirmations()
  for (const deal of deals) {
    deal.clinicConfirmedAt = confirmed.get(Number(deal.id)) ?? null
  }
  return deals
}

export async function getActiveDeals(limit?: number) {
  const offers = await getOffersWithBusinesses(limit ? { limit } : undefined)
  return toDeals(offers)
}

export async function getDealsByCity(cityName: string) {
  const offers = await getOffersWithBusinesses({ city: cityName })
  return toDeals(offers)
}

export async function getDealsByCategory(category: TreatmentCategory) {
  const dbCategories = treatmentToDbCategories(category)
  if (dbCategories.length === 0) return []

  // One call with the whole array, not one per category. The category filter now resolves
  // through promo_offer_items -> clinic_services, so a per-category fan-out would pay for
  // that id resolution once per DB category (three of them for 'fillers') to assemble a set
  // flattenOffer already partitions.
  const offers = await getOffersWithBusinesses({
    serviceCategory: dbCategories,
  })
  return toDeals(offers)
}

/** One visible offer, or null. getOfferById is deliberately ungated (the business lead views
 * resolve delisted deals through it), so the consumer gate lives here. */
async function getVisibleOffer(id: string): Promise<OfferView | null> {
  const numericId = Number(id)
  if (Number.isNaN(numericId)) return null

  const { getOfferById } = await import('./offers')
  const offer = await getOfferById(numericId)
  return offer && isPubliclyVisible(offer) ? offer : null
}

/**
 * One deal, for the route resolver and for client components (the customer dashboard runs one
 * per claim and saved deal), so it stays one query. Its category knows the wording rule but not
 * the sibling one — see getDealWithBusinessId for the page that prints the badge.
 */
export async function getDealById(id: string) {
  const offer = await getVisibleOffer(id)
  return offer ? (await toDeals([offer]))[0] : null
}

/**
 * Fetch a deal by ID and include the business_id from the raw offer.
 * Used by the deal detail page to pass businessId to DealSidebar/ClaimCTA.
 */
export async function getDealWithBusinessId(id: string) {
  const visible = await getVisibleOffer(id)
  if (!visible) return null
  // Whether an offer is one clinic-wide discount copied per service can only be seen from its
  // business's other offers (blanketOfferIds in offers.ts), so the deal page's badge is read
  // from that set — the one the listings use.
  const offer =
    visible.business_id == null
      ? visible
      : ((await getOffersByBusiness(visible.business_id)).find(
          (o) => o.id === visible.id,
        ) ?? visible)

  const [anonymousDeal] = await toDeals([offer])
  return {
    ...anonymousDeal,
    businessId: offer.business_id ? String(offer.business_id) : '',
    // The plan's fee is deal-page only (owner decision, 2026-09-28): the caller takes it off
    // before the deal object goes anywhere else.
    membership: offerMembershipTerms(offer),
  }
}

export const getDealsForCitySlug = cache(async function getDealsForCitySlug(
  citySlug: string,
) {
  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []
  return getDealsByCity(cityName)
})

/**
 * Raw offers for a city, before the adapter flattens service_category into a treatment badge.
 * Callers deciding which treatment pages exist need the original column.
 */
export const getOffersForCitySlug = cache(async function getOffersForCitySlug(
  citySlug: string,
) {
  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []
  return getOffersWithBusinesses({ city: cityName })
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

    const offers = await getOffersWithBusinesses({
      serviceCategory: dbCategories,
      city: cityName,
    })
    return toDeals(offers)
  },
)

export async function getDealCountForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
) {
  const deals = await getDealsForTreatmentAndCity(category, citySlug)
  return deals.length
}

function cheapest(
  prices: Array<ComparablePrice | null>,
): ComparablePrice | null {
  let min: ComparablePrice | null = null
  for (const price of prices) {
    if (price && (!min || price.amount < min.amount)) min = price
  }
  return min
}

/**
 * The "from $X" a city's deals page advertises: what you pay, never a per-unit figure. A city
 * mixes categories, and Math.min over `dealPrice` let one $3.15 Dysport unit headline the whole
 * city — the price of nothing anyone buys. Neurotoxins compare only per unit, so they sit this
 * minimum out rather than dragging it down.
 */
export async function getMinPriceForCitySlug(
  citySlug: string,
): Promise<ComparablePrice | null> {
  const deals = await getDealsForCitySlug(citySlug)
  return cheapest(
    deals.map((deal) => comparablePrice(deal)).filter((p) => !p?.perUnit),
  )
}

/**
 * One treatment compares on one basis — per unit for botox, what you pay for everything else —
 * so every comparable deal competes. `perUnit` on the result says which; print it.
 *
 * On neurotoxins the result carries the brand it is a price of. A "Botox from $X" may only be
 * a Botox row's price, so when any Botox row is priced the minimum is taken over those alone;
 * otherwise it is the cheapest of any brand, and the caller must say "Neurotoxins" and name it.
 * Every "Botox from $3" title the site printed was a Dysport unit.
 */
export async function getMinPriceForTreatmentAndCity(
  category: TreatmentCategory,
  citySlug: string,
): Promise<(Omit<ComparablePrice, 'brand'> & { brand: string | null }) | null> {
  const deals = await getDealsForTreatmentAndCity(category, citySlug)
  if (category !== 'botox') {
    const min = cheapest(deals.map((deal) => comparablePrice(deal)))
    return min && { ...min, brand: null }
  }
  // comparablePrice() names the brand (neurotoxinBrand() of the title, then the words). A floor,
  // so never a "Starts at $9 per unit" (floorPrice(), the rule of every "from" on the site).
  const priced = deals.flatMap((deal) => {
    const price = floorPrice(comparablePrice(deal))
    return price ? [{ ...price, brand: price.brand ?? null }] : []
  })
  const botox = priced.filter((p) => p.brand === 'Botox')
  const pool = botox.length > 0 ? botox : priced
  return pool.reduce<(typeof pool)[number] | null>(
    (min, p) => (!min || p.amount < min.amount ? p : min),
    null,
  )
}

// ────────────────────────────────────────────────────────
// DB-category-slug queries
// ────────────────────────────────────────────────────────

export async function getDealsByDbCategorySlug(categorySlug: string) {
  const dbCategories = getDbCategoriesFromSlug(categorySlug)
  if (dbCategories.length === 0) return []

  const offers = await getOffersWithBusinesses({
    serviceCategory: dbCategories,
  })
  return toDeals(offers)
}

// ────────────────────────────────────────────────────────
// Category queries
// ────────────────────────────────────────────────────────

/**
 * The browse buckets with their deal and provider counts, counted over the same corpus and the
 * same resolved category the bucket pages list from — so a chip's count is the page's count.
 *
 * It used to come from the get_offer_category_counts() RPC, which applies its own SQL copy of
 * the category rule: "Other Services" said 55 deals on /treatments and 49 on the page it opened
 * (2026-09-23), and the RPC cannot see a clinic-wide offer (blanketOfferIds needs a clinic's
 * whole set). The RPC stays as the /api/health canary; nothing renders its numbers.
 * Provider counts union the id sets — a medspa listing both a Facial and a Laser deal is one
 * provider in "Facials & Lasers", not two.
 */
export async function getUnifiedCategories() {
  const offers = await getOffersWithBusinesses()

  const buckets = new Map<
    string,
    { slug: string; label: string; count: number; providerIds: Set<number> }
  >()

  for (const offer of offers) {
    const bucket = getCategoryBucket(offer.service_category)
    if (!bucket) continue
    const entry = buckets.get(bucket.slug) ?? {
      slug: bucket.slug,
      label: bucket.label,
      count: 0,
      providerIds: new Set<number>(),
    }
    entry.count++
    if (offer.business_id != null) entry.providerIds.add(offer.business_id)
    buckets.set(bucket.slug, entry)
  }

  return Array.from(buckets.values())
    .map(({ providerIds, ...bucket }) => ({
      ...bucket,
      providerCount: providerIds.size,
    }))
    .sort((a, b) => b.count - a.count)
}

// ────────────────────────────────────────────────────────
// City queries (from real business data)
// ────────────────────────────────────────────────────────

export const getUnifiedCities = cache(async function getUnifiedCities() {
  const [cities, cityStates] = await Promise.all([
    getBusinessCities(),
    getCityStates(),
  ])
  return cities
    .filter((c) => c.city?.trim())
    .map((c) => {
      // Derived from the businesses' own addresses; inferState's hand-maintained city map is the
      // fallback for the 28 rows whose address carries no state. A city that resolves neither gets
      // stateCode '' and is emitted as no page at all — tests/unit/cityStateCoverage.test.ts fails
      // the gate before that can happen to a city that has visible deals.
      const { state, stateCode } =
        cityStates[c.city.toLowerCase().trim()] ?? inferState(c.city)
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
 * Get deal counts per city.
 *
 * Counts every PUBLICLY VISIBLE offer, which since 2026-09-16 includes the ones that state a
 * discount but no price. It said "only priced deals" and that was the same filter as the listing,
 * so /pennsylvania/pittsburgh advertised 9 deals over a city with 22 — the count and the grid
 * agreed with each other and both disagreed with the database. See src/lib/data/offers.ts.
 * M1: Uses RPC for SQL-side aggregation (~20 rows vs entire offers+businesses dataset).
 */
export const getCityDealCounts = cache(async function getCityDealCounts() {
  // Aggregated in JS over the React-cached offer corpus rather than through the
  // get_city_deal_counts() RPC. The RPC counts every priced offer regardless of is_active or
  // campaign expiry, so with the visibility predicate now applied to browse it advertised
  // "35 deals in Tucson" over a city page that listed 22 — the site contradicting itself.
  // getOffersWithBusinesses() with no filters is React-cached, so the pages that show these
  // counts (/ and /deals) pay for one corpus fetch per request, not one per city.
  const [offers, cityStates] = await Promise.all([
    getOffersWithBusinesses(),
    getCityStates(),
  ])
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
      const { state, stateCode } =
        cityStates[city.toLowerCase().trim()] ?? inferState(city)
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

/**
 * The browse buckets a state's live deals fall in, most deals first — for the state page's
 * treatment links and FAQ, which used to list every bucket nationally ("Botox & Neurotoxins
 * treatments available" under "0 live deals") and to template "chemical peels and body
 * contouring" as popular in every state.
 */
export async function getStateCategoryCounts(stateCode: string) {
  const [counts, offers] = await Promise.all([
    getCityDealCounts(),
    getOffersWithBusinesses(),
  ])
  const cities = new Set(
    counts.filter((c) => c.stateCode === stateCode).map((c) => c.city),
  )
  const buckets = new Map<
    string,
    { slug: string; label: string; count: number }
  >()
  for (const offer of offers) {
    const city = offer.master_business_info?.city
    const bucket = getCategoryBucket(offer.service_category)
    if (!city || !cities.has(city) || !bucket) continue
    const entry = buckets.get(bucket.slug) ?? { ...bucket, count: 0 }
    entry.count++
    buckets.set(bucket.slug, entry)
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count)
}

export async function getCityOfferCount(cityName: string) {
  const offers = await getOffersWithBusinesses({ city: cityName })
  return offers.length
}

// ────────────────────────────────────────────────────────
// Business / Provider queries
// ────────────────────────────────────────────────────────

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

    if (error)
      logger.warn(
        'getBusinessCountForCity: RPC failed, falling back to full fetch',
        { city: cityName, code: error.code },
      )
    if (!error && data != null) {
      return Number(data)
    }

    // Fallback: fetch full objects and count
    const businesses = await getBusinesses(cityName)
    return businesses.length
  },
)

// ────────────────────────────────────────────────────────
// SSG: Get all valid city slugs from real data
// ────────────────────────────────────────────────────────

export async function getAllActiveCitySlugs() {
  const cities = await getBusinessCities()
  return cities.filter((c) => c.city?.trim()).map((c) => cityToSlug(c.city))
}
