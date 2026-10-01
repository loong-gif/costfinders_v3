import { buildGuidesHubSchema } from '@/lib/seo/schemas'

interface GuidesHubSchemaProps {
  guides: Array<{ slug: string; name: string }>
}

/**
 * GuidesHubSchema - Server Component for the /guides CollectionPage + ItemList JSON-LD.
 * Declares the pricing-guide cluster as one indexed collection rather than a set of
 * unrelated pages.
 */
export function GuidesHubSchema({ guides }: GuidesHubSchemaProps) {
  const schema = buildGuidesHubSchema(guides)

  return (
    <script
      // JSON-LD has to be injected as raw script content; this is the documented Next
      // pattern. The payload is JSON.stringify of a server-built typed object, never
      // user input.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from typed server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  )
}
