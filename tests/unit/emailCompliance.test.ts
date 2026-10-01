/**
 * Guards on the email footer and the claim-confirmation copy.
 *
 * Two silent-regression classes live here, both of which have already bitten this project:
 *
 *   1. An invented commitment creeping back into shipped copy. The claim confirmation used
 *      to tell every claimant "The business will be notified of your interest" and "You'll
 *      hear back within 1-2 business days". Neither was implemented — no email fires to a
 *      business owner on a new claim, and delivery depends on an admin opening
 *      /admin/dashboard/leads inside the 7-day claims.expires_at window. RULES.md forbids
 *      exactly this, and prose has no typechecker, so it gets one here.
 *
 *   2. The unsubscribe substitution target drifting. `sendEmail()` swaps the literal
 *      `<origin>/unsubscribe` in the rendered HTML for the recipient's tokenised
 *      one-click URL. If this footer's href ever changes shape, that replace silently
 *      stops matching and every email ships an untokenised opt-out link with no error
 *      anywhere — the same "green build, broken behaviour" shape as the column drift.
 *
 * Pure string assertions only: templates.ts imports nothing but `@/lib/siteUrl`, so this
 * runs under `tsx --test` with no Next request context.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  buildEmailHtml,
  COMPANY_POSTAL_ADDRESS,
  claimConfirmationEmail,
} from '@/lib/email/templates'
import { getSiteOrigin } from '@/lib/siteUrl'

/** Phrases that assert something the product does not do. */
const FORBIDDEN_PROMISES = [
  'will be notified',
  'business days',
  'hear back within',
  'guaranteed',
  'within 24 hours',
  // No clinic has an account at launch and nothing reaches one automatically; our team relays
  // each claim by hand. The customer must never be told to wait for the clinic.
  'will contact you',
  'contacts you directly',
  'message them',
  // The reveal no longer expires, so nothing may say it lasts a week.
  '7 days',
]

const CLINIC = {
  name: 'Dream Med Spa',
  address: '6360 N Campbell Ave, Tucson, AZ 85718',
  city: 'Tucson',
  phone: '+15205550123',
  website: 'https://dreammedspa.com/?utm_source=gmb',
  rating: 4.8,
  review_count: 161,
  google_place_id: null,
}

const confirmation = (clinic: typeof CLINIC | null = CLINIC) =>
  claimConfirmationEmail({
    firstName: 'Ada',
    dealTitle: '20 units of Botox',
    priceLabel: '$10 per unit',
    clinic,
  })

test('claim confirmation promises nothing the product does not do', () => {
  for (const clinic of [CLINIC, null]) {
    const text = confirmation(clinic).html.toLowerCase()
    for (const phrase of FORBIDDEN_PROMISES) {
      assert.equal(
        text.includes(phrase),
        false,
        `claim confirmation contains an unimplemented commitment: "${phrase}"`,
      )
    }
  }
})

test('claim confirmation tells the customer to contact the clinic themselves', () => {
  const { html } = confirmation()
  assert.ok(html.includes('Call or book with the clinic directly'))
  assert.ok(html.includes('mention the CostFinders price'))
  assert.ok(html.includes('Our team also passes your request on'))
  assert.ok(html.includes('stay on your claims page'))
})

test('claim confirmation carries the clinic the claim revealed', () => {
  const { html } = confirmation()
  assert.ok(html.includes('Dream Med Spa'))
  assert.ok(html.includes('href="tel:+15205550123"'))
  assert.ok(html.includes('(520) 555-0123'))
  // Tracking codes stripped, city printed once.
  assert.ok(html.includes('href="https://dreammedspa.com/"'))
  assert.equal(html.includes('85718, Tucson'), false)
  assert.ok(html.includes('google.com/maps/search'))
  assert.ok(html.includes('Hi Ada,'))
})

test('claim confirmation greets "there" when no name is on file', () => {
  const { html } = claimConfirmationEmail({
    dealTitle: 'Botox',
    clinic: CLINIC,
  })
  assert.ok(html.includes('Hi there,'))
})

test('footer carries the exact unsubscribe URL sendEmail substitutes on', () => {
  const html = buildEmailHtml({ title: 'Test', bodyHtml: '<p>Body</p>' })
  const target = `${getSiteOrigin()}/unsubscribe`

  assert.ok(
    html.includes(`href="${target}"`),
    `footer must contain href="${target}" verbatim — that literal is what sendEmail() replaces with the tokenised one-click link`,
  )
  // Exactly once: a second occurrence would leave one link untokenised after the swap.
  assert.equal(html.split(`href="${target}"`).length - 1, 1)
})

test('footer says why the recipient got the mail', () => {
  const html = buildEmailHtml({ title: 'Test', bodyHtml: '<p>Body</p>' })
  assert.ok(html.includes('because you have a CostFinders account'))
})

test('no unfilled company placeholder ever reaches a recipient', () => {
  const html = buildEmailHtml({ title: 'Test', bodyHtml: '<p>Body</p>' })
  // COMPANY_POSTAL_ADDRESS is owner-blocked and empty. The footer must omit the line
  // rather than render a bracketed placeholder into real inboxes.
  assert.equal(html.includes('['), false)
  if (COMPANY_POSTAL_ADDRESS === '') {
    assert.equal(
      html.includes('CostFinders &mdash; Compare MedSpa Prices'),
      true,
    )
  } else {
    assert.ok(html.includes(COMPANY_POSTAL_ADDRESS))
  }
})

/**
 * The opt-out exemption is matched on the subject line, so the live subjects have to be
 * pinned somewhere. Rename one of these at its call site and this fails, rather than the
 * business-claim funnel going quietly dead for anyone who unsubscribed.
 */
test('essential mail is exempt from the email opt-out', async () => {
  const { isEssentialEmail } = await import('@/lib/email/optOut')

  // Verbatim from src/lib/actions/business-verification.ts (the sendEmail call there).
  assert.equal(isEssentialEmail('Your CostFinders verification code'), true)

  // Verbatim shape from src/lib/email/claimNotification.ts. Ops mail to a fixed operator
  // inbox, not to a subscriber — it goes through sendEmail() like everything else, so if this
  // exemption stops matching, leads go quietly missing whenever that address also happens to
  // hold a consumer account with notifications switched off.
  assert.equal(
    isEssentialEmail('New Claim: 20 units of Botox — Dream Med Spa (Tucson)'),
    true,
  )

  // The five templates the notification toggle legitimately covers.
  assert.equal(
    isEssentialEmail('Your claim has been submitted — 20 units of Botox'),
    false,
  )
  assert.equal(
    isEssentialEmail('Your business claim has been approved — Dream Med Spa'),
    false,
  )
  assert.equal(
    isEssentialEmail('Your deal has been approved — Lip filler'),
    false,
  )
})
