import { buildOrganizationSchema } from '@/lib/seo'

/**
 * OrganizationSchema - Server Component for Organization JSON-LD structured data
 * Emits Schema.org Organization markup for search engine rich results
 *
 * Description optimized for Orange County keywords:
 * - "medspa prices", "Orange County", "Botox", "lip fillers"
 * - "Newport Beach", "Irvine" (high-volume local keywords)
 */
export function OrganizationSchema() {
  const schema = buildOrganizationSchema()

  return (
    <script
      type="application/ld+json"
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed organization object,
      // never user input, so there is no injection surface.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
