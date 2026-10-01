import { cronAuth } from '@/lib/gates/cronAuth'
import { checkPriceBasis } from '@/lib/gates/priceBasis'
import { checkSchemaDrift } from '@/lib/gates/schemaDrift'
import { logger } from '@/lib/logger'
import { callerIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACTION = 'cron-gates'

/**
 * The two live-data gates on a timer: schema drift and new unlabellable prices.
 *
 * The database moves with no commit (CLAUDE.md, "The database moves without the repo"), so a
 * push-time gate cannot see it. Vercel runs this every 6 hours (vercel.json `crons`). A failure
 * goes through logger.error, which is what reaches ALERT_WEBHOOK_URL, and answers 500 so the
 * cron log shows red. The checks read with the public anon key only and write nothing.
 *
 * With CRON_SECRET set, only Vercel (which sends it as a bearer token) may call this. Without
 * it the route stays callable, rate-limited, because it is read-only and the same answer is in
 * the repo; the rebuild route next door has no such fallback.
 */
export async function GET(request: Request) {
  const auth = cronAuth(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )
  if (auth === 'unauthorized') {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (auth === 'no-secret') {
    // A run makes a PostgREST request per table and per function plus a full catalogue read,
    // so an open loop on this URL would be an amplifier against the database.
    const limit = rateLimit(`cron-gates:${await callerIp()}`, 6, 3_600_000)
    if (!limit.allowed) {
      return Response.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      )
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    const summary =
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set, so neither gate ran.'
    logger.error(`Scheduled gates did not run: ${summary}`, { action: ACTION })
    const unverified = { ok: false, summary }
    return Response.json(
      { schema: unverified, prices: unverified },
      { status: 500 },
    )
  }

  // A check that throws (network, a PostgREST 5xx) is a red run, not a crashed one: the other
  // check still reports.
  const settle = <T extends { ok: boolean; summary: string }>(
    run: Promise<T>,
  ): Promise<T | { ok: false; summary: string }> =>
    run.catch((error: unknown) => ({
      ok: false,
      summary: `failed to run: ${error instanceof Error ? error.message : String(error)}`,
    }))

  const [schema, prices] = await Promise.all([
    settle(checkSchemaDrift({ url, key })),
    settle(checkPriceBasis({ url, key })),
  ])
  const notice = 'notice' in prices ? prices.notice : null

  for (const [gate, result] of [
    ['schema-drift', schema],
    ['price-basis', prices],
  ] as const) {
    if (!result.ok) {
      logger.error(`Scheduled gate failed (${gate}): ${result.summary}`, {
        action: ACTION,
        code: gate,
      })
    }
  }
  if (schema.ok && prices.ok) {
    logger.info('Scheduled gates passed', {
      action: ACTION,
      schema: schema.summary,
      prices: prices.summary,
      ...(notice && { notice }),
    })
  }

  return Response.json(
    {
      schema: { ok: schema.ok, summary: schema.summary },
      prices: {
        ok: prices.ok,
        summary: notice ? `${notice}\n${prices.summary}` : prices.summary,
      },
    },
    { status: schema.ok && prices.ok ? 200 : 500 },
  )
}
