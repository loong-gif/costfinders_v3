/**
 * The two rules every consumer offer read passes through, both of which have already shipped
 * wrong once.
 *
 * 1. `isPubliclyVisible` — the single gate on consumer browse. A NULL `end_date` MUST mean
 *    visible: 896 of 1000 offers resolve no expiry, so treating absence as expired empties the
 *    site. Before this gate existed the app filtered neither `is_active` nor `moderation_status`
 *    and served 322 delisted offers as live deals.
 * 2. `flattenOffer` — the canonical title and category. `promo_offer_master` lost 22 columns to
 *    normalization; the title and the category are now resolved from the joined item graph by
 *    lowest `offer_item_id`, and the category comes from the lowest item that resolves ONE, which
 *    is not always the title item. Getting that wrong is invisible: it renders as a plausible
 *    card with the wrong badge, and mis-bucketing put "0 Deals" URLs in the sitemap twice.
 *
 * `src/lib/data/offers.ts` builds a Supabase client at module scope, so the import is deferred
 * behind a stub env. The functions under test never touch the network.
 */
import { strict as assert } from 'node:assert'
import { before, test } from 'node:test'
import type { OfferJoinedRow } from '@/lib/data/offers'
import type { ClinicServiceCategory } from '@/types/supabase'

type OffersModule = typeof import('@/lib/data/offers')
let flattenOffer: OffersModule['flattenOffer']
let isPubliclyVisible: OffersModule['isPubliclyVisible']
let resolveOfferTitle: OffersModule['resolveOfferTitle']
let blanketOfferIds: OffersModule['blanketOfferIds']
let keepsOver: OffersModule['keepsOver']

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://stub.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'stub-anon-key'
  const offers: OffersModule = await import('@/lib/data/offers')
  flattenOffer = offers.flattenOffer
  isPubliclyVisible = offers.isPubliclyVisible
  resolveOfferTitle = offers.resolveOfferTitle
  blanketOfferIds = offers.blanketOfferIds
  keepsOver = offers.keepsOver
})

test('merged identical cards keep the cheapest membership a year, then the lower id', () => {
  const plan = (id: number, price: number | null, period: string | null) =>
    ({ id, membership_price: price, billing_period: period }) as Parameters<
      typeof keepsOver
    >[0]
  // Business 2528, 2026-09-28: the $59/month plan must win over the $249/month one.
  assert.equal(
    keepsOver(plan(10340, 59, 'monthly'), plan(10319, 249, 'monthly')),
    true,
  )
  assert.equal(
    keepsOver(plan(10319, 249, 'monthly'), plan(10340, 59, 'monthly')),
    false,
  )
  // Annualised: $600 a year beats $59 a month ($708 a year).
  assert.equal(keepsOver(plan(2, 600, 'annual'), plan(1, 59, 'monthly')), true)
  // A published fee beats none; with neither, the lower id.
  assert.equal(keepsOver(plan(9, 99, 'monthly'), plan(1, null, null)), true)
  assert.equal(keepsOver(plan(1, null, null), plan(2, null, null)), true)
})

function daysFromToday(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** A minimal live-shaped `promo_offer_master` row with an empty joined graph. */
function row(overrides: Partial<OfferJoinedRow> = {}): OfferJoinedRow {
  return {
    id: 1,
    business_id: 42,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    offer_raw_text: '20 units of Botox for $199, new clients only',
    discount_amount: null,
    discount_percent: null,
    discount_price: null,
    regular_price: null,
    is_active: true,
    is_membership_required: false,
    // Added by the pipeline on 2026-09-12/15 (conditions_text_array and
    // add_promo_offer_master_is_package). It also added requires_cf_verification and then
    // dropped it again the same afternoon with no ledger entry — hence no entry for it here.
    conditions: null,
    is_package: false,
    is_new_customer_required: false,
    membership_plan_id: null,
    offer_fingerprint: null,
    price_model: 'total',
    promotion_id: null,
    master_business_info: null,
    promo_offer_items: null,
    clinic_promotions: null,
    clinic_memberships: null,
    ...overrides,
  }
}

function item(
  offer_item_id: number,
  item_name: string | null,
  service_category: ClinicServiceCategory | null,
  extra: { unit_type?: string | null; service_area?: string | null } = {},
) {
  return {
    offer_item_id,
    item_name,
    delivered_units: null,
    unit_price: null,
    // `clinic_services.service_category` is NOT NULL since the 2026-09-15 enum conversion, so
    // "resolves no category" can only mean the item has no service row at all.
    clinic_services:
      service_category === null
        ? null
        : {
            service_category,
            unit_type: extra.unit_type ?? null,
            service_area: extra.service_area ?? null,
            source_url: null,
          },
  }
}

// --- visibility ------------------------------------------------------------

test('no end date means visible — the rule that governs 896 of 1000 offers', () => {
  assert.equal(isPubliclyVisible({ is_active: true, end_date: null }), true)
})

test('an expiry is inclusive of today and excludes yesterday', () => {
  const base = { is_active: true } as const
  assert.equal(
    isPubliclyVisible({ ...base, end_date: daysFromToday(0) }),
    true,
    'an offer expiring today is still live today',
  )
  assert.equal(isPubliclyVisible({ ...base, end_date: daysFromToday(1) }), true)
  assert.equal(
    isPubliclyVisible({ ...base, end_date: daysFromToday(-1) }),
    false,
  )
})

test('a deal that is off the site is never public', () => {
  // `is_active` is the whole gate since the pipeline dropped moderation_status on 2026-09-15.
  // What stops an owner publishing their own deal is now the database, not this predicate:
  // trg_guard_offer_publication (20260916010001) forces their insert inactive.
  const live = { is_active: true, end_date: null }
  assert.equal(isPubliclyVisible({ ...live, is_active: false }), false)
  assert.equal(
    isPubliclyVisible({ ...live, is_active: null }),
    false,
    'is_active NULL must fail closed, not default to visible',
  )
})

// --- canonical title -------------------------------------------------------

test('the title is the item_name of the lowest offer_item_id, whatever order they arrive in', () => {
  const flat = flattenOffer(
    row({
      promo_offer_items: [
        item(910, 'Add-on: Dermaplaning', 'Facial'),
        item(700, 'Botox 20 Units', 'Neurotoxin'),
        item(880, 'Consultation', null),
      ],
    }),
  )
  assert.equal(flat.service_name, 'Botox 20 Units')
})

test('the title falls back to offer_raw_text when the item graph cannot answer', () => {
  // promo_offer_items is RLS-gated on the parent offer being active, so a delisted offer
  // resolves an EMPTY array rather than an error — the case that rendered 214 admin queue
  // cards titled with a whole scraped paragraph.
  assert.equal(
    flattenOffer(row({ promo_offer_items: [] })).service_name,
    '20 units of Botox for $199, new clients only',
  )
  assert.equal(
    flattenOffer(row({ promo_offer_items: null })).service_name,
    '20 units of Botox for $199, new clients only',
  )
  assert.equal(
    flattenOffer(row({ promo_offer_items: [item(700, null, 'Neurotoxin')] }))
      .service_name,
    '20 units of Botox for $199, new clients only',
    'a lowest item with a null name must fall through, not resolve null',
  )
})

test('resolveOfferTitle applies the same rule for the title-only select', () => {
  assert.equal(
    resolveOfferTitle({
      offer_raw_text: 'raw',
      promo_offer_items: [
        { offer_item_id: 9, item_name: 'Later' },
        { offer_item_id: 2, item_name: 'First' },
      ],
    }),
    'First',
  )
  assert.equal(
    resolveOfferTitle({ offer_raw_text: 'raw', promo_offer_items: [] }),
    'raw',
  )
})

// --- canonical category ----------------------------------------------------

test('the category comes from the lowest item that resolves one, not the title item', () => {
  const flat = flattenOffer(
    row({
      promo_offer_items: [
        item(700, 'Package: New Client Bundle', null),
        item(701, 'Botox 20 Units', 'Neurotoxin', { unit_type: 'unit' }),
        item(702, 'Filler 1 Syringe', 'Dermal Filler', {
          unit_type: 'syringe',
        }),
      ],
    }),
  )
  assert.equal(flat.service_name, 'Package: New Client Bundle')
  assert.equal(flat.service_category, 'Neurotoxin')
  assert.equal(
    flat.unit_type,
    'unit',
    'unit_type must come from the same item as the category, or a card can state a unit its category contradicts',
  )
})

test('an offer whose items resolve no category is uncategorized, not defaulted', () => {
  // 151 of 1000 offers land here. Returning a category would put them on a treatment page
  // that cannot query for them — the "0 Deals" sitemap bug.
  const flat = flattenOffer(
    row({ promo_offer_items: [item(700, 'Mystery Special', null)] }),
  )
  assert.equal(flat.service_category, null)
  assert.equal(flat.service_name, 'Mystery Special')
})

test('validity and membership come from the promotion and plan embeds, or are absent', () => {
  const withPromotion = flattenOffer(
    row({
      clinic_promotions: {
        promotion_title: 'Spring Event',
        campaign_start_date: '2026-03-01',
        campaign_end_date: '2026-03-31',
        source_url: 'https://example.test/spring',
      },
      clinic_memberships: {
        membership_name: 'Glow Club',
        membership_price: 99,
        billing_period: 'monthly',
        minimum_commitment_months: 3,
      },
    }),
  )
  assert.equal(withPromotion.start_date, '2026-03-01')
  assert.equal(withPromotion.end_date, '2026-03-31')
  assert.equal(withPromotion.membership_name, 'Glow Club')

  const bare = flattenOffer(row())
  assert.equal(bare.start_date, null)
  assert.equal(
    bare.end_date,
    null,
    'a missing promotion must leave end_date null — isPubliclyVisible reads NULL as "no expiry"',
  )
})

// --- clinic-wide offers ----------------------------------------------------
// The owner's rule (2026-09-16): a blanket offer never carries a treatment badge and is on no
// treatment page, whatever service the pipeline linked it to.

test('clinic-wide wording has no category, whatever service it is linked to', () => {
  for (const text of [
    '10% off all products and services', // VIO, 6 rows titled Sculptra / Radiesse
    'Liz — $100 off Chemical Peel (any-service September offer).', // The Beauty Fix, 18 rows
    'Belle Âme Bank Membership — 15% off all purchases.',
    '10% off first treatment (new patient)',
  ]) {
    const flat = flattenOffer(
      row({
        offer_raw_text: text,
        promo_offer_items: [item(700, 'Sculptra', 'Dermal Filler')],
      }),
    )
    assert.equal(flat.service_category, null, text)
  }
  // A service-specific offer keeps its category.
  const specific = flattenOffer(
    row({
      offer_raw_text: '20% off your first Botox treatment',
      promo_offer_items: [item(700, 'Botox', 'Neurotoxin')],
    }),
  )
  assert.equal(specific.service_category, 'Neurotoxin')
})

test('one discount copied per service across categories is found from its siblings', () => {
  // PCH MedSpa: "PCH Special Offer: 10% off <service> treatment plus consultation with Dr. K",
  // 31 rows — the wording names one service each time, so only the set gives it away.
  const pch = (id: number, service: string, category: ClinicServiceCategory) =>
    flattenOffer(
      row({
        id,
        business_id: 2996,
        discount_percent: 10,
        offer_raw_text: `PCH Special Offer: 10% off ${service} treatment plus consultation with Dr. K`,
        promo_offer_items: [item(id * 10, service, category)],
      }),
    )
  const fanOut = [
    pch(1, 'Halo Laser', 'Laser & Light'),
    pch(2, 'IV Therapy', 'Wellness'),
    pch(3, 'Botox', 'Neurotoxin'),
  ]
  assert.deepEqual([...blanketOfferIds(fanOut)].sort(), [1, 2, 3])

  // Two rows are not a fan-out, and neither are brand rows inside one category (1121's
  // "<brand> 20% off" across Botox, Dysport, Xeomin, Jeuveau is a neurotoxin offer).
  assert.equal(blanketOfferIds(fanOut.slice(0, 2)).size, 0)
  const brands = ['Botox', 'Dysport', 'Xeomin', 'Jeuveau'].map((brand, i) =>
    flattenOffer(
      row({
        id: 10 + i,
        business_id: 1121,
        discount_percent: 20,
        offer_raw_text: `${brand} 20% off`,
        promo_offer_items: [item(100 + i, brand, 'Neurotoxin')],
      }),
    ),
  )
  assert.equal(blanketOfferIds(brands).size, 0)

  // A priced row is its own offer, however alike the wording.
  const priced = fanOut.map((o) => ({ ...o, discount_price: 99 }))
  assert.equal(blanketOfferIds(priced).size, 0)
})
