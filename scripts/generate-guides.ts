/**
 * Guide Content Generator
 *
 * Generates pricing guide JSON files by combining:
 * 1. Real pricing data from Supabase
 * 2. City-specific research from Perplexity API
 *
 * Usage:
 *   npx tsx scripts/generate-guides.ts
 *   npx tsx scripts/generate-guides.ts --dry-run
 *   npx tsx scripts/generate-guides.ts --city tucson --treatment botox
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon key
 *   PERPLEXITY_API_KEY — Perplexity API key for research
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ─── Configuration ───────────────────────────────────────

const GUIDE_REGISTRY: Array<{
  treatment: string
  treatmentLabel: string
  cities: Array<{ slug: string; name: string; state: string; stateCode: string }>
}> = [
  {
    treatment: 'botox',
    treatmentLabel: 'Botox',
    cities: [
      { slug: 'tucson', name: 'Tucson', state: 'Arizona', stateCode: 'AZ' },
      { slug: 'oklahoma-city', name: 'Oklahoma City', state: 'Oklahoma', stateCode: 'OK' },
      { slug: 'irvine', name: 'Irvine', state: 'California', stateCode: 'CA' },
      { slug: 'tustin', name: 'Tustin', state: 'California', stateCode: 'CA' },
      { slug: 'santa-ana', name: 'Santa Ana', state: 'California', stateCode: 'CA' },
    ],
  },
  {
    treatment: 'fillers',
    treatmentLabel: 'Dermal Fillers',
    cities: [
      { slug: 'tucson', name: 'Tucson', state: 'Arizona', stateCode: 'AZ' },
      { slug: 'oklahoma-city', name: 'Oklahoma City', state: 'Oklahoma', stateCode: 'OK' },
      { slug: 'irvine', name: 'Irvine', state: 'California', stateCode: 'CA' },
      { slug: 'tustin', name: 'Tustin', state: 'California', stateCode: 'CA' },
      { slug: 'santa-ana', name: 'Santa Ana', state: 'California', stateCode: 'CA' },
    ],
  },
]

const TREATMENT_TO_DB_CATEGORY: Record<string, string[]> = {
  botox: ['Neurotoxins'],
  fillers: ['Fillers & Other Injectables'],
  facials: ['Facials & Lasers Services'],
  laser: ['Facials & Lasers Services'],
  body: ['Others', 'Consultations'],
  skincare: ['Wellness'],
}

const CITY_SLUG_TO_NAME: Record<string, string> = {
  tucson: 'Tucson',
  'oklahoma-city': 'Oklahoma City',
  irvine: 'Irvine',
  tustin: 'Tustin',
  'santa-ana': 'Santa Ana',
  'costa-mesa': 'Costa Mesa',
  'laguna-hills': 'Laguna Hills',
  boulder: 'Boulder',
  edmond: 'Edmond',
}

const GUIDES_DIR = path.join(process.cwd(), 'src/content/guides')

// ─── Main ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filterCity = getArgValue(args, '--city')
  const filterTreatment = getArgValue(args, '--treatment')

  // Validate env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const perplexityKey = process.env.PERPLEXITY_API_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('Source your .env.local: source <(grep -v "^#" .env.local | sed "s/^/export /")')
    process.exit(1)
  }

  if (!perplexityKey) {
    console.warn('Warning: PERPLEXITY_API_KEY not set — will generate guides with placeholder content')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Ensure output directory exists
  fs.mkdirSync(GUIDES_DIR, { recursive: true })

  let generated = 0
  let skipped = 0

  for (const entry of GUIDE_REGISTRY) {
    if (filterTreatment && entry.treatment !== filterTreatment) continue

    for (const city of entry.cities) {
      if (filterCity && city.slug !== filterCity) continue

      const slug = `${entry.treatment}-pricing-${city.slug}`
      const filePath = path.join(GUIDES_DIR, `${slug}.json`)

      console.log(`\n── ${slug} ──`)

      // Check if file already exists
      if (fs.existsSync(filePath) && !args.includes('--force')) {
        console.log(`  Exists, skipping (use --force to overwrite)`)
        skipped++
        continue
      }

      if (dryRun) {
        console.log(`  Would generate: ${filePath}`)
        generated++
        continue
      }

      // Fetch pricing stats from Supabase
      console.log('  Fetching pricing data...')
      const stats = await fetchPricingStats(supabase, entry.treatment, city.name)
      console.log(`  Found ${stats.dealCount} deals, ${stats.providerCount} providers`)

      if (stats.dealCount === 0) {
        console.log('  No deals found, skipping')
        skipped++
        continue
      }

      // Research city context via Perplexity
      let research: CityResearch | null = null
      if (perplexityKey) {
        console.log('  Researching city context...')
        research = await researchCity(perplexityKey, entry.treatmentLabel, city.name, city.state)
        // Rate limit: wait 2s between API calls
        await sleep(2000)
      }

      // Generate guide content
      const guideContent = buildGuideContent(entry, city, stats, research)

      // Write file
      fs.writeFileSync(filePath, JSON.stringify(guideContent, null, 2))
      console.log(`  Written: ${filePath}`)
      generated++
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped`)
}

// ─── Supabase Queries ────────────────────────────────────

interface PricingStats {
  dealCount: number
  providerCount: number
  minPrice: number | null
  maxPrice: number | null
  avgPrice: number | null
}

async function fetchPricingStats(
  supabase: ReturnType<typeof createClient>,
  treatment: string,
  cityName: string,
): Promise<PricingStats> {
  const dbCategories = TREATMENT_TO_DB_CATEGORY[treatment] ?? []
  if (dbCategories.length === 0) return { dealCount: 0, providerCount: 0, minPrice: null, maxPrice: null, avgPrice: null }

  // Get business IDs in this city
  const { data: businesses } = await supabase
    .from('master_business_info')
    .select('business_id')
    .ilike('city', cityName)

  if (!businesses?.length) return { dealCount: 0, providerCount: 0, minPrice: null, maxPrice: null, avgPrice: null }

  const businessIds = businesses.map((b: { business_id: number }) => b.business_id)

  const { data: services } = await supabase
    .from('clinic_services')
    .select('service_id')
    .in('business_id', businessIds)
    .in('service_category', dbCategories)

  if (!services?.length) {
    return { dealCount: 0, providerCount: 0, minPrice: null, maxPrice: null, avgPrice: null }
  }

  const serviceIds = services.map((s: { service_id: number }) => s.service_id)

  const { data: offerItems } = await supabase
    .from('promo_offer_items')
    .select('offer_id')
    .in('service_id', serviceIds)

  if (!offerItems?.length) {
    return { dealCount: 0, providerCount: 0, minPrice: null, maxPrice: null, avgPrice: null }
  }

  const offerIds = [...new Set(offerItems.map((i: { offer_id: number }) => i.offer_id))]

  const { data: offers } = await supabase
    .from('promo_offer_master')
    .select('id, business_id, discount_price, regular_price')
    .in('id', offerIds)
    .in('business_id', businessIds)
    .or('discount_price.gt.0,regular_price.gt.0')

  if (!offers?.length) return { dealCount: 0, providerCount: 0, minPrice: null, maxPrice: null, avgPrice: null }

  const prices = offers
    .map((o: { discount_price: number | null; regular_price: number | null }) =>
      o.discount_price ?? o.regular_price ?? 0)
    .filter((p: number) => p > 0)
    .sort((a: number, b: number) => a - b)

  const providerIds = new Set(offers.map((o: { business_id: number | null }) => o.business_id).filter(Boolean))

  return {
    dealCount: offers.length,
    providerCount: providerIds.size,
    minPrice: prices.length > 0 ? prices[0] : null,
    maxPrice: prices.length > 0 ? prices[prices.length - 1] : null,
    avgPrice: prices.length > 0 ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : null,
  }
}

// ─── Perplexity Research ─────────────────────────────────

interface CityResearch {
  costOfLivingIndex: number
  medspaDensity: string
  demographicNotes: string
  competitionNotes: string
}

async function researchCity(
  apiKey: string,
  treatmentLabel: string,
  cityName: string,
  state: string,
): Promise<CityResearch | null> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `Provide a brief JSON summary of the medspa market in ${cityName}, ${state} for a ${treatmentLabel} pricing guide. Return ONLY valid JSON with these fields:
{
  "costOfLivingIndex": <number, national avg is 100>,
  "medspaDensity": "<high|medium|low>",
  "demographicNotes": "<1-2 sentences about demographics>",
  "competitionNotes": "<1-2 sentences about competition>"
}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.warn(`  Perplexity API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return null
  } catch (err) {
    console.warn('  Perplexity research failed:', err)
    return null
  }
}

// ─── Content Builder ─────────────────────────────────────

function buildGuideContent(
  entry: (typeof GUIDE_REGISTRY)[number],
  city: { slug: string; name: string; state: string; stateCode: string },
  stats: PricingStats,
  research: CityResearch | null,
) {
  const isBotox = entry.treatment === 'botox'

  return {
    treatment: entry.treatment,
    treatmentLabel: entry.treatmentLabel,
    city: city.slug,
    cityLabel: city.name,
    state: city.state,
    stateCode: city.stateCode,
    generatedAt: new Date().toISOString().split('T')[0],
    howPricingWorks: {
      intro: `${entry.treatmentLabel} pricing in ${city.name} varies based on the provider, pricing model, and treatment scope. Here are the main pricing structures you will encounter.`,
      pricingModels: isBotox
        ? [
            { name: 'Per-Unit Pricing', description: 'Charged per unit of neurotoxin injected. Most transparent model — you pay for exactly what you need.', typicalRange: '$8–$15 per unit' },
            { name: 'Per-Area Pricing', description: 'Flat fee per treatment area (forehead, crow\'s feet, etc.). Simpler to understand but harder to compare across providers.', typicalRange: '$100–$400 per area' },
            { name: 'Membership Pricing', description: 'Monthly fee that includes discounted or included treatments. Best value for regular maintenance.', typicalRange: '$60–$295/month' },
            { name: 'Bundle Packages', description: 'Multi-unit or multi-area packages at a discounted per-unit rate. Good for larger treatment areas.', typicalRange: '$200–$700 per package' },
          ]
        : [
            { name: 'Per-Syringe Pricing', description: 'Standard pricing per syringe of filler. Most common and easiest to compare across providers.', typicalRange: '$450–$1,100 per syringe' },
            { name: 'Per-Vial Pricing', description: 'Used for biostimulators like Sculptra and Radiesse. Vials differ in volume from syringes.', typicalRange: '$600–$950 per vial' },
            { name: 'Per-Area Pricing', description: 'Flat fee per treatment zone (lips, cheeks, jawline). May include multiple syringes.', typicalRange: '$250–$1,000 per area' },
            { name: 'Treatment Plan Pricing', description: 'Comprehensive packages for multi-area rejuvenation over multiple sessions.', typicalRange: '$1,500–$5,000 per plan' },
          ],
    },
    whatAffectsPricing: {
      intro: `Several factors influence ${entry.treatmentLabel.toLowerCase()} pricing in ${city.name}. Understanding these helps you evaluate whether a deal represents good value.`,
      factors: [
        { factor: 'Cost of living', explanation: `${city.name}'s cost of living ${research?.costOfLivingIndex && research.costOfLivingIndex < 100 ? 'is below' : 'is above'} the national average, which directly affects provider overhead and treatment pricing.` },
        { factor: 'Provider competition', explanation: research?.competitionNotes ?? `The number of medspas in ${city.name} influences pricing — more competition generally means better deals.` },
        { factor: 'Provider credentials', explanation: `Board-certified dermatologists and plastic surgeons in ${city.name} typically charge more than nurse practitioners or physician assistants, reflecting experience and training differences.` },
        { factor: 'Product brand', explanation: isBotox ? 'Botox, Dysport, Jeuveau, and Daxxify are all FDA-approved neurotoxins with different unit pricing. Dysport uses more units per area but costs less per unit.' : 'Juvederm, Restylane, RHA, Sculptra, and Radiesse each have different pricing tiers reflecting longevity, composition, and intended use.' },
      ],
    },
    howToSave: {
      intro: `${city.name} providers offer several ways to reduce your ${entry.treatmentLabel.toLowerCase()} costs without compromising quality.`,
      tips: [
        { tip: 'Compare pricing models', detail: isBotox ? 'Per-unit pricing lets you compare apples-to-apples. Ask providers for their per-unit rate, even if they advertise per-area pricing.' : 'Per-syringe pricing is the most transparent. Ask what brand and how many syringes are included in per-area quotes.' },
        { tip: 'Look for new patient specials', detail: `Many ${city.name} medspas offer introductory pricing for first-time patients. These can save 10–30% on your first treatment.` },
        { tip: 'Consider membership programs', detail: `Monthly memberships ($60–$295/mo) often include discounted ${entry.treatmentLabel.toLowerCase()} treatments and are worthwhile if you plan regular maintenance visits.` },
        { tip: 'Book during off-peak months', detail: isBotox ? 'January and summer months often see promotional pricing as providers run seasonal specials.' : 'Watch for holiday promotions and seasonal events when providers often discount filler packages.' },
      ],
    },
    nationalComparison: {
      ...(isBotox
        ? { nationalAvgPerUnit: 14 }
        : { nationalAvgPerSyringe: 750 }),
      comparisonText: stats.avgPrice
        ? `The national average for ${entry.treatmentLabel.toLowerCase()} is approximately $${isBotox ? '14 per unit' : '750 per syringe'}. In ${city.name}, the average is $${stats.avgPrice}, making it ${stats.avgPrice < (isBotox ? 14 : 750) ? 'more affordable than' : stats.avgPrice > (isBotox ? 14 : 750) ? 'slightly higher than' : 'on par with'} the national average.`
        : `The national average for ${entry.treatmentLabel.toLowerCase()} is approximately $${isBotox ? '14 per unit' : '750 per syringe'}.`,
    },
    faqs: [
      { question: `How much does ${entry.treatmentLabel.toLowerCase()} cost in ${city.name}?`, answer: stats.minPrice && stats.maxPrice ? `Based on ${stats.dealCount} verified deals, ${entry.treatmentLabel.toLowerCase()} in ${city.name} ranges from $${stats.minPrice} to $${stats.maxPrice}, with an average of $${stats.avgPrice ?? 'varies'}.` : `Pricing varies by provider and treatment scope. Compare verified deals on CostFinders to find current pricing.` },
      { question: `How do I find the best ${entry.treatmentLabel.toLowerCase()} deals in ${city.name}?`, answer: `CostFinders compares pricing from ${stats.providerCount} verified providers in ${city.name}. Browse anonymized deals, compare pricing models, and claim a deal to get connected with the provider.` },
      { question: isBotox ? 'How many units of Botox do I need?' : 'How many syringes of filler do I need?', answer: isBotox ? 'Typical treatment areas require 10–30 units (forehead: 10–30, crow\'s feet: 5–15 per side, frown lines: 10–25). Your provider will recommend the right amount during consultation.' : 'Most areas require 1–2 syringes (lips: 1, cheeks: 1–2 per side, nasolabial folds: 1–2, jawline: 2–3). A consultation will determine your specific needs.' },
    ],
    cityContext: {
      costOfLivingIndex: research?.costOfLivingIndex ?? 100,
      medspaDensity: research?.medspaDensity ?? 'medium',
      demographicNotes: research?.demographicNotes ?? `${city.name} has a growing population with increasing demand for aesthetic treatments.`,
      competitionNotes: research?.competitionNotes ?? `The ${city.name} medspa market features multiple providers competing on price and service quality.`,
    },
  }
}

// ─── Utilities ───────────────────────────────────────────

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Run ─────────────────────────────────────────────────

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
