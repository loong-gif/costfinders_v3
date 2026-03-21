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

/** Matches `promo_offer_master` table */
export interface Offer {
  id: number
  business_id: number | null
  channel: string | null
  source_url: string | null
  source_name: string | null
  template_type: string | null
  service_category: string | null
  service_name: string | null
  offer_raw_text: string | null
  eligibility: string | null
  is_package: string | null
  discount_percent: number | null
  discount_amount: string | null
  discount_price: number | null
  original_price: number | null
  delivered_unit: number | null
  min_unit: string | null
  unit_type: string | null
  service_area: string | null
  is_membership_required: string | null
  membership_name: string | null
  membership_price: string | null
  billing_period: string | null
  minimum_term: string | null
  cancellation_policy: string | null
  membership_content: string | null
  offer_content: Record<string, unknown> | null
  start_date: string | null
  end_date: string | null
  moderation_status: string | null
  created_at: string | null
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
