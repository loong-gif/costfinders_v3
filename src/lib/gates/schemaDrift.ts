/**
 * The schema drift gate: does the live Postgres schema still match the committed snapshot?
 *
 * This is the gate for the failure that caused the 2026-09-09 outage. A second engineering
 * process reshapes this database from outside the repo: 60 migrations are applied and only 14
 * had files, and on 2026-09-05 one of those out-of-band migrations dropped 16 columns from
 * `promo_offer_master`. Nothing in the repo noticed. `npm run lint`, `tsc --noEmit` and
 * `next build` all passed, because the hand-written types still declared the dead columns, and
 * ISR kept serving pre-drift HTML while every on-demand category page threw. The drift arrived
 * with no commit at all, so no push-triggered gate could have caught it — which is why this
 * runs on a schedule as well as before every push:
 *
 *   npm run schema:check      compare the live schema against supabase/schema-snapshot.json
 *                             (scripts/check-schema-drift.ts; the pre-push gate runs it)
 *   npm run schema:snapshot   regenerate the snapshot (a reviewable diff in the repo)
 *   GET /api/cron/gates       the same check as a Vercel cron every 6 hours, alerting on drift
 *
 * An intended schema change is therefore two pieces of recorded intent: the migration file, and
 * a snapshot diff a reviewer can read.
 *
 * WHAT IT COMPARES, and the honest ceiling on each
 * ------------------------------------------------
 * Everything below is observed through PostgREST with the anon key — the same credential the
 * app uses and the only one the gate and the cron already hold. Supabase restricts the OpenAPI root endpoint to
 * `service_role` and PostgREST exposes only the `public` schema, so this script cannot read
 * `information_schema`, `pg_proc` or `pg_policies`. What it does instead, per item:
 *
 * - **Columns** — exact, live. A missing column is a hard 42703 at parse time, which PostgREST
 *   raises even on a table the anon role cannot read at all. This is the check that would have
 *   caught the outage in under two seconds.
 * - **Types** — coarse. Sampled from live rows as a JS `typeof`, so `numeric` vs `int4` is
 *   invisible, but `boolean` becoming `text` (a `'false'` string is truthy) is not. Compared
 *   only where BOTH the snapshot and the live sample resolved a non-null value, so a sparsely
 *   populated column is skipped rather than reported as churn.
 *   ponytail: true pg types and nullability need a catalog read. Upgrade path — a
 *   `SECURITY DEFINER` introspection function granted to `service_role` only, plus a
 *   `SUPABASE_SERVICE_ROLE_KEY` in the gate's environment. Deliberately not done: it adds privileged surface to
 *   a database whose grants have just been tightened, and the column check above already covers
 *   the class of drift that actually broke production.
 * - **RLS-enabled state and policy count** — NOT read; substituted by something strictly more
 *   useful to the app and strictly weaker for auditing. Each table records the anon role's
 *   observed access: `public` (rows come back), `empty` (200 with no rows — RLS hides them, or
 *   the table is genuinely empty) or `denied` (42501, the grant is revoked). That is the
 *   *effect* of RLS plus grants plus policies as a visitor experiences it, so a vanished
 *   policy, a new permissive one, or a revoked grant all move it. Blind spot: on a table with
 *   zero rows `empty` cannot distinguish "RLS is holding" from "a permissive policy over no
 *   data", so a table only becomes honest here once it has rows.
 * - **Functions** — exact, live, and side-effect-free. Each function the generated types
 *   declare is POSTed with its real parameter names and a sentinel value. PostgREST resolves
 *   the signature before Postgres executes anything, so a privileged function answers 42501
 *   (`denied` — it exists) and a dropped or renamed one answers PGRST202 (`missing`). The
 *   recorded access class also moves if someone grants `anon` execute on an admin function.
 *   ponytail: a function whose parameters are ALL text-typed does execute, because a sentinel
 *   string is valid text. The only one on this project is a read
 *   (`get_business_count_for_city`). If a write function ever takes only text parameters, add
 *   it to SKIP_PROBE below.
 * - **Migration files** — repo-side only, matched on NAME with the version prefix stripped.
 *   `supabase/migrations/README.md` documents that the ledger assigns its own timestamp at
 *   apply time, so file versions never match ledger versions; comparing versions would report
 *   every file as unapplied. Comparing the *ledger* would need
 *   `supabase_migrations.schema_migrations`, which is not in the `public` schema and so is not
 *   reachable with the anon key — that half is owner-blocked on a credential. What this does
 *   catch is a migration file landing without a regenerated snapshot, which is the discipline
 *   the whole gate exists to enforce.
 * - **Category vocabulary** — the distinct `clinic_services.service_category` values, read off
 *   `public_offers` (anon cannot read clinic_services since 20260924050002). Not
 *   schema, but the app's two taxonomy maps are keyed on it and a silent fallthrough there has
 *   now caused two outages, so it is part of the contract. tests/unit/categoryTaxonomy.test.ts
 *   asserts the maps are exhaustive against this list without touching the database.
 * - **Unit vocabulary** — the distinct `clinic_services.unit_type` values, for the same reason.
 *   `PRICE_UNITS` in src/lib/data/adapters.ts decides which values are pricing units
 *   (`package` is deliberately not one: it names a shape), and offerPriceBasis() takes a
 *   `per_unit` row's unit from `unit_type` only when it is in that list. A new value ("ml")
 *   would silently turn every "$X/ml" rate into a rate with no unit, which no surface can
 *   compare or print. tests/unit/guideStats.test.ts fails on any value in this list that
 *   `PRICE_UNITS` neither accepts nor deliberately excludes.
 *
 * DEGRADED MODE
 * -------------
 * With NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absent the CLI SKIPS and exits
 * 0, printing why. That is deliberate — a contributor without credentials must not be blocked —
 * but it means a gate run that loses its credentials goes quiet rather than red. The skip line
 * says so explicitly; read it as "unverified", never as "passed". The cron route has no skip: it
 * answers 500 without them.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ponytail: the project root is the working directory. `npm run` guarantees it for the CLI, and
// on Vercel a function runs from the project root with the two inputs below shipped beside it by
// `outputFileTracingIncludes` in next.config.ts. Run the script from anywhere else and the reads
// below fail loudly rather than check nothing.
const REPO = process.cwd()
export const SNAPSHOT_PATH = join(REPO, 'supabase', 'schema-snapshot.json')
const GENERATED_TYPES = join(REPO, 'src', 'types', 'supabase.generated.ts')
const MIGRATIONS_DIR = join(REPO, 'supabase', 'migrations')

/** A value that is valid `text` and invalid for every other type Postgres casts to. */
const SENTINEL = '__schema_drift_probe__'

/** Functions that must never be probed because a sentinel call would mutate data. */
const SKIP_PROBE = new Set<string>()

/** Rows sampled per table to observe column types. Small: a miss costs a skipped compare. */
const TYPE_SAMPLE = 50

type Access = 'public' | 'empty' | 'denied'

interface TableSnapshot {
  access: Access
  columns: string[]
  /** Column to observed JS type. Absent for a column with no non-null value in the sample. */
  types: Record<string, string>
}

interface FunctionSnapshot {
  args: string[]
  access: 'callable' | 'denied'
}

export interface Snapshot {
  capturedAt: string
  project: string
  note: string
  tables: Record<string, TableSnapshot>
  functions: Record<string, FunctionSnapshot>
  vocabulary: Record<string, string[]>
  migrations: string[]
}

// ---------------------------------------------------------------------------
// The repo's declared contract, parsed out of the generated types.
// ---------------------------------------------------------------------------

interface Declared {
  tables: Record<string, string[]>
  functions: Record<string, string[]>
}

/** Parameter names out of a generated `Args: never` / `Args: { a: string; b?: number }` clause. */
function argNamesFrom(clause: string): string[] {
  if (/Args: never/.test(clause)) return []
  const block = /Args: \{([^}]*)\}/.exec(clause)
  if (!block) return []
  return block[1]
    .split(';')
    .map((part) => /(\w+)\??:/.exec(part.trim())?.[1])
    .filter((name): name is string => Boolean(name))
}

/**
 * Reads table (and view) -> column names and function -> parameter names out of
 * `src/types/supabase.generated.ts`.
 *
 * ponytail: line-oriented, not a TS parse. The file is machine-generated by the Supabase type
 * generator, so its indentation is fixed — 6 spaces for a table or function, 8 for `Row:` /
 * `Args:`, 10 for a field. If the generator's formatting ever changes this throws on an empty
 * result rather than silently checking nothing.
 */
/**
 * Tables the ingestion pipeline leaves lying in `public` as working state, not schema.
 *
 * On 2026-09-16 it had 22 of them — `qa_itemname_mismatch`, `qa_outlier_by_service`,
 * `bak_20260916_promo_offer_master`, … — created and dropped as its QA passes run. Three
 * concrete problems if the gate tracks them:
 *
 *  1. They are in `src/types/supabase.generated.ts` (the generator reads the catalog), but
 *     PostgREST's schema cache lags behind their creation, so probing one 404s PGRST205 and
 *     `npm run schema:snapshot` dies outright — which is how this exclusion was found.
 *  2. Every regeneration would churn the snapshot with tables nothing in the app reads.
 *  3. Noise in this gate is how a real drift line gets skimmed past.
 *
 * BLIND SPOT, stated plainly: a real application table named `qa_*` or `bak_*` would be
 * invisible here. Nothing in the app reads a table with either prefix, and the convention is
 * the pipeline's, not ours.
 */
const SCRATCH_TABLE_PREFIXES = ['qa_', 'bak_']

const isScratchTable = (name: string): boolean =>
  SCRATCH_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix))

function readDeclaredSchema(): Declared {
  const lines = readFileSync(GENERATED_TYPES, 'utf8').split('\n')
  const tables: Record<string, string[]> = {}
  const functions: Record<string, string[]> = {}

  let section: 'none' | 'tables' | 'functions' = 'none'
  let entry: string | null = null
  let inBlock = false

  for (const line of lines) {
    // Views are probed like tables: public_offers and public_business_directory are the only
    // catalogue relations anon may read (20260924050001/2), so they are the contract now.
    if (/^ {4}(Tables|Views): \{$/.test(line)) {
      section = 'tables'
      entry = null
      continue
    }
    if (/^ {4}Functions: \{$/.test(line)) {
      section = 'functions'
      entry = null
      continue
    }
    if (/^ {4}(Enums|CompositeTypes): \{$/.test(line)) {
      section = 'none'
      entry = null
      continue
    }
    if (section === 'none') continue

    // A whole entry on one line, which the generator emits for a short signature:
    // `      is_admin: { Args: never; Returns: boolean }`
    const inline = /^ {6}(\w+): \{(.+)\}$/.exec(line)
    if (inline && section === 'functions') {
      functions[inline[1]] = argNamesFrom(inline[2])
      entry = null
      inBlock = false
      continue
    }

    const open = /^ {6}(\w+): \{$/.exec(line)
    if (open) {
      entry = open[1]
      inBlock = false
      if (section === 'tables') {
        if (isScratchTable(entry)) {
          entry = null
          continue
        }
        tables[entry] = []
      } else functions[entry] = []
      continue
    }
    if (!entry) continue

    if (section === 'tables') {
      if (/^ {8}Row: \{$/.test(line)) {
        inBlock = true
        continue
      }
      if (inBlock && /^ {8}\}$/.test(line)) {
        inBlock = false
        continue
      }
      if (inBlock) {
        const field = /^ {10}(\w+)\??:/.exec(line)
        if (field) tables[entry].push(field[1])
      }
      continue
    }

    // Functions: `Args: never`, a one-line `Args: { a: string; b?: number }`, or a block.
    if (/^ {8}Args: \{.+\}$/.test(line)) {
      functions[entry] = argNamesFrom(line)
      continue
    }
    if (/^ {8}Args: \{$/.test(line)) {
      inBlock = true
      continue
    }
    if (/^ {8}Args: never$/.test(line)) {
      functions[entry] = []
      continue
    }
    if (inBlock && /^ {8}\}$/.test(line)) {
      inBlock = false
      continue
    }
    if (inBlock) {
      const arg = /^ {10}(\w+)\??:/.exec(line)
      if (arg) functions[entry].push(arg[1])
    }
  }

  const tableCount = Object.keys(tables).length
  const fnCount = Object.keys(functions).length
  if (tableCount === 0 || fnCount === 0) {
    throw new Error(
      `Parsed ${tableCount} tables and ${fnCount} functions out of ${GENERATED_TYPES}. ` +
        "The generated file's shape changed; fix readDeclaredSchema() rather than letting " +
        'this gate check nothing.',
    )
  }
  return { tables, functions }
}

function readMigrationNames(): string[] {
  return (
    readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      // The ledger stamps its own version at apply time (see migrations/README.md), so the
      // version prefix is meaningless for matching. Compare on name.
      .map((f) => f.replace(/^\d+_/, '').replace(/\.sql$/, ''))
      .sort()
  )
}

// ---------------------------------------------------------------------------
// Live probing.
// ---------------------------------------------------------------------------

interface RestResult {
  status: number
  code?: string
  message?: string
  body: unknown
}

function makeRest(url: string, key: string) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  return async function rest(
    path: string,
    init?: { method?: 'GET' | 'POST'; body?: unknown },
  ): Promise<RestResult> {
    const response = await fetch(`${base}/${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const text = await response.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // A non-JSON body is itself the diagnostic; keep the text.
    }
    const err =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { code?: string; message?: string })
        : null
    return {
      status: response.status,
      code: err?.code,
      message: err?.message,
      body,
    }
  }
}

type Rest = ReturnType<typeof makeRest>

/** The column named by a 42703, or null if the message is not shaped as expected. */
function missingColumnFrom(message: string | undefined): string | null {
  if (!message) return null
  const named = /column [\w.]*?"?(\w+)"? does not exist/.exec(message)
  return named ? named[1] : null
}

/**
 * Which of `candidates` the live table actually has: ask for all of them at once and drop
 * whichever column the 42703 names until the select parses. One request per missing column.
 */
async function verifyColumns(
  rest: Rest,
  table: string,
  candidates: string[],
): Promise<{ present: string[]; missing: string[] }> {
  let remaining = [...candidates]
  const missing: string[] = []

  for (let attempt = 0; attempt <= candidates.length; attempt += 1) {
    if (remaining.length === 0) break
    const result = await rest(`${table}?select=${remaining.join(',')}&limit=0`)
    if (result.code !== '42703') break
    const bad = missingColumnFrom(result.message)
    if (!bad || !remaining.includes(bad)) {
      throw new Error(
        `${table}: unparseable 42703 while verifying columns: ${result.message}`,
      )
    }
    missing.push(bad)
    remaining = remaining.filter((c) => c !== bad)
  }
  return { present: remaining, missing }
}

async function probeTable(
  rest: Rest,
  table: string,
  declared: string[],
): Promise<{ snapshot: TableSnapshot; missing: string[] }> {
  const sample = await rest(`${table}?select=*&limit=${TYPE_SAMPLE}`)

  if (sample.status === 401 || sample.status === 403) {
    const { present, missing } = await verifyColumns(rest, table, declared)
    return {
      snapshot: { access: 'denied', columns: present.sort(), types: {} },
      missing,
    }
  }

  if (sample.status >= 400) {
    throw new Error(
      `${table}: unexpected ${sample.status} ${sample.code ?? ''} ${sample.message ?? ''}`,
    )
  }

  const rows = Array.isArray(sample.body)
    ? (sample.body as Record<string, unknown>[])
    : []

  if (rows.length === 0) {
    const { present, missing } = await verifyColumns(rest, table, declared)
    return {
      snapshot: { access: 'empty', columns: present.sort(), types: {} },
      missing,
    }
  }

  // Live rows enumerate the real columns, so they answer both directions at once: a declared
  // column that is gone, and a live column the repo never declared.
  const live = new Set<string>()
  const types: Record<string, string> = {}
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      live.add(column)
      if (value === null || column in types) continue
      types[column] = Array.isArray(value) ? 'array' : typeof value
    }
  }
  return {
    snapshot: {
      access: 'public',
      columns: [...live].sort(),
      types: Object.fromEntries(Object.entries(types).sort()),
    },
    missing: declared.filter((c) => !live.has(c)),
  }
}

async function probeFunction(
  rest: Rest,
  name: string,
  args: string[],
): Promise<FunctionSnapshot | 'missing'> {
  if (SKIP_PROBE.has(name)) return { args, access: 'denied' }
  const body = Object.fromEntries(args.map((arg) => [arg, SENTINEL]))
  const result = await rest(`rpc/${name}`, { method: 'POST', body })
  // PostgREST resolves the signature from the parameter names before Postgres runs anything,
  // so PGRST202 is the one answer that means "this function no longer exists as called".
  if (result.code === 'PGRST202') return 'missing'
  if (result.status === 401 || result.status === 403) {
    return { args, access: 'denied' }
  }
  return { args, access: 'callable' }
}

/**
 * Distinct non-null values of one `clinic_services` column, as the public catalogue carries them
 * (`public_offers.promo_offer_items[].clinic_services`), paged to exhaustion. anon cannot read
 * clinic_services itself since 20260924050002. On 2026-09-24 the active-offer vocabulary equalled
 * the whole table's (7 units, 10 categories).
 * ponytail: a value used only by inactive offers is invisible here, as it is on the site.
 */
async function probeVocabulary(rest: Rest, column: string): Promise<string[]> {
  const seen = new Set<string>()
  const page = 1000
  for (let from = 0; ; from += page) {
    const result = await rest(
      `public_offers?select=promo_offer_items&order=id.asc&offset=${from}&limit=${page}`,
    )
    if (result.status >= 400) {
      throw new Error(
        `public_offers (clinic_services.${column}): ${result.status} ${result.code ?? ''} ${result.message ?? ''}`,
      )
    }
    const rows = (result.body ?? []) as {
      promo_offer_items:
        | { clinic_services: Record<string, string | null> | null }[]
        | null
    }[]
    for (const row of rows) {
      for (const item of row.promo_offer_items ?? []) {
        const value = item.clinic_services?.[column]
        if (value) seen.add(value)
      }
    }
    if (rows.length < page) break
  }
  return [...seen].sort()
}

// ---------------------------------------------------------------------------
// Capture and compare.
// ---------------------------------------------------------------------------

interface Capture {
  snapshot: Snapshot
  /**
   * A column or function the repo declares and the database does not have. Always a failure,
   * with or without a snapshot — and never recordable, so the snapshot cannot enshrine a
   * broken state.
   */
  hardFailures: string[]
}

async function capture(
  rest: Rest,
  projectRef: string,
  declared: Declared,
): Promise<Capture> {
  const hardFailures: string[] = []
  const tables: Record<string, TableSnapshot> = {}
  const functions: Record<string, FunctionSnapshot> = {}

  const tableNames = Object.keys(declared.tables).sort()
  const probed = await Promise.all(
    tableNames.map((table) => probeTable(rest, table, declared.tables[table])),
  )
  tableNames.forEach((table, index) => {
    const { snapshot, missing } = probed[index]
    tables[table] = snapshot
    for (const column of missing) {
      hardFailures.push(
        `${table}.${column} is declared in src/types/supabase.generated.ts but does not exist in the database`,
      )
    }
  })

  const fnNames = Object.keys(declared.functions).sort()
  const fnResults = await Promise.all(
    fnNames.map((fn) => probeFunction(rest, fn, declared.functions[fn])),
  )
  fnNames.forEach((fn, index) => {
    const result = fnResults[index]
    if (result === 'missing') {
      hardFailures.push(
        `${fn}(${declared.functions[fn].join(', ')}) is declared in src/types/supabase.generated.ts but does not resolve in the database`,
      )
      return
    }
    functions[fn] = result
  })

  return {
    snapshot: {
      capturedAt: new Date().toISOString(),
      project: projectRef,
      note:
        'The anon-observable schema contract. Regenerate deliberately with ' +
        '`npm run schema:snapshot` so an intended change is a reviewable diff. See ' +
        'scripts/check-schema-drift.ts for what each field means and what it cannot see.',
      tables,
      functions,
      vocabulary: {
        'clinic_services.service_category': await probeVocabulary(
          rest,
          'service_category',
        ),
        'clinic_services.unit_type': await probeVocabulary(rest, 'unit_type'),
      },
      migrations: readMigrationNames(),
    },
    hardFailures,
  }
}

function diffSets(
  label: string,
  before: string[],
  after: string[],
  out: string[],
): void {
  for (const value of before.filter((v) => !after.includes(v))) {
    out.push(`${label}: ${value} is gone from the database`)
  }
  for (const value of after.filter((v) => !before.includes(v))) {
    out.push(`${label}: ${value} is new in the database`)
  }
}

export function compare(before: Snapshot, after: Snapshot): string[] {
  const drift: string[] = []

  diffSets(
    'table',
    Object.keys(before.tables),
    Object.keys(after.tables),
    drift,
  )

  for (const [table, was] of Object.entries(before.tables)) {
    const now = after.tables[table]
    if (!now) continue
    if (was.access !== now.access) {
      drift.push(
        `${table}: the anon role's access changed from ${was.access} to ${now.access} ` +
          '(a policy, a grant, or the row count crossing zero)',
      )
    }
    diffSets(`${table} column`, was.columns, now.columns, drift)
    for (const [column, wasType] of Object.entries(was.types)) {
      const nowType = now.types[column]
      // Only compare where both sides resolved a non-null sample; anything else is sample
      // sparsity, not drift.
      if (nowType && nowType !== wasType) {
        drift.push(`${table}.${column}: ${wasType} became ${nowType}`)
      }
    }
  }

  diffSets(
    'function',
    Object.keys(before.functions),
    Object.keys(after.functions),
    drift,
  )
  for (const [fn, was] of Object.entries(before.functions)) {
    const now = after.functions[fn]
    if (!now) continue
    if (was.access !== now.access) {
      drift.push(
        `${fn}: the anon role's execute access changed from ${was.access} to ${now.access}`,
      )
    }
    if (was.args.join(',') !== now.args.join(',')) {
      drift.push(
        `${fn}: parameters changed from (${was.args.join(', ')}) to (${now.args.join(', ')})`,
      )
    }
  }

  for (const [key, wasValues] of Object.entries(before.vocabulary)) {
    diffSets(key, wasValues, after.vocabulary[key] ?? [], drift)
  }

  // Repo-side, not live: a new migration file with no regenerated snapshot.
  for (const name of after.migrations.filter(
    (m) => !before.migrations.includes(m),
  )) {
    drift.push(
      `migration file ${name} is in the repo but the snapshot predates it — run \`npm run schema:snapshot\``,
    )
  }
  for (const name of before.migrations.filter(
    (m) => !after.migrations.includes(m),
  )) {
    drift.push(`migration file ${name} was removed from the repo`)
  }

  return drift
}

// ---------------------------------------------------------------------------
// Entry points: the CLI (scripts/check-schema-drift.ts) and the cron (/api/cron/gates).
// ---------------------------------------------------------------------------

export interface SupabasePublicEnv {
  url: string
  key: string
}

/** Probe the live database. `--write` records this; the check compares it. */
export async function captureSchema({
  url,
  key,
}: SupabasePublicEnv): Promise<Capture & { projectRef: string }> {
  const projectRef = /https:\/\/([^.]+)\./.exec(url)?.[1] ?? url
  const captured = await capture(
    makeRest(url.trim(), key.trim()),
    projectRef,
    readDeclaredSchema(),
  )
  return { ...captured, projectRef }
}

/** A declared column or function the database lacks. Never recordable, so `--write` prints it too. */
export function hardFailureSummary(
  hardFailures: string[],
  projectRef: string,
): string {
  return [
    `The database does not have what the repo declares (${hardFailures.length}):\n`,
    ...hardFailures.map((failure) => `  ${failure}`),
    '\nRegenerate the types from the live schema (`supabase gen types typescript ' +
      `--project-id ${projectRef}\` into src/types/supabase.generated.ts), then fix the call ` +
      'sites tsc points at. Do NOT hand-edit the types to match.',
  ].join('\n')
}

export interface SchemaDriftResult {
  ok: boolean
  /** Hard failures, or drift lines; empty when ok. */
  differences: string[]
  /** What the CLI prints and the cron alerts with. */
  summary: string
}

export async function checkSchemaDrift(
  env: SupabasePublicEnv,
): Promise<SchemaDriftResult> {
  const { snapshot, hardFailures, projectRef } = await captureSchema(env)

  if (hardFailures.length > 0) {
    return {
      ok: false,
      differences: hardFailures,
      summary: hardFailureSummary(hardFailures, projectRef),
    }
  }

  // A literal-path import, so the bundler ships the committed snapshot inside the cron function.
  // Loaded here rather than at the top so `npm run schema:snapshot` still runs when the file is
  // missing or conflicted, which is exactly when it is needed.
  let before: Snapshot
  try {
    before = (await import('../../../supabase/schema-snapshot.json'))
      .default as unknown as Snapshot
  } catch {
    return {
      ok: false,
      differences: [],
      summary:
        `No readable snapshot at ${SNAPSHOT_PATH}. Create one with ` +
        '`npm run schema:snapshot` and commit it.',
    }
  }

  const drift = compare(before, snapshot)
  if (drift.length > 0) {
    return {
      ok: false,
      differences: drift,
      summary: [
        'Schema drift: the live database no longer matches supabase/schema-snapshot.json ' +
          `(${drift.length} difference${drift.length === 1 ? '' : 's'}).\n` +
          `Snapshot captured ${before.capturedAt}.\n`,
        ...drift.map((line) => `  ${line}`),
        '\nIf the change was intended: ship it as a tracked migration under ' +
          'supabase/migrations/, regenerate the types, run `npm run schema:snapshot`, and commit ' +
          'the snapshot diff in the same change. If it was NOT intended, the database moved ' +
          'without the repo — find out who applied it before touching anything.',
      ].join('\n'),
    }
  }

  return {
    ok: true,
    differences: [],
    summary:
      'Live schema matches supabase/schema-snapshot.json: ' +
      `${Object.keys(snapshot.tables).length} tables, ` +
      `${Object.keys(snapshot.functions).length} functions, ` +
      `${snapshot.vocabulary['clinic_services.service_category'].length} service categories.`,
  }
}
