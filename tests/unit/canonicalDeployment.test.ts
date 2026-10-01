/**
 * The indexing gate, held against the domain cutover.
 *
 * `isCanonicalDeployment()` decides whether robots.ts serves `Allow: /` and whether
 * next.config.ts stops emitting `X-Robots-Tag: noindex`. Both of its failure directions are
 * silent, and both have already shipped once:
 *
 *   - `VERCEL_ENV === 'production'` was true on costfindersv2.vercel.app, so the pre-cutover
 *     site invited crawlers while every canonical on it pointed at a domain serving v1.
 *   - the literal host comparison that replaced it would have returned false FOREVER after the
 *     cutover, because Vercel resolves VERCEL_PROJECT_PRODUCTION_URL to "the shortest
 *     production custom domain" — the apex — while NEXT_PUBLIC_BASE_URL names the www host.
 *     Nothing in the app surfaces a permanent noindex; you find out from Search Console weeks
 *     later.
 *
 * A unit test is the only check that can see either one before the domain moves, because the
 * environment that triggers them does not exist yet. `apex deployed` below is that regression.
 *
 * ONE canonical per process, by construction: metadata.ts reads NEXT_PUBLIC_BASE_URL into a
 * module-scope constant, and this project compiles to CJS (no `"type": "module"`), so a
 * cache-busting query on a dynamic import is silently ignored and the module evaluates exactly
 * once. So NEXT_PUBLIC_BASE_URL is fixed here to the real cutover value and only the deployment
 * identity varies. That loses nothing: `apex deployed` and `www deployed` together pin BOTH
 * sides of the www-stripping — normalise only the deployed host and the first fails, normalise
 * only the canonical host and the second does.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

// Set before the first dynamic import below, which is what evaluates the module.
process.env.NEXT_PUBLIC_BASE_URL = 'https://www.costfinders.ai'

type GateEnv = {
  VERCEL_ENV?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
  NODE_ENV?: string
}
const ENV_KEYS = [
  'VERCEL_ENV',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'NODE_ENV',
] as const

// next-env.d.ts types process.env.NODE_ENV as readonly. It is not, and the fallback branch of
// isCanonicalDeployment() reads it, so this is the one place that has to say so.
const mutableEnv = process.env as Record<string, string | undefined>

async function isCanonicalUnder(env: GateEnv): Promise<boolean> {
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete mutableEnv[key]
    else mutableEnv[key] = env[key]
  }
  const { isCanonicalDeployment } = await import('@/lib/seo/metadata')
  return isCanonicalDeployment()
}

const CASES: Array<{ name: string; env: GateEnv; expected: boolean }> = [
  {
    // THE REGRESSION. Both hosts must be attached at cutover (v1 redirects apex → www today),
    // so Vercel names the 14-character apex while the canonical is the 18-character www form.
    // A literal comparison returns false here and the site launches permanently noindex.
    name: 'apex deployed, www canonical',
    env: {
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'costfinders.ai',
    },
    expected: true,
  },
  {
    name: 'www deployed, www canonical',
    env: {
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'www.costfinders.ai',
    },
    expected: true,
  },
  {
    // Today's pre-cutover deployment. This IS the project's production deployment, so
    // VERCEL_ENV alone cannot tell it apart from the real thing.
    name: 'vercel.app deployed is not canonical',
    env: {
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'costfindersv2.vercel.app',
    },
    expected: false,
  },
  {
    // Stripping `www.` must not decay into a substring or suffix match.
    name: 'lookalike host is not canonical',
    env: {
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'wwwcostfinders.ai',
    },
    expected: false,
  },
  {
    name: 'preview deployment is never canonical',
    env: {
      VERCEL_ENV: 'preview',
      VERCEL_PROJECT_PRODUCTION_URL: 'costfinders.ai',
    },
    expected: false,
  },
  {
    // Self-hosted `next start`: no Vercel host to compare against, so NODE_ENV decides.
    name: 'no Vercel host, production build',
    env: { NODE_ENV: 'production' },
    expected: true,
  },
  {
    name: 'no Vercel host, development',
    env: { NODE_ENV: 'development' },
    expected: false,
  },
]

for (const { name, env, expected } of CASES) {
  test(`isCanonicalDeployment: ${name}`, async () => {
    assert.equal(await isCanonicalUnder(env), expected)
  })
}
