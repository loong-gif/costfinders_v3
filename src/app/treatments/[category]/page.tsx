import {
  Drop,
  Leaf,
  Lightning,
  Person,
  Sparkle,
  Storefront,
  Syringe,
  Tag,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DealCard } from '@/components/features/dealCard'
import { BreadcrumbSchema, FaqSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Faq } from '@/components/ui/faq'
import { type RelatedLink, RelatedLinks } from '@/components/ui/relatedLinks'
import {
  getDealsByDbCategorySlug,
  getUnifiedCategories,
  getUnifiedCities,
} from '@/lib/data/unified'
import { getCategoryFaqs } from '@/lib/seo/faq-content'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'
import { buildTreatmentServiceSchema } from '@/lib/seo/schemas'

export const revalidate = 3600 // ISR: regenerate every hour

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  Syringe: <Syringe size={24} weight="fill" className="text-amber-800" />,
  Drop: <Drop size={24} weight="fill" className="text-amber-800" />,
  Sparkle: <Sparkle size={24} weight="fill" className="text-amber-800" />,
  Lightning: <Lightning size={24} weight="fill" className="text-amber-800" />,
  Person: <Person size={24} weight="fill" className="text-amber-800" />,
  Leaf: <Leaf size={24} weight="fill" className="text-amber-800" />,
}

// Map DB category slugs to icon names
const slugToIcon: Record<string, string> = {
  neurotoxins: 'Syringe',
  fillers: 'Drop',
  'facials-lasers': 'Sparkle',
  wellness: 'Leaf',
  consultations: 'Person',
  other: 'Lightning',
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
      title: 'Treatment Not Found | CostFinders',
      description: 'The requested treatment category page could not be found.',
    }
  }

  const title = `${category.label} Deals & Discounts | CostFinders`
  const description = `Compare ${category.count} ${category.label.toLowerCase()} deals from verified providers. Find the best prices on ${category.label.toLowerCase()} treatments.`

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
  const [categories, deals, cities] = await Promise.all([
    getUnifiedCategories(),
    getDealsByDbCategorySlug(categorySlug),
    getUnifiedCities(),
  ])

  const category = categories.find((c) => c.slug === categorySlug)

  if (!category) {
    notFound()
  }

  const iconName = slugToIcon[categorySlug] || 'Lightning'
  const CategoryIcon = categoryIcons[iconName] || (
    <Tag size={24} weight="fill" className="text-amber-800" />
  )
  const cityLinks: RelatedLink[] = cities.slice(0, 8).map((c) => ({
    label: `${category.label} in ${c.name}`,
    href: `/deals/${c.slug}`,
    description: `Browse ${category.label.toLowerCase()} deals in ${c.name}`,
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

  const businessCount = Math.ceil(deals.length / 2)

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
            buildTreatmentServiceSchema(category.label, 'Multiple Cities', {
              dealCount: deals.length,
              minPrice: deals.length > 0 ? Math.min(...deals.map((d) => d.dealPrice)) : undefined,
              maxPrice: deals.length > 0 ? Math.max(...deals.map((d) => d.dealPrice)) : undefined,
            }),
          ),
        }}
      />

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Treatments', href: '/treatments' },
                { label: category.label },
              ]}
            />

            {/* Hero Content */}
            <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-800/15 flex items-center justify-center">
                  {CategoryIcon}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03]">
                  {category.label} Deals
                </h1>
              </div>

              <p className="text-[#78350f] max-w-2xl mb-6">
                Compare prices from verified medspa providers and find the best
                deals on {category.label.toLowerCase()} treatments near you.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Tag size={20} weight="light" className="text-amber-800" />
                  <span className="font-semibold text-[#451a03]">
                    {deals.length}
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
              </div>
            </div>
          </section>

          {/* Deals Grid */}
          <section>
            <h2 className="text-xl font-semibold text-[#451a03] mb-6">
              Available {category.label} Deals
            </h2>

            {deals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-12 bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px]">
                <Tag
                  size={48}
                  weight="light"
                  className="mx-auto text-[#92400e] mb-4"
                />
                <h3 className="text-lg font-medium text-[#451a03] mb-2">
                  No {category.label} Deals Available Yet
                </h3>
                <p className="text-[#78350f] max-w-md mx-auto mb-6">
                  We&apos;re working to bring you the best{' '}
                  {category.label.toLowerCase()} deals. Check back soon for new
                  offers from verified providers.
                </p>
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
                >
                  <Tag size={18} weight="light" />
                  Browse all deals
                </Link>
              </div>
            )}
          </section>

          {/* Browse by Location */}
          <section className="mt-12">
            <RelatedLinks
              title={`Find ${category.label} by Location`}
              links={cityLinks}
            />
          </section>

          {/* FAQ Section */}
          <section className="mt-12">
            <Faq items={faqItems} />
          </section>

          {/* Back Navigation */}
          <div className="mt-8 pt-6 border-t border-[#d4c4b0]">
            <Link
              href="/deals"
              className="inline-flex items-center gap-2 text-[#78350f] hover:text-[#451a03] transition-colors"
            >
              <Tag size={18} weight="light" />
              Back to all deals
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
