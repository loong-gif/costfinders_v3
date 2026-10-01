import { MapPin } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityCard } from '@/components/features/cityCard'
import { BreadcrumbSchema, FaqSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Faq } from '@/components/ui/faq'
import { type RelatedLink, RelatedLinks } from '@/components/ui/relatedLinks'
import {
  getCityDealCounts,
  getStateCategoryCounts,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getStateBySlug, getStates } from '@/lib/mock-data/states'
import { getStateFaqs } from '@/lib/seo/faq-content'
import {
  buildCanonicalUrl,
  generateStateMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'

export const revalidate = 3600 // ISR: regenerate every hour

// Only the states enumerated below are valid routes. Anything else is a real
// 404 instead of a 200 "State Not Found" shell — notFound() alone cannot set the
// status once the root loading.tsx boundary has flushed the streamed shell.
export const dynamicParams = false

/**
 * One page per state that actually has cities, not one per state that exists.
 *
 * getStates() is the full 51-entry vocabulary (see src/lib/mock-data/states.ts) so that a city in
 * any state can resolve a route. Emitting all 51 would publish 40-odd pages listing zero cities and
 * zero deals, so this intersects with the live city list and lets `dynamicParams = false` 404 the
 * rest.
 *
 * NOTE this is a DELIBERATELY WEAKER filter than the one sitemap.ts applies to the same route.
 * Here: states with cities. There: states with cities that have DEALS. Three states (MA, ID, MD)
 * have exactly one business and zero visible deals, and they fall in the gap on purpose — the page
 * EXISTS, so the state → city → provider hierarchy stays navigable to a real provider, but it is
 * not advertised to a crawler as a deal page. Tightening this to match the sitemap would 404 the
 * parent of a provider page that works.
 */
export async function generateStaticParams() {
  const allCities = await getUnifiedCities()
  const populated = new Set(allCities.map((city) => city.stateCode))
  return getStates()
    .filter((state) => populated.has(state.code))
    .map((state) => ({ state: state.slug }))
}

/**
 * Real offer counts per city slug, for the cities in one state.
 *
 * Both the stat tile and the meta description used to print `businessCount` under the label
 * "Active Deals" — a provider count sold as a deal count, in the page body AND in the search
 * snippet. /arizona advertised "31 medspa deals" while /deals/tucson listed 77 offers, so the
 * site contradicted itself one click apart. getCityDealCounts() already computes the real
 * figure over the same React-cached offer corpus the rest of the request uses, and applies the
 * publicly-visible predicate, so it agrees with what the deals pages actually list.
 */
async function stateDealCounts(stateCode: string) {
  const counts = await getCityDealCounts()
  const bySlug = new Map(
    counts
      .filter((c) => c.stateCode === stateCode)
      .map((c) => [c.slug, c.dealCount]),
  )
  let total = 0
  for (const count of bySlug.values()) total += count
  return { bySlug, total }
}

// Generate metadata for SEO
interface MetadataProps {
  params: Promise<{ state: string }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { state: stateSlug } = await params
  const state = getStateBySlug(stateSlug)

  if (!state) {
    return {
      title: 'State not found',
      description: 'The requested state page could not be found.',
    }
  }

  // Get real cities for this state to compute stats
  const allCities = await getUnifiedCities()
  const stateCities = allCities.filter((c) => c.stateCode === state.code)
  const cityCount = stateCities.length
  const { total: dealCount } = await stateDealCounts(state.code)

  return generateStateMetadata(state.name, cityCount, dealCount)
}

// Page props with Next.js 15 async params
interface StatePageProps {
  params: Promise<{ state: string }>
}

export default async function StatePage({ params }: StatePageProps) {
  const { state: stateSlug } = await params
  const state = getStateBySlug(stateSlug)

  if (!state) {
    notFound()
  }

  // Get real city data from Supabase
  const allCities = await getUnifiedCities()
  const stateCities = allCities.filter((c) => c.stateCode === state.code)

  // Compute real stats
  const cityCount = stateCities.length
  const businessCount = stateCities.reduce((sum, c) => sum + c.businessCount, 0)
  const { bySlug: dealCountBySlug, total: dealCount } = await stateDealCounts(
    state.code,
  )
  // Deals first, then providers. getUnifiedCities() comes in provider order, which put
  // Calabasas (3 deals) above San Diego (52) on /california (device matrix, 2026-09-28).
  const cityCards = stateCities
    .map((city) => ({
      ...city,
      dealCount: dealCountBySlug.get(city.slug) ?? 0,
    }))
    .sort(
      (a, b) => b.dealCount - a.dealCount || b.businessCount - a.businessCount,
    )

  // The buckets this state's live deals are actually in. The links open the national bucket page,
  // so the label does not say "in {state}" — only the count is this state's.
  const categories = await getStateCategoryCounts(state.code)
  const categoryLinks: RelatedLink[] = categories.map((cat) => ({
    label: cat.label,
    href: `/treatments/${cat.slug}`,
    description: `${cat.count} ${cat.count === 1 ? 'deal' : 'deals'} in ${state.name}`,
  }))

  const faqItems = getStateFaqs(
    state.name,
    categories.map((c) => c.label),
  )

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: state.name, url: buildCanonicalUrl(`/${state.slug}`) },
  ]

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />
      <FaqSchema items={faqItems} />

      <main className="pt-20 pb-20 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <section className="mb-10">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[{ label: 'Home', href: '/' }, { label: state.name }]}
            />

            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
              Medspa deals in {state.name}
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-text-secondary">
              Discover medspa deals and aesthetic treatments across {state.name}
              . Compare the prices providers advertise on Botox, fillers, laser
              treatments, and more in {cityCount}{' '}
              {cityCount === 1 ? 'city' : 'cities'}.
            </p>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
              <span>
                <span className="font-semibold text-text-secondary tabular-nums">
                  {dealCount}
                </span>{' '}
                {dealCount === 1 ? 'live deal' : 'live deals'}
              </span>
              <span>
                <span className="font-semibold text-text-secondary tabular-nums">
                  {businessCount}
                </span>{' '}
                {businessCount === 1 ? 'provider listed' : 'providers listed'}
              </span>
              <span>
                <span className="font-semibold text-text-secondary tabular-nums">
                  {cityCount}
                </span>{' '}
                {cityCount === 1 ? 'city' : 'cities'}
              </span>
            </p>
          </section>

          {/* Cities Grid */}
          <section>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-6">
              Browse by city
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cityCards.map((city) => (
                <CityCard
                  key={city.slug}
                  name={city.name}
                  slug={city.slug}
                  stateSlug={state.slug}
                  stateName={state.name}
                  dealCount={city.dealCount}
                  businessCount={city.businessCount}
                />
              ))}
            </div>

            {/* Empty State */}
            {stateCities.length === 0 && (
              <div className="text-center py-12 bg-bg-surface rounded-xl">
                <MapPin
                  size={48}
                  weight="light"
                  className="mx-auto text-text-muted mb-4"
                />
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  No cities listed yet
                </h3>
                {/* Was "We're expanding to more cities in {state} soon" — a plan nobody has made. */}
                <p className="text-text-secondary max-w-md mx-auto">
                  No city in {state.name} has deals listed yet.
                </p>
              </div>
            )}
          </section>

          {/* Treatments with deals here — none on a state with no live deal */}
          {categoryLinks.length > 0 && (
            <section className="mt-14">
              <RelatedLinks
                title={`Treatments with deals in ${state.name}`}
                links={categoryLinks}
              />
            </section>
          )}

          {/* FAQ Section */}
          <section className="mt-12">
            <Faq items={faqItems} />
          </section>
        </div>
      </main>
    </>
  )
}
