import { cache } from 'react'
import type { ComparablePrice, TreatmentCategory } from '@/types/deal'
import type {
  GuideIndexStat,
  GuidePricingStats,
  GuideSummary,
} from '@/types/guide'
import type { OfferView } from '@/types/supabase'
import {
  comparablePrice,
  dbCategoryToTreatment,
  inferState,
  offerToAnonymousDeal,
  treatmentToDbCategories,
} from './adapters'
import { getCityStates } from './businesses'
import { GUIDE_TREATMENT_LABELS, type GuideTreatment } from './guide-content'
import { getOffersWithBusinesses } from './offers'
import {
  computeGuidePricingStats,
  floorPrice,
  pooledPrice,
  TYPICAL_TREATMENTS,
  typicalPrices,
} from './typicalPrice'
import { cityToSlug, getCityNameFromSlug } from './unified'

// The pure statistics moved to typicalPrice.ts, which the browser imports (vs-typical on the
// browse rows) and this module, reading guide files from disk, cannot be. Same names here.
export {
  computeGuidePricingStats,
  median,
  normalizeServiceName,
} from './typicalPrice'

/**
 * The offers behind one guide, fetched once per request.
 *
 * Rendering a guide asks for this same set three times — generateMetadata calls
 * getGuidePricingStats, the page calls it again, and getGuideDealsPreview needs the same rows.
 * Only the no-filter path in offers.ts is React-cached, so all three went to Supabase. Cached
 * here on primitive arguments, which is what React's cache can actually key on.
 */
const getGuideOffers = cache(async function getGuideOffers(
  treatment: TreatmentCategory,
  citySlug: string,
) {
  const dbCategories = treatmentToDbCategories(treatment)
  if (dbCategories.length === 0) return []

  const cityName = await getCityNameFromSlug(citySlug)
  if (!cityName) return []

  return getOffersWithBusinesses({
    serviceCategory: dbCategories,
    city: cityName,
  })
})

/**
 * Compute detailed pricing statistics for a treatment+city combination.
 * Used by guide pages to display real-time pricing data from Supabase.
 */
export const getGuidePricingStats = cache(async function getGuidePricingStats(
  treatment: TreatmentCategory,
  citySlug: string,
): Promise<GuidePricingStats> {
  const offers = await getGuideOffers(treatment, citySlug)
  return publishedGuideStats(
    treatment,
    offers,
    computeGuidePricingStats(treatment, offers),
  )
})

/** Below this many priced deals a market has no cost to write — or print — a guide about. */
export const GUIDE_MIN_PRICED_DEALS = 3

/**
 * The market figures a guide page may print (owner: "be consistent", 2026-09-28): its median,
 * range and average, which the stat cards, the page's meta description, its structured data and
 * the homepage guides row all read. A neurotoxin guide prints them only where the deals pages
 * print a typical price (typicalPrices(): >= 5 pooled prices from >= 3 clinics); every other
 * guide only past GUIDE_MIN_PRICED_DEALS priced deals from GUIDE_MIN_PROVIDERS clinics. Below
 * that, "Typical price $8 per unit" was one deal (Santa Ana, 2026-09-28) over prose that says
 * too few clinics publish a price. The floor ("Starting at") and the counts always stay: the
 * cheapest listing is a fact at any sample size.
 */
export function publishedGuideStats(
  treatment: TreatmentCategory,
  offers: OfferView[],
  stats: GuidePricingStats,
): GuidePricingStats {
  const market = TYPICAL_TREATMENTS.has(treatment)
    ? typicalPrices(offers)[treatment] != null
    : stats.pricedDealCount >= GUIDE_MIN_PRICED_DEALS &&
      new Set(
        offers
          .filter((o) => pooledPrice(comparablePrice(offerToAnonymousDeal(o))))
          .map((o) => o.business_id),
      ).size >= GUIDE_MIN_PROVIDERS
  return market
    ? stats
    : {
        ...stats,
        minPrice: null,
        minBrand: null,
        medianPrice: null,
        maxPrice: null,
        avgPrice: null,
        // The cost table's per-product low / midpoint / high is the same statistic one level
        // down: Irvine laser printed "midpoint $149" over 15 deals from one clinic.
        byService: [],
        byUnitType: [],
      }
}

/**
 * Live counts for every guide at once, keyed by guide slug.
 *
 * One unfiltered offers fetch (React-cached) aggregated in JS, rather than two Supabase
 * round-trips per guide. At 30+ guides the per-guide version would be 60+ sequential-ish
 * queries to render one index page.
 */
export async function getGuideIndexStats(
  guides: GuideSummary[],
): Promise<Map<string, GuideIndexStat>> {
  const offers = await getOffersWithBusinesses()

  const buckets = new Map<
    string,
    {
      dealCount: number
      providerIds: Set<number>
      floor: ComparablePrice | null
    }
  >()
  for (const offer of offers) {
    const city = offer.master_business_info?.city
    if (!city?.trim()) continue
    const key = `${dbCategoryToTreatment(offer.service_category)}|${cityToSlug(city)}`
    const entry = buckets.get(key) ?? {
      dealCount: 0,
      providerIds: new Set<number>(),
      floor: null,
    }
    entry.dealCount++
    if (offer.business_id) entry.providerIds.add(offer.business_id)
    // The floor getGuidePricingStats computes, so a hub card's "from $X" is the guide's own
    // "Starting at" and the deals page's "from": per unit on a Botox guide, never a $79 lip flip,
    // any brand (a Dysport unit is named, not hidden).
    const price = floorPrice(comparablePrice(offerToAnonymousDeal(offer)))
    if (price && (!entry.floor || price.amount < entry.floor.amount)) {
      entry.floor = price
    }
    buckets.set(key, entry)
  }

  const stats = new Map<string, GuideIndexStat>()
  for (const guide of guides) {
    const entry = buckets.get(`${guide.treatment}|${guide.city}`)
    stats.set(guide.slug, {
      dealCount: entry?.dealCount ?? 0,
      providerCount: entry?.providerIds.size ?? 0,
      floorPrice: entry?.floor?.amount ?? null,
      // comparablePrice() compares neurotoxins per unit; see computeGuidePricingStats.
      perUnit: guide.treatment === 'botox',
      floorBrand: entry?.floor?.brand ?? null,
    })
  }
  return stats
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
  const offers = await getGuideOffers(treatment, citySlug)

  // Sort by savings percentage (highest first), over the prices the deal shows: a regular price
  // the offer's text never states is not shown (statedRegularPrice), so it is no saving here.
  const saving = (d: { originalPrice: number; dealPrice: number }) =>
    savingsPercent({
      regular_price: d.originalPrice,
      discount_price: d.dealPrice,
    })
  return offers
    .map(offerToAnonymousDeal)
    .filter((d) => d.dealPrice > 0 && d.originalPrice > d.dealPrice)
    .sort((a, b) => saving(b) - saving(a))
    .slice(0, limit)
}

/**
 * Percentage saved on an offer. Returns 0 when either price is missing, which is the
 * common case — only ~22% of offers carry a regular_price above their discount_price.
 */
export function savingsPercent(offer: {
  regular_price: number | null
  discount_price: number | null
}): number {
  const regular = offer.regular_price
  const discount = offer.discount_price
  if (regular == null || discount == null || regular <= 0) return 0
  return ((regular - discount) / regular) * 100
}

// ─── Which pairs get a guide ─────────────────────────────

/**
 * A cost guide needs a market behind it: this many publicly visible offers from this many
 * distinct providers. Below that a page is one clinic's price list wearing the word "market"
 * (the bar the 2026-09-04 guide set was published at).
 */
export const GUIDE_MIN_OFFERS = 10
export const GUIDE_MIN_PROVIDERS = 3

export interface GuideCandidate {
  treatment: GuideTreatment
  treatmentLabel: string
  /** `${treatment}-cost-${city.slug}` — the file name and the URL. */
  slug: string
  city: { slug: string; name: string; state: string; stateCode: string }
  offers: OfferView[]
  providerCount: number
}

/**
 * Every treatment/city pair the corpus can support a guide for, most offers first.
 *
 * Pure over the rows so tests/unit/guideStats.test.ts can prove the bar; getQualifyingGuidePairs()
 * fetches. This replaced a hand-kept registry in scripts/generate-guides.ts that listed ten pairs
 * while Newport Beach, the largest city in the database, qualified for five and had none — the
 * same silent-list failure as the four hand-written states (see src/lib/mock-data/states.ts).
 *
 * A city that resolves no state is dropped: its guide would link to a /[state]/[city] page that
 * does not exist. tests/unit/cityStateCoverage.test.ts fails the gate before that happens to a
 * city with visible deals.
 */
export function qualifyingGuidePairs(
  offers: OfferView[],
  stateFor: (city: string) => { state: string; stateCode: string },
): GuideCandidate[] {
  return guidePairs(offers, stateFor).filter(
    (c) =>
      c.offers.length >= GUIDE_MIN_OFFERS &&
      c.providerCount >= GUIDE_MIN_PROVIDERS,
  )
}

/**
 * Every treatment/city pair with a resolvable state, before the bar, most offers first. The
 * generator's --existing refresh reads this: a published guide whose market has since thinned
 * below GUIDE_MIN_OFFERS is still a live page, and its figures must still be the live ones.
 */
export function guidePairs(
  offers: OfferView[],
  stateFor: (city: string) => { state: string; stateCode: string },
): GuideCandidate[] {
  const byPair = new Map<string, GuideCandidate>()
  for (const offer of offers) {
    const cityName = offer.master_business_info?.city?.trim()
    const treatment = dbCategoryToTreatment(offer.service_category)
    if (!cityName || !treatment || !(treatment in GUIDE_TREATMENT_LABELS)) {
      continue
    }
    const guideTreatment = treatment as GuideTreatment
    const citySlug = cityToSlug(cityName)
    const slug = `${guideTreatment}-cost-${citySlug}`
    let entry = byPair.get(slug)
    if (!entry) {
      entry = {
        treatment: guideTreatment,
        treatmentLabel: GUIDE_TREATMENT_LABELS[guideTreatment],
        slug,
        city: { slug: citySlug, name: cityName, ...stateFor(cityName) },
        offers: [],
        providerCount: 0,
      }
      byPair.set(slug, entry)
    }
    entry.offers.push(offer)
  }
  for (const entry of byPair.values()) {
    entry.providerCount = new Set(
      entry.offers.map((o) => o.business_id).filter((id) => id != null),
    ).size
  }
  return [...byPair.values()]
    .filter((c) => c.city.stateCode !== '')
    .sort(
      (a, b) =>
        b.offers.length - a.offers.length || a.slug.localeCompare(b.slug),
    )
}

/** qualifyingGuidePairs() over the live corpus, states resolved the way the city pages do. */
export async function getQualifyingGuidePairs(): Promise<GuideCandidate[]> {
  const [offers, stateFor] = await liveCorpus()
  return qualifyingGuidePairs(offers, stateFor)
}

/** guidePairs() over the live corpus — every pair, before the bar. */
export async function getGuidePairs(): Promise<GuideCandidate[]> {
  const [offers, stateFor] = await liveCorpus()
  return guidePairs(offers, stateFor)
}

async function liveCorpus(): Promise<
  [OfferView[], (city: string) => { state: string; stateCode: string }]
> {
  const [offers, cityStates] = await Promise.all([
    getOffersWithBusinesses(),
    getCityStates(),
  ])
  return [
    offers,
    (city) => cityStates[city.toLowerCase().trim()] ?? inferState(city),
  ]
}
