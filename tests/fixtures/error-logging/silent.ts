/**
 * Fixture for scripts/check-error-logging.ts — a Supabase error branch that logs NOTHING.
 * The scanner must report this file at the `if (error) {` line. If it ever stops doing so the
 * gate has gone decorative, which is what tests/unit/errorLoggingGate.test.ts exists to catch.
 *
 * Do not "fix" this file. The silence is the fixture.
 */
declare function query(): Promise<{
  data: string | null
  error: { message: string } | null
}>

export async function readsAndSwallows(): Promise<string | null> {
  const { data, error } = await query()
  if (error) {
    return null
  }
  return data
}
