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

  /** Section: [City] vs National Average */
  nationalComparison: {
    nationalAvgPerUnit?: number
    nationalAvgPerSyringe?: number
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
  providerCount: number
  minPrice: number | null
  maxPrice: number | null
  avgPrice: number | null
  medianPrice: number | null
  /** Breakdown by template type */
  byTemplateType: Array<{
    templateType: string
    count: number
    avgPrice: number | null
    minPrice: number | null
    maxPrice: number | null
  }>
  /** Breakdown by unit type */
  byUnitType: Array<{
    unitType: string
    count: number
    avgPrice: number | null
  }>
}

/** Guide registry entry for sitemap and navigation */
export interface GuideEntry {
  treatment: string
  city: string
  slug: string
}
