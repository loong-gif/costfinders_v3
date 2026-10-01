/**
 * What the customer's claims page says about a claim, from the row getClaimsAction returns.
 *
 * Every rule here fails as a confident wrong screen, never as an error:
 *   - A claim reveals the clinic for good. The row carries the clinic it froze at insert
 *     (`business_snapshot`); when that is missing the card must show nothing rather than guess.
 *   - A pending claim past its relay deadline is closed, not active: the database only writes
 *     `expired` on the customer's next claim, so the row can still say `pending`.
 *   - "Taken down" is shown only when the lookup said so. An unknown (undefined) must never read
 *     as a takedown.
 *   - The Active tab and its "up to 3 at a time" copy mean the statuses the server counts toward
 *     the limit. Two lists of three strings, in two files, drifting apart silently.
 *
 * The client modules import the claim server actions, which import a module that builds a
 * Supabase client at load, so the imports are deferred behind a stub env (as offerDataRules does).
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ClaimRow } from '@/lib/actions/claims'
import type { ClaimClinic, ClaimStatus } from '@/types/claim'

type CardModule = typeof import('@/components/features/claimCard')
type ContextModule = typeof import('@/lib/context/claimsContext')
let card: CardModule
let claimRowToClaim: ContextModule['claimRowToClaim']

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://stub.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'stub-anon-key'
  card = await import('@/components/features/claimCard')
  claimRowToClaim = (await import('@/lib/context/claimsContext'))
    .claimRowToClaim
})

const DAY_MS = 24 * 60 * 60 * 1000
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString()

const CLINIC: ClaimClinic = {
  name: 'Dream Med Spa',
  address: '6360 N Campbell Ave, Tucson, AZ 85718',
  city: 'Tucson',
  phone: '+15205550123',
  website: 'https://dreammedspa.com/',
  rating: 4.8,
  review_count: 161,
  google_place_id: null,
}

function row(overrides: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: 'c1',
    consumer_id: 'u1',
    deal_id: 1339,
    business_id: 765,
    status: 'pending',
    preferred_date: null,
    preferred_time: null,
    notes: null,
    responded_at: null,
    booked_date: null,
    booked_time: null,
    expires_at: inDays(5),
    created_at: inDays(-2),
    updated_at: inDays(-2),
    deal_title: '20 units of Botox',
    price_label: '$10 per unit',
    business_snapshot: CLINIC,
    deal_visible: true,
    ...overrides,
  }
}

const label = (status: ClaimStatus) =>
  renderToStaticMarkup(createElement(card.ConsumerClaimBadge, { status }))

test('the customer sees what the claim revealed, frozen on the claim', () => {
  const claim = claimRowToClaim(row())
  assert.deepEqual(claim.clinic, CLINIC)
  assert.equal(claim.dealTitle, '20 units of Botox')
  assert.equal(claim.priceLabel, '$10 per unit')
  assert.equal(card.claimTitle(claim), '20 units of Botox')
})

test('a claim with no snapshot shows no clinic rather than a guess', () => {
  const claim = claimRowToClaim(
    row({ business_snapshot: null, deal_title: null, price_label: null }),
  )
  assert.equal(claim.clinic, undefined)
  assert.equal(claim.priceLabel, undefined)
  assert.equal(card.claimTitle(claim), 'A deal you claimed')
  // Never the bare id: "Deal #1339" means nothing to a customer.
  assert.ok(!card.claimTitle(claim).includes('1339'))
})

test('a claim with a clinic but no title is named after the clinic', () => {
  const claim = claimRowToClaim(row({ deal_title: null }))
  assert.equal(card.claimTitle(claim), 'A deal at Dream Med Spa')
})

test('only a lookup that saw the takedown says the deal was taken down', () => {
  assert.equal(claimRowToClaim(row({ deal_visible: false })).dealVisible, false)
  // The offer lookup failed: unknown, not "taken down".
  assert.equal(
    claimRowToClaim(row({ deal_visible: undefined })).dealVisible,
    undefined,
  )
})

test('a pending claim past its deadline reads as closed, details kept', () => {
  const stale = claimRowToClaim(row({ expires_at: inDays(-1) }))
  assert.equal(stale.status, 'expired')
  assert.ok(label(stale.status).includes('Closed (details kept)'))
  assert.equal(card.ACTIVE_CLAIM_STATUSES.includes(stale.status), false)
  // Closing it keeps what it revealed.
  assert.deepEqual(stale.clinic, CLINIC)

  const live = claimRowToClaim(row())
  assert.equal(live.status, 'pending')
  assert.ok(label(live.status).includes('Details unlocked'))
  assert.equal(card.ACTIVE_CLAIM_STATUSES.includes(live.status), true)
})

test('status words promise nothing the clinic has not done', () => {
  const words: Record<ClaimStatus, string> = {
    pending: 'Details unlocked',
    contacted: 'Marked as contacted by the clinic',
    booked: 'Booked',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Closed (details kept)',
  }
  for (const [status, text] of Object.entries(words)) {
    assert.ok(label(status as ClaimStatus).includes(text), status)
  }
})

test('the Active tab holds exactly the statuses the 3-claim limit counts', () => {
  // claims.ts is 'use server', so its list cannot be exported; read it from the source.
  const source = readFileSync('src/lib/actions/claims.ts', 'utf8')
  const match = source.match(
    /const ACTIVE_STATUSES: ClaimStatus\[\] = \[([^\]]*)\]/,
  )
  assert.ok(match, 'ACTIVE_STATUSES not found in src/lib/actions/claims.ts')
  const server = [...match[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual([...card.ACTIVE_CLAIM_STATUSES].sort(), server)
})
