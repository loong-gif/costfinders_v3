/**
 * Supabase environment access.
 *
 * The values must be read as STATIC `process.env.NEXT_PUBLIC_*` property accesses at each call
 * site and passed in here. Next inlines `NEXT_PUBLIC_*` at build time, so a dynamic
 * `process.env[name]` lookup resolves to undefined at runtime — a helper that took variable
 * names would throw on every request, including inside the proxy, taking down every
 * authenticated route.
 *
 * Replaces non-null assertions that hid a real failure mode: with the vars missing, the app
 * previously failed deep inside the Supabase client with a confusing error instead of saying
 * which variable was absent.
 */
export function assertSupabaseEnv(
  url: string | undefined,
  anonKey: string | undefined,
): { url: string; anonKey: string } {
  // Trimmed before anything else looks at them. All three of this project's NEXT_PUBLIC_*
  // values were stored in Vercel with a trailing newline; the key went out as
  // `apikey=…%0A` (Realtime websocket 401) and the URL reached a response header, where an
  // embedded LF makes Node throw ERR_INVALID_CHAR and every function route 500. Trimming
  // first also means a whitespace-only value is reported as missing rather than passed on.
  const trimmedUrl = url?.trim()
  const trimmedAnonKey = anonKey?.trim()

  const missing: string[] = []
  if (!trimmedUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!trimmedAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (missing.length > 0 || !trimmedUrl || !trimmedAnonKey) {
    throw new Error(
      `Missing required environment ${
        missing.length === 1 ? 'variable' : 'variables'
      }: ${missing.join(', ')}. See .env.example.`,
    )
  }

  return { url: trimmedUrl, anonKey: trimmedAnonKey }
}
