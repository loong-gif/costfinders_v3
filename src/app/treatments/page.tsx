import type { Metadata } from 'next'
import { BreadcrumbSchema } from '@/components/seo'
import { TreatmentsPageContent } from '@/components/features/treatments/treatmentsPageContent'
import { getUnifiedCategories } from '@/lib/data/unified'
import { buildCanonicalUrl, SITE_CONFIG } from '@/lib/seo/metadata'

export const revalidate = 86400 // ISR: regenerate every 24 hours

export const metadata: Metadata = {
  title: 'Browse Aesthetic Treatments | CostFinders',
  description:
    'Explore aesthetic treatment categories including Botox, fillers, facials, laser treatments, body contouring, and skincare. Compare deals from verified medspa providers.',
  alternates: {
    canonical: buildCanonicalUrl('/treatments'),
  },
  openGraph: {
    title: 'Browse Aesthetic Treatments | CostFinders',
    description:
      'Explore aesthetic treatment categories including Botox, fillers, facials, laser treatments, body contouring, and skincare.',
    url: buildCanonicalUrl('/treatments'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

export default async function TreatmentsPage() {
  const allCategories = await getUnifiedCategories()
  const categories = allCategories.filter((c) => c.count > 0)
  const totalDeals = categories.reduce((sum, c) => sum + c.count, 0)

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
      />
    </>
  )
}
