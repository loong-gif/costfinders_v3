import type { MetadataRoute } from 'next'
import { offerTreatmentRoute } from '@/lib/data/adapters'
import { getCategoryBucket } from '@/lib/data/categories'
import { getAvailableGuides, loadGuideContent } from '@/lib/data/guide-content'
import { getOffersWithBusinesses } from '@/lib/data/offers'
import {
  cityToSlug,
  getProvidersByCity,
  getUnifiedCategories,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getStates } from '@/lib/mock-data/states'
import { SITE_CONFIG } from '@/lib/seo/metadata'
import { publicDirectory } from '@/lib/utils/identity'

// THE SITEMAP IS DELIBERATELY BUILD-STATIC. Do not add `export const revalidate` here.
//
// A 2026-09-16 pre-launch work item asked for it, alongside the four location routes. It is correct
// for those four and wrong for this file, and the difference is the whole point: a page route with
// ISR refreshes the CONTENT of a URL that already exists, while this file DECLARES URLs. Every
// route it declares is `dynamicParams = false` with build-time params, so an id this file learns
// about between deploys is a hard 404 with `s-maxage=3600` — and it would be a 404 we handed to a
// crawler ourselves.
//
// The surface is wider than the city pages: `/deals/{offer.id}` per visible offer (below, against
// deals/[[...slugs]]/page.tsx:108 + its build-time enumeration), the provider URLs, `/deals/{city}`
// and `/deals/{treatment}/{city}`. The pipeline lands ~30-70 visible offers in a morning, so an
// hourly sitemap would advertise them within the hour and every one would 404 until the 03:55 UTC
// rebuild hook — up to ~21 hours of self-inflicted 404s a day, on a domain being crawled for the
// first time.
//
// The 2026-09-11 launch plan (item C20) had already decided this and named the precondition: "Keep
// the sitemap build-coupled (or flip `dynamicParams` first) so it never lists ids that 404". Both
// planning docs left the repo on 2026-09-30 (git history has them). The rule holds until
// `dynamicParams` is flipped, which is itself blocked (deals/[[...slugs]]/page.tsx:108 — a shared
// loading.tsx swallows notFound(), so `dynamicParams = true` answers unknown slugs with 200
// soft-404s instead).
//
// For the record, the mechanism DOES work here — Next's next-metadata-route-loader re-exports every
// userland named export except `default`, `generateSitemaps` and `dynamicParams`. It is omitted
// because it should be, not because it has no effect.

/**
 * Sitemap Configuration
 *
 * Every URL here is derived from the same sources the routes themselves use, so
 * a URL in the sitemap is a URL that resolves:
 * - states     → SUPPORTED_STATES (the [state] route's generateStaticParams),
 *                intersected with states that have at least one city WITH DEALS
 * - cities     → getUnifiedCities() (Supabase master_business_info), same deals filter
 * - providers  → getProvidersByCity() (same source as the provider route)
 * - deals      → getOffersWithBusinesses() (Supabase promo_offer_master, priced
 *                offers only — an offer with neither a price nor a stated discount is hidden
 *                from the UI too; there are 0 such offers today)
 * - categories → getUnifiedCategories() (DB service_category values)
 * - guides     → getAvailableGuides() (src/content/guides/*.json)
 *
 * Deliberately NOT emitted:
 * - Neighborhood pages: the route was deleted on 2026-09-18. It was mock-backed, and once
 *   Austin arrived in Supabase its three fixture neighborhoods prerendered fabricated deals.
 * - /treatments/[category]/[state]: that route does not exist.
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
 */
const SITEMAP_CONFIG = {
  URL_LIMIT: 50000,
  MIGRATION_THRESHOLD: 45000, // Switch to generateSitemaps when approaching limit
} as const

/**
 * Every lastmod here is the `updated_at` of the freshest offer the page lists. There is no
 * fallback date: a page with nothing datable carries no <lastmod> (it is optional), where it used
 * to carry a frozen 2026-01-14 — a date that never moves while the page does, which is the
 * pattern that teaches a crawler to ignore lastmod.
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_CONFIG.url

  const [allCities, offers, categories] = await Promise.all([
    getUnifiedCities(),
    getOffersWithBusinesses(),
    getUnifiedCategories(),
  ])

  // Freshest offer per city and per treatment+city, so the location and listing pages carry
  // a lastmod that moves when their content does. They all reported one frozen January date
  // for pages whose deals change under them; a lastmod that never moves while the page does
  // is a signal Google learns to ignore.
  const freshestByCity = new Map<string, Date>()
  const freshestByCombo = new Map<string, Date>()
  const freshestByBucket = new Map<string, Date>()
  const noteFreshest = <K>(map: Map<K, Date>, key: K, at: Date) => {
    const current = map.get(key)
    if (!current || at > current) map.set(key, at)
  }
  for (const offer of offers) {
    const cityName = offer.master_business_info?.city
    const stamp = offer.updated_at ?? offer.created_at
    if (!cityName?.trim() || !stamp) continue
    const at = new Date(stamp)
    const citySlug = cityToSlug(cityName)
    noteFreshest(freshestByCity, citySlug, at)
    const treatment = offerTreatmentRoute(offer.service_category)
    if (treatment) noteFreshest(freshestByCombo, `${treatment}/${citySlug}`, at)
    const bucket = getCategoryBucket(offer.service_category)
    if (bucket) noteFreshest(freshestByBucket, bucket.slug, at)
  }
  const cityLastModified = (citySlug: string) => freshestByCity.get(citySlug)

  // The freshest offer anywhere. The homepage, /deals and /treatments all revalidate against
  // this catalogue, so a January constant on them was a lastmod that could never move while
  // the pages changed underneath it — the pattern that teaches a crawler to ignore lastmod.
  const latest = (dates: Iterable<Date | undefined>) =>
    [...dates].reduce<Date | undefined>(
      (max, at) => (at && (!max || at > max) ? at : max),
      undefined,
    )
  const catalogueLastModified = latest(freshestByCity.values())

  // Cities that resolve: a real Supabase city whose inferred state is one the
  // [state] route serves. Anything else 404s, so it must not ship.
  const supportedStates = getStates()
  const cities = allCities.flatMap((city) => {
    const state = supportedStates.find((s) => s.code === city.stateCode)
    return state ? [{ city, state }] : []
  })

  // ═══════════════════════════════════════════════════════════════════
  // Section 1: Static Pages
  // ═══════════════════════════════════════════════════════════════════
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: catalogueLastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/deals`,
      lastModified: catalogueLastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/treatments`,
      lastModified: catalogueLastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // /business is linked from the homepage and the footer but was never declared. Privacy
    // and terms are low value to rank and high value to have crawled — they are the pages a
    // reviewer looks for when judging whether a site is a real business.
    {
      url: `${baseUrl}/business`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Static copy, so no lastmod: nothing in the data dates it.
    {
      url: `${baseUrl}/how-it-works`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy/do-not-sell`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  // ═══════════════════════════════════════════════════════════════════
  // Section 2: Location Hierarchy - States
  // Only states that actually have cities in the data
  // ═══════════════════════════════════════════════════════════════════
  // "Populated" means HAS DEALS, not has businesses. `freshestByCity` above holds one entry per
  // city with at least one publicly visible offer, so it is the same "no empty landing pages" rule
  // sections 7 and 8 already apply — stated there, but never applied to the state and city pages.
  //
  // It did not matter while SUPPORTED_STATES was a hand-written four. Deriving the state list from
  // the data (2026-09-16) made every state resolvable, and three of them — MA, ID and MD — have
  // exactly one business and ZERO visible deals each, so they would have been the first zero-deal
  // state pages this file ever declared. The routes still EXIST and still render the provider they
  // have; they are simply not advertised to a crawler as deal pages, which is what /[state] and
  // /[state]/[city] present themselves as.
  const citiesWithDeals = cities.filter(({ city }) =>
    freshestByCity.has(city.slug),
  )
  const populatedStateSlugs = new Set(
    citiesWithDeals.map(({ state }) => state.slug),
  )
  const statePages: MetadataRoute.Sitemap = supportedStates
    .filter((state) => populatedStateSlugs.has(state.slug))
    .map((state) => ({
      url: `${baseUrl}/${state.slug}`,
      lastModified: latest(
        citiesWithDeals
          .filter((c) => c.state.slug === state.slug)
          .map((c) => cityLastModified(c.city.slug)),
      ),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 3: Location Hierarchy - Cities
  // ═══════════════════════════════════════════════════════════════════
  const cityPages: MetadataRoute.Sitemap = citiesWithDeals.map(
    ({ city, state }) => ({
      url: `${baseUrl}/${state.slug}/${city.slug}`,
      lastModified: cityLastModified(city.slug),
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 4: Provider Pages
  // Same per-city fetch the provider route's generateStaticParams uses.
  // Businesses with an unnamed (empty) slug have no reachable URL.
  // Only in cities with deals, the rule the city pages follow, and only where the city's
  // directory is public (publicDirectory: 4+ clinics). Any other provider page still renders
  // (noindex, follow — see its generateMetadata) but is not declared.
  // No lastmod: it was the freshest updated_at among the clinic's own deals, which matched that
  // clinic's deal URLs below to the provider page and named the clinic behind them. The public
  // directory carries no business_id, so there is nothing to date a provider page by.
  // ═══════════════════════════════════════════════════════════════════
  const providersPerCity = await Promise.all(
    citiesWithDeals.map(({ city }) => getProvidersByCity(city.name)),
  )
  const providerUrls = new Set<string>()
  for (const [i, providers] of providersPerCity.entries()) {
    const { city, state } = citiesWithDeals[i]
    for (const provider of publicDirectory(providers)) {
      providerUrls.add(
        `${baseUrl}/${state.slug}/${city.slug}/provider/${provider.slug}`,
      )
    }
  }
  const providerPages: MetadataRoute.Sitemap = [...providerUrls].map((url) => ({
    url,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 5: Category/Treatment Pages
  // Route: /treatments/[category] — DB category slugs, not mock ones.
  // Several DB categories share one bucket slug, so dedupe.
  // ═══════════════════════════════════════════════════════════════════
  const categorySlugs = new Set(categories.map((category) => category.slug))
  const categoryPages: MetadataRoute.Sitemap = [...categorySlugs].map(
    (slug) => ({
      url: `${baseUrl}/treatments/${slug}`,
      lastModified: freshestByBucket.get(slug),
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  )

  // ═══════════════════════════════════════════════════════════════════
  // Section 6: Deal Detail Pages
  // Route: /deals/[id]
  // ═══════════════════════════════════════════════════════════════════
  // Offers with no linked business have no city, so no city or treatment page lists them and
  // nothing in the app links to them. Declaring them anyway shipped 94 orphan URLs whose only
  // inbound reference was this file.
  const dealPages: MetadataRoute.Sitemap = offers
    .filter((offer) => offer.master_business_info?.city?.trim())
    .map((offer) => ({
      url: `${baseUrl}/deals/${offer.id}`,
      lastModified: new Date(offer.updated_at ?? offer.created_at),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

  // ═══════════════════════════════════════════════════════════════════
  // Sections 7 & 8: City Deals + Treatment/City Deals
  // Routes: /deals/[city] and /deals/[treatment]/[city]
  // Derived from the offers we already fetched, so a combo only ships when
  // at least one real deal backs it (no empty landing pages).
  // ═══════════════════════════════════════════════════════════════════
  const citySlugsWithDeals = new Set<string>()
  const treatmentCityCombos = new Set<string>()
  for (const offer of offers) {
    const cityName = offer.master_business_info?.city
    if (!cityName?.trim()) continue
    const citySlug = cityToSlug(cityName)
    citySlugsWithDeals.add(citySlug)
    // Uncategorised offers reach no treatment page, so they must not mint one. Routing them
    // through the total mapper declared /deals/body/<city> URLs that render "0 Deals".
    const treatment = offerTreatmentRoute(offer.service_category)
    if (treatment) treatmentCityCombos.add(`${treatment}/${citySlug}`)
  }

  const cityDealsPages: MetadataRoute.Sitemap = [...citySlugsWithDeals].map(
    (citySlug) => ({
      url: `${baseUrl}/deals/${citySlug}`,
      lastModified: cityLastModified(citySlug),
      changeFrequency: 'daily',
      priority: 0.8,
    }),
  )

  const treatmentCityPages: MetadataRoute.Sitemap = [
    ...treatmentCityCombos,
  ].map((combo) => ({
    url: `${baseUrl}/deals/${combo}`,
    lastModified: freshestByCombo.get(combo),
    changeFrequency: 'daily',
    priority: 0.75,
  }))

  // ═══════════════════════════════════════════════════════════════════
  // Section 9: Cost Guide Pages
  // Route: /guides/[slug] (e.g., /guides/botox-cost-tucson)
  // ═══════════════════════════════════════════════════════════════════
  const guidePages: MetadataRoute.Sitemap = [
    // The hub itself. It was missing, so the only declared entry points into the guide
    // cluster were the guides themselves -- and the breadcrumb on every one of them
    // pointed at a URL that did not exist.
    {
      url: `${baseUrl}/guides`,
      lastModified: catalogueLastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...getAvailableGuides().map((guide) => ({
      url: `${baseUrl}/guides/${guide.slug}`,
      // The guide's own authoring date, not the site-wide frozen fallback. Shipping a
      // January lastmod for a page that prints "researched March" and refreshes its prices
      // daily gave Google three different freshness answers for one URL.
      // The later of the prose's authoring date and its freshest live price.
      lastModified: latest([
        freshestByCombo.get(`${guide.treatment}/${guide.city}`),
        ...[loadGuideContent(guide.slug)?.generatedAt]
          .filter((d): d is string => Boolean(d))
          .map((d) => new Date(d)),
      ]),
      // Guides re-read live Supabase pricing on every ISR pass, so the rendered prices
      // change far more often than the researched prose around them.
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
  ]

  const allUrls = [
    ...staticPages,
    ...statePages,
    ...cityPages,
    ...providerPages,
    ...categoryPages,
    ...dealPages,
    ...cityDealsPages,
    ...treatmentCityPages,
    ...guidePages,
  ]

  // ponytail: single-file sitemap until we actually approach Google's cap;
  // switch to generateSitemaps() (see migration path above) if this trips.
  if (allUrls.length > SITEMAP_CONFIG.MIGRATION_THRESHOLD) {
    return allUrls.slice(0, SITEMAP_CONFIG.URL_LIMIT)
  }

  return allUrls
}
