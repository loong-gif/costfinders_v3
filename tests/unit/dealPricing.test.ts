/**
 * The price block printed on every deal surface.
 *
 * A wrong price claim is the most expensive kind of quiet wrong: it is a public promise and it
 * looks right. The live distribution makes every branch below load-bearing — of the 814 visible
 * offers measured on 2026-09-16:
 *
 *   482  publish a discount_price above zero
 *     275  ... of those have a real comparison (regular_price > discount_price)
 *      20  ... set price_model 'from', so the figure is a floor and not the price
 *       7  ... have no usable regular_price but a scraped percent or amount — and on 6 of the 7
 *              that number is not a discount off the price beside it, so none is printed
 *       1  ... has regular_price <= discount_price                    → not a saving at all
 *    27  have discount_price = 0 and discount_percent = 100, and NOT ONE is a giveaway:
 *      17  ... are `is_membership_required` benefits of a $99–$1,925 plan
 *      10  ... hang off a purchase (BOGO, "buy 40+ units", "complimentary add-on")
 *       7  ... also carry a regular_price: the stated "value"
 *   305  publish no discount_price, and every single one states a discount anyway:
 *     161  percent-off only, 144 dollar-amount off only, 0 both, **0 neither**
 *      23  ... also carry a regular_price
 *       7  ... state a discount_amount at or above it — a stated VALUE, not dollars off
 *       9  ... (of all 814) hedge their own number with "up to"
 *
 * So "Contact for pricing" applies to none of the 814 today, and it used to be the render for
 * 332 of them. No offer has discount_percent above 100, and 14 have a discount_amount at or
 * above their regular_price — which is why nothing here ever computes `regular - amount`.
 *
 * Every assertion below is about printing the WEAKEST claim the row supports. The columns are a
 * scraper's reading of marketing copy; the output is a public price promise.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  comparablePrice,
  dealPricing,
  neurotoxinBrand,
  offerSubtitle,
  offerToAnonymousDeal,
  perUnitPrice,
  productLine,
} from '@/lib/data/adapters'
import { buildDealOfferSchema } from '@/lib/seo/schemas'
import type { TreatmentCategory } from '@/types/deal'
import type { OfferView } from '@/types/supabase'

function offer(prices: {
  regular_price?: number | null
  discount_price?: number | null
  discount_percent?: number | null
  discount_amount?: number | null
  is_membership_required?: boolean | null
  price_model?: string
  offer_raw_text?: string
  unit_type?: string | null
  delivered_units?: number | null
  service_category?: OfferView['service_category']
  item_count?: number
}): OfferView {
  return {
    id: 1,
    business_id: 42,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    // A real row states its own prices; one that does not has them dropped (priceIsStated,
    // statedRegularPrice).
    offer_raw_text:
      prices.offer_raw_text ??
      `Botox 20 units${prices.discount_price ? ` $${prices.discount_price}` : ''}${prices.regular_price ? ` (regularly $${prices.regular_price})` : ''}`,
    discount_amount: prices.discount_amount ?? null,
    discount_percent: prices.discount_percent ?? null,
    discount_price: prices.discount_price ?? null,
    regular_price: prices.regular_price ?? null,
    is_active: true,
    is_membership_required: prices.is_membership_required ?? false,
    // Added by the pipeline on 2026-09-12/15 (conditions_text_array and
    // add_promo_offer_master_is_package). It also added requires_cf_verification and then
    // dropped it again the same afternoon with no ledger entry — hence no entry for it here.
    conditions: null,
    is_package: false,
    is_new_customer_required: false,
    membership_plan_id: null,
    offer_fingerprint: null,
    price_model: prices.price_model ?? 'total',
    promotion_id: null,
    master_business_info: null,
    service_name: 'Botox 20 Units',
    service_category:
      'service_category' in prices
        ? (prices.service_category ?? null)
        : 'Neurotoxin',
    unit_type: 'unit_type' in prices ? (prices.unit_type ?? null) : 'unit',
    item_count: prices.item_count ?? 1,
    service_area: null,
    source_url: null,
    delivered_units: prices.delivered_units ?? null,
    unit_price: null,
    start_date: null,
    end_date: null,
    promotion_title: null,
    membership_name: null,
    membership_price: null,
    billing_period: null,
    minimum_commitment_months: null,
  }
}

/** The whole production path: a database row through the adapter into the shared price block. */
function pricingFor(prices: Parameters<typeof offer>[0]) {
  return dealPricing(offerToAnonymousDeal(offer(prices)))
}

test('A — a price with a real regular above it: price leads, saving is ours to state', () => {
  const p = pricingFor({ regular_price: 300, discount_price: 199 })
  assert.equal(p.kind, 'price')
  assert.equal(p.lead, '$199')
  assert.equal(p.strikeThrough, '$300')
  assert.deepEqual(p.savings, { amount: '$101', percent: 34 })
  assert.equal(
    p.note,
    null,
    'nothing more to add when both numbers are on screen',
  )
})

test('A — the badge percentage comes from the prices, not from the scraped percent', () => {
  // 13 offers carry a discount_percent that disagrees with their own two prices by more than 5
  // points. The adapter still exposes the scraped number (deal-sorting and the admin queue read
  // it), but a card showing $300 → $199 must not also claim 25%, which neither price supports.
  const deal = offerToAnonymousDeal(
    offer({ regular_price: 300, discount_price: 199, discount_percent: 25 }),
  )
  assert.equal(deal.discountPercent, 25)
  assert.equal(dealPricing(deal).savings?.percent, 34)
})

test('B — a price with no usable regular: the price stands alone', () => {
  // NOT "$199 · 20% off". A scraped discount printed beside a price asserts a discount off that
  // price, and on 6 of the 7 live rows that reach here it is not one: 8569 "PicoWay lower body
  // $200 special" has discount_amount 200 ("$200 / $200 off" — free, by implication), 8116
  // "Botox at Just $10/Unit" has amount 120, 1415's 18% is "18% less than the equivalent Botox"
  // and 7900's 15% is "off additional services and products", not off its $200 gift card.
  const noRegular = pricingFor({ discount_price: 199, discount_percent: 20 })
  assert.equal(noRegular.lead, '$199')
  assert.equal(noRegular.strikeThrough, null)
  assert.equal(noRegular.savings, null)
  assert.equal(noRegular.note, null)

  const sameNumberTwice = pricingFor({
    discount_price: 200,
    discount_amount: 200,
    offer_raw_text: 'PicoWay lower body $200 special.',
  })
  assert.equal(sameNumberTwice.lead, '$200')
  assert.equal(
    sameNumberTwice.note,
    null,
    'offer 8569: "$200 / $200 off" reads as free',
  )

  const unrelatedAmount = pricingFor({
    discount_price: 10,
    discount_amount: 120,
    offer_raw_text: 'Botox at Just $10/Unit',
  })
  assert.equal(unrelatedAmount.lead, '$10')
  assert.equal(
    unrelatedAmount.note,
    null,
    'offer 8116: $120 appears nowhere in the offer',
  )

  // The one offer whose regular_price is at or below its discount_price. A strikethrough here
  // would claim the deal is cheaper than a number that is not higher.
  const inverted = pricingFor({ regular_price: 150, discount_price: 199 })
  assert.equal(inverted.lead, '$199')
  assert.equal(inverted.strikeThrough, null)
  assert.equal(inverted.savings, null)

  const equal = pricingFor({ regular_price: 199, discount_price: 199 })
  assert.equal(equal.strikeThrough, null)
  assert.equal(equal.savings, null)
})

test('C — 100% off never reads a bare "Free": the condition is part of the headline', () => {
  // Not one of the 27 live rows is a giveaway. 17 are membership benefits and the other 10 hang
  // off a purchase, and the card's title is the *purchased* product ("Botox", "Juvéderm") with
  // no description and no terms on a grid card — so "Free" promised a free Botox treatment.
  const bare = pricingFor({ discount_price: 0, discount_percent: 100 })
  assert.equal(bare.kind, 'free')
  assert.equal(bare.lead, 'Free with purchase')
  assert.equal(bare.note, null)
  assert.equal(bare.savings, null)

  // offer 8345: "Botox - 30 Units", discount_price 0, percent 100, plan "Sapphire Membership"
  // at $149/month. The old render was the word "Free" in 4xl type.
  const membership = pricingFor({
    discount_price: 0,
    discount_percent: 100,
    is_membership_required: true,
    offer_raw_text: 'Botox - 30 Units',
  })
  assert.equal(membership.lead, 'Free with membership')
  assert.equal(membership.savings, null)

  // "BioSpa® Express Signature Facial FREE (30 minutes, $100 value)" — 7 of the 27 say this.
  const withValue = pricingFor({
    discount_price: 0,
    discount_percent: 100,
    regular_price: 100,
  })
  assert.equal(withValue.lead, 'Free with purchase')
  assert.equal(withValue.note, '$100 value')
  assert.equal(withValue.strikeThrough, null)
  assert.equal(
    withValue.savings,
    null,
    'free is not a subtraction we performed',
  )
})

test('D — no price, percent only: the percentage leads', () => {
  const bare = pricingFor({ discount_percent: 20 })
  assert.equal(bare.kind, 'discount')
  assert.equal(bare.lead, '20% off')
  assert.equal(bare.note, null)
  assert.equal(bare.savings, null)

  // 10 of the 161 also carry a regular price. Context, not a comparison — we do not know what
  // 20% off $300 leaves, and multiplying it out would publish a price no clinic stated.
  const withRegular = pricingFor({ discount_percent: 20, regular_price: 300 })
  assert.equal(withRegular.lead, '20% off')
  assert.equal(withRegular.note, 'Regularly $300')
  assert.equal(withRegular.savings, null)
})

test('E — no price, dollar amount only: the amount leads', () => {
  const bare = pricingFor({ discount_amount: 100 })
  assert.equal(bare.kind, 'discount')
  assert.equal(bare.lead, '$100 off')
  assert.equal(bare.savings, null)

  // 13 of the 144 also carry a regular price, and it is context only — nothing subtracts them.
  const withRegular = pricingFor({ discount_amount: 100, regular_price: 300 })
  assert.equal(withRegular.lead, '$100 off')
  assert.equal(withRegular.note, 'Regularly $300')
  assert.equal(withRegular.savings, null)

  // An amount at or above the regular price is not a discount off it — it is the offer's stated
  // VALUE, in the same column. All 7 live rows of that shape say so in their own words: offer
  // 7859 "1 Filler Boost or 1 Sculptra Vial (Up to $1,000 Value)", offer 8716 "one complimentary
  // Chin Tox treatment per month ($100 value)". "$1,000 off" invents a discount nobody offered
  // (and "$1,000 off / Regularly $1,000" would imply the $0 this function exists not to print).
  const statedValue = pricingFor({ discount_amount: 300, regular_price: 300 })
  assert.equal(statedValue.lead, '$300 value')
  assert.equal(statedValue.note, null)
  assert.equal(statedValue.savings, null)

  const overValue = pricingFor({ discount_amount: 400, regular_price: 300 })
  assert.equal(
    overValue.lead,
    '$400 value',
    'an amount above the base cannot be off it',
  )
})

test('the offer’s own "up to" hedge survives into the headline', () => {
  // 9 visible offers hedge their own number; discount_percent / discount_amount keep the number
  // and drop the hedge, which states a firmer discount than the clinic did.
  const percent = pricingFor({
    discount_percent: 50,
    offer_raw_text: 'Save up to 50% off all our Laser Services',
  })
  assert.equal(percent.lead, 'Up to 50% off', 'offer 9801')

  const amount = pricingFor({
    discount_amount: 325,
    offer_raw_text: 'Save up to $325 OFF per vial of Sculptra.',
  })
  assert.equal(amount.lead, 'Up to $325 off', 'offer 8043')

  const value = pricingFor({
    discount_amount: 1000,
    regular_price: 1000,
    offer_raw_text: '1 Filler Boost or 1 Sculptra Vial (Up to $1,000 Value)',
  })
  assert.equal(value.lead, 'Up to $1,000 value', 'offer 7859')

  // A price is a price — nothing about "up to" changes a published figure.
  const priced = pricingFor({
    discount_price: 199,
    offer_raw_text: 'Up to 3 areas treated, $199',
  })
  assert.equal(priced.lead, '$199')
})

test('a "from" price is published as a floor, not as the price', () => {
  // All 20 offers with price_model 'from' read "Starting at", "From" or "as low as" in their own
  // text. A flat "$50" turns the clinic's floor into its price.
  const floor = pricingFor({
    discount_price: 50,
    price_model: 'from',
    offer_raw_text: 'Laser Hair Removal as Low as $50',
  })
  assert.equal(floor.lead, 'From $50', 'offer 8517')
  assert.equal(floor.kind, 'price', 'still a money lead')

  // 7 of the 20 carry a real comparison, stated by the clinic itself ("Lip Filler From $149.00
  // (-50%), regular price $299.00") — the strikethrough and badge stay.
  const withComparison = pricingFor({
    discount_price: 149,
    regular_price: 299,
    price_model: 'from',
  })
  assert.equal(withComparison.lead, 'From $149')
  assert.equal(withComparison.strikeThrough, '$299')
  assert.equal(withComparison.savings?.percent, 50)

  assert.equal(
    pricingFor({ discount_price: 50 }).lead,
    '$50',
    'total is unprefixed',
  )
  assert.equal(
    pricingFor({ discount_price: 12, price_model: 'per_unit' }).lead,
    '$12',
    'per_unit is carried by `basis`, not by the lead',
  )
})

test('F — nothing stated at all is the only place Contact for pricing survives', () => {
  const p = pricingFor({})
  assert.equal(p.kind, 'none')
  assert.equal(p.lead, 'Contact for pricing')
  assert.equal(p.note, null)
  assert.equal(p.savings, null)
})

test('no claim the two prices do not support is reachable, in any column shape', () => {
  // The regression that matters most: these are the claims we are not entitled to make. Every
  // shape the live columns can take, not just the documented cases.
  //
  // This grid used to assert only on savings/strikeThrough, "$0" and percentages, and it
  // therefore reported pass on {regular: null, price: 100, amount: 500} — a card reading
  // "$100 · $500 off". A grid with no invariant relating `note` to `lead` certified that.
  const values = [null, 0, 100, 199, 300]
  // The three non-price inputs are in the grid too: each one exists to weaken a claim, and a
  // weakener that can be made to strengthen one is the bug it was added to prevent.
  const qualifiers: Parameters<typeof offer>[0][] = [
    {},
    { is_membership_required: true },
    { price_model: 'from' },
    { offer_raw_text: 'Save up to 50% off, up to $500 value' },
  ]
  for (const qualifier of qualifiers) {
    for (const regular_price of values) {
      for (const discount_price of values) {
        for (const discount_percent of [null, 0, 20, 100]) {
          for (const discount_amount of [null, 0, 100, 500]) {
            const shape = {
              ...qualifier,
              regular_price,
              discount_price,
              discount_percent,
              discount_amount,
            }
            const p = pricingFor(shape)
            const label = JSON.stringify(shape)

            // A money lead never carries a discount claim beside it: it would assert a discount
            // off the very figure next to it, which on 6 of the 7 live rows is false.
            if (/^(From )?\$/.test(p.lead)) {
              assert.ok(
                !/(\$[\d,.]+|\d+%) off/.test(p.note ?? ''),
                `a discount claim beside a price: ${label} -> ${p.lead} / ${p.note}`,
              )
            }
            // Exactly one of the two ever renders, which is what lets a compact surface print
            // whichever is set without dropping information.
            assert.ok(
              !(p.savings && p.note),
              `savings and note together: ${label}`,
            )
            // "Free" with no condition is a promise the data never supports — every 100%-off row
            // is a membership benefit or hangs off a purchase.
            assert.ok(
              p.kind !== 'free' || /^Free with /.test(p.lead),
              `unconditional free: ${label} -> ${p.lead}`,
            )

            if (p.savings) {
              assert.ok(
                regular_price !== null && regular_price > 0,
                `savings with no regular_price: ${label}`,
              )
              assert.ok(
                discount_price !== null && regular_price > discount_price,
                `savings with no real comparison: ${label}`,
              )
              assert.ok(
                p.strikeThrough,
                `savings with nothing struck: ${label}`,
              )
              assert.ok(
                p.savings.percent > 0 && p.savings.percent <= 100,
                label,
              )
            }
            // A strikethrough without a saving would be a comparison we decline to name.
            assert.equal(Boolean(p.strikeThrough), Boolean(p.savings), label)

            assert.ok(!/\$0\b/.test(p.lead), `renders $0: ${label}`)
            assert.ok(!/\$0\b/.test(p.note ?? ''), `renders $0: ${label}`)
            for (const percent of `${p.lead} ${p.note ?? ''}`.matchAll(
              /(\d+)% off/g,
            )) {
              assert.ok(Number(percent[1]) <= 100, `percent over 100: ${label}`)
            }
            // Never both kinds of stated discount for one offer — they say different things.
            assert.ok(
              !(/% off/.test(p.lead) && /\$\d[\d,.]* off/.test(p.note ?? '')),
              `stacked a percentage on an amount: ${label}`,
            )
          }
        }
      }
    }
  }
})

test('a percentage over 100 is unusable, not printable', () => {
  // Nothing in the data does this today (max is exactly 100) and nothing should print "150% off"
  // if the pipeline starts. With no price to fall back on it reads as free, which 100%+ is.
  const p = pricingFor({ discount_percent: 150 })
  assert.equal(p.lead, 'Free with purchase')
  assert.ok(!p.lead.includes('150'))
})

test('the percentage is computed from the prices when none is stored', () => {
  assert.equal(
    offerToAnonymousDeal(offer({ regular_price: 100, discount_price: 50 }))
      .discountPercent,
    50,
  )
  assert.equal(
    offerToAnonymousDeal(offer({ regular_price: 199, discount_price: 149 }))
      .discountPercent,
    25,
    '(1 - 149/199) * 100 = 25.13, rounded',
  )
})

test('a non-discount never prints as a saving', () => {
  for (const prices of [
    { regular_price: 100, discount_price: 100 },
    { regular_price: 100, discount_price: 150 },
    { regular_price: null, discount_price: 150 },
    { regular_price: 100, discount_price: null },
    { regular_price: null, discount_price: null },
  ]) {
    assert.equal(
      offerToAnonymousDeal(offer(prices)).discountPercent,
      0,
      JSON.stringify(prices),
    )
  }
})

test('a zero regular_price cannot produce Infinity or NaN', () => {
  const deal = offerToAnonymousDeal(
    offer({ regular_price: 0, discount_price: 99 }),
  )
  assert.equal(deal.discountPercent, 0)
  assert.ok(Number.isFinite(deal.discountPercent))
})

test('dealPrice is the discount price or nothing — never the regular price', () => {
  // 23 offers carry a regular_price and no discount_price. `?? regular_price` printed that
  // price as the deal price with nothing struck through and no badge, so the card advertised
  // the undiscounted price as the offer — and published it to Google as the offer's price.
  const regularOnly = offerToAnonymousDeal(offer({ regular_price: 250 }))
  assert.equal(regularOnly.originalPrice, 250)
  assert.equal(
    regularOnly.dealPrice,
    0,
    'no discount_price means no price to lead with',
  )

  const discountOnly = offerToAnonymousDeal(offer({ discount_price: 199 }))
  assert.equal(discountOnly.originalPrice, 0)
  assert.equal(discountOnly.dealPrice, 199)

  const neither = offerToAnonymousDeal(offer({}))
  assert.equal(neither.originalPrice, 0)
  assert.equal(neither.dealPrice, 0)
})

test('discount_amount reaches the deal — 144 offers state their discount only that way', () => {
  assert.equal(
    offerToAnonymousDeal(offer({ discount_amount: 100 })).discountAmount,
    100,
  )
})

test('the two claim-weakening columns reach the deal', () => {
  // dealPricing() cannot soften what the adapter does not carry. `price_model` is compared to a
  // string exactly here — the column is plain text, not an enum, so a pipeline rename fails
  // silently and these are the assertions that would catch it.
  const membership = offerToAnonymousDeal(
    offer({ is_membership_required: true }),
  )
  assert.equal(membership.requiresMembership, true)
  assert.equal(
    offerToAnonymousDeal(offer({})).requiresMembership,
    false,
    'NULL is not "membership required"',
  )

  assert.equal(
    offerToAnonymousDeal(offer({ price_model: 'from' })).isFromPrice,
    true,
  )
  for (const price_model of ['total', 'per_unit']) {
    assert.equal(
      offerToAnonymousDeal(offer({ price_model })).isFromPrice,
      false,
      price_model,
    )
  }
})

/**
 * The price basis: what the figure buys.
 *
 * The card used to print `clinic_services.unit_type` after every price — the service's
 * vocabulary, not the offer's basis. On 2026-09-17, 201 of 497 priced offers read wrong: "40
 * Units Botox $299" as "$299 unit", "Lip Flip $79" as "$79 unit", and 131 real per-unit rates
 * whose service had no unit_type as a bare "$4.25". Every case below is a live row.
 */
test('a package states its count, and the divided-out unit price beside it', () => {
  // offer 7792 — the screenshot that started this: price_model total, 40 units, one item.
  const p = pricingFor({
    discount_price: 299,
    regular_price: 480,
    delivered_units: 40,
    offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
  })
  assert.equal(p.lead, '$299')
  assert.equal(p.basis, 'for 40 units')
  assert.equal(p.text, '$299 for 40 units')
  // 299 / 40 = 7.475 — rounded in cent space, not the $7.47 floating point would print.
  assert.equal(p.unitPrice, '$7.48 per unit')
  // Its $480 regular price appears nowhere in its own words, so there is no saving to state.
  assert.equal(p.strikeThrough, null)
  assert.equal(p.savings, null)

  const stated = pricingFor({
    discount_price: 299,
    regular_price: 480,
    delivered_units: 40,
    offer_raw_text: '40 Units Botox $299 (reg. $480)',
  })
  assert.deepEqual(
    stated.savings,
    { amount: '$181', percent: 38 },
    'the saving is on the package, and says nothing per unit',
  )

  // offer 10030: "buy 40 units and receive 10 additional free units" — 50 delivered.
  const bonus = pricingFor({
    discount_price: 540,
    delivered_units: 50,
    unit_type: null,
    offer_raw_text:
      '1st-Time Botox Special: buy 40 units and receive 10 additional free units — 50 units for $540',
  })
  assert.equal(bonus.text, '$540 for 50 units')
  assert.equal(bonus.unitPrice, '$10.80 per unit')

  // offer 7979-shaped: no service unit, and the text names the count's unit itself.
  const vials = pricingFor({
    discount_price: 1300,
    delivered_units: 2,
    unit_type: null,
    service_category: 'Regenerative Injectable',
    offer_raw_text: '2 vials of Sculptra $1,300',
  })
  assert.equal(vials.text, '$1,300 for 2 vials')

  // offer 8519: a count with no nameable unit stays a plain total rather than guessing one.
  const unnamed = pricingFor({
    discount_price: 2499,
    delivered_units: 3,
    unit_type: null,
    service_category: 'Microneedling',
    offer_raw_text: '3 Morpheus RF Microneedling Sessions $2499 (reg. $3000)',
  })
  assert.equal(unnamed.text, '$2,499')
  assert.equal(unnamed.unitPrice, null)
})

test('a per-unit rate names its unit — from the service, the text, or the category', () => {
  // offer 1339: per_unit, service unit_type NULL — rendered as a bare "$4.25" before.
  const dysport = pricingFor({
    discount_price: 4.25,
    regular_price: 4.75,
    price_model: 'per_unit',
    unit_type: null,
    offer_raw_text: 'Dysport $4.25 / unit (reg $4.75)',
  })
  assert.equal(dysport.text, '$4.25 per unit')
  assert.equal(dysport.unitPrice, null, 'a rate is already per unit')
  assert.deepEqual(dysport.savings, { amount: '$0.50 per unit', percent: 11 })

  // offer 1570 and 6905: the unit is only in the clinic's own words.
  const vial = pricingFor({
    discount_price: 765,
    price_model: 'per_unit',
    unit_type: null,
    service_category: 'Regenerative Injectable',
    offer_raw_text: 'Sculptra $850/vial / $765/vial',
  })
  assert.equal(vial.text, '$765 per vial')
  const syringe = pricingFor({
    discount_price: 599,
    price_model: 'per_unit',
    unit_type: null,
    service_category: 'Dermal Filler',
    offer_raw_text:
      'Versa Filler — $599 per syringe; valid through September 30, 2026.',
  })
  assert.equal(syringe.text, '$599 per syringe')

  // Neurotoxins are dosed in units even when nothing says so ("$10.50 Dysport unit").
  const toxin = pricingFor({
    discount_price: 9,
    price_model: 'per_unit',
    unit_type: null,
    offer_raw_text: 'Tox Regulars — Jeuveau $9',
  })
  assert.equal(toxin.text, '$9 per unit')

  // Nothing names it: "each" is true of any rate; "per unit" would not be.
  const unknown = pricingFor({
    discount_price: 499,
    price_model: 'per_unit',
    unit_type: null,
    service_category: 'Regenerative Injectable',
    offer_raw_text: 'PRF special $499',
  })
  assert.equal(unknown.text, '$499 each')
})

test('a flat price or a bundle states no basis at all', () => {
  // offer 7751 "Lip Flip $79" — unit_type 'unit' on the service, "$79 unit" on the card.
  const lipFlip = pricingFor({
    discount_price: 79,
    regular_price: 135,
    delivered_units: 1,
    offer_raw_text: 'Lip Flip sale price $79.00; regular price $135.00',
  })
  assert.equal(lipFlip.text, '$79')
  assert.equal(lipFlip.basis, null)

  // offer 8279: four items, the representative one 50 units of Jeuveau. $1,499 is not the
  // price of 50 units, so no count and no per-unit figure.
  const bundle = pricingFor({
    discount_price: 1499,
    regular_price: 2125,
    delivered_units: 50,
    item_count: 4,
    offer_raw_text:
      'Timeless Beauty Package: $1,499 (normal value $2,125; savings $626). Includes 50 units of Jeuveau',
  })
  assert.equal(bundle.text, '$1,499')
  assert.equal(bundle.unitPrice, null)
})

test('per_unit with a stated count is a quantity: the stored price is the total', () => {
  // The pipeline's column comment: discount_price is always the normalized TOTAL, unit price ×
  // delivered_units. Offer 7649: "$9/unit", 50 units, discount_price $450 — not "$450 per unit".
  const p = pricingFor({
    discount_price: 450,
    price_model: 'per_unit',
    delivered_units: 50,
    offer_raw_text: 'Our 50-unit Xeomin bundle is $450 (just $9.00/unit)',
  })
  assert.equal(p.text, '$450 for 50 units')
  assert.equal(p.unitPrice, '$9 per unit')
})

test('a "from" floor keeps both the floor and the rate', () => {
  // offer 7718 — price_model cannot say "from" and "per unit" at once; the text does.
  const p = pricingFor({
    discount_price: 9,
    price_model: 'from',
    unit_type: null,
    offer_raw_text: 'New Patient tox Starts at $9 per unit',
  })
  assert.equal(p.text, 'From $9 per unit')
  const flat = pricingFor({
    discount_price: 50,
    price_model: 'from',
    unit_type: null,
    service_category: 'Laser Hair Removal',
    offer_raw_text: 'Laser Hair Removal as Low as $50',
  })
  assert.equal(
    flat.text,
    'From $50',
    'a floor with no stated rate is a flat floor',
  )
})

test('a "total" row is never overridden from its text', () => {
  // "Botox: 30% off at $9.45/unit; 20 units $189 vs $270" — the $189 is the package.
  const p = pricingFor({
    discount_price: 189,
    delivered_units: 20,
    offer_raw_text:
      'Botox: 30% off at $9.45/unit; 20 units $189 vs $270 regular.',
  })
  assert.equal(p.text, '$189 for 20 units')
  assert.equal(p.unitPrice, '$9.45 per unit')
})

test('non-price leads never carry a basis', () => {
  for (const shape of [
    { discount_percent: 20, price_model: 'per_unit' },
    { discount_amount: 100, delivered_units: 40 },
    { discount_price: 0, discount_percent: 100, delivered_units: 30 },
    {},
  ]) {
    const p = pricingFor(shape)
    assert.equal(p.basis, null, JSON.stringify(shape))
    assert.equal(p.unitPrice, null, JSON.stringify(shape))
    assert.equal(p.text, p.lead, JSON.stringify(shape))
  }
})

test('neurotoxins compare per unit; everything else on what you pay', () => {
  const deal = (prices: Parameters<typeof offer>[0]) =>
    offerToAnonymousDeal(offer(prices))

  const rate = deal({ discount_price: 10, price_model: 'per_unit' })
  const pack = deal({ discount_price: 299, delivered_units: 40 })
  assert.deepEqual(comparablePrice(rate), {
    amount: 10,
    perUnit: true,
    brand: 'Botox',
  })
  assert.deepEqual(comparablePrice(pack), {
    amount: 7.48,
    perUnit: true,
    brand: 'Botox',
  })
  assert.ok(
    (comparablePrice(pack)?.amount ?? 0) < (comparablePrice(rate)?.amount ?? 0),
    '40 units for $299 is cheaper per unit than $10/unit — the printed figures say the opposite',
  )

  // A neurotoxin with no per-unit figure is not comparable, not "$79 per unit".
  assert.equal(
    comparablePrice(deal({ discount_price: 79, delivered_units: 1 })),
    null,
  )
  // Offer 8509: "$50 off… reg $3.75/unit" stored as a $400 rate.
  assert.equal(
    comparablePrice(deal({ discount_price: 400, price_model: 'per_unit' })),
    null,
  )
  assert.equal(comparablePrice(deal({ discount_percent: 20 })), null)

  const filler = { unit_type: null, service_category: 'Dermal Filler' as const }
  assert.deepEqual(
    comparablePrice(
      deal({
        ...filler,
        discount_price: 599,
        price_model: 'per_unit',
        offer_raw_text: '$599 per syringe',
      }),
    ),
    { amount: 599, perUnit: false },
    'one syringe is a purchase',
  )
  assert.equal(
    comparablePrice(
      deal({
        ...filler,
        discount_price: 14,
        price_model: 'per_unit',
        offer_raw_text: '$14/UNIT filler',
      }),
    ),
    null,
    'one unit of filler is not',
  )
  assert.deepEqual(
    comparablePrice(
      deal({
        ...filler,
        discount_price: 1500,
        delivered_units: 2,
        offer_raw_text: '2 syringes $1,500',
      }),
    ),
    { amount: 1500, perUnit: false },
  )

  assert.deepEqual(perUnitPrice(pack), { amount: 7.48, unit: 'unit' })
  assert.equal(
    perUnitPrice(deal({ discount_price: 79, delivered_units: 1 })),
    null,
  )
})

test('a total whose own text states that exact price as a rate is a rate', () => {
  // offers 7930 and 9842: stored `total`, printed as a bare "$10.50" / "$12", and 9842 was
  // setting Newport Beach's "from $12" minimum.
  for (const [discount_price, offer_raw_text, text] of [
    [10.5, '$10.50 a unit for neurotoxins', '$10.50 per unit'],
    [8, '$8 a unit Botox unlimited', '$8 per unit'],
    [1499, 'Morpheus8 $1,499 per session', '$1,499 per session'],
  ] as const) {
    const p = pricingFor({ discount_price, offer_raw_text, unit_type: null })
    assert.equal(p.text, text, offer_raw_text)
  }
  // A different figure stated as a rate does not convert the stored total.
  const pack = pricingFor({
    discount_price: 189,
    unit_type: null,
    offer_raw_text: 'Botox: 30% off at $9.45/unit; $189 special',
  })
  assert.equal(pack.text, '$189')
  // "$10.500" or "$105" are not "$10.50" — so this text does not state the stored price at all,
  // and it is not printed (priceIsStated).
  assert.equal(
    pricingFor({
      discount_price: 10.5,
      unit_type: null,
      offer_raw_text: 'now $105/unit',
    }).text,
    'Contact for pricing',
  )
})

test('a neurotoxin "rate" no neurotoxin costs is not published as a price', () => {
  // offer 8509: "$50 Off with Aspire Rewards (Reg. $3.75/unit. Minimum 120 units)", stored as a
  // $400 rate with a $450 regular. It printed "$400 per unit" in its title and JSON-LD.
  const deal = offerToAnonymousDeal(
    offer({
      discount_price: 400,
      regular_price: 450,
      discount_amount: 50,
      price_model: 'per_unit',
      unit_type: null,
      offer_raw_text:
        '$50 Off with Aspire Rewards (Reg. $3.75/unit. Minimum 120 units)',
    }),
  )
  assert.equal(deal.dealPrice, 0)
  assert.equal(deal.originalPrice, 0)
  const p = dealPricing(deal)
  assert.notEqual(p.kind, 'price')
  assert.ok(!/\$400/.test(p.text), p.text)
  assert.equal(comparablePrice(deal), null)
  // A plausible rate is untouched.
  assert.equal(
    offerToAnonymousDeal(offer({ discount_price: 12, price_model: 'per_unit' }))
      .dealPrice,
    12,
  )
})

// --- A price the clinic never published is never printed --------------------------------------
// The four rows `npm run prices:check` flagged new on 2026-09-23, with their live columns and
// their own words. Each stored price is the pipeline's arithmetic; none appears in the text.

test('1386: "20% off" with a computed $10.40 a unit leads with the 20% and ranks nowhere', () => {
  const row = offer({
    price_model: 'per_unit',
    discount_price: 10.4,
    regular_price: 13,
    discount_percent: 20,
    discount_amount: 2.6,
    delivered_units: 1,
    offer_raw_text:
      'Botox Injection 20% off from regular price for first time patient.',
  })
  const deal = offerToAnonymousDeal(row)
  const p = dealPricing(deal)
  assert.equal(p.text, '20% off')
  // The $13 regular is a service-menu figure this text never states; with no unit it would
  // read as a $13 treatment.
  assert.equal(p.note, null)
  assert.equal(comparablePrice(deal), null)
})

test('7122: a package "from $825 … 225 units save $75" leads with the stated $75', () => {
  const deal = offerToAnonymousDeal(
    offer({
      price_model: 'from',
      discount_price: 750,
      regular_price: 825,
      discount_percent: 9.09,
      discount_amount: 75,
      delivered_units: 225,
      offer_raw_text:
        'Dysport Buy & Bank Package from $825.00; 450 units save $300; 225 units save $75.',
    }),
  )
  const p = dealPricing(deal)
  // Not "9% off": that is the pipeline's 75 ÷ 825, a figure the clinic never wrote.
  assert.equal(p.lead, '$75 off')
  assert.equal(p.note, 'Regularly $825')
  assert.equal(comparablePrice(deal), null)
})

test('8788: "Chemical Peels (regularly $350)" prints no $332.50', () => {
  const p = pricingFor({
    discount_price: 332.5,
    regular_price: 350,
    discount_percent: 5,
    discount_amount: 17.5,
    is_membership_required: true,
    service_category: 'Facial',
    unit_type: 'session',
    offer_raw_text: 'Chemical Peels (regularly $350)',
  })
  assert.equal(p.kind, 'discount')
  assert.equal(p.text, '5% off for members')
  assert.equal(p.note, 'Regularly $350')
  assert.ok(!JSON.stringify(p).includes('332'))
})

test('8800: "10% OFF SkinVive (regularly $450)" reads 10% off, regularly $450 — never $405', () => {
  const p = pricingFor({
    discount_price: 405,
    regular_price: 450,
    discount_percent: 10,
    discount_amount: 45,
    is_membership_required: true,
    service_category: 'Dermal Filler',
    unit_type: 'syringe',
    offer_raw_text: '10% OFF SkinVive (regularly $450)',
  })
  assert.equal(p.lead, '10% off')
  assert.equal(p.note, 'Regularly $450')
  assert.ok(!JSON.stringify(p).includes('405'))
})

test('a stated price still prints — the rule drops only what the text never says', () => {
  const p = pricingFor({
    discount_price: 299,
    regular_price: 480,
    delivered_units: 40,
    offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
  })
  assert.equal(p.text, '$299 for 40 units')
  // An owner-typed deal has no items: the owner stated the price in a field, not in the text.
  assert.equal(
    pricingFor({
      discount_price: 150,
      item_count: 0,
      offer_raw_text: 'Spring facial special',
    }).lead,
    '$150',
  )
})

// --- A regular price the clinic never wrote is never printed (trust item 5) ---------------------
// 114 of the 292 visible offers carrying a regular_price did not state it on 2026-09-28, and 99 of
// them printed a strike-through and a "Save X%" against it.

test('a regular price the text never states: no strike-through, no saving, no "Regularly"', () => {
  const priced = offerToAnonymousDeal(
    offer({
      discount_price: 10,
      regular_price: 12,
      price_model: 'per_unit',
      offer_raw_text: 'New Client Botox $10/unit',
    }),
  )
  assert.equal(priced.originalPrice, 0, 'offer 1375')
  assert.equal(dealPricing(priced).strikeThrough, null)
  assert.equal(dealPricing(priced).savings, null)

  const percent = pricingFor({
    discount_percent: 20,
    regular_price: 300,
    offer_raw_text: '20% off facials',
  })
  assert.equal(percent.lead, '20% off')
  assert.equal(percent.note, null)

  const free = pricingFor({
    discount_price: 0,
    discount_percent: 100,
    regular_price: 100,
    offer_raw_text: 'Free facial with any Botox treatment',
  })
  assert.equal(free.note, null, 'no "$100 value" the offer does not state')
})

test('an owner-typed deal keeps its regular price: the owner stated it in a field', () => {
  const deal = offerToAnonymousDeal(
    offer({
      discount_price: 150,
      regular_price: 200,
      item_count: 0,
      offer_raw_text: 'Spring facial special',
    }),
  )
  assert.equal(deal.originalPrice, 200)
  assert.deepEqual(dealPricing(deal).savings, { amount: '$50', percent: 25 })
})

test('discountPercent is never the pipeline’s division by a regular price it withholds', () => {
  // Offer 7792: 37.7% is 299 ÷ an unstated $480.
  const unstated = offerToAnonymousDeal(
    offer({
      discount_price: 299,
      regular_price: 480,
      discount_percent: 37.7,
      delivered_units: 40,
      offer_raw_text: '40 Units Botox! Limited Time Offer Only $299',
    }),
  )
  assert.equal(unstated.discountPercent, 0)
  // A percent the offer states survives whatever its regular price.
  assert.equal(
    offerToAnonymousDeal(
      offer({
        discount_price: 10.4,
        regular_price: 13,
        discount_percent: 20,
        price_model: 'per_unit',
        offer_raw_text: 'Botox Injection 20% off from regular price',
      }),
    ).discountPercent,
    20,
    'offer 1386',
  )
  // Nor is one derived from two prices when either is withheld.
  assert.equal(
    offerToAnonymousDeal(
      offer({
        discount_price: 299,
        regular_price: 480,
        offer_raw_text: 'Botox $299',
      }),
    ).discountPercent,
    0,
  )
})

test('an included treatment stays free when its regular price is unstated — never "$125 off"', () => {
  // Offer 10159: 100% off an unstated $125. Dropping the percent with the regular price turned
  // "Free" into "$125 off", the withheld regular price printed as a discount.
  const free = pricingFor({
    discount_price: 0,
    regular_price: 125,
    discount_percent: 100,
    discount_amount: 125,
    is_membership_required: true,
    offer_raw_text: 'Free Lunchtime Peel every quarter',
  })
  assert.equal(free.lead, 'Free with membership')
  assert.equal(free.note, null, 'the unstated $125 is no "value" either')
  // Nor does an amount derived from a withheld regular price lead once the price is dropped too.
  const derived = pricingFor({
    discount_price: 460,
    regular_price: 560,
    discount_amount: 100,
    discount_percent: 17.86,
    offer_raw_text: 'Botox special for new patients',
  })
  assert.equal(derived.kind, 'none')
  // An amount the offer states still leads.
  assert.equal(
    pricingFor({
      discount_price: 460,
      regular_price: 560,
      discount_amount: 100,
      offer_raw_text: '$100 off 40+ units of Botox',
    }).lead,
    '$100 off',
  )
})

test('the Offer JSON-LD publishes no list price the clinic never wrote', () => {
  const schemaFor = (offer_raw_text: string) => {
    const deal = offerToAnonymousDeal(
      offer({ discount_price: 299, regular_price: 480, offer_raw_text }),
    )
    return JSON.stringify(
      buildDealOfferSchema({
        ...deal,
        category: null,
        validUntil: deal.validUntil || undefined,
      }),
    )
  }
  assert.ok(!schemaFor('Botox package $299').includes('ListPrice'))
  assert.ok(!schemaFor('Botox package $299').includes('480'))
  assert.ok(schemaFor('Botox package $299 (reg. $480)').includes('ListPrice'))
})

// --- Membership ---------------------------------------------------------------------------------

test('a member-only price says "for members"; "Free with membership" already does', () => {
  // 455 of 947 live deals needed a paid plan (2026-09-23) and the card said nothing.
  assert.equal(
    pricingFor({
      discount_price: 10,
      price_model: 'per_unit',
      is_membership_required: true,
      offer_raw_text: 'Members: Botox $10/unit',
    }).text,
    '$10 per unit for members',
  )
  assert.equal(
    pricingFor({
      discount_percent: 20,
      is_membership_required: true,
      offer_raw_text: '20% off facials',
    }).text,
    '20% off for members',
  )
  assert.equal(
    pricingFor({
      discount_percent: 100,
      is_membership_required: true,
      offer_raw_text: 'Free monthly facial',
    }).text,
    'Free with membership',
  )
})

test('the membership term never names the plan', () => {
  const deal = offerToAnonymousDeal({
    ...offer({ is_membership_required: true }),
    membership_name: 'TOX Membership',
  })
  // Was "Requires a TOX Membership membership.", then "Membership required: TOX Membership.".
  // A plan's name identifies the clinic, so it waits for a claim (owner decision, 2026-09-28).
  assert.equal(deal.termsAndConditions, 'Membership required.')
})

test('a zero price never prints "$0" and never sits beside a 100% off', () => {
  // 66 live rows have discount_price = 0, all 100% off; 15 carry the stated value too.
  const p = pricingFor({
    discount_price: 0,
    discount_percent: 100,
    discount_amount: 75,
    regular_price: 75,
    is_membership_required: true,
    offer_raw_text:
      'Free Dermaplaning ($75 value) with any Hydrafacial MD treatment',
  })
  assert.equal(p.lead, 'Free with membership')
  assert.equal(p.note, '$75 value')
  assert.equal(p.strikeThrough, null)
  assert.ok(!/\$0(?!\d)/.test(JSON.stringify(p)))
})

// --- Titles and brands ---------------------------------------------------------------------------

test("a bare product title gets the offer's own words underneath; a specific one does not", () => {
  assert.equal(
    offerSubtitle('Neurotoxin', 'Bunny Lines TOX - $99 (regular $135)'),
    'Bunny Lines TOX - $99 (regular $135)',
  )
  assert.equal(
    offerSubtitle('DYSPORT', 'DYSPORT $3.15/UNIT'),
    'Dysport $3.15/unit',
  )
  assert.equal(offerSubtitle('Botox', 'Botox'), null, 'adds nothing')
  assert.equal(offerSubtitle('Naked Lips Special', 'Lip filler $149'), null)
  // Whole, price included: the row's two-line clamp trims it, not a 90-character slice.
  const neckBand =
    'Neck Band TOX - $499 (regular $599); treatment includes 30-40 units of neurotoxin across the platysma bands'
  assert.equal(offerSubtitle('Neurotoxin', neckBand), neckBand)
  const long = offerSubtitle('Neurotoxin', `${neckBand}; ${neckBand}`)
  assert.ok(
    long && long.length <= 201 && long.length > 150 && long.endsWith('…'),
    long ?? '',
  )
})

test('the line under the headline names the product whenever the title says more than the treatment', () => {
  const line = (
    title: string,
    subtitle: string | null,
    treatment: TreatmentCategory = 'botox',
  ) => productLine({ title, subtitle, treatment })
  // The words lead and omit the brand: the title keeps it.
  assert.equal(line('Botox', 'Forehead lines special $199'), 'Botox')
  assert.equal(
    line('BBL Photofacial', '$299 for one session', 'laser'),
    'BBL Photofacial',
  )
  assert.equal(
    line('Microneedling', 'Three sessions for $600', 'skincare'),
    'Microneedling',
  )
  // A title that only restates the treatment gives way to its label.
  assert.equal(line('Neurotoxin', 'Bunny lines $99'), 'Neurotoxins')
  assert.equal(line('dermal filler', 'Lips $499', 'fillers'), 'Fillers')
  // No subtitle: the title is the headline, so the line is the treatment.
  assert.equal(line('Glow Package', null, 'facials'), 'Facials')
  // No treatment: the title where the words lead, else nothing.
  assert.equal(
    productLine({ title: 'Botox', subtitle: '10% off', treatment: null }),
    'Botox',
  )
  assert.equal(
    productLine({ title: 'Gift card', subtitle: null, treatment: null }),
    null,
  )
  // A clinic-wide discount is not a deal on the one service the pipeline linked it to.
  assert.equal(
    productLine({
      title: 'Botox',
      subtitle: 'Complimentary consultation & 10% off first treatment',
      treatment: null,
      clinicWide: true,
    }),
    null,
  )
})

test('the neurotoxin brand comes from the title, then from text naming exactly one', () => {
  assert.equal(neurotoxinBrand('Botox', 'Botox $10/unit'), 'Botox')
  assert.equal(neurotoxinBrand('Neurotoxin', 'DYSPORT $3.15/UNIT'), 'Dysport')
  assert.equal(
    neurotoxinBrand(
      'Neurotoxin',
      '20% off Botox / Dysport ($11.20 Botox, $3.72 Dysport)',
    ),
    null,
    'two brands name none',
  )
  assert.equal(neurotoxinBrand('Neurotoxin', 'Tox special'), null)
})
