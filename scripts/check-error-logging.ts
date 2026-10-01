/**
 * Fails the gate when a Supabase `if (error)` branch returns without logging.
 *
 * Issue #28: supabase-js RESOLVES with `{ data, error }` instead of throwing, so the
 * `catch` block every server action already has never fires for the failures that matter
 * most — an RLS denial (42501), a missing column (42703), a missing RPC (PGRST202). The
 * branch that *does* know about them used to say nothing, so 120 of them were silent and
 * a missing `get_business_cities` RPC degraded every call to a full table scan unnoticed
 * for months.
 *
 * Adding `logSupabaseError(...)` to 120 branches fixes today. This script is what stops it
 * drifting back: nothing in the type system or the linter can tell a branch that logs from
 * one that does not.
 *
 * Run: npx tsx scripts/check-error-logging.ts
 *      npx tsx scripts/check-error-logging.ts <dir>...   scan these roots instead
 *
 * The argument form exists so the scanner can be pointed at a fixture tree and proved to still
 * catch a silent branch — a matcher that quietly stops matching exits 0 and prints a success
 * message, which is the one way this gate can fail without anyone noticing. See
 * tests/unit/errorLoggingGate.test.ts.
 *
 * The pre-push gate (scripts/gate.sh) runs it on every push.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Server-only trees where a Supabase result is handled. */
const DEFAULT_ROOTS = ['src/lib/actions', 'src/lib/data', 'src/lib/auth']
const ROOTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_ROOTS

/**
 * A branch keyed on something error-shaped. Deliberately narrow: it matches the
 * `if (fooError) {` / `if (fooError || !row) {` shape the actions actually use, at the
 * start of a line. It cannot see a discarded result (`const { data } = await ...`), a
 * ternary, or anything outside ROOTS — those are known blind spots, not silent passes.
 */
const BRANCH = /^\s*if \(\s*!?\s*((?:[A-Za-z_$][\w$]*)?[Ee]rror)\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full)
  }
  return out
}

function scan(): { file: string; line: number; text: string }[] {
  const misses: { file: string; line: number; text: string }[] = []

  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n')

      lines.forEach((line, i) => {
        if (!BRANCH.test(line)) return

        // A nested re-test of an error already logged by the enclosing branch
        // (`if (error.code === 'PGRST116')`) is not a separate site.
        if (/\.(code|message|status|statusCode)\b/.test(line)) return

        // The log call sits either inside the branch, or — for the `|| !row` form, which
        // also fires with error === null — in a guard just above it. Biome wraps a long
        // guarded call across several lines, so the window has to be generous.
        //
        // Generous windows match the enclosing catch block's logger.error and pass
        // branches that log nothing, so the call must also NAME THIS BRANCH'S error
        // variable. That is what keeps the check honest.
        const ident = line.match(BRANCH)?.[1]
        const from = Math.max(0, i - 8)
        const window = lines.slice(from, i + 5)

        const logged = window.some((w, k) => {
          if (!/logSupabaseError\(|logger\.(error|warn)\(/.test(w)) return false
          // The identifier may sit on the call line or on a wrapped argument line.
          return window
            .slice(k, k + 5)
            .some((arg) => new RegExp(`\\b${ident}\\b`).test(arg))
        })
        if (logged) return

        misses.push({ file, line: i + 1, text: line.trim() })
      })
    }
  }
  return misses
}

const misses = scan()

if (misses.length > 0) {
  console.error(
    `Unlogged Supabase error branches: ${misses.length}\n` +
      'supabase-js resolves on error, so the catch block never runs. Call\n' +
      'logSupabaseError(action, error, context) as the first statement of the branch.\n',
  )
  for (const m of misses) {
    console.error(`  ${m.file}:${m.line}  ${m.text}`)
  }
  process.exit(1)
}

console.log('All Supabase error branches log.')
