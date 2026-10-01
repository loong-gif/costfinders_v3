import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityFactors } from '@/components/features/guides/cityFactors'
import { CityMarketContext } from '@/components/features/guides/cityMarketContext'
import { CityPricingTable } from '@/components/features/guides/cityPricingTable'
import { GuideCta } from '@/components/features/guides/guideCta'
import { GuideFaq } from '@/components/features/guides/guideFaq'
import { GuideMethodology } from '@/components/features/guides/guideMethodology'
import { NationalComparison } from '@/components/features/guides/nationalComparison'
import { PricingModelExplainer } from '@/components/features/guides/pricingModelExplainer'
import { PricingStatsHero } from '@/components/features/guides/pricingStatsHero'
import { SavingsTips } from '@/components/features/guides/savingsTips'
import {
  BreadcrumbSchema,
  FaqSchema,
  PricingGuideSchema,
} from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getAvailableGuides,
  getGuideSummaries,
  loadGuideContent,
  parseGuideSlug,
} from '@/lib/data/guide-content'
import {
  getGuideDealsPreview,
  getGuidePricingStats,
} from '@/lib/data/guide-stats'
import {
  buildCanonicalUrl,
  generateGuideMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import type { TreatmentCategory } from '@/types/deal'

export const revalidate = 86400 // ISR: regenerate every 24 hours

/**
 * The guide set is exactly the JSON files in src/content/guides — there is nothing to render
 * on demand. Without this, Next served HTTP 200 for any slug at all: /guides/botox-cost-nowhere
 * returned 200 with not-found content and got edge-cached, so a crawler could mint unlimited
 * soft-404s from a URL pattern that is trivially guessable.
 */
export const dynamicParams = false

export async function generateStaticParams() {
  return getAvailableGuides().map((g) => ({ slug: g.slug }))
}

interface GuidePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseGuideSlug(slug)
  if (!parsed) return { title: 'Guide Not Found' }

  const content = loadGuideContent(slug)
  if (!content) return { title: 'Guide Not Found' }

  const stats = await getGuidePricingStats(
    parsed.treatment as TreatmentCategory,
    parsed.city,
  )

  return generateGuideMetadata(
    content.treatmentLabel,
    content.treatment,
    content.cityLabel,
    content.city,
    content.stateCode,
    {
      dealCount: stats.dealCount,
      providerCount: stats.providerCount,
      minPrice: stats.minPrice,
      minBrand: stats.minBrand,
      maxPrice: stats.maxPrice,
      typicalPrice: stats.medianPrice,
      perUnit: stats.perUnit,
    },
    content.generatedAt,
  )
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params
  const parsed = parseGuideSlug(slug)
  if (!parsed) notFound()

  const content = loadGuideContent(slug)
  if (!content) notFound()

  const treatment = parsed.treatment as TreatmentCategory

  // Fetch real-time data from Supabase
  const [stats, topDeals] = await Promise.all([
    getGuidePricingStats(treatment, parsed.city),
    getGuideDealsPreview(treatment, parsed.city, 3),
  ])

  // Deliberately NOT notFound() on an empty deal feed. The guide's ~1,200 researched words
  // about how this treatment is priced in this city stay true when a provider's promotions
  // lapse, and hard-404ing an indexed URL over a transient feed gap throws away the ranking
  // it earned — a 24h-cached 404, at that. The page renders without the live-deal sections;
  // getGuidePricingStats returns zeroes and each stats-driven block skips itself.
  const hasLiveDeals = stats.dealCount > 0

  const relatedGuides = getGuideSummaries().filter((g) => g.slug !== slug)
  const dealsLink = `/deals/${content.treatment}/${content.city}`

  // Structured data
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: 'Cost Guides', url: buildCanonicalUrl('/guides') },
    {
      name: `${content.treatmentLabel} in ${content.cityLabel}`,
      url: buildCanonicalUrl(`/guides/${slug}`),
    },
  ]

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <FaqSchema items={content.faqs} />
      <PricingGuideSchema
        cityName={content.cityLabel}
        dates={{
          datePublished: new Date(content.generatedAt).toISOString(),
          // Prices are re-read from Supabase on every ISR regeneration, so the page
          // genuinely changes daily. Claiming the authoring date as dateModified
          // would understate that.
          dateModified: new Date().toISOString(),
        }}
        slug={slug}
        state={content.state}
        stats={{
          dealCount: stats.dealCount,
          minPrice: stats.minPrice,
          maxPrice: stats.maxPrice,
          avgPrice: stats.avgPrice,
          providerCount: stats.providerCount,
        }}
        treatmentName={content.treatmentLabel}
      />

      <main className="pt-20 pb-20 md:pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Cost Guides', href: '/guides' },
              {
                label: `${content.treatmentLabel} in ${content.cityLabel}`,
              },
            ]}
          />

          <PricingStatsHero
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
            stateCode={content.stateCode}
            stats={stats}
            generatedAt={content.generatedAt}
          />

          <PricingModelExplainer
            content={content.howPricingWorks}
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
          />

          <CityPricingTable
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
            stats={stats}
          />

          <CityFactors
            content={content.whatAffectsPricing}
            cityLabel={content.cityLabel}
            treatmentLabel={content.treatmentLabel}
          />

          <CityMarketContext
            cityLabel={content.cityLabel}
            content={content.cityContext}
            treatmentLabel={content.treatmentLabel}
          />

          <SavingsTips
            content={content.howToSave}
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
            deals={hasLiveDeals ? topDeals : []}
            dealsLink={dealsLink}
          />

          <NationalComparison
            content={content.nationalComparison}
            cityLabel={content.cityLabel}
          />

          <GuideFaq
            faqs={content.faqs}
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
          />

          <GuideMethodology
            cityLabel={content.cityLabel}
            generatedAt={content.generatedAt}
            providerCount={stats.providerCount}
            treatmentLabel={content.treatmentLabel}
          />

          <GuideCta
            cityLabel={content.cityLabel}
            citySlug={content.city}
            dealCount={stats.dealCount}
            dealsLink={dealsLink}
            relatedGuides={relatedGuides}
            treatmentLabel={content.treatmentLabel}
            treatmentSlug={content.treatment}
          />
        </div>
      </main>
    </>
  )
}
