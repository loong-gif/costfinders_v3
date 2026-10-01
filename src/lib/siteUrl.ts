/**
 * Absolute origin for links that leave the app: Supabase auth email redirects
 * and Resend transactional emails. NEXT_PUBLIC_SITE_URL wins, then the Vercel
 * deployment URL, then localhost. Whatever this returns must be on the Supabase
 * Auth "Redirect URLs" allowlist, or auth emails silently fall back to the
 * project's Site URL instead.
 */
export function getSiteOrigin(): string {
  // Trimmed: a Vercel env value can carry a trailing newline (three of this project's did),
  // and this origin is interpolated into auth-email redirect URLs and Resend link targets,
  // where a %0A produces a link that silently does not work.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl}`
  }
  return 'http://localhost:3000'
}

/** Where /auth/callback sends a caller whose `next=` cannot be trusted. */
export const DEFAULT_NEXT_PATH = '/dashboard'

/**
 * Sanitize the `next=` hop on /auth/callback.
 *
 * The callback interpolates this value as `${origin}${next}` right after it exchanges the
 * code for a session, so an unchecked value is an open redirect ON A FRESHLY AUTHENTICATED
 * REQUEST — the worst moment for one. `next=//evil.com` or `next=https://evil.com` both read
 * as absolute to a browser, and the victim arrives at the attacker's page having just signed
 * in, with the referrer (and anything the attacker's page then asks for) in play.
 *
 * Only a same-origin path survives: one leading slash, no second slash anywhere (which is
 * what kills both `//host` and any `scheme://host`), no backslash (some parsers fold `/\host`
 * into `//host`), and no control characters. Anything else falls back to the consumer
 * dashboard, which is a real page for every account that can complete a callback.
 *
 * A path, not an allowlist of exact paths, on purpose: the destination legitimately varies
 * (/dashboard, /business/dashboard, /admin/dashboard, /auth/reset-password) and a session
 * confers no authorization on its own — every one of those routes re-checks the caller's role
 * server-side in src/proxy.ts. Landing on a path this user cannot use costs a redirect, not
 * access.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT_PATH
  if (!next.startsWith('/')) return DEFAULT_NEXT_PATH
  if (next.includes('//') || next.includes('\\')) return DEFAULT_NEXT_PATH
  for (const char of next) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return DEFAULT_NEXT_PATH
  }
  return next
}

/**
 * Where "Request a new link" should send someone.
 *
 * The sign-in surfaces are separate: an expired ADMIN link must not drop the person on the
 * consumer homepage with no way back to /admin. Derived from the same validated `next` the
 * callback passed through.
 */
export function signInHomeFor(next: string): string {
  if (next.startsWith('/admin')) return '/admin'
  if (next.startsWith('/business')) return '/business'
  return '/?signin=required'
}
