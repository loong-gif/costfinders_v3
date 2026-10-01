/**
 * Guide Content Generator
 *
 * Writes one cost guide JSON into src/content/guides for every treatment/city pair the live
 * database can support and does not have yet. Three inputs:
 *
 *   1. The qualifying pairs and their live figures — getQualifyingGuidePairs() and the same
 *      computeGuidePricingStats() the page renders, so a guide's numbers are the page's numbers.
 *   2. A research brief on the city (Perplexity), optional.
 *   3. The prose, drafted by Claude in the style of the guides already published, with every
 *      market figure supplied by (1). The model writes sentences; it never supplies a price.
 *
 * Usage:
 *   npm run generate:guides                        # write every missing guide
 *   npm run generate:guides -- --dry-run           # list qualifying pairs with no guide (the
 *                                                  #   pre-push gate runs this; never fails)
 *   npm run generate:guides -- --check             # validate every guide file's content (the
 *                                                  #   gate runs this too; fails on a defect)
 *   npm run generate:guides -- --city newport-beach --treatment botox
 *   npm run generate:guides -- --force --city tucson --treatment botox   # overwrite one
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY; ANTHROPIC_API_KEY unless --dry-run;
 * PERPLEXITY_API_KEY optional (without it the city context is drafted from the model's own
 * knowledge, and the prompt tells it to hedge).
 *
 * Railway runs this weekly through scripts/guides-cron.sh (docs/OPERATIONS.md, "Weekly cost
 * guides"). The registry used to be a hand-kept list of ten pairs, and it went stale the way
 * every hand-kept list in this repo has: Newport Beach, the largest city in the database,
 * qualified for five guides and had none. The set is now derived — see qualifyingGuidePairs()
 * in src/lib/data/guide-stats.ts for the bar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VOCABULARY RULE — read before editing any string below, or hand-writing a guide.
 *
 * These pages target the "cost" query cluster: "botox cost" (8.1k/mo), "how much
 * does botox cost" (8.1k), "cost of botox" (3.6k), "botox cost per unit" (2.9k),
 * "average botox cost", and the "<treatment> cost <city>" geo form. A full keyword
 * export for that cluster contains ZERO instances of the word "pricing". Pages
 * targeting "prices"/"pricing" are a separate future cluster — do not blur them.
 *
 * So: slug, title, H1, every H2, the meta description and the FAQ questions all say
 * "cost". Never "pricing". Accuracy outranks the keyword, always: keep "price" where it
 * is the true word (a vendor QUOTES A PRICE; "price list"; "pricing structure" for how a
 * clinic charges, since a "cost structure" is a firm's own costs). The JSON keys
 * howPricingWorks / whatAffectsPricing / pricingModels are internal and deliberately NOT
 * renamed. Full rationale: docs/MESSAGING-STYLE-GUIDE.md §3.5. The system prompt below
 * carries the same rule to the model.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { formatPrice } from '@/lib/data/adapters'
import {
  getAvailableGuides,
  guideContentDefects,
  loadGuideContent,
} from '@/lib/data/guide-content'
import type { GuideCandidate } from '@/lib/data/guide-stats'
import { treatmentCost, treatmentDo } from '@/lib/utils/treatment-grammar'
import type { GuideContent, GuidePricingStats } from '@/types/guide'

const GUIDES_DIR = path.join(process.cwd(), 'src/content/guides')

/**
 * The unit each treatment's national comparison is drawn on, and which live figure stands on
 * the local side. Neurotoxins per unit (the guide's own stats are already per unit), fillers
 * per syringe, everything else per session — the three pairs nationalComparison.tsx can plot.
 */
const COMPARISON_UNIT: Record<
  GuideCandidate['treatment'],
  'unit' | 'syringe' | 'session'
> = {
  botox: 'unit',
  fillers: 'syringe',
  facials: 'session',
  laser: 'session',
  body: 'session',
  skincare: 'session',
}

const MODEL = 'claude-opus-5'

// ─── Main ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--check')) return checkGuideFiles()
  const dryRun = args.includes('--dry-run')
  // Regenerate guides that are already published, whether or not their market still clears
  // GUIDE_MIN_OFFERS: the page is live either way, so its figures must be the live ones. The
  // provider bar and GUIDE_MIN_PRICED_DEALS still apply — a single clinic's price list is not a market.
  const existing = args.includes('--existing')
  const force = existing || args.includes('--force')
  const filterCity = getArgValue(args, '--city')
  const filterTreatment = getArgValue(args, '--treatment')

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (dryRun) {
      // Same contract as the gate's other live steps: a skip that says so is "unverified",
      // never a green tick.
      console.warn(
        'guides: SKIPPED — NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set, so guide coverage is UNVERIFIED.',
      )
      return
    }
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
    console.error('Load .env.local first: set -a; . ./.env.local; set +a')
    process.exit(1)
  }
  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      'Missing ANTHROPIC_API_KEY — the generator drafts prose with Claude.',
    )
    process.exit(1)
  }
  if (!dryRun && !process.env.PERPLEXITY_API_KEY) {
    console.warn(
      'Warning: PERPLEXITY_API_KEY not set — city context will be drafted without a research brief',
    )
  }

  // Imported here rather than at the top: src/lib/supabase.ts builds its client at module scope
  // and throws without the env vars, which would pre-empt the hints above.
  const {
    getGuidePairs,
    getQualifyingGuidePairs,
    GUIDE_MIN_PRICED_DEALS,
    GUIDE_MIN_PROVIDERS,
    publishedGuideStats,
  } = await import('@/lib/data/guide-stats')
  const pairs = existing
    ? (await getGuidePairs()).filter(
        (c) =>
          fs.existsSync(path.join(GUIDES_DIR, `${c.slug}.json`)) &&
          c.providerCount >= GUIDE_MIN_PROVIDERS,
      )
    : await getQualifyingGuidePairs()
  const candidates = pairs.filter(
    (c) =>
      (!filterTreatment || c.treatment === filterTreatment) &&
      (!filterCity || c.city.slug === filterCity),
  )

  const missing = candidates.filter(
    (c) => force || !fs.existsSync(path.join(GUIDES_DIR, `${c.slug}.json`)),
  )

  console.log(
    `guides: ${candidates.length} qualifying ${candidates.length === 1 ? 'pair' : 'pairs'}, ` +
      `${candidates.length - missing.length} with a guide, ${missing.length} without` +
      (missing.length ? ':' : '.'),
  )
  for (const c of missing) {
    console.log(
      `  ${c.slug}  (${c.offers.length} offers, ${c.providerCount} providers)`,
    )
  }
  if (dryRun || missing.length === 0) return

  fs.mkdirSync(GUIDES_DIR, { recursive: true })
  const client = new Anthropic()
  let generated = 0
  let skipped = 0

  for (const candidate of missing) {
    console.log(`\n── ${candidate.slug} ──`)
    const started = Date.now()

    const stats = await fetchPricingStats(candidate)
    console.log(
      `  ${stats.dealCount} deals, ${stats.pricedDealCount} priced, ${stats.providerCount} providers`,
    )
    // A cost guide needs costs. "Facials cost in Laguna Hills" once shipped with no price at
    // all ("No provider in this market is advertising a price"). And it needs the market the
    // page will print: publishedGuideStats() is the page's own rule (a typical for neurotoxins,
    // 3 priced deals from 3 clinics otherwise), so no guide is drafted around a median the page
    // then withholds — Irvine facials' 3 prices came from 2 clinics (2026-09-28).
    if (
      stats.pricedDealCount < GUIDE_MIN_PRICED_DEALS ||
      publishedGuideStats(candidate.treatment, candidate.offers, stats)
        .medianPrice == null
    ) {
      console.log(
        `  ${stats.pricedDealCount} priced deals: no market figure the page would print, skipping`,
      )
      skipped++
      continue
    }

    let brief: string | null = null
    if (process.env.PERPLEXITY_API_KEY) {
      console.log('  Researching the city...')
      brief = await researchCity(process.env.PERPLEXITY_API_KEY, candidate)
    }

    console.log(`  Drafting with ${MODEL}...`)
    let content = assembleGuide(
      candidate,
      stats,
      await draftGuide(client, candidate, stats, brief),
    )
    let defects = guideContentDefects(content)
    if (defects.length) {
      // The schema cannot stop a field arriving as "x". One more attempt, then fail the run
      // rather than publish it.
      console.warn(
        `  Draft has defects, retrying once:\n    ${defects.join('\n    ')}`,
      )
      content = assembleGuide(
        candidate,
        stats,
        await draftGuide(client, candidate, stats, brief, defects),
      )
      defects = guideContentDefects(content)
      if (defects.length) {
        throw new Error(
          `${candidate.slug}: draft still defective after a retry:\n  ${defects.join('\n  ')}`,
        )
      }
    }

    const filePath = path.join(GUIDES_DIR, `${candidate.slug}.json`)
    fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`)
    // Read it back the way the page will. A file the route cannot load is a 404 with a
    // commit behind it.
    if (!loadGuideContent(candidate.slug)) {
      throw new Error(
        `${filePath} was written but loadGuideContent() cannot read it`,
      )
    }
    console.log(
      `  Written: ${filePath} (${wordCount(content)} words, ${Math.round((Date.now() - started) / 1000)}s)`,
    )
    generated++
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped`)
}

// ─── Live figures ────────────────────────────────────────

/**
 * The stats the guide page itself renders — same query, same arithmetic — so a Botox guide's
 * figures are per unit exactly as /guides/<slug> prints them.
 */
async function fetchPricingStats(
  candidate: GuideCandidate,
): Promise<GuidePricingStats> {
  const { computeGuidePricingStats } = await import('@/lib/data/guide-stats')
  return computeGuidePricingStats(candidate.treatment, candidate.offers)
}

/** The live figure on the local side of the national comparison, on COMPARISON_UNIT. */
function localComparisonFigure(
  candidate: GuideCandidate,
  stats: GuidePricingStats,
): number | null {
  const unit = COMPARISON_UNIT[candidate.treatment]
  if (unit === 'unit') return stats.perUnit ? stats.medianPrice : null
  return (
    stats.byUnitType.find((row) => row.unitType === unit)?.medianPrice ?? null
  )
}

// ─── Perplexity research ─────────────────────────────────

async function researchCity(
  apiKey: string,
  candidate: GuideCandidate,
): Promise<string | null> {
  const { city, treatmentLabel } = candidate
  const prompt = `Write a research brief of 400-600 words, in plain prose with the source and year named beside every figure, for a cost guide about ${treatmentLabel} at medspas in ${city.name}, ${city.state}. Cover: population and demographics (Census figures for the city and its metro or county; median age; median household income); a cost-of-living index against a national baseline of 100, naming the publisher; how dense the local medspa and aesthetic-provider market is and where practices cluster; ${city.state}'s scope-of-practice rules for who may perform ${treatmentLabel} (statute or board names where you can); seasonal or event-driven swings in local demand; and the nearest competing metros with drive times. Where you do not know a figure, say so rather than estimate.`

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) {
      console.warn(`  Perplexity API error: ${response.status}`)
      return null
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    console.warn('  Perplexity research failed:', err)
    return null
  }
}

// ─── Claude draft ────────────────────────────────────────

/** The prose sections the model writes. Identity and every figure are set by code. */
interface GuideDraft {
  howPricingWorks: GuideContent['howPricingWorks']
  whatAffectsPricing: GuideContent['whatAffectsPricing']
  howToSave: GuideContent['howToSave']
  nationalComparison: {
    /** A published national figure on the comparison unit, or null when unsure of one. */
    nationalAverage: number | null
    comparisonText: string
  }
  faqs: GuideContent['faqs']
  cityContext: {
    costOfLivingIndex: number | null
    medspaDensity: string
    demographicNotes: string
    competitionNotes: string
  }
}

const text = { type: 'string' } as const
const numberOrNull = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const list = (properties: Record<string, unknown>) => ({
  type: 'array',
  items: object(properties),
})

/** Structured-output schema for GuideDraft — the API guarantees the reply validates. */
const DRAFT_SCHEMA = object({
  howPricingWorks: object({
    intro: text,
    pricingModels: list({ name: text, description: text, typicalRange: text }),
  }),
  whatAffectsPricing: object({
    intro: text,
    factors: list({ factor: text, explanation: text }),
  }),
  howToSave: object({
    intro: text,
    tips: list({ tip: text, detail: text }),
  }),
  nationalComparison: object({
    nationalAverage: numberOrNull,
    comparisonText: text,
  }),
  faqs: list({ question: text, answer: text }),
  cityContext: object({
    costOfLivingIndex: numberOrNull,
    medspaDensity: text,
    demographicNotes: text,
    competitionNotes: text,
  }),
})

/**
 * Stable across every guide, so it caches. Everything that varies (the city, the figures, the
 * brief, the reference guide) goes in the user turn.
 */
const SYSTEM_PROMPT = `You write city-level cost guides for CostFinders, a site that compares the prices medspas advertise. For each request you receive the live figures computed from the site's own offer feed for one treatment in one city, a research brief on that city (sometimes absent), and one published guide as a reference for voice and depth. You return only the JSON the schema asks for.

Voice and depth: match the reference guide — specific, sceptical, written for a buyer deciding what to ask a clinic; concrete about local geography, regulation, seasonality and the nearby metros people actually compare against; no marketing language and no invented precision. Do not copy the reference guide's facts or phrasings: it is about a different city. Sections: pricingModels has 3 or 4 entries, each a charging structure actually seen in this market's feed; factors 4 or 5; tips 4 or 5; faqs 7 or 8, with questions phrased the way people search and answers that say what to ask a clinic; the three cityContext fields are each one paragraph of 2 to 4 sentences. About 1,100 to 1,400 words in all.

Facts: the page prints the live figures beside your prose and re-reads them daily, so the exact numbers and counts you are given will be stale within days. Do not quote them in the prose: no exact rates, counts of offers or providers, or percentages of the feed. Describe magnitude and shape instead — "high single digits to the low teens per unit", "a minority of listings state a figure", "the floor of the feed is a Dysport rate on a smaller unit" — and keep every such description true to the figures given (on the unit given; "per unit" figures are per unit). Never add a market figure the data does not contain. The one exception is comparisonText, below, which states the local figure as given. City facts (population, income, licensing rules, events, competing metros, drive times) come from the research brief; where the brief is silent, write from general knowledge only when you are confident, name the body or publisher when you can, and prefer describing a mechanism over stating a number you are unsure of. costOfLivingIndex is the brief's figure on a 100 baseline, or null.

nationalComparison: nationalAverage is a widely cited published national figure for ONE of the comparison unit named in the request (RealSelf member-reported averages, ASPS statistics, or a comparable source), and comparisonText names that source. If you do not know such a figure with confidence, return null and write comparisonText with no national number. comparisonText states the local figure exactly as given, on the same unit, and the gap as the page's chart computes it: (national − local) ÷ national, rounded to the nearest whole percent, so the prose and the chart agree; if no local figure was given, say that the local feed does not state a price on that unit and compare qualitatively.

Words: these pages target the "cost" search cluster. Use "cost" in every FAQ question and wherever the text names what a buyer pays ("what Botox costs here"); never "pricing" or "prices" in those places. Keep "price" where it is the true word: pricingModels[].name labels a charging STRUCTURE ("Charged Per Unit", "Quoted by the Syringe" — never "Per-Unit Cost"); "price list", "list price", "price spread" and "quotes a price" are fixed; how a clinic charges is a "pricing structure", since a "cost structure" is a firm's own costs. Verb agreement follows the treatment label as given in the request. Neurotoxin guides carry two different figures, and the prose must not blur them: startingAt is the floor, the cheapest advertised price with Dysport included and its brand named (the page prints it as "Starting at"); pooledRange (its min, median and max) covers Botox-sized units only — Botox, Xeomin, Jeuveau, Daxxify — with Dysport units, about a third the size, and "starting at" prices left out. So a Dysport rate can sit below the whole range: explain the unit-size difference rather than calling a Dysport rate a Botox price, and never describe the range's low end as the cheapest price in the city.`

async function draftGuide(
  client: Anthropic,
  candidate: GuideCandidate,
  stats: GuidePricingStats,
  brief: string | null,
  previousDefects: string[] = [],
): Promise<GuideDraft> {
  const unit = COMPARISON_UNIT[candidate.treatment]
  const localFigure = localComparisonFigure(candidate, stats)
  const label = candidate.treatmentLabel
  const request = {
    treatment: label,
    city: `${candidate.city.name}, ${candidate.city.state} (${candidate.city.stateCode})`,
    grammar: `"how much ${treatmentDo(label)} ${label} cost", "what ${label} ${treatmentCost(label)}"`,
    comparisonUnit: unit,
    localFigureForComparison:
      localFigure == null
        ? 'none — the feed states no price on that unit'
        : `${formatPrice(localFigure)} per ${unit} (median of the priced offers)`,
    liveFigures: {
      visibleOffers: stats.dealCount,
      pricedOffers: stats.pricedDealCount,
      providers: stats.providerCount,
      figuresArePerUnit: stats.perUnit,
      startingAt: { price: stats.floorPrice, brand: stats.floorBrand },
      pooledRange: {
        min: stats.minPrice,
        minBrand: stats.minBrand,
        median: stats.medianPrice,
        max: stats.maxPrice,
      },
      byProduct: stats.byService,
      byUnit: stats.byUnitType,
    },
    researchBrief: brief ?? 'none provided — hedge city facts accordingly',
    referenceGuide: referenceGuide(candidate),
    ...(previousDefects.length && {
      previousAttemptWasRejectedBecause: previousDefects,
    }),
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // A classifier decline re-runs on Anthropic's recommended fallback instead of failing the
    // job; the guide is benign, but a weekly cron cannot answer a false positive by hand.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Draft the guide for this request.\n\n${JSON.stringify(request, null, 2)}`,
      },
    ],
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: DRAFT_SCHEMA },
    },
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `Claude declined to draft ${candidate.slug}: ${response.stop_details?.explanation ?? 'no explanation'}`,
    )
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `Draft for ${candidate.slug} hit max_tokens; output is truncated`,
    )
  }
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error(`No text block in the draft for ${candidate.slug}`)
  }
  return JSON.parse(block.text) as GuideDraft
}

/**
 * The longest published guide for the same treatment (any treatment if none), stripped of its
 * identity — voice and depth for the model to match, not facts to reuse.
 */
function referenceGuide(candidate: GuideCandidate) {
  const guides = getAvailableGuides()
  const pool = guides.filter((g) => g.treatment === candidate.treatment)
  const pick = (pool.length ? pool : guides)
    .map((g) => ({
      slug: g.slug,
      size: fs.statSync(path.join(GUIDES_DIR, `${g.slug}.json`)).size,
    }))
    .sort((a, b) => b.size - a.size)[0]
  if (!pick) return null
  const content = loadGuideContent(pick.slug)
  if (!content) return null
  return {
    city: `${content.cityLabel}, ${content.stateCode}`,
    treatment: content.treatmentLabel,
    howPricingWorks: content.howPricingWorks,
    whatAffectsPricing: content.whatAffectsPricing,
    howToSave: content.howToSave,
    nationalComparison: content.nationalComparison,
    faqs: content.faqs,
    cityContext: content.cityContext,
  }
}

// ─── Assembly ────────────────────────────────────────────

function assembleGuide(
  candidate: GuideCandidate,
  stats: GuidePricingStats,
  draft: GuideDraft,
): GuideContent {
  const unit = COMPARISON_UNIT[candidate.treatment]
  const suffix = {
    unit: 'PerUnit',
    syringe: 'PerSyringe',
    session: 'PerSession',
  }[unit]
  const localFigure = localComparisonFigure(candidate, stats)
  const national = draft.nationalComparison.nationalAverage
  return {
    treatment: candidate.treatment,
    treatmentLabel: candidate.treatmentLabel,
    city: candidate.city.slug,
    cityLabel: candidate.city.name,
    state: candidate.city.state,
    stateCode: candidate.city.stateCode,
    generatedAt: new Date().toISOString().split('T')[0],
    howPricingWorks: draft.howPricingWorks,
    whatAffectsPricing: draft.whatAffectsPricing,
    howToSave: draft.howToSave,
    nationalComparison: {
      // Exactly one national/local pair, on the treatment's unit; the chart is skipped when
      // either side is missing (nationalComparison.tsx).
      ...(national != null && { [`nationalAvg${suffix}`]: national }),
      ...(localFigure != null && { [`localAvg${suffix}`]: localFigure }),
      comparisonText: draft.nationalComparison.comparisonText,
    },
    faqs: draft.faqs,
    cityContext: {
      ...(draft.cityContext.costOfLivingIndex != null && {
        costOfLivingIndex: draft.cityContext.costOfLivingIndex,
      }),
      medspaDensity: draft.cityContext.medspaDensity,
      demographicNotes: draft.cityContext.demographicNotes,
      competitionNotes: draft.cityContext.competitionNotes,
    },
  }
}

// ─── --check ─────────────────────────────────────────────

/** Every guide file against guideContentDefects(); exit 1 naming each defect. */
function checkGuideFiles() {
  const guides = getAvailableGuides()
  const bad: string[] = []
  for (const guide of guides) {
    const content = loadGuideContent(guide.slug)
    const defects = content
      ? guideContentDefects(content)
      : ['file does not parse as GuideContent']
    for (const d of defects) bad.push(`${guide.slug}: ${d}`)
  }
  if (bad.length) {
    console.error(
      `guides: ${bad.length} ${bad.length === 1 ? 'defect' : 'defects'} in ${guides.length} files:`,
    )
    for (const line of bad) console.error(`  ${line}`)
    process.exit(1)
  }
  console.log(`guides: ${guides.length} files, no defects`)
}

// ─── Utilities ───────────────────────────────────────────

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined
}

function wordCount(content: GuideContent): number {
  const {
    treatment,
    treatmentLabel,
    city,
    cityLabel,
    state,
    stateCode,
    generatedAt,
    ...prose
  } = content
  void [
    treatment,
    treatmentLabel,
    city,
    cityLabel,
    state,
    stateCode,
    generatedAt,
  ]
  return JSON.stringify(prose)
    .replace(/[^A-Za-z0-9'’-]+/g, ' ')
    .trim()
    .split(/\s+/).length
}

// ─── Run ─────────────────────────────────────────────────

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
