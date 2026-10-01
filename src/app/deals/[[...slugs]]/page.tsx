import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { CityDealsPage } from '@/components/features/deals/cityDealsPage'
import { DealDetailPage } from '@/components/features/deals/dealDetailPage'
import { TreatmentCityPage } from '@/components/features/deals/treatmentCityPage'
import { BreadcrumbSchema, DealOfferSchema } from '@/components/seo'
import {
  dealPricing,
  getTreatmentLabel,
  offerTreatmentRoute,
} from '@/lib/data/adapters'
import { guideExists } from '@/lib/data/guide-content'
import { getOffersWithBusinesses } from '@/lib/data/offers'
import { TYPICAL_TREATMENTS, typicalPrices } from '@/lib/data/typicalPrice'
import {
  cityToSlug,
  getActiveDeals,
  getBusinessCountForCity,
  getCityDealCounts,
  getDealById,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  getDealWithBusinessId,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getOffersForCitySlug,
  getProvidersByCity,
  getUnifiedCities,
} from '@/lib/data/unified'
import {
  budgetedTitle,
  buildCanonicalUrl,
  generateCityDealsMetadata,
  generateTreatmentCityMetadata,
  OG_IMAGE,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import {
  buildDealsListSchema,
  buildTreatmentServiceSchema,
} from '@/lib/seo/schemas'
import { publicDirectory } from '@/lib/utils/identity'
import type { TreatmentCategory } from '@/types/deal'
import type { OfferView } from '@/types/supabase'

export const revalidate = 3600 // ISR: regenerate every hour

/** Google truncates meta descriptions around 160 characters. */
const META_DESCRIPTION_CHARS = 155

/**
 * A not-found response used to answer with the deals hub's own title and description, so an
 * unresolvable slug looked to a crawler like a legitimate landing page returning 200.
 */
const NOT_FOUND_METADATA: Metadata = {
  title: 'Page not found',
  description: 'This deal is no longer available.',
  robots: { index: false, follow: false },
}

/**
 * The /{state}/{city} hub path for a city slug, or null when no served state owns it.
 * Both URLs describe one city; without a link between them they read as duplicates.
 * Also null where the hub lists no providers (publicDirectory: fewer than 4 clinics), because
 * the link reads "Browse <city> medspas by provider". The hub still links here.
 */
async function getCityHubPath(citySlug: string): Promise<string | null> {
  const [cities, { getStates }] = await Promise.all([
    getUnifiedCities(),
    import('@/lib/mock-data/states'),
  ])
  const city = cities.find((c) => c.slug === citySlug)
  if (!city) return null
  const state = getStates().find((s) => s.code === city.stateCode)
  if (!state) return null
  const listed = publicDirectory(await getProvidersByCity(city.name))
  return listed.length > 0 ? `/${state.slug}/${city.slug}` : null
}

/**
 * Providers with at least one listed deal — what /deals prints beside each city. The city page
 * used getBusinessCountForCity(), which counts every business in the city, and so read
 * "74 deals from 31 providers" over deals that came from 10.
 */
function providersWithDeals(offers: OfferView[]): number {
  return new Set(offers.map((o) => o.business_id)).size
}

/** Live deals per treatment in one city's offers — which treatment pages the city can link. */
function treatmentCounts(offers: OfferView[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const offer of offers) {
    const treatment = offerTreatmentRoute(offer.service_category)
    if (treatment) counts[treatment] = (counts[treatment] ?? 0) + 1
  }
  return counts
}

function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// Valid treatment slugs for route matching
const VALID_TREATMENTS: Set<string> = new Set([
  'botox',
  'fillers',
  'facials',
  'laser',
  'body',
  'skincare',
  'wellness',
])

/**
 * Every path this route can serve, enumerated so that everything else is a real 404 instead of
 * a 200 carrying a "Page Not Found" body — the soft 404 Google keeps in its index and spends
 * crawl budget on. ~1,561 dead `/deals/*` URLs answered 200 this way, 54 of them v1 URLs.
 *
 * `notFound()` cannot set the status on its own here. `src/app/loading.tsx` wraps every page in
 * a Suspense boundary, Next flushes that shell — status line included — as soon as this async
 * page suspends, and `app-render` only converts the not-found error into a 404 when it
 * "wasn't wrapped inside a suspense boundary". Neither `redirects()` (3xx only), a rewrite to
 * `/404` (still 200) nor `notFound()` inside `generateMetadata` (re-thrown at the metadata
 * outlet, which sits inside the same boundary) reaches it. Same fix, same reason, as
 * `/[state]`, `/[state]/[city]`, `/treatments/[category]`
 * and `/guides/[slug]`.
 *
 * ponytail: the ceiling is freshness. A deal scraped after the last build 404s until the next
 * deploy, and an offer that expires between deploys goes back to answering 200-with-not-found
 * on its next hourly ISR pass. Deleting `src/app/loading.tsx` (and this segment's own
 * `loading.tsx`) removes the boundary, after which `dynamicParams` can go back to true and
 * `notFound()` sets the status by itself — but that file is shared by every route.
 */
export const dynamicParams = false

export async function generateStaticParams(): Promise<{ slugs: string[] }[]> {
  const [cities, deals, offers] = await Promise.all([
    getUnifiedCities(),
    // The publicly visible corpus: the same set the sitemap declares and every browse grid
    // lists. A deal collapsed as an indistinguishable duplicate is not in it, so it 404s.
    getActiveDeals(),
    getOffersWithBusinesses(),
  ])
  // Only pages with at least one deal. A city or a treatment/city pair with none used to
  // answer 200 as "0 Deals" — 62 such listing pages and /deals/laguna-hills were linked and
  // indexable (2026-09-23), the thin pages Google discounts. They 404 now, like any other path
  // that lists nothing; the sitemap and every link on the site use the same rule.
  // getUnifiedCities() is the same source resolveRoute() matches a city slug against.
  const citySlugs = new Set(cities.map((c) => c.slug))
  const withDeals = new Set<string>()
  const pairs = new Set<string>()
  for (const offer of offers) {
    const city = offer.master_business_info?.city?.trim()
    if (!city || !citySlugs.has(cityToSlug(city))) continue
    withDeals.add(cityToSlug(city))
    const treatment = offerTreatmentRoute(offer.service_category)
    if (treatment) pairs.add(`${treatment}/${cityToSlug(city)}`)
  }

  return [
    // An empty array renders `/deals` itself — Next joins the segment's values with '/' and
    // normalizes the trailing slash away.
    { slugs: [] },
    ...[...withDeals].map((city) => ({ slugs: [city] })),
    ...[...pairs].map((pair) => ({ slugs: pair.split('/') })),
    // String(offer.id), the exact form resolveRoute resolves. The numeric aliases noted below
    // — /deals/1447.0, /deals/+1447, /deals/0x5a7 — survived Number() and each served deal
    // 1447 again; none of them is an enumerated param, so they are now 404s too.
    ...deals.map((deal) => ({ slugs: [deal.id] })),
  ]
}

interface DealsPageProps {
  params: Promise<{ slugs?: string[] }>
}

// Determine the route type from slugs
type RouteType =
  | { type: 'redirect' }
  | { type: 'city'; citySlug: string; cityName: string }
  | {
      type: 'treatment-city'
      treatmentSlug: TreatmentCategory
      treatmentName: string
      citySlug: string
      cityName: string
    }
  | { type: 'deal'; dealId: string }
  | { type: 'not-found' }

const resolveRoute = cache(async function resolveRoute(
  slugs?: string[],
): Promise<RouteType> {
  // No slugs = redirect to detected city
  if (!slugs || slugs.length === 0) {
    return { type: 'redirect' }
  }

  // Single slug - could be city or deal ID
  if (slugs.length === 1) {
    const slug = slugs[0]

    // Check if it's a city — one with deals. A city that lists nothing is not a deals page
    // (generateStaticParams leaves it out too; this also covers one that empties between
    // deploys, and `next dev`, which does not enforce the param list).
    const cities = await getUnifiedCities()
    const city = cities.find((c) => c.slug === slug)
    if (city) {
      return (await getDealCountForCitySlug(slug)) > 0
        ? { type: 'city', citySlug: slug, cityName: city.name }
        : { type: 'not-found' }
    }

    // Check if it's a deal ID (numeric IDs from Supabase)
    const deal = await getDealById(slug)
    if (deal) {
      return { type: 'deal', dealId: slug }
    }

    // Not found
    return { type: 'not-found' }
  }

  // Two slugs - treatment/city combination
  if (slugs.length === 2) {
    const [first, second] = slugs

    // Check if first is a valid treatment category slug
    if (VALID_TREATMENTS.has(first)) {
      const treatmentSlug = first as TreatmentCategory
      // Check if second is a city
      const cities = await getUnifiedCities()
      const city = cities.find((c) => c.slug === second)
      // Same rule as a city: a pair with no deals is not a page ("Laser in San Diego | 0 Deals").
      if (
        city &&
        (await getDealCountForTreatmentAndCity(treatmentSlug, second)) > 0
      ) {
        return {
          type: 'treatment-city',
          treatmentSlug,
          treatmentName: getTreatmentLabel(treatmentSlug),
          citySlug: second,
          cityName: city.name,
        }
      }
    }

    // Not found
    return { type: 'not-found' }
  }

  // More than 2 slugs - not found
  return { type: 'not-found' }
})

// Generate metadata dynamically based on route
export async function generateMetadata({
  params,
}: DealsPageProps): Promise<Metadata> {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'city': {
      const [dealCount, cityOffers, minPrice] = await Promise.all([
        getDealCountForCitySlug(route.citySlug),
        getOffersForCitySlug(route.citySlug),
        getMinPriceForCitySlug(route.citySlug),
      ])
      const businessCount = providersWithDeals(cityOffers)
      return generateCityDealsMetadata(route.cityName, route.citySlug, {
        dealCount,
        businessCount,
        minPrice: minPrice?.amount,
        perUnit: minPrice?.perUnit,
      })
    }

    case 'treatment-city': {
      // M3: Parallelize 3 independent metadata queries (was sequential)
      const cityName = route.citySlug.replace(/-/g, ' ')
      const [dealCount, businessCount, minPrice] = await Promise.all([
        getDealCountForTreatmentAndCity(route.treatmentSlug, route.citySlug),
        getBusinessCountForCity(cityName),
        // Brand-aware on neurotoxins: the title says Botox only over a Botox row's price.
        getMinPriceForTreatmentAndCity(route.treatmentSlug, route.citySlug),
      ])
      return generateTreatmentCityMetadata(
        route.treatmentName,
        route.treatmentSlug,
        route.cityName,
        route.citySlug,
        {
          dealCount,
          businessCount,
          minPrice: minPrice?.amount,
          perUnit: minPrice?.perUnit,
          brand: minPrice?.brand,
        },
      )
    }

    case 'deal': {
      const deal = await getDealById(route.dealId)
      if (!deal) return NOT_FOUND_METADATA

      // deal.title is the raw service_name, so 677 of these pages shared a title with
      // another deal page — "Xeomin", "Dermal Filler", "Facial" — with nothing to tell them
      // apart. City and price are what distinguish one listing from another.
      const where = deal.locationArea ? ` in ${deal.locationArea}` : ''
      // The price as the page states it — "$299 for 40 units", "$10 per unit", "From $9 per
      // unit". A rounded bare `dealPrice` put "Dysport in Tucson — $4" in the SERP for a
      // $4.25-a-unit rate and dropped the "From" off a published floor.
      const pricing = dealPricing(deal)
      const price = pricing.kind === 'price' ? ` — ${pricing.text}` : ''
      // deal.id, not route.dealId. resolveRoute admits any slug that survives Number(), so
      // /deals/1447.0, /deals/0x5a7, /deals/+1447 and /deals/1447.00000 all serve deal 1447 —
      // and a canonical built from the raw slug pointed each alias at itself, certifying the
      // duplicates it was added to consolidate.
      const canonicalPath = `/deals/${deal.id}`

      return {
        title: budgetedTitle(deal.title, `${where}${price}`),
        description: truncate(deal.description, META_DESCRIPTION_CHARS),
        alternates: { canonical: buildCanonicalUrl(canonicalPath) },
        openGraph: {
          title: `${deal.title}${where}`,
          description: truncate(deal.description, META_DESCRIPTION_CHARS),
          url: buildCanonicalUrl(canonicalPath),
          siteName: SITE_CONFIG.name,
          type: 'website',
          locale: 'en_US',
          images: [OG_IMAGE],
        },
      }
    }

    case 'not-found':
      return NOT_FOUND_METADATA

    default:
      return {
        title: 'Find Medspa Deals',
        description:
          'Discover and compare medspa deals near you. Find the best prices on Botox, fillers, and aesthetic treatments.',
        // Self-canonical. /deals answers 200 for any query string — ?q=, ?sort=, every
        // utm_ — and read none of them, so each variant was a separate indexable duplicate
        // with no consolidation signal.
        alternates: { canonical: buildCanonicalUrl('/deals') },
        openGraph: {
          title: 'Find Medspa Deals',
          description:
            'Discover and compare medspa deals near you. Find the best prices on Botox, fillers, and aesthetic treatments.',
          url: buildCanonicalUrl('/deals'),
          siteName: SITE_CONFIG.name,
          type: 'website',
          locale: 'en_US',
          images: [OG_IMAGE],
        },
      }
  }
}

export default async function DealsRoutingPage({ params }: DealsPageProps) {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'redirect': {
      // Only cities that actually have deals — linking to an empty city page
      // is a dead end.
      const cityDealCounts = await getCityDealCounts()
      const citiesWithDeals = cityDealCounts
        .filter((c) => c.dealCount > 0)
        .sort((a, b) => b.dealCount - a.dealCount)
      return (
        <main className="pt-24 pb-20 md:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
                Browse deals by city
              </h1>
              <p className="mt-3 text-text-secondary">
                {citiesWithDeals.length > 0
                  ? // Not "verified providers": no business has ever been verified, nothing
                    // vets these listings and no review content is rendered. They are the
                    // prices providers publish on their own pages and public listings.
                    'Pick a city to compare the prices providers advertise publicly'
                  : 'No deals are listed right now. Check back soon.'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {citiesWithDeals.map((city) => (
                <a
                  key={city.slug}
                  href={`/deals/${city.slug}`}
                  className="group flex items-center gap-4 bg-bg-elevated border border-border-default rounded-xl px-4 py-3.5 hover:border-border-hover hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-bg-surface shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 256 256"
                      aria-hidden="true"
                      focusable="false"
                      className="text-text-secondary"
                    >
                      <path
                        fill="currentColor"
                        d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88m0 56a32 32 0 1 1-32 32 32 32 0 0 1 32-32"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {city.city}
                    </p>
                    <p className="text-sm text-text-muted tabular-nums">
                      {city.stateCode ? `${city.stateCode} · ` : ''}
                      {city.dealCount} {city.dealCount === 1 ? 'deal' : 'deals'}
                      {/* Never "1 provider" — see cityDealsPage.tsx. */}
                      {city.providerCount > 1 &&
                        ` · ${city.providerCount} providers`}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </main>
      )
    }

    case 'city': {
      const [cityDeals, cityOffers] = await Promise.all([
        getDealsForCitySlug(route.citySlug),
        // Raw offers, because the tile gate needs service_category — the adapter has already
        // collapsed an uncategorised offer into the 'body' badge by the time it is a deal.
        getOffersForCitySlug(route.citySlug),
      ])
      // Which treatments this city actually has deals for. The tiles used to render all six
      // unconditionally, minting links to ~25 zero-deal pages that the sitemap deliberately
      // refuses to list — the site linking to pages it declines to declare.
      // The location hub for this city, so the two pages that describe one city reference
      // each other instead of competing silently. Null when the city's state is not one the
      // [state] route serves, in which case the hub URL would 404.
      const cityHubPath = await getCityHubPath(route.citySlug)
      const cityTreatmentCounts = treatmentCounts(cityOffers)
      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildDealsListSchema(
                  cityDeals.map((d) => ({
                    id: d.id,
                    title: d.title,
                    description: d.description,
                    dealPrice: d.dealPrice,
                    locationArea: route.cityName,
                  })),
                  route.cityName,
                ),
              ),
            }}
          />
          <BreadcrumbSchema
            items={[
              { name: 'Home', url: SITE_CONFIG.url },
              { name: 'Deals', url: buildCanonicalUrl('/deals') },
              {
                name: route.cityName,
                url: buildCanonicalUrl(`/deals/${route.citySlug}`),
              },
            ]}
          />
          <CityDealsPage
            citySlug={route.citySlug}
            cityName={route.cityName}
            initialDeals={cityDeals}
            dealCount={cityDeals.length}
            businessCount={providersWithDeals(cityOffers)}
            cityHubPath={cityHubPath}
            treatmentCounts={cityTreatmentCounts}
            typical={typicalPrices(cityOffers)}
          />
        </>
      )
    }

    case 'treatment-city': {
      const [treatmentCityDeals, cityOffers] = await Promise.all([
        getDealsForTreatmentAndCity(route.treatmentSlug, route.citySlug),
        getOffersForCitySlug(route.citySlug),
      ])
      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildTreatmentServiceSchema(
                  route.treatmentName,
                  route.cityName,
                ),
              ),
            }}
          />
          <BreadcrumbSchema
            items={[
              { name: 'Home', url: SITE_CONFIG.url },
              { name: 'Deals', url: buildCanonicalUrl('/deals') },
              {
                name: route.cityName,
                url: buildCanonicalUrl(`/deals/${route.citySlug}`),
              },
              {
                name: route.treatmentName,
                url: buildCanonicalUrl(
                  `/deals/${route.treatmentSlug}/${route.citySlug}`,
                ),
              },
            ]}
          />
          <TreatmentCityPage
            treatmentSlug={route.treatmentSlug}
            treatmentName={route.treatmentName}
            citySlug={route.citySlug}
            cityName={route.cityName}
            hasGuide={guideExists(
              `${route.treatmentSlug}-cost-${route.citySlug}`,
            )}
            initialDeals={treatmentCityDeals}
            dealCount={treatmentCityDeals.length}
            treatmentCounts={treatmentCounts(cityOffers)}
            typical={typicalPrices(cityOffers)[route.treatmentSlug] ?? null}
          />
        </>
      )
    }

    case 'deal': {
      const dealWithBiz = await getDealWithBusinessId(route.dealId)
      if (!dealWithBiz) {
        notFound()
      }
      // dealWithBiz has all AnonymousDeal fields + businessId from the raw offer, and the
      // membership plan, which only the deal page itself may carry.
      const { businessId, membership, ...anonymousDeal } = dealWithBiz
      const fullDeal = { ...anonymousDeal, businessId }
      // The market this deal sits in: its treatment's typical price over its own city's offers.
      // Only a treatment that can have one is worth the city fetch (TYPICAL_TREATMENTS).
      const typical =
        anonymousDeal.category &&
        TYPICAL_TREATMENTS.has(anonymousDeal.category) &&
        anonymousDeal.locationArea
          ? (typicalPrices(
              await getOffersForCitySlug(
                cityToSlug(anonymousDeal.locationArea),
              ),
            )[anonymousDeal.category] ?? null)
          : null
      return (
        <>
          <DealOfferSchema
            deal={{
              id: anonymousDeal.id,
              title: anonymousDeal.title,
              description: anonymousDeal.description,
              dealPrice: anonymousDeal.dealPrice,
              priceBasis: anonymousDeal.priceBasis,
              originalPrice: anonymousDeal.originalPrice,
              category:
                anonymousDeal.category &&
                getTreatmentLabel(anonymousDeal.category),
              locationArea: anonymousDeal.locationArea,
              validUntil: anonymousDeal.validUntil || undefined,
            }}
          />
          <BreadcrumbSchema
            items={[
              { name: 'Home', url: SITE_CONFIG.url },
              { name: 'Deals', url: buildCanonicalUrl('/deals') },
              {
                name: anonymousDeal.title,
                url: buildCanonicalUrl(`/deals/${anonymousDeal.id}`),
              },
            ]}
          />
          <DealDetailPage
            deal={anonymousDeal}
            fullDeal={fullDeal}
            typical={typical}
            membership={membership}
          />
        </>
      )
    }
    default:
      notFound()
  }
}
