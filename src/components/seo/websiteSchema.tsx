import { buildWebsiteSchema } from '@/lib/seo'

/**
 * WebsiteSchema - Server Component for WebSite JSON-LD structured data
 * Emits Schema.org WebSite markup for search engine rich results
 */
export function WebsiteSchema() {
  const schema = buildWebsiteSchema()

  return (
    <script
      type="application/ld+json"
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed website object,
      // never user input, so there is no injection surface.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
