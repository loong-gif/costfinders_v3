import type { NextConfig } from 'next'

/**
 * Every env read in this file is `.trim()`ed, and that is load-bearing, not hygiene.
 *
 * A Vercel environment variable can hold a trailing newline — three of this project's did,
 * set 175 days ago (`NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, `_CLOUDINARY_CLOUD_NAME`, all
 * ending in a real LF). headers() below interpolates one of them into a response header
 * value, and both Node's `setHeader` and `new Headers` throw ERR_INVALID_CHAR on an embedded
 * LF, so EVERY Node function invocation on production — auth callback, every Server Action,
 * OG images, /api/health, ISR revalidation — returned Vercel's static /500 with no function
 * log. Only prerendered HIT responses answered. Trimming here means an env value nobody
 * re-typed cannot take the site down again.
 */

/**
 * The canonical origin. Mirrors CANONICAL_URL in src/lib/seo/metadata.ts — deliberately
 * duplicated rather than imported, because next.config.ts is evaluated before the TS path
 * aliases exist. The two must stay in step.
 */
const CANONICAL_URL =
  // `||`, not `??`: a whitespace-only value trims to '' and must fall back too.
  process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') ||
  'https://www.costfinders.ai'

/**
 * Bare host: scheme, `www.` and any path stripped.
 *
 * The www/apex normalisation is the load-bearing part. Vercel documents
 * VERCEL_PROJECT_PRODUCTION_URL as "the shortest production custom domain", so once BOTH
 * costfinders.ai and www.costfinders.ai are attached to this project it resolves to the
 * APEX (14 chars) while NEXT_PUBLIC_BASE_URL names the www host (18 chars). A literal
 * comparison then returns false on the real domain, robots.ts keeps serving `Disallow: /`
 * and every response keeps `X-Robots-Tag: noindex` — the site launches permanently
 * unindexable with nothing in the UI to show it. Folding www away makes the gate flip for
 * whichever member of the pair Vercel picks.
 */
function bareHost(value: string): string {
  // Same normalisation as siteHost() in src/lib/seo/metadata.ts, trim and lowercase
  // included. When the two disagree the noindex header and robots.txt disagree, which is
  // exactly the silent-forever failure the comment above describes.
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase()
}

/**
 * Is this deployment the canonical host? Mirrors isCanonicalDeployment() in
 * src/lib/seo/metadata.ts — same duplication caveat as CANONICAL_URL above.
 *
 * NOTE: headers() is build-time configuration and NEXT_PUBLIC_* values are inlined at
 * build, so attaching the domain is not enough — the cutover needs a REDEPLOY before this
 * flips, then `curl -I https://www.costfinders.ai/` should carry no x-robots-tag.
 */
function isCanonicalDeployment(): boolean {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return false
  }
  const deployedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (deployedHost) {
    return bareHost(deployedHost) === bareHost(CANONICAL_URL)
  }
  return process.env.NODE_ENV === 'production'
}

/** Supabase origin, for the CSP. Derived so a project swap does not silently break the policy. */
const SUPABASE_ORIGIN = (
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  'https://kdlpkjzcnbkjcvwsvlwn.supabase.co'
).replace(/\/$/, '')

/**
 * Content-Security-Policy, shipped REPORT-ONLY.
 *
 * Report-Only on purpose, and it must stay that way until a nonce pass lands. Next.js
 * inlines its own bootstrap and flight-data scripts on every response, so the only
 * enforcing policy that would not white-screen the site is `script-src 'self'
 * 'unsafe-inline'` — and 'unsafe-inline' makes script-src worthless as an XSS control,
 * which is the whole reason for having one. Enforcing it properly means generating a
 * per-request nonce in src/proxy.ts, threading it through a `Content-Security-Policy`
 * response header set there (middleware, not this file — headers() is static and cannot
 * see the request), and letting Next stamp that nonce onto its own script tags. That is a
 * separate change with its own verification pass. Until then this header collects real
 * violations without being able to break anything.
 *
 * Every source below is something the app was verified to actually load:
 *  - script-src/connect-src 'self': @vercel/analytics and @vercel/speed-insights are
 *    same-origin in production — /_vercel/insights/script.js, /_vercel/insights/event and
 *    /_vercel/speed-insights/script.js. va.vercel-scripts.com is only used by their debug
 *    builds under `next dev`, which is why this whole block is production-only.
 *  - style-src 'unsafe-inline': 51 React `style={{…}}` props across src/components.
 *  - font-src 'self' only: next/font/google self-hosts Sora and Manrope into
 *    /_next/static/media at build time, so fonts.googleapis.com/fonts.gstatic.com are
 *    never contacted from the browser. Checked in src/app/layout.tsx before omitting them.
 *  - img-src: Supabase Storage (uploaded deal images render `unoptimized`, bypassing
 *    /_next/image) and data: for the FileReader preview in dealManagement/dealForm.tsx.
 *    No Cloudinary: nothing renders a res.cloudinary.com URL (dealImageUrl returns '').
 *  - connect-src wss:: Supabase Realtime — .channel() in messaging/messageThread.tsx and
 *    lib/hooks/useNotifications.ts.
 *  - api.resend.com, places.googleapis.com and ALERT_WEBHOOK_URL are server-side fetches.
 *    CSP governs the browser only, so they are deliberately absent.
 *
 * Known violation to expect in the reports and decide on before enforcing: the Logo URL /
 * Cover Image URL previews in businessProfileForm.tsx render an owner-typed absolute URL on
 * any host, which img-src refuses. It is an owner-only dashboard preview with an onError
 * handler, so the honest options are to host those images instead of hotlinking them, or to
 * widen img-src to `https:` — not to widen it speculatively now.
 *
 * `upgrade-insecure-requests` is omitted: the spec has browsers ignore it on a Report-Only
 * header. Add it when this flips to enforcing.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: ${SUPABASE_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace(/^https:/, 'wss:')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/**
 * v1 treatment slug → the v2 browse bucket that actually serves that content.
 *
 * v1 indexed six treatment slugs; v2's /treatments/[category] serves the DB buckets in
 * src/lib/data/categories.ts (CATEGORY_MAP), which are neurotoxins, fillers, facials-lasers
 * and other. This map is that file's judgement, not a guess: Neurotoxin → neurotoxins,
 * Facial/Laser/Skincare → facials-lasers, Body → other. `fillers` is the one slug both
 * versions share, so it gets no bare-path redirect — that would be a loop.
 */
const V1_TREATMENT_TO_V2_CATEGORY: Record<string, string> = {
  botox: 'neurotoxins',
  fillers: 'fillers',
  facials: 'facials-lasers',
  laser: 'facials-lasers',
  skincare: 'facials-lasers',
  body: 'other',
}

/**
 * v1 city and neighbourhood pages → the live v2 page for the same place (owner decision,
 * 2026-09-30). Austin has a v2 city page, so its neighbourhoods go there. Dallas, Houston and
 * Miami have none, so they go to their state hub, as Los Angeles goes to /california below.
 * Explicit paths, not a `:neighborhood` param: /texas/austin is live, and a param would also
 * take its /texas/austin/opengraph-image.
 *
 * ponytail: static rules. If the pipeline lands Dallas, Houston or Miami inventory, that city's
 * page goes live under a 308 that browsers cache hard: delete its rules then.
 * tests/unit/redirectMap.test.ts catches it once its fixture is refreshed.
 */
const V1_CITY_PAGES: Record<string, string[]> = {
  '/texas/austin': [
    '/texas/austin/downtown-austin',
    '/texas/austin/north-austin',
    '/texas/austin/south-austin',
  ],
  '/texas': [
    '/texas/dallas',
    '/texas/dallas/downtown-dallas',
    '/texas/dallas/uptown-dallas',
    '/texas/houston',
    '/texas/houston/galleria-area',
    '/texas/houston/the-heights',
  ],
  '/florida': [
    '/florida/miami',
    '/florida/miami/brickell',
    '/florida/miami/coral-gables',
    '/florida/miami/south-beach',
  ],
}

/**
 * v1 → v2 redirect map for the domain cutover.
 *
 * costfinders.ai serves v1 today. Measured 2026-09-30 against v1's live sitemap (118 URLs):
 * 16 are already live v2 pages, and these rules carry 46 more into their nearest
 * genuinely-equivalent v2 page.
 *
 * The remaining 56 are deliberately NOT redirected: v1's fake demo providers, its
 * `/deals/deal-N` placeholders, `/deals/{city}` and `/deals/{treatment}/{city}` for cities
 * v2 has no deals in, and the New York neighbourhoods. Pointing them at the homepage or at
 * `/deals` is the soft-404 pattern Google discounts rather than credits, so a 404 is the
 * honest answer.
 *
 * `permanent: true` emits 308, which Google treats identically to 301 for GET.
 */
function v1CutoverRedirects() {
  const treatmentRedirects = Object.entries(
    V1_TREATMENT_TO_V2_CATEGORY,
  ).flatMap(([v1Slug, v2Slug]) => {
    const destination = `/treatments/${v2Slug}`
    return [
      // /treatments/{treatment}/{state} — a route shape v2 does not have at all. The state
      // was a filter on the treatment, so the treatment bucket is the parent that still
      // holds the content.
      // The param is constrained so the segment's metadata routes are not swallowed as a
      // "state": without it /treatments/fillers/opengraph-image 308'd to the HTML page and
      // the Fillers social card never rendered.
      {
        source: `/treatments/${v1Slug}/:state((?!opengraph-image|twitter-image).*)`,
        destination,
        permanent: true,
      },
      // The bare v1 treatment page, where the slug was renamed.
      ...(v1Slug === v2Slug
        ? []
        : [{ source: `/treatments/${v1Slug}`, destination, permanent: true }]),
    ]
  })

  return [
    ...treatmentRedirects,
    // v1's only California city was Los Angeles, which v2 does not serve. /california is
    // the live parent that lists the California cities v2 does serve — a real page about
    // the same place, not a homepage dump.
    {
      source: '/california/los-angeles',
      destination: '/california',
      permanent: true,
    },
    {
      source: '/california/los-angeles/:neighborhood',
      destination: '/california',
      permanent: true,
    },
    ...Object.entries(V1_CITY_PAGES).flatMap(([destination, sources]) =>
      sources.map((source) => ({ source, destination, permanent: true })),
    ),
  ]
}

const nextConfig: NextConfig = {
  // The pre-push gate (scripts/gate.sh) builds into `.next-gate` so it can run beside a
  // `next dev` that owns `.next`: two processes writing one distDir leave the dev server serving
  // chunks that 500. Unset everywhere else, Vercel included.
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  // /api/cron/gates reads the declared schema and the migration list from disk at run time
  // (src/lib/gates/schemaDrift.ts). Turbopack's tracer finds both today (checked in the route's
  // .nft.json); this keeps them in the function if a refactor of those reads ever hides them.
  outputFileTracingIncludes: {
    '/api/cron/gates': [
      './src/types/supabase.generated.ts',
      './supabase/migrations/*.sql',
    ],
  },
  // Since 16.3, `next dev` under an AI agent (CLAUDECODE, CURSOR_AGENT, …) appends a managed
  // "<!-- BEGIN:nextjs-agent-rules -->" block to CLAUDE.md. That file is hand-curated here.
  agentRules: false,
  // `X-Powered-By: Next.js` tells a scanner which advisories to try first, and nothing reads it.
  poweredByHeader: false,
  images: {
    // No remotePatterns on purpose: every optimized image is a local /images asset, so the
    // optimizer rejects remote URLs outright. The old `*.cloudinary.com` wildcard admitted
    // any Cloudinary account's files and served nothing. When deal images ship from the
    // Supabase `deal-images` bucket, pin that public path here and drop `unoptimized`.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', '@supabase/supabase-js'],
  },
  async redirects() {
    return v1CutoverRedirects()
  },
  async headers() {
    return [
      // Authenticated surfaces must never be cached on a shared CDN. These rules come
      // FIRST: the public rule below matched every non-API route, so /dashboard and
      // /admin/dashboard were served with `public, s-maxage=3600`, which lets Vercel's
      // edge hand one signed-in user's rendered dashboard to a different user for up
      // to an hour.
      {
        source: '/dashboard/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, must-revalidate' },
        ],
      },
      {
        source: '/business/dashboard/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, must-revalidate' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, must-revalidate' },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, must-revalidate' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      // Public, non-personalised pages only. robots.txt and sitemap.xml are excluded: at
      // s-maxage=3600 + stale-while-revalidate=86400 the edge can keep serving a stale
      // robots.txt for up to 25 hours after a deploy, so a crawl right after the domain
      // cutover would still read the pre-cutover rules.
      {
        source:
          '/((?!api|_next|dashboard|admin|auth|business/dashboard|robots.txt|sitemap.xml).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      // Belt and braces on a non-canonical host. robots.txt stops new crawling; it does not
      // remove URLs Google has already fetched. X-Robots-Tag does, and unlike robots.txt it
      // is honoured on a page the crawler reaches from an external link.
      ...(isCanonicalDeployment()
        ? []
        : [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
              ],
            },
          ]),
      // Security headers. Appended last on purpose: they set no Cache-Control, so the
      // load-bearing private-before-public ordering above is untouched, and a reader
      // checking that invariant does not have to scroll past this block to find it.
      //
      // Skipped under `next dev`, where the HMR runtime needs dynamic code evaluation and
      // the Vercel analytics packages load their debug scripts from va.vercel-scripts.com.
      // Neither is true of a production build, and reporting violations nobody will act on
      // is how a Report-Only header gets ignored.
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*',
              headers: [
                {
                  key: 'Content-Security-Policy-Report-Only',
                  value: CONTENT_SECURITY_POLICY,
                },
                // The app has no camera, microphone or geolocation code path — a grep for
                // getUserMedia/navigator.geolocation returns nothing — so denying all
                // three costs nothing and removes them from the surface an injected
                // script could reach.
                {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=()',
                },
              ],
            },
          ]
        : []),
    ]
  },
}

export default nextConfig
