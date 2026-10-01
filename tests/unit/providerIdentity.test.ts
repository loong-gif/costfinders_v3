/**
 * Pre-claim anonymity: nothing a signed-out visitor sees may name the clinic behind a deal.
 *
 * Every text case below is a live row (2026-09-24) with its clinic's real name and website, so a
 * rule that stops catching one of them fails here rather than on the site. The generic-word cases
 * are the other direction: a clinic called "Glow Up" must keep "Glow & Go Facial".
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BusinessInfo } from '@/components/features/businessInfo'
import { DealMembership } from '@/components/features/deals/membershipTerms'
import {
  dealToLean,
  offerMembershipTerms,
  offerToAnonymousDeal,
} from '@/lib/data/adapters'
import { describeInterpretation } from '@/lib/data/interpretation'
import {
  MIN_PUBLIC_DIRECTORY,
  publicDirectory,
  scrubProviderIdentity,
} from '@/lib/utils/identity'
import type { OfferView } from '@/types/supabase'

const nakedTucson = {
  name: 'NakedMD Med Spa Tucson',
  website: 'nakedmd.com',
  city: 'Tucson',
}

const scrubs: [
  string,
  { name: string; website?: string; city?: string },
  string,
  string,
][] = [
  [
    'name leading a phrase is dropped, capital kept',
    nakedTucson,
    'NakedMD Members Club — Chin Filler Radiesse 1.0cc $299 per syringe.',
    'Members Club — Chin Filler Radiesse 1.0cc $299 per syringe.',
  ],
  [
    'the website name catches a brand prefix',
    nakedTucson,
    'Naked Lips | Lip Filler $149 (regular $299)',
    'Lips | Lip Filler $149 (regular $299)',
  ],
  [
    'after a preposition the name becomes "this provider"',
    { name: 'Alchemy Face Bar', website: 'alchemyfacebar.com' },
    'receive toxins at $10/unit during your first treatment at Alchemy when you get 20+ units!',
    'receive toxins at $10/unit during your first treatment at this provider when you get 20+ units!',
  ],
  [
    'a core that is a real word is still this clinic',
    { name: 'West Medical Aesthetics', website: 'westmedspa.com' },
    '20% off one service never tried at West before',
    '20% off one service never tried at this provider before',
  ],
  [
    'accents fold: Belle Âme',
    { name: 'Belle Âme Med Spa', website: 'belleamemedspa.com' },
    'Belle Âme Bank Membership — 15% off all purchases.',
    'Bank Membership — 15% off all purchases.',
  ],
  [
    'a three-letter core survives when it is the whole name',
    { name: 'PCH MedSpa' },
    'PCH Special Offer: 10% off Botox treatment plus consultation with Dr. K',
    'Special Offer: 10% off Botox treatment plus consultation with the doctor',
  ],
  [
    'a named doctor goes, misspelt or not',
    { name: 'Bonakdar Aesthetics' },
    'Best Botox Ever with Dr Bonadkar. Minimum 70 units at $11 per unit - $770 (value $980)',
    'Best Botox Ever with the doctor. Minimum 70 units at $11 per unit - $770 (value $980)',
  ],
  [
    'a surname without "Dr." still goes',
    { name: 'Bonakdar Aesthetics' },
    'Monica Bonakdar and get $100 OFF any Filler Package.',
    'Monica and get $100 OFF any Filler Package.',
  ],
  [
    '"&" in a name matches "&" in the text',
    { name: 'Ageless & Beautiful Medical Spa' },
    'Ageless & Beautiful Annual Membership',
    'Annual Membership',
  ],
  [
    '"+" in the text matches "Plus" in the name',
    { name: 'Faces Plus: Dr. Steven Cohen' },
    'Faces+ Prestige Membership',
    'Prestige Membership',
  ],
  [
    'possessive becomes "the provider\'s"',
    {
      name: 'Seranova Sculpt and Beauty',
      website: 'https://seranovamedspa.com/',
    },
    "Book Seranova's signature facial",
    "Book the provider's signature facial",
  ],
  [
    'the website itself becomes a pointer, not the domain',
    { name: 'Skinjectables Anti-Aging Bar', website: 'skinjectables.com' },
    'Details at www.skinjectables.com/vault',
    "Details at the provider's website",
  ],
  [
    'shouted text, any case',
    { name: 'Iconique Medical Aesthetics', website: 'iconiquemedspa.com' },
    'ICONIQUE JAWLINE $2,500.00',
    'JAWLINE $2,500.00',
  ],
]

for (const [label, business, before, after] of scrubs) {
  test(`scrubProviderIdentity: ${label}`, () => {
    assert.equal(scrubProviderIdentity(before, business), after)
  })
}

test('scrubProviderIdentity keeps generic words, treatments and the city', () => {
  const keep: [{ name: string; website?: string; city?: string }, string][] = [
    [
      { name: 'Glow Up Med Spa', website: 'glowupmedspa.com' },
      'FREE Glow & Go Facial with 30+ units of any TOX',
    ],
    [
      { name: 'Skin Maison Med Spa', website: 'https://www.skinmaison.com/' },
      'Skin Treatments 10% off; Skincare Products 10% off',
    ],
    [{ name: 'House of Aesthetics Med Spa' }, 'Classic House Membership'],
    [{ name: 'Beauty & Health By Liz' }, 'The Luxury Beauty Bundle'],
    [
      {
        name: 'Newport Beach Med Spa',
        website: 'newportbeachmedspa.com',
        city: 'Newport Beach',
      },
      'Botox $10 per unit in Newport Beach',
    ],
    [
      {
        name: 'Allure Aesthetic Center | Med Spa, Botox, Laser, Tattoo Removal, P Shot Alpharetta',
      },
      'Laser Hair Removal $99 · Tattoo Removal $150 · Botox $12 per unit',
    ],
    // No identity to strip: a "whole word" rule must not bite inside a longer word.
    [{ name: 'Vasu Skin Solutions' }, 'Vasudeva peel'],
  ]
  for (const [business, text] of keep) {
    assert.equal(scrubProviderIdentity(text, business), text, text)
  }
})

test('scrubProviderIdentity without a business only removes named doctors', () => {
  assert.equal(
    scrubProviderIdentity('NakedMD Members Club', null),
    'NakedMD Members Club',
  )
  assert.equal(
    scrubProviderIdentity('$13 per unit with Dr. Tsay (Reg. $14 per unit)', {}),
    '$13 per unit with the doctor (Reg. $14 per unit)',
  )
  assert.equal(scrubProviderIdentity(null, nakedTucson), '')
})

function offer(overrides: Partial<OfferView>): OfferView {
  return {
    id: 8723,
    business_id: 3000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    offer_raw_text:
      'NakedMD Members Club — Chin Filler Radiesse 1.0cc $299 per syringe.',
    discount_amount: null,
    discount_percent: null,
    discount_price: 299,
    regular_price: null,
    is_active: true,
    is_membership_required: true,
    conditions: null,
    is_package: false,
    is_new_customer_required: false,
    membership_plan_id: 1,
    offer_fingerprint: null,
    price_model: 'total',
    promotion_id: null,
    master_business_info: {
      business_id: 3000,
      name: 'NakedMD Med Spa Tucson',
      website: 'nakedmd.com',
      address: null,
      city: 'Tucson',
      score: 4.84,
      review_count: 161,
      category: null,
    },
    service_name: 'Radiesse',
    service_category: 'Dermal Filler',
    unit_type: 'syringe',
    item_count: 1,
    service_area: null,
    source_url: null,
    delivered_units: null,
    unit_price: null,
    start_date: null,
    end_date: null,
    promotion_title: null,
    membership_name: 'NakedMD Members Club',
    membership_price: null,
    billing_period: null,
    minimum_commitment_months: null,
    ...overrides,
  }
}

test('offerToAnonymousDeal: no clinic name, rating or review count anywhere in the deal', () => {
  const deal = offerToAnonymousDeal(offer({}))
  // What a client component receives, serialised as the page does.
  const serialised = JSON.stringify([deal, dealToLean(deal)])
  assert.ok(!/naked/i.test(serialised), serialised)
  assert.ok(!serialised.includes('161'), serialised)
  assert.ok(!serialised.includes('4.8'), serialised)
  assert.ok(!/rating|review/i.test(serialised), serialised)
  assert.equal(
    deal.description,
    'Members Club — Chin Filler Radiesse 1.0cc $299 per syringe.',
  )
  assert.equal(deal.termsAndConditions, 'Membership required.')
})

// "Club FX" is DermFx's plan (/deals/8107, business 3310): it never says "DermFx", and one web
// search finds the clinic. Owner decision, 2026-09-28: no plan name before a claim, whatever it
// says. public_offers already withholds it; these hold even when a base-table read supplies one.
const clubFx = {
  membership_name: 'Club FX',
  master_business_info: {
    business_id: 3310,
    name: 'DermFx',
    website: 'dermfx.com',
    address: null,
    city: 'Scottsdale',
    score: null,
    review_count: null,
    category: null,
  },
}

test('offerToAnonymousDeal: no plan name in the terms, in any payload', () => {
  for (const membership_name of ['Club FX', 'TOX Membership']) {
    const deal = offerToAnonymousDeal(offer({ ...clubFx, membership_name }))
    assert.equal(deal.termsAndConditions, 'Membership required.')
    const serialised = JSON.stringify([deal, dealToLean(deal)])
    assert.ok(!serialised.includes(membership_name), serialised)
  }
})

test('offerMembershipTerms: the fee is shown, the plan name never is', () => {
  const priced = {
    membership_price: 149,
    billing_period: 'monthly',
    minimum_commitment_months: 6,
  }
  const named = offerMembershipTerms(offer(priced))
  assert.deepEqual(named, {
    name: null,
    price: 149,
    billingPeriod: 'monthly',
    minimumCommitmentMonths: 6,
  })
  assert.ok(!/naked/i.test(JSON.stringify(named)))
  const clubTerms = offerMembershipTerms(offer({ ...priced, ...clubFx }))
  assert.equal(clubTerms?.name, null)
  assert.ok(!JSON.stringify(clubTerms).includes('Club FX'))
  // A plan that states nothing but its name states nothing a shopper may see.
  assert.equal(offerMembershipTerms(offer(clubFx)), null)
  // An unknown period is not guessed at; no plan data at all is null, not an empty plan.
  assert.equal(
    offerMembershipTerms(offer({ ...priced, billing_period: 'weekly' }))
      ?.billingPeriod,
    null,
  )
  assert.equal(offerMembershipTerms(offer({})), null)
  assert.equal(
    offerMembershipTerms(offer({ ...priced, is_membership_required: false })),
    null,
  )
})

test('DealMembership: the deal page prints the fee and no plan name', () => {
  const html = renderToStaticMarkup(
    createElement(DealMembership, {
      membership: offerMembershipTerms(
        offer({
          ...clubFx,
          membership_price: 99,
          billing_period: 'monthly',
          minimum_commitment_months: 3,
        }),
      ),
    }),
  )
  assert.ok(!html.includes('Club FX'), html)
  assert.ok(html.includes('$99 a month'), html)
  assert.ok(html.includes('3 months'), html)
  assert.ok(
    html.includes('The plan&#x27;s name comes with the clinic&#x27;s details'),
    html,
  )
})

test('BusinessInfo: after a claim the clinic card names the plan', () => {
  const clinic = {
    name: 'DermFx',
    address: null,
    city: 'Scottsdale',
    phone: null,
    website: null,
    rating: null,
    review_count: null,
    google_place_id: null,
  }
  const named = renderToStaticMarkup(
    createElement(BusinessInfo, {
      clinic,
      claimedThisDeal: true,
      membershipPlan: 'Club FX',
    }),
  )
  assert.ok(named.includes('Membership plan'), named)
  assert.ok(named.includes('Club FX'), named)
  const unnamed = renderToStaticMarkup(
    createElement(BusinessInfo, { clinic, claimedThisDeal: true }),
  )
  assert.ok(!unnamed.includes('Membership plan'), unnamed)
})

test('describeInterpretation: no line names the clinic', () => {
  // A bundle's line quotes the deal's title, which is the clinic's own words.
  const deal = offerToAnonymousDeal(
    offer({ item_count: 3, service_name: 'NakedMD Signature Package' }),
  )
  const { lines } = describeInterpretation(deal)
  assert.ok(
    lines.some((line) => line.includes('Signature Package')),
    lines[0],
  )
  assert.ok(!/naked/i.test(JSON.stringify(lines)), JSON.stringify(lines))
})

test('publicDirectory: no list below four named clinics, the whole list from four', () => {
  const named = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ slug: `clinic-${i}` }))
  assert.equal(MIN_PUBLIC_DIRECTORY, 4)
  assert.deepEqual(publicDirectory(named(1)), [])
  assert.deepEqual(publicDirectory(named(3)), [])
  assert.equal(publicDirectory(named(4)).length, 4)
  // A clinic with no slug has no page, so it does not count towards the four.
  assert.deepEqual(publicDirectory([...named(3), { slug: '' }]), [])
})

// The clinic's own wording names its plan too (20260928010005): "Glo2 Society Membership: 1 Glo2
// Facial per month". Each phrase is a distinctive plan found in its own live offers on 2026-09-28.
// Live, as anon, because what regresses is the view: every public_offers migration copies the
// previous one's body, and a copy of 010004's would bring them all back with nothing else failing.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// Specific enough that ordinary copy ("your skin goals") cannot trip it.
const PLAN_NAMES_SEEN = [
  'best skin of my life',
  'glo2 society',
  'smooth + sculpt club',
  'tox & more membership',
  'skin goals membership',
  'b transformed',
  'b rejuvenated',
  'monthly glow membership',
]

test(
  'public_offers: no plan name as anon, in a column or in the offer wording',
  {
    skip:
      !(url && key) && 'NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY unset: UNVERIFIED',
  },
  async () => {
    const db = createClient(url as string, key as string, {
      auth: { persistSession: false },
    })
    const { data, error } = await db
      .from('public_offers')
      .select('id, offer_raw_text, promo_offer_items, membership_name')
    if (error) throw new Error(`could not read public_offers: ${error.message}`)
    assert.ok(data.length > 0, 'public_offers returned no rows')
    for (const row of data) {
      assert.equal(row.membership_name, null, `offer ${row.id}`)
      const words = JSON.stringify([
        row.offer_raw_text,
        row.promo_offer_items,
      ]).toLowerCase()
      for (const name of PLAN_NAMES_SEEN) {
        assert.ok(!words.includes(name), `offer ${row.id} names "${name}"`)
      }
    }
  },
)
