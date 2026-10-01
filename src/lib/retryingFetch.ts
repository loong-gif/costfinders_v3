/**
 * `fetch` that retries a read which failed in transit.
 *
 * `next build` prerenders every deal page from the live database, ~900 reads, and one dropped
 * connection aborted the whole production deploy: on 2026-09-29 two reads died with
 * `ECONNRESET` while prerendering /deals/10031 and /deals/10473, and the site stayed on the
 * previous build until the same commit was redeployed. Runtime and ISR reads fail the same way.
 *
 * Only GET and HEAD are retried — PostgREST reads. A write that failed in transit may still
 * have landed, so repeating it could apply it twice. Only a thrown network error or a gateway
 * status (502/503/504) is retried; any other response is the answer. An aborted request is
 * never retried.
 *
 * ponytail: fixed short backoff, no jitter — the reads it guards are at build time and in page
 * renders, where a short wait beats a failed page. Add jitter if it ever fronts a burst.
 */
const RETRY_STATUSES = new Set([502, 503, 504])
const DELAYS_MS = [250, 1000]

export function retryingFetch(
  // Resolved at call time, not captured: Next patches the global fetch for its cache.
  baseFetch: typeof fetch = (input, init) => globalThis.fetch(input, init),
  delaysMs: readonly number[] = DELAYS_MS,
): typeof fetch {
  return async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') return baseFetch(input, init)

    for (let attempt = 0; ; attempt++) {
      const last = attempt >= delaysMs.length
      try {
        const response = await baseFetch(input, init)
        if (last || !RETRY_STATUSES.has(response.status)) return response
      } catch (error) {
        if (last || init?.signal?.aborted) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]))
    }
  }
}
