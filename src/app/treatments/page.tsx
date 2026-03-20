import {
  ArrowRight,
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
import { BreadcrumbSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { type Category, getCategories } from '@/lib/mock-data/categories'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  Syringe: <Syringe size={24} weight="fill" className="text-amber-800" />,
  Drop: <Drop size={24} weight="fill" className="text-amber-800" />,
  Sparkle: <Sparkle size={24} weight="fill" className="text-amber-800" />,
  Lightning: <Lightning size={24} weight="fill" className="text-amber-800" />,
  Person: <Person size={24} weight="fill" className="text-amber-800" />,
  Leaf: <Leaf size={24} weight="fill" className="text-amber-800" />,
}

// Static metadata for SEO
export const metadata: Metadata = {
  title: 'Browse Aesthetic Treatments | CostFinders',
  description:
    'Explore aesthetic treatment categories including Botox, fillers, facials, laser treatments, body contouring, and skincare. Compare deals from verified medspa providers.',
  alternates: {
    canonical: buildCanonicalUrl('/treatments'),
  },
  openGraph: {
    title: 'Browse Aesthetic Treatments | CostFinders',
    description:
      'Explore aesthetic treatment categories including Botox, fillers, facials, laser treatments, body contouring, and skincare.',
    url: buildCanonicalUrl('/treatments'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

// Category card component
function CategoryCard({ category }: { category: Category }) {
  const icon = categoryIcons[category.icon] || (
    <Tag size={24} weight="fill" className="text-amber-800" />
  )

  return (
    <Link
      href={`/treatments/${category.slug}`}
      className="group bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl p-5 shadow-md transition-all duration-200 hover:border-[#c4b09a] hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-800/8 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#451a03] group-hover:text-amber-800 transition-colors">
              {category.name}
            </h3>
          </div>
        </div>
        <ArrowRight
          size={20}
          weight="light"
          className="text-[#92400e] group-hover:text-amber-800 group-hover:translate-x-1 transition-all"
        />
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-[#78350f] line-clamp-2">
        {category.description}
      </p>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-[#d4c4b0] flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Tag size={16} weight="light" className="text-amber-800" />
          <span>{category.dealCount} deals</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Storefront size={16} weight="light" className="text-amber-800" />
          <span>{Math.ceil(category.dealCount / 2)} providers</span>
        </div>
      </div>
    </Link>
  )
}

export default function TreatmentsPage() {
  const categories = getCategories().filter((c) => c.isActive)

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: 'Treatments', url: buildCanonicalUrl('/treatments') },
  ]

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbSchema items={breadcrumbItems} />

      <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[{ label: 'Home', href: '/' }, { label: 'Treatments' }]}
            />

            {/* Hero Content */}
            <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-800/15 flex items-center justify-center">
                  <Sparkle size={24} weight="fill" className="text-amber-800" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03]">
                  Browse Treatments
                </h1>
              </div>

              <p className="text-[#78350f] max-w-2xl mb-6">
                Explore our curated categories of aesthetic treatments. Compare
                prices from verified medspa providers and find the best deals
                near you.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Tag size={20} weight="light" className="text-amber-800" />
                  <span className="font-semibold text-[#451a03]">
                    {categories.reduce((sum, c) => sum + c.dealCount, 0)}
                  </span>
                  <span className="text-[#78350f]">Total Deals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Storefront
                    size={20}
                    weight="light"
                    className="text-amber-800"
                  />
                  <span className="font-semibold text-[#451a03]">
                    {categories.length}
                  </span>
                  <span className="text-[#78350f]">Treatment Categories</span>
                </div>
              </div>
            </div>
          </section>

          {/* Categories Grid */}
          <section>
            <h2 className="text-xl font-semibold text-[#451a03] mb-6">
              Treatment Categories
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </section>

          {/* Browse All Deals CTA */}
          <section className="mt-12">
            <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-6 shadow-md text-center">
              <h3 className="text-lg font-semibold text-[#451a03] mb-2">
                Looking for something specific?
              </h3>
              <p className="text-[#78350f] mb-4">
                Browse all available deals and filter by location, price, and
                more.
              </p>
              <Link
                href="/deals"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-800 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors"
              >
                <Tag size={20} weight="light" />
                Browse All Deals
              </Link>
            </div>
          </section>

          {/* Back Navigation */}
          <div className="mt-8 pt-6 border-t border-[#d4c4b0]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#78350f] hover:text-[#451a03] transition-colors"
            >
              <ArrowRight size={18} weight="light" className="rotate-180" />
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
