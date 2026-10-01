/**
 * Where an expired sign-in link sends someone back to.
 *
 * /auth/complete renders "Request a new link" when a magic link is already used or expired.
 * That button used to point at `/?signin=required` unconditionally, so an admin whose link had
 * expired was dropped on the CONSUMER homepage — a surface with no admin sign-in on it and no
 * route back to /admin. Confirmed live with `next=/admin/dashboard`.
 *
 * The three sign-in surfaces are genuinely separate pages, so the recovery target has to be
 * derived from the `next` the callback was carrying. These cases are the contract.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { safeNextPath, signInHomeFor } from '@/lib/siteUrl'

const CASES: [string, string][] = [
  // Admin links must recover to the admin sign-in, never the consumer homepage.
  ['/admin/dashboard', '/admin'],
  ['/admin/dashboard/deals', '/admin'],
  ['/admin', '/admin'],
  // Business owners have their own sign-in on the business landing page.
  ['/business/dashboard', '/business'],
  ['/business/dashboard/deals/new', '/business'],
  ['/business', '/business'],
  // Consumers: the homepage, which is where the consumer sign-in modal lives.
  ['/dashboard', '/?signin=required'],
  ['/dashboard/favorites', '/?signin=required'],
  ['/', '/?signin=required'],
]

for (const [next, expected] of CASES) {
  test(`signInHomeFor(${next}) -> ${expected}`, () => {
    assert.equal(signInHomeFor(next), expected)
  })
}

test('composes with safeNextPath, so a hostile next cannot pick the surface', () => {
  // safeNextPath rejects these to DEFAULT_NEXT_PATH before signInHomeFor ever sees them;
  // asserting the composition is what the page actually does.
  for (const hostile of [
    '//evil.com/admin',
    'https://evil.com/admin',
    '/\\admin',
  ]) {
    assert.equal(signInHomeFor(safeNextPath(hostile)), '/?signin=required')
  }
})
