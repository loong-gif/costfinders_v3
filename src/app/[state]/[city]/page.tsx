import { MapPin, Storefront, Tag } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NeighborhoodCard } from '@/components/features/neighborhoodCard'
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getBusinessCountForCity,
  getCityOfferCount,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getNeighborhoodsForCity, slugifyNeighborhood } from '@/lib/mock-data/cities'
import { getStateBySlug } from '@/lib/mock-data/states'
import {
  buildCanonicalUrl,
  generateLocationMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'

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
      title: 'City Not Found | CostFinders',
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
      title: 'City Not Found | CostFinders',
      description: 'The requested city page could not be found.',
    }
  }

  const dealCount = await getCityOfferCount(city.name)
  return generateLocationMetadata(city.name, state.name, dealCount)
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
  const [businessCount, dealCount] = await Promise.all([
    getBusinessCountForCity(city.name),
    getCityOfferCount(city.name),
  ])

  // Keep mock neighborhoods since they don't exist in Supabase
  // Use a synthetic city ID to look up mock neighborhoods
  const mockCityId = `city-${city.slug}`
  const neighborhoods = getNeighborhoodsForCity(mockCityId)
  const neighborhoodCount = neighborhoods.length

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

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: state.name, href: `/${state.slug}` },
                { label: city.name },
              ]}
            />

            {/* Hero Content */}
            <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-800/15 flex items-center justify-center">
                  <MapPin size={24} weight="fill" className="text-amber-800" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03]">
                  Medspa Deals in {city.name}, {state.name}
                </h1>
              </div>

              <p className="text-[#78350f] max-w-2xl mb-6">
                Discover the best medspa deals and aesthetic treatments in{' '}
                {city.name}, {state.name}. Compare prices on Botox, fillers,
                laser treatments, and more from {businessCount} verified
                providers.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Tag size={20} weight="light" className="text-amber-800" />
                  <span className="font-semibold text-[#451a03]">
                    {dealCount}
                  </span>
                  <span className="text-[#78350f]">Active Deals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Storefront
                    size={20}
                    weight="light"
                    className="text-amber-800"
                  />
                  <span className="font-semibold text-[#451a03]">
                    {businessCount}
                  </span>
                  <span className="text-[#78350f]">Verified Providers</span>
                </div>
                {neighborhoodCount > 0 && (
                  <div className="flex items-center gap-2">
                    <MapPin
                      size={20}
                      weight="light"
                      className="text-amber-800"
                    />
                    <span className="font-semibold text-[#451a03]">
                      {neighborhoodCount}
                    </span>
                    <span className="text-[#78350f]">
                      {neighborhoodCount === 1
                        ? 'Neighborhood'
                        : 'Neighborhoods'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Neighborhoods Grid */}
          {neighborhoods.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-[#451a03] mb-6">
                Browse by Neighborhood
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {neighborhoods.map((neighborhood) => {
                  const neighborhoodSlug = slugifyNeighborhood(neighborhood.name)
                  // Distribute real counts across neighborhoods
                  const neighborhoodDealCount = Math.ceil(
                    dealCount / Math.max(neighborhoodCount, 1),
                  )
                  const neighborhoodBusinessCount = Math.ceil(
                    businessCount / Math.max(neighborhoodCount, 1),
                  )

                  return (
                    <NeighborhoodCard
                      key={neighborhood.id}
                      name={neighborhood.name}
                      slug={neighborhoodSlug}
                      citySlug={citySlug}
                      stateSlug={state.slug}
                      cityName={city.name}
                      dealCount={neighborhoodDealCount}
                      businessCount={neighborhoodBusinessCount}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Empty State (no neighborhoods) */}
          {neighborhoods.length === 0 && (
            <section>
              <div className="text-center py-12 bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px]">
                <MapPin
                  size={48}
                  weight="light"
                  className="mx-auto text-[#92400e] mb-4"
                />
                <h3 className="text-lg font-medium text-[#451a03] mb-2">
                  No Neighborhoods Available Yet
                </h3>
                <p className="text-[#78350f] max-w-md mx-auto">
                  We&apos;re expanding to more neighborhoods in {city.name}{' '}
                  soon. Check back later for new locations.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
