/**
 * The pure helpers behind the homepage's pricing modules — treatment ranges, the Botox-by-city
 * breakdown, and the hero's cheapest-unit callouts. Same hermetic setup as
 * tests/unit/guideStats.test.ts: a placeholder Supabase client, module imported dynamically so
 * the placeholder is set before src/lib/data/offers.ts constructs the client at module scope.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { typicalPrices } from '@/lib/data/typicalPrice'
import type { OfferView } from '@/types/supabase'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key'

const homepage = () => import('@/lib/data/homepage')

/** A visible, priced offer row. Real rows override the rest — same shape as guideStats.test.ts. */
function offer(row: Partial<OfferView> & { city?: string }): OfferView {
  const { city, ...rest } = row
  const businessId = rest.business_id ?? 1
  return {
    id: 1,
    business_id: businessId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    // States its own price, as a real row does — an unstated one is dropped (priceIsStated).
    offer_raw_text: rest.discount_price ? `$${rest.discount_price}` : '',
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
    master_business_info: {
      business_id: businessId,
      name: null,
      address: null,
      city: city ?? null,
      score: null,
      review_count: null,
      category: null,
      website: null,
    },
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
    ...rest,
  }
}

// ─── treatmentPriceRanges ────────────────────────────────

test('treatmentPriceRanges skips offers whose category resolves no treatment', async () => {
  const { treatmentPriceRanges } = await homepage()
  // Three priced Botox offers (the floor) plus one offer with no service_category at all —
  // dbCategoryToTreatment would bucket that one as 'body', but offerTreatmentRoute must not,
  // so it must not surface as a 'body' range either.
  const ranges = treatmentPriceRanges([
    offer({
      id: 1,
      business_id: 1,
      price_model: 'per_unit',
      discount_price: 10,
    }),
    offer({
      id: 2,
      business_id: 2,
      price_model: 'per_unit',
      discount_price: 12,
    }),
    offer({
      id: 3,
      business_id: 3,
      discount_price: 299,
      delivered_units: 40,
      item_count: 1,
    }),
    offer({ id: 4, business_id: 4, service_category: null, unit_type: null }),
  ])
  assert.ok(ranges.every((r) => r.treatment !== 'body'))
})

test('treatmentPriceRanges drops a treatment with fewer than 3 priced offers', async () => {
  const { treatmentPriceRanges } = await homepage()
  const ranges = treatmentPriceRanges([
    offer({
      id: 1,
      business_id: 1,
      service_category: 'Dermal Filler',
      unit_type: null,
      discount_price: 599,
    }),
    offer({
      id: 2,
      business_id: 2,
      service_category: 'Dermal Filler',
      unit_type: null,
      discount_price: 650,
    }),
  ])
  assert.deepEqual(ranges, [])
})

test('treatmentPriceRanges states the neurotoxin range per unit, with the browse-bucket href', async () => {
  const { treatmentPriceRanges } = await homepage()
  const ranges = treatmentPriceRanges([
    offer({
      id: 1,
      business_id: 1,
      price_model: 'per_unit',
      discount_price: 10,
    }),
    offer({
      id: 2,
      business_id: 2,
      price_model: 'per_unit',
      discount_price: 12,
    }),
    // 40 units for $299 — $7.48/unit, same fixture as guideStats.test.ts.
    offer({
      id: 3,
      business_id: 3,
      discount_price: 299,
      delivered_units: 40,
      item_count: 1,
    }),
  ])
  assert.equal(ranges.length, 1)
  const botox = ranges[0]
  assert.equal(botox.treatment, 'botox')
  // The range pools every brand, so it may not be labelled Botox (a Dysport unit is ~1/3 one).
  assert.equal(botox.label, 'Neurotoxins')
  // /treatments/{treatment} alone is not a route — this must be the browse bucket slug.
  assert.equal(botox.href, '/treatments/neurotoxins')
  assert.equal(botox.perUnit, true)
  assert.equal(botox.dealCount, 3)
  assert.equal(botox.pricedDealCount, 3)
  assert.equal(botox.providerCount, 3)
  assert.equal(botox.minPrice, 7.48)
  assert.equal(botox.maxPrice, 12)
  assert.equal(botox.medianPrice, 10)
  // Every fixture here is titled Botox, so the floor is a Botox price and says so.
  assert.equal(botox.minBrand, 'Botox')
})

test('a neurotoxin range names the brand of its floor, and pools no Dysport unit', async () => {
  const { treatmentPriceRanges } = await homepage()
  const ranges = treatmentPriceRanges([
    // "Botox from $3" was a Dysport unit. Since 2026-09-28 a Dysport unit leaves the range, as it
    // leaves the typical price (pooledPrice()).
    offer({
      id: 1,
      business_id: 1,
      price_model: 'per_unit',
      discount_price: 3.15,
      service_name: 'Neurotoxin',
      offer_raw_text: 'DYSPORT $3.15/UNIT',
    }),
    offer({
      id: 2,
      business_id: 2,
      price_model: 'per_unit',
      discount_price: 7,
      service_name: 'Xeomin',
      offer_raw_text: 'Xeomin $7/unit',
    }),
    offer({
      id: 3,
      business_id: 3,
      price_model: 'per_unit',
      discount_price: 11,
    }),
    offer({
      id: 4,
      business_id: 4,
      price_model: 'per_unit',
      discount_price: 12,
    }),
  ])
  assert.equal(ranges[0].minPrice, 7)
  assert.equal(ranges[0].minBrand, 'Xeomin')
  assert.equal(ranges[0].pricedDealCount, 3)
  assert.equal(ranges[0].dealCount, 4)
  assert.equal(ranges[0].label, 'Neurotoxins')
})

test('treatmentPriceRanges sorts by dealCount descending', async () => {
  const { treatmentPriceRanges } = await homepage()
  const botoxOffers = [1, 2, 3].map((n) =>
    offer({
      id: n,
      business_id: n,
      price_model: 'per_unit',
      discount_price: 10,
    }),
  )
  // A flat-priced total is comparable for a non-Botox treatment too (see comparablePrice()).
  const facialOffers = [4, 5, 6, 7].map((n) =>
    offer({
      id: n,
      business_id: n,
      service_category: 'Facial',
      unit_type: null,
      discount_price: 100 + n,
    }),
  )
  const ranges = treatmentPriceRanges([...botoxOffers, ...facialOffers])
  assert.deepEqual(
    ranges.map((r) => r.treatment),
    ['facials', 'botox'],
  )
  assert.equal(ranges[0].dealCount, 4)
  assert.equal(ranges[1].dealCount, 3)
})

// ─── cityBotoxMedians ─────────────────────────────────────

function botoxOffer(id: number, city: string, discountPrice: number) {
  return offer({
    id,
    business_id: id,
    city,
    price_model: 'per_unit',
    discount_price: discountPrice,
  })
}

test('cityBotoxMedians groups by city and ignores an empty city', async () => {
  const { cityBotoxMedians } = await homepage()
  const medians = cityBotoxMedians([
    ...[8, 9, 10, 11, 12].map((price, i) => botoxOffer(i + 1, 'Austin', price)),
    // No city at all, and a blank one — neither should produce a bucket.
    offer({
      id: 6,
      business_id: 6,
      price_model: 'per_unit',
      discount_price: 11,
    }),
    botoxOffer(7, '   ', 12),
  ])
  assert.equal(medians.length, 1)
  assert.equal(medians[0].city, 'Austin')
  assert.equal(medians[0].slug, 'austin')
  assert.equal(medians[0].pricedDealCount, 5)
})

test('the neurotoxin city chart is the typical price, floor and figures', async () => {
  const { cityBotoxMedians, cityMedians } = await homepage()
  // Four priced deals, and five from two clinics: below the typical floor, so no bar — a bar
  // links to a deals page that would print no typical.
  assert.deepEqual(
    cityBotoxMedians(
      [8, 9, 10, 11].map((p, i) => botoxOffer(i + 1, 'Dallas', p)),
    ),
    [],
  )
  assert.deepEqual(
    cityBotoxMedians(
      [8, 9, 10, 11, 12].map((p, i) =>
        offer({
          id: i + 1,
          business_id: (i % 2) + 1,
          city: 'Dallas',
          price_model: 'per_unit',
          discount_price: p,
        }),
      ),
    ),
    [],
  )
  // Past it, the bar is the deals page's typical: Dysport and a starting price left out.
  const reno = [
    ...[8, 9, 10, 11, 12].map((p, i) => botoxOffer(i + 1, 'Reno', p)),
    offer({
      id: 6,
      business_id: 6,
      city: 'Reno',
      price_model: 'per_unit',
      discount_price: 3.15,
      service_name: 'Dysport',
      offer_raw_text: 'DYSPORT $3.15/UNIT',
    }),
    offer({
      id: 7,
      business_id: 7,
      city: 'Reno',
      price_model: 'from',
      discount_price: 6,
      offer_raw_text: 'Botox Starts at $6 per unit',
    }),
  ]
  const typical = typicalPrices(reno).botox
  assert.ok(typical)
  const [row] = cityBotoxMedians(reno)
  assert.deepEqual(
    [
      row.medianPrice,
      row.minPrice,
      row.maxPrice,
      row.pricedDealCount,
      row.providerCount,
    ],
    [
      typical.median,
      typical.min,
      typical.max,
      typical.pricedDealCount,
      typical.providerCount,
    ],
  )
  assert.equal(row.minPrice, 8)
  assert.equal(row.dealCount, 7)
  // Every other treatment keeps its 3-priced floor and pooled median.
  const fillers = [500, 600, 700].map((p, i) =>
    offer({
      id: 10 + i,
      business_id: 10 + i,
      city: 'Reno',
      service_category: 'Dermal Filler',
      unit_type: null,
      discount_price: p,
    }),
  )
  assert.deepEqual(
    cityMedians(fillers, 'fillers').map((m) => [m.city, m.medianPrice]),
    [['Reno', 600]],
  )
  assert.deepEqual(cityMedians(fillers.slice(0, 2), 'fillers'), [])
})

test('cityBotoxMedians sorts by pricedDealCount desc then city name, and respects limit', async () => {
  const { cityBotoxMedians } = await homepage()
  const offers = [
    // Boston: 6 priced deals
    ...[10, 11, 12, 13, 14, 15].map((id) => botoxOffer(id, 'Boston', 8)),
    // Austin: 5 priced deals
    ...[20, 21, 22, 23, 24].map((id) => botoxOffer(id, 'Austin', 8)),
    // Chicago: 5 priced deals — ties Austin on count, breaks on name
    ...[30, 31, 32, 33, 34].map((id) => botoxOffer(id, 'Chicago', 8)),
  ]
  const all = cityBotoxMedians(offers)
  assert.deepEqual(
    all.map((m) => m.city),
    ['Boston', 'Austin', 'Chicago'],
  )

  const limited = cityBotoxMedians(offers, 2)
  assert.deepEqual(
    limited.map((m) => m.city),
    ['Boston', 'Austin'],
  )
})

// ─── lowestBotoxUnitOffers ────────────────────────────────

test('lowestBotoxUnitOffers sorts ascending, excludes non-per-unit prices, and dedupes by business', async () => {
  const { lowestBotoxUnitOffers } = await homepage()
  const offers = [
    offer({
      city: 'Tucson',
      id: 1,
      business_id: 10,
      price_model: 'per_unit',
      discount_price: 8,
    }),
    // Same business as offer 1, cheaper — must not add a second entry for business 10.
    offer({
      city: 'Tucson',
      id: 2,
      business_id: 10,
      price_model: 'per_unit',
      discount_price: 4,
    }),
    offer({
      city: 'Tucson',
      id: 3,
      business_id: 11,
      price_model: 'per_unit',
      discount_price: 6,
    }),
    // A flat price with no per-unit figure — comparablePrice() returns null for this on a
    // Botox offer, so it must never outrank or crowd out a real per-unit price.
    offer({
      city: 'Tucson',
      id: 4,
      business_id: 12,
      service_name: 'Lip Flip',
      discount_price: 79,
    }),
  ]
  const result = lowestBotoxUnitOffers(offers, 3)
  assert.deepEqual(
    result.map((o) => o.id),
    [2, 3],
  )
})

test('lowestBotoxUnitOffers names Botox only — a Dysport unit is not a Botox unit', async () => {
  const { lowestBotoxUnitOffers } = await homepage()
  const offers = [
    offer({
      city: 'Tucson',
      id: 1,
      business_id: 10,
      service_name: 'Dysport',
      price_model: 'per_unit',
      discount_price: 3,
    }),
    offer({
      city: 'Tucson',
      id: 2,
      business_id: 11,
      service_name: 'Botox Cosmetic',
      price_model: 'per_unit',
      discount_price: 9,
    }),
    offer({
      city: 'Tucson',
      id: 3,
      business_id: 12,
      service_name: 'Xeomin',
      price_model: 'per_unit',
      discount_price: 8,
    }),
  ]
  assert.deepEqual(
    lowestBotoxUnitOffers(offers, 3).map((o) => o.id),
    [2],
  )
})

test('lowestBotoxUnitOffers drops an offer whose business has no city', async () => {
  const { lowestBotoxUnitOffers } = await homepage()
  const offers = [
    offer({
      id: 1,
      business_id: 10,
      price_model: 'per_unit',
      discount_price: 3,
    }),
    offer({
      city: 'Tucson',
      id: 2,
      business_id: 11,
      price_model: 'per_unit',
      discount_price: 9,
    }),
  ]
  assert.deepEqual(
    lowestBotoxUnitOffers(offers, 3).map((o) => o.id),
    [2],
  )
})

test('lowestBotoxUnitOffers respects limit', async () => {
  const { lowestBotoxUnitOffers } = await homepage()
  const offers = [10, 11, 12, 13].map((businessId, i) =>
    offer({
      city: 'Tucson',
      id: businessId,
      business_id: businessId,
      price_model: 'per_unit',
      discount_price: 5 + i,
    }),
  )
  const result = lowestBotoxUnitOffers(offers, 2)
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((o) => o.business_id),
    [10, 11],
  )
})

// ─── pairStats (the hero's instant answer) ────────────────

test("pairStats: a neurotoxin pair is its city's typical price, and below the floor its from-price", async () => {
  const { pairStats } = await homepage()
  const dysport = (id: number, city: string) =>
    offer({
      id,
      business_id: id,
      city,
      service_name: 'Dysport',
      price_model: 'per_unit',
      discount_price: 3,
      offer_raw_text: 'Dysport $3/unit',
    })
  const tucsonOffers = [
    botoxOffer(1, 'Tucson', 12),
    botoxOffer(2, 'Tucson', 8),
    botoxOffer(3, 'Tucson', 10),
    botoxOffer(4, 'Tucson', 9),
    botoxOffer(5, 'Tucson', 11),
    // Dysport: out of the typical and its dot strip, never listed under the "Botox" rows.
    dysport(6, 'Tucson'),
    // A starting price: out of the typical too.
    offer({
      id: 7,
      business_id: 7,
      city: 'Tucson',
      price_model: 'from',
      discount_price: 6,
      offer_raw_text: 'Botox Starts at $6 per unit',
    }),
  ]
  const offers = [
    ...tucsonOffers,
    // Three priced offers: past the old 3-deal floor, below the typical's 5 from 3 clinics.
    botoxOffer(11, 'Boulder', 9),
    botoxOffer(12, 'Boulder', 11),
    dysport(13, 'Boulder'),
    // A starting price below the Dysport unit: never a floor.
    offer({
      id: 14,
      business_id: 14,
      city: 'Boulder',
      price_model: 'from',
      discount_price: 2.5,
      offer_raw_text: 'Botox Starts at $2.50 per unit',
    }),
    // Facials keep their median past three priced offers, and no from-price.
    ...[99, 149, 199].map((p, i) =>
      offer({
        id: 20 + i,
        business_id: 20 + i,
        city: 'Boulder',
        service_category: 'Facial',
        unit_type: null,
        discount_price: p,
      }),
    ),
  ]
  const stats = pairStats(offers)
  const tucson = stats.find((p) => p.city === 'tucson')
  const boulder = stats.find(
    (p) => p.city === 'boulder' && p.treatment === 'botox',
  )
  const facials = stats.find((p) => p.treatment === 'facials')
  assert.ok(tucson && boulder && facials)
  assert.equal(tucson.cityLabel, 'Tucson')
  assert.equal(tucson.perUnit, true)
  // The hero's figures are exactly the deals page's typical.
  const typical = typicalPrices(tucsonOffers).botox
  assert.ok(typical)
  assert.deepEqual(
    [
      tucson.minPrice,
      tucson.medianPrice,
      tucson.maxPrice,
      tucson.pricedDealCount,
      tucson.providerCount,
      tucson.minBrand,
    ],
    [
      typical.min,
      typical.median,
      typical.max,
      typical.pricedDealCount,
      typical.providerCount,
      typical.minBrand,
    ],
  )
  assert.deepEqual([tucson.minPrice, tucson.medianPrice], [8, 10])
  assert.deepEqual(tucson.prices, [8, 9, 10, 11, 12])
  assert.equal(tucson.from, null)
  assert.equal(tucson.dealCount, 7)
  assert.deepEqual(
    tucson.lowest.map((o) => o.id),
    // Not 7, the "Starts at $6": a starting price is never one of the cheapest rows.
    [2, 4, 3],
  )

  // Below the floor: no figures, and the city page's header instead — the cheapest comparable
  // price of any brand, named.
  assert.equal(boulder.medianPrice, null)
  assert.deepEqual(boulder.prices, [])
  assert.deepEqual(boulder.from, { amount: 3, perUnit: true, brand: 'Dysport' })
  // The two Botox rates, not the starting price: no row is cheaper than the "from".
  assert.deepEqual(
    boulder.lowest.map((o) => o.id),
    [11, 12],
  )

  assert.equal(facials.medianPrice, 149)
  assert.deepEqual(facials.prices, [99, 149, 199])
  assert.equal(facials.from, null)
})

// ─── priceDistributions (the strip plot) ──────────────────

test('priceDistributions returns one dot per priced offer with the interquartile range', async () => {
  const { priceDistributions, quantile } = await homepage()
  const offers = [
    ...[4, 8, 10, 12, 20].map((price, i) => botoxOffer(i + 1, 'Tucson', price)),
    // A Dysport unit is no dot: the strip's median is the pooled one (pooledPrice()).
    offer({
      id: 6,
      business_id: 6,
      city: 'Tucson',
      service_name: 'Dysport',
      price_model: 'per_unit',
      discount_price: 3,
      offer_raw_text: 'Dysport $3/unit',
    }),
  ]
  const [botox] = priceDistributions(offers)
  assert.equal(botox.treatment, 'botox')
  assert.equal(botox.dealCount, 5)
  assert.deepEqual(
    botox.dots.map((d) => d.price),
    [4, 8, 10, 12, 20],
  )
  assert.equal(botox.dots[0].cityLabel, 'Tucson')
  assert.deepEqual([botox.min, botox.median, botox.max], [4, 10, 20])
  assert.equal(botox.p25, 8)
  assert.equal(botox.p75, 12)
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
})

// ─── discountHistogram and finePrintFacts ─────────────────

test('discountHistogram bins stated discounts and ignores offers without one', async () => {
  const { discountHistogram } = await homepage()
  // Each states its own percent: one the words don't state is not an advertised discount.
  const offers = [5, 15, 20, 30, 50, 91, null].map((pct, i) =>
    offer({
      id: i + 1,
      business_id: i + 1,
      discount_percent: pct,
      offer_raw_text: pct ? `${pct}% off` : '',
    }),
  )
  const h = discountHistogram(offers)
  assert.equal(h.total, 7)
  assert.equal(h.stated, 6)
  assert.deepEqual(
    h.bins.map((b) => [b.label, b.count]),
    [
      ['Under 10%', 1],
      ['10–25%', 2],
      ['25–50%', 1],
      ['50% or more', 2],
    ],
  )
})

test('discountHistogram leaves out a percent worked out from a regular price the text never states', async () => {
  const { discountHistogram } = await homepage()
  const h = discountHistogram([
    // Offer 7792: the pipeline's 37.7% of a $480 its "40 Units Botox $299" never mentions.
    offer({
      id: 1,
      discount_price: 299,
      regular_price: 480,
      discount_percent: 37.7,
      delivered_units: 40,
    }),
    // The same shape, stating its own discount, keeps it.
    offer({
      id: 2,
      discount_price: 299,
      regular_price: 480,
      discount_percent: 38,
      offer_raw_text: '38% off: 40 units $299',
    }),
  ])
  assert.equal(h.stated, 1)
  assert.equal(h.bins.find((b) => b.label === '25–50%')?.count, 1)
})

test('discountHistogram leaves out a percent the offer never states', async () => {
  const { discountHistogram } = await homepage()
  // Offer 8788: stored 5% off, while its words state only a regular price.
  const h = discountHistogram([
    offer({
      id: 1,
      discount_percent: 5,
      offer_raw_text: 'Chemical Peels (regularly $350)',
    }),
  ])
  assert.equal(h.stated, 0)
})

test('finePrintFacts counts memberships, new-customer terms and before-prices', async () => {
  const { finePrintFacts } = await homepage()
  const offers = [
    offer({ id: 1, is_membership_required: true }),
    offer({ id: 2, is_new_customer_required: true }),
    offer({
      id: 3,
      regular_price: 12,
      discount_price: 10,
      offer_raw_text: '$10 (regularly $12)',
    }),
    // A "regular" price no higher than the deal price states nothing.
    offer({ id: 4, regular_price: 10, discount_price: 10 }),
    // Nor does one the offer's own words never state (statedRegularPrice).
    offer({ id: 5, regular_price: 12, discount_price: 10 }),
  ]
  assert.deepEqual(finePrintFacts(offers), {
    total: 5,
    membershipRequired: 1,
    newCustomerOnly: 1,
    statesBeforePrice: 1,
  })
})

test('homepageCounts uses the corpus length, distinct providers, and cities with deals', async () => {
  const { homepageCounts } = await homepage()
  const offers = [
    offer({ id: 1, business_id: 10 }),
    offer({ id: 2, business_id: 10 }),
    offer({ id: 3, business_id: 11 }),
  ]
  assert.deepEqual(
    homepageCounts(offers, [{ dealCount: 2 }, { dealCount: 0 }]),
    { deals: 3, providers: 2, cities: 1 },
  )
})

test('cityMediansByTreatment drops treatments with no chartable city', async () => {
  const { cityMediansByTreatment } = await homepage()
  const offers = [
    ...[8, 9, 10, 11, 12].map((price, i) => botoxOffer(i + 1, 'Tucson', price)),
    offer({
      id: 6,
      business_id: 6,
      city: 'Tucson',
      service_category: 'Dermal Filler',
      service_name: 'Lip filler',
      discount_price: 500,
    }),
  ]
  const result = cityMediansByTreatment(offers)
  assert.deepEqual(
    result.map((t) => t.treatment),
    ['botox'],
  )
  assert.equal(result[0].perUnit, true)
  assert.equal(result[0].rows[0].medianPrice, 10)
})
