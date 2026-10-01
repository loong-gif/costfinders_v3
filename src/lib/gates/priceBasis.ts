/**
 * The price-basis gate: does the live catalogue hold a NEW priced row the site cannot label
 * truthfully?
 *
 * Why this exists: the price-basis rules (offerPriceBasis / dealPricing in
 * src/lib/data/adapters.ts) run on every render, so every row the pipeline adds is labelled by
 * them automatically — "$4.25 per unit", "$299 for 40 units". What no render-time rule can do
 * is repair a row the pipeline stored wrong, and on 2026-09-17 that was 35 of 477 priced offers.
 * This is the automatic check for that class: see src/lib/data/price-defects.ts for each defect.
 *
 *   npm run prices:check      compare against supabase/price-defects-baseline.json
 *                             (scripts/check-price-basis.ts; the pre-push gate runs it)
 *   npm run prices:baseline   rewrite the baseline (a reviewable diff in the repo)
 *   GET /api/cron/gates       the same check as a Vercel cron every 6 hours, because pipeline
 *                             writes arrive with no commit
 *
 * A RATCHET, not a zero-tolerance gate. The baseline lists the known-bad rows, which are the
 * pipeline's to fix (.planning/SCHEMA-GOVERNANCE-ASK.md, Ask 3). A row outside it fails; a
 * baseline row that no longer fails is reported so the baseline can shrink. Accepting a new row
 * into the baseline is a deliberate, committed decision — never a way to make the gate green.
 *
 * Reads the same way the site does: anon key, public_offers, flattenOffer, isPubliclyVisible.
 * Import this module only once both env vars are known to be set: @/lib/data/offers imports the
 * app's Supabase client, which throws without them.
 */
import { createClient } from '@supabase/supabase-js'
import { dealPricing, offerToAnonymousDeal } from '@/lib/data/adapters'
import {
  flattenOffer,
  isPubliclyVisible,
  PUBLIC_OFFERS,
} from '@/lib/data/offers'
import { type PriceDefect, priceDefects } from '@/lib/data/price-defects'
import type { OfferView } from '@/types/supabase'
import type { SupabasePublicEnv } from './schemaDrift'

export const BASELINE_PATH = 'supabase/price-defects-baseline.json'

export type Baseline = Record<PriceDefect, number[]>

async function loadVisiblePricedOffers({
  url,
  key,
}: SupabasePublicEnv): Promise<OfferView[]> {
  const supabase = createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  type Row = Parameters<typeof flattenOffer>[0]

  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(PUBLIC_OFFERS)
      .select('*')
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`offers query failed: ${error.message}`)
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) break
  }
  return rows
    .map(flattenOffer)
    .filter(isPubliclyVisible)
    .filter((offer) => (offer.discount_price ?? 0) > 0)
}

/** Every defect among the visible priced offers, ids ascending. `--write` records this. */
export async function findPriceDefects(
  env: SupabasePublicEnv,
): Promise<{ found: Baseline; offers: OfferView[] }> {
  const offers = await loadVisiblePricedOffers(env)
  const found: Baseline = {
    'rate-unit-unknown': [],
    'misread-unit-rate': [],
    'price-not-in-text': [],
    'bare-neurotoxin-price': [],
  }
  for (const offer of offers) {
    for (const defect of priceDefects(offer)) found[defect].push(offer.id)
  }
  for (const ids of Object.values(found)) ids.sort((a, b) => a - b)
  return { found, offers }
}

export interface NewDefect {
  defect: PriceDefect
  id: number
  /** The label the site prints for it today. */
  prints: string
  text: string
}

export interface PriceBasisResult {
  ok: boolean
  newDefects: NewDefect[]
  /** `<defect> <id>` for each baseline row that no longer fails. */
  fixedBaselineRows: string[]
  /** Informational, never a failure: the baseline can shrink. Null when nothing was fixed. */
  notice: string | null
  /** The verdict the CLI prints and the cron alerts with. */
  summary: string
}

export async function checkPriceBasis(
  env: SupabasePublicEnv,
): Promise<PriceBasisResult> {
  const { found, offers } = await findPriceDefects(env)

  // A literal-path import, so the bundler ships the committed baseline inside the cron function.
  // Loaded here rather than at the top so `npm run prices:baseline` still runs without it.
  let baseline: Partial<Baseline>
  try {
    baseline = (await import('../../../supabase/price-defects-baseline.json'))
      .default as Partial<Baseline>
  } catch {
    return {
      ok: false,
      newDefects: [],
      fixedBaselineRows: [],
      notice: null,
      summary: `No readable baseline at ${BASELINE_PATH}. Create one with \`npm run prices:baseline\`.`,
    }
  }

  const byId = new Map(offers.map((offer) => [offer.id, offer]))
  const newDefects: NewDefect[] = []
  const fixedBaselineRows: string[] = []
  for (const defect of Object.keys(found) as PriceDefect[]) {
    const known = new Set(baseline[defect] ?? [])
    for (const id of found[defect]) {
      if (known.has(id)) continue
      const offer = byId.get(id)
      newDefects.push({
        defect,
        id,
        prints: offer ? dealPricing(offerToAnonymousDeal(offer)).text : '?',
        text: offer?.offer_raw_text ?? '',
      })
    }
    const now = new Set(found[defect])
    for (const id of known)
      if (!now.has(id)) fixedBaselineRows.push(`${defect} ${id}`)
  }

  const notice =
    fixedBaselineRows.length > 0
      ? `${fixedBaselineRows.length} baseline row(s) no longer fail (fixed, delisted or expired): ` +
        `${fixedBaselineRows.join(', ')}. Shrink the baseline with \`npm run prices:baseline\`.`
      : null

  if (newDefects.length > 0) {
    const lines = newDefects.map(
      ({ defect, id, prints, text }) =>
        `  ${defect}  offer ${id}  prints "${prints}"  — ${JSON.stringify(text.slice(0, 90))}`,
    )
    return {
      ok: false,
      newDefects,
      fixedBaselineRows,
      notice,
      summary:
        `${newDefects.length} new priced row(s) the site cannot label truthfully:\n\n${lines.join('\n')}\n\n` +
        'Each is stored wrong by the pipeline (src/lib/data/price-defects.ts says how). Get the ' +
        'row fixed at the source; accept it into the baseline with `npm run prices:baseline` ' +
        'only as a deliberate, committed decision.',
    }
  }
  return {
    ok: true,
    newDefects,
    fixedBaselineRows,
    notice,
    summary: `Price labels: ${offers.length} visible priced offers, no defects outside the baseline.`,
  }
}
