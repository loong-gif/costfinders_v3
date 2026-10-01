import { ArrowRight, CaretRight, Star } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getBusinessCountForCity,
  getCityOfferCount,
  getProvidersByCity,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getStateBySlug } from '@/lib/mock-data/states'
import {
  buildCanonicalUrl,
  generateLocationMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import { publicDirectory } from '@/lib/utils/identity'

export const revalidate = 3600 // ISR: regenerate every hour

// Only the (state, city) pairs enumerated below are valid routes. Anything else
// is a real 404 instead of a 200 "City Not Found" shell — notFound() alone
// cannot set the status once the root loading.tsx boundary has flushed.
export const dynamicParams = false

// Generate static params for all supported cities
export async function generateStaticParams() {
  const allCities = await getUnifiedCities()
  const { getStates } = await import('@/lib/mock-data/states')
  const states = getStates()

  const params: { state: string; city: string }[] = []

  for (const city of allCities) {
    const state = states.find((s) => s.code === city.stateCode)
    if (state) {
      params.push({ state: state.slug, city: city.slug })
    }
  }

  return params
}

// Generate metadata for SEO
interface MetadataProps {
  params: Promise<{ state: string; city: string }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug } = await params
  const state = getStateBySlug(stateSlug)

  if (!state) {
    return {
      title: 'City Not Found',
      description: 'The requested city page could not be found.',
    }
  }

  // Find city in real data
  const allCities = await getUnifiedCities()
  const city = allCities.find(
    (c) => c.slug === citySlug && c.stateCode === state.code,
  )

  if (!city) {
    return {
      title: 'City Not Found',
      description: 'The requested city page could not be found.',
    }
  }

  const [businessCount, dealCount, providers] = await Promise.all([
    getBusinessCountForCity(city.name),
    getCityOfferCount(city.name),
    getProvidersByCity(city.name),
  ])
  const metadata = generateLocationMetadata(
    city.name,
    state.name,
    // No clinic count where the directory is withheld — see the page body.
    publicDirectory(providers).length > 0 ? businessCount : null,
  )
  // A city with no live deal keeps its directory (its provider pages hang off it) but is not
  // offered to a crawler; the sitemap already leaves it out.
  return dealCount > 0
    ? metadata
    : { ...metadata, robots: { index: false, follow: true } }
}

// Page props with Next.js 15 async params
interface CityPageProps {
  params: Promise<{ state: string; city: string }>
}

export default async function CityPage({ params }: CityPageProps) {
  const { state: stateSlug, city: citySlug } = await params
  const state = getStateBySlug(stateSlug)

  if (!state) {
    notFound()
  }

  // Find city in real data
  const allCities = await getUnifiedCities()
  const city = allCities.find(
    (c) => c.slug === citySlug && c.stateCode === state.code,
  )

  if (!city) {
    notFound()
  }

  // Get real counts from Supabase
  const [businessCount, dealCount, providers] = await Promise.all([
    getBusinessCountForCity(city.name),
    getCityOfferCount(city.name),
    getProvidersByCity(city.name),
  ])

  // Providers with a usable slug. ~266 provider URLs were declared in the sitemap and linked
  // from nowhere in the app — every one of them an orphan reachable only by a crawler that
  // read the sitemap. This page is their parent.
  // None at all below 4 clinics (publicDirectory): beside "Provider in <city>" on every deal
  // card, a list of one to three names identifies the clinic behind the deals. The count goes
  // with it — "1 provider listed" says the same thing.
  const linkableProviders = publicDirectory(providers).sort(
    (a, b) => b.reviewCount - a.reviewCount || a.name.localeCompare(b.name),
  )

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: state.name, url: buildCanonicalUrl(`/${state.slug}`) },
    { name: city.name, url: buildCanonicalUrl(`/${state.slug}/${citySlug}`) },
  ]

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />

      <main className="pt-20 pb-20 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <section className="mb-10">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: state.name, href: `/${state.slug}` },
                { label: city.name },
              ]}
            />

            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
              Medspas in {city.name}, {state.name}
            </h1>
            {/* "the prices they advertise", not "what they are charging right now": nothing on
                this page is refreshed on a clock, and advertised is what the listings are. */}
            <p className="mt-3 max-w-2xl text-lg text-text-secondary">
              {linkableProviders.length > 0 ? (
                <>
                  {businessCount}{' '}
                  {businessCount === 1
                    ? 'medspa or aesthetic clinic'
                    : 'medspas and aesthetic clinics'}{' '}
                  listed in {city.name}, {state.name}. Browse who is here, then
                  compare the prices they advertise.
                </>
              ) : (
                <>
                  Compare the prices medspas in {city.name}, {state.name}{' '}
                  advertise. Provider names are shown once you claim a deal.
                </>
              )}
            </p>
            {/*
              "providers listed", not "verified providers": a raw count of master_business_info
              rows for the city, all collected from public listings. No provider on this site
              has been verified.
            */}
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
              <span>
                <span className="font-semibold text-text-secondary tabular-nums">
                  {dealCount}
                </span>{' '}
                {dealCount === 1 ? 'active deal' : 'active deals'}
              </span>
              {linkableProviders.length > 0 && (
                <span>
                  <span className="font-semibold text-text-secondary tabular-nums">
                    {businessCount}
                  </span>{' '}
                  {businessCount === 1 ? 'provider listed' : 'providers listed'}
                </span>
              )}
            </p>
            {dealCount > 0 && (
              <Link
                className="mt-6 inline-flex items-center gap-2 min-h-[44px] rounded-full bg-accent px-6 text-center text-balance font-semibold text-white hover:bg-accent-hover transition-colors"
                href={`/deals/${citySlug}`}
              >
                See {dealCount} {city.name} {dealCount === 1 ? 'deal' : 'deals'}
                <ArrowRight size={18} weight="bold" />
              </Link>
            )}
          </section>

          {/* Provider Directory — the parent every provider URL was missing */}
          {linkableProviders.length > 0 && (
            <section aria-labelledby="providers-heading" className="mb-12">
              <h2
                className="font-display text-2xl font-bold tracking-tight text-text-primary mb-6"
                id="providers-heading"
              >
                Medspas in {city.name}
              </h2>

              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {linkableProviders.map((provider) => (
                  <li key={provider.slug}>
                    <Link
                      className="group flex h-full items-center justify-between gap-3 bg-bg-elevated border border-border-default rounded-xl px-5 py-4 hover:border-border-hover hover:shadow-md transition-all"
                      href={`/${state.slug}/${citySlug}/provider/${provider.slug}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                          {provider.name}
                        </span>
                        {provider.reviewCount > 0 && (
                          <span className="flex items-center gap-1.5 text-sm text-text-muted mt-0.5">
                            <Star
                              className="text-accent-graphic"
                              size={14}
                              weight="fill"
                            />
                            {provider.rating.toFixed(1)} ·{' '}
                            {provider.reviewCount}{' '}
                            {provider.reviewCount === 1 ? 'review' : 'reviews'}
                          </span>
                        )}
                      </span>
                      <CaretRight
                        className="text-text-muted group-hover:text-accent shrink-0 transition-colors"
                        size={16}
                        weight="bold"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
