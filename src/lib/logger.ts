/**
 * Structured logger for server-side code.
 * Outputs JSON to console (captured by Vercel log drains).
 * M4: Replaces silent error swallowing across server actions.
 */

import { reportError } from '@/lib/alerting'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  action?: string
  userId?: string
  // Numeric in the database (promo_offer_master.id, master_business_info.business_id)
  // and passed through as numbers by the actions; string in a few admin paths.
  dealId?: string | number
  businessId?: string | number
  duration?: number
  [key: string]: unknown
}

/**
 * Email addresses never reach the logs. Runtime Logs are readable by the whole Vercel team,
 * and a PostgREST or Resend error string can echo an address the call site never meant to
 * log. Log a user id instead.
 *
 * ponytail: top-level string values only, which is every call site today. A nested object
 * carrying an address would get through; recurse if one ever appears.
 */
const EMAIL_PATTERN = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g

function redact(value: unknown): unknown {
  return typeof value === 'string'
    ? value.replace(EMAIL_PATTERN, '[email]')
    : value
}

function log(level: LogLevel, rawMessage: string, rawContext?: LogContext) {
  const message = redact(rawMessage) as string
  const context = rawContext
    ? (Object.fromEntries(
        Object.entries(rawContext).map(([k, v]) => [k, redact(v)]),
      ) as LogContext)
    : undefined
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry))
      // Logging is a pull surface; this is the push. No-op unless ALERT_WEBHOOK_URL is
      // set, and it forwards an allowlist of fields rather than the whole context —
      // some call sites carry recipient addresses and user ids (see src/lib/alerting.ts).
      reportError(message, context)
      break
    case 'warn':
      console.warn(JSON.stringify(entry))
      break
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify(entry))
      }
      break
    default:
      console.log(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log('debug', message, context),
  info: (message: string, context?: LogContext) =>
    log('info', message, context),
  warn: (message: string, context?: LogContext) =>
    log('warn', message, context),
  error: (message: string, context?: LogContext) =>
    log('error', message, context),
}

/**
 * Wrap a server action with automatic timing and error logging.
 * Usage: export const myAction = withAction('myAction', async (args) => { ... })
 */
export function withAction<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now()
    try {
      const result = await fn(...args)
      const duration = Math.round(performance.now() - start)
      if (duration > 1000) {
        logger.warn(`Slow action: ${name}`, { action: name, duration })
      }
      return result
    } catch (error) {
      const duration = Math.round(performance.now() - start)
      logger.error(`Action failed: ${name}`, {
        action: name,
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }
}

/**
 * Postgres / PostgREST / GoTrue conditions that are ordinary control flow rather than
 * failures. Routing these to `error` would bury real defects in noise and — once error
 * tracking is wired into log('error') — page someone every time a user opens a page whose
 * profile row does not exist yet.
 *
 *   PGRST116  `.single()` matched no row. Every "does this exist?" query returns it, and
 *             several call sites already branch on it deliberately.
 *   23505     unique violation. claims.ts, messaging.ts and business-data.ts use it on
 *             purpose as an idempotency / race-loser signal.
 *
 * Deliberately NOT listed: PGRST202 (RPC missing from the schema cache). That one is always
 * a real defect — see src/lib/data/businesses.ts, where a missing get_business_cities has
 * been silently degrading every call to a full table scan.
 */
const EXPECTED_SUPABASE_CODES = new Set(['PGRST116', '23505'])

/** GoTrue messages that mean the human typed something wrong, not that we are broken. */
const EXPECTED_AUTH_MESSAGES = [
  'Invalid login credentials',
  'Email not confirmed',
  'Signups not allowed',
  // getUser() on a public endpoint with no session cookie. Ordinary — it is how an
  // anonymous caller is identified as anonymous — and routing it to error would alert on
  // every unauthenticated request to a Server Action.
  'Auth session missing',
]

/**
 * The union of the three error shapes supabase-js returns:
 *   PostgrestError  message, details, hint, code   (no status)
 *   AuthError       message, code?, status?        (no details/hint)
 *   StorageError    message, status?, statusCode?  (no code)
 * `details`/`hint` are typed non-null by postgrest-js but arrive as JSON null on the wire.
 */
export interface SupabaseLikeError {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
  status?: number
  statusCode?: string
}

/**
 * Log a Supabase `{ data, error }` failure.
 *
 * supabase-js RESOLVES with an error instead of throwing, so the `catch` block that every
 * action already has never runs for an RLS denial (42501), a missing column (42703) or a
 * missing RPC (PGRST202) — the failures that matter most. Call this as the first statement
 * of every `if (error)` branch.
 */
export function logSupabaseError(
  action: string,
  error: SupabaseLikeError,
  context?: LogContext,
): void {
  const expected =
    (error.code !== undefined && EXPECTED_SUPABASE_CODES.has(error.code)) ||
    EXPECTED_AUTH_MESSAGES.some((m) => error.message.includes(m))

  log(expected ? 'debug' : 'error', `${action}: supabase error`, {
    ...context,
    action,
    code: error.code,
    details: error.details ?? undefined,
    hint: error.hint ?? undefined,
    status: error.status,
    statusCode: error.statusCode,
    error: error.message,
  })
}
