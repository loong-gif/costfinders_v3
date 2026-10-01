import { ArrowRight, Lock, MapPin, Star } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getCityOfferCount,
  getProvidersByCity,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getStateBySlug, getStates } from '@/lib/mock-data/states'
import {
  buildCanonicalUrl,
  generateProviderMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import { buildLocalBusinessSchema } from '@/lib/seo/schemas'
import { publicDirectory } from '@/lib/utils/identity'

export const revalidate = 3600 // ISR: regenerate every hour

// Only the providers enumerated below are valid routes. Without this, an unknown slug
// rendered on demand and returned HTTP 200 carrying "Provider Not Found" — a soft 404 a
// crawler can mint by guessing, and one that gets edge-cached.
export const dynamicParams = false

// Generate static params for all supported providers
export async function generateStaticParams() {
  const allCities = await getUnifiedCities()
  const states = getStates()

  // Parallelize all city provider fetches instead of sequential N+1.
  // flatMap (not map+filter) so `state` narrows to non-undefined for TS.
  const citiesWithState = allCities.flatMap((city) => {
    const state = states.find((s) => s.code === city.stateCode)
    return state ? [{ city, state }] : []
  })

  const providerResults = await Promise.all(
    citiesWithState.map(({ city }) => getProvidersByCity(city.name)),
  )

  return citiesWithState.flatMap(({ city, state }, i) =>
    providerResults[i].map((provider) => ({
      state: state.slug,
      city: city.slug,
      slug: provider.slug,
    })),
  )
}

// Generate metadata for SEO
interface MetadataProps {
  params: Promise<{ state: string; city: string; slug: string }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug, slug: providerSlug } = await params
  const state = getStateBySlug(stateSlug)

  if (!state) {
    return {
      title: 'Provider Not Found',
      description: 'The requested provider page could not be found.',
    }
  }

  // Find city in real data
  const allCities = await getUnifiedCities()
  const city = allCities.find(
    (c) => c.slug === citySlug && c.stateCode === state.code,
  )

  if (!city) {
    return {
      title: 'Provider Not Found',
      description: 'The requested provider page could not be found.',
    }
  }

  // Find provider
  const providers = await getProvidersByCity(city.name)
  const provider = providers.find((p) => p.slug === providerSlug)

  if (!provider) {
    return {
      title: 'Provider Not Found',
      description: 'The requested provider page could not be found.',
    }
  }

  const cityDealCount = await getCityOfferCount(city.name)

  // generateProviderMetadata already existed and was never called, so its canonical bug
  // (it built '/providers/', a route that does not exist) went unnoticed while these pages
  // shipped with no canonical at all. Calling it closes both.
  const metadata = generateProviderMetadata(
    provider.name,
    city.name,
    state.name,
    provider.slug,
  )
  // Offered to a crawler only where the city has live deals AND its directory is public (4+
  // clinics — publicDirectory). Otherwise the page still answers a direct link, but is noindex
  // and out of the sitemap: in a one-clinic city it names the clinic behind every deal there.
  return cityDealCount > 0 && publicDirectory(providers).length > 0
    ? metadata
    : { ...metadata, robots: { index: false, follow: true } }
}

// Page props with Next.js 15 async params
interface ProviderPageProps {
  params: Promise<{ state: string; city: string; slug: string }>
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { state: stateSlug, city: citySlug, slug: providerSlug } = await params
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

  // Find provider in real data
  const providers = await getProvidersByCity(city.name)
  const provider = providers.find((p) => p.slug === providerSlug)

  if (!provider) {
    notFound()
  }

  // Nothing here says whether THIS provider has deals. A deal's clinic is what a claim reveals
  // (owner decision), and this page printed "Deals from {name}" over the very cards the city
  // listings show anonymously. A count was no better: 20 of 37 cities with deals have exactly
  // one clinic with deals (213 of 944 deals, 2026-09-24), so "N deals listed" on one provider
  // page and nothing on its neighbours named the clinic behind every deal in the city. Every
  // provider page reads the same; only the city's own count is shown.
  const cityDealCount = await getCityOfferCount(city.name)

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: state.name, url: buildCanonicalUrl(`/${state.slug}`) },
    { name: city.name, url: buildCanonicalUrl(`/${state.slug}/${citySlug}`) },
    {
      name: provider.name,
      url: buildCanonicalUrl(
        `/${state.slug}/${citySlug}/provider/${provider.slug}`,
      ),
    },
  ]

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildLocalBusinessSchema({
              name: provider.name,
              description: provider.description || undefined,
              address: {
                // Omitted rather than empty: master_business_info carries no postal code,
                // and postalCode: '' asserts that the business has none.
                streetAddress: provider.address || undefined,
                city: city.name,
                state: state.name,
              },
            }),
          ),
        }}
      />

      <main className="pt-20 pb-20 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <section className="mb-10">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: state.name, href: `/${state.slug}` },
                { label: city.name, href: `/${state.slug}/${citySlug}` },
                { label: provider.name },
              ]}
            />

            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
              {provider.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <MapPin size={14} weight="bold" className="shrink-0" />
                {city.name}, {state.name}
              </span>
              {provider.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star
                    size={14}
                    weight="fill"
                    className="text-accent-graphic"
                  />
                  {/*
                    Attributed, not first-party. provider.rating and .reviewCount are
                    master_business_info.score / .review_count — scraped Google figures on a
                    table keyed by google_place_id. CostFinders collects no reviews and renders
                    none, so the source has to be on the face of the number. The LocalBusiness
                    markup above deliberately omits aggregateRating for the same reason.
                  */}
                  {provider.rating.toFixed(1)} Google rating
                  {provider.reviewCount > 0 && (
                    <span className="text-text-muted">
                      {' '}
                      · {provider.reviewCount} reviews
                    </span>
                  )}
                </span>
              )}
            </div>

            {provider.description && (
              <p className="mt-4 max-w-2xl text-lg text-text-secondary">
                {provider.description}
              </p>
            )}

            {/* No website link: the public directory carries none (getBusinesses never read it, so
                the link never rendered). */}
            {provider.address && (
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-default pt-5 text-sm">
                <span className="flex items-center gap-2 text-text-secondary">
                  <MapPin size={16} weight="bold" className="text-text-muted" />
                  {provider.address}
                </span>
              </div>
            )}
          </section>

          {/* The same panel on every provider page — see the comment on cityDealCount. */}
          <section className="rounded-2xl border border-border-default bg-bg-surface p-6">
            <p className="flex items-start gap-2.5 text-text-secondary">
              <Lock
                size={18}
                weight="bold"
                className="mt-0.5 shrink-0 text-text-muted"
              />
              <span>
                Deals in {city.name} are listed with the provider name hidden
                until you claim.
              </span>
            </p>
            {cityDealCount > 0 && (
              <Link
                href={`/deals/${citySlug}`}
                className="mt-5 inline-flex items-center gap-2 min-h-[44px] rounded-full bg-accent px-6 text-center text-balance font-semibold text-white hover:bg-accent-hover transition-colors"
              >
                See {cityDealCount} {city.name}{' '}
                {cityDealCount === 1 ? 'deal' : 'deals'}
                <ArrowRight size={18} weight="bold" />
              </Link>
            )}
          </section>

          {/* Back Navigation */}
          <div className="mt-8 pt-6 border-t border-border-default">
            <Link
              href={`/${state.slug}/${citySlug}`}
              className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <MapPin size={18} weight="light" />
              {/* A small city's hub lists no providers (publicDirectory). */}
              {publicDirectory(providers).length > 0
                ? `Back to ${city.name} providers`
                : `Back to ${city.name}`}
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
