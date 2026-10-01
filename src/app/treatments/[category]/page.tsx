import { ArrowLeft, Tag } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DealList, ProviderNamesNote } from '@/components/features/dealCard'
import { CollapsedDealList } from '@/components/features/dealsGrid'
import { CityPriceChart } from '@/components/features/homepage/cityPriceChart'
import { PriceRangeTiles } from '@/components/features/homepage/priceRangeStrip'
import { BreadcrumbSchema, FaqSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Faq } from '@/components/ui/faq'
import { type RelatedLink, RelatedLinks } from '@/components/ui/relatedLinks'
import {
  getCityMediansByTreatment,
  getTreatmentPriceRanges,
} from '@/lib/data/homepage'
import {
  cityToSlug,
  getDealsByDbCategorySlug,
  getUnifiedCategories,
} from '@/lib/data/unified'
import { getCategoryFaqs } from '@/lib/seo/faq-content'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'
import { buildTreatmentServiceSchema } from '@/lib/seo/schemas'

export const revalidate = 3600 // ISR: regenerate every hour

// Only the buckets that actually have deals are valid routes. Anything else is a real 404
// instead of a 200 "Treatment Not Found" shell -- notFound() alone cannot set the status
// once the root loading.tsx boundary has flushed the streamed shell. Same fix, same reason
// as src/app/[state]/page.tsx:19-21.
//
// Pinning the slug set at build time costs nothing here: the buckets come from CATEGORY_MAP,
// which only changes in a code change, and that ships a build anyway.
export const dynamicParams = false

export async function generateStaticParams() {
  const categories = await getUnifiedCategories()
  return categories.map((c) => ({ category: c.slug }))
}

// Generate metadata for SEO
interface MetadataProps {
  params: Promise<{ category: string }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { category: categorySlug } = await params
  const categories = await getUnifiedCategories()
  const category = categories.find((c) => c.slug === categorySlug)

  if (!category) {
    return {
      title: 'Treatment not found',
      description: 'The requested treatment category page could not be found.',
    }
  }

  const title = `${category.label} deals and prices`
  // No "verified": business_profiles and business_claims are both empty, so no provider on
  // this site has been claimed or vetted. The listings are prices providers publish themselves.
  const description = `Compare ${category.count} ${category.count === 1 ? 'deal' : 'deals'} on ${category.label.toLowerCase()} from medspa providers. See the prices they advertise publicly and find the lowest.`

  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalUrl(`/treatments/${category.slug}`),
    },
    openGraph: {
      title,
      description,
      url: buildCanonicalUrl(`/treatments/${category.slug}`),
      siteName: SITE_CONFIG.name,
      type: 'website',
    },
  }
}

// Page props with Next.js 15 async params
interface CategoryPageProps {
  params: Promise<{ category: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params

  // M3: Parallelize 3 independent queries (was sequential — 100-300ms savings on ISR miss)
  const [categories, deals, ranges, byTreatment] = await Promise.all([
    getUnifiedCategories(),
    getDealsByDbCategorySlug(categorySlug),
    getTreatmentPriceRanges(),
    getCityMediansByTreatment(),
  ])

  const category = categories.find((c) => c.slug === categorySlug)

  if (!category) {
    notFound()
  }

  // The data header: the treatments this browse bucket holds, matched on the same href the
  // homepage tiles link here with, and their medians by city. A bucket with no treatment that
  // clears the three-priced-offers floor (most of 'other') gets neither, not an empty frame.
  const bucketRanges = ranges.filter(
    (r) => r.href === `/treatments/${categorySlug}`,
  )
  // Two cities at least: a chart of one bar compares nothing.
  const bucketCities = byTreatment.filter(
    (t) =>
      t.rows.length >= 2 &&
      bucketRanges.some((r) => r.treatment === t.treatment),
  )
  // The cities where this bucket's deals actually are, most first. It listed the first eight
  // cities with any business — zero-deal ones included — under "{bucket} in {city}" while
  // linking to the whole city's deals.
  const perCity = new Map<string, number>()
  for (const deal of deals) {
    const city = deal.locationArea.trim()
    if (city) perCity.set(city, (perCity.get(city) ?? 0) + 1)
  }
  const cityLinks: RelatedLink[] = [...perCity]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([city, n]) => ({
      label: `Deals in ${city}`,
      href: `/deals/${cityToSlug(city)}`,
      description: `${n} ${category.label.toLowerCase()} ${n === 1 ? 'deal' : 'deals'}`,
    }))

  // Get FAQ content for this category
  const faqItems = getCategoryFaqs(category.label)

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: 'Treatments', url: buildCanonicalUrl('/treatments') },
    {
      name: category.label,
      url: buildCanonicalUrl(`/treatments/${category.slug}`),
    },
  ]

  // category.providerCount is the distinct business_id count behind this bucket, counted over
  // the same corpus `deals` comes from. Not derivable from `deals`: AnonymousDeal drops
  // businessId on purpose (providers stay anonymous until a user verifies), which is why
  // this line used to read Math.ceil(deals.length / 2).
  const businessCount = category.providerCount

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />
      <FaqSchema items={faqItems} />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildTreatmentServiceSchema(category.label, undefined),
          ),
        }}
      />

      <main className="pt-20">
        <section className="pb-10 sm:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Treatments', href: '/treatments' },
                { label: category.label },
              ]}
            />
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
              {category.label} deals
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-text-secondary">
              Compare the prices medspa providers advertise publicly and find
              the best {category.label.toLowerCase()} deals near you.
            </p>
            {/*
              "providers listed", not "verified providers": businessCount is a distinct count
              of the businesses behind these offers, every one of them compiled from public
              listings. Nothing on this site verifies a provider.
            */}
            <p className="mt-4 text-sm text-text-muted">
              <span className="font-semibold text-text-secondary tabular-nums">
                {deals.length}
              </span>{' '}
              active deals
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <span className="font-semibold text-text-secondary tabular-nums">
                {businessCount}
              </span>{' '}
              providers listed
            </p>
          </div>
        </section>

        {bucketRanges.length > 0 && (
          <section className="bg-bg-surface py-12 sm:py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                What it costs
              </h2>
              <p className="mt-1 mb-8 text-text-secondary">
                The advertised range across every provider we list.{' '}
                {bucketRanges.some((r) => r.perUnit)
                  ? 'Neurotoxins are per unit; everything else is the price you pay.'
                  : 'The price you pay, as each provider states it.'}
              </p>
              <PriceRangeTiles ranges={bucketRanges} linked={false} />
            </div>
          </section>
        )}

        {bucketCities.length > 0 && (
          <CityPriceChart byTreatment={bucketCities} cities={[]} />
        )}

        <section className="border-t border-border-default py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Every {category.label.toLowerCase()} deal
            </h2>

            {deals.length > 0 ? (
              <>
                <ProviderNamesNote className="mt-2 mb-5" />
                {/* Every city at once, so each row says where, and none says "vs typical": a
                    typical price is one city's market, not a yardstick for another's deals. */}
                <CollapsedDealList count={deals.length}>
                  <DealList deals={deals} />
                </CollapsedDealList>
              </>
            ) : (
              <div className="mt-8 text-center py-12 bg-bg-surface rounded-xl">
                <Tag
                  size={40}
                  weight="light"
                  className="mx-auto text-text-muted mb-4"
                />
                <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
                  No {category.label} deals listed yet
                </h3>
                <p className="text-text-secondary max-w-md mx-auto mb-6">
                  No provider we list is currently advertising a{' '}
                  {category.label.toLowerCase()} price. Browse the other
                  categories, or check back later.
                </p>
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  Browse all deals
                </Link>
              </div>
            )}

            <RelatedLinks
              title={`Find ${category.label} by Location`}
              links={cityLinks}
              className="mt-14"
            />

            <Faq items={faqItems} className="mt-14" />

            <div className="mt-10 pt-6 border-t border-border-default">
              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={16} weight="bold" />
                Back to all deals
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
