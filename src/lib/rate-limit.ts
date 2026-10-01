/**
 * Per-key sliding-window rate limiter.
 *
 * Deliberately a plain module, not a Server Action: every export of a `'use server'` module
 * is a public HTTP endpoint, and a limiter anyone can call is not a limiter.
 *
 * IN-MEMORY, AND THEREFORE PER-INSTANCE. Vercel Fluid Compute reuses instances but runs
 * several, so the real ceiling is `limit × instances`, not `limit`. That is a bound, not a
 * guarantee, and it is the honest trade for adding no infrastructure: the thing being
 * defended (issue #26) is a paid third-party API being called by anonymous scripts, and
 * turning an unbounded spend into a bounded one is most of the win. Memory also resets on
 * a cold start, which an attacker cannot trigger on demand.
 *
 * Upgrade path if a hard global cap is ever needed: a Postgres counter table plus a
 * SECURITY DEFINER function, the same shape as the other privileged helpers on this
 * project. That costs a round trip per call, which is why it is not the default here.
 */

import { headers } from 'next/headers'

interface Bucket {
  /** Ascending request timestamps (ms) still inside the window. */
  hits: number[]
}

const buckets = new Map<string, Bucket>()

/**
 * Cap on distinct keys held at once. Without it, one key per attacker-supplied value would
 * grow the map without bound — a memory-exhaustion vector in the code meant to prevent
 * abuse. Eviction is oldest-activity-first, which is the right victim: an active abuser
 * keeps their bucket and stays limited.
 */
const MAX_KEYS = 10_000

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in the current window; 0 when blocked. */
  remaining: number
  /** Seconds until the oldest hit falls out of the window. 0 when allowed. */
  retryAfterSeconds: number
}

/**
 * Record a request against `key` and report whether it is allowed.
 *
 * @param key    caller identity — a user id, never anything client-supplied.
 * @param limit  max requests per window.
 * @param windowMs window length in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [] }
    buckets.set(key, bucket)
  }

  // Hits are appended in time order, so everything expired is a prefix.
  let expired = 0
  while (expired < bucket.hits.length && bucket.hits[expired] <= cutoff) {
    expired += 1
  }
  if (expired > 0) bucket.hits.splice(0, expired)

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]
    return {
      allowed: false,
      remaining: 0,
      // Always at least 1: reporting "retry after 0 seconds" invites an immediate retry.
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000),
      ),
    }
  }

  bucket.hits.push(now)

  // Evict only when over the cap, and only buckets that have gone quiet. Re-inserting the
  // live key last keeps Map iteration order (insertion order) aligned with recency.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (buckets.size <= MAX_KEYS) break
      if (k === key) continue
      const last = b.hits.at(-1)
      if (last === undefined || last <= cutoff) buckets.delete(k)
    }
  }

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
  }
}

// ---------------------------------------------------------------------------
// Authentication throttle
// ---------------------------------------------------------------------------

/**
 * Throttle an authentication attempt.
 *
 * Why this has to live in the app at all: every auth call is made server-side through
 * `createSupabaseServerClient()`, so Supabase's own per-IP limits see Vercel's egress
 * addresses, not the caller's. Every visitor's sign-in lands in one upstream bucket, which
 * means an attacker both goes unthrottled per-client and can push real users into whatever
 * shared limit does exist. The caller's real address is only knowable here.
 *
 * ponytail: the ceiling is the one in this file's header — the counters are in-memory, so the
 * real cap is `limit x running instances` and it resets on a cold start. It is a bound, not a
 * guarantee. Making it a guarantee needs a store shared across instances (a Postgres counter
 * behind a SECURITY DEFINER function, or a Redis INCR); nothing here has to change but
 * `rateLimit()`'s internals.
 *
 * Three buckets, because no single one of them can both stop a brute-force run and leave real
 * users alone. A limiter that locks out the people it is defending is a worse outage than the
 * attack:
 *   - `perIp` is the coarse ceiling. It has to stay well above plausible shared-egress
 *     traffic — an office, a hotel or a campus NAT is one address to us — so it is set loose
 *     enough to be invisible and tight enough to bound a script.
 *   - `perIpEmail` is the real brute-force control: few attempts at ONE account from ONE
 *     host. A NAT with many distinct users never touches it, and it is what makes a loose
 *     `perIp` safe.
 *   - `perEmail` is opt-in and used only where the damage is mail volume at a fixed address
 *     (reset, magic link). It is deliberately NOT used for sign-in: an address-only bucket
 *     there would let anyone lock a victim out of their own account by spending the victim's
 *     budget. On reset and magic link, exhausting it costs the victim nothing — password
 *     sign-in still works.
 *
 * Each bucket is only charged if the coarser one ahead of it passed, so an attacker who has
 * already exhausted their own IP budget cannot go on spending a victim's.
 *
 * The message the caller shows must not depend on whether the address exists, or the limiter
 * becomes an account-existence oracle. Throttling happens before Supabase is touched, so it
 * cannot.
 */
export async function throttleAuthAttempt(
  scope: string,
  email: string,
  rules: {
    perIp: number
    perIpEmail?: number
    perEmail?: number
    windowMs: number
  },
): Promise<RateLimitResult> {
  const ip = await callerIp()
  const address = email.trim().toLowerCase()

  const byIp = rateLimit(`${scope}:ip:${ip}`, rules.perIp, rules.windowMs)
  if (!byIp.allowed) return byIp

  if (rules.perIpEmail !== undefined) {
    const byPair = rateLimit(
      `${scope}:ip-email:${ip}:${address}`,
      rules.perIpEmail,
      rules.windowMs,
    )
    if (!byPair.allowed) return byPair
  }

  if (rules.perEmail !== undefined) {
    return rateLimit(
      `${scope}:email:${address}`,
      rules.perEmail,
      rules.windowMs,
    )
  }

  return byIp
}

/**
 * The caller's address as the platform reports it.
 *
 * Vercel overwrites `x-forwarded-for` with the real client address at the edge, so the
 * leftmost entry is trustworthy in production. Off Vercel — `next dev`, or a self-hosted
 * deploy without a trusted proxy — the header is absent or attacker-controlled, and every
 * caller then shares the `unknown` bucket. That degrades to a global cap rather than to no
 * cap, which is the right direction to fail.
 *
 * Exported because route handlers and actions that call `rateLimit()` directly need the same
 * key and were each re-deriving it — three copies of two lines is three places for the
 * header precedence to drift apart.
 */
export async function callerIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || h.get('x-real-ip')?.trim() || 'unknown'
}

/** Style-guide phrasing for a throttle refusal: "Try again in 15 minutes." */
export function retryAfterPhrase(seconds: number): string {
  if (seconds < 60) {
    return `Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
  }
  const minutes = Math.ceil(seconds / 60)
  return `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}
