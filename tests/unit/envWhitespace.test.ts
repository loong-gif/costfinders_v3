/**
 * A trailing newline in an environment variable must not reach a response header.
 *
 * This is the regression for the outage in which every Node function invocation on
 * production — /auth/callback, every Server Action, /api/health, /unsubscribe, 35+ dynamic
 * OG images and ISR revalidation — returned Vercel's static /500 with no function log, while
 * prerendered HITs answered 200 and the build was green. Three NEXT_PUBLIC_* values had been
 * stored in Vercel with a real LF at the end 175 days earlier; next.config.ts interpolated
 * one of them into the CSP header, and both Node's `setHeader` and `new Headers` throw
 * ERR_INVALID_CHAR on an embedded LF. Nothing in lint, tsc, `npm test` or `next build` could
 * see it, because the value only exists in Vercel.
 *
 * It fails here instead. Each test file gets its own process (`tsx --test <files>`), so the
 * env below is set once, before the first import evaluates either module's top-level
 * constants.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

// next-env.d.ts types NODE_ENV readonly. It is not, and the production-only CSP block reads
// it, so this is the one place that has to say so.
const mutableEnv = process.env as Record<string, string | undefined>

mutableEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co\n'
mutableEnv.NEXT_PUBLIC_BASE_URL = 'https://www.costfinders.ai\n'
mutableEnv.NODE_ENV = 'production'
mutableEnv.VERCEL_ENV = 'production'
// The apex, as Vercel reports it once both hosts are attached — see canonicalDeployment.test.ts.
mutableEnv.VERCEL_PROJECT_PRODUCTION_URL = 'costfinders.ai'

async function headerValues(): Promise<{ key: string; value: string }[]> {
  const { default: nextConfig } = await import('../../next.config')
  const headers = (await nextConfig.headers?.()) ?? []
  return headers.flatMap((entry) => entry.headers)
}

test('no configured response header carries a newline from a newlined env value', async () => {
  const values = await headerValues()
  const csp = values.find(
    (h) => h.key === 'Content-Security-Policy-Report-Only',
  )
  assert.ok(csp, 'expected the production CSP header to be configured')
  assert.match(
    csp.value,
    /https:\/\/x\.supabase\.co/,
    'CSP should carry the env origin',
  )

  for (const { key, value } of values) {
    assert.ok(
      !/[\r\n]/.test(value),
      `header ${key} carries a control character, which makes Node throw on every response: ${JSON.stringify(value)}`,
    )
  }
})

test('both canonical gates agree when NEXT_PUBLIC_BASE_URL has a trailing newline', async () => {
  const values = await headerValues()
  const noindex = values.some((h) => h.key === 'X-Robots-Tag')
  const { isCanonicalDeployment } = await import('@/lib/seo/metadata')

  // next.config.ts and src/lib/seo/metadata.ts duplicate this gate on purpose (the config is
  // evaluated before the TS path aliases exist). Duplicated means they can drift: one
  // trimmed, one did not, and the site would serve `Allow: /` in robots.txt while every
  // response carried `X-Robots-Tag: noindex`.
  assert.equal(noindex, !isCanonicalDeployment())
})

test('assertSupabaseEnv trims, and treats whitespace-only as missing', async () => {
  const { assertSupabaseEnv } = await import('@/lib/env')

  assert.deepEqual(
    assertSupabaseEnv('https://x.supabase.co\n', ' anon-key \n'),
    { url: 'https://x.supabase.co', anonKey: 'anon-key' },
  )
  assert.throws(
    () => assertSupabaseEnv('   ', 'anon-key'),
    /NEXT_PUBLIC_SUPABASE_URL/,
  )
})
