/**
 * Fails the gate when the live offers contain a NEW priced row the site cannot label truthfully.
 *
 *   npm run prices:check      compare against supabase/price-defects-baseline.json
 *   npm run prices:baseline   rewrite the baseline (a reviewable diff in the repo)
 *
 * The logic, and why it is a ratchet rather than zero-tolerance, is in
 * src/lib/gates/priceBasis.ts. The same check runs as a Vercel cron every 6 hours
 * (/api/cron/gates), because pipeline writes arrive with no commit, and before every push from
 * the pre-push hook (scripts/gate.sh).
 */
import { writeFileSync } from 'node:fs'

async function main(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log(
      'SKIPPED — price labels are UNVERIFIED, not verified: ' +
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.',
    )
    return 0
  }

  // Imported here, not at the top: @/lib/supabase throws at import without the two env vars,
  // and a missing variable must SKIP loudly rather than crash.
  const { BASELINE_PATH, checkPriceBasis, findPriceDefects } = await import(
    '@/lib/gates/priceBasis'
  )

  if (process.argv.includes('--write')) {
    const { found, offers } = await findPriceDefects({ url, key })
    writeFileSync(BASELINE_PATH, `${JSON.stringify(found, null, 2)}\n`)
    console.log(
      `Wrote ${BASELINE_PATH}: ${Object.entries(found)
        .map(([defect, ids]) => `${defect} ${ids.length}`)
        .join(', ')} ` +
        `(of ${offers.length} visible priced offers). Commit the diff.`,
    )
    return 0
  }

  const { ok, notice, summary } = await checkPriceBasis({ url, key })
  if (notice) console.log(notice)
  if (ok) console.log(summary)
  else console.error(summary)
  return ok ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)
