import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatBillingPeriod,
  formatCommitmentMonths,
  normalizeMembershipBenefits,
  type PublicMembership,
  sortPublicMemberships,
  summarizeMembershipBenefits,
} from './marketplace'

function membership(
  overrides: Partial<PublicMembership> &
    Pick<PublicMembership, 'plan_id' | 'membership_price'>,
): PublicMembership {
  return {
    business_id: 1,
    membership_name: 'Test Plan',
    billing_period: 'monthly',
    minimum_commitment_months: null,
    benefits: [],
    source_url: null,
    created_at: null,
    updated_at: null,
    master_business_info: null,
    ...overrides,
  }
}

test('normalizeMembershipBenefits keeps strings and maps object entries', () => {
  assert.deepEqual(
    normalizeMembershipBenefits([
      ' 10% off services ',
      { description: 'Free facial' },
      { name: 'Priority booking' },
      42,
    ]),
    ['10% off services', 'Free facial', 'Priority booking'],
  )
})

test('formatBillingPeriod returns readable labels', () => {
  assert.equal(formatBillingPeriod('monthly'), 'per month')
  assert.equal(formatBillingPeriod('annual'), 'per year')
  assert.equal(formatBillingPeriod('one_time'), 'one-time')
  assert.equal(formatBillingPeriod(null), 'per billing period')
})

test('formatCommitmentMonths hides empty values', () => {
  assert.equal(formatCommitmentMonths(null), null)
  assert.equal(formatCommitmentMonths(0), null)
  assert.equal(formatCommitmentMonths(1), '1-month minimum')
  assert.equal(formatCommitmentMonths(6), '6-month minimum')
})

test('summarizeMembershipBenefits truncates long perk lists', () => {
  const summary = summarizeMembershipBenefits(['a', 'b', 'c', 'd', 'e', 'f'], 5)
  assert.deepEqual(summary.visible, ['a', 'b', 'c', 'd', 'e'])
  assert.equal(summary.extraCount, 1)
})

test('sortPublicMemberships orders by price then updated_at', () => {
  const sorted = sortPublicMemberships([
    membership({
      plan_id: 1,
      membership_price: 200,
      updated_at: '2026-07-01T00:00:00Z',
    }),
    membership({
      plan_id: 2,
      membership_price: 125,
      updated_at: '2026-07-10T00:00:00Z',
    }),
    membership({
      plan_id: 3,
      membership_price: 125,
      updated_at: '2026-07-20T00:00:00Z',
    }),
  ])

  assert.deepEqual(
    sorted.map((plan) => plan.plan_id),
    [3, 2, 1],
  )
})
