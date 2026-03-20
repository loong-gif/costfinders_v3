import { getCategories } from '@/lib/mock-data/categories'
import { getDealsByCategory } from '@/lib/mock-data'
import { CategoryPreviewCard } from './categoryPreviewCard'

// Show only the main 4 categories
const FEATURED_CATEGORY_SLUGS = ['botox', 'fillers', 'facials', 'laser'] as const

export function CategoryPreviewSection() {
  const allCategories = getCategories()
  const featuredCategories = allCategories.filter((cat) =>
    FEATURED_CATEGORY_SLUGS.includes(cat.slug as typeof FEATURED_CATEGORY_SLUGS[number])
  )

  // Get top 3 deals for each category
  const categoriesWithDeals = featuredCategories.map((category) => ({
    category,
    deals: getDealsByCategory(category.slug).slice(0, 3),
  }))

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#451a03]">
          Browse by treatment
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {categoriesWithDeals.map(({ category, deals }) => (
          <CategoryPreviewCard
            key={category.id}
            category={category}
            deals={deals}
          />
        ))}
      </div>
    </section>
  )
}
