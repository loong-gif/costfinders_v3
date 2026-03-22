# CostFinders v2 — CDN & Edge Performance Optimization Plan

**Date**: 2026-03-21
**Scope**: Vercel Edge Network configuration, image optimization pipeline, static asset caching, compression, geographic distribution, resource loading strategy, OpenGraph image caching
**Depends on**: `07-frontend.md` (image pre-optimization, font strategy, resource hints), `05-backend.md` (provider architecture changes)

---

## Table of Contents

1. [Current CDN Architecture Assessment](#1-current-cdn-architecture-assessment)
2. [Vercel Edge Network Configuration](#2-vercel-edge-network-configuration)
3. [Cache-Control Headers Strategy](#3-cache-control-headers-strategy)
4. [Image Optimization Pipeline](#4-image-optimization-pipeline)
5. [Static Asset Caching](#5-static-asset-caching)
6. [Compression Configuration](#6-compression-configuration)
7. [HTTP/2 & HTTP/3](#7-http2--http3)
8. [Geographic Optimization](#8-geographic-optimization)
9. [Resource Loading Strategy](#9-resource-loading-strategy)
10. [OpenGraph Image Caching](#10-opengraph-image-caching)
11. [Security Headers](#11-security-headers)
12. [Implementation Plan](#12-implementation-plan)

---

## 1. Current CDN Architecture Assessment

### Infrastructure Topology

```
User (browser)
  │
  ├─ Vercel Edge Network (CDN)
  │    ├─ Static HTML (ISR pages: /, /deals/*, /treatments/*, /guides/*)
  │    ├─ Static assets (_next/static/*, public/*)
  │    ├─ Image optimization (/_next/image?url=...)
  │    └─ Edge functions (opengraph-image.tsx × 4)
  │
  ├─ Vercel Serverless Functions (iad1 region, default)
  │    ├─ ISR regeneration
  │    ├─ Server Actions (revalidatePath calls)
  │    └─ generateStaticParams builds
  │
  ├─ Supabase (kdlpkjzcnbkjcvwsvlwn.supabase.co)
  │    ├─ PostgreSQL (server-side queries via supabase-js)
  │    └─ Auth (client-side via onAuthStateChange)
  │
  └─ Google Fonts CDN (fonts.gstatic.com)
       └─ Sora (variable or 4 weights), Manrope (4 weights)
```

### Current Configuration Gaps

| Area | Current State | Gap |
|---|---|---|
| Cache headers | None configured in `next.config.ts` | No custom `Cache-Control` for static assets or API responses |
| `vercel.json` | Does not exist | No edge config, no region pinning, no custom headers |
| Image pipeline | `remotePatterns: [*.cloudinary.com]`, formats: avif/webp | Cloudinary configured but `imageUrl` adapter returns `undefined` — no remote images in use yet |
| Preconnect hints | None in `<head>` | No `preconnect` to Supabase, no `dns-prefetch` for external domains |
| Middleware | None | No request-level caching or geo-routing logic |
| Function regions | Default (iad1 — US East) | No region pinning; may not be co-located with Supabase |
| Compression | Next.js default (gzip) | Brotli not explicitly enabled; Vercel handles this at the edge automatically |

### Page Rendering Strategies

| Route Pattern | Strategy | Revalidation | Data Source |
|---|---|---|---|
| `/` | ISR | 3600s (1 hour) | Supabase (`getFeaturedOffers`, `getOfferCategories`, `getCityDealCounts`) |
| `/deals/[[...slugs]]` | ISR | 3600s | Supabase (multiple query functions) |
| `/treatments` | ISR | 86400s (24 hours) | Supabase (`getOfferCategories`) |
| `/treatments/[category]` | ISR | 3600s | Supabase (category deals) |
| `/guides/[slug]` | ISR + SSG | 86400s, `generateStaticParams` | Supabase + mock data |
| `/[state]` | SSG | `generateStaticParams` | Mock data + Supabase |
| `/[state]/[city]` | SSG | `generateStaticParams` | Mock data + Supabase |
| `/[state]/[city]/[neighborhood]` | SSG | `generateStaticParams` | Mock data |
| `/[state]/[city]/provider/[slug]` | SSG | `generateStaticParams` | Mock data |

---

## 2. Vercel Edge Network Configuration

### 2.1 Vercel's Built-in Edge Behavior

Vercel automatically provides:
- **Global CDN** with 100+ edge locations
- **Automatic Brotli/gzip compression** for text-based assets
- **HTTP/2** on all connections; **HTTP/3 (QUIC)** where client supports it
- **TLS 1.3** with OCSP stapling
- **Immutable caching** for `_next/static/*` assets (content-hashed filenames)
- **ISR page caching** at the edge with stale-while-revalidate semantics
- **Image optimization** via `/_next/image` endpoint

### 2.2 What Vercel Does NOT Automatically Optimize

| Area | Needs Manual Config |
|---|---|
| Custom `Cache-Control` headers for `public/*` assets | Yes — `next.config.ts` `headers()` |
| Preconnect/dns-prefetch hints | Yes — `layout.tsx` `<head>` |
| Function region pinning | Yes — `vercel.json` or project settings |
| Security headers (CSP, HSTS, etc.) | Yes — `next.config.ts` `headers()` |
| ISR `stale-while-revalidate` window tuning | Partially — controlled by `revalidate` export |
| Image optimization quality and device sizes | Yes — `next.config.ts` `images` config |

---

## 3. Cache-Control Headers Strategy

### 3.1 Vercel's Automatic Cache Headers

Vercel sets these headers automatically:

| Asset Type | Header | TTL |
|---|---|---|
| `_next/static/*` (JS, CSS chunks) | `Cache-Control: public, max-age=31536000, immutable` | 1 year |
| ISR pages | `Cache-Control: s-maxage=<revalidate>, stale-while-revalidate` | Per `revalidate` export |
| SSG pages (no revalidate) | `Cache-Control: s-maxage=31536000, stale-while-revalidate` | 1 year |
| Image optimization (`/_next/image`) | `Cache-Control: public, max-age=<minimumCacheTTL>` | `minimumCacheTTL` from config |

### 3.2 Custom Headers for Public Assets

The `public/` directory serves assets at their exact paths (e.g., `/icon.png`, `/images/homepage/hero-bg.png`). These do NOT get content-hashed filenames, so Vercel serves them with short default TTLs.

**Recommended `next.config.ts` headers configuration:**

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.cloudinary.com' }],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year — images are static assets
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', '@supabase/supabase-js'],
  },

  async headers() {
    return [
      // ── Static images in public/images/ ──
      // These are deployment-scoped: a new deployment = new URL paths.
      // Safe to cache aggressively with stale-while-revalidate fallback.
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, stale-while-revalidate=86400',
          },
        ],
      },

      // ── Public root assets (icon.png, logo.png, SVGs) ──
      {
        source: '/:file(icon\\.png|logo\\.png|.*\\.svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },

      // ── Font files (served from _next/static by next/font) ──
      // Already immutable via content hashing, but explicit header ensures
      // CDN intermediaries respect the long TTL.
      {
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // ── ISR pages: tune stale-while-revalidate window ──
      // Vercel handles this via the `revalidate` export, but we add
      // CDN-Tag for targeted purge capability if needed.
      {
        source: '/deals/:path*',
        headers: [
          {
            key: 'CDN-Cache-Control',
            // Let Vercel's ISR handle s-maxage, but set browser cache
            // to 0 so the browser always checks the CDN for fresh content.
            value: 'public, s-maxage=3600, stale-while-revalidate=600',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },

      // ── Treatments listing (24h revalidation) ──
      {
        source: '/treatments',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=3600',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },

      // ── SSG pages (state/city/provider) ──
      // These are fully static with generateStaticParams.
      // Very aggressive caching is appropriate.
      {
        source: '/:state/:city',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
          },
        ],
      },
      {
        source: '/:state/:city/provider/:slug',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
          },
        ],
      },
    ]
  },
}
```

### 3.3 Cache-Control Design Rationale

| Strategy | `Cache-Control` | `CDN-Cache-Control` | Reasoning |
|---|---|---|---|
| **Immutable static assets** | `max-age=31536000, immutable` | — | Content-hashed filenames; filename changes on content change |
| **Public images** | `max-age=31536000, s-w-r=86400` | — | Deployment-scoped; safe for long TTL |
| **ISR pages** | `max-age=0, must-revalidate` | `s-maxage=3600, s-w-r=600` | Browser always checks CDN; CDN serves stale during regen |
| **SSG pages** | `max-age=3600, s-maxage=86400` | — | Content rarely changes; browser caches 1h, CDN caches 24h |

**Key distinction**: `Cache-Control` affects both browsers and CDN. `CDN-Cache-Control` (Vercel-specific) overrides `Cache-Control` at the CDN layer only, letting you set different TTLs for browsers vs. edge nodes.

### 3.4 ISR Stale-While-Revalidate Behavior

Current revalidation periods and their edge caching implications:

| Route | `revalidate` Export | Edge Behavior |
|---|---|---|
| `/` (homepage) | 3600 (1h) | CDN serves cached HTML for 1h; on first request after expiry, serves stale and triggers background regeneration. Next request gets fresh HTML. |
| `/deals/*` | 3600 (1h) | Same as homepage. Deal data updates (new deals, price changes) propagate within 1h + regen time (~2-5s). |
| `/treatments` | 86400 (24h) | Categories rarely change. 24h cache is appropriate. |
| `/treatments/[category]` | 3600 (1h) | Individual category deal counts change as deals are added. 1h is appropriate. |
| `/guides/[slug]` | 86400 (24h) | Guide content is static. 24h revalidation provides safety net for content updates. |

**Assessment**: The current revalidation periods are well-chosen. No changes recommended.

### 3.5 On-Demand Revalidation for Deal Changes

When a business updates a deal via Server Actions (`deal-management.ts`), the current `revalidatePath('/business/dashboard/deals')` only revalidates the business dashboard. The public-facing deal pages (`/deals/*`) continue serving stale content until the 1h ISR timer expires.

**Recommendation**: Add on-demand revalidation for public routes when deals change:

```ts
// In src/lib/actions/deal-management.ts — after successful create/update/delete
revalidatePath('/business/dashboard/deals')
revalidatePath('/deals')              // Add: revalidate deals listing
revalidatePath('/treatments')         // Add: revalidate category counts
revalidatePath('/')                   // Add: revalidate homepage trending
```

This triggers immediate ISR regeneration at the edge, reducing stale content from up to 1 hour to seconds.

---

## 4. Image Optimization Pipeline

### 4.1 Current State

- **`next.config.ts` images config**: `formats: ['image/avif', 'image/webp']`, `minimumCacheTTL: 31536000`
- **Remote patterns**: `*.cloudinary.com` configured but **not yet in use** — the data adapter sets `imageUrl: undefined` for all deals
- **Local images**: 8.3MB of unoptimized PNGs in `public/images/` (detailed in `07-frontend.md` Section 5)
- **`BlurredImage` component**: Uses `blur-xl scale-110` CSS filter on `next/image` — creates GPU-composited layers
- **No `deviceSizes`/`imageSizes` customization**: Using Next.js defaults (includes 1920, 2048, 3840 — unnecessary for max-w-7xl layout)

### 4.2 Next/Image Configuration Optimization

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: '*.cloudinary.com' }],
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 31536000,
  // Remove oversized device widths. max-w-7xl = 1280px.
  // Largest image is full-bleed hero at 100vw, but viewport > 1200px
  // is desktop with sidebar/margins — 1200px source is sufficient.
  deviceSizes: [640, 750, 828, 1080, 1200],
  // Add 128 for medium thumbnails (deal card images, provider avatars)
  imageSizes: [16, 32, 48, 64, 96, 128, 256],
  // Quality setting — 75 is a good balance for the warm sand aesthetic.
  // AVIF at q75 is visually equivalent to WebP at q85.
  // Default is 75, making this explicit for documentation.
  // quality: 75,  // (this is the default, no need to set)
},
```

**Impact of `deviceSizes` reduction**: Eliminates generation of 1920px, 2048px, and 3840px variants. For a full-bleed hero image, this prevents the image optimization endpoint from generating a 3840px AVIF — saving processing time and storage on the CDN edge cache.

### 4.3 Cloudinary Integration (Future-Ready)

When Cloudinary image URLs are enabled (replacing the current `imageUrl: undefined`), the pipeline will work as follows:

```
Cloudinary CDN (origin) → Vercel Image Optimization → Browser
                             ↓
                     Converts to AVIF/WebP
                     Resizes to requested width
                     Caches for 1 year (minimumCacheTTL)
```

**Best practices for Cloudinary source URLs**:

```
// BAD: Raw upload URL — Vercel must optimize a huge source file
https://res.cloudinary.com/costfinders/image/upload/deal-photo.jpg

// GOOD: Pre-transform at Cloudinary before Vercel optimizes
// Request a reasonable quality/size from Cloudinary, let Vercel
// handle format negotiation (AVIF/WebP) and responsive sizing.
https://res.cloudinary.com/costfinders/image/upload/q_auto,f_auto,w_800/deal-photo.jpg
```

However, since Vercel's image optimizer also does format negotiation, there is a trade-off:

| Approach | Pros | Cons |
|---|---|---|
| **Cloudinary transforms + Vercel `next/image`** | Double optimization, smallest possible output | Double processing cost, potential quality loss from re-encoding |
| **Cloudinary raw + Vercel `next/image`** | Single optimization, cleaner pipeline | Larger source file for Vercel to process |
| **Cloudinary transforms only (bypass `next/image`)** | Single optimization, Cloudinary CDN caching | Lose Next.js `sizes`/`srcSet` automatic generation, manual responsive images |

**Recommended approach**: Use Cloudinary for storage and basic transforms (crop, quality baseline), let Vercel `next/image` handle format negotiation and responsive sizing. Specifically:

```ts
// In the data adapter, when imageUrl is populated:
// Store Cloudinary URLs with minimal transforms:
imageUrl: `https://res.cloudinary.com/costfinders/image/upload/q_80,w_1200/${publicId}`
// Then use <Image> component normally — Vercel optimizes further to AVIF/WebP
// at the device-appropriate size via srcSet.
```

### 4.4 BlurredImage Optimization for CDN

The `BlurredImage` component requests full-resolution images even though they are blurred with `blur-xl scale-110`. This wastes CDN bandwidth and image optimization processing.

**CDN-optimized approach** (detailed in `07-frontend.md` Section 5.4):

```tsx
// In blurredImage.tsx — request tiny image since output is blurred
<Image
  src={src}
  alt={alt}
  fill={fill}
  sizes="48px"        // Request smallest available variant
  quality={10}        // Very low quality — blurred anyway
  priority={priority}
  loading={priority ? 'eager' : 'lazy'}
  className="object-cover blur-xl scale-110"
/>
```

**CDN impact**: On a deals listing page with 30 cards, this changes the image requests from thirty 400-800px AVIF files (~30 × 20KB = 600KB) to thirty 48px AVIF files (~30 × 1KB = 30KB). **570KB bandwidth saved per page view**.

### 4.5 Image Format Negotiation Flow

```
Browser sends: Accept: image/avif, image/webp, image/*
        │
        ▼
Vercel Edge checks Accept header
        │
        ├─ AVIF supported (Chrome 85+, Firefox 93+, Safari 16.4+)
        │   → Serve AVIF (smallest file, ~50% smaller than WebP)
        │
        ├─ WebP supported (all modern browsers)
        │   → Serve WebP (~30% smaller than JPEG)
        │
        └─ Neither supported
            → Serve original format (PNG/JPEG)
```

The `formats: ['image/avif', 'image/webp']` config is correct — AVIF first (preferred when supported), WebP as fallback. No changes needed.

---

## 5. Static Asset Caching

### 5.1 Font Caching

**Current behavior**: `next/font/google` downloads Sora and Manrope font files at build time and serves them from `/_next/static/media/`. These files have content-hashed filenames and are automatically served with `Cache-Control: public, max-age=31536000, immutable`.

**Assessment**: Font caching is optimal. No changes needed.

**Font loading optimization** (from `07-frontend.md` Section 6): Switching Sora to a variable font reduces the number of font files from 4 to 1, meaning 3 fewer HTTP requests and 30-65KB less data. This directly reduces CDN bandwidth and eliminates 3 round trips.

### 5.2 JavaScript/CSS Chunk Caching

**Current behavior**: Next.js generates content-hashed chunks in `/_next/static/chunks/`. Vercel serves these with immutable headers.

**Assessment**: Optimal. Content-hashed filenames ensure cache busting on code changes. No action needed.

### 5.3 Public Directory Asset Caching

| Asset | Current Size | Recommended Cache | Notes |
|---|---|---|---|
| `icon.png` | 384KB | `max-age=2592000` (30d) | Should be replaced with 72x72 WebP (see `07-frontend.md`) |
| `logo.png` | 194KB | `max-age=2592000` (30d) | Used in header/footer |
| `images/homepage/*.png` | 5.9MB total | `max-age=31536000` (1y) | Deployment-scoped; safe for long TTL |
| `images/deals-hero.png` | 1.0MB | `max-age=31536000` (1y) | Same rationale |
| `images/treatments-hero.png` | 795KB | `max-age=31536000` (1y) | Same rationale |
| `images/business-owner.png` | 662KB | `max-age=31536000` (1y) | Same rationale |
| SVGs (file.svg, globe.svg, etc.) | <2KB each | `max-age=2592000` (30d) | Likely unused Next.js starter assets |

The `headers()` configuration in Section 3.2 covers all of these.

### 5.4 Unused Starter Assets

The following files in `public/` appear to be Next.js starter template leftovers:

- `file.svg` (391 bytes)
- `globe.svg` (1KB)
- `next.svg` (1.4KB)
- `vercel.svg` (385 bytes)
- `window.svg` (128 bytes)

**Recommendation**: Verify these are unused and remove them to reduce deployment size and avoid serving unnecessary assets.

---

## 6. Compression Configuration

### 6.1 Vercel's Automatic Compression

Vercel automatically applies compression at the edge:

| Format | Applied When | Typical Savings |
|---|---|---|
| **Brotli** (br) | Browser sends `Accept-Encoding: br` (all modern browsers) | 15-25% better than gzip |
| **Gzip** | Fallback for older clients | Baseline compression |

This applies to:
- HTML responses (ISR/SSG pages)
- JavaScript chunks
- CSS files
- JSON responses (API routes, JSON-LD)
- Font files (woff2 is already compressed, minimal additional gain)

### 6.2 Next.js `compress` Option

```ts
// next.config.ts
compress: true  // This is the default
```

**Important nuance**: The `compress` option in `next.config.ts` controls gzip compression in `next start` (self-hosted). On Vercel, compression is handled at the edge network layer regardless of this setting. The setting is irrelevant for Vercel deployments but does not hurt.

### 6.3 Compression Verification

After deployment, verify compression with:

```bash
# Check Brotli
curl -I -H "Accept-Encoding: br" https://www.costfinders.ai/ 2>/dev/null | grep -i content-encoding
# Expected: content-encoding: br

# Check gzip fallback
curl -I -H "Accept-Encoding: gzip" https://www.costfinders.ai/ 2>/dev/null | grep -i content-encoding
# Expected: content-encoding: gzip
```

### 6.4 Pre-Compression Opportunity

For the large JSON-LD structured data scripts embedded in deal pages (built via `buildDealsListSchema`), the compression happens at the edge on every request. Since these are part of the ISR-cached HTML, Vercel caches the compressed version — no per-request compression overhead.

**Assessment**: No action needed. Vercel handles this correctly.

---

## 7. HTTP/2 & HTTP/3

### 7.1 Current State

Vercel automatically serves all traffic over HTTP/2 with HTTP/3 (QUIC) negotiation via `Alt-Svc` headers.

**Benefits already in effect**:
- **Multiplexing**: Multiple JS chunks, CSS, images, and fonts load over a single TCP connection (HTTP/2) or UDP connection (HTTP/3)
- **Header compression** (HPACK/QPACK): Reduces overhead of repeated headers across requests
- **Server push**: Not used (deprecated in most browsers; Vercel does not implement it)
- **0-RTT resumption** (HTTP/3): Returning visitors skip TLS handshake for ~100ms savings

### 7.2 Optimizing for HTTP/2 Multiplexing

**Anti-pattern to avoid**: Domain sharding. Serving assets from multiple subdomains (e.g., `static.costfinders.ai`, `img.costfinders.ai`) defeats HTTP/2 multiplexing by forcing separate connections.

**Current state**: All assets serve from `costfinders.ai` and `_next/static/*` paths on the same domain. This is correct for HTTP/2.

**External domains requiring separate connections**:
- `res.cloudinary.com` (when Cloudinary images are enabled)
- `kdlpkjzcnbkjcvwsvlwn.supabase.co` (auth API calls)
- `fonts.gstatic.com` (handled by `next/font` at build time — no runtime connection)

The `preconnect` hints in Section 9 mitigate the cold-connection cost for these external domains.

### 7.3 Priority Hints

The `priority` attribute on `<Image>` components maps to HTTP/2 fetch priority. Currently used correctly:
- Hero images: `priority` (high fetch priority, triggers preload)
- Below-fold images: Default lazy loading (low priority)

**Recommendation**: Add `fetchPriority="high"` to the LCP element explicitly. Next.js `priority` prop already does this, but being explicit in documentation ensures intent is preserved:

```tsx
<Image
  src="/images/homepage/hero-bg.webp"
  alt=""
  fill
  priority                    // Sets fetchPriority="high" + loading="eager" + preload link
  sizes="100vw"
  className="object-cover"
/>
```

---

## 8. Geographic Optimization

### 8.1 Current Function Region

Vercel serverless functions default to `iad1` (US East — Washington, D.C.). This is the origin region for:
- ISR page regeneration
- Server Actions
- `generateStaticParams` execution during builds

### 8.2 Supabase Region Assessment

The Supabase project ID is `kdlpkjzcnbkjcvwsvlwn`. Supabase projects are typically created in specific AWS regions. The latency between the Vercel function region and Supabase is critical for ISR regeneration speed.

**Recommendation**: Verify the Supabase project region and pin the Vercel function region to match:

```jsonc
// vercel.json (if Supabase is in us-east-1)
{
  "regions": ["iad1"]
}
```

If Supabase is in `us-west-1` or another region:

```jsonc
// vercel.json
{
  "regions": ["sfo1"]  // Match Supabase region
}
```

**How to check Supabase region**: Dashboard > Project Settings > Infrastructure, or:

```bash
# The Supabase URL subdomain maps to a region
# kdlpkjzcnbkjcvwsvlwn.supabase.co
# Check via DNS or Supabase dashboard
```

### 8.3 Edge vs. Origin Trade-offs

| Operation | Should Run At | Rationale |
|---|---|---|
| **Serving cached ISR pages** | Edge (automatic) | Already cached HTML; no origin needed |
| **ISR regeneration** | Origin (co-located with Supabase) | Queries Supabase DB; latency matters |
| **Server Actions** (deal claims, saves) | Origin (co-located with Supabase) | Write operations to Supabase |
| **OpenGraph image generation** | Edge (already configured) | Pure computation, no DB needed |
| **Static asset serving** | Edge (automatic) | CDN serves from nearest POP |
| **Image optimization** | Edge (automatic) | Vercel optimizes at edge, caches result |

### 8.4 User Geography Assessment

CostFinders targets US cities (Tucson AZ, Irvine CA, Denver CO, based on the city-state mapping in `adapters.ts`). US-focused deployment means:

**Recommended Vercel region strategy**:
- **Primary region**: Pin to match Supabase (likely `iad1` US East or `sfo1` US West)
- **Edge functions**: Let Vercel run on nearest edge POP (automatic)
- **No multi-region serverless**: Unnecessary for US-only audience; adds complexity without measurable benefit

### 8.5 Edge Function Configuration for OG Images

All 4 OG image generators already declare `export const runtime = 'edge'`, which is correct. Edge runtime means:
- Generated at the nearest edge POP to the requesting crawler/user
- No database queries in any OG image function (they only use URL params)
- Cold start is ~5-50ms (vs. ~250-1000ms for serverless Node.js)

---

## 9. Resource Loading Strategy

### 9.1 Current Resource Hints

Next.js automatically generates:
- `<link rel="preload">` for Sora font files (because `preload: true`)
- `<link rel="preload">` for `priority` images (hero backgrounds)
- `<link rel="preconnect">` to Google Fonts (via `next/font`)

**Missing hints**:
- No `preconnect` to Cloudinary
- No `preconnect` to Supabase
- No `dns-prefetch` for any external domain

### 9.2 Recommended Resource Hints

Add to `src/app/layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Cloudinary — for deal/business images (future) */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />

        {/* Supabase — auth state checks happen on client load */}
        <link rel="preconnect" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" />

        {/* Vercel Analytics/Speed Insights beacons */}
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
      </head>
      <body className={`${sora.variable} ${manrope.variable} font-sans antialiased`}>
        {/* ... existing content ... */}
      </body>
    </html>
  )
}
```

**Impact analysis**:

| Hint | Time Saved | When It Helps |
|---|---|---|
| Cloudinary `preconnect` | ~100-200ms | First Cloudinary image request (DNS + TCP + TLS handshake eliminated) |
| Supabase `preconnect` | ~100-200ms | First auth state check after page load |
| Vercel scripts `dns-prefetch` | ~20-50ms | Analytics/Speed Insights beacon send |

### 9.3 Preconnect vs. dns-prefetch Decision

| Hint | What It Does | Cost | Use When |
|---|---|---|---|
| `preconnect` | DNS + TCP + TLS handshake upfront | ~5KB memory, holds connection open | Origin will definitely be used within seconds |
| `dns-prefetch` | DNS lookup only | Negligible | Origin might be used; low-cost speculative hint |

**Both hints together**: `preconnect` covers browsers that support it; `dns-prefetch` is the fallback for older browsers.

### 9.4 Supabase Preconnect Placement Optimization

Once the provider architecture is split (per `05-backend.md`), the Supabase `preconnect` should move from the root layout to the authenticated route group layout:

```tsx
// src/app/(auth)/layout.tsx — only load on authenticated routes
<head>
  <link rel="preconnect" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" crossOrigin="" />
</head>
```

For public routes (no auth), the connection is unnecessary overhead.

### 9.5 Prefetch Strategy for Navigation

Next.js App Router automatically prefetches `<Link>` targets when they enter the viewport (using the route's loading state for quick shell rendering). This is enabled by default.

**Verify no accidental prefetch disabling**:

```tsx
// CORRECT — default prefetch behavior
<Link href="/deals">Find deals</Link>

// AVOID — disabling prefetch on primary navigation targets
<Link href="/deals" prefetch={false}>Find deals</Link>
```

**Exception**: For pages with many links (e.g., the deals listing grid with 30 deal cards), prefetching all links would trigger 30 RSC payload fetches. Next.js handles this gracefully by only prefetching the shared layout, not the full page payload. No manual intervention needed.

---

## 10. OpenGraph Image Caching

### 10.1 Current OG Image Architecture

4 OG image generators using `next/og` (Satori):

| Route | File | Varies By | Runtime |
|---|---|---|---|
| `/` | `src/app/opengraph-image.tsx` | Nothing (static) | `edge` |
| `/[state]/[city]` | `src/app/[state]/[city]/opengraph-image.tsx` | `state`, `city` params | `edge` |
| `/treatments/[category]` | `src/app/treatments/[category]/opengraph-image.tsx` | `category` param | `edge` |
| `/guides/[slug]` | `src/app/guides/[slug]/opengraph-image.tsx` | `slug` param | `edge` |

### 10.2 OG Image Caching Behavior

OG images generated by `next/og` are treated as route handlers. Their caching depends on the route segment config:

- **Static OG images** (no dynamic params or `revalidate` export): Cached indefinitely at the edge
- **Dynamic OG images** (with params): Generated on first request, then cached based on the parent page's `revalidate` config

**Current gap**: None of the OG image files export their own `revalidate`. They inherit from the parent page segment:
- Root `/opengraph-image`: Static — cached indefinitely (correct)
- `/[state]/[city]/opengraph-image`: Inherits from `[city]/page.tsx` which uses `generateStaticParams` — pre-generated at build time (correct)
- `/treatments/[category]/opengraph-image`: Inherits `revalidate = 3600` from parent — regenerated hourly (unnecessary; the OG image only shows the category name)
- `/guides/[slug]/opengraph-image`: Inherits `revalidate = 86400` — regenerated daily (unnecessary; same reason)

### 10.3 OG Image Cache Optimization

The OG images for `/treatments/[category]` and `/guides/[slug]` only display static text derived from URL params. They never change unless the code changes. Adding an explicit long revalidation period avoids unnecessary regeneration:

```tsx
// src/app/treatments/[category]/opengraph-image.tsx
export const revalidate = false  // or: export const revalidate = 31536000

// src/app/guides/[slug]/opengraph-image.tsx
export const revalidate = false  // Static — only changes on redeployment
```

Alternatively, these OG images can export `generateStaticParams` to be pre-generated at build time:

```tsx
// src/app/treatments/[category]/opengraph-image.tsx
export { generateStaticParams } from './page'  // Re-export parent's static params
```

**Impact**: Eliminates unnecessary edge function invocations for OG image requests after the initial generation. Social media crawlers (Facebook, Twitter, LinkedIn) and messaging apps request these images frequently.

### 10.4 OG Image Size and Performance

Current configuration:
- `size: { width: 1200, height: 630 }` — standard OG image dimensions
- `contentType: 'image/png'` — PNG output

**Observation**: All 4 OG images use simple text and gradient backgrounds with no external images or custom fonts. Satori renders these in ~10-50ms on the edge. The PNG output is typically 30-60KB.

**No format change recommended**: OG images must be PNG or JPEG for social media platform compatibility. WebP/AVIF are not universally supported by social media crawlers.

---

## 11. Security Headers

While not strictly CDN performance, security headers affect caching behavior and should be configured alongside cache headers.

### 11.1 Recommended Security Headers

```ts
// Add to the headers() function in next.config.ts
{
  source: '/:path*',
  headers: [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(self)',
    },
  ],
},

// Strict Transport Security (HSTS)
// Vercel enables this automatically for custom domains.
// Adding it explicitly ensures coverage and enables preloading.
{
  source: '/:path*',
  headers: [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
  ],
},
```

### 11.2 Content Security Policy (CSP)

A CSP restricts which domains can serve scripts, styles, and images. For CostFinders:

```ts
{
  source: '/:path*',
  headers: [
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https://res.cloudinary.com https://*.supabase.co data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  ],
},
```

**Note**: `'unsafe-inline'` for scripts is required because Next.js injects inline scripts for hydration data. `'unsafe-eval'` may be needed depending on Next.js version. Test in staging before deploying to production.

---

## 12. Implementation Plan

### Phase 1: Headers & Resource Hints (1-2 hours, zero-risk)

| Change | File | Impact |
|---|---|---|
| Add `headers()` to `next.config.ts` with cache rules per Section 3.2 | `next.config.ts` | Public assets cached 1 year; ISR pages get proper browser/CDN split |
| Add `preconnect`/`dns-prefetch` hints to `layout.tsx` per Section 9.2 | `src/app/layout.tsx` | ~100-200ms saved on first Cloudinary/Supabase request |
| Add security headers per Section 11 | `next.config.ts` | Security posture improvement |
| Add `deviceSizes`/`imageSizes` to image config per Section 4.2 | `next.config.ts` | Eliminates generation of oversized image variants |

### Phase 2: Image Pipeline (1-2 hours, per `07-frontend.md`)

| Change | File | Impact |
|---|---|---|
| Pre-optimize PNGs to WebP | `public/images/` | 85% reduction in source image size (~8.3MB → ~1.2MB) |
| Replace `icon.png` with 72x72 WebP | `public/icon.png` | 97% reduction (384KB → ~8KB) |
| BlurredImage `sizes="48px"` + `quality={10}` | `blurredImage.tsx` | ~570KB bandwidth saved per 30-card listing page |

### Phase 3: Geographic & Edge Optimization (30 min)

| Change | File | Impact |
|---|---|---|
| Verify Supabase region and pin Vercel function region | `vercel.json` or Vercel dashboard | Eliminates cross-region latency for ISR regeneration |
| Add `revalidate = false` to OG image routes | 2 OG image files | Eliminates unnecessary edge function invocations |
| Add on-demand revalidation to deal Server Actions | `deal-management.ts` | Reduces stale content from 1h to seconds |

### Phase 4: Cloudinary Integration Prep (when images go live)

| Change | File | Impact |
|---|---|---|
| Define Cloudinary URL transform pattern | Data adapter | Optimal source for Vercel image optimization |
| Test AVIF/WebP format negotiation with Cloudinary sources | Staging | Verify no double-encoding quality loss |

### Expected Cumulative Impact

| Metric | Before | After Phase 1-3 |
|---|---|---|
| **Public asset cache hit rate** | Low (short default TTL) | Near 100% (1-year TTL with content addressing) |
| **ISR page stale window** | Up to 1h after deal changes | Seconds (on-demand revalidation) |
| **First Cloudinary image latency** | ~200-400ms (cold connection) | ~50-100ms (preconnected) |
| **OG image regeneration** | Every 1-24h per route | Only on redeployment |
| **Image optimization bandwidth** | ~600KB per 30-card page | ~30KB per 30-card page (BlurredImage fix) |
| **Unused image variants generated** | Includes 1920/2048/3840px | Max 1200px |

### Verification Checklist

After deploying changes, verify with:

```bash
# 1. Cache headers on public images
curl -I https://www.costfinders.ai/images/homepage/hero-bg.png 2>/dev/null | grep -i cache-control
# Expected: cache-control: public, max-age=31536000, stale-while-revalidate=86400

# 2. Compression
curl -I -H "Accept-Encoding: br" https://www.costfinders.ai/ 2>/dev/null | grep -i content-encoding
# Expected: content-encoding: br

# 3. Security headers
curl -I https://www.costfinders.ai/ 2>/dev/null | grep -iE "x-content-type|x-frame|strict-transport"
# Expected: All three present

# 4. Image format negotiation
curl -I -H "Accept: image/avif,image/webp,*/*" "https://www.costfinders.ai/_next/image?url=%2Fimages%2Fhomepage%2Fhero-bg.png&w=1080&q=75" 2>/dev/null | grep -i content-type
# Expected: content-type: image/avif

# 5. OG image caching
curl -I https://www.costfinders.ai/opengraph-image 2>/dev/null | grep -i cache-control
# Expected: Long s-maxage or immutable

# 6. Preconnect hints in HTML
curl -s https://www.costfinders.ai/ | grep -o 'rel="preconnect"[^>]*'
# Expected: preconnect to res.cloudinary.com and supabase.co
```

---

## Summary: Top 5 CDN Optimizations by Impact

1. **Cache headers for public assets** — Zero-cost configuration change that eliminates repeat downloads of 8.3MB of images on return visits
2. **Preconnect hints** — 100-200ms latency reduction on first external resource request per page load, for ~5 minutes of work
3. **BlurredImage CDN bandwidth optimization** — 570KB bandwidth savings per deal listing page view by requesting tiny source images
4. **On-demand ISR revalidation** — Reduces stale content window from 1 hour to seconds when deals change
5. **OG image static caching** — Eliminates unnecessary edge function invocations for images that only depend on URL params
