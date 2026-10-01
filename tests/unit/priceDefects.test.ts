/**
 * The detector behind `npm run prices:check`: rows the price-basis rules cannot label truthfully.
 * Every case is a live row. The false-positive guards matter as much as the hits — a check that
 * cries wolf gets its baseline rewritten without being read.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { priceDefects } from '@/lib/data/price-defects'
import type { OfferView } from '@/types/supabase'

function offer(fields: Partial<OfferView>): OfferView {
  return {
    id: 1,
    business_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    offer_raw_text: '',
    discount_amount: null,
    discount_percent: null,
    discount_price: null,
    regular_price: null,
    is_active: true,
    is_membership_required: false,
    conditions: null,
    is_package: false,
    is_new_customer_required: false,
    membership_plan_id: null,
    offer_fingerprint: null,
    price_model: 'total',
    promotion_id: null,
    master_business_info: null,
    service_name: null,
    service_category: 'Neurotoxin',
    unit_type: null,
    item_count: 1,
    service_area: null,
    source_url: null,
    delivered_units: null,
    unit_price: null,
    start_date: null,
    end_date: null,
    promotion_title: null,
    membership_name: null,
    membership_price: null,
    billing_period: null,
    minimum_commitment_months: null,
    ...fields,
  }
}

test('flags the shapes the pipeline stores wrong', () => {
  // 1517: "$100 off" applied to a regular price the clinic never published.
  assert.deepEqual(
    priceDefects(
      offer({
        discount_price: 460,
        offer_raw_text:
          'New patients receive $100 off when they purchase 40 or more units of Botox or Dysport',
      }),
    ),
    ['price-not-in-text'],
  )
  // 8509: a $400 "per unit" Dysport rate.
  assert.deepEqual(
    priceDefects(
      offer({
        discount_price: 400,
        price_model: 'per_unit',
        offer_raw_text:
          '$50 Off with Aspire Rewards (Reg. $3.75/unit. Minimum 120 units)',
      }),
    ),
    ['misread-unit-rate', 'price-not-in-text'],
  )
  // 8365: "$10 Botox" — prints as a $10 treatment.
  assert.deepEqual(
    priceDefects(
      offer({
        discount_price: 10,
        offer_raw_text: 'New Patient Specials $10 Botox',
      }),
    ),
    ['bare-neurotoxin-price'],
  )
  // A per-unit rate whose unit nothing names prints "each".
  assert.deepEqual(
    priceDefects(
      offer({
        discount_price: 499,
        price_model: 'per_unit',
        service_category: 'Regenerative Injectable',
        offer_raw_text: 'PRF special $499',
      }),
    ),
    ['rate-unit-unknown'],
  )
})

test('does not flag rows that are stated, only differently', () => {
  for (const fields of [
    // 8645: the price ends a sentence.
    {
      discount_price: 99,
      service_category: 'Facial',
      offer_raw_text: 'Honey Enzyme Facial — $99.',
    },
    // 10323: no dollar sign.
    {
      discount_price: 13.5,
      price_model: 'per_unit',
      offer_raw_text: '317 membership: Botox 13.5 per unit',
    },
    // 8207: a stated rate multiplied out by the row's count.
    {
      discount_price: 1200,
      delivered_units: 100,
      offer_raw_text:
        'Save $150 when you purchase 100 units of Botox at $12/unit',
    },
    {
      discount_price: 1499,
      service_category: 'Microneedling',
      offer_raw_text: 'Morpheus8 $1,499',
    },
    // A price nobody stated is not a defect when nothing is priced at all.
    { discount_price: null, offer_raw_text: '20% off' },
  ] as Partial<OfferView>[]) {
    assert.deepEqual(
      priceDefects(offer(fields)),
      [],
      fields.offer_raw_text ?? '',
    )
  }
})
