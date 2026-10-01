/**
 * The admin relay queue: which unrelayed claims an admin still has to pass to a clinic, and which
 * of those are about to miss their deadline.
 *
 * A wrong rule here is silent in both directions. Too strict, and the queue shows a confident
 * "nothing waiting" while customers wait (the business lead list did exactly that for months).
 * Too loose, and the admin chases claims the customer cancelled or the clinic already handled.
 * The home tile and the queue both read these two functions, so they cannot disagree.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  closedReason,
  isExpiringSoon,
  type QueueRow,
} from '@/lib/actions/admin-lead-queue'

const NOW = Date.parse('2026-09-24T12:00:00Z')
const HOUR_MS = 60 * 60 * 1000
const at = (hoursFromNow: number) =>
  new Date(NOW + hoursFromNow * HOUR_MS).toISOString()

function lead(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    status: 'pending',
    expires_at: at(72),
    admin_closed_at: null,
    admin_close_reason: null,
    ...overrides,
  }
}

test('a pending claim before its deadline is waiting', () => {
  assert.equal(closedReason(lead(), NOW), null)
})

test('a claim past its deadline leaves the queue even while it still says pending', () => {
  assert.equal(closedReason(lead({ expires_at: at(-1) }), NOW), 'Expired')
  // The deadline itself is out, not in.
  assert.equal(closedReason(lead({ expires_at: at(0) }), NOW), 'Expired')
})

test('an admin close wins over every status and says why', () => {
  assert.equal(
    closedReason(
      lead({ admin_closed_at: at(-2), admin_close_reason: 'Duplicate' }),
      NOW,
    ),
    'Closed by an admin: Duplicate',
  )
  assert.equal(
    closedReason(lead({ admin_closed_at: at(-2) }), NOW),
    'Closed by an admin: no reason given',
  )
})

test('any status but pending is out of the queue, in words', () => {
  const words: Record<string, string> = {
    cancelled: 'Cancelled by the customer',
    contacted: 'The clinic marked it contacted',
    booked: 'The clinic marked it booked',
    completed: 'The clinic marked it completed',
    expired: 'Expired',
  }
  for (const [status, text] of Object.entries(words)) {
    assert.equal(closedReason(lead({ status }), NOW), text, status)
  }
  // A status added under the app still closes, visibly, rather than vanishing.
  assert.equal(
    closedReason(lead({ status: 'no_show' }), NOW),
    'Status: no_show',
  )
})

test('"expiring soon" means under 48 hours to the deadline', () => {
  assert.equal(isExpiringSoon(lead({ expires_at: at(1) }), NOW), true)
  assert.equal(isExpiringSoon(lead({ expires_at: at(47.9) }), NOW), true)
  assert.equal(isExpiringSoon(lead({ expires_at: at(48) }), NOW), false)
  assert.equal(isExpiringSoon(lead({ expires_at: at(72) }), NOW), false)
})
