/**
 * Fails the gate when the live Postgres schema no longer matches the committed snapshot.
 *
 *   npm run schema:check      compare the live schema against supabase/schema-snapshot.json
 *   npm run schema:snapshot   regenerate the snapshot (a reviewable diff in the repo)
 *
 * The logic, and the honest ceiling on what it can see, is in src/lib/gates/schemaDrift.ts. The
 * same check runs as a Vercel cron every 6 hours (/api/cron/gates), because the database moves
 * with no commit, and before every push from the pre-push hook (scripts/gate.sh).
 *
 * Without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY this SKIPS and exits 0,
 * printing why. Read a skip as "unverified", never as "passed".
 */
import { writeFileSync } from 'node:fs'
import {
  captureSchema,
  checkSchemaDrift,
  hardFailureSummary,
  SNAPSHOT_PATH,
} from '@/lib/gates/schemaDrift'

async function main(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.log(
      'SKIPPED — schema drift is UNVERIFIED, not verified: ' +
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.\n' +
        'Set them (see .env.example) to run this gate. The pre-push gate reads them from ' +
        '.env.local.',
    )
    return 0
  }

  if (!process.argv.includes('--write')) {
    const { ok, summary } = await checkSchemaDrift({ url, key })
    if (ok) console.log(summary)
    else console.error(summary)
    return ok ? 0 : 1
  }

  const { snapshot, hardFailures, projectRef } = await captureSchema({
    url,
    key,
  })
  if (hardFailures.length > 0) {
    console.error(hardFailureSummary(hardFailures, projectRef))
    return 1
  }
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `Wrote ${SNAPSHOT_PATH}\n` +
      `  ${Object.keys(snapshot.tables).length} tables, ` +
      `${Object.keys(snapshot.functions).length} functions, ` +
      `${snapshot.vocabulary['clinic_services.service_category'].length} service categories, ` +
      `${snapshot.migrations.length} migration files.\n` +
      '  Commit the diff — it is the record of what changed.',
  )
  return 0
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error('check-schema-drift failed to run:', error)
    process.exit(1)
  },
)
