import type {
  BreadcrumbList,
  FAQPage,
  ListItem,
  Organization,
  WebSite,
  WithContext,
} from 'schema-dts'

import { SITE_CONFIG } from './metadata'

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
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.url}/deals?q={search_term_string}`,
      },
      // @ts-expect-error - query-input is valid Schema.org property
      'query-input': 'required name=search_term_string',
    },
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
    streetAddress: string
    city: string
    state: string
    postalCode: string
  }
  telephone?: string
  url?: string
  priceRange?: string
  rating?: {
    value: number
    count: number
  }
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: provider.name,
    description: provider.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: provider.address.streetAddress,
      addressLocality: provider.address.city,
      addressRegion: provider.address.state,
      postalCode: provider.address.postalCode,
      addressCountry: 'US',
    },
    telephone: provider.telephone,
    url: provider.url,
    priceRange: provider.priceRange || '$$',
    ...(provider.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: provider.rating.value,
        reviewCount: provider.rating.count,
      },
    }),
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
    description: `Best medspa deals and discounts in ${cityName}`,
    numberOfItems: deals.length,
    itemListElement: deals.slice(0, 10).map((deal, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Offer',
        name: deal.title,
        description: deal.description,
        price: deal.dealPrice,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE_CONFIG.url}/deals/${deal.id}`,
        seller: {
          '@type': 'HealthAndBeautyBusiness',
          address: {
            '@type': 'PostalAddress',
            addressLocality: cityName,
          },
        },
      },
    })),
  }
}

/**
 * Build Service schema for treatment+city pages
 * Shows the treatment as a service available in the city
 * @param treatmentName - Treatment name (e.g., "Botox")
 * @param cityName - City name
 * @param stats - Price and count stats
 * @returns JSON-LD Service object
 */
export function buildTreatmentServiceSchema(
  treatmentName: string,
  cityName: string,
  stats: {
    dealCount: number
    minPrice?: number
    maxPrice?: number
  },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${treatmentName} Treatments in ${cityName}`,
    serviceType: treatmentName,
    description: `Compare ${treatmentName.toLowerCase()} deals from verified medspa providers in ${cityName}`,
    areaServed: {
      '@type': 'City',
      name: cityName,
    },
    ...(stats.minPrice &&
      stats.maxPrice && {
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: stats.minPrice,
          highPrice: stats.maxPrice,
          priceCurrency: 'USD',
          offerCount: stats.dealCount,
        },
      }),
    provider: {
      '@type': 'HealthAndBeautyBusiness',
      address: {
        '@type': 'PostalAddress',
        addressLocality: cityName,
      },
    },
  }
}
