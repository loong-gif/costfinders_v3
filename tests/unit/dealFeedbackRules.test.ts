/**
 * The deal-report and confirmation vocabularies against the CHECK constraints that enforce them.
 *
 * The actions validate against these lists before a round trip, and the form, the claim question
 * and the admin queue label from them. If a migration widens or renames a value and this file
 * does not follow, the action refuses a value the database accepts (or the reverse, a 23514 the
 * user sees as "couldn't send"). Reading the migration text keeps the two in one test.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  CLAIM_FEEDBACK_ANSWERS,
  cleanNote,
  DEAL_REPORT_REASONS,
  FEEDBACK_STATUSES,
  isOfferId,
  isUuid,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const reportsSql = readFileSync(
  join(MIGRATIONS, '20260928010001_deal_reports.sql'),
  'utf8',
)
const confirmationsSql = readFileSync(
  join(MIGRATIONS, '20260928010002_offer_confirmations.sql'),
  'utf8',
)

/** The quoted values of the first `<prefix> in (...)` list. */
function listAfter(sql: string, prefix: RegExp): string[] {
  const match = sql.match(new RegExp(`${prefix.source}\\s+in\\s+\\(([^)]*)\\)`))
  assert.ok(match, `no list after ${prefix}`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
}

test('deal-page reasons match the deal_reports CHECK', () => {
  assert.deepEqual(
    listAfter(reportsSql, /source = 'deal_page'\s+and reason/),
    [...DEAL_REPORT_REASONS].sort(),
  )
})

test('claim answers match the deal_reports CHECK', () => {
  assert.deepEqual(
    listAfter(reportsSql, /source = 'claim' and reason/),
    [...CLAIM_FEEDBACK_ANSWERS].sort(),
  )
})

test('statuses match both tables', () => {
  const statuses = [...FEEDBACK_STATUSES].sort()
  assert.deepEqual(listAfter(reportsSql, /check \(status/), statuses)
  assert.deepEqual(listAfter(confirmationsSql, /check \(status/), statuses)
})

test('note caps match the length CHECKs', () => {
  assert.match(
    reportsSql,
    new RegExp(`char_length\\(note\\) <= ${NOTE_MAX.report}\\b`),
  )
  assert.match(
    confirmationsSql,
    new RegExp(`char_length\\(note\\) <= ${NOTE_MAX.correction}\\b`),
  )
  assert.match(
    reportsSql,
    new RegExp(`char_length\\(admin_note\\) <= ${NOTE_MAX.admin}\\b`),
  )
})

test('cleanNote strips markup, trims and caps', () => {
  assert.equal(cleanNote('  <b>$12</b> per unit  ', 100), '$12 per unit')
  assert.equal(cleanNote('x'.repeat(1200), NOTE_MAX.report).length, 1000)
  assert.equal(cleanNote(undefined, 10), '')
  assert.equal(cleanNote(42, 10), '')
})

test('ids a client may send', () => {
  assert.ok(isOfferId(7973))
  for (const bad of [0, -1, 1.5, '7973', Number.NaN, 2 ** 60, null]) {
    assert.equal(isOfferId(bad), false, String(bad))
  }
  assert.ok(isUuid('399dfccf-9054-4624-b2fa-1fe441ae37da'))
  for (const bad of ['399dfccf', "1' or '1'='1", '', null, 7]) {
    assert.equal(isUuid(bad), false, String(bad))
  }
})
