/**
 * A Supabase / PostgREST / Postgres error, as a sentence a user may see.
 *
 * PostgREST error text names tables, columns, constraints and policies ("new row violates
 * row-level security policy for table \"claims\""). Returned from a Server Action it lands
 * in the browser, which hands a stranger a map of the schema. This maps the codes a user can
 * actually hit to plain sentences and never returns the database's own text: anything it
 * does not recognise gets the caller's `fallback`, which should say what failed in the
 * caller's own terms ("We couldn't save your profile.").
 *
 * Log the raw error with logSupabaseError() first; this is only the user-facing half.
 */
export function publicErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''

  if (code === '42501') return "You don't have permission to do that."
  // PGRST301-303: the session's JWT is missing, malformed or expired.
  if (/^PGRST30\d$/.test(code)) {
    return 'Your session has expired. Please sign in again.'
  }
  if (code === 'PGRST116') return "We couldn't find that."
  if (code === '23505') return 'That has already been saved.'
  if (code === '23503') {
    return 'Something this depends on no longer exists. Refresh the page and try again.'
  }
  // Raised by database-side rate limits (PostgREST turns PTxyz into HTTP xyz).
  if (code === 'PT429') return 'Too many requests. Please try again later.'
  return fallback
}
