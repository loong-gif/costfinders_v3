import type { Metadata } from 'next'
import { formatPrice } from '@/lib/data/adapters'
import { treatmentCost } from '@/lib/utils/treatment-grammar'

/**
 * The canonical origin, one source of truth.
 *
 * robots.ts, sitemap.ts and layout.tsx's metadataBase each read NEXT_PUBLIC_BASE_URL with
 * their own inline fallback while this constant was hardcoded — four places to change for
 * one hostname, and they had already drifted.
 */
const CANONICAL_URL =
  // Trimmed for the same reason next.config.ts trims: a Vercel env value can carry a
  // trailing newline, and this one ends up in metadataBase and every canonical link.
  process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') ||
  'https://www.costfinders.ai'

// Site-wide configuration
export const SITE_CONFIG = {
  name: 'CostFinders',
  url: CANONICAL_URL,
  /**
   * No "verified", and no savings percentage, in any description this file generates.
   *
   * CostFinders verifies nothing: business_claims holds 0 rows, business_profiles only the test
   * owner account (2026-09-28), and every deal's businessTier is hardcoded 'unclaimed'. And the
   * savings bands these helpers used to advertise are not in the data — on 2026-09-28, 600 of
   * the 938 offers shown carry a discount_percent (median 20%) and only 163 print a regular
   * price to save against. "Save up to 50%" was true only of the tail. Any number that goes
   * back into a description must be computed from the offers on the page being described.
   */
  description:
    'Find and compare medspa deals, treatments, and pricing near you. See the prices aesthetic providers advertise, side by side.',
  social: {
    twitter: '@costfinders',
    instagram: '@costfinders',
  },
} as const

/**
 * Hostname reduced to the form that identifies the SITE rather than one of its aliases.
 *
 * `www.costfinders.ai` and `costfinders.ai` are the same site to everyone except a string
 * comparison, and which of the two a given variable holds is not ours to choose — see
 * isCanonicalDeployment().
 */
function siteHost(hostOrUrl: string): string {
  return hostOrUrl
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase()
}

/**
 * Is THIS deployment the canonical host?
 *
 * Gates indexing. The previous test was `VERCEL_ENV === 'production'`, which is true on
 * costfindersv2.vercel.app — that IS the project's production deployment — so the live
 * pre-cutover site served `Allow: /` while every canonical on it pointed at
 * www.costfinders.ai, a domain that still serves v1 and 404s every /guides URL.
 *
 * The hostname comparison that replaced it then compared raw strings, which would have kept
 * the site noindex FOREVER once the real domain was attached. VERCEL_PROJECT_PRODUCTION_URL is
 * documented as "the shortest production custom domain", and the cutover has to attach both
 * costfinders.ai and www.costfinders.ai (v1 serves apex→www today), so Vercel resolves it to
 * the 14-character apex while NEXT_PUBLIC_BASE_URL is the 18-character www form. Raw equality
 * returns false, robots.ts keeps serving `Disallow: /`, and nothing anywhere surfaces it.
 * Comparing on siteHost() makes the gate indifferent to which alias Vercel picked — the thing
 * we are actually asking is "is this deployment serving costfinders.ai".
 *
 * NOT fixed here, because it is not a code problem: NEXT_PUBLIC_* is inlined at build and
 * next.config.ts's headers() is build-time config, so the flip needs a REDEPLOY after the
 * domains are attached. It is not automatic. Verify it with
 * `curl -I https://www.costfinders.ai/` (no x-robots-tag) and `/robots.txt` (`Allow: /`)
 * before submitting anything to Search Console.
 */
export function isCanonicalDeployment(): boolean {
  // Preview and development deployments are never canonical.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return false
  }

  const deployedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (deployedHost) {
    return siteHost(deployedHost) === siteHost(new URL(CANONICAL_URL).host)
  }

  // Self-hosted `next start`: no Vercel host to compare against, so fall back to NODE_ENV.
  return process.env.NODE_ENV === 'production'
}

/**
 * Build a canonical URL from a path
 * @param path - Path relative to site root (e.g., '/california/irvine')
 * @returns Full canonical URL
 */
export function buildCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${SITE_CONFIG.url}${cleanPath}`
}

/**
 * A place name as its URL segment: "North Dakota" → "north-dakota", "Corona Del Mar" →
 * "corona-del-mar". The same rule as cityToSlug() and the states list. The state canonical
 * lowercased without it and published "north%20dakota" on every two-word state.
 */
function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Generate metadata for the city location hub.
 *
 * Deliberately NOT "Medspa Deals in {City}" — that is the title /deals/{city} carries, and
 * the two pages were competing for one query with near-identical copy while only one of them
 * was linked from anywhere. This page is the provider directory for the city; the deals page
 * is the offer listing. Different intent, different title, and they link to each other.
 *
 * @param city - City name (e.g., 'Irvine')
 * @param state - State name (e.g., 'California')
 * @param providerCount - Providers listed in this city; null where the page withholds its
 *   directory (fewer than 4 clinics — publicDirectory in src/lib/utils/identity.ts)
 */
export function generateLocationMetadata(
  city: string,
  state: string,
  providerCount: number | null,
): Metadata {
  const title = `Medspas in ${city}, ${state}`
  // "Browse providers by neighborhood" also went: the neighborhood block on every city page
  // renders "No Neighborhoods Available Yet" — the lookup is keyed `city-${slug}` against
  // fixtures for six cities none of which are served — so the snippet advertised a browse
  // that cannot work. At 164 characters it was also over the 155-char snippet budget and got
  // truncated mid-clause; this fits whole.
  const description = truncate(
    providerCount === null
      ? `Compare the treatment prices medspas in ${city}, ${state} advertise.`
      : `${providerCount} ${providerCount === 1 ? 'medspa or aesthetic clinic' : 'medspas and aesthetic clinics'} listed in ${city}, ${state}. See what each provider offers and compare the treatment prices they advertise.`,
  )
  const canonicalPath = `/${placeSlug(state)}/${placeSlug(city)}`

  return {
    title,
    description,
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

/**
 * Generate metadata for state-level pages
 * @param state - State name (e.g., 'California')
 * @param cityCount - Number of cities with deals
 * @param dealCount - Total OFFERS in the state. Not the provider count — the caller used to
 *   pass businessCount here, so /arizona advertised "31 medspa deals" over 77 real Tucson
 *   offers, and the snippet contradicted the deals pages it linked to.
 * @returns Next.js Metadata object
 */
export function generateStateMetadata(
  state: string,
  cityCount: number,
  dealCount: number,
): Metadata {
  const title = `Medspa Deals in ${state}`
  const description = truncate(
    `Browse ${dealCount} medspa ${dealCount === 1 ? 'deal' : 'deals'} across ${cityCount} ${cityCount === 1 ? 'city' : 'cities'} in ${state}. Compare the prices providers advertise.`,
  )
  const canonicalPath = `/${placeSlug(state)}`

  return {
    title,
    description,
    // A state with no live deal keeps its page (a real provider page sits under it) but is not
    // a deals page worth indexing: "Browse 0 medspa deals" is the thin page Google discounts.
    ...(dealCount === 0 && { robots: { index: false, follow: true } }),
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

/**
 * Generate metadata for provider pages
 * @param provider - Provider/business name
 * @param city - City name
 * @param state - State name
 * @returns Next.js Metadata object
 */
export function generateProviderMetadata(
  provider: string,
  city: string,
  state: string,
  /** The provider's real slug. Deriving it from the display name does not always round-trip. */
  slugOverride?: string,
): Metadata {
  // The scaffolding alone is 34 characters with the brand suffix, so 306 of 321 provider
  // pages overflowed — up to 139 characters. The name is what the searcher matched on, so
  // the brand suffix is what goes.
  const title = budgetedTitle(provider, ` — Medspa in ${city}, ${state}`)
  // A directory entry. Nothing about the provider's deals, not even a count: a deal's clinic is
  // what a claim reveals, and a count told which clinic in a one-clinic city had them. (Neither
  // "exclusive" nor "book today" was ever true either — the offers are the provider's own
  // public listings, and the site has no booking flow.)
  const description = truncate(
    `${provider}, ${city}, ${state}: address and Google rating.`,
  )
  const stateSlug = placeSlug(state)
  const citySlug = placeSlug(city)
  const providerSlug = placeSlug(provider)
  // '/provider/', singular. This said '/providers/' — a route that does not exist — and the
  // helper was never called, so nothing caught it. The provider page now calls it.
  const canonicalPath = `/${stateSlug}/${citySlug}/provider/${slugOverride ?? providerSlug}`

  return {
    title,
    description,
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

// SEO Deals Pages Metadata

/**
 * Generate metadata for city deals pages
 * Target keywords: "medspa deals [city]", "[city] medspa deals"
 * @param cityName - City name (e.g., "Houston")
 * @param citySlug - URL slug for the city (e.g., "houston")
 * @param stats - Stats object with dealCount, businessCount, and optional minPrice
 * @returns Next.js Metadata object
 */
export function generateCityDealsMetadata(
  cityName: string,
  citySlug: string,
  stats: {
    dealCount: number
    businessCount: number
    minPrice?: number
    /** `minPrice` is a price per unit — see `comparablePrice()` in src/lib/data/adapters.ts. */
    perUnit?: boolean
  },
): Metadata {
  const priceText = fromPrice(stats)
  const title = budgetedTitle(
    `Medspa Deals in ${cityName} | ${stats.dealCount} Offers${priceText}`,
  )
  const description = truncate(
    // No "from 1 local provider" — the same rule as the page (cityDealsPage.tsx).
    `Compare ${stats.dealCount} medspa ${stats.dealCount === 1 ? 'deal' : 'deals'} in ${cityName}${stats.businessCount > 1 ? `, from ${stats.businessCount} local providers,` : ''} at the prices they advertise.`,
  )
  const canonicalPath = `/deals/${citySlug}`

  return {
    title,
    description,
    keywords: [
      `medspa deals ${cityName}`,
      `${cityName} medspa deals`,
      `aesthetic treatments ${cityName}`,
      `botox ${cityName}`,
      `fillers ${cityName}`,
      `medspa ${cityName}`,
      `beauty deals ${cityName}`,
    ],
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

/**
 * Generate metadata for treatment+city pages
 * Target keywords: "[treatment] [city]", "[treatment] deals [city]"
 * @param treatmentName - Treatment name (e.g., "Botox")
 * @param treatmentSlug - URL slug for treatment (e.g., "botox")
 * @param cityName - City name (e.g., "Houston")
 * @param citySlug - URL slug for city (e.g., "houston")
 * @param stats - Stats object with dealCount, businessCount, and optional minPrice
 * @returns Next.js Metadata object
 */
export function generateTreatmentCityMetadata(
  treatmentName: string,
  treatmentSlug: string,
  cityName: string,
  citySlug: string,
  stats: {
    dealCount: number
    businessCount: number
    minPrice?: number
    /** `minPrice` is a price per unit — see `comparablePrice()` in src/lib/data/adapters.ts. */
    perUnit?: boolean
    /**
     * The neurotoxin brand `minPrice` is a price of. "Botox" keeps a Botox title; any other
     * brand retitles the page "Neurotoxins … (Dysport)", because every "Botox from $3" the site
     * printed was a Dysport unit.
     */
    brand?: string | null
  },
): Metadata {
  const priceText = fromPrice(stats)
  const titleName =
    treatmentSlug === 'botox' && stats.minPrice
      ? stats.brand === 'Botox'
        ? 'Botox'
        : 'Neurotoxins'
      : treatmentName
  const brandText =
    titleName === 'Neurotoxins' && stats.brand ? ` (${stats.brand})` : ''
  const title = budgetedTitle(
    `${titleName} in ${cityName}${priceText}${brandText} | ${stats.dealCount} ${stats.dealCount === 1 ? 'Deal' : 'Deals'}`,
  )
  const description = truncate(
    `Compare ${stats.dealCount} ${treatmentName.toLowerCase()} ${stats.dealCount === 1 ? 'deal' : 'deals'} in ${cityName}. See which local medspas are advertising ${treatmentName.toLowerCase()} discounts, and what they are asking.`,
  )
  const canonicalPath = `/deals/${treatmentSlug}/${citySlug}`

  return {
    title,
    description,
    keywords: [
      `${treatmentName.toLowerCase()} ${cityName}`,
      `${treatmentName.toLowerCase()} deals ${cityName}`,
      `${cityName} ${treatmentName.toLowerCase()}`,
      `best ${treatmentName.toLowerCase()} ${cityName}`,
      `${treatmentName.toLowerCase()} near me ${cityName}`,
      `${treatmentName.toLowerCase()} prices ${cityName}`,
    ],
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

// SEO Cost Guide Metadata

/**
 * Social card for pages without one of their own.
 *
 * A page-level `openGraph` object REPLACES the root layout's rather than merging into it, and
 * an ancestor's file-based opengraph-image is not pulled into it either. Every helper below
 * defines openGraph, so every /deals, /treatments, /{state}/{city} and provider URL shipped
 * with no og:image at all — 1,067 of the sitemap's URLs when the audit ran. Routes with a
 * co-located opengraph-image.tsx (the guides) keep their own, more specific card.
 */
export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'CostFinders — compare medspa prices',
} as const

/** Google truncates page titles around 60 characters / ~580px. */
const TITLE_CHAR_BUDGET = 60

/** Google truncates meta descriptions around 160 characters. */
const META_DESCRIPTION_CHARS = 155

/**
 * Trim to a whole word inside the snippet budget. 109 of 505 URLs shipped descriptions past
 * the cut-off, so the sentence Google actually rendered ended mid-clause.
 */
export function truncate(text: string, limit = META_DESCRIPTION_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Flatten a possibly-budgeted title for a social tag, which takes a plain string.
 */
function ogTitle(title: string | { absolute: string }): string {
  return typeof title === 'string' ? title : title.absolute
}

/**
 * Title within budget. Returns the shape Next's `title` field takes, bypassing the layout
 * template when the branded form does not fit.
 *
 * Concessions in order: drop the brand suffix, then trim `variable`. `fixed` is the part that
 * must survive — a provider's city, a deal's price — because it is what distinguishes this
 * page from its siblings. Dropping the brand alone was not enough: "Optimal Vitality
 * Aesthetics" in Oklahoma City still overflowed at 69 characters.
 */
export function budgetedTitle(
  variable: string,
  fixed = '',
): { absolute: string } {
  const brand = ` | ${SITE_CONFIG.name}`
  const width = (withBrand: boolean) =>
    variable.length + fixed.length + (withBrand ? brand.length : 0)

  if (width(true) <= TITLE_CHAR_BUDGET) {
    return { absolute: `${variable}${fixed}${brand}` }
  }
  if (width(false) <= TITLE_CHAR_BUDGET) {
    return { absolute: `${variable}${fixed}` }
  }
  const room = TITLE_CHAR_BUDGET - fixed.length - 1
  const trimmed = room > 12 ? `${variable.slice(0, room).trimEnd()}…` : variable
  return { absolute: `${trimmed}${fixed}` }
}

/**
 * " from $120", " from $42.40", " from $3.15 per unit", or nothing: the minimum a deals page
 * title leads with. A minimum is one real deal's price, so it prints exactly (`formatPrice`):
 * whole-dollar rounding turned $42.40 into "from $42" and Dysport's $3.15 into "$3 per unit",
 * prices no deal on the page has.
 */
function fromPrice(stats: { minPrice?: number; perUnit?: boolean }): string {
  if (!stats.minPrice) return ''
  const unit = stats.perUnit ? ' per unit' : ''
  return ` from ${formatPrice(stats.minPrice)}${unit}`
}

/**
 * Generate metadata for cost guide pages.
 *
 * Every target query is rooted on "cost", not "pricing" — the head term is "botox cost"
 * (8.1k/mo) and its variants ("how much does botox cost", "cost of botox", "average botox
 * cost", "botox cost <city>"). A keyword export for that cluster contains no instance of
 * the word "pricing" at all, which is why the whole guide vocabulary uses "cost". Guides
 * targeting "prices"/"pricing" are a separate future cluster, not this one.
 *
 * The title is kept under ~60 characters INCLUDING the " | CostFinders" the root layout's
 * title template appends, so Google renders it whole. The previous title
 * ("Botox Pricing in Tucson, AZ (2026) — Cost Guide | CostFinders") was 61-70 chars and
 * truncated mid-phrase on every guide.
 */
export function generateGuideMetadata(
  treatmentName: string,
  treatmentSlug: string,
  cityName: string,
  citySlug: string,
  stateCode: string,
  stats: {
    dealCount: number
    providerCount?: number
    minPrice?: number | null
    /** The neurotoxin brand of `minPrice`; a non-Botox floor is named in the snippet. */
    minBrand?: string | null
    maxPrice?: number | null
    /** The median. The page headline shows the median, so the snippet must too. */
    typicalPrice?: number | null
    /** Every figure above is a price per unit (`GuidePricingStats.perUnit`) — say so. */
    perUnit?: boolean
  },
  generatedAt?: string,
): Metadata {
  const canonicalPath = `/guides/${treatmentSlug}-cost-${citySlug}`
  // Regenerated daily by ISR against live Supabase pricing, so the current year is the
  // honest one. A hardcoded year silently rots into a stale-looking SERP result.
  const year = new Date().getFullYear()
  // Google truncates around 60 characters. "Microneedling Cost in Oklahoma City, OK"
  // plus a year plus " | CostFinders" does not fit, so the brand suffix is dropped rather
  // than the city — the city is what the query matched on. A parenthesised year is six
  // characters shorter than the "— 2026 Prices" it replaced, so 28 of 31 guides now keep
  // the brand suffix instead of 20 — and "Prices" no longer contradicts the cost framing.
  const bareTitle = `${treatmentName} Cost in ${cityName}, ${stateCode} (${year})`
  const brandedTitle = `${bareTitle} | ${SITE_CONFIG.name}`
  const title = {
    absolute:
      brandedTitle.length <= TITLE_CHAR_BUDGET ? brandedTitle : bareTitle,
  }

  // Both figures carry the unit when it applies: "ranging $3.15–$24.75 per unit, typically $12"
  // would read the median as the price of a treatment.
  const { perUnit = false } = stats
  const unit = perUnit ? ' per unit' : ''
  const floorBrand =
    stats.minBrand && stats.minBrand !== 'Botox' ? ` (${stats.minBrand})` : ''
  const rangeText =
    stats.minPrice != null && stats.maxPrice != null
      ? ` ranging ${formatPrice(stats.minPrice)}${floorBrand}–${formatPrice(stats.maxPrice)}${unit}`
      : ''
  // "averaging" used the mean while the hero stat card renders the median and the page says
  // "Midpoints are medians". On a market whose packages drag the mean up, the snippet
  // advertised a figure the page contradicted by as much as 22x. The range bounds above are
  // real deals' prices and print exactly; the median is a statistic ($552.5 from an even
  // count), so a price you pay reads as whole dollars and only a per-unit median keeps cents.
  const typicalText =
    stats.typicalPrice != null
      ? `, typically ${formatPrice(perUnit ? stats.typicalPrice : Math.round(stats.typicalPrice))}${unit}`
      : ''
  const providerText = stats.providerCount
    ? ` from ${stats.providerCount} local providers`
    : ''
  const description = truncate(
    `How much ${treatmentName.toLowerCase()} ${treatmentCost(treatmentName)} in ${cityName}, ${stateCode}: ${stats.dealCount} live deals${providerText}${rangeText}${typicalText}. See what drives the cost locally and how to pay less.`,
  )

  const lowerTreatment = treatmentName.toLowerCase()
  const lowerCity = cityName.toLowerCase()

  return {
    title,
    description,
    // All eight rooted on "cost", mirroring the real query cluster: the bare head term,
    // the "<treatment> cost <city>" geo form, the "how much does ... cost" question form,
    // "cost of ...", "average ... cost", and the near-me variant.
    keywords: [
      `${lowerTreatment} cost`,
      `${lowerTreatment} cost ${lowerCity}`,
      `${lowerTreatment} cost ${lowerCity} ${stateCode.toLowerCase()}`,
      `how much does ${lowerTreatment} cost in ${lowerCity}`,
      `cost of ${lowerTreatment} in ${lowerCity}`,
      `average ${lowerTreatment} cost ${lowerCity}`,
      `${lowerTreatment} cost near me`,
      `medspa cost ${lowerCity}`,
    ],
    authors: [{ name: SITE_CONFIG.name, url: SITE_CONFIG.url }],
    openGraph: {
      title: bareTitle,
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'article',
      locale: 'en_US',
      ...(generatedAt && {
        publishedTime: new Date(generatedAt).toISOString(),
        modifiedTime: new Date().toISOString(),
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: bareTitle,
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}

/**
 * Generate metadata for the /guides hub.
 * @param guideCount - Number of published cost guides
 * @param cityCount - Number of distinct cities covered
 */
export function generateGuidesHubMetadata(
  guideCount: number,
  cityCount: number,
): Metadata {
  const title = 'Medspa Treatment Cost Guides by City'
  const description = truncate(
    // Fits the 155-char snippet budget whole. The old string ran to 172 and truncate() cut it
    // mid-clause on every render.
    `${guideCount} city-by-city cost guides across ${cityCount} markets. What Botox, fillers, facials, lasers and skin treatments cost near you, from prices medspas advertise.`,
  )
  const canonicalPath = '/guides'

  return {
    title,
    description,
    keywords: [
      'medspa cost guide',
      'botox cost',
      'botox cost by city',
      'filler cost by city',
      'how much do medspa treatments cost',
      'aesthetic treatment cost guide',
    ],
    openGraph: {
      title: ogTitle(title),
      description,
      url: buildCanonicalUrl(canonicalPath),
      siteName: SITE_CONFIG.name,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle(title),
      description,
      site: SITE_CONFIG.social.twitter,
    },
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
  }
}
