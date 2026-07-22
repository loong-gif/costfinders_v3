import type { Offer, OfferWithBusiness } from '@/types/supabase'
import {
  offerItemName,
  offerServiceCategory,
  offerSourceUrl,
  offerUnitType,
} from '@/types/supabase'

/** Live promo_offer_items columns only (no unit_type / item_name). */
export const OFFER_ITEM_EMBED =
  'promo_offer_items(offer_item_id,offer_id,service_id,quantity,unit_price,clinic_services(service_name,service_category,unit_type,regular_price))'

export const OFFER_PROMO_EMBED =
  'clinic_promotions(promotion_id,source_url,promotion_title)'

export const OFFER_EMBED = `${OFFER_ITEM_EMBED},${OFFER_PROMO_EMBED}`

export const BUSINESS_JOIN =
  'master_business_info!fk_offer_business(business_id, name, address, city, score, review_count, category, website)'

export const SERVICE_BUSINESS_JOIN =
  'master_business_info!fk_service_business(business_id, name, city)'

export const OFFER_MASTER_LIVE_SELECT = [
  'id',
  'business_id',
  'membership_plan_id',
  'promotion_id',
  'regular_price',
  'discount_price',
  'discount_percent',
  'discount_amount',
  'is_membership_required',
  'is_active',
  'is_new_customer_required',
  'offer_fingerprint',
  'offer_raw_text',
  'price_model',
  'created_at',
  'updated_at',
].join(', ')

export const OFFER_WITH_BUSINESS_SELECT = `*, ${OFFER_EMBED}, ${BUSINESS_JOIN}`

export const MODERATION_DEAL_SELECT = `${OFFER_MASTER_LIVE_SELECT}, ${OFFER_ITEM_EMBED}, master_business_info!fk_offer_business(name)`

export function enrichOffer<T extends Offer>(offer: T): T {
  return {
    ...offer,
    original_price: offer.regular_price,
    service_name: offerItemName(offer) || offer.offer_raw_text?.slice(0, 60) || null,
    service_category: offerServiceCategory(offer) || null,
    source_url: offerSourceUrl(offer) || null,
    unit_type: offerUnitType(offer) || null,
    moderation_status: moderationStatusFromActive(offer.is_active),
  }
}

export function offerDisplayTitle(
  offer: Pick<Offer, 'id' | 'offer_raw_text'> & { service_name?: string | null },
): string {
  return (
    offer.service_name?.trim() ||
    offer.offer_raw_text?.trim().slice(0, 60) ||
    `Deal #${offer.id}`
  )
}

/** ponytail: live schema has is_active only — rejected/changes_requested both map to inactive. */
export function moderationStatusToIsActive(
  status: string,
): boolean | null {
  if (status === 'approved') return true
  if (
    status === 'pending_review' ||
    status === 'rejected' ||
    status === 'changes_requested'
  ) {
    return false
  }
  return null
}

export function enrichOffers<T extends Offer>(offers: T[]): T[] {
  return offers.map(enrichOffer)
}

export function moderationStatusFromActive(isActive: boolean | null | undefined) {
  return isActive ? 'approved' : 'pending_review'
}

export interface LiveDealWriteInput {
  service_name?: string
  service_category?: string
  original_price?: number
  discount_price?: number
  discount_percent?: number
  unit_type?: string
  offer_raw_text?: string
  template_type?: string
  start_date?: string
  end_date?: string
  min_unit?: string
}

/** Map legacy deal form fields to live promo_offer_master columns. */
export function buildLiveOfferInsertPayload(
  businessId: number,
  data: LiveDealWriteInput,
  options?: { pendingReview?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    business_id: businessId,
    is_active: options?.pendingReview ? false : true,
    offer_raw_text:
      data.offer_raw_text?.trim() ||
      data.service_name?.trim() ||
      null,
  }

  if (data.original_price != null) payload.regular_price = data.original_price
  if (data.discount_price != null) payload.discount_price = data.discount_price
  if (data.discount_percent != null) {
    payload.discount_percent = data.discount_percent
  }

  return payload
}

export function buildLiveOfferUpdatePayload(
  data: Partial<LiveDealWriteInput>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (data.service_name !== undefined || data.offer_raw_text !== undefined) {
    payload.offer_raw_text =
      data.offer_raw_text?.trim() || data.service_name?.trim() || null
  }
  if (data.original_price !== undefined) {
    payload.regular_price = data.original_price
  }
  if (data.discount_price !== undefined) {
    payload.discount_price = data.discount_price
  }
  if (data.discount_percent !== undefined) {
    payload.discount_percent = data.discount_percent
  }

  return payload
}

export function mapModerationDealRow(row: Record<string, unknown>) {
  const offer = enrichOffer(row as unknown as OfferWithBusiness)
  const biz = row.master_business_info as { name: string | null } | null

  return {
    id: offer.id,
    business_id: offer.business_id,
    service_name: offer.service_name ?? null,
    service_category: offer.service_category ?? null,
    offer_raw_text: offer.offer_raw_text,
    original_price: offer.regular_price,
    discount_price: offer.discount_price,
    discount_percent: offer.discount_percent,
    unit_type: offer.unit_type ?? null,
    template_type: null,
    start_date: null,
    end_date: null,
    eligibility: null,
    moderation_status: moderationStatusFromActive(offer.is_active),
    created_at: offer.created_at,
    business_name: biz?.name ?? null,
  }
}
