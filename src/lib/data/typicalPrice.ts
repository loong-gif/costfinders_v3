import type {
  AnonymousDeal,
  ComparablePrice,
  TreatmentCategory,
} from '@/types/deal'
import type { GuidePricingStats } from '@/types/guide'
import type { OfferView } from '@/types/supabase'
import {
  comparablePrice,
  formatPrice,
  neurotoxinBrand,
  offerToAnonymousDeal,
  offerTreatmentRoute,
  perUnitPrice,
} from './adapters'

/**
 * "Typical" prices, and the pricing statistics they are built on.
 *
 * Two concepts, one meaning each, on every surface (owner decision, 2026-09-28):
 * - A FLOOR — "from $X", "Starting at $X", "lowest is …" — is the cheapest comparable price of
 *   any brand, Dysport included and named (floorBrandText()): floorPrice(), cheapestComparable(),
 *   GuidePricingStats.floorPrice. What the deals pages, the guides, the /guides hub and the hero
 *   below the typical floor all print.
 * - A RANGE — min–max, median, "typical", a dot strip — pools pooledPrice(): per unit, no Dysport
 *   unit and no starting price, so every neurotoxin median counts the typical price's prices. A
 *   range's low end names its brand in brackets (minBrandText()), never "lowest is": the floor
 *   can sit below it.
 * Neither ever counts a neurotoxin starting price or a check-tier deal. Pooled ⊆ floor, so the
 * floor is never above a range's low end.
 *
 * Client-safe on purpose: the browse rows compute vs-typical in the browser, so nothing here may
 * import the Supabase client, React's cache or node:fs. That is why computeGuidePricingStats()
 * lives here rather than in guide-stats.ts (which reads guide files from disk and re-exports it).
 */

/** Buckets smaller than this are noise on a pricing page, not a data point. */
const MIN_BUCKET_SIZE = 2
/** Enough rows to characterise a market, few enough to stay scannable. */
const MAX_SERVICE_ROWS = 8

/**
 * The arithmetic behind getGuidePricingStats, on rows already fetched — split out so the tests
 * and scripts/generate-guides.ts compute exactly what the page prints.
 *
 * Every price figure pools `comparablePrice()`, never the row's raw price. That puts a Botox
 * guide's min/median/max all PER UNIT — "40 units for $299" counts as $7.48 and a flat $79 lip
 * flip drops out — where pooling the printed figures made "typical price" the median of $10
 * rates and $299 packages. Every other guide pools what you pay, minus the per-unit rates
 * nobody can buy one of.
 *
 * Per unit, the pooled figures (min, median, max, average, pricedDealCount, minBrand) and the
 * `unit` row of byUnitType count only pooledPrice(): no starting price, no Dysport unit — the
 * rule the typical price already used. One rule because the owner asked for one ("be
 * consistent", 2026-09-28): the homepage hero, its city chart, the national strip and the
 * guides called this function directly and pooled both, so on 2026-09-28 the hero's Newport
 * Beach neurotoxins read $3.15 (Dysport) to $16.63 with a median over 14 prices, one click from
 * a deals page whose typical was over 13 prices from $6.99, and the Irvine, San Diego and
 * Woodland Hills guides printed medians of $9, $10.50 and $11 against typicals of $10, $11 and
 * $10.995. byService still lists Dysport — a row labelled Dysport, priced per Dysport unit, is
 * that product's price — but never a starting price: a floor is not a price.
 *
 * floorPrice/floorBrand are the other concept: the cheapest floorPrice() of any brand, what the
 * guide's "Starting at" and the /guides hub print, equal to the deals pages' "from $X".
 *
 * `offers` must share one guide's treatment. getOffersWithBusinesses() keeps only offers whose
 * resolved category is the one asked for, so comparablePrice()'s per-deal neurotoxin rule and
 * `perUnit` here cannot disagree.
 */
export function computeGuidePricingStats(
  treatment: TreatmentCategory,
  offers: OfferView[],
): GuidePricingStats {
  const perUnit = treatment === 'botox'
  if (offers.length === 0) return emptyStats(perUnit)

  const prices: number[] = []
  let cheapest: { amount: number; offer: OfferView } | null = null
  let floor: ComparablePrice | null = null
  // Breakdown by the specific product or service offered (Botox vs Dysport vs Daxxify;
  // Juvederm vs Sculptra vs Kybella). This is the breakdown a pricing guide actually needs.
  // It replaces a "by offer type" table keyed on promo_offer_master.template_type — a column
  // that does not exist in the database, so every guide rendered a single row reading "Other".
  const serviceMap = new Map<string, { label: string; prices: number[] }>()
  // Price per ONE unit, keyed by that unit. This used to pool the raw price of every row whose
  // SERVICE had a unit_type, so "Per unit" was the median of $10 rates and $299 packages.
  const unitMap = new Map<string, number[]>()

  for (const offer of offers) {
    const deal = offerToAnonymousDeal(offer)
    const comparable = comparablePrice(deal)
    const pooled = pooledPrice(comparable)
    const floored = floorPrice(comparable)
    if (floored && (!floor || floored.amount < floor.amount)) floor = floored
    if (pooled) {
      prices.push(pooled.amount)
      if (!cheapest || pooled.amount < cheapest.amount) {
        cheapest = { amount: pooled.amount, offer }
      }
    }
    if (floored) {
      const label = normalizeServiceName(offer.service_name)
      if (label) {
        const key = label.toLowerCase()
        const entry = serviceMap.get(key) ?? { label, prices: [] }
        entry.prices.push(floored.amount)
        serviceMap.set(key, entry)
      }
    }

    const unitPrice = perUnitPrice(deal)
    if (!unitPrice) continue
    // comparablePrice() refuses a neurotoxin unit price outside its sanity range — offer 8509,
    // a "$50 off" coupon stored as a $400 rate. This grid must not print it as a cost either.
    // Nor a unit price the pooled median leaves out: this row would re-pool Dysport and floors.
    if (deal.category === 'botox' && unitPrice.unit === 'unit' && !pooled)
      continue
    const entry = unitMap.get(unitPrice.unit) ?? []
    entry.push(unitPrice.amount)
    unitMap.set(unitPrice.unit, entry)
  }
  prices.sort((a, b) => a - b)

  // Unique providers
  const providerIds = new Set(offers.map((o) => o.business_id).filter(Boolean))

  const byService = Array.from(serviceMap.values())
    .filter((entry) => entry.prices.length >= MIN_BUCKET_SIZE)
    .map((entry) => ({
      name: entry.label,
      count: entry.prices.length,
      minPrice: Math.min(...entry.prices),
      maxPrice: Math.max(...entry.prices),
      medianPrice: median(entry.prices),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SERVICE_ROWS)

  const byUnitType = Array.from(unitMap.entries())
    .filter(([, unitPrices]) => unitPrices.length >= MIN_BUCKET_SIZE)
    .map(([unitType, unitPrices]) => ({
      unitType,
      count: unitPrices.length,
      medianPrice: median(unitPrices),
      minPrice: Math.min(...unitPrices),
      maxPrice: Math.max(...unitPrices),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    dealCount: offers.length,
    // Not offers.length: every price figure below is computed over `prices` — the offers with
    // a comparable price. That drops the ones advertising a discount with no base price and,
    // on a per-unit guide, every flat price with no unit count to divide by.
    pricedDealCount: prices.length,
    providerCount: providerIds.size,
    perUnit,
    minPrice: prices.length > 0 ? prices[0] : null,
    minBrand:
      perUnit && cheapest
        ? neurotoxinBrand(
            cheapest.offer.service_name,
            cheapest.offer.offer_raw_text,
          )
        : null,
    maxPrice: prices.length > 0 ? prices[prices.length - 1] : null,
    avgPrice: prices.length > 0 ? Math.round(avg(prices)) : null,
    medianPrice: prices.length > 0 ? median(prices) : null,
    floorPrice: floor?.amount ?? null,
    floorBrand: floor?.brand ?? null,
    byService,
    byUnitType,
  }
}

/**
 * Canonical display name for a resolved service_name (promo_offer_items.item_name). It carries
 * the same product
 * under several spellings ("Skinvive", "SkinVive", "SKINVIVE"; "Sculptra", "sculptra"), and
 * a handful of snake_case machine values. Long descriptive strings are bundle titles rather
 * than products, so they are excluded from the by-product table.
 */
export function normalizeServiceName(raw: string | null): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (trimmed.length > 32) return null
  const spaced = trimmed.replace(/_/g, ' ')
  return spaced
    .split(/\s+/)
    .map((word) =>
      word.length > 3 && word === word.toUpperCase()
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Deliberately unrounded. Callers format with the same precision rule they use for min and max
 * (formatPrice per unit; otherwise cents below $10, whole dollars above), so a midpoint can never
 * print outside its own range.
 */
export function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function emptyStats(perUnit: boolean): GuidePricingStats {
  return {
    dealCount: 0,
    pricedDealCount: 0,
    providerCount: 0,
    perUnit,
    minPrice: null,
    minBrand: null,
    maxPrice: null,
    avgPrice: null,
    medianPrice: null,
    floorPrice: null,
    floorBrand: null,
    byService: [],
    byUnitType: [],
  }
}

// ─── Typical price ───────────────────────────────────────

/**
 * The treatments a typical price is published for: neurotoxins, per unit (owner decision,
 * 2026-09-28). Everywhere else one treatment pools unlike services, so its median is not a
 * market: Newport Beach skincare's "typical $599" sat over a $199–$4,500 range that compared a
 * single vial with a three-session package, and fillers pool single syringes, multi-syringe
 * packages and Sculptra vials. Those groups say "from $X" instead. Adding a treatment is one
 * entry here, once its deals compare like with like.
 */
export const TYPICAL_TREATMENTS: ReadonlySet<TreatmentCategory> = new Set([
  'botox',
])

/**
 * Neurotoxin brands whose unit is not the size of a Botox unit, so their per-unit price is
 * neither pooled into a typical price nor set against one. A Dysport unit is about a third of a
 * Botox unit: on 2026-09-28 Newport Beach's "DYSPORT $3.15/UNIT" (8107) read "69% below
 * typical" against a median of mostly Botox rates, a routine price sold as a bargain, and 11
 * named-Dysport rows in 9 cities did the same. Excluded rather than converted: live Dysport rows
 * ran $3.15 to $13.50 a unit, a mix of Dysport units and what look like Botox-equivalent quotes,
 * so no one factor is safe.
 * Dysport only: Daxxify's label dose is about twice Botox's, and the owner kept it pooled
 * (2026-09-28).
 */
export const UNLIKE_UNIT_BRANDS: ReadonlySet<string> = new Set(['Dysport'])

/**
 * Why a comparable price stays out of typical prices and is never set against one, or null when
 * it belongs. A "from $X" floor is not what anyone pays (Oklahoma City's "Starts at $9 per unit"
 * read "11% below typical" beside the page's own "what you pay depends on the treatment"), and a
 * Dysport unit is not a Botox unit (UNLIKE_UNIT_BRANDS).
 */
export function typicalExclusion(
  c: ComparablePrice,
): 'from-price' | 'unlike-unit' | null {
  if (c.from) return 'from-price'
  if (c.brand && UNLIKE_UNIT_BRANDS.has(c.brand)) return 'unlike-unit'
  return null
}

/**
 * The comparable price an offer adds to a floor — "from $X", "Starting at", "lowest is …" — or
 * null. Every brand counts, Dysport included (the floor names its brand, floorBrandText()); a
 * neurotoxin starting price does not: "Starts at $9 per unit" is a floor the clinic set, not a
 * price. Outside neurotoxins a starting price stays, as it stays in their pooled range: on
 * 2026-09-28 leaving it out would have put Newport Beach fillers' "from" at $299 above its own
 * range's $149 low end, and emptied Laguna Beach fillers' and Johns Creek laser's.
 */
export function floorPrice(c: ComparablePrice | null): ComparablePrice | null {
  return c && !(c.perUnit && c.from) ? c : null
}

/**
 * The comparable price an offer adds to a figure pooled over many clinics — a median, a range,
 * a dot strip — or null. Per unit (neurotoxins) that is the typical price's rule, so every
 * neurotoxin median on the site counts the same prices (computeGuidePricingStats()). Everything
 * else pools what you pay, starting prices included: no typical is published over it. Always a
 * subset of floorPrice(): it also leaves out a Dysport unit.
 */
export function pooledPrice(c: ComparablePrice | null): ComparablePrice | null {
  return c && !(c.perUnit && typicalExclusion(c)) ? c : null
}

/**
 * A market price for one treatment in one city: the median of its comparable prices. Only for
 * TYPICAL_TREATMENTS, so today always per unit — `perUnit` still says which, and every surface
 * printing it must.
 */
export interface TypicalPrice {
  treatment: TreatmentCategory
  perUnit: boolean
  median: number
  min: number
  max: number
  pricedDealCount: number
  providerCount: number
  /** The neurotoxin brand of `min`, or null when its offer names none (or several). */
  minBrand: string | null
}

/** Below either floor a "typical" is one or two clinics' price list, not a market. */
export const TYPICAL_MIN_PRICED_DEALS = 5
export const TYPICAL_MIN_PROVIDERS = 3

/**
 * Typical price per treatment over ONE city's offers (a mixed-city median compares prices nobody
 * can choose between), for TYPICAL_TREATMENTS only. Built on computeGuidePricingStats(), over
 * the offers with a comparable price only — so `providerCount` counts the clinics behind the
 * prices, not every clinic with a "20% off" — and a treatment below 5 priced deals from 3
 * providers gets none. A `check`-tier offer never counts: comparablePrice() is null for it, and
 * it is filtered out by name too. Nor does a starting price or a Dysport unit
 * (typicalExclusion()), so the median, the range and both counts are in Botox-sized units of
 * what you pay.
 */
export function typicalPrices(
  offers: OfferView[],
): Partial<Record<TreatmentCategory, TypicalPrice>> {
  const groups = new Map<TreatmentCategory, OfferView[]>()
  for (const offer of offers) {
    const treatment = offerTreatmentRoute(offer.service_category)
    if (!treatment || !TYPICAL_TREATMENTS.has(treatment)) continue
    const deal = offerToAnonymousDeal(offer)
    const comparable = comparablePrice(deal)
    if (
      deal.interpretation.tier === 'check' ||
      !comparable ||
      typicalExclusion(comparable)
    ) {
      continue
    }
    const group = groups.get(treatment)
    if (group) group.push(offer)
    else groups.set(treatment, [offer])
  }

  const typical: Partial<Record<TreatmentCategory, TypicalPrice>> = {}
  for (const [treatment, group] of groups) {
    const stats = computeGuidePricingStats(treatment, group)
    if (
      stats.pricedDealCount < TYPICAL_MIN_PRICED_DEALS ||
      stats.providerCount < TYPICAL_MIN_PROVIDERS ||
      stats.medianPrice == null ||
      stats.minPrice == null ||
      stats.maxPrice == null
    ) {
      continue
    }
    typical[treatment] = {
      treatment,
      perUnit: stats.perUnit,
      median: stats.medianPrice,
      min: stats.minPrice,
      max: stats.maxPrice,
      pricedDealCount: stats.pricedDealCount,
      providerCount: stats.providerCount,
      minBrand: stats.minBrand,
    }
  }
  return typical
}

export interface VsTypical {
  /** Whole percent away from the typical price, rounded. */
  percent: number
  direction: 'below' | 'above' | 'about'
}

/** Within this of the median a price reads "About typical" — closer is noise, not a deal. */
const ABOUT_TYPICAL = 0.05

/**
 * One deal's comparable price against its city's typical price, or null when there is nothing
 * honest to say: no comparable price (a `check`-tier deal has none), a price the typical leaves
 * out (a starting price, a Dysport unit: typicalExclusion()), no typical price, a treatment
 * outside TYPICAL_TREATMENTS, or the two on different bases (a per-unit figure against a
 * what-you-pay median).
 */
export function vsTypical(
  c: ComparablePrice | null,
  t: TypicalPrice | null | undefined,
): VsTypical | null {
  if (
    !c ||
    typicalExclusion(c) ||
    !t ||
    !TYPICAL_TREATMENTS.has(t.treatment) ||
    c.perUnit !== t.perUnit ||
    !(t.median > 0)
  ) {
    return null
  }
  const diff = (c.amount - t.median) / t.median
  return {
    percent: Math.round(Math.abs(diff) * 100),
    direction:
      Math.abs(diff) < ABOUT_TYPICAL ? 'about' : diff < 0 ? 'below' : 'above',
  }
}

/** "32% below typical" | "12% above typical" | "About typical" */
export function vsTypicalLabel(v: VsTypical): string {
  return v.direction === 'about'
    ? 'About typical'
    : `${v.percent}% ${v.direction} typical`
}

// ─── Printing a typical, or the floor below one ──────────────
// Here rather than in a component: the deals pages and the homepage hero print the same words,
// and one feature component importing another's module is an upward import (CLAUDE.md).

/** "$10 per unit" | "$520.50". A price here always says its basis. */
export function priceText({ amount, perUnit }: ComparablePrice): string {
  return `${formatPrice(amount)}${perUnit ? ' per unit' : ''}`
}

export function typicalText(typical: TypicalPrice): string {
  return priceText({ amount: typical.median, perUnit: typical.perUnit })
}

/**
 * " · lowest is Dysport" after a FLOOR whose brand isn't Botox, else "". The group says
 * "Neurotoxins", and its cheapest row is usually Dysport, whose unit is about a third of a Botox
 * unit (CLAUDE.md). Only after a floor: a range's low end can be above it (minBrandText()).
 */
export function floorBrandText(brand: string | null | undefined): string {
  return brand && brand !== 'Botox' ? ` · lowest is ${brand}` : ''
}

/**
 * " (Xeomin)" after a pooled RANGE's low end whose brand isn't Botox, else "" — the deals page
 * bar's "$9/unit (Xeomin)". Not "lowest is": Dysport sits outside the range and can be lower.
 */
export function minBrandText(brand: string | null | undefined): string {
  return brand && brand !== 'Botox' ? ` (${brand})` : ''
}

/**
 * The floor of these deals (floorPrice(): any brand, no neurotoxin starting price), or null when
 * none has one. Where there is no typical price (every treatment but neurotoxins, see
 * TYPICAL_TREATMENTS, or a city below the floor) this is all a header says: "from $X" claims
 * nothing about a market. Over every brand, not Botox rows only: the label says "Neurotoxins",
 * so any brand's floor is right once it is named (`brand`, floorBrandText()).
 */
export function cheapestComparable(
  deals: AnonymousDeal[],
): ComparablePrice | null {
  let min: ComparablePrice | null = null
  for (const deal of deals) {
    const price = floorPrice(comparablePrice(deal))
    if (price && (!min || price.amount < min.amount)) min = price
  }
  return min
}
