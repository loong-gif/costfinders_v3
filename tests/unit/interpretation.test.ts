/**
 * "How we read this deal": the tier, the reasons that lower it, the notes that do not, and the
 * plain-language lines the deal page prints (.planning/DEAL-BROWSE-AND-TRUST.md §1).
 *
 * Every row below is a live shape through the real adapter. A tier is a public statement about
 * how far our reading can be trusted, so the cases pin the boundary on both sides: the figure
 * we worked out, and the same figure when the clinic's own words already state it.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  comparablePrice,
  dealToLean,
  offerToAnonymousDeal,
} from '@/lib/data/adapters'
import {
  describeInterpretation,
  interpretOffer,
  TIER_LABELS,
} from '@/lib/data/interpretation'
import type { InterpretationNote, InterpretationReason } from '@/types/deal'
import type { OfferView } from '@/types/supabase'

/** A visible Neurotoxin row sold in units; every test overrides what it is about. */
function offer(fields: Partial<OfferView>): OfferView {
  return {
    id: 1,
    business_id: 42,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    offer_raw_text: 'Botox $12/unit',
    discount_amount: null,
    discount_percent: null,
    discount_price: 12,
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

const read = (fields: Partial<OfferView>) => interpretOffer(offer(fields))
const lines = (fields: Partial<OfferView>) =>
  describeInterpretation(offerToAnonymousDeal(offer(fields))).lines

test('the labels are the owner-approved words', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(TIER_LABELS).map(([tier, { label }]) => [tier, label]),
    ),
    {
      'as-advertised': 'As advertised',
      'worked-out': 'Our math',
      check: 'Confirm when booking',
    },
  )
})

test('as advertised: every figure is the clinic’s, and nothing is said about it', () => {
  assert.deepEqual(read({}), {
    tier: 'as-advertised',
    reasons: [],
    notes: [],
  })
  const deal = offerToAnonymousDeal(offer({}))
  assert.deepEqual(describeInterpretation(deal), {
    headline: TIER_LABELS['as-advertised'].meaning,
    lines: [],
  })
})

test('a per-unit figure we divided out is our math, with both figures in the line', () => {
  const fields = {
    discount_price: 450,
    price_model: 'total',
    delivered_units: 40,
    offer_raw_text: '40 units of Botox for $450',
  }
  assert.deepEqual(read(fields).reasons, ['per-unit-divided'])
  assert.equal(read(fields).tier, 'worked-out')
  assert.deepEqual(lines(fields), [
    'The clinic advertised $450 for 40 units; we divided that to $11.25 per unit.',
  ])
  // Offer 7649 states the per-unit figure itself — nothing of ours to explain.
  assert.equal(
    read({
      discount_price: 450,
      delivered_units: 50,
      service_name: 'Xeomin',
      offer_raw_text: 'Our 50-unit Xeomin bundle is $450 (just $9.00/unit)',
    }).tier,
    'as-advertised',
  )
})

test('a total multiplied out from a stated rate is our math', () => {
  const fields = {
    discount_price: 1200,
    delivered_units: 100,
    offer_raw_text: '100 units of Botox at $12/unit',
  }
  assert.deepEqual(read(fields).reasons, ['multiplied-out'])
  assert.deepEqual(lines(fields), [
    'The clinic priced it per unit; the $1,200 for 100 units is our multiplication.',
  ])
})

test('one price over several treatments is our math, and says it is not the title’s price', () => {
  // Offer 8279: four items, titled by the first.
  const fields = {
    discount_price: 1499,
    price_model: 'total',
    delivered_units: 50,
    item_count: 4,
    service_name: 'Jeuveau',
    offer_raw_text:
      'Timeless Beauty Package: $1,499. Includes 50 units of Jeuveau, lip filler and 3 Hydrafacials',
  }
  assert.deepEqual(read(fields).reasons, ['bundle'])
  assert.deepEqual(lines(fields), [
    "The $1,499 covers more than one treatment, so it isn't a price for Jeuveau alone.",
  ])
})

test('a neurotoxin that names no single brand is compared against all of them', () => {
  for (const [service_name, offer_raw_text] of [
    ['Neurotoxin', 'Tox special $10/unit'],
    ['Neurotoxin', 'Botox or Jeuveau $10/unit'],
  ]) {
    const fields = { discount_price: 10, service_name, offer_raw_text }
    assert.deepEqual(read(fields).reasons, ['toxin-brand-unnamed'])
    assert.ok(lines(fields)[0].includes('$10 per unit'), lines(fields)[0])
  }
  // No per-unit figure, nothing compared, nothing to say.
  assert.deepEqual(
    read({
      discount_price: null,
      discount_percent: 20,
      service_name: 'Neurotoxin',
      offer_raw_text: '20% off tox',
    }).reasons,
    [],
  )
})

test('any price defect is "Confirm when booking", and such a deal is never ranked', () => {
  const cases: [string, Partial<OfferView>][] = [
    // offer 8509: a $400 "rate" no neurotoxin costs
    [
      'misread-unit-rate',
      {
        discount_price: 400,
        regular_price: 450,
        discount_amount: 50,
        unit_type: null,
        offer_raw_text:
          '$50 Off with Aspire Rewards (Reg. $3.75/unit. Minimum 120 units)',
      },
    ],
    // offer 1386: a price the text never states
    [
      'price-not-in-text',
      {
        discount_price: 10.4,
        regular_price: 13,
        discount_percent: 20,
        offer_raw_text:
          'Botox Injection 20% off from regular price for first time patient.',
      },
    ],
    // "$10 Botox": almost certainly per unit, but nothing says so
    [
      'bare-neurotoxin-price',
      { discount_price: 10, price_model: 'total', offer_raw_text: 'Botox $10' },
    ],
  ]
  for (const [defect, fields] of cases) {
    const deal = offerToAnonymousDeal(offer(fields))
    assert.equal(deal.interpretation.tier, 'check', defect)
    assert.ok(deal.interpretation.reasons.includes('price-defect'), defect)
    assert.equal(comparablePrice(deal), null, defect)
    assert.equal(dealToLean(deal).comparable, null, defect)
    assert.ok(
      describeInterpretation(deal).lines.some((line) =>
        line.includes("we don't rank it against other prices"),
      ),
      defect,
    )
  }
  // Offer 8509's line quotes what its card leads with, never the $400 it dropped.
  const [line] = lines(cases[0][1])
  assert.ok(line.includes('($50 off)') && !line.includes('$400'), line)
})

test('a discount lead the text does not state is Confirm when booking, unless it is our count', () => {
  // Offer 7859: "$1,000 off" over words that never mention it.
  const unstated: Partial<OfferView> = {
    discount_price: null,
    discount_amount: 1000,
    service_category: 'Dermal Filler',
    service_name: 'Dermal Filler',
    unit_type: null,
    offer_raw_text: '1 Filler Boost',
  }
  assert.deepEqual(read(unstated), {
    tier: 'check',
    reasons: ['discount-unstated'],
    notes: ['discount-only'],
  })
  assert.deepEqual(lines(unstated), [
    "The clinic's wording doesn't state this discount ($1,000 off). It comes from our reading of the offer, which may be wrong.",
    "There's a discount ($1,000 off) but no price, so there's no price to compare.",
  ])

  // Offers 10445 and 10463: 1 of 2 and 1 of 4 free is exactly the stored percent — our math.
  const free = (offer_raw_text: string, discount_percent: number) => ({
    discount_price: null,
    discount_percent,
    service_category: 'Wellness' as const,
    service_name: 'Vitamin Injection',
    unit_type: null,
    offer_raw_text,
  })
  const bogo = free('Buy 1 get 1 free IM Shots', 50)
  assert.deepEqual(read(bogo).reasons, ['discount-derived'])
  assert.equal(read(bogo).tier, 'worked-out')
  assert.equal(
    lines(bogo)[0],
    'The clinic advertised “buy 1, get 1 free”; we counted that as 50% off.',
  )
  assert.equal(
    lines(
      free(
        'PRP: purchase 3 injectable or topical treatments, receive 1 free',
        25,
      ),
    )[0],
    'The clinic advertised “buy 3, get 1 free”; we counted that as 25% off.',
  )
  // Offer 10431: "Buy 6 … get 1 free" stored as 16.67%, but 1 of 7 free is 14% — not a count
  // we can stand behind, so the shopper is told to confirm it.
  assert.equal(
    read(free('Buy 6 laser sessions, get 1 free', 16.67)).tier,
    'check',
  )
  // A figure the words state is as advertised, however the offer is shaped.
  assert.equal(
    read(free('Buy 1 get 1 free: 50% off', 50)).tier,
    'as-advertised',
  )
  assert.equal(read(free('20% off IV therapy', 20)).tier, 'as-advertised')

  // Offer 8788: a price defect whose discount lead is unstated too — neither line quotes the
  // lead as the clinic's words, and the check headline still holds.
  const both: Partial<OfferView> = {
    discount_price: 332.5,
    regular_price: 350,
    discount_percent: 5,
    discount_amount: 17.5,
    price_model: 'total',
    service_category: 'Facial',
    service_name: 'Chemical Peel',
    unit_type: null,
    offer_raw_text: 'Chemical Peels (regularly $350)',
  }
  assert.deepEqual(read(both).reasons, ['price-defect', 'discount-unstated'])
  assert.ok(
    lines(both).every((line) => !line.includes('wording states')),
    lines(both).join(' | '),
  )
})

test('the check rule is the tier, not a coincidence of the figures', () => {
  // Every check-tier row measured on 2026-09-28 already had no comparable price; the tier makes
  // it a rule, so a future defect that keeps a price still sorts last and counts nowhere.
  const deal = offerToAnonymousDeal(offer({}))
  assert.notEqual(comparablePrice(deal), null)
  assert.equal(
    comparablePrice({
      ...deal,
      interpretation: { tier: 'check', reasons: ['price-defect'], notes: [] },
    }),
    null,
  )
})

test('notes add context and never lower the tier', () => {
  const noted = (fields: Partial<OfferView>) => {
    const { tier, notes } = read(fields)
    return { tier, notes }
  }
  assert.deepEqual(
    noted({
      price_model: 'from',
      discount_price: 9,
      offer_raw_text: 'New Patient Botox starts at $9 per unit',
      is_new_customer_required: true,
      is_membership_required: true,
    }),
    {
      tier: 'as-advertised',
      notes: ['from-price', 'members-only', 'new-patients-only'],
    },
  )
  // Offer 7792: its $480 regular appears nowhere in its words.
  assert.deepEqual(
    noted({
      price_model: 'total',
      discount_price: 299,
      regular_price: 480,
      delivered_units: 40,
      offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
    }).notes,
    ['regular-price-unstated'],
  )
  assert.deepEqual(
    noted({
      discount_price: null,
      discount_percent: 10,
      service_category: null,
      offer_raw_text: '10% off all services',
    }),
    { tier: 'as-advertised', notes: ['clinic-wide', 'discount-only'] },
  )
  assert.deepEqual(
    noted({
      discount_price: null,
      discount_amount: 50,
      service_category: null,
      offer_raw_text: '$50 off IV therapy',
    }).notes,
    ['no-treatment', 'discount-only'],
  )
  // "Free with membership" already says there is no price.
  assert.deepEqual(
    noted({
      discount_price: 0,
      discount_percent: 100,
      is_membership_required: true,
      offer_raw_text: 'Free monthly Botox touch-up',
    }).notes,
    ['members-only'],
  )
})

test('every reason and note reads as a sentence carrying the deal’s own figures', () => {
  const seen = new Set<InterpretationReason | InterpretationNote>()
  const rows: Partial<OfferView>[] = [
    {
      discount_price: 450,
      price_model: 'total',
      delivered_units: 40,
      offer_raw_text: '40 units for $450',
      service_name: 'Neurotoxin',
    },
    {
      discount_price: 900,
      price_model: 'per_unit',
      delivered_units: 100,
      offer_raw_text: 'Tox for members',
      is_membership_required: true,
    },
    {
      discount_price: 1499,
      price_model: 'total',
      item_count: 3,
      offer_raw_text: 'Glow package $1,499',
    },
    { discount_price: 10, price_model: 'total', offer_raw_text: 'Botox $10' },
    {
      discount_price: 50,
      price_model: 'from',
      service_category: 'Laser Hair Removal',
      unit_type: null,
      service_name: 'Laser Hair Removal',
      offer_raw_text: 'Laser Hair Removal as Low as $50 (reg. $300 value)',
      regular_price: 90,
      is_new_customer_required: true,
    },
    {
      discount_price: null,
      discount_percent: 15,
      service_category: null,
      offer_raw_text: '15% off all purchases',
    },
    {
      discount_price: null,
      discount_amount: 25,
      service_category: null,
      offer_raw_text: '$25 off',
    },
    {
      discount_price: null,
      discount_percent: 33.33,
      service_category: null,
      offer_raw_text: 'Buy 2 syringes, get 1 free',
    },
    {
      discount_price: null,
      discount_amount: 1000,
      service_category: null,
      offer_raw_text: '1 Filler Boost',
    },
  ]
  for (const fields of rows) {
    const deal = offerToAnonymousDeal(offer(fields))
    const { headline, lines } = describeInterpretation(deal)
    assert.equal(headline, TIER_LABELS[deal.interpretation.tier].meaning)
    assert.equal(
      lines.length,
      deal.interpretation.reasons.length + deal.interpretation.notes.length,
    )
    for (const line of lines) {
      assert.ok(/^[A-Z$].*\.$/.test(line), line)
      assert.ok(!/undefined|null|NaN|\$0\b/.test(line), line)
    }
    for (const k of [
      ...deal.interpretation.reasons,
      ...deal.interpretation.notes,
    ]) {
      seen.add(k)
    }
  }
  assert.deepEqual([...seen].sort(), [
    'bundle',
    'clinic-wide',
    'discount-derived',
    'discount-only',
    'discount-unstated',
    'from-price',
    'members-only',
    'multiplied-out',
    'new-patients-only',
    'no-treatment',
    'per-unit-divided',
    'price-defect',
    'regular-price-unstated',
    'toxin-brand-unnamed',
  ])
})

test('the row shape carries the tier, the member flag and the comparable price', () => {
  const lean = dealToLean(
    offerToAnonymousDeal(offer({ is_membership_required: true })),
  )
  assert.equal(lean.interpretationTier, 'as-advertised')
  assert.equal(lean.requiresMembership, true)
  assert.equal(lean.clinicConfirmed, false)
  // The brand rides along: vs-typical leaves Dysport out, and a pooled floor names it.
  assert.deepEqual(lean.comparable, {
    amount: 12,
    perUnit: true,
    brand: 'Botox',
  })
  assert.equal(offerToAnonymousDeal(offer({})).clinicConfirmedAt, null)
})

test('adapters.ts imports none of the modules that import it', () => {
  // interpretOffer lives in adapters.ts for exactly this reason; a cycle here is how a module
  // reads an export that has not been initialised yet.
  const source = readFileSync('src/lib/data/adapters.ts', 'utf8')
  for (const dependent of ['interpretation', 'price-defects', 'offers']) {
    assert.ok(
      !new RegExp(`from '(\\./|@/lib/data/)${dependent}'`).test(source),
      dependent,
    )
  }
})
