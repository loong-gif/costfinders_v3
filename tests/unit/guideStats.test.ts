/**
 * The pure helpers behind every number printed on the 31 cost guides.
 *
 * A guide states costs as fact — a median, a min–max spread, "Per unit $12". Every figure in
 * those tables comes out of one of the functions below, and each has already been wrong in a way
 * no build could see: the unit table printed "Per package $450" for a price that depends on
 * what is in the package, "Per unit" was the median of $10 rates and $299 packages, the
 * by-product table grouped the same product under three spellings, and savingsPercent is the
 * sort key that decides which three deals a guide recommends.
 *
 * Placeholder Supabase credentials, then a dynamic import: guide-stats.ts pulls in ./offers,
 * which constructs the shared client at module scope. The functions under test never touch
 * it, and `npm test` runs with no secrets on purpose, so a placeholder is what keeps the suite
 * hermetic. It is set before the import that evaluates the module, which is why the import is
 * inside the tests rather than at the top of the file.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { offerPriceBasis } from '@/lib/data/adapters'
import type { OfferView } from '@/types/supabase'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key'

const guideStats = () => import('@/lib/data/guide-stats')

// ─── savingsPercent ──────────────────────────────────────

test('savingsPercent returns 0 rather than a wrong number when a price is missing', async () => {
  const { savingsPercent } = await guideStats()
  // Only ~22% of offers carry a regular_price above their discount_price, so these are the
  // ordinary cases, not the edge cases.
  assert.equal(savingsPercent({ regular_price: null, discount_price: 100 }), 0)
  assert.equal(savingsPercent({ regular_price: 200, discount_price: null }), 0)
  assert.equal(savingsPercent({ regular_price: null, discount_price: null }), 0)
  // regular_price 0 would divide by zero and rank an offer first.
  assert.equal(savingsPercent({ regular_price: 0, discount_price: 50 }), 0)
})

test('savingsPercent computes the discount off the regular price', async () => {
  const { savingsPercent } = await guideStats()
  assert.equal(savingsPercent({ regular_price: 400, discount_price: 300 }), 25)
  assert.equal(savingsPercent({ regular_price: 1000, discount_price: 1 }), 99.9)
})

test('savingsPercent orders deals by real savings, not by absolute discount', async () => {
  const { savingsPercent } = await guideStats()
  // getGuideDealsPreview sorts on this and publishes the top 3 as the guide's recommendations.
  // $100 off $200 must outrank $200 off $2000.
  const half = { regular_price: 200, discount_price: 100 }
  const tenth = { regular_price: 2000, discount_price: 1800 }
  assert.ok(savingsPercent(half) > savingsPercent(tenth))
})

// ─── computeGuidePricingStats ────────────────────────────

/** A visible, priced offer row as flattenOffer() produces it. Real rows override the rest. */
function offer(row: Partial<OfferView>): OfferView {
  return {
    id: 1,
    business_id: 42,
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
    ...row,
  }
}

test('a Botox guide states every figure per unit, and leaves out a flat price', async () => {
  const { computeGuidePricingStats } = await guideStats()
  const stats = computeGuidePricingStats('botox', [
    offer({
      id: 1,
      price_model: 'per_unit',
      discount_price: 10,
      offer_raw_text: 'Botox $10/unit',
    }),
    // offer 7792 — the screenshot that started this: $299 buys 40 units, $7.48 each.
    offer({
      id: 2,
      business_id: 43,
      discount_price: 299,
      regular_price: 480,
      delivered_units: 40,
      offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
    }),
    // offer 7751 — a flat price with no unit count. Pooled, it was the Botox guide's minimum.
    offer({
      id: 3,
      business_id: 44,
      discount_price: 79,
      regular_price: 135,
      service_name: 'Lip Flip',
      offer_raw_text: 'Lip Flip sale price $79.00; regular price $135.00',
    }),
  ])
  assert.equal(stats.perUnit, true)
  assert.equal(stats.minPrice, 7.48)
  assert.equal(stats.maxPrice, 10)
  assert.equal(stats.medianPrice, 8.74)
  // All three are live deals; two can be stated per unit, and the sample says so.
  assert.equal(stats.dealCount, 3)
  assert.equal(stats.pricedDealCount, 2)
  assert.equal(stats.providerCount, 3)
  assert.deepEqual(
    stats.byService.map((row) => [row.name, row.minPrice, row.maxPrice]),
    [['Botox', 7.48, 10]],
  )
  assert.deepEqual(
    stats.byUnitType.map((row) => [row.unitType, row.count, row.medianPrice]),
    [['unit', 2, 8.74]],
  )
})

test('a Botox guide pools no Dysport unit and no starting price, and its by-product table keeps Dysport', async () => {
  const { computeGuidePricingStats } = await guideStats()
  const rate = (id: number, price: number, name: string, text: string) =>
    offer({
      id,
      business_id: 40 + id,
      price_model: 'per_unit',
      discount_price: price,
      service_name: name,
      offer_raw_text: text,
    })
  const stats = computeGuidePricingStats('botox', [
    rate(1, 10, 'Botox', 'Botox $10/unit'),
    rate(2, 12, 'Botox', 'Botox $12/unit'),
    // Offer 8107's shape: a Dysport unit is about a third of a Botox unit.
    rate(3, 3.15, 'Dysport', 'DYSPORT $3.15/UNIT'),
    rate(4, 3.5, 'Dysport', 'Dysport $3.50/unit'),
    // Offer 7718's shape: the clinic's floor, not what you pay.
    offer({
      id: 5,
      business_id: 45,
      price_model: 'from',
      discount_price: 9,
      offer_raw_text: 'Botox Starts at $9 per unit',
    }),
  ])
  // The pooled figures are the typical price's: Botox-sized units of what you pay.
  assert.deepEqual(
    [stats.minPrice, stats.medianPrice, stats.maxPrice, stats.minBrand],
    [10, 11, 12, 'Botox'],
  )
  assert.equal(stats.pricedDealCount, 2)
  assert.equal(stats.dealCount, 5)
  // The floor is the other concept: any brand, the deals page's "from $3.15 · lowest is
  // Dysport" and the guide's "Starting at" — still never the $9 starting price.
  assert.deepEqual([stats.floorPrice, stats.floorBrand], [3.15, 'Dysport'])
  assert.deepEqual(
    stats.byUnitType.map((row) => [row.unitType, row.count, row.medianPrice]),
    [['unit', 2, 11]],
  )
  // A Dysport row priced per Dysport unit is that product's price, labelled by product. A
  // starting price is nobody's price, so the Botox row is the two real rates.
  assert.deepEqual(
    stats.byService.map((row) => [row.name, row.count, row.minPrice]),
    [
      ['Botox', 2, 10],
      ['Dysport', 2, 3.15],
    ],
  )
})

test('any other guide compares what you pay, never a rate nobody can buy one of', async () => {
  const { computeGuidePricingStats } = await guideStats()
  const filler = { service_category: 'Dermal Filler', unit_type: null } as const
  const stats = computeGuidePricingStats('fillers', [
    offer({
      ...filler,
      id: 1,
      price_model: 'per_unit',
      discount_price: 599,
      service_name: 'Juvederm',
      offer_raw_text: 'Juvederm $599 per syringe',
    }),
    // offer 8279: four items for one price. Not $1,499 for its representative item's units.
    offer({
      ...filler,
      id: 2,
      discount_price: 1499,
      delivered_units: 50,
      item_count: 4,
      service_name: 'Timeless Beauty Package',
      offer_raw_text:
        'Timeless Beauty Package: $1,499. Includes 50 units of Jeuveau, 1 syringe of lip filler',
    }),
    // A per-unit rate whose unit nothing names: "$12 each" of what?
    offer({ ...filler, id: 3, price_model: 'per_unit', discount_price: 12 }),
  ])
  assert.equal(stats.perUnit, false)
  assert.equal(stats.minPrice, 599)
  assert.equal(stats.maxPrice, 1499)
  assert.equal(stats.pricedDealCount, 2)
  // One syringe rate is below the bucket floor; the bundle has no per-unit figure at all.
  assert.deepEqual(stats.byUnitType, [])
})

test('an empty market still says which basis its (absent) figures would use', async () => {
  const { computeGuidePricingStats } = await guideStats()
  const stats = computeGuidePricingStats('botox', [])
  assert.equal(stats.perUnit, true)
  assert.equal(stats.minPrice, null)
  assert.equal(stats.pricedDealCount, 0)
})

// ─── normalizeServiceName ────────────────────────────────

test('normalizeServiceName collapses spelling variants of one product', async () => {
  const { normalizeServiceName } = await guideStats()
  // The by-product table groups on the lowercased label, so these must agree once lowercased
  // or one product appears as three rows with three price ranges.
  const variants = ['Skinvive', 'SKINVIVE', 'skinvive'].map((raw) =>
    normalizeServiceName(raw)?.toLowerCase(),
  )
  assert.deepEqual(variants, ['skinvive', 'skinvive', 'skinvive'])
  assert.equal(normalizeServiceName('SKINVIVE'), 'Skinvive')
  assert.equal(normalizeServiceName('sculptra'), 'Sculptra')
})

test('normalizeServiceName turns machine values into English', async () => {
  const { normalizeServiceName } = await guideStats()
  assert.equal(normalizeServiceName('laser_hair_removal'), 'Laser Hair Removal')
})

test('normalizeServiceName rejects bundle titles and blanks', async () => {
  const { normalizeServiceName } = await guideStats()
  // Long strings are bundle descriptions, not products; a table of them is not a price
  // comparison. 32 characters is the cut.
  assert.equal(normalizeServiceName('a'.repeat(32))?.length, 32)
  assert.equal(normalizeServiceName('a'.repeat(33)), null)
  assert.equal(normalizeServiceName(null), null)
  assert.equal(normalizeServiceName('   '), null)
})

// ─── median ──────────────────────────────────────────────

test('median sorts before picking, so caller order cannot change the answer', async () => {
  const { median } = await guideStats()
  assert.equal(median([300, 100, 200]), 200)
  assert.equal(median([100]), 100)
})

test('median of an even count is the unrounded midpoint', async () => {
  const { median } = await guideStats()
  // Deliberately unrounded: callers format with the same precision rule they use for min and
  // max, so a rounded midpoint could print outside its own range.
  assert.equal(median([100, 200]), 150)
  assert.equal(median([100, 175]), 137.5)
})

test('median does not reorder the array it is given', async () => {
  const { median } = await guideStats()
  // computeGuidePricingStats calls median(prices) and then Math.min/Math.max on the same array.
  const prices = [300, 100, 200]
  median(prices)
  assert.deepEqual(prices, [300, 100, 200])
})

// ─── unit vocabulary ─────────────────────────────────────

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** `package` names a shape, not a unit: what one costs depends on what is in it. */
const DELIBERATELY_NOT_A_UNIT = ['package']

test('every live unit_type is a pricing unit, or deliberately not one', () => {
  const snapshot = JSON.parse(
    readFileSync(join(REPO, 'supabase', 'schema-snapshot.json'), 'utf8'),
  ) as { vocabulary?: Record<string, string[]> }
  const units = snapshot.vocabulary?.['clinic_services.unit_type']
  assert.ok(
    units && units.length > 0,
    'supabase/schema-snapshot.json carries no clinic_services.unit_type vocabulary — run `npm run schema:snapshot`',
  )
  for (const unit of units) {
    const basis = offerPriceBasis({
      price_model: 'per_unit',
      unit_type: unit,
      delivered_units: null,
      service_category: null,
      offer_raw_text: '',
      item_count: 1,
      discount_price: 10,
    })
    // A value on neither list silently turns every "$X/<unit>" rate into a rate with no unit,
    // which no surface compares or prints. Add it to PRICE_UNITS in src/lib/data/adapters.ts,
    // or to DELIBERATELY_NOT_A_UNIT above with the reason.
    assert.deepEqual(
      basis,
      {
        kind: 'rate',
        unit: DELIBERATELY_NOT_A_UNIT.includes(unit) ? null : unit,
      },
      `unit_type '${unit}' is neither in PRICE_UNITS nor deliberately excluded`,
    )
  }
})

// ─── qualifyingGuidePairs ────────────────────────────────

test('qualifyingGuidePairs applies the 10-offer, 3-provider bar per treatment and city', async () => {
  const { qualifyingGuidePairs, GUIDE_MIN_OFFERS, GUIDE_MIN_PROVIDERS } =
    await guideStats()
  const inCity = (city: string) =>
    ({ city }) as unknown as OfferView['master_business_info']
  const rows: OfferView[] = []
  // Newport Beach Botox: 10 offers from 3 providers — exactly at the bar, qualifies.
  for (let i = 0; i < GUIDE_MIN_OFFERS; i++) {
    rows.push(
      offer({
        id: 100 + i,
        business_id: 1 + (i % GUIDE_MIN_PROVIDERS),
        master_business_info: inCity('Newport Beach'),
      }),
    )
  }
  // Newport Beach fillers: 12 offers but 2 providers — one clinic's price list, not a market.
  for (let i = 0; i < 12; i++) {
    rows.push(
      offer({
        id: 200 + i,
        business_id: 1 + (i % 2),
        service_category: 'Dermal Filler',
        master_business_info: inCity('Newport Beach'),
      }),
    )
  }
  // Glenview Botox: 9 offers from 9 providers — one short.
  for (let i = 0; i < GUIDE_MIN_OFFERS - 1; i++) {
    rows.push(
      offer({
        id: 300 + i,
        business_id: 50 + i,
        master_business_info: inCity('Glenview'),
      }),
    )
  }
  // A category no guide covers, and a city with no state: neither can become a page.
  for (let i = 0; i < GUIDE_MIN_OFFERS; i++) {
    rows.push(
      offer({
        id: 400 + i,
        business_id: 70 + i,
        service_category: 'Wellness',
        master_business_info: inCity('Newport Beach'),
      }),
      offer({
        id: 500 + i,
        business_id: 80 + i,
        master_business_info: inCity('Nowhere'),
      }),
    )
  }
  const pairs = qualifyingGuidePairs(rows, (city) =>
    city === 'Nowhere'
      ? { state: '', stateCode: '' }
      : { state: 'California', stateCode: 'CA' },
  )
  assert.deepEqual(
    pairs.map((p) => p.slug),
    ['botox-cost-newport-beach'],
  )
  assert.equal(pairs[0].treatmentLabel, 'Botox')
  assert.equal(pairs[0].city.name, 'Newport Beach')
  assert.equal(pairs[0].city.stateCode, 'CA')
  assert.equal(pairs[0].offers.length, GUIDE_MIN_OFFERS)
  assert.equal(pairs[0].providerCount, GUIDE_MIN_PROVIDERS)
})

// ─── publishedGuideStats ─────────────────────────────────

test('a guide prints a median and range only where the market supports one', async () => {
  const { publishedGuideStats } = await guideStats()
  const { computeGuidePricingStats } = await import('@/lib/data/typicalPrice')
  const facial = (id: number, business: number, price: number) =>
    offer({
      id,
      business_id: business,
      discount_price: price,
      price_model: 'total',
      offer_raw_text: `Facial $${price}`,
      service_name: 'Hydrafacial',
      service_category: 'Facial',
      item_count: 1,
    })
  const published = (offers: OfferView[]) =>
    publishedGuideStats(
      'facials',
      offers,
      computeGuidePricingStats('facials', offers),
    )

  // One clinic's price list is not a market: the floor stays, the median and range do not.
  const oneClinic = published([
    facial(1, 7, 99),
    facial(2, 7, 149),
    facial(3, 7, 199),
  ])
  assert.equal(oneClinic.floorPrice, 99)
  assert.equal(oneClinic.medianPrice, null)
  assert.equal(oneClinic.minPrice, null)
  assert.equal(oneClinic.maxPrice, null)

  // Three priced deals from three clinics is.
  const market = published([
    facial(1, 7, 99),
    facial(2, 8, 149),
    facial(3, 9, 199),
  ])
  assert.equal(market.medianPrice, 149)
  assert.equal(market.minPrice, 99)
  assert.equal(market.maxPrice, 199)
})

test('a Dysport rate per "equivalent dosing" is a Botox-equivalent unit, never ranked as a unit', async () => {
  const { comparablePrice, dealPricing, offerToAnonymousDeal } = await import(
    '@/lib/data/adapters'
  )
  // Business 1702, 2026-09-28: "per unit" under "Dysport" read as three times the real rate.
  const basis = offerPriceBasis({
    price_model: 'per_unit',
    unit_type: 'unit',
    delivered_units: null,
    service_category: 'Neurotoxin',
    offer_raw_text: '$11.50/equivalent dosing Dysport (regularly $13.50/unit)',
    item_count: 1,
    discount_price: 11.5,
  })
  assert.deepEqual(basis, { kind: 'rate', unit: 'Botox-equivalent unit' })
  const deal = offerToAnonymousDeal(
    offer({
      discount_price: 11.5,
      price_model: 'per_unit',
      unit_type: 'unit',
      service_category: 'Neurotoxin',
      service_name: 'Dysport',
      offer_raw_text:
        '$11.50/equivalent dosing Dysport (regularly $13.50/unit)',
      item_count: 1,
    }),
  )
  assert.equal(dealPricing(deal).text, '$11.50 per Botox-equivalent unit')
  assert.equal(comparablePrice(deal), null)
})
