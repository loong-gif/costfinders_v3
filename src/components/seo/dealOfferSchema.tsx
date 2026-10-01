import { buildDealOfferSchema } from '@/lib/seo/schemas'
import type { PriceBasis } from '@/types/deal'

interface DealOfferSchemaProps {
  deal: {
    id: string
    title: string
    description: string
    dealPrice: number
    /** What `dealPrice` buys — without it a $4.25 unit rate publishes as a $4.25 treatment. */
    priceBasis: PriceBasis
    originalPrice: number
    /** The treatment's label, or null for a deal that names no single treatment. */
    category: string | null
    locationArea: string
    validUntil?: string
  }
}

/**
 * DealOfferSchema - Server Component for a deal detail page's Offer JSON-LD.
 */
export function DealOfferSchema({ deal }: DealOfferSchemaProps) {
  const schema = buildDealOfferSchema(deal)

  return (
    <script
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed object sourced from
      // Supabase columns, never user input.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  )
}
