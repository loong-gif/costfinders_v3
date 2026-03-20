import {
  MapPin,
  Storefront,
  Tag,
  Phone,
  Envelope,
  Globe,
  Star,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { DealCard } from '@/components/features/dealCard'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'
import { getStateBySlug, slugifyCity } from '@/lib/mock-data/states'
import { getCityBySlug } from '@/lib/mock-data/cities'
import {
  getProviderBySlug,
  getDealsForProvider,
  getAllProvidersWithCityAndState,
  getProviderStats,
} from '@/lib/mock-data/providers'

// Generate static params for all supported providers
export async function generateStaticParams() {
  const providersWithContext = getAllProvidersWithCityAndState()
  return providersWithContext.map(({ business, stateSlug, citySlug }) => ({
    state: stateSlug,
    city: citySlug,
    slug: business.slug,
  }))
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
  const city = getCityBySlug(stateSlug, citySlug)
  const provider = getProviderBySlug(stateSlug, citySlug, providerSlug)

  if (!state || !city || !provider) {
    return {
      title: 'Provider Not Found | CostFinders',
      description: 'The requested provider page could not be found.',
    }
  }

  const stats = getProviderStats(provider.id)

  return {
    title: `${provider.name} - Medspa Deals in ${city.name}, ${state.name} | CostFinders`,
    description: `Compare ${stats.activeDealCount} medspa deals from ${provider.name} in ${city.name}, ${state.name}. Find exclusive prices on Botox, fillers, facials, and laser treatments.`,
    openGraph: {
      title: `${provider.name} - Medspa Deals | CostFinders`,
      description: `Compare ${stats.activeDealCount} medspa deals from ${provider.name} in ${city.name}.`,
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
  const city = getCityBySlug(stateSlug, citySlug)
  const provider = getProviderBySlug(stateSlug, citySlug, providerSlug)

  if (!state || !city || !provider) {
    notFound()
  }

  const stats = getProviderStats(provider.id)
  const deals = getDealsForProvider(provider.id)

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: state.name, url: buildCanonicalUrl(`/${state.slug}`) },
    { name: city.name, url: buildCanonicalUrl(`/${state.slug}/${citySlug}`) },
    {
      name: provider.name,
      url: buildCanonicalUrl(
        `/${state.slug}/${citySlug}/provider/${provider.slug}`
      ),
    },
  ]

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />

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
                  <Storefront size={24} weight="fill" className="text-amber-800" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03]">
                    {provider.name}
                  </h1>
                  {provider.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={16} weight="fill" className="text-yellow-400" />
                      <span className="text-[#78350f] text-sm">
                        {provider.rating.toFixed(1)} rating
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
                    {stats.activeDealCount}
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
                {provider.phone && (
                  <a
                    href={`tel:${provider.phone}`}
                    className="flex items-center gap-2 text-[#78350f] hover:text-amber-300 transition-colors"
                  >
                    <Phone size={18} weight="light" />
                    <span>{provider.phone}</span>
                  </a>
                )}
                {provider.email && (
                  <a
                    href={`mailto:${provider.email}`}
                    className="flex items-center gap-2 text-[#78350f] hover:text-amber-300 transition-colors"
                  >
                    <Envelope size={18} weight="light" />
                    <span>{provider.email}</span>
                  </a>
                )}
                {provider.website && (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#78350f] hover:text-amber-300 transition-colors"
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
                <Tag size={48} weight="light" className="mx-auto text-[#92400e] mb-4" />
                <h3 className="text-lg font-medium text-[#451a03] mb-2">
                  No Deals Available Yet
                </h3>
                <p className="text-[#78350f] max-w-md mx-auto mb-6">
                  We&apos;re working to bring you exclusive deals from{' '}
                  {provider.name}. Check back soon for new offers.
                </p>
                <Link
                  href={`/${state.slug}/${citySlug}`}
                  className="inline-flex items-center gap-2 text-amber-800 hover:text-amber-300 transition-colors font-medium"
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
