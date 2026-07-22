import type { MetadataRoute } from 'next'
import { getAvailableGuides } from '@/lib/data/guide-content'
import {
  getAllActiveCitySlugs,
  getAllTreatmentCityCombos,
} from '@/lib/mock-data'
import {
  getAllCategorySlugs,
  getCategoryStateComboSlugs,
} from '@/lib/mock-data/categories'
import { getAllCitiesWithState } from '@/lib/mock-data/cities'
import { getAllDealIds } from '@/lib/mock-data/deals'
import { getAllNeighborhoodsWithCityAndState } from '@/lib/mock-data/neighborhoods'
import { getAllProvidersWithCityAndState } from '@/lib/mock-data/providers'
import { getStates } from '@/lib/mock-data/states'

/**
 * Sitemap Configuration
 *
 * URL Limit: Google supports up to 50,000 URLs per sitemap file.
 * When total URLs exceed ~45,000, switch to generateSitemaps() pattern
 * which creates multiple sitemap files with a sitemap index.
 *
 * Migration path (when needed):
 * 1. Rename this file or create src/app/sitemap/[id]/route.ts
 * 2. Export generateSitemaps() returning array of { id: number }
 * 3. Each sitemap function receives { id } and returns subset of URLs
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 *
 * Current section sizes (updated 2026-01-14):
 * - Static pages: 2
 * - State pages: 4
 * - City pages: ~11 (Orange County focus)
 * - Neighborhood pages: ~24
 * - Provider pages: ~6
 * - Category pages: 6
 * - Deal pages: ~12 (active deals)
 * - Category-state combos: 24 (6 categories × 4 states)
 * ─────────────────────────────────
 * Total: ~89 URLs (well under limit)
 */
const SITEMAP_CONFIG = {
  URL_LIMIT: 50000,
  MIGRATION_THRESHOLD: 45000, // Switch to generateSitemaps when approaching limit
  // Fallback date for static content without timestamps
  STATIC_CONTENT_DATE: new Date('2026-01-14'),
} as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || 'https://www.costfinders.ai'

  // ═══════════════════════════════════════════════════════════════════
  // Section 1: Static Pages
  // Count: 2 URLs (homepage, deals listing)
  // ═══════════════════════════════════════════════════════════════════
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/deals`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  // ═══════════════════════════════════════════════════════════════════
  // Section 2: Location Hierarchy - States
  // Count: 4 URLs (CA, TX, NY, FL)
  // ═══════════════════════════════════════════════════════════════════
  const states = getStates()
  const statePages: MetadataRoute.Sitemap = states.map((state) => ({
    url: `${baseUrl}/${state.slug}`,
    lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 3: Location Hierarchy - Cities
  // Count: ~11 URLs (Orange County cities)
  // ═══════════════════════════════════════════════════════════════════
  const citiesWithState = getAllCitiesWithState()
  const cityPages: MetadataRoute.Sitemap = citiesWithState.map(
    ({ stateSlug, citySlug }) => ({
      url: `${baseUrl}/${stateSlug}/${citySlug}`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 4: Location Hierarchy - Neighborhoods
  // Count: ~24 URLs (2-3 neighborhoods per city)
  // ═══════════════════════════════════════════════════════════════════
  const neighborhoodsWithContext = getAllNeighborhoodsWithCityAndState()
  const neighborhoodPages: MetadataRoute.Sitemap = neighborhoodsWithContext.map(
    ({ stateSlug, citySlug, neighborhoodSlug }) => ({
      url: `${baseUrl}/${stateSlug}/${citySlug}/${neighborhoodSlug}`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'weekly',
      priority: 0.6,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 5: Provider Pages
  // Count: ~6 URLs (mock businesses)
  // ═══════════════════════════════════════════════════════════════════
  const providersWithContext = getAllProvidersWithCityAndState()
  const providerPages: MetadataRoute.Sitemap = providersWithContext.map(
    ({ business, stateSlug, citySlug }) => ({
      url: `${baseUrl}/${stateSlug}/${citySlug}/provider/${business.slug}`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'weekly',
      priority: 0.5,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 6: Category/Treatment Pages
  // Count: 6 URLs (botox, fillers, facials, laser, body, skincare)
  // ═══════════════════════════════════════════════════════════════════
  const categorySlugs = getAllCategorySlugs()
  const categoryPages: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${baseUrl}/treatments/${slug}`,
    lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 7: Deal Detail Pages
  // Count: ~12 URLs (active, approved deals)
  // Note: Uses actual deal.updatedAt for accurate lastModified
  // ═══════════════════════════════════════════════════════════════════
  const dealData = getAllDealIds()
  const dealPages: MetadataRoute.Sitemap = dealData.map(
    ({ id, updatedAt }) => ({
      url: `${baseUrl}/deals/${id}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'weekly',
      priority: 0.6,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 8: Category-State Combination Pages
  // Count: 24 URLs (6 categories × 4 states)
  // Route: /treatments/[category]/[state] (e.g., /treatments/botox/california)
  // Note: Actual pages planned for Phase 31+ ("Botox in California" landing pages)
  // ═══════════════════════════════════════════════════════════════════
  const categoryStateCombos = getCategoryStateComboSlugs()
  const categoryStatePages: MetadataRoute.Sitemap = categoryStateCombos.map(
    ({ categorySlug, stateSlug }) => ({
      url: `${baseUrl}/treatments/${categorySlug}/${stateSlug}`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'weekly',
      priority: 0.65,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 9: City Deals Pages
  // Count: 6 URLs (one per active city)
  // Route: /deals/[city] (e.g., /deals/houston)
  // Target keywords: "medspa deals [city]"
  // ═══════════════════════════════════════════════════════════════════
  const citySlugs = getAllActiveCitySlugs()
  const cityDealsPages: MetadataRoute.Sitemap = citySlugs.map((citySlug) => ({
    url: `${baseUrl}/deals/${citySlug}`,
    lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 10: Treatment+City Combination Pages
  // Count: 36 URLs (6 treatments × 6 cities)
  // Route: /deals/[treatment]/[city] (e.g., /deals/botox/houston)
  // Target keywords: "botox houston", "botox deals houston"
  // ═══════════════════════════════════════════════════════════════════
  const treatmentCityCombos = getAllTreatmentCityCombos()
  const treatmentCityPages: MetadataRoute.Sitemap = treatmentCityCombos.map(
    ({ treatment, city }) => ({
      url: `${baseUrl}/deals/${treatment}/${city}`,
      lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
      changeFrequency: 'daily',
      priority: 0.75,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 11: Pricing Guide Pages
  // Count: ~10 URLs (5 Botox + 5 Fillers across top cities)
  // Route: /guides/[slug] (e.g., /guides/botox-pricing-tucson)
  // Target keywords: "[treatment] pricing [city]"
  // ═══════════════════════════════════════════════════════════════════
  const guides = getAvailableGuides()
  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${baseUrl}/guides/${guide.slug}`,
    lastModified: SITEMAP_CONFIG.STATIC_CONTENT_DATE,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Combine All Sections
  // Total: ~141 URLs (well under 50,000 limit)
  // ═══════════════════════════════════════════════════════════════════
  const allUrls = [
    ...staticPages, // 2 URLs
    ...statePages, // 4 URLs
    ...cityPages, // ~11 URLs
    ...neighborhoodPages, // ~24 URLs
    ...providerPages, // ~6 URLs
    ...categoryPages, // 6 URLs
    ...dealPages, // ~12 URLs
    ...categoryStatePages, // 24 URLs
    ...cityDealsPages, // 6 URLs
    ...treatmentCityPages, // 36 URLs
    ...guidePages, // ~10 URLs
  ]

  return allUrls
}
