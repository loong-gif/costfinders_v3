/**
 * Price sort and price-range filter on the deal grids (/deals/<city>, /deals/<treatment>/<city>).
 *
 * Both read `comparablePrice()`, never raw `dealPrice`: raw, "$10 per unit" Botox sorted above
 * "40 units for $299" (cheaper per unit, $7.48), every unpriced "20% off" row (dealPrice 0) led
 * a low-to-high sort, and "Max $50" kept all of them.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { offerToAnonymousDeal } from '@/lib/data/adapters'
import {
  groupByTreatment,
  sortDeals,
  withinPriceRange,
} from '@/lib/utils/deal-sorting'
import type { OfferView } from '@/types/supabase'

/** A row through the real adapter. Defaults are a Neurotoxin service sold in units. */
function deal(id: number, fields: Partial<OfferView>) {
  return offerToAnonymousDeal({
    id,
    business_id: 42,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    // States its own price, as a real row does — an unstated one is dropped (priceIsStated).
    offer_raw_text: `Botox${fields.discount_price ? ` $${fields.discount_price}` : ''}`,
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
    service_name: 'Botox',
    service_category: 'Neurotoxin',
    unit_type: 'unit',
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
  })
}

const ids = (deals: { id: string }[]) => deals.map((d) => d.id)

// Live shapes: offer 8116 "Botox at Just $10/Unit"; offer 7792 "40 Units Botox $299"; a
// no-price "20% off" row; a $79 lip flip (neurotoxin, no per-unit figure).
const rate = deal(1, { discount_price: 10, price_model: 'per_unit' })
const pack = deal(2, {
  discount_price: 299,
  regular_price: 480,
  delivered_units: 40,
  offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
})
const unpriced = deal(3, { discount_percent: 20 })
const lipFlip = deal(4, { discount_price: 79, delivered_units: 1 })

test('botox sorts per unit: 40 units for $299 is cheaper than $10 per unit', () => {
  assert.deepEqual(ids(sortDeals([rate, pack], 'price-asc')), ['2', '1'])
  assert.deepEqual(ids(sortDeals([pack, rate], 'price-desc')), ['1', '2'])
})

test('a deal with no comparable price sorts last in both directions, in its own order', () => {
  const all = [unpriced, rate, lipFlip, pack]
  assert.deepEqual(ids(sortDeals(all, 'price-asc')), ['2', '1', '3', '4'])
  assert.deepEqual(ids(sortDeals(all, 'price-desc')), ['1', '2', '3', '4'])
})

// $550 a syringe, so a per-syringe comparison would put it BEFORE the $599 syringe; comparing
// what you pay keeps $599 first. (At $1,500 every basis agreed, so the case pinned nothing.)
test('filler compares on what you pay: $599 per syringe before 2 syringes for $1,100', () => {
  const filler = { unit_type: null, service_category: 'Dermal Filler' as const }
  const syringe = deal(5, {
    ...filler,
    discount_price: 599,
    price_model: 'per_unit',
    offer_raw_text: 'Versa Filler — $599 per syringe',
  })
  const two = deal(6, {
    ...filler,
    discount_price: 1100,
    delivered_units: 2,
    offer_raw_text: '2 syringes $1,100',
  })
  assert.deepEqual(ids(sortDeals([two, syringe], 'price-asc')), ['5', '6'])
  assert.deepEqual(ids(sortDeals([syringe, two], 'price-desc')), ['6', '5'])
})

test('a mixed page sorts what-you-pay, then per-unit, then non-comparable — each by price', () => {
  // /deals/<city>: a $35 facial and a $99 PRF are totals; the Botox figures are per unit. On one
  // scale "$299 for 40 units" ($7.48) ranked below the $35 facial.
  const facial = deal(7, {
    discount_price: 35,
    service_category: 'Facial',
    unit_type: null,
    offer_raw_text: 'Hydrafacial $35',
  })
  const prf = deal(8, {
    discount_price: 99,
    service_category: 'Wellness',
    unit_type: null,
    offer_raw_text: 'PRF $99',
  })
  const all = [unpriced, rate, prf, lipFlip, pack, facial]
  assert.deepEqual(ids(sortDeals(all, 'price-asc')), [
    '7',
    '8',
    '2',
    '1',
    '3',
    '4',
  ])
  assert.deepEqual(ids(sortDeals(all, 'price-desc')), [
    '8',
    '7',
    '1',
    '2',
    '3',
    '4',
  ])
})

test('the price range drops a non-comparable deal only while a bound is set', () => {
  for (const d of [unpriced, lipFlip]) {
    assert.equal(withinPriceRange(d, undefined, undefined), true)
    assert.equal(withinPriceRange(d, undefined, 50), false, 'Max $50')
    assert.equal(withinPriceRange(d, 0, undefined), false, 'Min $0')
  }
  // Botox bounds are per unit: the package ($7.48 a unit) is under $8 though it costs $299.
  assert.equal(withinPriceRange(pack, undefined, 8), true)
  assert.equal(withinPriceRange(rate, undefined, 8), false)
  assert.equal(withinPriceRange(rate, 10, 10), true, 'bounds are inclusive')
})

test('a check-tier deal ("Confirm when booking") sorts after every comparable deal', () => {
  // "$10 Botox" names no unit: a price defect, printed as the clinic states it but never ranked.
  const bare = deal(9, { discount_price: 10, offer_raw_text: 'Botox $10' })
  assert.equal(bare.interpretation.tier, 'check')
  // The rule is the tier, not the figure: a check deal that kept a rankable price sorts last too.
  const flagged = {
    ...rate,
    id: '10',
    interpretation: {
      tier: 'check' as const,
      reasons: ['price-defect' as const],
      notes: [],
    },
  }
  assert.deepEqual(ids(sortDeals([flagged, bare, rate, pack], 'price-asc')), [
    '2',
    '1',
    '10',
    '9',
  ])
  assert.deepEqual(ids(sortDeals([flagged, bare, pack, rate], 'price-desc')), [
    '1',
    '2',
    '10',
    '9',
  ])
  assert.equal(withinPriceRange(flagged, undefined, 50), false)
})

test('the city groups run in TREATMENT_SLUGS order, keep input order, and end with no-treatment', () => {
  const laser = (id: number) =>
    deal(id, {
      service_name: 'Laser Hair Removal',
      service_category: 'Laser Hair Removal',
    })
  const groups = groupByTreatment([
    laser(1),
    deal(2, { service_name: 'Special', service_category: null }),
    deal(3, {}),
    laser(4),
  ])
  assert.deepEqual(
    groups.map((g) => [g.treatment, ids(g.deals)]),
    [
      ['botox', ['3']],
      ['laser', ['1', '4']],
      [null, ['2']],
    ],
  )
})
