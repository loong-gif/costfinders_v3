import { buildBreadcrumbSchema } from '@/lib/seo'

interface BreadcrumbSchemaProps {
  /**
   * Array of breadcrumb items
   * Each item should have a name (display text) and url (full URL)
   */
  items: Array<{ name: string; url: string }>
}

/**
 * BreadcrumbSchema - Server Component for BreadcrumbList JSON-LD structured data
 * Emits Schema.org BreadcrumbList markup for search engine rich results
 *
 * Usage: Add to individual pages (e.g., location pages in Phase 25+)
 * Example:
 *   <BreadcrumbSchema items={[
 *     { name: 'Home', url: 'https://costfinders.com' },
 *     { name: 'California', url: 'https://costfinders.com/ca' },
 *     { name: 'Newport Beach', url: 'https://costfinders.com/ca/newport-beach' }
 *   ]} />
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = buildBreadcrumbSchema(items)

  return (
    <script
      type="application/ld+json"
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed breadcrumb object,
      // never user input, so there is no injection surface.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
