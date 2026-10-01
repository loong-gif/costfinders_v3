/**
 * The two owner emails: the preferred date must not shift a day, and neither email may carry
 * the customer's contact details, which sit behind "Mark Contacted" on the lead page.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { newLeadEmail, newMessageEmail } from '@/lib/email/ownerTemplates'

test('new lead email: subject, calendar date as picked, link to the lead', () => {
  const { subject, html } = newLeadEmail({
    claimId: 'abc-123',
    dealTitle: '20 units of Botox',
    preferredDate: '2026-10-02',
    preferredTime: 'afternoon',
  })
  assert.equal(subject, 'New lead: 20 units of Botox')
  // 2 October 2026 is a Friday. new Date('2026-10-02') renders it as Thursday, October 1
  // anywhere west of Greenwich — the bug the owner and admin screens had.
  assert.ok(html.includes('Friday, October 2, afternoon'))
  assert.ok(html.includes('/business/dashboard/leads/abc-123'))
})

test('new lead email without a preference says so', () => {
  const { html } = newLeadEmail({
    claimId: 'x',
    dealTitle: 'Lip filler',
    preferredDate: null,
    preferredTime: null,
  })
  assert.ok(html.includes('did not give a preferred date or time'))
})

test('owner emails escape the deal title and carry no contact fields', () => {
  const lead = newLeadEmail({
    claimId: 'x',
    dealTitle: '<b>Botox</b>',
    preferredDate: null,
    preferredTime: null,
  })
  const message = newMessageEmail({ claimId: 'x', dealTitle: null })
  assert.ok(!lead.html.includes('<b>Botox</b>'))
  assert.equal(message.subject, 'New message from a customer')
  for (const html of [lead.html, message.html]) {
    assert.ok(!/mailto:|tel:/.test(html))
  }
})
