import { MapPin, Storefront, Tag } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BreadcrumbSchema, FaqSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Faq } from '@/components/ui/faq'
import { RelatedLinks, type RelatedLink } from '@/components/ui/relatedLinks'
import { CityCard } from '@/components/features/cityCard'
import {
  buildCanonicalUrl,
  generateStateMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import { getStateFaqs } from '@/lib/seo/faq-content'
import {
  getStates,
  getStateBySlug,
  getCitiesForState,
  getStateStats,
  slugifyCity,
} from '@/lib/mock-data/states'
import {
  getDealCountForCity,
  getBusinessCountForCity,
} from '@/lib/mock-data/locations'
import { getCategories } from '@/lib/mock-data/categories'

// Generate static params for all supported states
export async function generateStaticParams() {
  const states = getStates()
  return states.map((state) => ({ state: state.slug }))
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
      title: 'State Not Found | CostFinders',
      description: 'The requested state page could not be found.',
    }
  }

  const stats = getStateStats(state.code)
  return generateStateMetadata(state.name, stats.cityCount, stats.dealCount)
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

  const cities = getCitiesForState(state.code)
  const stats = getStateStats(state.code)

  // Build category links for related treatments section
  const categories = getCategories()
  const categoryLinks: RelatedLink[] = categories.slice(0, 6).map((cat) => ({
    label: `${cat.name} in ${state.name}`,
    href: `/treatments/${cat.slug}`,
    description: `${cat.description.substring(0, 50)}...`,
  }))

  // Get FAQ content for this state
  const faqItems = getStateFaqs(state.name)

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

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: state.name },
              ]}
            />

            {/* Hero Content */}
            <div className="bg-stone-900 border border-stone-800 rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/20 flex items-center justify-center">
                  <MapPin size={24} weight="fill" className="text-amber-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-stone-100">
                  Medspa Deals in {state.name}
                </h1>
              </div>

              <p className="text-stone-400 max-w-2xl mb-6">
                Discover the best medspa deals and aesthetic treatments across{' '}
                {state.name}. Compare prices on Botox, fillers, laser treatments, and
                more from verified providers in {stats.cityCount}{' '}
                {stats.cityCount === 1 ? 'city' : 'cities'}.
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
                <div className="flex items-center gap-2">
                  <MapPin size={20} weight="light" className="text-amber-400" />
                  <span className="font-semibold text-stone-100">
                    {stats.cityCount}
                  </span>
                  <span className="text-stone-400">
                    {stats.cityCount === 1 ? 'City' : 'Cities'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Cities Grid */}
          <section>
            <h2 className="text-xl font-semibold text-stone-100 mb-6">
              Browse by City
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cities.map((city) => {
                const citySlug = slugifyCity(city.name)
                const dealCount = getDealCountForCity(city.id)
                const businessCount = getBusinessCountForCity(city.id)

                return (
                  <CityCard
                    key={city.id}
                    name={city.name}
                    slug={citySlug}
                    stateSlug={state.slug}
                    stateName={state.name}
                    dealCount={dealCount}
                    businessCount={businessCount}
                  />
                )
              })}
            </div>

            {/* Empty State */}
            {cities.length === 0 && (
              <div className="text-center py-12 bg-stone-900 border border-stone-800 rounded-[10px]">
                <MapPin size={48} weight="light" className="mx-auto text-stone-500 mb-4" />
                <h3 className="text-lg font-medium text-stone-100 mb-2">
                  No Cities Available Yet
                </h3>
                <p className="text-stone-400 max-w-md mx-auto">
                  We&apos;re expanding to more cities in {state.name} soon. Check back
                  later for new locations.
                </p>
              </div>
            )}
          </section>

          {/* Related Treatments */}
          <section className="mt-12">
            <RelatedLinks
              title="Popular Treatments"
              links={categoryLinks}
            />
          </section>

          {/* FAQ Section */}
          <section className="mt-12">
            <Faq items={faqItems} />
          </section>
        </div>
      </main>
    </>
  )
}
