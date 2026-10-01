import { cronAuth } from '@/lib/gates/cronAuth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTION = 'cron-rebuild'

/**
 * Rebuild daily so deals the pipeline ingested overnight stop 404ing.
 *
 * src/app/deals/[[...slugs]]/page.tsx sets `dynamicParams = false` and enumerates the deal corpus
 * in generateStaticParams at BUILD time, so an id that did not exist at the last build is a hard
 * 404 while the homepage and every browse grid link to it. That is deliberate (the page's own
 * comment explains why), so the build has to follow the data instead. Vercel runs this at
 * 03:55 UTC (vercel.json `crons`), after the pipeline's nightly batches have landed.
 *
 * ponytail: a deploy hook on a timer, not a webhook from the pipeline. The pipeline is operated by
 * someone else and cannot call us; when governance gives us a channel, have it hit the hook on
 * insert and drop this cron.
 *
 * A build trigger must never be public: without CRON_SECRET this answers 503 rather than falling
 * back to anything open.
 */
export async function GET(request: Request) {
  const auth = cronAuth(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )
  if (auth === 'no-secret') {
    return Response.json(
      {
        error:
          'CRON_SECRET is not set. This route triggers a production build, so it stays closed until the secret exists.',
      },
      { status: 503 },
    )
  }
  if (auth === 'unauthorized') {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim()
  if (!hook) {
    logger.warn(
      'VERCEL_DEPLOY_HOOK_URL is not set, so the nightly rebuild did not run. Create a Deploy Hook on the costfinders_v2 project (Settings > Git > Deploy Hooks, branch main) and set its URL as that variable.',
      { action: ACTION },
    )
    return Response.json(
      { error: 'VERCEL_DEPLOY_HOOK_URL is not set.' },
      { status: 503 },
    )
  }

  let status = 0
  try {
    const response = await fetch(hook, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
    })
    status = response.status
  } catch (error) {
    logger.error('Deploy hook request failed', {
      action: ACTION,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 201 is the documented success. Anything else means the hook was deleted or the project
  // renamed, and a silent no-op here reads exactly like "no new deals".
  if (status !== 201) {
    if (status !== 0) {
      logger.error(`Deploy hook did not fire (HTTP ${status})`, {
        action: ACTION,
        code: String(status),
      })
    }
    return Response.json({ hookStatus: status }, { status: 502 })
  }
  return Response.json({ hookStatus: status })
}
