# CostFinders v2 -- Distributed System & Service Communication Optimization

**Date**: 2026-03-21
**Scope**: Supabase connection management, Vercel-Supabase latency, Cloudinary optimization, external API patterns, CDN/edge caching, network waterfall elimination, ISR interaction with external services
**Depends on**: `01-profiling.md` (bottleneck inventory), `04-database.md` (RPC functions), `05-backend.md` (provider architecture, caching strategy)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Supabase Connection Management](#2-supabase-connection-management)
3. [Supabase-Vercel Latency Optimization](#3-supabase-vercel-latency-optimization)
4. [Cloudinary Image CDN Optimization](#4-cloudinary-image-cdn-optimization)
5. [External API Call Patterns](#5-external-api-call-patterns)
6. [Edge and CDN Caching Strategy](#6-edge-and-cdn-caching-strategy)
7. [Network Waterfall Elimination](#7-network-waterfall-elimination)
8. [ISR Interaction with External Services](#8-isr-interaction-with-external-services)
9. [Implementation Plan](#9-implementation-plan)
10. [Expected Latency Improvements](#10-expected-latency-improvements)

---

## 1. Architecture Overview

### Current Service Topology

```
                                 ┌─────────────────────────┐
                                 │   Vercel Edge Network    │
                                 │   (CDN + Edge Runtime)   │
                                 └──────────┬──────────────┘
                                            │
                     ┌──────────────────────┼────────────────────────┐
                     │                      │                        │
              ┌──────▼──────┐      ┌────────▼────────┐     ┌────────▼───────┐
              │  ISR Pages  │      │ Server Actions   │     │ OG Image Gen   │
              │ (Serverless)│      │ (Serverless)     │     │ (Edge Runtime) │
              └──────┬──────┘      └────────┬────────┘     └────────────────┘
                     │                      │
          ┌──────────┼──────────┐    ┌──────┼──────────────────────┐
          │          │          │    │      │                      │
    ┌─────▼──┐ ┌────▼───┐     │  ┌─▼──────▼──┐  ┌──────────┐  ┌─▼──────────┐
    │Supabase│ │Supabase │     │  │Supabase   │  │ Resend   │  │ Google     │
    │  REST  │ │  RPC    │     │  │Auth+REST  │  │ Email API│  │ Places API │
    │(anon)  │ │(anon)   │     │  │(cookies)  │  │          │  │            │
    └────────┘ └────────┘     │  └───────────┘  └──────────┘  └────────────┘
                              │
                     ┌────────▼───────┐
                     │ Cloudinary CDN │ (configured but not yet active)
                     └────────────────┘
```

### Service Communication Inventory

| Service | Protocol | Auth Method | Usage Context | Current Client |
|---------|----------|-------------|---------------|----------------|
| Supabase REST | HTTPS (PostgREST) | Anon key | ISR data fetching (build + revalidate) | Module-level singleton (`src/lib/supabase.ts`) |
| Supabase REST | HTTPS (PostgREST) | Cookie-based session | Server actions (authenticated mutations) | Per-request client (`src/lib/supabase-server.ts`) |
| Supabase Auth | HTTPS | Anon key (browser) | Client-side session hydration | Per-component browser client (`src/lib/supabase-browser.ts`) |
| Supabase Auth | HTTPS | Cookie-based | Middleware session refresh | Per-request client (`src/proxy.ts`) |
| Google Places API | HTTPS | API key (server) | Business search (server action) | Direct `fetch()` |
| Resend Email API | HTTPS | API key (server) | Claim notifications (server action) | Direct `fetch()` |
| Cloudinary CDN | HTTPS | Public URL | Image delivery | Configured in `next.config.ts` but no URLs flowing |

### Key Findings Summary

1. **Three separate Supabase client creation patterns** with no connection reuse strategy
2. **Zero resource hints** (no preconnect, no dns-prefetch) for any external service
3. **No custom HTTP cache headers** in `next.config.ts` -- relies entirely on ISR defaults
4. **No timeout or retry logic** on any external API call (Google Places, Resend)
5. **No `vercel.json`** -- no custom headers, no region pinning, no rewrites
6. **Client-side auth calls on every page** -- 2 `getUser()` round-trips to Supabase Auth on every navigation
7. **Sequential query waterfalls** in data fetching layer (documented in `01-profiling.md`)
8. **Cloudinary integration configured but dormant** -- all `imageUrl` fields are `undefined`

---

## 2. Supabase Connection Management

### 2.1 Current State: Three Client Patterns

**Pattern A: Module-level singleton (data fetching)**

File: `src/lib/supabase.ts`
```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Used by: `offers.ts`, `businesses.ts` (all ISR data queries). This is a single global instance shared across all server requests. It uses the `@supabase/supabase-js` `createClient` (not the SSR variant), which means:
- No cookie integration (uses anon key only)
- A single GoTrue client instance manages connection pooling internally
- Suitable for read-only public data with no RLS differentiation

**Assessment**: Correct for the current use case. The Supabase JS client v2 internally uses `fetch()` for each request (no persistent connection pool), so the singleton pattern works without risk of connection leaks or cross-request state contamination. Each Supabase REST call is an independent HTTPS request.

**Pattern B: Per-request cookie client (server actions)**

File: `src/lib/supabase-server.ts`
```ts
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { ... } })
}
```

Used by: All 17 server action files, called 28 times across authenticated actions. Each call creates a new `SupabaseClient` instance with cookie integration for RLS-aware queries.

**Assessment**: Correct pattern for authenticated server actions. The per-request creation ensures cookie isolation between concurrent requests.

**Pattern C: Browser client (context providers)**

File: `src/lib/supabase-browser.ts`
```ts
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
```

Used by: `AuthProvider` (line 115), `BusinessAuthProvider` (line 100), `AdminAuthContext` (line 89). Each provider creates its own browser client via `useRef`.

**Problem**: `AuthProvider` and `BusinessAuthProvider` each create an independent `SupabaseBrowserClient`, and both call `supabase.auth.getUser()` on mount. This means:
- 2 separate GoTrue session checks to Supabase Auth servers on every page load
- 2 independent `onAuthStateChange` subscriptions (duplicate WebSocket connections or polling)
- `BusinessAuthProvider` additionally fires `hydrateUser()` on every `visibilitychange` event with no debounce

### 2.2 Optimization: Shared Browser Client Singleton

The `@supabase/ssr` `createBrowserClient` already deduplicates internally if called multiple times with the same URL/key -- it returns the same instance. However, the current code calls it in separate `useRef` initializations in each provider, which may bypass this deduplication depending on the module bundling.

**Solution**: Create an explicit singleton for the browser client.

```ts
// src/lib/supabase-browser.ts -- AFTER
import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClient
}

// Keep backward compat during migration
export const createSupabaseBrowserClient = getSupabaseBrowserClient
```

**Impact**: Guarantees a single GoTrue session, single WebSocket subscription, single `getUser()` network call shared across all providers. Eliminates 1 redundant Supabase Auth round-trip on every page load.

**Estimated savings**: 50-200ms per page load (one fewer HTTPS round-trip to Supabase Auth).

### 2.3 Optimization: Eliminate Duplicate Auth Hydration

Even with a shared client, `AuthProvider` and `BusinessAuthProvider` both independently call `supabase.auth.getUser()` and subscribe to `onAuthStateChange`. The fix (covered in `05-backend.md` Section 1.2) is to move providers into route-group-specific layouts so they never coexist on public pages. For authenticated routes where both exist:

**Solution**: Extract a shared auth hydration hook that caches the `getUser()` result.

```ts
// src/lib/hooks/useSupabaseUser.ts
import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

/** Singleton auth state shared across all consumers within a render tree. */
let cachedUser: User | null = null
let hydrationPromise: Promise<User | null> | null = null

export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [isLoading, setIsLoading] = useState(cachedUser === null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // Deduplicate the initial getUser() call
    if (!hydrationPromise) {
      hydrationPromise = supabase.auth.getUser().then(({ data }) => {
        cachedUser = data.user
        return data.user
      })
    }

    hydrationPromise.then((u) => {
      setUser(u)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'].includes(event)) {
          supabase.auth.getUser().then(({ data }) => {
            cachedUser = data.user
            hydrationPromise = null
            setUser(data.user)
          })
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, isLoading }
}
```

Then both `AuthProvider` and `BusinessAuthProvider` consume `useSupabaseUser()` instead of independently calling `getUser()`.

**Impact**: Even on authenticated routes where multiple providers exist, only 1 `getUser()` call executes. The result is shared via module-level state.

**Estimated savings**: 50-150ms on authenticated pages (eliminates duplicate `getUser()` call).

---

## 3. Supabase-Vercel Latency Optimization

### 3.1 Region Alignment Analysis

**Supabase project**: `kdlpkjzcnbkjcvwsvlwn.supabase.co`

Supabase project IDs do not encode region, but the project was identified as "costfinder" in `CLAUDE.md`. Without explicit region configuration, Supabase defaults to `us-east-1` (Virginia) for most US projects.

**Vercel deployment**: No `vercel.json` exists, no region pinning. Vercel serverless functions default to `iad1` (Washington, D.C.) for the primary region, which is geographically close to `us-east-1`.

**Assessment**: The default alignment is likely acceptable (both in US East), but this should be verified and explicitly pinned.

### 3.2 Optimization: Pin Vercel Function Region

Create a `vercel.json` to pin the serverless function region to match Supabase.

```json
{
  "regions": ["iad1"],
  "headers": []
}
```

Or, if the Supabase project is in a different region, use the matching Vercel region. The regions config ensures ISR regeneration and server actions execute in the same datacenter as the database, minimizing cross-region latency.

**Why this matters**: Without explicit region pinning, Vercel may deploy functions to the region closest to the Git push origin or the most available region. If a function runs in `sfo1` (San Francisco) while Supabase is in `us-east-1`, each query adds ~60-80ms of cross-country network latency.

**Estimated savings**: 0ms if already aligned, up to 60-80ms per Supabase query if misaligned.

### 3.3 Optimization: Connection Overhead Reduction

Each Supabase REST call via `@supabase/supabase-js` is an independent HTTPS request to `https://kdlpkjzcnbkjcvwsvlwn.supabase.co/rest/v1/...`. The overhead per call:

1. DNS resolution (~1-5ms, cached after first call within a function invocation)
2. TLS handshake (~10-30ms for new connection, 0ms with HTTP/2 connection reuse)
3. HTTP request/response (~5-20ms for same-region)

The Supabase JS client uses the global `fetch()`, which in Node.js (Vercel serverless) benefits from HTTP/2 connection multiplexing within a single function invocation. Sequential queries within the same invocation reuse the TLS connection.

**Current problem**: The two-query waterfall in `getOffersWithBusinesses()` (line 71-83 of `offers.ts`) forces sequential HTTPS requests that cannot be multiplexed:

```
Request 1: POST /rest/v1/master_business_info?select=business_id&city=ilike.Dallas
  --> 15-30ms (same-region)
  --> wait for response
Request 2: POST /rest/v1/promo_offer_master?select=*,...&business_id=in.(1,2,3,...)
  --> 15-30ms (same-region)
```

**Fix**: Replace with single RPC call (covered in `04-database.md`), or use a Supabase View/foreign key join. This eliminates one network round-trip per city-filtered query.

**Estimated savings**: 15-30ms per city-filtered query (same-region round-trip elimination).

### 3.4 Optimization: Query Batching with Promise.all

Several page renders issue independent Supabase queries that could execute in parallel. The current parallelization is inconsistent:

**Good (already parallelized)**:
- Homepage (`src/app/page.tsx:15-19`): `Promise.all([getFeaturedOffers, getOfferCategories, getCityDealCounts])`
- Guide page (`src/app/guides/[slug]/page.tsx:78-81`): `Promise.all([getGuidePricingStats, getGuideDealsPreview])`
- Deals city page (`src/app/deals/[[...slugs]]/page.tsx:220-224`): `Promise.all([getDealsForCitySlug, getUnifiedCities, getBusinessCountForCity])`

**Missing parallelization**:

1. **Deals metadata for city route** (`src/app/deals/[[...slugs]]/page.tsx:122-125`):
   ```ts
   // CURRENT: Sequential
   const dealCount = await getDealCountForCitySlug(route.citySlug)
   const businessCount = await getBusinessCountForCity(cityName)
   const minPrice = await getMinPriceForCitySlug(route.citySlug)
   ```

   These three calls are independent. With `cache()` on `getDealsForCitySlug`, `getDealCountForCitySlug` and `getMinPriceForCitySlug` share the same underlying query, but `getBusinessCountForCity` is fully independent.

   **Fix**:
   ```ts
   const [dealCount, businessCount, minPrice] = await Promise.all([
     getDealCountForCitySlug(route.citySlug),
     getBusinessCountForCity(cityName),
     getMinPriceForCitySlug(route.citySlug),
   ])
   ```

2. **Deals metadata for treatment-city route** (`src/app/deals/[[...slugs]]/page.tsx:134-141`):
   ```ts
   // CURRENT: Sequential
   const dealCount = await getDealCountForTreatmentAndCity(...)
   const businessCount = await getBusinessCountForCity(cityName)
   const minPrice = await getMinPriceForTreatmentAndCity(...)
   ```

   **Fix**: Same `Promise.all` pattern.

3. **Treatment category page** (`src/app/treatments/[category]/page.tsx:95-109`):
   ```ts
   // CURRENT: Sequential
   const categories = await getUnifiedCategories()
   const category = categories.find(...)
   const deals = await getDealsByDbCategorySlug(categorySlug)
   const cities = await getUnifiedCities()
   ```

   `getUnifiedCategories()` must complete before `getDealsByDbCategorySlug` can be called (need to validate the category exists). But `getUnifiedCities()` is independent:

   **Fix**:
   ```ts
   const categories = await getUnifiedCategories()
   const category = categories.find(...)
   if (!category) notFound()
   const [deals, cities] = await Promise.all([
     getDealsByDbCategorySlug(categorySlug),
     getUnifiedCities(),
   ])
   ```

4. **Guide page metadata + page body** (`src/app/guides/[slug]/page.tsx:47-80`):
   `generateMetadata()` calls `getGuidePricingStats()` and the page component calls it again. Without `cache()` on `getGuidePricingStats`, this executes the full query chain twice. Fix is documented in `05-backend.md` Section 5.4.

**Estimated savings**: 15-50ms per ISR cache miss (depends on number of parallelized queries).

---

## 4. Cloudinary Image CDN Optimization

### 4.1 Current State: Configured but Dormant

`next.config.ts` configures Cloudinary as a remote image pattern:
```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: '*.cloudinary.com' }],
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 31536000, // 1 year
}
```

However, no Cloudinary URLs are flowing through the application:
- `adapters.ts:115` sets `imageUrl: undefined` for all deals
- No component references Cloudinary URLs directly
- All images are served from `/images/` (local public directory) or are missing

### 4.2 Readiness Plan: When Cloudinary URLs Are Enabled

When `imageUrl` values start coming from Supabase (pointing to Cloudinary), the following optimizations should be pre-configured:

#### A. Cloudinary Transformation URL Pattern

Instead of serving raw Cloudinary uploads through Next.js Image optimization (which adds Vercel server CPU cost), use Cloudinary's own transformation API to serve pre-optimized images:

```ts
// src/lib/utils/cloudinary.ts
const CLOUDINARY_CLOUD = 'your-cloud-name' // from env

/**
 * Build a Cloudinary URL with automatic format, quality, and responsive sizing.
 * This bypasses Next.js image optimization and lets Cloudinary's CDN handle it.
 */
export function cloudinaryUrl(
  publicId: string,
  options: { width: number; height?: number; quality?: 'auto' | number } = { width: 400 },
): string {
  const transforms = [
    `w_${options.width}`,
    options.height ? `h_${options.height}` : null,
    'c_fill', // crop to fill
    'f_auto', // auto format (AVIF/WebP/JPEG based on Accept header)
    `q_${options.quality ?? 'auto'}`, // auto quality
    'dpr_auto', // device pixel ratio
  ].filter(Boolean).join(',')

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms}/${publicId}`
}
```

#### B. Direct Cloudinary URLs in `<img>` (Bypass Next.js Optimization)

When Cloudinary handles format negotiation and responsive sizing, you can use a regular `<img>` tag with `srcSet` instead of `next/image`, avoiding the double-optimization overhead:

```tsx
// For deal card images (when Cloudinary URLs are active)
<img
  src={cloudinaryUrl(deal.imageId, { width: 400, quality: 'auto' })}
  srcSet={`
    ${cloudinaryUrl(deal.imageId, { width: 400 })} 400w,
    ${cloudinaryUrl(deal.imageId, { width: 600 })} 600w,
    ${cloudinaryUrl(deal.imageId, { width: 800 })} 800w
  `}
  sizes="(max-width: 768px) 100vw, 33vw"
  alt={deal.title}
  loading="lazy"
  decoding="async"
/>
```

Alternatively, keep using `next/image` but set `unoptimized` on Cloudinary URLs to prevent double-processing:

```tsx
<Image
  src={cloudinaryUrl(deal.imageId, { width: 400 })}
  alt={deal.title}
  width={400}
  height={300}
  unoptimized // Cloudinary already optimized
  loading="lazy"
/>
```

#### C. Cloudinary CDN Cache Headers

Cloudinary automatically sets long cache headers on transformed URLs. The `minimumCacheTTL: 31536000` in `next.config.ts` is relevant only when Next.js optimizes the image (proxies through `/_next/image`). If using direct Cloudinary URLs, the browser receives Cloudinary's own cache headers (typically `max-age=2592000` for transformed images).

**No action needed** -- Cloudinary's default caching is sufficient. The 1-year `minimumCacheTTL` in Next.js config is a good safety net for any images still proxied through Next.js.

### 4.3 Current Image Optimization (Local Images)

All current images are local (`/images/homepage/hero-bg.png`, etc.) and go through Next.js image optimization. This is functional but has implications:

- Hero image (`hero-bg.png`) uses `priority` (good -- preloaded)
- `sizes="100vw"` is correct for full-width backgrounds
- `formats: ['image/avif', 'image/webp']` with AVIF first is optimal
- PNG source images are converted to AVIF/WebP at request time on the first hit, then cached

**No change needed** for current local images. The configuration is correct.

---

## 5. External API Call Patterns

### 5.1 Google Places API: Missing Timeout and Retry

**File**: `src/lib/actions/google-places.ts:70-95`

```ts
const response = await fetch(
  'https://places.googleapis.com/v1/places:searchText',
  {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ textQuery: query, maxResultCount: limit }),
  },
)
```

**Issues**:
1. No timeout -- if Google Places API is slow or unresponsive, the server action hangs until Vercel's function timeout (default 10s for Hobby, 60s for Pro)
2. No retry on transient failures (5xx, network errors)
3. No response caching -- identical searches always hit the API
4. No request deduplication -- rapid UI interactions could trigger multiple identical calls

**Fix: Add AbortController timeout + retry**:

```ts
// src/lib/actions/google-places.ts -- AFTER

const PLACES_TIMEOUT_MS = 5000  // 5 second timeout
const MAX_RETRIES = 1           // 1 retry on transient failure

export async function searchGooglePlacesAction(
  query: string,
  limit = 10,
): Promise<SearchResult> {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return { success: false, error: 'Google Places API key not configured.' }
    }

    if (!query.trim()) {
      return { success: true, places: [] }
    }

    let lastError: string = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS)

      try {
        const response = await fetch(
          'https://places.googleapis.com/v1/places:searchText',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': [
                'places.id',
                'places.displayName',
                'places.formattedAddress',
                'places.addressComponents',
                'places.location',
                'places.websiteUri',
                'places.rating',
                'places.userRatingCount',
                'places.primaryTypeDisplayName',
              ].join(','),
            },
            body: JSON.stringify({
              textQuery: query,
              maxResultCount: limit,
              languageCode: 'en',
            }),
            signal: controller.signal,
          },
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[searchGooglePlaces] API error (attempt ${attempt}):`, response.status, errorText)

          // Retry on 5xx, not on 4xx
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = `Google Places API ${response.status}`
            continue
          }
          return { success: false, error: 'Google Places search failed.' }
        }

        const data = (await response.json()) as PlacesApiResponse

        if (!data.places || data.places.length === 0) {
          return { success: true, places: [] }
        }

        const results: GooglePlaceResult[] = data.places.map((place) => ({
          place_id: place.id,
          name: place.displayName?.text ?? '',
          address: place.formattedAddress ?? '',
          city: extractCity(place.addressComponents) ?? '',
          website: place.websiteUri ?? null,
          rating: place.rating ?? null,
          review_count: place.userRatingCount ?? null,
          category: place.primaryTypeDisplayName?.text ?? null,
          latitude: place.location?.latitude ?? 0,
          longitude: place.location?.longitude ?? 0,
        }))

        return { success: true, places: results }
      } catch (err) {
        clearTimeout(timeoutId)

        if (err instanceof DOMException && err.name === 'AbortError') {
          console.error(`[searchGooglePlaces] Timeout after ${PLACES_TIMEOUT_MS}ms (attempt ${attempt})`)
          lastError = 'Request timed out'
          if (attempt < MAX_RETRIES) continue
          return { success: false, error: 'Google Places search timed out.' }
        }

        throw err // Re-throw unexpected errors
      }
    }

    return { success: false, error: lastError || 'Google Places search failed.' }
  } catch (err) {
    console.error('[searchGooglePlaces] unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
```

**Impact**: Prevents server action hangs on Google API outages. Limits exposure to transient failures with a single retry.

**Estimated savings**: Not latency savings under normal conditions, but prevents 10-60s hangs during Google API degradation.

### 5.2 Resend Email API: Missing Timeout

**File**: `src/lib/actions/notifications.ts:90-103, 142-154`

Both `sendClaimNotificationEmail` and `sendEmailAction` call `fetch('https://api.resend.com/emails', ...)` with no timeout. These are already "best-effort" (callers wrap in `.catch()`), but a slow Resend API could still block the claim creation response if the `await` completes before the `.catch()` handler.

**Current pattern** (in `claims.ts:199-211`):
```ts
sendClaimNotificationEmail({ ... }).catch((err) => {
  console.error('[createClaimAction] notification failed:', err)
})
```

This is a fire-and-forget pattern (`sendClaimNotificationEmail` returns a Promise that is not awaited), so the claim response is not blocked. However, the dangling promise still consumes the serverless function's execution time.

**Fix**: Add timeout to email calls for resource hygiene:

```ts
// In notifications.ts, add a helper:
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// Replace fetch() calls with fetchWithTimeout()
const response = await fetchWithTimeout('https://api.resend.com/emails', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ ... }),
}, 5000)
```

**Impact**: Prevents dangling serverless function execution from slow email API calls.

### 5.3 Supabase Queries: No Timeout Handling

The Supabase JS client does not have a built-in per-query timeout. If Supabase is slow or unresponsive, queries hang until the Vercel function timeout.

**Current risk**: Low for ISR pages (timeout results in stale cache being served), but higher for server actions where the user is waiting.

**Fix for critical server actions**: Wrap time-sensitive Supabase calls with `AbortController`:

```ts
// src/lib/utils/supabase-timeout.ts
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

// Usage in claims.ts:
const { data: offer, error } = await withTimeout(
  supabase.from('promo_offer_master').select('business_id, service_name').eq('id', dealId).single(),
  3000,
  'claim-offer-lookup',
)
```

**Impact**: Prevents indefinite user waits during Supabase degradation. Returns a clear error after 3 seconds instead of hanging for 10-60 seconds.

---

## 6. Edge and CDN Caching Strategy

### 6.1 Current State: No Custom Headers

The `next.config.ts` has no `headers()` configuration. All cache behavior relies on:
- ISR `revalidate` exports (3600s or 86400s)
- Next.js default `Cache-Control` headers for ISR pages (`s-maxage=<revalidate>, stale-while-revalidate`)
- Vercel's CDN automatically caches ISR responses

### 6.2 Optimization: Add Custom Cache-Control Headers

Create `vercel.json` or add `headers()` to `next.config.ts` for static assets and API responses:

```ts
// next.config.ts -- AFTER (add headers)
const nextConfig: NextConfig = {
  images: { /* ... unchanged ... */ },
  experimental: { /* ... unchanged ... */ },

  async headers() {
    return [
      // Static assets (fonts, icons, images in /public)
      {
        source: '/:path*.(woff2|woff|ttf|ico|png|jpg|jpeg|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ISR pages -- reinforce stale-while-revalidate behavior
      // (Next.js sets this automatically, but explicit headers ensure CDN compliance)
      {
        source: '/deals/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/treatments/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/guides/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=172800',
          },
        ],
      },
      // Security headers
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}
```

**Key detail**: The `stale-while-revalidate` directive tells CDN edge nodes to serve stale content while revalidating in the background. With `s-maxage=3600, stale-while-revalidate=86400`:
- For 1 hour: CDN serves cached response directly (0ms TTFB)
- From 1 hour to 25 hours: CDN serves stale cache instantly, triggers ISR regeneration in background
- After 25 hours: CDN must wait for fresh response

This means even after the ISR `revalidate` period expires, users get instant responses from stale cache while the page regenerates.

**Estimated savings**: Near-zero TTFB for repeat visitors within the stale-while-revalidate window.

### 6.3 Optimization: Font Cache Headers

Next.js automatically handles Google Fonts caching when using `next/font`. The Sora and Manrope font files are self-hosted at build time with content-hash URLs, so they are effectively immutable. The static asset header rule above (`immutable`) covers this.

### 6.4 OG Image Edge Caching

The three `opengraph-image.tsx` files use `export const runtime = 'edge'`, which means they execute on Vercel's edge network. They generate PNG images dynamically.

**Current issue**: No explicit cache header on OG images. Vercel's edge runtime does cache these, but the default may be short.

**Fix**: Add cache headers to OG image responses. Next.js OG image generation supports this via the `headers` option:

```tsx
// src/app/opengraph-image.tsx -- add cache header
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

// Cache OG images for 24 hours at the edge, serve stale for 7 days
export const revalidate = 86400
```

Since these OG images are based on static content (site name, colors), they change rarely. A 24-hour cache with 7-day stale-while-revalidate is appropriate.

**Estimated savings**: Eliminates OG image regeneration for social media crawlers hitting the same URL within 24 hours.

---

## 7. Network Waterfall Elimination

### 7.1 Missing Resource Hints (Critical)

The application has **zero** `<link rel="preconnect">` or `<link rel="dns-prefetch">` tags for any external service. Every first request to an external domain incurs DNS resolution + TLS handshake overhead.

**External domains used**:
1. `kdlpkjzcnbkjcvwsvlwn.supabase.co` -- Supabase REST + Auth (client-side)
2. `res.cloudinary.com` -- Cloudinary CDN (when active)
3. `fonts.googleapis.com` / `fonts.gstatic.com` -- NOT used (next/font self-hosts)

**Fix**: Add preconnect hints to the root layout:

```tsx
// src/app/layout.tsx -- add to <head> via metadata
export const metadata: Metadata = {
  // ... existing metadata ...
  other: {
    // Preconnect to Supabase (used by client-side auth on every page)
    'preconnect-supabase': '',
  },
}

// Better approach: use generateMetadata or direct <head> injection
```

Since Next.js App Router does not support arbitrary `<link>` tags in metadata, use the `<head>` approach:

```tsx
// src/app/layout.tsx -- in the <html> element
<html lang="en">
  <head>
    {/* Preconnect to Supabase for client-side auth calls */}
    <link
      rel="preconnect"
      href={`https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}`}
      crossOrigin="anonymous"
    />
    {/* DNS prefetch for Cloudinary (when images are enabled) */}
    <link rel="dns-prefetch" href="https://res.cloudinary.com" />
  </head>
  <body ...>
```

**Why preconnect matters for Supabase**: The `AuthProvider` calls `supabase.auth.getUser()` on mount. Without preconnect, the browser must:
1. DNS resolve `kdlpkjzcnbkjcvwsvlwn.supabase.co` (~20-50ms)
2. TLS handshake (~30-60ms)
3. HTTP request (~30-100ms)

With preconnect, steps 1 and 2 happen during HTML parsing, so by the time JavaScript executes and calls `getUser()`, the connection is already established.

**Estimated savings**: 50-110ms on first page load (DNS + TLS pre-established).

### 7.2 Build-Time vs Runtime Query Separation

The current architecture has a clean separation:
- **Build time / ISR revalidation**: All data fetching uses the anon-key singleton client (`src/lib/supabase.ts`). These queries happen server-side and do not create browser network waterfalls.
- **Runtime (client)**: Only auth calls (`getUser()`) happen in the browser.

This is architecturally sound. The browser never makes direct Supabase REST queries -- all data comes pre-rendered via ISR. The only client-to-Supabase traffic is auth session management.

### 7.3 Homepage Data Fetch Waterfall

The homepage (`src/app/page.tsx`) correctly parallelizes its three data calls:

```ts
const [featuredOffers, rawCategories, cityDealCounts] = await Promise.all([
  getFeaturedOffers(6),        // Supabase query
  getOfferCategories(),        // Supabase query
  getCityDealCounts(),         // getOffersWithBusinesses() -> Supabase query
])
```

However, `getCityDealCounts()` internally calls `getOffersWithBusinesses()` with no filters, which fetches the entire offers table. This is a data volume problem (covered in `04-database.md`), not a waterfall problem.

**No additional waterfall fix needed** for the homepage -- the parallelization is correct.

### 7.4 Provider Page N+1 During Build

`generateStaticParams` in `src/app/[state]/[city]/provider/[slug]/page.tsx:36-38`:

```ts
const providerResults = await Promise.all(
  citiesWithState.map(({ city }) => getProvidersByCity(city.name)),
)
```

This parallelizes well across cities, but with ~20 cities, it fires 20 concurrent Supabase queries. During build, Supabase may rate-limit or the connection pool may saturate.

**Fix**: Add concurrency limiting for build-time queries:

```ts
// src/lib/utils/concurrency.ts
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = []
  const executing = new Set<Promise<void>>()

  for (const item of items) {
    const p = fn(item).then((result) => {
      results.push(result)
      executing.delete(p)
    })
    executing.add(p)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}
```

Usage:
```ts
const providerResults = await mapWithConcurrency(
  citiesWithState,
  ({ city }) => getProvidersByCity(city.name),
  5, // max 5 concurrent Supabase queries
)
```

**Impact**: Prevents build-time Supabase rate limiting. With 20 cities at concurrency 5, build time increases slightly but avoids connection pool exhaustion.

---

## 8. ISR Interaction with External Services

### 8.1 ISR Revalidation Flow

When a cached ISR page expires and a request arrives:

```
1. CDN receives request
2. CDN serves stale cache immediately (if stale-while-revalidate allows)
3. CDN triggers background regeneration:
   a. Vercel spins up serverless function
   b. Function executes page component
   c. Data fetching functions call Supabase
   d. If Supabase query fails → function throws → stale cache continues to be served
   e. If Supabase query succeeds → new HTML generated → CDN cache updated
4. Next visitor gets fresh content
```

### 8.2 Current ISR + Supabase Interaction Analysis

| Page | ISR Period | Supabase Calls on Revalidation | Total Est. Latency |
|------|-----------|-------------------------------|-------------------|
| Homepage (`/`) | 3600s | 3 parallel queries: `getFeaturedOffers`, `getOfferCategories`, `getCityDealCounts` (full table) | 50-200ms |
| City deals (`/deals/[city]`) | 3600s | `resolveRoute` (1 query) + `getDealsForCitySlug` (2-query waterfall) + `getBusinessCountForCity` (1 query) + metadata (3 queries, partially cached) | 100-400ms |
| Treatment category | 3600s | `getUnifiedCategories` (1 query) + `getDealsByDbCategorySlug` (1 query) + `getUnifiedCities` (1 query) | 50-150ms |
| Guide page | 86400s | `getGuidePricingStats` (2-4 queries) + `getGuideDealsPreview` (2-4 queries, partially overlapping) | 100-300ms |
| Provider page | SSG (no ISR) | N/A at runtime | 0ms |

### 8.3 ISR Error Resilience

**Current behavior**: If a Supabase query throws during ISR revalidation, the page component throws, and Next.js continues serving the stale cached version. This is correct behavior -- ISR is resilient to transient failures.

**Gap**: There is no error logging specific to ISR revalidation failures. If Supabase is down for 30 minutes, ISR silently serves stale content with no alerting.

**Fix**: The error logging infrastructure proposed in `05-backend.md` Section 3.1 (`handleActionError`) covers server actions but not ISR data fetching functions. Add defensive error handling to key data functions:

```ts
// In offers.ts, wrap getOffersWithBusinesses
export async function getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferWithBusiness[]> {
  try {
    // ... existing query logic ...
  } catch (error) {
    console.error('[getOffersWithBusinesses] Supabase query failed:', {
      filters,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    throw error // Re-throw to let ISR serve stale cache
  }
}
```

This preserves the ISR stale-cache fallback while adding visibility into data fetch failures via Vercel's log drain.

### 8.4 ISR Revalidation Stampede Prevention

With ISR `revalidate: 3600`, all city deal pages expire at approximately the same time (relative to their last generation). If traffic hits multiple expired city pages simultaneously, Vercel could receive 20+ concurrent ISR regeneration requests, each making multiple Supabase queries.

**Vercel's built-in protection**: Vercel deduplicates ISR regeneration -- only one regeneration runs per path, regardless of how many requests trigger it. This prevents stampedes at the per-path level.

**Remaining risk**: 20 different city paths expiring around the same time = 20 concurrent regenerations. Each runs `getDealsForCitySlug` + `getBusinessCountForCity` + metadata queries = 4-6 Supabase queries per path = 80-120 concurrent queries.

**Mitigation**: The `minimumCacheTTL` jitter in ISR naturally staggers expirations since each page was generated at a different time. No additional action needed unless monitoring shows Supabase rate limiting during burst revalidation periods.

---

## 9. Implementation Plan

### Phase 1: Zero-Code Quick Wins (< 1 hour)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 1.1 | Add `<link rel="preconnect">` for Supabase domain | 50-110ms first-load improvement | None | `src/app/layout.tsx` |
| 1.2 | Add `<link rel="dns-prefetch">` for Cloudinary domain | Pre-positioned for when images go live | None | `src/app/layout.tsx` |
| 1.3 | Pin Vercel function region in project settings | Prevent cross-region latency drift | None | Vercel dashboard or `vercel.json` |

### Phase 2: Cache Headers and Timeouts (1-2 hours)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 2.1 | Add `headers()` config to `next.config.ts` | Explicit CDN caching + security headers | Low | `next.config.ts` |
| 2.2 | Add timeout + retry to Google Places API call | Prevents server action hangs during API degradation | Low | `src/lib/actions/google-places.ts` |
| 2.3 | Add timeout to Resend email API calls | Prevents dangling function execution | Low | `src/lib/actions/notifications.ts` |
| 2.4 | Add `revalidate` export to OG image routes | Edge-cache OG images for 24 hours | Low | 3 `opengraph-image.tsx` files |

### Phase 3: Connection Management (2-3 hours)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 3.1 | Create shared browser client singleton | Eliminates duplicate Supabase browser client instances | Low | `src/lib/supabase-browser.ts` |
| 3.2 | Create `useSupabaseUser` shared hook | Eliminates duplicate `getUser()` calls across providers | Medium -- auth providers depend on this | New hook + update 2 context files |
| 3.3 | Add concurrency limiter for build-time queries | Prevents Supabase rate limiting during SSG builds | Low | New utility + `provider/[slug]/page.tsx` |

### Phase 4: Query Parallelization (1-2 hours)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 4.1 | Parallelize city deals metadata queries | 15-50ms savings per ISR miss | Low | `src/app/deals/[[...slugs]]/page.tsx` |
| 4.2 | Parallelize treatment-city metadata queries | 15-50ms savings per ISR miss | Low | `src/app/deals/[[...slugs]]/page.tsx` |
| 4.3 | Parallelize treatment category page queries | 15-30ms savings per ISR miss | Low | `src/app/treatments/[category]/page.tsx` |

### Phase 5: Error Resilience (1 hour)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 5.1 | Add structured error logging to ISR data functions | Observability into revalidation failures | None | `src/lib/data/offers.ts`, `businesses.ts` |
| 5.2 | Add `withTimeout` utility for critical server action queries | 3s timeout on claim-related Supabase calls | Low | New utility + `src/lib/actions/claims.ts` |

### Phase 6: Cloudinary Readiness (when images go live)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 6.1 | Create `cloudinaryUrl()` utility with transformation API | Optimized image delivery without double-processing | Low | New utility file |
| 6.2 | Update `BlurredImage` and deal card components | Direct Cloudinary URLs with responsive srcSet | Medium | Component files |

---

## 10. Expected Latency Improvements

### Per-Optimization Impact Summary

| Optimization | Latency Impact | Applies To | Frequency |
|-------------|---------------|------------|-----------|
| Preconnect to Supabase | -50 to -110ms | Every first page load | Every visitor |
| Shared browser client singleton | -50 to -200ms | Every page load (eliminates 1 `getUser()` call) | Every visitor |
| `useSupabaseUser` shared hook | -50 to -150ms | Authenticated pages | Authenticated users |
| Region pinning verification | 0 to -80ms | Every Supabase query | Every ISR miss + server action |
| Metadata query parallelization | -15 to -50ms | City/treatment deals pages | ISR cache miss |
| Google Places timeout | Prevents 10-60s hangs | Business search action | During API degradation |
| Resend timeout | Prevents dangling execution | Claim notification | During API degradation |
| Custom cache headers | Near-zero TTFB in stale-while-revalidate window | All ISR pages | Repeat visitors |
| OG image caching | Eliminates regeneration | Social media crawlers | Shared links |
| Build concurrency limiting | Prevents rate limiting | SSG build | Build time only |

### Aggregate Impact by User Journey

| Journey | Current Est. | After Optimization | Savings |
|---------|-------------|-------------------|---------|
| **Anonymous homepage (first visit)** | | | |
| - Network setup (DNS + TLS to Supabase) | 50-110ms | 0ms (preconnect) | 50-110ms |
| - Client auth hydration | 100-400ms (2x getUser) | 50-200ms (1x getUser) | 50-200ms |
| - ISR cache hit TTFB | <100ms | <100ms | 0ms |
| **Total first-visit improvement** | | | **100-310ms** |
| | | | |
| **City deals page (ISR miss)** | | | |
| - Metadata queries (sequential) | 100-200ms | 50-100ms (parallelized) | 50-100ms |
| - City waterfall (2 queries) | 30-60ms | 15-30ms (RPC, from 04-database.md) | 15-30ms |
| **Total ISR miss improvement** | | | **65-130ms** |
| | | | |
| **Claim creation (server action)** | | | |
| - Sequential validation queries | 50-150ms | 25-75ms (parallelized, from 05-backend.md) | 25-75ms |
| - Timeout protection | 10-60s (during outage) | 3s max | Outage resilience |

### Combined Effect

For the most critical user journey (anonymous visitor landing on homepage):

- **Before**: ~250-810ms of external service overhead (DNS + TLS + 2x auth + ISR data)
- **After**: ~100-300ms of external service overhead (preconnect + 1x auth + ISR data)
- **Improvement**: ~150-500ms reduction in service communication latency

These gains compound with the database query optimizations from `04-database.md` and the provider architecture changes from `05-backend.md`. The provider removal from public pages (Section 1.2 of `05-backend.md`) eliminates client-side auth calls entirely for anonymous visitors, which is the single highest-impact change across all optimization documents.

---

## Appendix: File Reference

| File | Relevant Section |
|------|-----------------|
| `src/lib/supabase.ts` | Section 2.1 (module-level singleton) |
| `src/lib/supabase-server.ts` | Section 2.1 (per-request cookie client) |
| `src/lib/supabase-browser.ts` | Section 2.2 (shared browser singleton) |
| `src/lib/context/authContext.tsx` | Section 2.3 (duplicate getUser elimination) |
| `src/lib/context/businessAuthContext.tsx` | Section 2.3 (duplicate getUser + visibility handler) |
| `src/lib/data/offers.ts` | Section 3.3 (two-query waterfall), Section 8.3 (error resilience) |
| `src/lib/data/unified.ts` | Section 3.4 (query batching) |
| `src/lib/data/guide-stats.ts` | Section 3.4 (parallel queries) |
| `src/lib/actions/google-places.ts` | Section 5.1 (timeout + retry) |
| `src/lib/actions/notifications.ts` | Section 5.2 (timeout) |
| `src/lib/actions/claims.ts` | Section 5.3 (query timeout) |
| `src/app/layout.tsx` | Section 7.1 (preconnect hints) |
| `src/app/page.tsx` | Section 7.3 (homepage parallelization) |
| `src/app/deals/[[...slugs]]/page.tsx` | Section 3.4 (metadata parallelization) |
| `src/app/treatments/[category]/page.tsx` | Section 3.4 (query parallelization) |
| `src/app/guides/[slug]/page.tsx` | Section 3.4, 8.2 (guide ISR analysis) |
| `src/app/[state]/[city]/provider/[slug]/page.tsx` | Section 7.4 (build concurrency) |
| `src/app/opengraph-image.tsx` | Section 6.4 (edge cache headers) |
| `src/app/treatments/[category]/opengraph-image.tsx` | Section 6.4 (edge cache headers) |
| `src/app/[state]/[city]/opengraph-image.tsx` | Section 6.4 (edge cache headers) |
| `next.config.ts` | Section 4, 6.2 (headers config) |
| `src/proxy.ts` | Section 2.1 (middleware auth pattern) |
