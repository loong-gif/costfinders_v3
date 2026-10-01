import type { LeanOffer, TreatmentCategory } from '@/types/deal'
import type { GuidePricingStats } from '@/types/guide'
import type { OfferView } from '@/types/supabase'
import {
  type ComparablePrice,
  comparablePrice,
  getTreatmentLabel,
  neurotoxinBrand,
  offerToAnonymousDeal,
  offerToLean,
  offerTreatmentRoute,
} from './adapters'
import { getCategoryBucket } from './categories'
import { getGuideSummaries } from './guide-content'
import { computeGuidePricingStats, getGuidePricingStats } from './guide-stats'
import { getOffersWithBusinesses } from './offers'
import {
  cheapestComparable,
  floorPrice,
  pooledPrice,
  TYPICAL_TREATMENTS,
  type TypicalPrice,
  typicalPrices,
} from './typicalPrice'
import { cityToSlug, getCityDealCounts } from './unified'

/**
 * The pricing surfaces on the homepage — treatment ranges, a Botox-by-city breakdown, the
 * hero's cheapest-unit callouts, a featured-guides rail, and the headline counts.
 *
 * Every async wrapper reads the same React-cached, no-filter `getOffersWithBusinesses()` corpus
 * (see getCityDealCounts in unified.ts for why: one fetch aggregated in JS, not one query per
 * section) and filters in JS, so the homepage adds zero extra Supabase round-trips. The pure
 * cores are exported separately so they can be unit-tested without a database.
 */

/** Below this, a bucket is too thin to publish a price range for — same floor guide-stats.ts uses. */
const MIN_PRICED_DEALS = 3

/** Every treatment slug, in the order the search and the tabs list them. */
export const TREATMENTS: TreatmentCategory[] = [
  'botox',
  'fillers',
  'facials',
  'laser',
  'skincare',
  'wellness',
  'body',
]

type Priced = { minPrice: number; maxPrice: number; medianPrice: number }

/**
 * A stats row with enough priced deals to publish. GuidePricingStats types its prices as
 * nullable because an empty bucket has none; past the floor they are always numbers, and
 * every consumer of this module prints them, so the narrowing happens once, here.
 */
function publishable<T extends GuidePricingStats>(
  stats: T,
): stats is T & Priced {
  return (
    stats.pricedDealCount >= MIN_PRICED_DEALS &&
    stats.minPrice != null &&
    stats.maxPrice != null &&
    stats.medianPrice != null
  )
}

export interface TreatmentPriceRange {
  treatment: TreatmentCategory
  label: string
  /** The browse bucket page — `/treatments/{treatment}` alone is NOT a route. */
  href: string
  dealCount: number
  pricedDealCount: number
  providerCount: number
  perUnit: boolean
  minPrice: number
  maxPrice: number
  medianPrice: number
  /**
   * The neurotoxin brand of `minPrice`, printed in brackets after it (minBrandText()): the range
   * pools Xeomin, Jeuveau, Daxxify and Botox units. Not Dysport since 2026-09-28
   * (pooledPrice()), whose unit had been the floor every time it was measured — so this is the
   * range's low end, not "lowest is".
   */
  minBrand: string | null
}

/**
 * One price range per treatment with enough priced inventory to publish one.
 *
 * Grouped by `offerTreatmentRoute()`, not `dbCategoryToTreatment()` — ~15% of offers resolve no
 * treatment at all, and dbCategoryToTreatment's total fallback would bucket every one of them
 * into 'body' here, which is a page that does not actually cover them (see the note on
 * offerTreatmentRoute in adapters.ts).
 */
export function treatmentPriceRanges(
  offers: OfferView[],
): TreatmentPriceRange[] {
  const groups = new Map<TreatmentCategory, OfferView[]>()
  for (const offer of offers) {
    const treatment = offerTreatmentRoute(offer.service_category)
    if (!treatment) continue
    const group = groups.get(treatment)
    if (group) group.push(offer)
    else groups.set(treatment, [offer])
  }

  const ranges: TreatmentPriceRange[] = []
  for (const [treatment, group] of groups) {
    const stats = computeGuidePricingStats(treatment, group)
    if (!publishable(stats)) continue
    ranges.push({
      treatment,
      label: getTreatmentLabel(treatment),
      // group[0].service_category is non-null: offerTreatmentRoute() only returns a treatment
      // for a resolved category, which is how this offer landed in this group.
      href: `/treatments/${getCategoryBucket(group[0].service_category)?.slug}`,
      dealCount: stats.dealCount,
      pricedDealCount: stats.pricedDealCount,
      providerCount: stats.providerCount,
      perUnit: stats.perUnit,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      medianPrice: stats.medianPrice,
      minBrand: stats.minBrand,
    })
  }
  return ranges.sort((a, b) => b.dealCount - a.dealCount)
}

/**
 * One range per browse bucket, for /treatments: its tiles and its category list then use one set
 * of names, and a tile's counts are those of the page it opens. (The homepage keeps the finer
 * per-treatment tiles.) A bucket holds one treatment or several that all compare on what you
 * pay, so its range pools on one basis like the per-treatment ones.
 */
export function bucketPriceRanges(offers: OfferView[]): TreatmentPriceRange[] {
  const groups = new Map<
    string,
    { label: string; treatment: TreatmentCategory; offers: OfferView[] }
  >()
  for (const offer of offers) {
    const bucket = getCategoryBucket(offer.service_category)
    const treatment = offerTreatmentRoute(offer.service_category)
    if (!bucket || !treatment) continue
    const group = groups.get(bucket.slug)
    if (group) group.offers.push(offer)
    else
      groups.set(bucket.slug, {
        label: bucket.label,
        treatment,
        offers: [offer],
      })
  }

  const ranges: TreatmentPriceRange[] = []
  for (const [slug, { label, treatment, offers: group }] of groups) {
    const stats = computeGuidePricingStats(treatment, group)
    if (!publishable(stats)) continue
    ranges.push({
      treatment,
      label,
      href: `/treatments/${slug}`,
      dealCount: stats.dealCount,
      pricedDealCount: stats.pricedDealCount,
      providerCount: stats.providerCount,
      perUnit: stats.perUnit,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      medianPrice: stats.medianPrice,
      minBrand: stats.minBrand,
    })
  }
  return ranges.sort((a, b) => b.dealCount - a.dealCount)
}

export async function getTreatmentPriceRanges(): Promise<
  TreatmentPriceRange[]
> {
  return treatmentPriceRanges(await getOffersWithBusinesses())
}

export interface CityMedian {
  city: string
  slug: string
  dealCount: number
  pricedDealCount: number
  providerCount: number
  minPrice: number
  maxPrice: number
  medianPrice: number
}

/** @deprecated name kept for the first homepage build; it is `CityMedian`. */
export type CityBotoxMedian = CityMedian

/**
 * What one (treatment, city) group publishes, or null below its floor. A TYPICAL_TREATMENTS
 * group publishes its typicalPrices() figure, floor and counts included, so the hero and the
 * city chart print the number the deals page they link to calls typical (owner decision,
 * 2026-09-28: "be consistent"). Any other group publishes its pooled stats past
 * MIN_PRICED_DEALS, as before.
 */
function cityFigures(
  treatment: TreatmentCategory,
  group: OfferView[],
  stats: GuidePricingStats,
): Omit<TypicalPrice, 'treatment' | 'perUnit'> | null {
  if (TYPICAL_TREATMENTS.has(treatment)) {
    return typicalPrices(group)[treatment] ?? null
  }
  if (!publishable(stats)) return null
  return {
    median: stats.medianPrice,
    min: stats.minPrice,
    max: stats.maxPrice,
    pricedDealCount: stats.pricedDealCount,
    providerCount: stats.providerCount,
    minBrand: stats.minBrand,
  }
}

/**
 * One treatment's pricing by city, for the "price by city" chart.
 *
 * One treatment at a time, so every median in a chart shares one basis — per unit for
 * neurotoxins, what you pay for everything else. Mixing treatments in one chart would repeat
 * the mistake computeGuidePricingStats() exists to avoid (see its own doc comment). A neurotoxin
 * city is charted at its typical price or not at all (cityFigures()): each bar links to a deals
 * page that prints that typical.
 */
export function cityMedians(
  offers: OfferView[],
  treatment: TreatmentCategory,
  limit = 8,
): CityMedian[] {
  const groups = new Map<string, OfferView[]>()
  for (const offer of offers) {
    if (offerTreatmentRoute(offer.service_category) !== treatment) continue
    const city = offer.master_business_info?.city?.trim()
    if (!city) continue
    const group = groups.get(city)
    if (group) group.push(offer)
    else groups.set(city, [offer])
  }

  const medians: CityMedian[] = []
  for (const [city, group] of groups) {
    const stats = computeGuidePricingStats(treatment, group)
    const figures = cityFigures(treatment, group, stats)
    if (!figures) continue
    medians.push({
      city,
      slug: cityToSlug(city),
      dealCount: stats.dealCount,
      pricedDealCount: figures.pricedDealCount,
      providerCount: figures.providerCount,
      minPrice: figures.min,
      maxPrice: figures.max,
      medianPrice: figures.median,
    })
  }
  return medians
    .sort(
      (a, b) =>
        b.pricedDealCount - a.pricedDealCount || a.city.localeCompare(b.city),
    )
    .slice(0, limit)
}

export function cityBotoxMedians(offers: OfferView[], limit = 8): CityMedian[] {
  return cityMedians(offers, 'botox', limit)
}

export interface TreatmentCityMedians {
  treatment: TreatmentCategory
  label: string
  perUnit: boolean
  rows: CityMedian[]
}

/** The city chart's data for every treatment with at least one chartable city. */
export function cityMediansByTreatment(
  offers: OfferView[],
  limit = 8,
): TreatmentCityMedians[] {
  return TREATMENTS.map((treatment) => ({
    treatment,
    label: getTreatmentLabel(treatment),
    perUnit: treatment === 'botox',
    rows: cityMedians(offers, treatment, limit),
  })).filter((t) => t.rows.length > 0)
}

export async function getCityMediansByTreatment(
  limit = 8,
): Promise<TreatmentCityMedians[]> {
  return cityMediansByTreatment(await getOffersWithBusinesses(), limit)
}

/**
 * The cheapest Botox-per-unit offers, for the hero's "from $X/unit" callouts.
 *
 * `comparablePrice()` already restricts a Botox comparison to a genuine unit rate within the
 * plausible range (see NEUROTOXIN_UNIT_PRICE_RANGE in adapters.ts) — a flat "Lip Flip $79" or a
 * misread "$400/unit" row returns null and is dropped here rather than headlining the hero.
 * Capped at one offer per business so the hero shows three different providers, not one
 * provider's three cheapest deals.
 */
export function lowestBotoxUnitOffers(
  offers: OfferView[],
  limit = 3,
): OfferView[] {
  const priced = offers
    .filter((o) => offerTreatmentRoute(o.service_category) === 'botox')
    // The heading says Botox, so only Botox. The treatment bucket also holds Dysport, Xeomin
    // and Jeuveau, and a Dysport unit is not a Botox unit (roughly 2.5–3 Dysport units per
    // Botox unit) — on the live corpus the three cheapest rates in the bucket were all Dysport
    // at $3, which under a "Botox" heading is a wrong price, not a low one. The tiles and the
    // city chart pool the whole bucket under "Neurotoxins", naming the brand of the floor.
    .filter(
      (o) => neurotoxinBrand(o.service_name, o.offer_raw_text) === 'Botox',
    )
    // The card reads "Provider in {city}"; an offer whose business has no city cannot be
    // placed, and "Local provider" at $6 is not a comparison anyone can act on.
    .filter((o) => o.master_business_info?.city?.trim())
    .map((offer) => ({
      offer,
      // A "from $X" rate is a floor the clinic set, not a price (floorPrice()).
      price: floorPrice(comparablePrice(offerToAnonymousDeal(offer))),
    }))
    .filter(
      (row): row is { offer: OfferView; price: ComparablePrice } =>
        !!row.price?.perUnit,
    )
    .sort((a, b) => a.price.amount - b.price.amount)

  const seenBusinesses = new Set<number>()
  const result: OfferView[] = []
  for (const { offer } of priced) {
    // business_id is nullable on the raw column; an offer with no business has no identity to
    // dedupe on, so it is never dropped for repeating one.
    if (offer.business_id != null) {
      if (seenBusinesses.has(offer.business_id)) continue
      seenBusinesses.add(offer.business_id)
    }
    result.push(offer)
    if (result.length >= limit) break
  }
  return result
}

export async function getLowestBotoxUnitOffers(
  limit = 3,
): Promise<OfferView[]> {
  return lowestBotoxUnitOffers(await getOffersWithBusinesses(), limit)
}

export interface FeaturedGuide {
  slug: string
  treatment: TreatmentCategory
  treatmentLabel: string
  cityLabel: string
  stateCode: string
  href: string
  perUnit: boolean
  medianPrice: number
  minPrice: number
  maxPrice: number
  pricedDealCount: number
  /** The brand of `minPrice`, the pooled range's low end, on a per-unit guide (minBrandText()). */
  minBrand: string | null
}

/**
 * The guides with the deepest inventory behind them, for a homepage cross-link rail.
 *
 * getGuidePricingStats() is React-cached per (treatment, citySlug) pair, so fanning this out
 * with Promise.all costs one round-trip per already-generated guide, not one per request.
 */
export async function getFeaturedGuides(limit = 6): Promise<FeaturedGuide[]> {
  const summaries = getGuideSummaries()
  const withStats = await Promise.all(
    summaries.map(async (guide) => ({
      guide,
      stats: await getGuidePricingStats(guide.treatment, guide.city),
    })),
  )

  return withStats
    .filter(
      (
        row,
      ): row is {
        guide: (typeof row)['guide']
        stats: GuidePricingStats & Priced
      } => publishable(row.stats),
    )
    .sort((a, b) => b.stats.pricedDealCount - a.stats.pricedDealCount)
    .slice(0, limit)
    .map(({ guide, stats }) => ({
      slug: guide.slug,
      treatment: guide.treatment,
      treatmentLabel: guide.treatmentLabel,
      cityLabel: guide.cityLabel,
      stateCode: guide.stateCode,
      href: `/guides/${guide.slug}`,
      perUnit: stats.perUnit,
      medianPrice: stats.medianPrice,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      pricedDealCount: stats.pricedDealCount,
      minBrand: stats.minBrand,
    }))
}

export interface HomepageCounts {
  deals: number
  providers: number
  cities: number
}

/**
 * The hero's headline counts, from the same corpus every other figure on the page uses.
 *
 * They used to be summed from getCityDealCounts(), which only counts offers whose business
 * has a city — 14 fewer than the corpus on 2026-09-18 — so the hero said 803 while the
 * discount histogram three sections down said "of 817 deals". One page, one total: the
 * corpus length. Cities still come from the per-city list, which is what "cities" means.
 */
export function homepageCounts(
  offers: OfferView[],
  cityDealCounts: { dealCount: number }[],
): HomepageCounts {
  const providers = new Set<number>()
  for (const offer of offers) {
    if (offer.business_id != null) providers.add(offer.business_id)
  }
  return {
    deals: offers.length,
    providers: providers.size,
    cities: cityDealCounts.filter((c) => c.dealCount > 0).length,
  }
}

export async function getHomepageCounts(): Promise<HomepageCounts> {
  const [offers, cityDealCounts] = await Promise.all([
    getOffersWithBusinesses(),
    getCityDealCounts(),
  ])
  return homepageCounts(offers, cityDealCounts)
}

// ─── Per-(treatment, city) stats for the hero's instant answer ───────────────

export interface PairStat {
  treatment: TreatmentCategory
  /** City slug, as the search selects it. */
  city: string
  cityLabel: string
  dealCount: number
  pricedDealCount: number
  providerCount: number
  perUnit: boolean
  /**
   * Null below the publish floor (cityFigures()). For TYPICAL_TREATMENTS these are the city's
   * typicalPrices() figures and the panel calls the middle one "typical", as the deals page does.
   */
  minPrice: number | null
  maxPrice: number | null
  medianPrice: number | null
  /** Every pooled price in the pair (pooledPrice()), ascending, for the dot strip. Empty below the floor. */
  prices: number[]
  /** The cheapest comparable offers in the pair, one per provider. */
  lowest: LeanOffer[]
  /** Neurotoxins only: the brand of `minPrice` (see TreatmentPriceRange.minBrand). */
  minBrand: string | null
  /**
   * A TYPICAL_TREATMENTS pair below the typical floor: its floor, any brand — what the city
   * page's group header says there ("from $3.15 per unit · lowest is Dysport",
   * cheapestComparable()). Null otherwise.
   */
  from: ComparablePrice | null
}

/**
 * The comparable price of each offer, kept with the offer. `comparablePrice()` already applies
 * the per-treatment basis rule (neurotoxins per unit, else what you pay) and the neurotoxin
 * sanity range, so an offer it returns null for is not priced for comparison at all. Through
 * floorPrice(): the cheapest rows under a "from $X" are never cheaper than it, so a neurotoxin
 * "Starts at $2.50 per unit" is not one of them.
 */
function pricedOffers(
  offers: OfferView[],
): { offer: OfferView; price: ComparablePrice }[] {
  return offers
    .map((offer) => ({
      offer,
      price: floorPrice(comparablePrice(offerToAnonymousDeal(offer))),
    }))
    .filter(
      (row): row is { offer: OfferView; price: ComparablePrice } =>
        row.price !== null,
    )
}

/** pricedOffers() minus what a pooled figure leaves out: the dots under a median are its prices. */
function pooledOffers(
  offers: OfferView[],
): { offer: OfferView; price: ComparablePrice }[] {
  return pricedOffers(offers).filter((row) => pooledPrice(row.price))
}

/**
 * The cheapest offers in a group, ascending, one per business. For neurotoxins only
 * Botox-branded offers qualify: a Dysport unit is not a Botox unit, and the rows are shown
 * under a "Botox" heading (see lowestBotoxUnitOffers).
 */
function lowestOffers(
  offers: OfferView[],
  treatment: TreatmentCategory,
  limit: number,
): OfferView[] {
  const eligible =
    treatment === 'botox'
      ? offers.filter(
          (o) => neurotoxinBrand(o.service_name, o.offer_raw_text) === 'Botox',
        )
      : offers
  const seen = new Set<number>()
  const result: OfferView[] = []
  for (const { offer } of pricedOffers(eligible).sort(
    (a, b) => a.price.amount - b.price.amount,
  )) {
    if (offer.business_id != null) {
      if (seen.has(offer.business_id)) continue
      seen.add(offer.business_id)
    }
    result.push(offer)
    if (result.length >= limit) break
  }
  return result
}

/**
 * Every (treatment, city) pair with at least one visible offer, with the stats the hero's
 * answer panel prints as the two selects change. Computed once on the server and inlined as
 * JSON — ~150 pairs today.
 * ponytail: inline JSON. If pairs grow past a few hundred, move this behind a route handler.
 */
export function pairStats(offers: OfferView[]): PairStat[] {
  const groups = new Map<
    string,
    { treatment: TreatmentCategory; cityLabel: string; offers: OfferView[] }
  >()
  for (const offer of offers) {
    const treatment = offerTreatmentRoute(offer.service_category)
    const cityLabel = offer.master_business_info?.city?.trim()
    if (!treatment || !cityLabel) continue
    const key = `${treatment}:${cityToSlug(cityLabel)}`
    const group = groups.get(key)
    if (group) group.offers.push(offer)
    else groups.set(key, { treatment, cityLabel, offers: [offer] })
  }

  const result: PairStat[] = []
  for (const { treatment, cityLabel, offers: group } of groups.values()) {
    const stats = computeGuidePricingStats(treatment, group)
    const figures = cityFigures(treatment, group, stats)
    result.push({
      treatment,
      city: cityToSlug(cityLabel),
      cityLabel,
      dealCount: stats.dealCount,
      pricedDealCount: figures?.pricedDealCount ?? stats.pricedDealCount,
      providerCount: figures?.providerCount ?? stats.providerCount,
      perUnit: stats.perUnit,
      minPrice: figures?.min ?? null,
      maxPrice: figures?.max ?? null,
      medianPrice: figures?.median ?? null,
      prices: figures
        ? pooledOffers(group)
            .map((r) => r.price.amount)
            .sort((a, b) => a - b)
        : [],
      lowest: lowestOffers(group, treatment, 3).map(offerToLean),
      minBrand: figures?.minBrand ?? null,
      from:
        !figures && TYPICAL_TREATMENTS.has(treatment)
          ? cheapestComparable(group.map(offerToAnonymousDeal))
          : null,
    })
  }
  return result
}

export async function getPairStats(): Promise<PairStat[]> {
  return pairStats(await getOffersWithBusinesses())
}

// ─── Price distributions for the strip plot ──────────────────────────────────

export interface PriceDot {
  id: number
  price: number
  cityLabel: string | null
}

export interface PriceDistribution {
  treatment: TreatmentCategory
  label: string
  perUnit: boolean
  dealCount: number
  providerCount: number
  min: number
  max: number
  median: number
  /** Interquartile range — the "middle half of prices" band. */
  p25: number
  p75: number
  /** One dot per priced offer, ascending by price. */
  dots: PriceDot[]
}

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * Every pooled price we list, per treatment, for the "every price" strip plot. The
 * min/median/max here equal the range tiles' by construction (same pooled prices: pooledOffers()
 * leaves out what computeGuidePricingStats() does).
 */
export function priceDistributions(offers: OfferView[]): PriceDistribution[] {
  const result: PriceDistribution[] = []
  for (const treatment of TREATMENTS) {
    const group = offers.filter(
      (o) => offerTreatmentRoute(o.service_category) === treatment,
    )
    const stats = computeGuidePricingStats(treatment, group)
    if (!publishable(stats)) continue
    const dots = pooledOffers(group)
      .map(({ offer, price }) => {
        const lean = offerToLean(offer)
        return {
          id: offer.id,
          price: price.amount,
          cityLabel: lean.cityLabel,
        }
      })
      .sort((a, b) => a.price - b.price)
    const prices = dots.map((d) => d.price)
    result.push({
      treatment,
      label: getTreatmentLabel(treatment),
      perUnit: stats.perUnit,
      dealCount: stats.pricedDealCount,
      providerCount: stats.providerCount,
      min: stats.minPrice,
      max: stats.maxPrice,
      median: stats.medianPrice,
      p25: quantile(prices, 0.25),
      p75: quantile(prices, 0.75),
      dots,
    })
  }
  return result
}

export async function getPriceDistributions(): Promise<PriceDistribution[]> {
  return priceDistributions(await getOffersWithBusinesses())
}

// ─── The discounts, as advertised ────────────────────────────────────────────

export interface DiscountHistogram {
  /** Offers that state a discount percentage at all. */
  stated: number
  total: number
  bins: { label: string; count: number }[]
}

/**
 * How big the advertised discounts actually are. Context for a grid that leads with the
 * largest: on the live corpus most stated discounts are 10–25%, and the "Save 91%" cards are
 * the tail, not the rule. Bins are stated once, here, so the caption and the bars agree.
 *
 * The adapter's `discountPercent`, not the raw column: on a priced row whose regular price the
 * text never states, the stored percent is the pipeline's division by that unstated price, and
 * the card beside this chart shows no saving for it (statedRegularPrice in adapters.ts). Nor a
 * percent the offer's words don't state at all (`discount-unstated`, labelled Confirm when
 * booking): 8788 "Chemical Peels (regularly $350)" stored 5%. The whole check tier is not left
 * out, only that reason: "Botox Injection 20% off" is check for its price, and states its
 * discount. Our count of "buy N, get M free" (`discount-derived`) stays in.
 */
export function discountHistogram(offers: OfferView[]): DiscountHistogram {
  const stated = offers
    .map(offerToAnonymousDeal)
    .filter(
      (d) =>
        d.discountPercent > 0 &&
        !d.interpretation.reasons.includes('discount-unstated'),
    )
    .map((d) => d.discountPercent)
  const bins = [
    { label: 'Under 10%', count: stated.filter((p) => p < 10).length },
    { label: '10–25%', count: stated.filter((p) => p >= 10 && p < 25).length },
    { label: '25–50%', count: stated.filter((p) => p >= 25 && p < 50).length },
    { label: '50% or more', count: stated.filter((p) => p >= 50).length },
  ]
  return { stated: stated.length, total: offers.length, bins }
}

export async function getDiscountHistogram(): Promise<DiscountHistogram> {
  return discountHistogram(await getOffersWithBusinesses())
}

// ─── The fine print ──────────────────────────────────────────────────────────

export interface FinePrintFacts {
  total: number
  membershipRequired: number
  newCustomerOnly: number
  /** Offers that state a regular price above the price shown — the ones a "Save X%" can be computed for. */
  statesBeforePrice: number
}

/** The conditions attached to the visible offers, counted, for the methodology section. */
export function finePrintFacts(offers: OfferView[]): FinePrintFacts {
  return {
    total: offers.length,
    membershipRequired: offers.filter((o) => o.is_membership_required === true)
      .length,
    newCustomerOnly: offers.filter((o) => o.is_new_customer_required === true)
      .length,
    // The two prices the card shows: a price or a regular price the offer's text never states
    // is not shown (priceIsStated, statedRegularPrice), so it is no before-price either.
    statesBeforePrice: offers.filter((o) => {
      const deal = offerToAnonymousDeal(o)
      return deal.dealPrice > 0 && deal.originalPrice > deal.dealPrice
    }).length,
  }
}

export async function getFinePrintFacts(): Promise<FinePrintFacts> {
  return finePrintFacts(await getOffersWithBusinesses())
}
