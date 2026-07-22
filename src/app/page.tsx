import { SupabaseSetupNotice } from '@/components/features/demo/supabaseSetupNotice'
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
import { isSupabaseConfigured } from '@/lib/supabase-config'

export const revalidate = 3600 // ISR: regenerate every hour

export default async function Home() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />
  }

  const [featuredOffers, rawCategories, cityDealCounts] = await Promise.all([
    getFeaturedOffers(6),
    getOfferCategories(),
    getCityDealCounts(),
  ])

  const categoriesBySlug = new Map<
    string,
    { slug: string; label: string; count: number }
  >()

  for (const category of rawCategories) {
    const slug = getCategorySlug(category.service_category)
    const existing = categoriesBySlug.get(slug)

    if (existing) {
      existing.count += category.count
      continue
    }

    categoriesBySlug.set(slug, {
      slug,
      label:
        slug === 'other'
          ? 'Other Services'
          : getCategoryLabel(category.service_category),
      count: category.count,
    })
  }

  const categories = Array.from(categoriesBySlug.values())

  const totalOffers = rawCategories.reduce((sum, c) => sum + c.count, 0)
  const totalProviders = cityDealCounts.reduce(
    (sum, city) => sum + city.providerCount,
    0,
  )

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
