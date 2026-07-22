import assert from 'node:assert/strict'
import {
  buildLiveOfferInsertPayload,
  buildLiveOfferUpdatePayload,
  enrichOffer,
  moderationStatusFromActive,
  moderationStatusToIsActive,
} from './offer-query'
import type { Offer } from '@/types/supabase'

const baseOffer: Offer = {
  id: 1,
  business_id: 10,
  membership_plan_id: null,
  promotion_id: null,
  regular_price: 100,
  discount_price: 80,
  discount_percent: null,
  discount_amount: null,
  is_membership_required: null,
  is_active: true,
  is_new_customer_required: false,
  offer_fingerprint: null,
  offer_raw_text: 'Botox special',
  price_model: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
}

assert.equal(moderationStatusFromActive(true), 'approved')
assert.equal(moderationStatusFromActive(false), 'pending_review')
assert.equal(moderationStatusToIsActive('approved'), true)
assert.equal(moderationStatusToIsActive('rejected'), false)

const enriched = enrichOffer(baseOffer)
assert.equal(enriched.original_price, 100)
assert.equal(enriched.service_name, 'Botox special')
assert.equal(enriched.moderation_status, 'approved')

const insert = buildLiveOfferInsertPayload(10, {
  service_name: 'Botox',
  original_price: 12,
  discount_price: 10,
})
assert.equal(insert.business_id, 10)
assert.equal(insert.regular_price, 12)
assert.equal(insert.discount_price, 10)
assert.equal(insert.is_active, true)
assert.equal(insert.offer_raw_text, 'Botox')

const pending = buildLiveOfferInsertPayload(
  10,
  { service_name: 'Filler' },
  { pendingReview: true },
)
assert.equal(pending.is_active, false)

const update = buildLiveOfferUpdatePayload({
  original_price: 20,
  service_name: 'Updated',
})
assert.deepEqual(update, {
  regular_price: 20,
  offer_raw_text: 'Updated',
})

console.log('offer-query self-check passed')
