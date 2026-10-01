import fs from 'node:fs'
import path from 'node:path'
import type { TreatmentCategory } from '@/types/deal'
import type { GuideContent, GuideEntry, GuideSummary } from '@/types/guide'

const GUIDES_DIR = path.join(process.cwd(), 'src/content/guides')

/**
 * Load guide content from a JSON file.
 * Returns null if the file doesn't exist (triggers 404).
 */
export function loadGuideContent(slug: string): GuideContent | null {
  const filePath = path.join(GUIDES_DIR, `${slug}.json`)
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as GuideContent
  } catch {
    return null
  }
}

/**
 * Get all available guide entries by scanning the content directory.
 * Used by sitemap and navigation components.
 */
export function getAvailableGuides(): GuideEntry[] {
  try {
    const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.json'))
    return files
      .map((file) => {
        const slug = file.replace('.json', '')
        const parsed = parseGuideSlug(slug)
        return {
          treatment: parsed?.treatment ?? '',
          city: parsed?.city ?? '',
          slug,
        }
      })
      .filter((g) => g.treatment && g.city)
  } catch {
    return []
  }
}

/**
 * Every guide's identity, read from its JSON. The hub needs display labels and states that
 * a slug alone cannot supply, and getAvailableGuides() only parses slugs.
 */
export function getGuideSummaries(): GuideSummary[] {
  return getAvailableGuides()
    .flatMap((entry) => {
      const content = loadGuideContent(entry.slug)
      if (!content) return []
      return [
        {
          slug: entry.slug,
          treatment: content.treatment,
          treatmentLabel: content.treatmentLabel,
          city: content.city,
          cityLabel: content.cityLabel,
          state: content.state,
          stateCode: content.stateCode,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        a.cityLabel.localeCompare(b.cityLabel) ||
        a.treatmentLabel.localeCompare(b.treatmentLabel),
    )
}

/**
 * The treatments a guide can be about, and the label a guide prints for each. These are the
 * guide cluster's own words ("Botox cost", "Microneedling cost"), not TREATMENT_LABELS in
 * adapters.ts: that map reads "Neurotoxins" over a pooled price, and the guide page names the
 * cheapest brand beside every pooled figure itself. scripts/generate-guides.ts derives the guide
 * set from these keys, so adding a treatment here is what makes it eligible for a guide.
 */
export const GUIDE_TREATMENT_LABELS = {
  botox: 'Botox',
  fillers: 'Dermal Fillers',
  facials: 'Facials',
  laser: 'Laser Treatments',
  body: 'Body Contouring',
  skincare: 'Microneedling',
} as const satisfies Partial<Record<TreatmentCategory, string>>

export type GuideTreatment = keyof typeof GUIDE_TREATMENT_LABELS

const VALID_TREATMENTS = new Set<string>(Object.keys(GUIDE_TREATMENT_LABELS))

/**
 * Parse a composite guide slug into treatment and city parts.
 * e.g., "botox-cost-tucson" → { treatment: "botox", city: "tucson" }
 * e.g., "fillers-cost-oklahoma-city" → { treatment: "fillers", city: "oklahoma-city" }
 */
export function parseGuideSlug(
  slug: string,
): { treatment: string; city: string } | null {
  const costIdx = slug.indexOf('-cost-')
  if (costIdx === -1) return null

  const treatment = slug.slice(0, costIdx)
  const citySlug = slug.slice(costIdx + '-cost-'.length)

  if (!VALID_TREATMENTS.has(treatment)) return null
  if (!citySlug) return null

  return { treatment, city: citySlug }
}

/**
 * Does a published guide exist for this slug? Cheap existence check for cross-links, so a
 * page never links into a guide URL that would 404.
 */
export function guideExists(slug: string): boolean {
  return fs.existsSync(path.join(GUIDES_DIR, `${slug}.json`))
}

/**
 * What a guide file must contain before it is published. Structured output guarantees the
 * generator's JSON has the right SHAPE; it does not stop a field arriving as "x", which is
 * exactly what the Competition card printed on the first generated Newport Beach guide. Every
 * threshold is comfortably under the 30 hand-written guides, so this catches an empty or
 * truncated section and the vocabulary rule (docs/MESSAGING-STYLE-GUIDE.md §3.5), not style.
 * `npm run generate:guides -- --check` runs it over every file; the gate runs that.
 */
export function guideContentDefects(content: GuideContent): string[] {
  const defects: string[] = []
  const text = (at: string, value: unknown, min: number) => {
    if (typeof value !== 'string' || value.trim().length < min) {
      defects.push(`${at}: under ${min} characters`)
    }
  }
  const count = (at: string, value: unknown, lo: number, hi: number) => {
    const n = Array.isArray(value) ? value.length : 0
    if (n < lo || n > hi)
      defects.push(`${at}: ${n} entries, expected ${lo}–${hi}`)
    return Array.isArray(value) ? value : []
  }
  // The word with zero search volume in the cost cluster. "price"/"prices" stay allowed: a
  // clinic quotes a price, and the style guide keeps that (§3.5).
  const rankingWord = /\bpricing\b/i

  text('howPricingWorks.intro', content.howPricingWorks?.intro, 120)
  count(
    'howPricingWorks.pricingModels',
    content.howPricingWorks?.pricingModels,
    2,
    6,
  ).forEach((m, i) => {
    text(`howPricingWorks.pricingModels[${i}].name`, m.name, 6)
    text(`howPricingWorks.pricingModels[${i}].description`, m.description, 60)
    text(`howPricingWorks.pricingModels[${i}].typicalRange`, m.typicalRange, 6)
  })
  text('whatAffectsPricing.intro', content.whatAffectsPricing?.intro, 60)
  count(
    'whatAffectsPricing.factors',
    content.whatAffectsPricing?.factors,
    3,
    7,
  ).forEach((f, i) => {
    text(`whatAffectsPricing.factors[${i}].factor`, f.factor, 6)
    text(`whatAffectsPricing.factors[${i}].explanation`, f.explanation, 60)
  })
  text('howToSave.intro', content.howToSave?.intro, 60)
  count('howToSave.tips', content.howToSave?.tips, 3, 7).forEach((t, i) => {
    text(`howToSave.tips[${i}].tip`, t.tip, 6)
    text(`howToSave.tips[${i}].detail`, t.detail, 60)
  })
  text(
    'nationalComparison.comparisonText',
    content.nationalComparison?.comparisonText,
    60,
  )
  count('faqs', content.faqs, 4, 12).forEach((f, i) => {
    text(`faqs[${i}].question`, f.question, 12)
    if (!(f.question ?? '').trim().endsWith('?')) {
      defects.push(`faqs[${i}].question does not end with "?": ${f.question}`)
    }
    if (rankingWord.test(f.question ?? '')) {
      defects.push(`faqs[${i}].question says "pricing": ${f.question}`)
    }
    text(`faqs[${i}].answer`, f.answer, 80)
  })
  // Five hand-written guides hold a one-word density ("high"); a word is thin, not broken.
  text('cityContext.medspaDensity', content.cityContext?.medspaDensity, 3)
  text(
    'cityContext.demographicNotes',
    content.cityContext?.demographicNotes,
    60,
  )
  text(
    'cityContext.competitionNotes',
    content.cityContext?.competitionNotes,
    60,
  )
  return defects
}
