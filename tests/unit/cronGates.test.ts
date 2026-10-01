/**
 * The cron routes' auth decision, and the snapshot comparison the drift alert rests on.
 *
 * cronAuth decides whether /api/cron/rebuild can trigger a production build, so it must refuse
 * a wrong or missing bearer and must report an unset secret as its own case (the rebuild route
 * closes on it; the gates route rate-limits instead).
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cronAuth } from '@/lib/gates/cronAuth'
import { compare, type Snapshot } from '@/lib/gates/schemaDrift'

test('cronAuth: an unset or blank secret is its own case, whatever the header says', () => {
  assert.equal(cronAuth('Bearer anything', undefined), 'no-secret')
  assert.equal(cronAuth(null, ''), 'no-secret')
  assert.equal(cronAuth('Bearer ', ' \n'), 'no-secret')
})

test('cronAuth: only the exact bearer is authorized', () => {
  const secret = 's3cret-value'
  assert.equal(cronAuth(`Bearer ${secret}`, secret), 'authorized')
  // A newline stored with the Vercel value must not lock Vercel's own cron out.
  assert.equal(cronAuth(`Bearer ${secret}`, `${secret}\n`), 'authorized')
  assert.equal(cronAuth(null, secret), 'unauthorized')
  assert.equal(cronAuth('', secret), 'unauthorized')
  assert.equal(cronAuth(secret, secret), 'unauthorized')
  assert.equal(cronAuth(`Bearer ${secret}x`, secret), 'unauthorized')
  assert.equal(
    cronAuth(`Bearer ${secret.slice(0, -1)}`, secret),
    'unauthorized',
  )
  assert.equal(cronAuth(`bearer ${secret}`, secret), 'unauthorized')
})

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    capturedAt: '2026-09-24T00:00:00.000Z',
    project: 'test',
    note: '',
    tables: {
      offers: {
        access: 'public',
        columns: ['id', 'is_active'],
        types: { id: 'number', is_active: 'boolean' },
      },
    },
    functions: { is_admin: { args: [], access: 'callable' } },
    vocabulary: { 'clinic_services.unit_type': ['unit'] },
    migrations: ['a'],
    ...overrides,
  }
}

test('compare: an unchanged schema reports nothing', () => {
  assert.deepEqual(compare(snapshot(), snapshot()), [])
})

test('compare: each kind of drift produces a line', () => {
  const live = snapshot({
    tables: {
      offers: {
        access: 'denied',
        columns: ['id'],
        types: { id: 'string' },
      },
    },
    functions: {},
    vocabulary: { 'clinic_services.unit_type': ['unit', 'ml'] },
    migrations: ['a', 'b'],
  })
  const drift = compare(snapshot(), live)
  for (const expected of [
    /offers: the anon role's access changed from public to denied/,
    /offers column: is_active is gone from the database/,
    /offers\.id: number became string/,
    /function: is_admin is gone from the database/,
    /clinic_services\.unit_type: ml is new in the database/,
    /migration file b is in the repo but the snapshot predates it/,
  ]) {
    assert.ok(
      drift.some((line) => expected.test(line)),
      `missing ${expected}: ${drift.join(' | ')}`,
    )
  }
})

test('compare: a type the live sample did not resolve is sparsity, not drift', () => {
  const live = snapshot()
  live.tables.offers.types = { id: 'number' }
  assert.deepEqual(compare(snapshot(), live), [])
})
