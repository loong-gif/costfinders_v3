import type { MetadataRoute } from 'next'
import { isCanonicalDeployment, SITE_CONFIG } from '@/lib/seo/metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isCanonicalDeployment()
      ? {
          userAgent: '*',
          allow: '/',
          // No trailing slashes: "/admin/" leaves /admin itself crawlable.
          disallow: ['/api', '/admin', '/dashboard', '/business/dashboard'],
        }
      : {
          // Not the canonical host. Every page here emits a canonical pointing at
          // SITE_CONFIG.url, and Google discards a canonical whose target 404s and re-picks
          // from the duplicate cluster — which on a preview or pre-cutover deployment means
          // it would index the throwaway hostname instead. Staying out of the index until
          // the real domain is attached is strictly better than indexing under a host that
          // gets discarded at cutover.
          userAgent: '*',
          disallow: '/',
        },
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  }
}
