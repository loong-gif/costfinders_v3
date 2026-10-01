import { buildPricingGuideSchema } from '@/lib/seo/schemas'

interface PricingGuideSchemaProps {
  treatmentName: string
  cityName: string
  state: string
  slug: string
  stats: {
    dealCount: number
    minPrice?: number | null
    maxPrice?: number | null
    avgPrice?: number | null
    providerCount: number
  }
  dates: { datePublished: string; dateModified: string }
}

/**
 * PricingGuideSchema - Server Component for the guide page's Article JSON-LD.
 * Mirrors BreadcrumbSchema/FaqSchema so every schema on the site is emitted the same way.
 */
export function PricingGuideSchema({
  cityName,
  dates,
  slug,
  state,
  stats,
  treatmentName,
}: PricingGuideSchemaProps) {
  const schema = buildPricingGuideSchema(
    treatmentName,
    cityName,
    state,
    slug,
    stats,
    dates,
  )

  return (
    <script
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed object assembled
      // from repo-owned JSON and Supabase aggregates, never user input.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  )
}
