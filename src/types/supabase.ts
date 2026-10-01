/**
 * App-facing aliases over the generated schema types.
 *
 * This file used to be 67 hand-written lines declaring 31 columns on a 16-column table. That
 * is how a reference to a nonexistent `original_price` — and later 22 dropped columns — passed
 * a clean typecheck. Every row shape now comes from `./supabase.generated.ts`, which is
 * regenerated from the live schema. Only the composites the app assembles itself live here.
 */
import type { Database } from './supabase.generated'

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** `master_business_info`. `membership` and `process_flag` are gone; `google_place_id` and `logo` are new. */
export type Business = Row<'master_business_info'>

/**
 * `public_business_directory`, the only business relation anon may read: no business_id, phone,
 * website or socials, and the provider route's slug computed in SQL.
 */
export type PublicBusiness =
  Database['public']['Views']['public_business_directory']['Row']

/**
 * The TRUE `promo_offer_master` row: 18 columns and not one more.
 *
 * Everything the app used to read off this row — service_name, service_category, unit_type,
 * start_date, end_date — now lives in a joined table. Read those from `OfferView`, which the
 * data layer resolves. See `src/lib/data/offers.ts`.
 */
export type Offer = Row<'promo_offer_master'>

export type ClinicService = Row<'clinic_services'>

/**
 * The service taxonomy, as the database's own enum.
 *
 * Typed rather than `string` because this vocabulary has now been replaced under the repo
 * TWICE, and both times every lookup keyed on it had a total fallback, so the site quietly
 * bucketed real inventory into "Other" with no error anywhere. Keying CATEGORY_MAP and
 * DB_TO_TREATMENT on this type makes both drift directions a compile error instead: a key that
 * no longer exists fails, and a new enum member that nothing maps fails too.
 */
export type ClinicServiceCategory = ClinicService['service_category']
export type ClinicPromotion = Row<'clinic_promotions'>
export type ClinicMembership = Row<'clinic_memberships'>
export type OfferItem = Row<'promo_offer_items'>

/**
 * The business columns joined onto offer queries.
 *
 * This is the admin shape (BUSINESS_JOIN_WITH_IDENTITY in `src/lib/data/offers.ts`). A consumer
 * row comes from the public_offers view, whose master_business_info carries business_id and city
 * and nulls for every identity field.
 */
export type OfferBusiness = Pick<
  Business,
  | 'business_id'
  | 'name'
  | 'address'
  | 'city'
  | 'score'
  | 'review_count'
  | 'category'
  | 'website'
>

/** An offer row plus its embedded business. */
export interface OfferWithBusiness extends Offer {
  master_business_info: OfferBusiness | null
}

/**
 * An offer with the normalized schema flattened back onto it.
 *
 * The app reads `offer.service_name` / `offer.service_category` / `offer.unit_type` in 20
 * files. Rather than rewrite all of them against the join, the data layer resolves those
 * fields once — in `flattenOffer()` — and hands back this shape. The field names are
 * deliberately the ones the old denormalized table used, so components did not change.
 *
 * Fields with NO carrier in the new schema are absent, not faked: `template_type`, `channel`,
 * `source_name`, `is_package`, `min_unit`, `cancellation_policy` and free-text `eligibility`
 * are gone. `is_new_customer_required` and `is_membership_required` survive on `Offer` and are
 * the structured replacement for the last of those.
 *
 * Most of these resolve for a MINORITY of offers. Coverage, measured over 1000 rows:
 * service_name 999, service_category 849, unit_type 266, end_date 104, start_date 68,
 * service_area 135, membership_name 325. Treat absence as the normal case.
 */
export interface OfferView extends OfferWithBusiness {
  /** `promo_offer_items.item_name` of the lowest `offer_item_id`, else `offer_raw_text`. */
  service_name: string | null
  /** `clinic_services.service_category` of the lowest item that resolves one. 151/1000 resolve none. */
  service_category: ClinicServiceCategory | null
  /**
   * The SERVICE's unit vocabulary (Botox is sold in units), NOT this offer's price basis — a
   * "40 units for $299" package has unit_type 'unit' too. NULL on 874 of 1056 services. Never
   * print it next to a price; `offerPriceBasis()` in src/lib/data/adapters.ts reads it as one
   * input among several.
   */
  unit_type: string | null
  /**
   * How many `promo_offer_items` the offer has. A bundle of different treatments shares one
   * price across them, so its representative item's `delivered_units` is not what the price buys.
   */
  item_count: number
  /** 135/1000 — 5% of services. Do not build a filter or facet on this. */
  service_area: string | null
  /** `clinic_services.source_url`, else the promotion's. */
  source_url: string | null
  /** `promo_offer_items.delivered_units` of the representative item — the delivered count. */
  delivered_units: number | null
  /** `promo_offer_items.unit_price`. DB-computed by trigger; never app-supplied. */
  unit_price: number | null
  /** `clinic_promotions.campaign_start_date`. 68/1000. */
  start_date: string | null
  /** `clinic_promotions.campaign_end_date`. 104/1000, and only 41 of 678 active offers. */
  end_date: string | null
  promotion_title: string | null
  /** 325/1000, but 100% of the 261 membership rows are named. */
  membership_name: string | null
  membership_price: number | null
  /** Clean 4-value enum: monthly / annual / one_time / quarterly. */
  billing_period: string | null
  minimum_commitment_months: number | null
}
