import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityFactors } from '@/components/features/guides/cityFactors'
import { CityPricingTable } from '@/components/features/guides/cityPricingTable'
import { GuideCta } from '@/components/features/guides/guideCta'
import { GuideFaq } from '@/components/features/guides/guideFaq'
import { NationalComparison } from '@/components/features/guides/nationalComparison'
import { PricingModelExplainer } from '@/components/features/guides/pricingModelExplainer'
import { PricingStatsHero } from '@/components/features/guides/pricingStatsHero'
import { SavingsTips } from '@/components/features/guides/savingsTips'
import { BreadcrumbSchema, FaqSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import {
  getAvailableGuides,
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
import { buildPricingGuideSchema } from '@/lib/seo/schemas'
import type { TreatmentCategory } from '@/types/deal'

export const revalidate = 86400 // ISR: regenerate every 24 hours

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
  if (!parsed) return { title: 'Guide Not Found | CostFinders' }

  const content = loadGuideContent(slug)
  if (!content) return { title: 'Guide Not Found | CostFinders' }

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
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      avgPrice: stats.avgPrice,
    },
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

  if (stats.dealCount === 0) notFound()

  const relatedGuides = getAvailableGuides().filter((g) => g.slug !== slug)
  const dealsLink = `/deals/${content.treatment}/${content.city}`

  // Structured data
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: 'Pricing Guides', url: buildCanonicalUrl('/guides') },
    {
      name: `${content.treatmentLabel} in ${content.cityLabel}`,
      url: buildCanonicalUrl(`/guides/${slug}`),
    },
  ]

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <FaqSchema items={content.faqs} />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildPricingGuideSchema(
              content.treatmentLabel,
              content.cityLabel,
              content.state,
              slug,
              {
                dealCount: stats.dealCount,
                minPrice: stats.minPrice,
                maxPrice: stats.maxPrice,
                avgPrice: stats.avgPrice,
                providerCount: stats.providerCount,
              },
            ),
          ),
        }}
      />

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Pricing Guides', href: '/guides' },
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
          />

          <SavingsTips
            content={content.howToSave}
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
            deals={topDeals}
            dealsLink={dealsLink}
          />

          <NationalComparison
            content={content.nationalComparison}
            cityLabel={content.cityLabel}
            stats={stats}
          />

          <GuideFaq
            faqs={content.faqs}
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
          />

          <GuideCta
            treatmentLabel={content.treatmentLabel}
            cityLabel={content.cityLabel}
            dealCount={stats.dealCount}
            dealsLink={dealsLink}
            relatedGuides={relatedGuides}
            treatmentSlug={content.treatment}
          />
        </div>
      </main>
    </>
  )
}
