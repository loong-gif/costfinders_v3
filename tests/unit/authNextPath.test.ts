/**
 * The `next=` hop on /auth/callback, held against open redirect.
 *
 * The callback builds its redirect as `${origin}${next}` immediately after
 * exchangeCodeForSession() succeeds. Every string below reaches that line from a query
 * parameter in an emailed link, so a value a browser resolves off-origin sends a
 * just-authenticated visitor to somebody else's page. The route only ever sees the return
 * value of safeNextPath(), so this is the whole check.
 *
 * The off-origin cases are the point; the same-origin ones are here because a validator that
 * rejects the four paths the app actually sends (/dashboard, /business/dashboard,
 * /admin/dashboard, /auth/reset-password) would silently strand every auth email on the
 * consumer dashboard, which is the failure you would not notice.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DEFAULT_NEXT_PATH, safeNextPath } from '@/lib/siteUrl'

/** Values that must never be handed back to the caller. */
const REJECTED: [string, string][] = [
  ['//evil.com', 'protocol-relative — absolute to a browser'],
  ['//evil.com/dashboard', 'protocol-relative with a plausible tail'],
  ['https://evil.com', 'absolute URL'],
  ['http://evil.com/dashboard', 'absolute URL with a plausible tail'],
  ['/\\evil.com', 'backslash some parsers fold into //'],
  ['\\\\evil.com', 'UNC-style, no leading slash'],
  ['/dashboard\\@evil.com', 'backslash mid-path'],
  ['dashboard', 'relative, no leading slash'],
  ['', 'empty'],
  ['javascript:alert(1)', 'scheme with no slash at all'],
  ['/dashboard\r\nLocation: evil', 'CRLF, as header injection'],
  ['/dash\u0000board', 'NUL'],
  ['/dashboard\u007f', 'DEL'],
  ['/dash\tboard', 'tab'],
  ['/a//b', 'double slash mid-path'],
]

/** Every destination the app actually asks for, plus the shapes around them. */
const ACCEPTED = [
  '/dashboard',
  '/business/dashboard',
  '/admin/dashboard',
  '/auth/reset-password',
  '/',
  '/deals?city=phoenix&sort=price',
  '/treatments/botox#pricing',
  '/a:b',
]

test('off-origin and malformed next values fall back', () => {
  for (const [value, why] of REJECTED) {
    assert.equal(
      safeNextPath(value),
      DEFAULT_NEXT_PATH,
      `${JSON.stringify(value)} (${why}) must not survive`,
    )
  }
})

test('a missing next value falls back', () => {
  assert.equal(safeNextPath(null), DEFAULT_NEXT_PATH)
  assert.equal(safeNextPath(undefined), DEFAULT_NEXT_PATH)
})

test('same-origin paths pass through unchanged', () => {
  for (const value of ACCEPTED) {
    assert.equal(safeNextPath(value), value, `${value} must survive`)
  }
})

/**
 * The property that actually matters, checked the way the route uses the value rather than by
 * re-reading the rules: whatever comes back, `${origin}${next}` has to stay on `origin`.
 */
test('the result always resolves to this origin', () => {
  const origin = 'https://www.costfinders.ai'
  for (const value of [...REJECTED.map(([v]) => v), ...ACCEPTED]) {
    const resolved = new URL(`${origin}${safeNextPath(value)}`)
    assert.equal(
      resolved.origin,
      origin,
      `${JSON.stringify(value)} resolved off-origin to ${resolved.href}`,
    )
  }
})
