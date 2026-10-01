/**
 * The public client's reads retry a dropped connection (src/lib/retryingFetch.ts) — and only
 * reads: a write that failed in transit may have landed, so it must never be sent twice.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { retryingFetch } from '@/lib/retryingFetch'

/** A fake fetch that plays a script of outcomes and counts calls. */
function scripted(outcomes: (number | Error)[]) {
  let calls = 0
  const fetch = (async () => {
    const outcome = outcomes[Math.min(calls, outcomes.length - 1)]
    calls++
    if (outcome instanceof Error) throw outcome
    return new Response(null, { status: outcome })
  }) as typeof globalThis.fetch
  return { fetch, calls: () => calls }
}

const NO_WAIT = [0, 0]
const reset = () => new TypeError('fetch failed')

test('a read that drops its connection is retried until it succeeds', async () => {
  const base = scripted([reset(), 200])
  const res = await retryingFetch(
    base.fetch,
    NO_WAIT,
  )('https://x/rest/v1/offers')
  assert.equal(res.status, 200)
  assert.equal(base.calls(), 2)
})

test('a gateway status is retried; any other status is the answer', async () => {
  const gateway = scripted([503, 200])
  assert.equal(
    (await retryingFetch(gateway.fetch, NO_WAIT)('https://x')).status,
    200,
  )
  assert.equal(gateway.calls(), 2)

  const notFound = scripted([404, 200])
  assert.equal(
    (await retryingFetch(notFound.fetch, NO_WAIT)('https://x')).status,
    404,
  )
  assert.equal(notFound.calls(), 1)
})

test('it gives up after the last retry and surfaces the failure', async () => {
  const down = scripted([reset()])
  await assert.rejects(
    retryingFetch(down.fetch, NO_WAIT)('https://x'),
    /fetch failed/,
  )
  assert.equal(down.calls(), 3)

  const stillBusy = scripted([503])
  assert.equal(
    (await retryingFetch(stillBusy.fetch, NO_WAIT)('https://x')).status,
    503,
  )
  assert.equal(stillBusy.calls(), 3)
})

test('a write is never retried, and neither is an aborted read', async () => {
  const write = scripted([reset(), 201])
  await assert.rejects(
    retryingFetch(write.fetch, NO_WAIT)('https://x', { method: 'POST' }),
    /fetch failed/,
  )
  assert.equal(write.calls(), 1)

  const controller = new AbortController()
  controller.abort()
  const aborted = scripted([reset(), 200])
  await assert.rejects(
    retryingFetch(aborted.fetch, NO_WAIT)('https://x', {
      signal: controller.signal,
    }),
  )
  assert.equal(aborted.calls(), 1)
})
