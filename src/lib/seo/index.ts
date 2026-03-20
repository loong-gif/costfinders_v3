// SEO utility library barrel export

// Re-export types for convenience
export type { Metadata } from 'next'
export type {
  BreadcrumbList,
  Organization,
  WebSite,
  WithContext,
} from 'schema-dts'
// Metadata utilities
export {
  buildCanonicalUrl,
  generateLocationMetadata,
  generateStateMetadata,
  SITE_CONFIG,
} from './metadata'
// Structured data schema builders
export {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildLocalBusinessSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
} from './schemas'
