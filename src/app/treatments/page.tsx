import type { Metadata } from 'next'
import { TreatmentsPageContent } from '@/components/features/treatments/treatmentsPageContent'
import { BreadcrumbSchema } from '@/components/seo'
import { bucketPriceRanges } from '@/lib/data/homepage'
import { getOffersWithBusinesses } from '@/lib/data/offers'
import { getUnifiedCategories } from '@/lib/data/unified'
import { buildCanonicalUrl, OG_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata'

export const revalidate = 86400 // ISR: regenerate every 24 hours

export const metadata: Metadata = {
  title: 'Browse Aesthetic Treatments',
  description:
    // Not "verified medspa providers": nothing on this site verifies a provider —
    // business_profiles holds 0 rows. The listings are prices providers publish themselves.
    'Explore aesthetic treatment categories: Botox, fillers, facials, laser, body contouring and skincare. Compare the prices medspa providers advertise.',
  alternates: {
    canonical: buildCanonicalUrl('/treatments'),
  },
  openGraph: {
    title: 'Browse Aesthetic Treatments',
    description:
      'Explore aesthetic treatment categories including Botox, fillers, facials, laser treatments, body contouring, and skincare.',
    url: buildCanonicalUrl('/treatments'),
    siteName: SITE_CONFIG.name,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
}

export default async function TreatmentsPage() {
  // One corpus (React-cached), one bucket rule: the tiles and the list below name the same
  // categories, and each count is the count of the page it opens. It used to pair the six
  // per-treatment tiles with the four browse buckets ("925 deals · 4 categories" over six cards).
  const [allCategories, offers] = await Promise.all([
    getUnifiedCategories(),
    getOffersWithBusinesses(),
  ])
  const categories = allCategories.filter((c) => c.count > 0)
  // Deals with a treatment category — the ones these pages list. A clinic-wide offer is on its
  // city page only, so this is below the site-wide total by design.
  const totalDeals = categories.reduce((sum, c) => sum + c.count, 0)
  const ranges = bucketPriceRanges(offers)

  const breadcrumbItems = [
    { name: 'Home', url: SITE_CONFIG.url },
    { name: 'Treatments', url: buildCanonicalUrl('/treatments') },
  ]

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <TreatmentsPageContent
        categories={categories}
        totalDeals={totalDeals}
        ranges={ranges}
      />
    </>
  )
}
