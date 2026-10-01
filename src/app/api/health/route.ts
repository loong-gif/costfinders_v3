import { getFeaturedOffers } from '@/lib/data/offers'
import { logger } from '@/lib/logger'
import { callerIp, rateLimit } from '@/lib/rate-limit'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type CheckState = 'ok' | 'fail'

/**
 * Health check.
 *
 * This endpoint answered 503 continuously in production for four days and nobody noticed,
 * because it could never answer anything else: it probed `business_claims` with the ANON
 * client, and that table denies anon by design (42501). A monitor wired to a check that is
 * red 100% of the time is muted on day one, so the false failure was hiding a real one —
 * `get_offer_category_counts` had actually broken.
 *
 * The rule this now follows: a permission denial is PROOF THE TABLE EXISTS, not a failure.
 * Only a missing table, a broken RPC, or a data path that returns nothing is a failure.
 * That keeps the three classes this app has genuinely suffered:
 *   - schema drift        → the table/column is gone      → 42P01 / PGRST205 / 42703
 *   - a broken RPC        → the function throws           → checkRpcs
 *   - an RLS empty result → policy-less table reads empty → checkOffersQuery
 */

/**
 * Relations the application cannot function without. Split by who may read them: the anon
 * client can SELECT rows from the public ones, and is correctly refused on the rest — so
 * the two groups need different success conditions, not the same one. The public catalogue is
 * the two views; the tables behind them are closed to anon (20260924050002), and a view the
 * pipeline drops or re-grants shows here as a failure.
 */
const PUBLIC_TABLES = ['public_offers', 'public_business_directory'] as const
const OWNER_SCOPED_TABLES = [
  'profiles',
  'business_profiles',
  'business_claims',
  'claims',
] as const

/** RPCs the homepage and city pages depend on. */
const REQUIRED_RPCS = [
  'get_city_deal_counts',
  'get_offer_category_counts',
] as const

/** PostgREST/Postgres codes that mean "this relation is not there". */
const MISSING_CODES = new Set(['42P01', 'PGRST205', 'PGRST106', '42703'])
/** Codes that mean "it is there, you just may not read it" — the expected answer. */
const DENIED_CODES = new Set(['42501', 'PGRST301'])

async function probeTable(
  table: string,
  publiclyReadable: boolean,
): Promise<{ table: string; ok: boolean }> {
  // head + limit(1): PostgREST plans and runs the query but returns no body. The old
  // `count: 'exact'` made every probe a full scan, nine times per request. `select('*')`
  // rather than a named column on purpose — a guessed column name would report a healthy
  // relation as missing.
  const { error, status } = await supabase
    .from(table)
    .select('*', { head: true })
    .limit(1)

  if (!error) return { table, ok: true }
  if (MISSING_CODES.has(error.code)) return { table, ok: false }
  // A HEAD request has NO response body, so PostgREST's `{"code":"42501",...}` never reaches
  // supabase-js and `error.code` is empty — which classified all four owner-scoped tables as
  // missing and pinned this endpoint at 503, the same permanently-red state the route was just
  // fixed out of. The HTTP status is the one denial signal HEAD does send, so trust it first and
  // keep `error.code` for the GET-shaped case.
  if (status === 401 || status === 403 || DENIED_CODES.has(error.code)) {
    // Expected for an owner-scoped table. On a public one it is a real regression —
    // someone revoked the grant or dropped the read policy, which renders as an empty
    // site rather than an error.
    return { table, ok: !publiclyReadable }
  }
  return { table, ok: false }
}

async function checkTables(): Promise<{
  state: CheckState
  missing: string[]
}> {
  const results = await Promise.all([
    ...PUBLIC_TABLES.map((t) => probeTable(t, true)),
    ...OWNER_SCOPED_TABLES.map((t) => probeTable(t, false)),
  ])
  const missing = results.filter((r) => !r.ok).map((r) => r.table)
  return { state: missing.length === 0 ? 'ok' : 'fail', missing }
}

async function checkRpcs(): Promise<{ state: CheckState; failing: string[] }> {
  const results = await Promise.all(
    REQUIRED_RPCS.map(async (fn) => {
      const { error } = await supabase.rpc(fn)
      return { fn, ok: !error }
    }),
  )
  const failing = results.filter((r) => !r.ok).map((r) => r.fn)
  return { state: failing.length === 0 ? 'ok' : 'fail', failing }
}

/**
 * Runs the real featured-offers path rather than a synthetic query. This is the check
 * that would have caught the `original_price` column drift: the column did not exist,
 * every offer query returned 42703, the homepage rendered an error boundary — and the
 * old connectivity-only check still answered "healthy". An empty result counts as a
 * failure on purpose: RLS with no policy returns zero rows, not an error.
 */
async function checkOffersQuery(): Promise<{
  state: CheckState
  error?: string
}> {
  try {
    const offers = await getFeaturedOffers(1)
    return { state: offers.length > 0 ? 'ok' : 'fail' }
  } catch (error) {
    return {
      state: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function GET(request: Request) {
  const start = performance.now()

  // Detail is for the operator, not for anonymous callers: the unhealthy body used to
  // hand out live Supabase error strings. Without the token you get status only, which
  // is all an uptime monitor needs to decide red or green.
  const token = process.env.HEALTH_CHECK_TOKEN
  const detailed =
    Boolean(token) && request.headers.get('x-health-token') === token

  // Each hit runs about eight Postgres queries, so an anonymous loop on this URL is a cheap
  // amplifier against the database. 30 a minute per address is far above any uptime
  // monitor; the operator's token skips it.
  if (!detailed) {
    const limit = rateLimit(`health:${await callerIp()}`, 30, 60_000)
    if (!limit.allowed) {
      return Response.json(
        { status: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(limit.retryAfterSeconds),
          },
        },
      )
    }
  }

  const envOk =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const [tables, rpcs, offers] = await Promise.all([
    checkTables(),
    checkRpcs(),
    checkOffersQuery(),
  ])

  const checks = {
    env: (envOk ? 'ok' : 'fail') as CheckState,
    tables: tables.state,
    rpcs: rpcs.state,
    offers_query: offers.state,
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  if (!allOk) {
    // The route never reported through the logger, so an unhealthy result could not
    // reach src/lib/alerting.ts even once ALERT_WEBHOOK_URL is set.
    logger.error('Health check failed', {
      action: 'healthCheck',
      failing: Object.entries(checks)
        .filter(([, v]) => v === 'fail')
        .map(([k]) => k)
        .join(','),
      missingTables: tables.missing.join(',') || undefined,
      failingRpcs: rpcs.failing.join(',') || undefined,
    })
  }

  return Response.json(
    {
      status: allOk ? 'healthy' : 'unhealthy',
      ...(detailed && {
        checks,
        ...(tables.missing.length > 0 && { missing_tables: tables.missing }),
        ...(rpcs.failing.length > 0 && { failing_rpcs: rpcs.failing }),
        ...(offers.error && { offers_error: offers.error }),
        latency_ms: Math.round(performance.now() - start),
      }),
      timestamp: new Date().toISOString(),
    },
    {
      status: allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
