import { BusinessCtaSection } from '@/components/features/homepage/businessCtaSection'
import { CategoryGrid } from '@/components/features/homepage/categoryGrid'
import { CityGrid } from '@/components/features/homepage/cityGrid'
import { HeroSection } from '@/components/features/homepage/heroSection'
import { SocialProofSection } from '@/components/features/homepage/socialProofSection'
import { TrendingDealsSection } from '@/components/features/homepage/trendingDealsSection'
import { ValuePropsSection } from '@/components/features/homepage/valuePropsSection'
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
    <main className="min-h-screen pt-16 pb-0">
      {/* Hero — full-bleed with image background */}
      <HeroSection
        categories={categories}
        totalOffers={totalOffers}
        totalBusinesses={totalBusinesses}
      />

      {/* Trending Deals — contained, base background */}
      <TrendingDealsSection offers={featuredOffers} />

      {/* Browse by Treatment — full-bleed surface band */}
      <CategoryGrid categories={categories} />

      {/* Browse by City — contained, base background */}
      <CityGrid cities={cities} />

      {/* How It Works — full-bleed image background */}
      <ValuePropsSection />

      {/* Social Proof — full-bleed elevated band */}
      <SocialProofSection
        totalOffers={totalOffers}
        totalBusinesses={totalBusinesses}
      />

      {/* Business CTA — full-bleed dark inverted */}
      <BusinessCtaSection />
    </main>
  )
}
