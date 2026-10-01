import type { ClinicServiceCategory } from '@/types/supabase'

export interface CategoryMapping {
  label: string
  slug: string
}

// The browse buckets. Several DB service_category values roll up into each one, so
// CATEGORY_MAP below is deliberately many-to-one.
// Labels match TREATMENT_LABELS in adapters.ts wherever a bucket is one treatment, so a tile and
// the page it opens use one name. "Neurotoxins", not "Botox & Neurotoxins": a range pooled across
// Dysport, Xeomin and Jeuveau may not sit under the word Botox.
const NEUROTOXINS: CategoryMapping = {
  label: 'Neurotoxins',
  slug: 'neurotoxins',
}
const FILLERS: CategoryMapping = { label: 'Fillers', slug: 'fillers' }
const FACIALS_LASERS: CategoryMapping = {
  label: 'Facials & Lasers',
  slug: 'facials-lasers',
}
const WELLNESS: CategoryMapping = { label: 'Wellness', slug: 'wellness' }
// The slug stays 'other': next.config.ts redirects v1's /treatments/body here. What it holds is
// body contouring alone since Wellness left it, and "Other Services" read "a Other Services
// treatment" in its own FAQ.
const BODY: CategoryMapping = { label: 'Body contouring', slug: 'other' }

/**
 * Every live `clinic_services.service_category` value, mapped to its browse bucket.
 *
 * `service_category` has been an enum since 2026-09-15. It started with five members, and the
 * pipeline has grown it to ten (the map below); the data contract
 * (.planning/SCHEMA-GOVERNANCE-ASK.md) asks for notice before a new one. Both of its earlier
 * text vocabularies are gone. Each time the vocabulary changed, the unmapped values
 * fell through `getCategoryBucket`'s `?? OTHER` and merged into "Other Services" with no
 * error anywhere — first `Neurotoxin`, then every filler deal on the site.
 *
 * Keep this exhaustive against the enum — it is keyed on it, so a new member is a compile error
 * once the types are regenerated. An offer with no category belongs to no bucket at all.
 */
export const CATEGORY_MAP: Record<ClinicServiceCategory, CategoryMapping> = {
  // Injectables
  Neurotoxin: NEUROTOXINS,
  'Dermal Filler': FILLERS,

  // Facials, lasers and skin devices
  Facial: FACIALS_LASERS,
  Microneedling: FACIALS_LASERS,
  'Laser & Light': FACIALS_LASERS,
  'Laser Hair Removal': FACIALS_LASERS,

  // Regenerative injectables (PRF, PRP, exosomes) browse with the skin devices rather than with
  // the fillers. They resolve the 'skincare' TREATMENT bucket, and Microneedling — the only other
  // member of that bucket — already browses here, so the two stay together on one tile. Putting
  // them under FILLERS would sit them beside Dermal Filler for the same shopper, which is the pair
  // the taxonomy is meant to keep apart: one adds exogenous HA volume per syringe, the other
  // induces the patient's own collagen per draw.
  'Regenerative Injectable': FACIALS_LASERS,
  // Skin-tightening devices (HIFU, Sofwave) sit with the other skin devices, as in adapters.ts.
  'Skin Tightening': FACIALS_LASERS,

  Wellness: WELLNESS,
  'Body Contouring': BODY,
}

/** The browse bucket (label + slug) a DB category belongs to, or null for none. */
export function getCategoryBucket(
  dbCategory: ClinicServiceCategory | null,
): CategoryMapping | null {
  if (!dbCategory) return null
  return CATEGORY_MAP[dbCategory] ?? null
}

export function getCategorySlug(
  dbCategory: ClinicServiceCategory | null,
): string | null {
  return getCategoryBucket(dbCategory)?.slug ?? null
}

/**
 * Every DB category behind a browse slug. Plural because the mapping is many-to-one:
 * /treatments/facials-lasers covers six service_category values, and querying for one
 * of them would silently drop the other five.
 */
export function getDbCategoriesFromSlug(slug: string): ClinicServiceCategory[] {
  // Object.keys widens to string[]; the keys of CATEGORY_MAP are the enum by construction.
  const categories = Object.keys(CATEGORY_MAP) as ClinicServiceCategory[]
  return categories.filter((db) => CATEGORY_MAP[db].slug === slug)
}
