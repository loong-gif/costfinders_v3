/**
 * "Typical" prices and the vs-typical label on a deal row (.planning/DEAL-BROWSE-AND-TRUST.md §1).
 *
 * A typical price is a claim about a market, printed beside every deal in it, so the floor is
 * the point: below 5 comparable prices from 3 clinics it is one clinic's price list, and it is
 * not published at all.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { comparablePrice, offerToAnonymousDeal } from '@/lib/data/adapters'
import {
  cheapestComparable,
  computeGuidePricingStats,
  floorPrice,
  pooledPrice,
  TYPICAL_TREATMENTS,
  type TypicalPrice,
  typicalPrices,
  vsTypical,
  vsTypicalLabel,
} from '@/lib/data/typicalPrice'
import type { ComparablePrice } from '@/types/deal'
import type { OfferView } from '@/types/supabase'

let nextId = 1

/** A visible priced offer in one city. Defaults are a Botox rate that states its own price. */
function offer(fields: Partial<OfferView>): OfferView {
  const price = fields.discount_price ?? 10
  return {
    id: nextId++,
    business_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    offer_raw_text: `Botox $${price}/unit`,
    discount_amount: null,
    discount_percent: null,
    discount_price: price,
    regular_price: null,
    is_active: true,
    is_membership_required: false,
    conditions: null,
    is_package: false,
    is_new_customer_required: false,
    membership_plan_id: null,
    offer_fingerprint: null,
    price_model: 'per_unit',
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
  }
}

/** Five Botox rates, $8–$12, from three clinics. */
const market = () =>
  [8, 9, 10, 11, 12].map((price, i) =>
    offer({ discount_price: price, business_id: (i % 3) + 1 }),
  )

test('five comparable prices from three clinics make a typical price', () => {
  assert.deepEqual(typicalPrices(market()).botox, {
    treatment: 'botox',
    perUnit: true,
    median: 10,
    min: 8,
    max: 12,
    pricedDealCount: 5,
    providerCount: 3,
    minBrand: 'Botox',
  })
})

test('below either floor there is no typical price', () => {
  assert.equal(typicalPrices(market().slice(0, 4)).botox, undefined, '4 deals')
  const twoClinics = market().map((o, i) => ({ ...o, business_id: i % 2 }))
  assert.equal(typicalPrices(twoClinics).botox, undefined, '2 providers')
  // Clinics with only an unpriced "20% off" do not count towards the three.
  const unpriced = [3, 4, 5].map((business_id) =>
    offer({
      business_id,
      discount_price: null,
      discount_percent: 20,
      offer_raw_text: '20% off Botox',
    }),
  )
  assert.equal(
    typicalPrices([...twoClinics, ...unpriced]).botox,
    undefined,
    'providers are counted over the priced deals only',
  )
})

test('a check-tier deal never counts, and neither does one with no comparable price', () => {
  const extra = [
    // "$3 Botox": a bare neurotoxin total — a price defect, "Confirm when booking".
    offer({
      discount_price: 3,
      price_model: 'total',
      offer_raw_text: 'Botox $3',
      business_id: 9,
    }),
    // A $79 lip flip has no per-unit figure to compare.
    offer({
      discount_price: 79,
      price_model: 'total',
      delivered_units: 1,
      offer_raw_text: 'Lip Flip $79',
      business_id: 9,
    }),
  ]
  const typical = typicalPrices([...market(), ...extra]).botox
  assert.equal(typical?.pricedDealCount, 5)
  assert.equal(typical?.min, 8)
  assert.equal(typical?.providerCount, 3)
})

test('only neurotoxins have a typical price: other treatments pool unlike services', () => {
  // Five facials from five clinics clear both floors, and still get none — a median over one
  // session and a three-session package is not a price anyone pays (owner decision, 2026-09-28).
  const facials = [99, 149, 199, 249, 299].map((price, i) =>
    offer({
      discount_price: price,
      price_model: 'total',
      service_category: 'Facial',
      service_name: 'Hydrafacial',
      unit_type: null,
      offer_raw_text: `Hydrafacial $${price}`,
      business_id: i + 1,
    }),
  )
  const clinicWide = facials.map((o) => ({ ...o, service_category: null }))
  assert.deepEqual(TYPICAL_TREATMENTS, new Set(['botox']))
  assert.deepEqual(
    Object.keys(typicalPrices([...facials, ...clinicWide, ...market()])),
    ['botox'],
  )
  // And a typical price for one, however it was built, compares nothing.
  const facialsTypical: TypicalPrice = {
    treatment: 'facials',
    perUnit: false,
    median: 199,
    min: 99,
    max: 299,
    pricedDealCount: 5,
    providerCount: 5,
    minBrand: null,
  }
  assert.equal(vsTypical({ amount: 99, perUnit: false }, facialsTypical), null)
})

const botox: TypicalPrice = {
  treatment: 'botox',
  perUnit: true,
  median: 10,
  min: 3.15,
  max: 15,
  pricedDealCount: 42,
  providerCount: 12,
  minBrand: null,
}

test('vs typical: below, above and about, as whole percents', () => {
  const at = (amount: number) => vsTypical({ amount, perUnit: true }, botox)
  assert.deepEqual(at(6.8), { percent: 32, direction: 'below' })
  assert.deepEqual(at(11.2), { percent: 12, direction: 'above' })
  assert.deepEqual(at(10.49), { percent: 5, direction: 'about' })
  assert.deepEqual(
    at(9.5),
    { percent: 5, direction: 'below' },
    'exactly 5% is a difference',
  )
  assert.equal(
    vsTypicalLabel({ percent: 32, direction: 'below' }),
    '32% below typical',
  )
  assert.equal(
    vsTypicalLabel({ percent: 12, direction: 'above' }),
    '12% above typical',
  )
  assert.equal(
    vsTypicalLabel({ percent: 3, direction: 'about' }),
    'About typical',
  )
})

test('vs typical: nothing to say without a price, a typical price, or a shared basis', () => {
  assert.equal(vsTypical(null, botox), null)
  assert.equal(vsTypical({ amount: 10, perUnit: true }, undefined), null)
  assert.equal(vsTypical({ amount: 10, perUnit: true }, null), null)
  // A $299 total against a per-unit median is not "2890% above typical".
  assert.equal(vsTypical({ amount: 299, perUnit: false }, botox), null)
})

test('a Dysport unit and a starting price never count, and are never set against typical', () => {
  // Offer 8107: "DYSPORT $3.15/UNIT" read "69% below typical" against a median of mostly Botox
  // rates, though a Dysport unit is about a third of a Botox unit.
  const dysport = offer({
    discount_price: 3.15,
    service_name: 'Dysport',
    offer_raw_text: 'DYSPORT $3.15/UNIT',
    business_id: 9,
  })
  // Offer 7718: "Starts at $9 per unit" is the clinic's floor, not what you pay.
  const from = offer({
    discount_price: 9,
    price_model: 'from',
    offer_raw_text: 'New Patient tox Starts at $9 per unit',
    service_name: 'Neurotoxin',
    business_id: 9,
  })
  const typical = typicalPrices([...market(), dysport, from]).botox
  assert.equal(typical?.pricedDealCount, 5)
  assert.equal(typical?.min, 8, 'the Dysport row does not set the floor')
  assert.equal(typical?.providerCount, 3)

  const leanOf = (o: OfferView) =>
    comparablePrice(offerToAnonymousDeal(o)) as ComparablePrice
  assert.deepEqual(leanOf(dysport), {
    amount: 3.15,
    perUnit: true,
    brand: 'Dysport',
  })
  assert.equal(leanOf(from).from, true)
  assert.equal(vsTypical(leanOf(dysport), botox), null)
  assert.equal(vsTypical(leanOf(from), botox), null)
  assert.notEqual(
    vsTypical({ amount: 3.15, perUnit: true, brand: 'Xeomin' }, botox),
    null,
    'only Dysport is left out',
  )
})

test("every neurotoxin median counts the typical price's prices: one rule, not two", () => {
  // Owner decision, 2026-09-28 ("be consistent"): the hero, the city chart, the national strip
  // and the guides all pool through computeGuidePricingStats(), and printed a median over
  // Dysport units and starting prices one click from a deals page whose typical left them out.
  const dysport = offer({
    discount_price: 3.15,
    service_name: 'Dysport',
    offer_raw_text: 'DYSPORT $3.15/UNIT',
    business_id: 9,
  })
  const from = offer({
    discount_price: 6,
    price_model: 'from',
    offer_raw_text: 'Botox Starts at $6 per unit',
    business_id: 9,
  })
  const daxxify = offer({
    discount_price: 7.5,
    service_name: 'Daxxify',
    offer_raw_text: 'Daxxify $7.50/unit',
    business_id: 4,
  })
  const offers = [...market(), dysport, from, daxxify]
  const typical = typicalPrices(offers).botox
  const stats = computeGuidePricingStats('botox', offers)
  assert.ok(typical)
  assert.deepEqual(
    [
      stats.medianPrice,
      stats.minPrice,
      stats.maxPrice,
      stats.pricedDealCount,
      stats.minBrand,
    ],
    [
      typical.median,
      typical.min,
      typical.max,
      typical.pricedDealCount,
      typical.minBrand,
    ],
  )
  // Daxxify stays in the pool (owner decision, 2026-09-28) and here sets its floor.
  assert.equal(typical.min, 7.5)
  assert.equal(typical.minBrand, 'Daxxify')
  assert.equal(typical.pricedDealCount, 6)

  const priced = (o: OfferView) => comparablePrice(offerToAnonymousDeal(o))
  assert.equal(pooledPrice(priced(dysport)), null)
  assert.equal(pooledPrice(priced(from)), null)
  assert.equal(pooledPrice(priced(daxxify))?.amount, 7.5)
  // What you pay pools as it did: a starting price outside neurotoxins is not left out.
  assert.deepEqual(pooledPrice({ amount: 99, perUnit: false, from: true }), {
    amount: 99,
    perUnit: false,
    from: true,
  })
})

test('a floor is the cheapest price of any brand, Dysport included, never a starting price', () => {
  // Owner decision, 2026-09-28: "from $X", "Starting at" and "lowest is" mean one thing — the
  // deals pages' "from $3.15 per unit · lowest is Dysport" — while a range stays pooled.
  const dysport = offer({
    discount_price: 3.15,
    service_name: 'Dysport',
    offer_raw_text: 'DYSPORT $3.15/UNIT',
    business_id: 9,
  })
  // Cheaper still, and a floor the clinic set rather than a price: never the floor.
  const from = offer({
    discount_price: 2.5,
    price_model: 'from',
    offer_raw_text: 'Botox Starts at $2.50 per unit',
    business_id: 9,
  })
  const offers = [...market(), dysport, from]
  const deals = offers.map(offerToAnonymousDeal)
  assert.deepEqual(cheapestComparable(deals), {
    amount: 3.15,
    perUnit: true,
    brand: 'Dysport',
  })
  const stats = computeGuidePricingStats('botox', offers)
  assert.deepEqual([stats.floorPrice, stats.floorBrand], [3.15, 'Dysport'])
  // The range is the pooled one, and never starts below the floor.
  assert.deepEqual([stats.minPrice, stats.minBrand], [8, 'Botox'])
  assert.ok((stats.floorPrice as number) <= (stats.minPrice as number))

  const priced = (o: OfferView) => comparablePrice(offerToAnonymousDeal(o))
  assert.equal(floorPrice(priced(from)), null)
  assert.equal(floorPrice(priced(dysport))?.brand, 'Dysport')
  // Outside neurotoxins a starting price stays a floor, as it stays in their range.
  assert.equal(
    floorPrice({ amount: 149, perUnit: false, from: true })?.amount,
    149,
  )
})

test('the floor names its brand when it is not Botox', () => {
  const xeomin = offer({
    discount_price: 7,
    service_name: 'Xeomin',
    offer_raw_text: 'Xeomin $7/unit',
  })
  assert.equal(typicalPrices([...market(), xeomin]).botox?.minBrand, 'Xeomin')
})

test('typicalPrice.ts stays importable from the browser', () => {
  // The browse rows compute vs-typical client-side. guide-stats.ts reads guide files with
  // node:fs and offers.ts builds the Supabase client, so neither may be reachable from here.
  const source = readFileSync('src/lib/data/typicalPrice.ts', 'utf8')
  const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(
    imports.filter((path) => !path.startsWith('@/types/')),
    ['./adapters'],
  )
})
