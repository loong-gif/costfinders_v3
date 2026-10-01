import { timingSafeEqual } from 'node:crypto'

/**
 * Who may call a /api/cron route.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron invocation once the
 * CRON_SECRET environment variable is set on the project. Each route decides what `no-secret`
 * means for it: the read-only gates stay callable (rate-limited), the rebuild trigger closes.
 */
export type CronAuth = 'authorized' | 'unauthorized' | 'no-secret'

export function cronAuth(
  authorization: string | null,
  secret: string | undefined,
): CronAuth {
  // Trimmed: this project's Vercel env values have carried a trailing newline before.
  const expected = secret?.trim()
  if (!expected) return 'no-secret'
  const given = Buffer.from(authorization?.trim() ?? '')
  const wanted = Buffer.from(`Bearer ${expected}`)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
    ? 'authorized'
    : 'unauthorized'
}
