import fs from 'node:fs'
import path from 'node:path'
import type { GuideContent, GuideEntry } from '@/types/guide'

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
    return files.map((file) => {
      const slug = file.replace('.json', '')
      const parsed = parseGuideSlug(slug)
      return {
        treatment: parsed?.treatment ?? '',
        city: parsed?.city ?? '',
        slug,
      }
    }).filter((g) => g.treatment && g.city)
  } catch {
    return []
  }
}

const VALID_TREATMENTS = new Set([
  'botox',
  'fillers',
  'facials',
  'laser',
  'body',
  'skincare',
])

/**
 * Parse a composite guide slug into treatment and city parts.
 * e.g., "botox-pricing-tucson" → { treatment: "botox", city: "tucson" }
 * e.g., "fillers-pricing-oklahoma-city" → { treatment: "fillers", city: "oklahoma-city" }
 */
export function parseGuideSlug(
  slug: string,
): { treatment: string; city: string } | null {
  const pricingIdx = slug.indexOf('-pricing-')
  if (pricingIdx === -1) return null

  const treatment = slug.slice(0, pricingIdx)
  const citySlug = slug.slice(pricingIdx + '-pricing-'.length)

  if (!VALID_TREATMENTS.has(treatment)) return null
  if (!citySlug) return null

  return { treatment, city: citySlug }
}
