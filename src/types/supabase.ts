/** Matches `master_business_info` table */
export interface Business {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  website: string | null
  website_clean: string | null
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

export interface PromoOfferItem {
  offer_item_id: number
  offer_id: number
  service_id: number | null
  item_name: string
  quantity: number | null
  unit_type: string | null
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
  service_category: string | null
  is_membership_required: boolean | null
  is_active: boolean
  is_new_customer_required: boolean
  offer_fingerprint: string | null
  offer_raw_text: string | null
  created_at: string | null
  promo_offer_items?: PromoOfferItem[] | PromoOfferItem | null
  clinic_promotions?: ClinicPromotion | ClinicPromotion[] | null
  /** Legacy / derived for UI compatibility */
  service_name?: string | null
  source_url?: string | null
  unit_type?: string | null
  original_price?: number | null
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
    | 'website_clean'
  > | null
}

export function offerItemName(offer: Offer): string {
  const items = offer.promo_offer_items
  if (Array.isArray(items) && items.length > 0) {
    return items[0]?.item_name?.trim() || ''
  }
  if (items && !Array.isArray(items)) {
    return items.item_name?.trim() || ''
  }
  return offer.service_name?.trim() || ''
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
  const items = offer.promo_offer_items
  if (Array.isArray(items) && items.length > 0) {
    return items[0]?.unit_type?.trim() || ''
  }
  if (items && !Array.isArray(items)) {
    return items.unit_type?.trim() || ''
  }
  return offer.unit_type?.trim() || ''
}
