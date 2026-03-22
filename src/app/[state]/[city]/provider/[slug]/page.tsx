import {
  Globe,
  MapPin,
  Star,
  Storefront,
  Tag,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DealCard } from '@/components/features/dealCard'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getDealsForBusiness,
  getProvidersByCity,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getStateBySlug, getStates } from '@/lib/mock-data/states'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'
import { buildLocalBusinessSchema } from '@/lib/seo/schemas'

// Generate static params for all supported providers
export async function generateStaticParams() {
  const allCities = await getUnifiedCities()
  const states = getStates()

  // Parallelize all city provider fetches instead of sequential N+1
  const citiesWithState = allCities
    .map((city) => ({
      city,
      state: states.find((s) => s.code === city.stateCode),
    }))
    .filter((c) => c.state != null)

  const providerResults = await Promise.all(
    citiesWithState.map(({ city }) => getProvidersByCity(city.name)),
  )

  return citiesWithState.flatMap(({ city, state }, i) =>
    providerResults[i].map((provider) => ({
      state: state!.slug,
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
      title: 'Provider Not Found | CostFinders',
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
      title: 'Provider Not Found | CostFinders',
      description: 'The requested provider page could not be found.',
    }
  }

  // Find provider
  const providers = await getProvidersByCity(city.name)
  const provider = providers.find((p) => p.slug === providerSlug)

  if (!provider) {
    return {
      title: 'Provider Not Found | CostFinders',
      description: 'The requested provider page could not be found.',
    }
  }

  // Get deals for this specific provider
  const providerDeals = await getDealsForBusiness(Number(provider.id))

  return {
    title: `${provider.name} - Medspa Deals in ${city.name}, ${state.name} | CostFinders`,
    description: `Compare ${providerDeals.length} medspa deals from ${provider.name} in ${city.name}, ${state.name}. Find exclusive prices on Botox, fillers, facials, and laser treatments.`,
    openGraph: {
      title: `${provider.name} - Medspa Deals | CostFinders`,
      description: `Compare ${providerDeals.length} medspa deals from ${provider.name} in ${city.name}.`,
      type: 'website',
    },
  }
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

  // Get deals for this specific business
  const deals = await getDealsForBusiness(Number(provider.id))

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
                streetAddress: provider.address || '',
                city: city.name,
                state: state.name,
                postalCode: '',
              },
              url: provider.website || undefined,
              rating: provider.rating > 0 && provider.reviewCount > 0
                ? { value: provider.rating, count: provider.reviewCount }
                : undefined,
            }),
          ),
        }}
      />

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: state.name, href: `/${state.slug}` },
                { label: city.name, href: `/${state.slug}/${citySlug}` },
                { label: provider.name },
              ]}
            />

            {/* Hero Content */}
            <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-800/15 flex items-center justify-center">
                  <Storefront
                    size={24}
                    weight="fill"
                    className="text-amber-800"
                  />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03]">
                    {provider.name}
                  </h1>
                  {provider.rating > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star
                        size={16}
                        weight="fill"
                        className="text-yellow-400"
                      />
                      <span className="text-[#78350f] text-sm">
                        {provider.rating.toFixed(1)} rating
                        {provider.reviewCount > 0 &&
                          ` (${provider.reviewCount} reviews)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {provider.description && (
                <p className="text-[#78350f] max-w-2xl mb-6">
                  {provider.description}
                </p>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <Tag size={20} weight="light" className="text-amber-800" />
                  <span className="font-semibold text-[#451a03]">
                    {deals.length}
                  </span>
                  <span className="text-[#78350f]">Active Deals</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={20} weight="light" className="text-amber-800" />
                  <span className="text-[#78350f]">
                    {city.name}, {state.name}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex flex-wrap gap-6 pt-6 border-t border-[#d4c4b0]">
                {provider.address && (
                  <div className="flex items-center gap-2 text-[#78350f]">
                    <MapPin size={18} weight="light" />
                    <span>{provider.address}</span>
                  </div>
                )}
                {provider.website && (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#78350f] hover:text-[var(--color-accent-hover)] transition-colors"
                  >
                    <Globe size={18} weight="light" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Deals Grid */}
          <section>
            <h2 className="text-xl font-semibold text-[#451a03] mb-6">
              Deals from {provider.name}
            </h2>

            {deals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-12 bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px]">
                <Tag
                  size={48}
                  weight="light"
                  className="mx-auto text-[#92400e] mb-4"
                />
                <h3 className="text-lg font-medium text-[#451a03] mb-2">
                  No Deals Available Yet
                </h3>
                <p className="text-[#78350f] max-w-md mx-auto mb-6">
                  We&apos;re working to bring you exclusive deals from{' '}
                  {provider.name}. Check back soon for new offers.
                </p>
                <Link
                  href={`/${state.slug}/${citySlug}`}
                  className="inline-flex items-center gap-2 text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
                >
                  <MapPin size={18} weight="light" />
                  Browse other providers in {city.name}
                </Link>
              </div>
            )}
          </section>

          {/* Back Navigation */}
          <div className="mt-8 pt-6 border-t border-[#d4c4b0]">
            <Link
              href={`/${state.slug}/${citySlug}`}
              className="inline-flex items-center gap-2 text-[#78350f] hover:text-[#451a03] transition-colors"
            >
              <MapPin size={18} weight="light" />
              Back to {city.name} providers
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
