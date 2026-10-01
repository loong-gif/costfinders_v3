import type {
  BreadcrumbList,
  FAQPage,
  ListItem,
  Organization,
  WebSite,
  WithContext,
} from 'schema-dts'

import { treatmentCost } from '@/lib/utils/treatment-grammar'
import type { PriceBasis } from '@/types/deal'
import { SITE_CONFIG } from './metadata'

/** Google reads the first handful of an ItemList; shipping the whole city is pointless bytes. */
const MAX_ITEMLIST_ELEMENTS = 10

/**
 * Build WebSite structured data schema
 * @returns JSON-LD WebSite object for the main site
 */
export function buildWebsiteSchema(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    // No potentialAction. It declared a SearchAction against /deals?q={term}, and the deals
    // route reads no search params at all -- the URL it advertised returns the unfiltered
    // index whatever you put in it. Restore only if /deals learns to apply searchParams.q.
  }
}

/**
 * Build Organization structured data schema
 * @returns JSON-LD Organization object for CostFinders
 */
export function buildOrganizationSchema(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SITE_CONFIG.description,
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.social.twitter.replace('@', '')}`,
      `https://instagram.com/${SITE_CONFIG.social.instagram.replace('@', '')}`,
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'English',
    },
  }
}

/**
 * Build BreadcrumbList structured data schema
 * @param items - Array of breadcrumb items with name and url
 * @returns JSON-LD BreadcrumbList object
 */
export function buildBreadcrumbSchema(
  items: Array<{ name: string; url: string }>,
): WithContext<BreadcrumbList> {
  const itemListElement: ListItem[] = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}

/**
 * Build LocalBusiness structured data for a medspa provider
 * @param provider - Provider details
 * @returns JSON-LD LocalBusiness object
 */
export function buildLocalBusinessSchema(provider: {
  name: string
  description?: string
  address: {
    streetAddress?: string
    city: string
    state: string
    postalCode?: string
  }
  telephone?: string
  url?: string
  priceRange?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: provider.name,
    description: provider.description,
    // Only assert what we have. master_business_info carries no postal code and the
    // provider route passed '' for it on every page; an empty postalCode is a claim that
    // the business has no postcode. priceRange defaulted to '$' for every provider on the
    // site regardless of its actual prices -- a fabricated band, and the one property here
    // most likely to be surfaced to a user.
    address: {
      '@type': 'PostalAddress',
      ...(provider.address.streetAddress && {
        streetAddress: provider.address.streetAddress,
      }),
      addressLocality: provider.address.city,
      addressRegion: provider.address.state,
      ...(provider.address.postalCode && {
        postalCode: provider.address.postalCode,
      }),
      addressCountry: 'US',
    },
    ...(provider.telephone && { telephone: provider.telephone }),
    ...(provider.url && { url: provider.url }),
    ...(provider.priceRange && { priceRange: provider.priceRange }),
    // No aggregateRating, for the same reason priceRange and postalCode went: it was not ours
    // to publish. The values came from master_business_info.score / .review_count, which are
    // scraped Google figures (the table keys on google_place_id), and CostFinders renders no
    // review content at all — business_reviews holds 1,252 rows that no route reads. Google's
    // review-snippet policy requires rating markup to reflect reviews collected from users on
    // the page carrying the markup and explicitly disallows aggregating another site's
    // ratings, so this block was a structured-data violation on all 321 provider URLs at once
    // as well as an unsubstantiated first-party claim. If CostFinders ever collects and
    // renders its own reviews, add it back keyed on those — never on the scraped score.
  }
}

/**
 * Build FAQPage structured data schema
 * @param items - Array of FAQ items with question and answer
 * @returns JSON-LD FAQPage object
 */
export function buildFaqSchema(
  items: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

// SEO Deals Pages Schemas

/**
 * Build ItemList schema for city deals page
 * Shows deals as a structured list for rich results
 * @param deals - Array of deals to include
 * @param cityName - City name for location context
 * @returns JSON-LD ItemList object
 */
export function buildDealsListSchema(
  deals: Array<{
    id: string
    title: string
    description: string
    dealPrice: number
    locationArea: string
  }>,
  cityName: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Medspa Deals in ${cityName}`,
    // Not "Best": nothing ranks these, and a superlative in markup is a claim Google shows.
    description: `Medspa deals and discounts advertised in ${cityName}`,
    // numberOfItems must match what the list actually ships. It reported the full city deal
    // count while emitting ten elements, so a 221-deal city declared 221 and sent 10.
    //
    // Elements are URL summaries, not inline Offers. Each Offer here carried a seller whose
    // only property was the city -- the same anonymous stub 10 times -- because provider
    // identity is deliberately withheld until a user claims a deal. The offer markup now
    // lives on the deal detail page, where the seller and price genuinely belong.
    numberOfItems: Math.min(deals.length, MAX_ITEMLIST_ELEMENTS),
    itemListElement: deals
      .slice(0, MAX_ITEMLIST_ELEMENTS)
      .map((deal, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: deal.title,
        url: `${SITE_CONFIG.url}/deals/${deal.id}`,
      })),
  }
}

/**
 * Build Service schema for treatment+city and national treatment pages.
 *
 * Takes no price stats any more: the AggregateOffer it used to build read lowPrice and
 * highPrice off different units, and its guard was truthy so a $0 row deleted the block
 * outright instead of being excluded from it. See the note at the return statement.
 *
 * @param treatmentName - Treatment name (e.g., "Botox")
 * @param cityName - City name, or undefined on the national category page
 */
export function buildTreatmentServiceSchema(
  treatmentName: string,
  cityName: string | undefined,
) {
  // The national /treatments/[category] page passed the literal string "Multiple Cities" as
  // a schema.org City name, publishing a place that does not exist. A national service is
  // served by a country, or by nothing at all.
  const areaServed = cityName
    ? { '@type': 'City' as const, name: cityName }
    : { '@type': 'Country' as const, name: 'United States' }

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cityName
      ? `${treatmentName} Treatments in ${cityName}`
      : `${treatmentName} Treatments`,
    serviceType: treatmentName,
    // "verified" is gone from every description on the site: business_profiles has 0 rows and
    // business_claims has 0 rows, so no provider has ever been claimed, let alone verified.
    // What is true is that the prices are the ones providers advertised publicly.
    description: cityName
      ? `Compare ${treatmentName.toLowerCase()} prices advertised by medspa providers in ${cityName}`
      : `Compare ${treatmentName.toLowerCase()} prices advertised by medspa providers`,
    areaServed,
    // No AggregateOffer and no provider, for the same reasons they were dropped from the
    // guide Article: lowPrice and highPrice come from different units (a $4.04 per-unit rate
    // against a $3,499 package), and `provider` was an anonymous HealthAndBeautyBusiness
    // whose only property was the city — a seller stub on a page that deliberately withholds
    // seller identity until a deal is claimed. The old guard was truthy too, so a $0 row
    // silently deleted the whole block rather than being excluded from it.
  }
}

/**
 * Build Article schema for cost guide pages.
 *
 * Carries the properties Google actually requires for an Article rich result — headline
 * under 110 characters, image, datePublished, dateModified, author and a publisher with a
 * logo ImageObject — none of which the first version emitted, plus mainEntityOfPage so the
 * Article is bound to this URL rather than floating free.
 *
 * @param dateModified - ISO timestamp; pass the ISR regeneration time, not the authoring date.
 */
export function buildPricingGuideSchema(
  treatmentName: string,
  cityName: string,
  state: string,
  slug: string,
  stats: {
    dealCount: number
    minPrice?: number | null
    maxPrice?: number | null
    avgPrice?: number | null
    providerCount: number
  },
  dates: { datePublished: string; dateModified: string },
) {
  const url = `${SITE_CONFIG.url}/guides/${slug}`

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: `${treatmentName} Cost in ${cityName}, ${state}`,
    description: `What ${treatmentName.toLowerCase()} ${treatmentCost(treatmentName)} in ${cityName}, ${state}, based on ${stats.dealCount} live offers from ${stats.providerCount} local providers.`,
    url,
    image: [`${url}/opengraph-image`],
    inLanguage: 'en-US',
    datePublished: dates.datePublished,
    dateModified: dates.dateModified,
    // "CostFinders", not "CostFinders Research": there is no research team by that name.
    author: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.url}/logo.png`,
      },
    },
    about: {
      '@type': 'Service',
      name: `${treatmentName} Treatments`,
      serviceType: treatmentName,
      areaServed: {
        '@type': 'City',
        name: cityName,
        containedInPlace: {
          '@type': 'State',
          name: state,
        },
      },
      // No AggregateOffer. It read lowPrice from the cheapest row and highPrice from the
      // dearest, and those are not the same kind of thing: $4.04 is one unit of Dysport and
      // $3,499 is a multi-syringe package. Publishing "$4-$3,499" as this service's price
      // range is a false claim in machine-readable form, and Google does not surface an
      // AggregateOffer nested under Article.about anyway, so it bought nothing to offset it.
    },
  }
}

/**
 * Build CollectionPage + ItemList schema for the /guides hub.
 * Gives the cluster a crawlable, machine-readable index of its members.
 */
export function buildGuidesHubSchema(
  guides: Array<{ slug: string; name: string }>,
) {
  const url = `${SITE_CONFIG.url}/guides`

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: 'Medspa Treatment Cost Guides by City',
    description:
      'City-by-city cost guides for Botox, dermal fillers, facials, laser and skin treatments, built from prices medspa providers advertise publicly.',
    inLanguage: 'en-US',
    isPartOf: { '@type': 'WebSite', '@id': SITE_CONFIG.url },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: guides.length,
      itemListElement: guides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: guide.name,
        url: `${SITE_CONFIG.url}/guides/${guide.slug}`,
      })),
    },
  }
}

/**
 * Build the Offer schema for one deal detail page: an Offer whose `itemOffered` is a Service.
 *
 * Not a Product with `availability: InStock`. That is retail-merchant markup — a treatment at a
 * clinic is not a stocked item, and "in stock" is a claim about a shop's inventory that nobody
 * made. An Offer stands on its own; the price, when the clinic states one, rides on it.
 *
 * No `seller`: provider identity is withheld until a user claims the deal, so naming one
 * would contradict the page. An Offer without a seller is valid; a fabricated one is not.
 */
export function buildDealOfferSchema(deal: {
  id: string
  title: string
  description: string
  dealPrice: number
  priceBasis: PriceBasis
  originalPrice: number
  /** The treatment's label, or null for a deal that names no single treatment. */
  category: string | null
  locationArea: string
  validUntil?: string
}) {
  const url = `${SITE_CONFIG.url}/deals/${deal.id}`

  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    '@id': `${url}#offer`,
    url,
    name: deal.title,
    description: deal.description,
    itemOffered: {
      '@type': 'Service',
      name: deal.title,
      ...(deal.category && { category: deal.category }),
    },
    ...offerPrice(deal),
    ...(deal.locationArea && {
      areaServed: { '@type': 'City', name: deal.locationArea },
    }),
  }
}

/**
 * The Offer's price properties, or none.
 *
 * Four ways this markup can lie. Each bullet dates the live-database figures it quotes; the two
 * that were zero on 2026-09-16 were 13x and 6x wrong in the previous version of this comment,
 * which is how a guard comes to be defended by a number nobody can reproduce.
 * - On 2026-09-16, 332 of the 814 visible offers published no discount_price, and the adapter
 *   coerces that to 0. Publishing `price: 0` tells Google the treatment is free. `dealPrice > 0`
 *   is therefore the whole gate: 305 of them stated a discount the page leads with ("20% off",
 *   "$100 off") and 27 read "Free with membership" / "Free with purchase", and NONE of the 332
 *   may publish a price here. Those 27 are the sharpest case: the price is 0 only because a
 *   $149/month plan or 40 units of something else earns it, so `price: 0` would advertise a
 *   giveaway that does not exist.
 * - On 2026-09-16, 107 offers carried an end_date and **0 of them had passed**, so `hasExpired`
 *   never fired. It stays because an expired price advertised as InStock is a price Google will
 *   show and a user will not get, and these dates are one pipeline run from being stale.
 * - On 2026-09-16, 15 offers had no city on their business. `deal.locationArea` is
 *   `biz.city ?? ''`, so the `&&` on areaServed below already makes the empty-name City
 *   unreachable — the guard is doing its job, not waiting for one.
 * - A bare `price` says nothing about what it buys: Dysport's $4.25 rate published as the
 *   price of a ~$130 treatment, and "40 units for $299" with no quantity at all. `priceBasis`
 *   says which. A rate publishes its per-unit price in a `UnitPriceSpecification` whose
 *   `referenceQuantity` is one of its unit; a quantity publishes its total with the count as
 *   `eligibleQuantity`; a total is just a price. Of the 477 priced visible offers on
 *   2026-09-18: 202 rates (181 per unit, 13 per syringe, 6 per vial, 2 per treatment), 51
 *   quantities, 224 totals. A rate whose unit nothing names publishes NO Offer — 0 of them that
 *   day, but a bare figure with no unit is exactly the claim this bullet used to apologise for.
 *   See `offerPriceBasis()` in src/lib/data/adapters.ts. A misread neurotoxin rate (outside
 *   $2–$30 a unit, e.g. offer 8509's "reg $3.75/unit" stored as a $400 rate) never reaches
 *   buildOffer with a price: the adapter zeroes it, so the `dealPrice > 0` gate publishes no
 *   Offer for it. See `isMisreadUnitRate()`.
 * An Offer with no price is valid markup ("20% off" is the whole offer). An Offer with a false
 * price is not. Since 2026-09-24 a price the offer's own text does not state reaches here as 0
 * too (`priceIsStated()` in adapters.ts).
 */
function offerPrice(deal: {
  dealPrice: number
  priceBasis: PriceBasis
  originalPrice: number
  validUntil?: string
}) {
  if (!(deal.dealPrice > 0)) return {}

  const basis = deal.priceBasis
  if (basis.kind === 'rate' && !basis.unit) return {}

  const expiry = deal.validUntil ? new Date(deal.validUntil) : null
  const hasExpired =
    expiry !== null && !Number.isNaN(expiry.valueOf()) && expiry < new Date()
  if (hasExpired) return {}

  // On a rate both prices are per unit — the regular price too ("reg $12/unit, now $10").
  const referenceQuantity =
    basis.kind === 'rate'
      ? { '@type': 'QuantitativeValue', value: 1, unitText: basis.unit }
      : null
  const priceSpecification = [
    ...(referenceQuantity
      ? [
          {
            '@type': 'UnitPriceSpecification',
            price: deal.dealPrice,
            priceCurrency: 'USD',
            referenceQuantity,
          },
        ]
      : []),
    ...(deal.originalPrice > deal.dealPrice
      ? [
          {
            '@type': 'UnitPriceSpecification',
            priceType: 'https://schema.org/ListPrice',
            price: deal.originalPrice,
            priceCurrency: 'USD',
            ...(referenceQuantity && { referenceQuantity }),
          },
        ]
      : []),
  ]

  return {
    price: deal.dealPrice,
    priceCurrency: 'USD',
    ...(expiry &&
      !Number.isNaN(expiry.valueOf()) && {
        priceValidUntil: deal.validUntil,
      }),
    ...(priceSpecification.length > 0 && {
      priceSpecification:
        priceSpecification.length === 1
          ? priceSpecification[0]
          : priceSpecification,
    }),
    // "$299 for 40 units": the price is the total, valid for that many.
    ...(basis.kind === 'quantity' && {
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        value: basis.count,
        unitText: basis.unit,
      },
    }),
  }
}
