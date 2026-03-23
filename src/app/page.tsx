import { BusinessCtaSection } from '@/components/features/homepage/businessCtaSection'
import { CategoryGrid } from '@/components/features/homepage/categoryGrid'
import { CityGrid } from '@/components/features/homepage/cityGrid'
import { HeroSection } from '@/components/features/homepage/heroSection'
import { SocialProofSection } from '@/components/features/homepage/socialProofSection'
import { TrendingDealsSection } from '@/components/features/homepage/trendingDealsSection'
import { ValuePropsSection } from '@/components/features/homepage/valuePropsSection'
import { getCategoryLabel, getCategorySlug } from '@/lib/data/categories'
import { getFeaturedOffers, getOfferCategories } from '@/lib/data/offers'
import { getCityDealCounts } from '@/lib/data/unified'

export const revalidate = 3600 // ISR: regenerate every hour

export default async function Home() {
  const [featuredOffers, rawCategories, cityDealCounts] = await Promise.all([
    getFeaturedOffers(6),
    getOfferCategories(),
    getCityDealCounts(),
  ])

  const categories = rawCategories.map((c) => ({
    slug: getCategorySlug(c.service_category),
    label: getCategoryLabel(c.service_category),
    count: c.count,
  }))

  const totalOffers = rawCategories.reduce((sum, c) => sum + c.count, 0)
  const totalProviders = new Set(cityDealCounts.flatMap((c) => Array.from({ length: c.providerCount }))).size || cityDealCounts.reduce((sum, c) => sum + c.providerCount, 0)

  return (
    <main className="min-h-screen pt-16 pb-0">
      {/* Hero — full-bleed with image background */}
      <HeroSection
        categories={categories}
        totalOffers={totalOffers}
        totalBusinesses={totalProviders}
      />

      {/* Trending Deals — contained, base background */}
      <TrendingDealsSection offers={featuredOffers} />

      {/* Browse by Treatment — full-bleed surface band */}
      <div className="content-visibility-auto">
        <CategoryGrid categories={categories} />
      </div>

      {/* Browse by City — contained, base background */}
      <div className="content-visibility-auto">
        <CityGrid cities={cityDealCounts} />
      </div>

      {/* How It Works — full-bleed image background */}
      <div className="content-visibility-auto">
        <ValuePropsSection />
      </div>

      {/* Social Proof — full-bleed elevated band */}
      <div className="content-visibility-auto">
        <SocialProofSection
          totalOffers={totalOffers}
          totalBusinesses={totalProviders}
        />
      </div>

      {/* Business CTA — full-bleed dark inverted */}
      <div className="content-visibility-auto">
        <BusinessCtaSection />
      </div>
    </main>
  )
}
