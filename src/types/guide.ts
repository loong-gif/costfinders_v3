import type { TreatmentCategory } from './deal'

/** Pre-generated guide content stored in src/content/guides/*.json */
export interface GuideContent {
  /** Treatment slug (e.g., "botox", "fillers") */
  treatment: TreatmentCategory
  /** Display label (e.g., "Botox", "Fillers") */
  treatmentLabel: string
  /** City slug (e.g., "tucson") */
  city: string
  /** Display city name (e.g., "Tucson") */
  cityLabel: string
  /** State name (e.g., "Arizona") */
  state: string
  /** State abbreviation (e.g., "AZ") */
  stateCode: string
  /** ISO date when content was generated */
  generatedAt: string

  /** Section: How [Treatment] is Priced */
  howPricingWorks: {
    intro: string
    pricingModels: Array<{
      name: string
      description: string
      typicalRange: string
    }>
  }

  /** Section: What Affects Pricing in [City] */
  whatAffectsPricing: {
    intro: string
    factors: Array<{
      factor: string
      explanation: string
    }>
  }

  /** Section: How to Save on [Treatment] in [City] */
  howToSave: {
    intro: string
    tips: Array<{
      tip: string
      detail: string
    }>
  }

  /**
   * Section: [City] vs National Average
   *
   * Both sides of this comparison are researched figures held in this file, deliberately.
   * The chart used to plot `nationalAvgPerUnit` against a per-unit average derived from
   * live offers, but the DB's per-unit rows mix true per-unit rates ($8/unit) with whole
   * package totals filed under the same unit ($139 for 20 units). That produced
   * "Tucson is 1053% above the national average" printed directly under prose reading
   * "roughly 47% below". Comparing two researched, like-for-like figures is the only
   * honest version; omit `localAvgPerUnit`/`localAvgPerSyringe` and the chart is skipped.
   */
  nationalComparison: {
    /** Exactly one national/local pair should be set, matching the treatment's usual unit:
     * per unit for neurotoxins, per syringe for fillers, per session for everything else. */
    nationalAvgPerUnit?: number
    nationalAvgPerSyringe?: number
    nationalAvgPerSession?: number
    localAvgPerUnit?: number
    localAvgPerSyringe?: number
    localAvgPerSession?: number
    comparisonText: string
  }

  /** Section: FAQ */
  faqs: Array<{
    question: string
    answer: string
  }>

  /** City-specific research context */
  cityContext: {
    costOfLivingIndex?: number
    medspaDensity: string
    demographicNotes: string
    competitionNotes: string
  }
}

/** Real-time pricing stats computed from Supabase */
export interface GuidePricingStats {
  dealCount: number
  /**
   * How many of `dealCount` have a comparable price — `comparablePrice()` in
   * src/lib/data/adapters.ts, per unit on a neurotoxin guide — and therefore how many the median,
   * average, min–max spread and `byService` were computed from.
   *
   * These two numbers are not the same and a guide must not imply they are. `dealCount` counts
   * every publicly visible offer, including a "20% off" with no base price and, on a per-unit
   * guide, a flat price with no unit count to divide by. Attributing a median to `dealCount`
   * overstates the sample behind a cost claim on a public page. Use this field wherever the copy
   * says what the numbers are based on.
   */
  pricedDealCount: number
  providerCount: number
  /**
   * True when every price figure in this object — min/max/avg/median and `byService` — is a
   * price PER UNIT. Neurotoxin guides compare per unit (decided 2026-09-18), because pooling
   * "$10/unit" with "40 units for $299" made the Botox guide's "typical price" a median of two
   * different things. Every surface printing these figures must say "per unit" when it is set.
   * See `comparablePrice()` in src/lib/data/adapters.ts.
   */
  perUnit: boolean
  /**
   * The low end of the pooled RANGE (pooledPrice() in src/lib/data/typicalPrice.ts): with
   * maxPrice, avgPrice and medianPrice, the figures a range, a median or "typical" prints. Not
   * the floor — on a neurotoxin guide Dysport sits outside it and is often lower (`floorPrice`).
   */
  minPrice: number | null
  /**
   * The neurotoxin brand `minPrice` is a price of, on a per-unit group; null otherwise or when
   * nothing names one. A group labelled Botox pools every brand but Dysport (pooledPrice(),
   * 2026-09-28), so its range can start at a Xeomin or Jeuveau unit — printed in brackets after
   * that figure (minBrandText()), never as "lowest is".
   */
  minBrand: string | null
  maxPrice: number | null
  avgPrice: number | null
  medianPrice: number | null
  /**
   * The FLOOR: the cheapest comparable price of any brand, Dysport included, never a neurotoxin
   * starting price (floorPrice()). What "Starting at" and the /guides hub's "from $X" print, the
   * same figure as the deals pages' "from $X". At or below `minPrice`.
   */
  floorPrice: number | null
  /** The neurotoxin brand of `floorPrice`, named after it with floorBrandText(). */
  floorBrand: string | null
  /**
   * Breakdown by the specific product or service offered (Botox / Dysport / Daxxify,
   * Juvederm / Sculptra / Kybella). Medians, not means: package totals sit in the same
   * column as single-treatment prices and wreck an average.
   */
  byService: Array<{
    name: string
    count: number
    minPrice: number
    maxPrice: number
    medianPrice: number
  }>
  /**
   * Price per ONE unit, grouped by that unit ("Per unit", "Per syringe"), from every deal whose
   * price states or divides to one — `perUnitPrice()` in src/lib/data/adapters.ts. It used to
   * group by the service's `unit_type` and pool whatever price the row had, so "Per unit" was
   * the median of $10 rates and $299 packages. Independent of `perUnit` above.
   */
  byUnitType: Array<{
    unitType: string
    count: number
    medianPrice: number
    minPrice: number
    maxPrice: number
  }>
}

/** Guide registry entry for sitemap and navigation */
export interface GuideEntry {
  treatment: string
  city: string
  slug: string
}

/** A guide's display identity, for the /guides hub and cross-links. */
export interface GuideSummary {
  slug: string
  treatment: TreatmentCategory
  treatmentLabel: string
  city: string
  cityLabel: string
  state: string
  stateCode: string
}

/** Live counts a hub or cross-link card shows next to a guide. */
export interface GuideIndexStat {
  dealCount: number
  providerCount: number
  /** The guide's floor, its "Starting at" (see GuidePricingStats.floorPrice). */
  floorPrice: number | null
  /** The neurotoxin brand of `floorPrice` (see GuidePricingStats.floorBrand). */
  floorBrand: string | null
  /** `floorPrice` is a price per unit (neurotoxin guides) — print it as such. */
  perUnit: boolean
}
