import assert from 'node:assert/strict'
import test from 'node:test'
import type { OfferWithBusiness } from '@/types/supabase'
import {
  applyPriceFilters,
  filterPriceQuotes,
  normalizeOfferItemsToQuotes,
  type PriceQuote,
  parsePriceFilters,
  summarizePriceQuotes,
} from './marketplace'

function quote(
  overrides: Partial<PriceQuote> &
    Pick<PriceQuote, 'businessId' | 'effectivePrice'>,
): PriceQuote {
  return {
    offerItemId: 1,
    offerId: 1,
    city: 'Austin',
    serviceCategory: 'Neurotoxin',
    unitType: 'unit',
    ...overrides,
  }
}

function offer(overrides: Partial<OfferWithBusiness> = {}): OfferWithBusiness {
  return {
    id: 1,
    business_id: 1,
    membership_plan_id: null,
    promotion_id: null,
    regular_price: null,
    discount_price: null,
    discount_percent: null,
    discount_amount: null,
    is_membership_required: null,
    is_active: true,
    is_new_customer_required: false,
    offer_fingerprint: null,
    offer_raw_text: null,
    created_at: null,
    service_category: 'Neurotoxin',
    unit_type: 'unit',
    master_business_info: {
      business_id: 1,
      name: 'Clinic A',
      address: null,
      city: 'Austin',
      score: null,
      review_count: null,
      category: null,
      website: null,
    },
    promo_offer_items: [
      {
        offer_item_id: 10,
        offer_id: 1,
        service_id: 100,
        quantity: 1,
        unit_price: 12,
        clinic_services: {
          service_name: 'Botox',
          service_category: 'Neurotoxin',
          unit_type: 'unit',
          regular_price: 14,
        } as never,
      },
    ],
    ...overrides,
  }
}

test('normalizeOfferItemsToQuotes prefers unit_price over catalog price', () => {
  const [normalized] = normalizeOfferItemsToQuotes(offer())
  assert.ok(normalized)
  assert.equal(normalized.effectivePrice, 12)
  assert.equal(normalized.serviceCategory, 'Neurotoxin')
})

test('normalizeOfferItemsToQuotes falls back to clinic_services regular_price', () => {
  const [normalized] = normalizeOfferItemsToQuotes(
    offer({
      promo_offer_items: [
        {
          offer_item_id: 11,
          offer_id: 1,
          service_id: 100,
          quantity: 1,
          unit_price: null,
          clinic_services: {
            service_name: 'Botox',
            service_category: 'Neurotoxin',
            unit_type: 'unit',
            regular_price: 14,
          } as never,
        },
      ],
    }),
  )
  assert.ok(normalized)
  assert.equal(normalized.effectivePrice, 14)
})

test('summarizePriceQuotes groups by city, category, and unit', () => {
  const rows = [
    quote({ offerItemId: 1, businessId: 1, effectivePrice: 12 }),
    quote({ offerItemId: 2, businessId: 2, effectivePrice: 14 }),
    quote({
      offerItemId: 3,
      businessId: 3,
      effectivePrice: 10,
      city: 'Dallas',
    }),
    quote({
      offerItemId: 4,
      businessId: 1,
      effectivePrice: 8,
      unitType: 'area',
    }),
  ]

  const comparisons = summarizePriceQuotes(rows)

  assert.equal(comparisons.length, 2)
  assert.equal(comparisons[0]?.city, 'Austin')
  assert.equal(comparisons[0]?.serviceCategory, 'Neurotoxin')

  const austinUnits = comparisons[0]?.units ?? []
  assert.equal(austinUnits.length, 2)

  const perUnit = austinUnits.find((unit) => unit.unitType === 'unit')
  assert.ok(perUnit)
  assert.equal(perUnit.providerCount, 2)
  assert.equal(perUnit.minimum, 12)
  assert.equal(perUnit.maximum, 14)
  assert.equal(perUnit.median, null)
})

test('filterPriceQuotes applies city, category, and price range', () => {
  const rows = [
    quote({
      offerItemId: 1,
      businessId: 1,
      effectivePrice: 10,
      city: 'Austin',
    }),
    quote({
      offerItemId: 2,
      businessId: 2,
      effectivePrice: 20,
      city: 'Dallas',
      serviceCategory: 'Filler',
    }),
    quote({
      offerItemId: 3,
      businessId: 3,
      effectivePrice: 30,
      city: 'Austin',
    }),
  ]

  const filtered = filterPriceQuotes(rows, {
    city: 'Austin',
    category: 'Neurotoxin',
    min: 12,
    max: 25,
    rangeError: null,
  })

  assert.deepEqual(
    filtered.map((row) => row.effectivePrice),
    [],
  )

  const wider = filterPriceQuotes(rows, {
    city: 'Austin',
    category: null,
    min: 10,
    max: 20,
    rangeError: null,
  })
  assert.deepEqual(
    wider.map((row) => row.effectivePrice),
    [10],
  )
})

test('parsePriceFilters rejects invalid ranges without throwing', () => {
  const invalidMin = parsePriceFilters({ min: '-5' })
  assert.match(invalidMin.rangeError ?? '', /minimum price/i)

  const invalidRange = parsePriceFilters({ min: '20', max: '10' })
  assert.match(invalidRange.rangeError ?? '', /cannot exceed/i)
})

test('applyPriceFilters keeps lowest price per provider after filtering', () => {
  const rows = [
    quote({ offerItemId: 1, businessId: 1, effectivePrice: 15 }),
    quote({ offerItemId: 2, businessId: 1, effectivePrice: 11 }),
    quote({ offerItemId: 3, businessId: 2, effectivePrice: 13 }),
    quote({ offerItemId: 4, businessId: 2, effectivePrice: 12 }),
    quote({ offerItemId: 5, businessId: 3, effectivePrice: 10 }),
  ]

  const [comparison] = applyPriceFilters(rows, {
    city: null,
    category: null,
    min: 10,
    max: 15,
    rangeError: null,
  })
  const [unit] = comparison?.units ?? []

  assert.equal(unit?.providerCount, 3)
  assert.deepEqual(unit?.prices, [10, 11, 12])
  assert.equal(unit?.median, 11)
})
