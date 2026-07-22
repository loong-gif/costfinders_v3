/** Matches `master_business_info` table */
export interface Business {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  website: string | null
  /** @deprecated DB column is `website`; kept optional for older UI paths */
  website_clean?: string | null
  review_count: number | null
  score: number | null
  category: string | null
  facebook_url: string | null
  instagram_url: string | null
  membership: Record<string, unknown> | null
  process_flag: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ClinicServiceRef {
  service_name: string | null
  service_category: string | null
  unit_type?: string | null
}

export interface PromoOfferItem {
  offer_item_id: number
  offer_id: number
  service_id: number | null
  quantity: number | null
  unit_price?: number | null
  /** Derived / legacy */
  item_name?: string | null
  unit_type?: string | null
  clinic_services?: ClinicServiceRef | ClinicServiceRef[] | null
}

export interface ClinicPromotion {
  promotion_id: number
  business_id: number
  promotion_title: string
  source_url: string
}

export interface ClinicMembership {
  plan_id: number
  business_id: number
  membership_name: string
  membership_price: number
  billing_period: string | null
  minimum_commitment_months: number | null
  perks: string | null
}

/** Matches `promo_offer_master` table */
export interface Offer {
  id: number
  business_id: number | null
  membership_plan_id: number | null
  promotion_id: number | null
  regular_price: number | null
  discount_price: number | null
  discount_percent: number | null
  discount_amount: number | null
  is_membership_required: boolean | null
  is_active: boolean
  is_new_customer_required: boolean
  offer_fingerprint: string | null
  offer_raw_text: string | null
  price_model?: string | null
  created_at: string | null
  updated_at?: string | null
  promo_offer_items?: PromoOfferItem[] | PromoOfferItem | null
  clinic_promotions?: ClinicPromotion | ClinicPromotion[] | null
  /** Legacy / derived for UI compatibility */
  service_category?: string | null
  service_name?: string | null
  source_url?: string | null
  source_name?: string | null
  unit_type?: string | null
  min_unit?: number | null
  original_price?: number | null
  template_type?: string | null
  start_date?: string | null
  end_date?: string | null
  eligibility?: string | null
  moderation_status?: string | null
  last_verified_at?: string | null
}

/** Offer joined with business info for display */
export interface OfferWithBusiness extends Offer {
  master_business_info: Pick<
    Business,
    | 'business_id'
    | 'name'
    | 'address'
    | 'city'
    | 'score'
    | 'review_count'
    | 'category'
    | 'website'
  > | null
}

function firstItem(offer: Offer): PromoOfferItem | null {
  const items = offer.promo_offer_items
  if (Array.isArray(items)) return items[0] ?? null
  return items ?? null
}

function itemService(item: PromoOfferItem | null): ClinicServiceRef | null {
  if (!item?.clinic_services) return null
  return Array.isArray(item.clinic_services)
    ? (item.clinic_services[0] ?? null)
    : item.clinic_services
}

export function offerItemName(offer: Offer): string {
  const item = firstItem(offer)
  const service = itemService(item)
  return (
    service?.service_name?.trim() ||
    item?.item_name?.trim() ||
    offer.service_name?.trim() ||
    ''
  )
}

export function offerServiceCategory(offer: Offer): string {
  const service = itemService(firstItem(offer))
  return (
    service?.service_category?.trim() ||
    offer.service_category?.trim() ||
    ''
  )
}

export function offerSourceUrl(offer: Offer): string {
  const promo = offer.clinic_promotions
  if (Array.isArray(promo) && promo.length > 0) {
    return promo[0]?.source_url?.trim() || ''
  }
  if (promo && !Array.isArray(promo)) {
    return promo.source_url?.trim() || ''
  }
  return offer.source_url?.trim() || ''
}

export function offerUnitType(offer: Offer): string {
  const item = firstItem(offer)
  const service = itemService(item)
  return (
    service?.unit_type?.trim() ||
    item?.unit_type?.trim() ||
    offer.unit_type?.trim() ||
    ''
  )
}
