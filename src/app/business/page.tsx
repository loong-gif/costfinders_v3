import type { Metadata } from 'next'
import { BusinessLandingPage } from '@/components/features/business/businessLandingPage'
import { offerToLean } from '@/lib/data/adapters'
import {
  getHomepageCounts,
  getLowestBotoxUnitOffers,
} from '@/lib/data/homepage'
import { getClinicConfirmations } from '@/lib/data/offers'
import {
  buildCanonicalUrl,
  OG_IMAGE,
  SITE_CONFIG,
  truncate,
} from '@/lib/seo/metadata'

/**
 * Server wrapper around the client landing page.
 *
 * The whole route used to be one 'use client' file, which cannot export metadata — so a page
 * that is linked from the homepage and the footer served the root layout's consumer-facing
 * title and description verbatim, with no canonical of its own.
 */
export const metadata: Metadata = {
  title: 'For Medspa Owners',
  description: truncate(
    'See how your advertised offers appear on CostFinders, and ask us to add your medspa or correct your listing.',
  ),
  alternates: { canonical: buildCanonicalUrl('/business') },
  openGraph: {
    title: 'For Medspa Owners | CostFinders',
    description:
      'See how your advertised offers appear on CostFinders, and ask us to add or correct your listing.',
    url: buildCanonicalUrl('/business'),
    siteName: SITE_CONFIG.name,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
}

export const revalidate = 3600

export default async function BusinessPage() {
  const [counts, lowest, confirmed] = await Promise.all([
    getHomepageCounts(),
    getLowestBotoxUnitOffers(1),
    getClinicConfirmations(),
  ])
  // Stamped like every list's rows (toDeals() in unified.ts), which this example skips.
  const example = lowest[0]
    ? {
        ...offerToLean(lowest[0]),
        clinicConfirmed: confirmed.has(lowest[0].id),
      }
    : null
  return <BusinessLandingPage counts={counts} example={example} />
}
