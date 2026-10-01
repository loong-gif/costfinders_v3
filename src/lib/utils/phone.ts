/**
 * Display formatting for `master_business_info.phone`.
 *
 * The column holds E.164 (`+1XXXXXXXXXX`) because that is what a `tel:` href wants and what
 * deduplicates reliably — 365 of 419 businesses have one, and 17 numbers are shared across chain
 * locations, which only collapses correctly in a canonical form. Nobody reads a phone number that
 * way, so every surface that shows one runs it through here.
 *
 * Two surfaces today: the consumer's post-claim reveal (`businessInfo.tsx`) and the admin lead
 * relay queue (`app/admin/dashboard/leads/page.tsx`). It lives here rather than in either of them
 * because they sit in different layers — a feature component and an app route — and CLAUDE.md's
 * import rules mean neither may import the other.
 */

/**
 * "+19495550123" → "(949) 555-0123". Anything else is returned unchanged.
 *
 * The passthrough is deliberate rather than defensive. `scripts/backfill-business-phone.ts` only
 * ever writes validated NANP numbers, so a value that does not match this shape means the data
 * changed under us — and showing it raw is more useful than showing nothing, which is what a
 * `null` return would force the caller into.
 */
export function formatPhone(e164: string): string {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164
}
