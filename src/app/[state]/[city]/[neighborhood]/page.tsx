import { MapPin, Storefront, Tag } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { DealCard } from '@/components/features/dealCard'
import {
  buildCanonicalUrl,
  generateLocationMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import { getStateBySlug } from '@/lib/mock-data/states'
import { getCityBySlug, slugifyNeighborhood } from '@/lib/mock-data/cities'
import {
  getNeighborhoodBySlug,
  getNeighborhoodStats,
  getDealsForNeighborhood,
  getAllNeighborhoodsWithCityAndState,
} from '@/lib/mock-data/neighborhoods'

// Generate static params for all supported neighborhoods
export async function generateStaticParams() {
  const neighborhoodsWithContext = getAllNeighborhoodsWithCityAndState()
  return neighborhoodsWithContext.map(({ stateSlug, citySlug, neighborhoodSlug }) => ({
    state: stateSlug,
    city: citySlug,
    neighborhood: neighborhoodSlug,
  }))
}

// Generate metadata for SEO
interface MetadataProps {
  params: Promise<{ state: string; city: string; neighborhood: string }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug, neighborhood: neighborhoodSlug } = await params
  const state = getStateBySlug(stateSlug)
  const city = getCityBySlug(stateSlug, citySlug)
  const neighborhood = getNeighborhoodBySlug(stateSlug, citySlug, neighborhoodSlug)

  if (!state || !city || !neighborhood) {
    return {
      title: 'Neighborhood Not Found | CostFinders',
      description: 'The requested neighborhood page could not be found.',
    }
  }

  const stats = getNeighborhoodStats(neighborhood.id)

  // Generate metadata with neighborhood context
  return {
    ...generateLocationMetadata(city.name, state.name, stats.dealCount),
    title: `Medspa Deals in ${neighborhood.name}, ${city.name} | CostFinders`,
    description: `Compare ${stats.dealCount} medspa deals in ${neighborhood.name}, ${city.name}, ${state.name}. Find Botox, fillers, facials, and laser treatments from ${stats.businessCount} local providers.`,
  }
}

// Page props with Next.js 15 async params
interface NeighborhoodPageProps {
  params: Promise<{ state: string; city: string; neighborhood: string }>
}

export default async function NeighborhoodPage({ params }: NeighborhoodPageProps) {
  const { state: stateSlug, city: citySlug, neighborhood: neighborhoodSlug } = await params
  const state = getStateBySlug(stateSlug)
  const city = getCityBySlug(stateSlug, citySlug)
  const neighborhood = getNeighborhoodBySlug(stateSlug, citySlug, neighborhoodSlug)

  if (!state || !city || !neighborhood) {
    notFound()
  }

  const stats = getNeighborhoodStats(neighborhood.id)
  const deals = getDealsForNeighborhood(neighborhood.id)

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: state.name, url: buildCanonicalUrl(`/${state.slug}`) },
    { name: city.name, url: buildCanonicalUrl(`/${state.slug}/${citySlug}`) },
    {
      name: neighborhood.name,
      url: buildCanonicalUrl(`/${state.slug}/${citySlug}/${neighborhoodSlug}`),
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
                { label: neighborhood.name },
              ]}
            />

            {/* Hero Content */}
            <div className="bg-stone-900 border border-stone-800 rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/20 flex items-center justify-center">
                  <MapPin size={24} weight="fill" className="text-amber-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-stone-100">
                  Medspa Deals in {neighborhood.name}
                </h1>
              </div>

              <p className="text-stone-400 max-w-2xl mb-6">
                Browse exclusive medspa deals and aesthetic treatments in{' '}
                {neighborhood.name}, {city.name}. Compare prices on Botox, fillers,
                laser treatments, and facials from trusted local providers.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Tag size={20} weight="light" className="text-amber-400" />
                  <span className="font-semibold text-stone-100">
                    {stats.dealCount}
                  </span>
                  <span className="text-stone-400">Active Deals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Storefront size={20} weight="light" className="text-amber-400" />
                  <span className="font-semibold text-stone-100">
                    {stats.businessCount}
                  </span>
                  <span className="text-stone-400">Verified Providers</span>
                </div>
              </div>
            </div>
          </section>

          {/* Deals Grid */}
          <section>
            <h2 className="text-xl font-semibold text-stone-100 mb-6">
              Available Deals in {neighborhood.name}
            </h2>

            {deals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-12 bg-stone-900 border border-stone-800 rounded-[10px]">
                <Tag size={48} weight="light" className="mx-auto text-stone-500 mb-4" />
                <h3 className="text-lg font-medium text-stone-100 mb-2">
                  No Deals Available Yet
                </h3>
                <p className="text-stone-400 max-w-md mx-auto mb-6">
                  We&apos;re working to bring you the best medspa deals in{' '}
                  {neighborhood.name}. Check back soon for new offers.
                </p>
                <Link
                  href={`/${state.slug}/${citySlug}`}
                  className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors font-medium"
                >
                  <MapPin size={18} weight="light" />
                  Browse other neighborhoods in {city.name}
                </Link>
              </div>
            )}
          </section>

          {/* Back Navigation */}
          <div className="mt-8 pt-6 border-t border-stone-800">
            <Link
              href={`/${state.slug}/${citySlug}`}
              className="inline-flex items-center gap-2 text-stone-400 hover:text-stone-100 transition-colors"
            >
              <MapPin size={18} weight="light" />
              Back to {city.name} neighborhoods
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
