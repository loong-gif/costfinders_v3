import { buildFaqSchema } from '@/lib/seo'

interface FaqSchemaProps {
  /**
   * Array of FAQ items
   * Each item should have a question and answer
   */
  items: Array<{ question: string; answer: string }>
}

/**
 * FaqSchema - Server Component for FAQPage JSON-LD structured data
 * Emits Schema.org FAQPage markup for search engine rich results
 *
 * Usage: Add to pages with FAQ content (e.g., category, state pages)
 * Example:
 *   <FaqSchema items={[
 *     { question: 'How long does Botox last?', answer: 'Typically 3-4 months...' },
 *     { question: 'Is Botox painful?', answer: 'Most patients report minimal discomfort...' }
 *   ]} />
 */
export function FaqSchema({ items }: FaqSchemaProps) {
  if (items.length === 0) return null

  const schema = buildFaqSchema(items)

  return (
    <script
      type="application/ld+json"
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed FAQ object,
      // never user input, so there is no injection surface.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
