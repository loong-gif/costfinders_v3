import { BusinessCtaSection } from '@/components/features/homepage/businessCtaSection'
import { CategoryGrid } from '@/components/features/homepage/categoryGrid'
import { CityGrid } from '@/components/features/homepage/cityGrid'
import { HeroSection } from '@/components/features/homepage/heroSection'
import { ValuePropsSection } from '@/components/features/homepage/valuePropsSection'
import { OfferCard } from '@/components/features/offerCard'
import { getBusinessCities } from '@/lib/data/businesses'
import { getCategoryLabel, getCategorySlug } from '@/lib/data/categories'
import { getFeaturedOffers, getOfferCategories } from '@/lib/data/offers'

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
              <h2 className="text-xl font-semibold text-[#451a03]">
                Trending deals
              </h2>
              <p className="text-sm text-[#92400e] mt-1">
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
