/**
 * Populate `master_business_info.phone` — the one thing the contact reveal is missing.
 *
 * WHY THIS SCRIPT EXISTS
 * A consumer creates an account, claims a deal, and gets back a name and a street address, while
 * `/terms` tells them "A claim shares your contact details with that business". There has never
 * been a business phone number in this database (see
 * supabase/migrations/20260916020001_add_business_phone.sql).
 *
 * WHY GOOGLE BUSINESS PROFILE FIRST AND RENDERED PAGES NEVER
 * Med-spas are one of the heaviest users of call-tracking. CallRail, CallTrackingMetrics, Invoca
 * and WhatConverts all work the same way: the HTML ships the clinic's real number, and JavaScript
 * replaces it in the DOM per visitor so the marketing agency can attribute the call. So:
 *
 *   1. Google Business Profile, via DataForSEO — the number the clinic itself publishes to Google.
 *      Authoritative, and immune to the swap entirely.
 *   2. Raw, UNEXECUTED website HTML — only when no GBP match is found. This is the pre-swap number,
 *      which is the clinic's line. We never run the page's JavaScript and never use a headless
 *      browser, because doing so would collect precisely the number we are trying to avoid.
 *
 * `phone_source` records which path won, so a bad batch from one source can be re-run without
 * touching the good rows from the other.
 *
 * WHAT IT WILL NOT DO
 * It will not guess. A candidate that fails NANP validation, or a page that only yields a number
 * belonging to a known tracking vendor, is left NULL and reported. A NULL phone renders as no
 * phone; a wrong phone sends a customer to a stranger.
 *
 * ---------------------------------------------------------------------------------------------
 * USAGE
 *
 *   npx tsx scripts/backfill-business-phone.ts --probe 765     # one business, print raw shapes
 *   npx tsx scripts/backfill-business-phone.ts                 # dry run, all, writes nothing
 *   npx tsx scripts/backfill-business-phone.ts --limit 25      # dry run, first 25
 *   npx tsx scripts/backfill-business-phone.ts --apply         # write to the database
 *   npx tsx scripts/backfill-business-phone.ts --sql out.sql   # emit UPDATEs instead of writing
 *
 * Flags: --probe <id> | --apply | --dry-run (default) | --limit <n> | --sql <path>
 *        --source gbp|html|both (default both) | --concurrency <n> (default 4)
 *
 * ENVIRONMENT
 *   NEXT_PUBLIC_SUPABASE_URL          required
 *   SUPABASE_SERVICE_ROLE_KEY         required for --apply. master_business_info has RLS enabled
 *                                     and NO UPDATE policy, so the anon key cannot write this
 *                                     column and will fail silently with zero rows updated.
 *                                     Without it, use --sql and apply the file.
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY     enough to READ, i.e. enough for a dry run.
 *   DATAFORSEO_USERNAME / _PASSWORD   required for the GBP path. Without them the script runs
 *                                     HTML-only and says so.
 *
 * RUN --probe FIRST. The DataForSEO response shape is validated against one live business before
 * 419 paid requests are spent; --probe prints what came back and exits.
 *
 * COST: DataForSEO google/my_business_info live is $0.0054 per request. 419 businesses is ~$2.26.
 * The script skips any business that already has a phone, so a re-run after a partial failure
 * costs only the remainder.
 */
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Pure helpers. Exported for tests/unit/phoneExtraction.test.ts — everything below
// this block does I/O and is not unit-testable, so the judgement lives up here.
// ---------------------------------------------------------------------------

/**
 * Known call-tracking vendors. A number that only appears inside one of these vendors' markup is
 * the vendor's, not the clinic's, and must not be stored. Matched against the raw HTML.
 */
export const TRACKING_VENDOR_MARKERS = [
  'callrail',
  'calltrackingmetrics',
  'invoca',
  'whatconverts',
  'marchex',
  'dialogtech',
  'convirza',
  'retreaver',
  'phonewagon',
  'callsource',
] as const

/**
 * Normalise a human-written North American number to E.164, or null.
 *
 * Deliberately strict. NANP forbids 0 and 1 as the first digit of both the area code and the
 * exchange code, which is what rules out the false positives that a bare 10-digit regex collects
 * from a page: prices ("1 800 000"), dates, licence numbers, zip+4 runs and tracking IDs. A
 * number that fails these rules is not a phone number we are willing to print.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  let national: string
  if (digits.length === 10) national = digits
  else if (digits.length === 11 && digits.startsWith('1'))
    national = digits.slice(1)
  else return null

  const area = national.slice(0, 3)
  const exchange = national.slice(3, 6)

  // NANP: N in NXX is 2-9 for both the area code and the exchange code.
  if (area[0] === '0' || area[0] === '1') return null
  if (exchange[0] === '0' || exchange[0] === '1') return null
  // x11 area codes are service codes (411, 911), never assignable to a subscriber.
  if (area[1] === '1' && area[2] === '1') return null
  // 555-01xx is reserved for fiction. A real clinic does not have one.
  if (exchange === '555' && national.slice(6, 8) === '01') return null

  return `+1${national}`
}

export interface PhoneCandidate {
  e164: string
  /** Higher wins. See extractPhonesFromHtml for what each tier means. */
  confidence: number
  how: string
}

/**
 * Pull phone candidates out of raw, unexecuted HTML, best evidence first.
 *
 * The tiers are ordered by how much the markup *asserts* that this is the business's own number,
 * because a med-spa page contains several numbers that are not: a tracking number, the number of
 * a sister location, a vendor's support line in a widget's boilerplate.
 *
 *   30  JSON-LD `telephone` on a schema.org type — the site telling search engines, in a machine
 *       -readable contract, which number is the business's. Strongest signal available offline.
 *   20  microdata itemprop="telephone" — same claim, older syntax.
 *   10  a tel: href — the number a click would dial. Strong, but a page often has several and the
 *       first is not reliably the main line.
 *    1  free text matching a NANP pattern. Last resort; noisy.
 */
export function extractPhonesFromHtml(html: string): PhoneCandidate[] {
  const found = new Map<string, PhoneCandidate>()

  const offer = (raw: string, confidence: number, how: string) => {
    const e164 = toE164(raw)
    if (!e164) return
    const existing = found.get(e164)
    if (!existing || existing.confidence < confidence) {
      found.set(e164, { e164, confidence, how })
    }
  }

  // Tier 30 — JSON-LD. Parsed as JSON where possible so nested @graph nodes are reached; a
  // regex fallback covers the many sites whose JSON-LD does not actually parse.
  for (const block of html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const body = block[1]
    let parsed: unknown = null
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = null
    }
    if (parsed) {
      const walk = (node: unknown) => {
        if (Array.isArray(node)) {
          for (const child of node) walk(child)
          return
        }
        if (!node || typeof node !== 'object') return
        for (const [key, value] of Object.entries(
          node as Record<string, unknown>,
        )) {
          if (key.toLowerCase() === 'telephone' && typeof value === 'string') {
            offer(value, 30, 'json-ld telephone')
          } else {
            walk(value)
          }
        }
      }
      walk(parsed)
    } else {
      for (const m of body.matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) {
        offer(m[1], 30, 'json-ld telephone (unparsed)')
      }
    }
  }

  // Tier 20 — microdata.
  for (const m of html.matchAll(
    /itemprop\s*=\s*["']telephone["'][^>]*?content\s*=\s*["']([^"']+)["']/gi,
  )) {
    offer(m[1], 20, 'microdata telephone')
  }
  for (const m of html.matchAll(
    /itemprop\s*=\s*["']telephone["'][^>]*>\s*([+\d()\s.-]{10,25})/gi,
  )) {
    offer(m[1], 20, 'microdata telephone (text)')
  }

  // Tier 10 — tel: links.
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    offer(m[1], 10, 'tel: href')
  }

  // Tier 1 — free text. Runs against tag-stripped text so attribute values and inline JS
  // (where tracking vendors keep their swap tables) cannot contribute.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  for (const m of text.matchAll(
    /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?!\d)/g,
  )) {
    offer(m[0], 1, 'page text')
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence)
}

/** Vendors whose markup is present on this page. Reported, never used to reject on its own. */
export function detectTrackingVendors(html: string): string[] {
  const lower = html.toLowerCase()
  return TRACKING_VENDOR_MARKERS.filter((v) => lower.includes(v))
}

/**
 * Pick the number to store from a page, or null.
 *
 * `null` is a correct, common answer. The caller records it as "no phone found" and the reveal
 * shows no phone, which is honest. Guessing is not.
 */
export function choosePhoneFromHtml(
  html: string,
): { e164: string; how: string; trackingVendors: string[] } | null {
  const candidates = extractPhonesFromHtml(html)
  const trackingVendors = detectTrackingVendors(html)
  const best = candidates[0]
  if (!best) return null

  // A page-text-only match on a page that also ships a tracking vendor is the one combination we
  // refuse: the weakest evidence on exactly the kind of page most likely to be lying.
  if (best.confidence <= 1 && trackingVendors.length > 0) return null

  return { e164: best.e164, how: best.how, trackingVendors }
}

/** `https://` + host, or null. Coerces the bare hosts and stray whitespace in this column. */
export function normaliseWebsite(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// I/O below this line.
// ---------------------------------------------------------------------------

interface BusinessRow {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  website: string | null
  google_place_id: string | null
  phone: string | null
}

interface Outcome {
  business_id: number
  name: string
  phone: string | null
  source: 'google_business_profile' | 'website_html' | null
  detail: string
}

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const value = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const APPLY = flag('apply')
const PROBE = value('probe')
const LIMIT = value('limit') ? Number(value('limit')) : undefined
const SQL_OUT = value('sql')
const SOURCE = (value('source') ?? 'both') as 'gbp' | 'html' | 'both'
const CONCURRENCY = Number(value('concurrency') ?? 4)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const DFS_USER = process.env.DATAFORSEO_USERNAME
const DFS_PASS = process.env.DATAFORSEO_PASSWORD

function fail(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

/**
 * Resolved inside main(), not at module scope: tests/unit/phoneExtraction.test.ts imports the pure
 * helpers above from this file, and a module-level env check would fail that import wherever no
 * Supabase credentials are loaded.
 */
function connect() {
  if (!SUPABASE_URL) {
    fail(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Run: set -a; . ./.env.local; set +a',
    )
  }
  if (APPLY && !SERVICE_KEY) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is required for --apply.\n' +
        'master_business_info has RLS enabled with no UPDATE policy, so the anon key updates zero\n' +
        'rows and reports error: null — a silent no-op. Either set the service-role key, or run\n' +
        'with --sql out.sql and apply that file as a migration.',
    )
  }
  const readKey = SERVICE_KEY ?? ANON_KEY
  if (!readKey)
    fail(
      'Need SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY to read.',
    )
  return createClient(SUPABASE_URL, readKey, {
    auth: { persistSession: false },
  })
}

const dfsAuth =
  DFS_USER && DFS_PASS
    ? `Basic ${Buffer.from(`${DFS_USER}:${DFS_PASS}`).toString('base64')}`
    : null

/**
 * Ask DataForSEO for a business's Google Business Profile.
 *
 * `google/my_business_info/live` resolves a name + location to the GBP panel Google itself shows,
 * which is where `phone` comes from. The keyword is name + address rather than name alone: there
 * are several "Radiance Med Spa" in this dataset and a name-only lookup returns whichever ranks.
 */
async function lookupGbp(
  biz: BusinessRow,
  { verbose = false } = {},
): Promise<{ phone: string | null; detail: string; raw?: unknown }> {
  if (!dfsAuth) return { phone: null, detail: 'dataforseo credentials not set' }
  if (!biz.name) return { phone: null, detail: 'no business name to search' }

  const keyword = [biz.name, biz.address, biz.city].filter(Boolean).join(', ')

  const response = await fetch(
    'https://api.dataforseo.com/v3/business_data/google/my_business_info/live',
    {
      method: 'POST',
      headers: { Authorization: dfsAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { keyword, language_code: 'en', location_code: 2840 },
      ]),
    },
  )

  if (!response.ok) {
    return { phone: null, detail: `dataforseo http ${response.status}` }
  }

  const body = (await response.json()) as {
    status_code?: number
    status_message?: string
    tasks?: {
      status_code?: number
      status_message?: string
      result?: { items?: { phone?: string | null; title?: string | null }[] }[]
    }[]
  }

  if (verbose) return { phone: null, detail: 'probe', raw: body }

  if (body.status_code !== 20000) {
    return {
      phone: null,
      detail: `dataforseo ${body.status_code}: ${body.status_message}`,
    }
  }

  const task = body.tasks?.[0]
  if (task?.status_code !== 20000) {
    return {
      phone: null,
      detail: `dataforseo task ${task?.status_code}: ${task?.status_message}`,
    }
  }

  const item = task.result?.[0]?.items?.[0]
  if (!item) return { phone: null, detail: 'no GBP match' }
  if (!item.phone)
    return { phone: null, detail: `GBP match "${item.title}" has no phone` }

  const e164 = toE164(item.phone)
  if (!e164)
    return {
      phone: null,
      detail: `GBP phone "${item.phone}" failed NANP validation`,
    }
  return { phone: e164, detail: `GBP "${item.title}"` }
}

/**
 * Fetch raw HTML. No JavaScript is executed anywhere in this function, by design — see the header.
 */
async function fetchRawHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // A real browser UA: several of these sites 403 anything else, and we are reading a page
        // the business publishes publicly.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? ''
    if (!type.includes('html')) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function resolve(biz: BusinessRow): Promise<Outcome> {
  const name = biz.name ?? `#${biz.business_id}`

  if (SOURCE !== 'html') {
    const gbp = await lookupGbp(biz)
    if (gbp.phone) {
      return {
        business_id: biz.business_id,
        name,
        phone: gbp.phone,
        source: 'google_business_profile',
        detail: gbp.detail,
      }
    }
    if (SOURCE === 'gbp') {
      return {
        business_id: biz.business_id,
        name,
        phone: null,
        source: null,
        detail: gbp.detail,
      }
    }
  }

  const website = normaliseWebsite(biz.website)
  if (!website) {
    return {
      business_id: biz.business_id,
      name,
      phone: null,
      source: null,
      detail: 'no website',
    }
  }

  const html = await fetchRawHtml(website)
  if (!html) {
    return {
      business_id: biz.business_id,
      name,
      phone: null,
      source: null,
      detail: `website unreachable (${website})`,
    }
  }

  const chosen = choosePhoneFromHtml(html)
  if (!chosen) {
    const vendors = detectTrackingVendors(html)
    return {
      business_id: biz.business_id,
      name,
      phone: null,
      source: null,
      detail: vendors.length
        ? `no trustworthy number in HTML; tracking vendor present (${vendors.join(', ')})`
        : 'no number found in HTML',
    }
  }

  return {
    business_id: biz.business_id,
    name,
    phone: chosen.e164,
    source: 'website_html',
    detail:
      `${chosen.how}` +
      (chosen.trackingVendors.length
        ? ` — note: ${chosen.trackingVendors.join(', ')} on page`
        : ''),
  }
}

/** Bounded concurrency. These are other people's servers; 4 at a time is polite and fast enough. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++
        results[index] = await fn(items[index])
      }
    },
  )
  await Promise.all(workers)
  return results
}

function sqlLiteral(text: string) {
  return `'${text.replace(/'/g, "''")}'`
}

async function main() {
  const db = connect()

  if (PROBE) {
    const { data, error } = await db
      .from('master_business_info')
      .select(
        'business_id, name, address, city, website, google_place_id, phone',
      )
      .eq('business_id', Number(PROBE))
      .single()
    if (error || !data)
      fail(`Could not read business ${PROBE}: ${error?.message}`)

    const biz = data as BusinessRow
    console.log('BUSINESS:', JSON.stringify(biz, null, 2))

    console.log('\n--- DataForSEO raw response ---')
    if (!dfsAuth) {
      console.log(
        'DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD are not set, so the GBP path is unavailable.',
      )
    } else {
      const probe = await lookupGbp(biz, { verbose: true })
      console.log(JSON.stringify(probe.raw, null, 2).slice(0, 4000))
      console.log('\n--- parsed ---')
      console.log(JSON.stringify(await lookupGbp(biz), null, 2))
    }

    const website = normaliseWebsite(biz.website)
    console.log(`\n--- website HTML (${website ?? 'none'}) ---`)
    if (website) {
      const html = await fetchRawHtml(website)
      if (!html) console.log('unreachable')
      else {
        console.log(
          'candidates:',
          JSON.stringify(extractPhonesFromHtml(html), null, 2),
        )
        console.log('tracking vendors:', detectTrackingVendors(html))
        console.log('chosen:', JSON.stringify(choosePhoneFromHtml(html)))
      }
    }
    return
  }

  let query = db
    .from('master_business_info')
    .select('business_id, name, address, city, website, google_place_id, phone')
    .is('phone', null)
    .order('business_id')
  if (LIMIT) query = query.limit(LIMIT)

  const { data, error } = await query
  if (error) fail(`Could not read businesses: ${error.message}`)

  const businesses = (data ?? []) as BusinessRow[]
  console.log(
    `${businesses.length} businesses without a phone. source=${SOURCE} ` +
      `mode=${APPLY ? 'APPLY' : SQL_OUT ? `SQL → ${SQL_OUT}` : 'DRY RUN'}` +
      (dfsAuth ? '' : '  [no DataForSEO credentials: HTML only]'),
  )
  if (!businesses.length) return

  const outcomes = await mapLimit(businesses, CONCURRENCY, async (biz) => {
    const outcome = await resolve(biz)
    console.log(
      `${outcome.phone ? '✓' : '·'} ${String(outcome.business_id).padStart(5)} ` +
        `${(outcome.phone ?? '—').padEnd(13)} ${outcome.name.slice(0, 38).padEnd(38)} ${outcome.detail}`,
    )
    return outcome
  })

  const found = outcomes.filter((o) => o.phone)
  const byGbp = found.filter(
    (o) => o.source === 'google_business_profile',
  ).length
  console.log(
    `\n${found.length}/${outcomes.length} resolved — ${byGbp} from Google Business Profile, ` +
      `${found.length - byGbp} from raw website HTML.`,
  )

  if (SQL_OUT) {
    const lines = [
      '-- Generated by scripts/backfill-business-phone.ts. Review before applying.',
      '-- phone_source records provenance; see 20260916020001_add_business_phone.sql.',
      '',
      ...found.map(
        (o) =>
          `update public.master_business_info set phone = ${sqlLiteral(o.phone as string)}, ` +
          `phone_source = ${sqlLiteral(o.source as string)} where business_id = ${o.business_id};`,
      ),
      '',
    ]
    await (await import('node:fs/promises')).writeFile(
      SQL_OUT,
      lines.join('\n'),
      'utf8',
    )
    console.log(`Wrote ${found.length} UPDATE statements to ${SQL_OUT}.`)
    return
  }

  if (!APPLY) {
    console.log(
      'Dry run — nothing written. Re-run with --apply, or --sql out.sql.',
    )
    return
  }

  let written = 0
  for (const outcome of found) {
    // CLAUDE.md: "A write is not done until a SELECT proves it." supabase-js resolves rather than
    // throws, and an RLS-filtered UPDATE returns error: null with zero rows. .select() makes the
    // returned row the proof.
    const { data: updated, error: updateError } = await db
      .from('master_business_info')
      .update({ phone: outcome.phone, phone_source: outcome.source })
      .eq('business_id', outcome.business_id)
      .select('business_id, phone, phone_source')

    if (updateError) {
      console.error(`✗ ${outcome.business_id}: ${updateError.message}`)
      continue
    }
    if (!updated || updated.length === 0) {
      console.error(
        `✗ ${outcome.business_id}: UPDATE matched zero rows and reported no error. ` +
          'That is RLS denying the write — you are using the anon key, not the service-role key.',
      )
      continue
    }
    if (updated[0].phone !== outcome.phone) {
      console.error(
        `✗ ${outcome.business_id}: wrote ${outcome.phone}, read back ${updated[0].phone}`,
      )
      continue
    }
    written++
  }

  console.log(
    `\n${written}/${found.length} rows written and verified by read-back.`,
  )
  if (written !== found.length) process.exitCode = 1
}

// Only run when invoked directly, so the pure helpers above can be imported by tests.
if (process.argv[1]?.endsWith('backfill-business-phone.ts')) {
  main().catch((error) =>
    fail(error instanceof Error ? error.stack || error.message : String(error)),
  )
}
