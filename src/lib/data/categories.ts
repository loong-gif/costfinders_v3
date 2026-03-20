export interface CategoryMapping {
  label: string
  slug: string
}

/** Maps DB service_category values to user-friendly display names */
export const CATEGORY_MAP: Record<string, CategoryMapping> = {
  Neurotoxins: { label: 'Botox & Neurotoxins', slug: 'neurotoxins' },
  'Fillers & Other Injectables': { label: 'Fillers', slug: 'fillers' },
  'Facials & Lasers Services': {
    label: 'Facials & Lasers',
    slug: 'facials-lasers',
  },
  Wellness: { label: 'Wellness', slug: 'wellness' },
  Consultations: { label: 'Consultations', slug: 'consultations' },
  Others: { label: 'Other Services', slug: 'other' },
}

export function getCategoryLabel(dbCategory: string | null): string {
  if (!dbCategory) return 'Other Services'
  return CATEGORY_MAP[dbCategory]?.label ?? dbCategory
}

export function getCategorySlug(dbCategory: string | null): string {
  if (!dbCategory) return 'other'
  return CATEGORY_MAP[dbCategory]?.slug ?? 'other'
}

export function getDbCategoryFromSlug(slug: string): string | undefined {
  for (const [dbName, mapping] of Object.entries(CATEGORY_MAP)) {
    if (mapping.slug === slug) return dbName
  }
  return undefined
}
