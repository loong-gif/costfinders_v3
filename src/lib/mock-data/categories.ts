import type { TreatmentCategory } from '@/types/deal'

export interface Category {
  id: string
  name: string
  slug: TreatmentCategory
  description: string
  icon: string // Phosphor icon name
  dealCount: number
  isActive: boolean
  sortOrder: number
}

// Mutable categories array for CRUD operations
let categories: Category[] = [
  {
    id: 'cat-botox',
    name: 'Botox',
    slug: 'botox',
    description: 'Neuromodulator treatments to reduce wrinkles and fine lines',
    icon: 'Syringe',
    dealCount: 24,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'cat-fillers',
    name: 'Fillers',
    slug: 'fillers',
    description: 'Dermal fillers for volume restoration and contouring',
    icon: 'Drop',
    dealCount: 18,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'cat-facials',
    name: 'Facials',
    slug: 'facials',
    description: 'Professional facial treatments for glowing skin',
    icon: 'Sparkle',
    dealCount: 31,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'cat-laser',
    name: 'Laser',
    slug: 'laser',
    description: 'Laser treatments for hair removal and skin rejuvenation',
    icon: 'Lightning',
    dealCount: 15,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'cat-body',
    name: 'Body',
    slug: 'body',
    description: 'Body contouring and sculpting treatments',
    icon: 'Person',
    dealCount: 12,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'cat-skincare',
    name: 'Skincare',
    slug: 'skincare',
    description: 'Advanced skincare treatments and products',
    icon: 'Leaf',
    dealCount: 22,
    isActive: true,
    sortOrder: 6,
  },
]

// CRUD helpers
export function getCategories(): Category[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((cat) => cat.id === id)
}

export function getCategoryBySlug(slug: TreatmentCategory): Category | undefined {
  return categories.find((cat) => cat.slug === slug)
}

export function createCategory(
  data: Omit<Category, 'id' | 'dealCount' | 'sortOrder'>
): Category {
  const newCategory: Category = {
    ...data,
    id: `cat-${Date.now()}`,
    dealCount: 0,
    sortOrder: categories.length + 1,
  }
  categories = [...categories, newCategory]
  return newCategory
}

export function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id'>>
): Category | undefined {
  const index = categories.findIndex((cat) => cat.id === id)
  if (index === -1) return undefined

  categories[index] = { ...categories[index], ...data }
  return categories[index]
}

export function toggleCategoryStatus(id: string): Category | undefined {
  const index = categories.findIndex((cat) => cat.id === id)
  if (index === -1) return undefined

  categories[index] = {
    ...categories[index],
    isActive: !categories[index].isActive,
  }
  return categories[index]
}

export function deleteCategory(id: string): boolean {
  const initialLength = categories.length
  categories = categories.filter((cat) => cat.id !== id)
  return categories.length < initialLength
}

// Stats helper
export function getCategoryStats() {
  const total = categories.length
  const active = categories.filter((c) => c.isActive).length
  const totalDeals = categories.reduce((sum, c) => sum + c.dealCount, 0)
  return { total, active, totalDeals }
}

// SEO/SSG helpers

/**
 * Get all category slugs for static params generation
 */
export function getAllCategorySlugs(): string[] {
  return categories.filter((c) => c.isActive).map((c) => c.slug)
}

/**
 * Get category with computed stats (deal count, business count)
 */
export function getCategoryWithStats(slug: string): (Category & { businessCount: number }) | undefined {
  const category = categories.find((c) => c.slug === slug && c.isActive)
  if (!category) return undefined

  // Import deals dynamically to avoid circular deps
  // For now, use the static dealCount and estimate businessCount
  return {
    ...category,
    businessCount: Math.ceil(category.dealCount / 2), // Rough estimate: ~2 deals per business
  }
}

/**
 * Get all category-state combinations for sitemap
 * Returns array of {categorySlug, stateSlug} for future /treatments/[category]/[state] pages
 */
export function getCategoryStateComboSlugs(): Array<{ categorySlug: string; stateSlug: string }> {
  // Import supported states - avoid circular dependency by importing inline
  const supportedStates = ['california', 'texas', 'new-york', 'florida']

  const activeCategorySlugs = categories.filter((c) => c.isActive).map((c) => c.slug)
  const combos: Array<{ categorySlug: string; stateSlug: string }> = []

  for (const categorySlug of activeCategorySlugs) {
    for (const stateSlug of supportedStates) {
      combos.push({ categorySlug, stateSlug })
    }
  }

  return combos
}
