/**
 * The gate that guards 121 Supabase error branches, held to the same standard as the code it
 * guards.
 *
 * scripts/check-error-logging.ts is a regex plus a sliding window that nothing typechecks and
 * nothing lints (tsconfig excludes `scripts/`, biome only includes `src/**`). Its one failure
 * mode is silent: a scanner that stops matching finds zero misses, exits 0 and prints "All
 * Supabase error branches log." — so a loosened regex reads exactly like a clean repo. These
 * two assertions are what make that impossible.
 */
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURES = join(REPO, 'tests', 'fixtures', 'error-logging')

/** The line the silent fixture's unlogged branch sits on, read rather than hard-coded. */
function silentBranchLine(): number {
  const lines = readFileSync(join(FIXTURES, 'silent.ts'), 'utf8').split('\n')
  const index = lines.findIndex((line) => /^\s*if \(error\) \{$/.test(line))
  assert.notEqual(
    index,
    -1,
    'silent.ts no longer contains an `if (error) {` branch',
  )
  return index + 1
}

test('the scanner still catches a silent Supabase error branch', () => {
  const run = spawnSync(
    process.execPath,
    [
      join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(REPO, 'scripts', 'check-error-logging.ts'),
      'tests/fixtures/error-logging',
    ],
    { cwd: REPO, encoding: 'utf8' },
  )
  const output = `${run.stdout}${run.stderr}`

  assert.equal(
    run.status,
    1,
    `expected a non-zero exit, got ${run.status}: ${output}`,
  )
  assert.match(
    output,
    new RegExp(
      `tests/fixtures/error-logging/silent\\.ts:${silentBranchLine()}\\b`,
    ),
    'the scanner did not name the silent branch at its actual line',
  )
  // The other half of the guarantee: a branch that logs must NOT be reported, or the gate
  // becomes noise and gets muted.
  assert.doesNotMatch(
    output,
    /logs\.ts/,
    'a branch that logs was reported as a miss',
  )
})
