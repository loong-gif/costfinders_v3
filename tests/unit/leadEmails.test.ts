/**
 * The two lead emails that carry contact details: the ops notice our team relays from, and the
 * customer's "we passed your request" note. (The claim confirmation is pinned in
 * emailCompliance.test.ts; the owner's "New lead" email, which must carry no customer contact
 * details, in ownerTemplates.test.ts.)
 *
 * The ops notice is driven through the real sendEmail() with fetch stubbed, so what is checked is
 * the payload Resend would receive: recipient, subject and body. Without a request scope the
 * opt-out lookup cannot read a session and fails open, which is also what production does when
 * that lookup fails. Nothing leaves the process.
 *
 * Los Angeles, as in revealLinks.test.ts: the preferred date must not print a day early.
 */
process.env.TZ = 'America/Los_Angeles'

import { strict as assert } from 'node:assert'
import { before, test } from 'node:test'
import { isEssentialEmail } from '@/lib/email/optOut'
import { getSiteOrigin } from '@/lib/siteUrl'
import type { ClaimClinic } from '@/types/claim'

type OpsModule = typeof import('@/lib/email/claimNotification')
type AdminModule = typeof import('@/lib/email/adminTemplates')
let sendClaimNotificationEmail: OpsModule['sendClaimNotificationEmail']
let leadRelayedEmail: AdminModule['leadRelayedEmail']

const OPS_INBOX = process.env.CLAIM_NOTIFICATION_EMAIL ?? 'leads@costfinders.ai'

interface ResendCall {
  to: string[]
  subject: string
  html: string
}
const sent: ResendCall[] = []

before(async () => {
  // send.ts reads the key when it loads.
  process.env.RESEND_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://stub.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'stub-anon-key'
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init?.body)) as ResendCall)
      return new Response('{"id":"test"}', { status: 200 })
    }
    throw new Error(`unexpected fetch in test: ${String(input)}`)
  }
  sendClaimNotificationEmail = (await import('@/lib/email/claimNotification'))
    .sendClaimNotificationEmail
  leadRelayedEmail = (await import('@/lib/email/adminTemplates'))
    .leadRelayedEmail
})

const CLINIC: ClaimClinic = {
  name: 'Dream Med Spa',
  address: '6360 N Campbell Ave, Tucson, AZ 85718',
  city: 'Tucson',
  phone: '+15205550123',
  website: 'https://dreammedspa.com/?utm_source=gmb',
  rating: 4.8,
  review_count: 161,
  google_place_id: null,
}

test('the ops lead notice reaches the ops inbox with what a relay needs', async () => {
  sent.length = 0
  const result = await sendClaimNotificationEmail({
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '(520) 555-0199',
    dealTitle: '20 units of Botox',
    priceLabel: '$10 per unit',
    clinic: CLINIC,
    preferredDate: '2026-10-02',
    preferredTime: 'afternoon',
    notes: '<script>alert(1)</script> Ask for Jo',
    relayBy: '2026-10-09T17:00:00Z',
  })

  assert.equal(result.success, true)
  assert.equal(sent.length, 1)
  const [mail] = sent
  assert.deepEqual(mail.to, [OPS_INBOX])

  // isEssentialEmail() matches on this prefix: an opt-out on the ops address must never
  // swallow a lead.
  assert.equal(
    mail.subject,
    'New claim: 20 units of Botox at Dream Med Spa (Tucson)',
  )
  assert.equal(isEssentialEmail(mail.subject), true)

  const { html } = mail
  assert.ok(html.includes(`href="${getSiteOrigin()}/admin/dashboard/leads"`))
  // The customer, so the relay can happen at all.
  assert.ok(html.includes('Ada Lovelace'))
  assert.ok(html.includes('(520) 555-0199'))
  assert.ok(html.includes('ada@example.com'))
  // The clinic, as the customer was shown it.
  assert.ok(html.includes('(520) 555-0123'))
  assert.ok(html.includes('href="https://dreammedspa.com/"'))
  assert.ok(html.includes('google.com/maps/search'))
  assert.ok(html.includes('$10 per unit'))
  // The day they picked, not the day before.
  assert.ok(html.includes('Oct 2, 2026'))
  // The customer's own text is escaped.
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('the ops notice still goes out when the clinic lookup failed', async () => {
  sent.length = 0
  await sendClaimNotificationEmail({
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '(520) 555-0199',
    dealTitle: 'Lip filler',
    clinic: null,
    relayBy: '2026-10-09T17:00:00Z',
  })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].subject, 'New claim: Lip filler at an unknown clinic')
  assert.ok(sent[0].html.includes('Not found — check the lead'))
  assert.ok(sent[0].html.includes('(520) 555-0199'))
})

test('"we passed your request" says what we sent and how to reach the clinic', () => {
  const { subject, html } = leadRelayedEmail({
    consumerName: 'Ada',
    clinicName: 'Dream Med Spa',
    dealTitle: '<b>20 units of Botox</b>',
    preferredDate: '2026-10-02',
    preferredTime: 'afternoon',
    notes: 'Ask for Jo',
    clinicPhone: '+15205550123',
    clinicWebsite: 'https://dreammedspa.com/?utm_source=gmb',
  })
  assert.equal(subject, 'We passed your request to Dream Med Spa')
  assert.ok(html.includes('Hi Ada,'))
  assert.ok(html.includes('Oct 2, 2026, afternoon'))
  assert.ok(html.includes('&lt;b&gt;20 units of Botox&lt;/b&gt;'))
  assert.ok(html.includes('href="tel:+15205550123"'))
  assert.ok(html.includes('(520) 555-0123'))
  assert.ok(html.includes('href="https://dreammedspa.com/"'))
  assert.ok(html.includes('/dashboard/claims'))
})

test('"we passed your request" without clinic contacts points to the claims page', () => {
  const { html } = leadRelayedEmail({
    consumerName: null,
    clinicName: 'Dream Med Spa',
    dealTitle: null,
    preferredDate: null,
    preferredTime: null,
    notes: null,
    clinicPhone: null,
    clinicWebsite: null,
  })
  assert.ok(html.includes('Hi there,'))
  assert.ok(html.includes('Their details are on your claims page.'))
  assert.ok(!/tel:|When you'd like to come in/.test(html))
})

test('"we passed your request" promises nothing on the clinic\'s behalf', () => {
  // We pass the request on; whether and when the clinic replies is not ours to promise.
  const BANNED = ['will contact you', "they'll contact you"]
  for (const clinicPhone of ['+15205550123', null]) {
    const { subject, html } = leadRelayedEmail({
      consumerName: 'Ada',
      clinicName: 'Dream Med Spa',
      dealTitle: '20 units of Botox',
      preferredDate: null,
      preferredTime: null,
      notes: null,
      clinicPhone,
      clinicWebsite: null,
    })
    // Curly and entity apostrophes read the same to the customer.
    const text = `${subject} ${html}`
      .toLowerCase()
      .replace(/&rsquo;|&#39;|&#x27;|’/g, "'")
    for (const phrase of BANNED) {
      assert.equal(text.includes(phrase), false, `contains "${phrase}"`)
    }
  }
})

test('receipts and ops mail skip the opt-out; alerts do not', async () => {
  const { isEssentialSend } = await import('@/lib/email/send')
  // The claim confirmation and the inbound forward pass the flag.
  assert.equal(isEssentialSend('Your claim: 20 units of Botox', true), true)
  assert.equal(isEssentialSend('Fwd: question about my claim', true), true)
  // The ops lead notice relies on its subject.
  assert.equal(isEssentialSend('New claim: Botox at Dream Med Spa'), true)
  // An ordinary alert respects the opt-out.
  assert.equal(
    isEssentialSend('Your deal has been approved — Lip filler'),
    false,
  )
  assert.equal(isEssentialSend('New lead: 20 units of Botox', false), false)
})
