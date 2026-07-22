import { dealImageUrl } from '@/lib/cloudinary'
import type {
  AnonymousDeal,
  TemplateType,
  TreatmentCategory,
} from '@/types/deal'
import type {
  OfferWithBusiness,
  Business as SupaBusiness,
} from '@/types/supabase'
import { getCategorySlug } from './categories'

/**
 * City → State mapping derived from known Supabase data.
 * master_business_info has city but no state column.
 */
const CITY_STATE_MAP: Record<string, { state: string; stateCode: string }> = {
  // Arizona
  tucson: { state: 'Arizona', stateCode: 'AZ' },
  'oro valley': { state: 'Arizona', stateCode: 'AZ' },
  // California
  irvine: { state: 'California', stateCode: 'CA' },
  tustin: { state: 'California', stateCode: 'CA' },
  'costa mesa': { state: 'California', stateCode: 'CA' },
  'santa ana': { state: 'California', stateCode: 'CA' },
  'laguna hills': { state: 'California', stateCode: 'CA' },
  'laguna niguel': { state: 'California', stateCode: 'CA' },
  'laguna beach': { state: 'California', stateCode: 'CA' },
  'newport beach': { state: 'California', stateCode: 'CA' },
  'lake forest': { state: 'California', stateCode: 'CA' },
  'mission viejo': { state: 'California', stateCode: 'CA' },
  'foothill ranch': { state: 'California', stateCode: 'CA' },
  calabasas: { state: 'California', stateCode: 'CA' },
  'canoga park': { state: 'California', stateCode: 'CA' },
  pasadena: { state: 'California', stateCode: 'CA' },
  tarzana: { state: 'California', stateCode: 'CA' },
  'west hills': { state: 'California', stateCode: 'CA' },
  'woodland hills': { state: 'California', stateCode: 'CA' },
  // Colorado
  boulder: { state: 'Colorado', stateCode: 'CO' },
  louisville: { state: 'Colorado', stateCode: 'CO' },
  superior: { state: 'Colorado', stateCode: 'CO' },
  // Oklahoma
  'oklahoma city': { state: 'Oklahoma', stateCode: 'OK' },
  edmond: { state: 'Oklahoma', stateCode: 'OK' },
  norman: { state: 'Oklahoma', stateCode: 'OK' },
  yukon: { state: 'Oklahoma', stateCode: 'OK' },
  moore: { state: 'Oklahoma', stateCode: 'OK' },
  newalla: { state: 'Oklahoma', stateCode: 'OK' },
  bethany: { state: 'Oklahoma', stateCode: 'OK' },
  'midwest city': { state: 'Oklahoma', stateCode: 'OK' },
  'the village': { state: 'Oklahoma', stateCode: 'OK' },
}

export function inferState(city: string | null): {
  state: string
  stateCode: string
} {
  if (!city) return { state: '', stateCode: '' }
  const key = city.toLowerCase().trim()
  return CITY_STATE_MAP[key] ?? { state: '', stateCode: '' }
}

/**
 * Map DB service_category → frontend TreatmentCategory slug.
 * DB has 6 categories; frontend expects 6 but they don't fully align.
 * "laser", "body", "skincare" have no DB equivalent.
 */
const DB_TO_TREATMENT: Record<string, TreatmentCategory> = {
  Neurotoxins: 'botox',
  'Fillers & Other Injectables': 'fillers',
  'Facials & Lasers Services': 'facials',
  Wellness: 'skincare',
  Consultations: 'body',
  Others: 'body',
}

const TREATMENT_TO_DB: Record<TreatmentCategory, string[]> = {
  botox: ['Neurotoxins'],
  fillers: ['Fillers & Other Injectables'],
  facials: ['Facials & Lasers Services'],
  laser: ['Facials & Lasers Services'],
  body: ['Others', 'Consultations'],
  skincare: ['Wellness'],
}

export function dbCategoryToTreatment(
  dbCategory: string | null | undefined,
): TreatmentCategory {
  if (!dbCategory) return 'body'
  return DB_TO_TREATMENT[dbCategory] ?? 'body'
}

export function treatmentToDbCategories(
  treatment: TreatmentCategory,
): string[] {
  return TREATMENT_TO_DB[treatment] ?? []
}

/**
 * Transform a Supabase OfferWithBusiness into the AnonymousDeal shape
 * that all consumer-facing UI components expect.
 */
export function offerToAnonymousDeal(offer: OfferWithBusiness): AnonymousDeal {
  const biz = offer.master_business_info

  return {
    id: String(offer.id),
    title:
      offer.service_name ??
      offer.offer_raw_text?.slice(0, 60) ??
      'Special Offer',
    description:
      offer.offer_raw_text ??
      `${offer.service_name ?? 'Treatment'} — ${offer.template_type ?? 'deal'}`,
    category: dbCategoryToTreatment(offer.service_category),
    originalPrice: offer.original_price ?? 0,
    dealPrice: offer.discount_price ?? offer.original_price ?? 0,
    discountPercent:
      offer.discount_percent ??
      (offer.original_price &&
      offer.discount_price &&
      offer.original_price > offer.discount_price
        ? Math.round((1 - offer.discount_price / offer.original_price) * 100)
        : 0),
    unit: offer.unit_type ?? 'per treatment',
    validFrom: offer.start_date ?? offer.created_at ?? new Date().toISOString(),
    validUntil: offer.end_date ?? '',
    termsAndConditions: offer.eligibility ?? '',
    imageUrl: biz?.business_id ? dealImageUrl(biz.business_id) : undefined,
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    templateType: (offer.template_type as TemplateType) ?? 'FIXED_PRICE',
    createdAt: offer.created_at ?? new Date().toISOString(),
    updatedAt: offer.created_at ?? new Date().toISOString(),
    locationArea: biz?.city ?? '',
    businessRating: biz?.score ?? 0,
    businessReviewCount: biz?.review_count ?? 0,
    businessTier: 'unclaimed',
  }
}

/**
 * Transform a Supabase Business into a provider-like shape for provider pages.
 */
export function businessToProvider(biz: SupaBusiness) {
  const { state, stateCode } = inferState(biz.city)
  const slug = (biz.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return {
    id: String(biz.business_id),
    name: biz.name ?? 'Unknown Business',
    slug,
    description: `${biz.category ?? 'Medical spa'} in ${biz.city ?? 'your area'}`,
    category: biz.category ?? '',
    categorySlug: getCategorySlug(biz.category),
    address: biz.address ?? '',
    city: biz.city ?? '',
    state,
    stateCode,
    website: biz.website_clean ?? biz.website ?? undefined,
    facebookUrl: biz.facebook_url ?? undefined,
    instagramUrl: biz.instagram_url ?? undefined,
    rating: biz.score ?? 0,
    reviewCount: biz.review_count ?? 0,
    tier: 'unclaimed' as const,
    isVerified: false,
  }
}

export { CITY_STATE_MAP, TREATMENT_TO_DB }
