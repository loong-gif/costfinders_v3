/**
 * Fixture for scripts/check-error-logging.ts — a Supabase error branch that DOES log.
 * The scanner must not report this file. Ambient declarations keep it self-contained so it
 * typechecks without pulling the real data layer in.
 */
declare function logSupabaseError(action: string, error: unknown): void
declare function query(): Promise<{
  data: string | null
  error: { message: string } | null
}>

export async function readsAndLogs(): Promise<string | null> {
  const { data, error } = await query()
  if (error) {
    logSupabaseError('readsAndLogs', error)
    return null
  }
  return data
}
