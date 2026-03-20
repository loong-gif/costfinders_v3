import { getFeaturedOffers, getOfferCategories } from '@/lib/data/offers'
import { getBusinessCities } from '@/lib/data/businesses'
import { getCategoryLabel, getCategorySlug } from '@/lib/data/categories'
import { HeroSection } from '@/components/features/homepage/heroSection'
import { OfferCard } from '@/components/features/offerCard'
import { CategoryGrid } from '@/components/features/homepage/categoryGrid'
import { CityGrid } from '@/components/features/homepage/cityGrid'
import { ValuePropsSection } from '@/components/features/homepage/valuePropsSection'
import { BusinessCtaSection } from '@/components/features/homepage/businessCtaSection'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [featuredOffers, rawCategories, cities] = await Promise.all([
    getFeaturedOffers(6),
    getOfferCategories(),
    getBusinessCities(),
  ])

  const categories = rawCategories.map((c) => ({
    slug: getCategorySlug(c.service_category),
    label: getCategoryLabel(c.service_category),
    count: c.count,
  }))

  const totalOffers = rawCategories.reduce((sum, c) => sum + c.count, 0)
  const totalBusinesses = cities.reduce((sum, c) => sum + c.count, 0)

  return (
    <main className="min-h-screen pt-16 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <HeroSection
          categories={categories}
          totalOffers={totalOffers}
          totalBusinesses={totalBusinesses}
        />

        {/* Trending Offers */}
        <section className="py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-stone-100">
                Trending deals
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Best savings right now
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>

        <CategoryGrid categories={categories} />
        <CityGrid cities={cities} />
        <ValuePropsSection />
        <BusinessCtaSection />
      </div>
    </main>
  )
}
