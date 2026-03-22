# CostFinders v2 -- Comprehensive Performance Profile

**Date**: 2026-03-21
**Scope**: Full application -- Next.js 16 (App Router), Supabase backend, Cloudinary images, Vercel hosting
**Method**: Static codebase analysis of rendering strategies, data fetching patterns, bundle composition, asset pipeline, and component architecture

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Bundle and Dependency Analysis](#2-bundle-and-dependency-analysis)
3. [Data Fetching Profiling](#3-data-fetching-profiling)
4. [Rendering Strategy Analysis](#4-rendering-strategy-analysis)
5. [Image and Asset Pipeline](#5-image-and-asset-pipeline)
6. [Font Loading Analysis](#6-font-loading-analysis)
7. [Component Architecture Profiling](#7-component-architecture-profiling)
8. [CSS and Styling Analysis](#8-css-and-styling-analysis)
9. [Third-Party Script Impact](#9-third-party-script-impact)
10. [Bottleneck Ranking](#10-bottleneck-ranking)
11. [Baseline Metrics Estimates](#11-baseline-metrics-estimates)
12. [Critical User Journey Hot Paths](#12-critical-user-journey-hot-paths)

---

## 1. Executive Summary

The CostFinders v2 application has a lean dependency set (8 production deps) and uses ISR effectively across public pages. However, there are several structural performance issues that compound into meaningful user-facing slowdowns:

**Top 3 Critical Issues:**
1. **Redundant Supabase queries with waterfall patterns** -- The data layer fetches full datasets then filters in JS, and the city filter in `getOffersWithBusinesses` performs a sequential two-query waterfall on every call.
2. **Excessive client-side JavaScript from root layout context providers** -- Three `'use client'` context providers (`AuthProvider`, `BusinessAuthProvider`, `ClaimsProvider`) wrap every page in the root layout, forcing auth-related code (Supabase browser client, server actions, state management) into the initial JS bundle for all visitors including unauthenticated ones.
3. **54 client components importing from `@phosphor-icons/react` (non-SSR path)** -- Despite `optimizePackageImports` being configured, 54 files use the client barrel import while only 12 use the tree-shakeable `/dist/ssr` path.

---

## 2. Bundle and Dependency Analysis

### 2.1 Production Dependencies

| Package | Purpose | Bundle Impact | Notes |
|---|---|---|---|
| `next` 16.1.1 | Framework | Framework overhead | Current, good |
| `react` / `react-dom` 19.2.3 | UI runtime | ~140KB gzip shared | Current |
| `@phosphor-icons/react` ^2.1.10 | Icons | **HIGH risk** | 54 files use client barrel import |
| `@supabase/supabase-js` ^2.99.3 | DB client | ~30KB gzip | Used in both server and client |
| `@supabase/ssr` ^0.9.0 | SSR auth helpers | ~5KB gzip | Used in server actions + browser |
| `@vercel/analytics` ^2.0.1 | Analytics | ~1KB gzip | Lazy loaded by Vercel |
| `@vercel/speed-insights` ^2.0.0 | Web vitals | ~1KB gzip | Lazy loaded by Vercel |
| `schema-dts` ^1.1.5 | Structured data types | **0 runtime** | Types only, tree-shaken |

### 2.2 Icon Import Analysis (Critical Finding)

**File**: `next.config.ts:12-15`
```ts
optimizePackageImports: [
  '@phosphor-icons/react',
  '@supabase/supabase-js',
],
```

The `optimizePackageImports` config is set, but there is a split usage pattern:

- **54 files** import from `@phosphor-icons/react` (client barrel) -- forces entire icon set into client bundles
- **12 files** import from `@phosphor-icons/react/dist/ssr` (server-safe, tree-shakeable)

The client barrel imports occur in files like:
- `src/components/features/dealCard.tsx` (line 3)
- `src/components/features/homepage/heroSection.tsx` (line 3)
- `src/components/features/homepage/socialProofSection.tsx` (lines 4-8)
- `src/components/layout/globalHeader.tsx` (line 3)

While `optimizePackageImports` helps at build time, each `'use client'` component that imports icons still increases the client JS bundle because the tree-shaken icons must be included in the client chunk.

### 2.3 Mock Data Still Bundled

**19 mock data files** exist at `src/lib/mock-data/` and are actively imported by production pages:

- `src/app/[state]/[city]/page.tsx` imports `getNeighborhoodsForCity`, `getStateBySlug`
- `src/app/[state]/page.tsx` imports `getStateBySlug`, `getStates`
- `src/app/[state]/[city]/provider/[slug]/page.tsx` imports `getStateBySlug`, `getStates`
- `src/app/sitemap.ts` imports 4 mock data modules
- `src/app/admin/dashboard/reports/page.tsx` imports `businesses`, `getCategories`, `consumers`
- Multiple business dashboard pages import from mock data

These mock files contain static arrays of data (businesses, consumers, billing records, lead pricing) that are bundled into the server runtime even though they serve no live purpose for the consumer-facing site. The `src/lib/mock-data/index.ts` barrel export potentially pulls in the entire mock data graph when any module imports from it.

### 2.4 `schema-dts` Dependency

Used at `src/lib/seo/schemas.ts:1-8` for TypeScript type imports only. This is correctly tree-shaken at build time -- zero runtime cost. No issue.

---

## 3. Data Fetching Profiling

### 3.1 Two-Query Waterfall in City-Filtered Offers (Critical)

**File**: `src/lib/data/offers.ts:62-118` -- `getOffersWithBusinesses()`

When filtering by city, this function executes a **sequential two-query waterfall**:

```
Query 1: SELECT business_id FROM master_business_info WHERE city ILIKE $city
   --> waits for result
Query 2: SELECT *, ... FROM promo_offer_master WHERE business_id IN ($ids)
```

This pattern appears at line 71-83:
```ts
if (filters?.city) {
  const { data: cityBusinesses } = await supabase
    .from('master_business_info')
    .select('business_id')
    .ilike('city', filters.city)

  if (!cityBusinesses || cityBusinesses.length === 0) return []
  query = query.in(
    'business_id',
    cityBusinesses.map((b) => b.business_id),
  )
}
```

**Impact**: Every city-scoped page (deals/[city], treatments by city, guide pages) pays a double round-trip penalty to Supabase. With Supabase hosted externally, each round-trip is ~50-150ms depending on region, adding 100-300ms of unnecessary latency.

**Frequency**: This function is called by:
- `getDealsForCitySlug()` -- city deals pages
- `getDealsByCity()` -- city deals
- `getDealsForTreatmentAndCity()` -- treatment+city pages
- `getCityDealCounts()` -- homepage (fetches ALL offers with no filter, then groups in JS)
- `getGuidePricingStats()` -- guide pages
- `getGuideDealsPreview()` -- guide pages
- `getCityOfferCount()` -- city pages

### 3.2 Full-Table Scan for Category Counts (High)

**File**: `src/lib/data/offers.ts:120-143` -- `getOfferCategories()`

```ts
const { data, error } = await supabase
  .from(TABLE)
  .select('service_category')
  .or('discount_price.gt.0,original_price.gt.0')
```

This fetches **every row's `service_category` value** from the offers table, then aggregates counts in JavaScript. With 347 offers this is tolerable now, but it downloads all rows just to count categories. A SQL `GROUP BY` or RPC would eliminate the data transfer.

### 3.3 Full-Table Scan for City Deal Counts (High)

**File**: `src/lib/data/unified.ts:256-283` -- `getCityDealCounts()`

```ts
const offers = await getOffersWithBusinesses() // <-- fetches ALL offers with business joins
```

This calls `getOffersWithBusinesses()` with **no filters**, fetching the entire promo_offer_master table with business joins (all 347 offers), then groups by city in JavaScript. This is called on the **homepage** (`src/app/page.tsx:18`), making it the heaviest data fetch on the most visited page.

### 3.4 Full-Table Scan for Business Cities (Medium)

**File**: `src/lib/data/businesses.ts:38-63` -- `getBusinessCities()`

The function first attempts an RPC call. On RPC failure, it falls back to fetching ALL 354 business records (`SELECT city FROM master_business_info`) and aggregating in JS. If the RPC does not exist in production, this fallback runs on every request that resolves city slugs.

### 3.5 Redundant Data Fetching in Deals Routing Page (High)

**File**: `src/app/deals/[[...slugs]]/page.tsx`

The `generateMetadata()` function (line 114) and the `DealsRoutingPage` component (line 173) both call `resolveRoute()`, which is cached. However, `generateMetadata()` for the `'city'` route type makes three additional sequential calls:

```
Line 122: getDealCountForCitySlug(route.citySlug)  --> fetches all deals, counts
Line 124: getBusinessCountForCity(cityName)         --> fetches all businesses, counts
Line 125: getMinPriceForCitySlug(route.citySlug)    --> fetches all deals again, finds min
```

`getDealCountForCitySlug` (unified.ts:107-109) calls `getDealsForCitySlug` which fetches full deal objects just to return `.length`. `getMinPriceForCitySlug` (unified.ts:138-145) calls the same function again just to find the minimum price. Thanks to React's `cache()` wrapper on `getDealsForCitySlug`, the second call is deduplicated within the same request, but the data fetched is still excessive for counts and min operations.

### 3.6 Provider Page N+1 in generateStaticParams (Medium)

**File**: `src/app/[state]/[city]/provider/[slug]/page.tsx:24-47`

```ts
const providerResults = await Promise.all(
  citiesWithState.map(({ city }) => getProvidersByCity(city.name)),
)
```

This parallelizes well with `Promise.all`, but each city issues a separate Supabase query. With ~20 cities, that is 20 concurrent queries during build time. Not a runtime issue (ISR), but extends build times.

### 3.7 React `cache()` Usage (Good Pattern, Partial Coverage)

Functions properly using `cache()`:
- `getBusinesses`, `getBusinessById`, `getBusinessCities` (businesses.ts)
- `getOfferById`, `getOfferCategories`, `getOffersByBusiness`, `getFeaturedOffers` (offers.ts)
- `getCityNameFromSlug`, `getDealsForCitySlug`, `getDealsForTreatmentAndCity`, `getUnifiedCities`, `getCityDealCounts`, `getBusinessCountForCity` (unified.ts)

Functions **missing** `cache()`:
- `getOffers()` (offers.ts:19) -- no cache wrapper
- `getOffersWithBusinesses()` (offers.ts:62) -- **the most called function, not cached**
- `getBusinessCategories()` (businesses.ts:65) -- no cache wrapper
- `searchBusinesses()` (businesses.ts:83) -- no cache wrapper
- `getActiveDeals()` (unified.ts:51) -- no cache wrapper
- `getDealsByCity()` (unified.ts:56) -- no cache wrapper
- `getDealsByCategory()` (unified.ts:61) -- no cache wrapper

The omission of `cache()` on `getOffersWithBusinesses()` is the most impactful. This function is called multiple times per request on city pages (via `getDealsForCitySlug`, `getCityDealCounts`, etc.) and each call re-executes the Supabase query.

### 3.8 Supabase Client Architecture (Medium)

**File**: `src/lib/supabase.ts`

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

This creates a **module-level singleton** using `createClient` from `@supabase/supabase-js` (not the SSR variant). This client is used by all server-side data fetching functions (`businesses.ts`, `offers.ts`). It works, but:

1. It does not carry request-scoped cookies, so it uses only the anon key for all data queries
2. It is a single global instance shared across all server requests, which is fine for read-only public data but could cause issues if RLS policies vary by user

The separate `supabase-server.ts` uses `createServerClient` from `@supabase/ssr` with cookie integration, but this is only used in server actions, not in the data fetching layer.

---

## 4. Rendering Strategy Analysis

### 4.1 ISR Configuration (Good)

| Page | Revalidation | Strategy |
|---|---|---|
| Homepage (`/`) | 3600s (1 hour) | ISR |
| Deals (`/deals/[...]`) | 3600s (1 hour) | ISR |
| Treatments index (`/treatments`) | 86400s (24 hours) | ISR |
| Treatment category (`/treatments/[cat]`) | 3600s (1 hour) | ISR |
| Guides (`/guides/[slug]`) | 86400s (24 hours) | ISR |
| State pages (`/[state]`) | Static (generateStaticParams) | SSG |
| City pages (`/[state]/[city]`) | Static (generateStaticParams) | SSG |
| Provider pages | Static (generateStaticParams) | SSG |

ISR is properly configured for the consumer-facing pages. The revalidation periods are reasonable.

### 4.2 Pages Missing Caching Configuration

The following pages have no `revalidate` export and no `generateStaticParams`, so they default to dynamic rendering on every request:

- `src/app/[state]/page.tsx` -- has `generateStaticParams` but no `revalidate` (SSG at build, good)
- `src/app/[state]/[city]/page.tsx` -- has `generateStaticParams` but no `revalidate` (SSG at build, good)
- Dashboard pages -- appropriate (auth-required, dynamic)

### 4.3 Client Component Boundary Issues (Critical)

**Root Layout** (`src/app/layout.tsx:69-94`):

```tsx
<AuthProvider>
  <BusinessAuthProvider>
    <ClaimsProvider>
      <GlobalHeader />
      {children}
    </ClaimsProvider>
  </BusinessAuthProvider>
</AuthProvider>
```

This nesting means **every page** in the application, including the public homepage, deals pages, and treatment pages, is wrapped in three `'use client'` context providers that:

1. **`AuthProvider`** (449 lines) -- Creates a Supabase browser client, calls `supabase.auth.getUser()` on mount, subscribes to auth state changes, imports 5 server action modules
2. **`BusinessAuthProvider`** (395 lines) -- Creates another Supabase browser client, calls `supabase.auth.getUser()` on mount, subscribes to auth state changes
3. **`ClaimsProvider`** (215 lines) -- Depends on `AuthProvider`, fetches claims on mount if authenticated

**Impact on unauthenticated visitors (majority of traffic):**
- Both `AuthProvider` and `BusinessAuthProvider` create Supabase browser clients and call `getUser()` on mount -- that is 2 network requests to Supabase Auth on every page load
- The JS for all three providers, their dependencies (server action stubs, Supabase browser client, type imports), and their state management code is included in the initial client bundle
- `ClaimsProvider` subscribes to `authState.user` changes and will also fire a `getClaimsAction()` call if the user turns out to be authenticated

**Estimated client JS cost**: ~15-25KB gzip for the three providers + Supabase browser client + server action stubs.

---

## 5. Image and Asset Pipeline

### 5.1 Next.js Image Optimization (Good)

**File**: `next.config.ts:4-10`

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: '*.cloudinary.com' }],
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 31536000, // 1 year
},
```

- AVIF + WebP formats configured (AVIF first -- good, highest compression)
- 1-year cache TTL for immutable images -- good
- Cloudinary remote pattern whitelisted

### 5.2 Hero Background Image (Medium)

**File**: `src/components/features/homepage/heroSection.tsx:29-36`

```tsx
<Image
  src="/images/homepage/hero-bg.png"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  priority
/>
```

- `priority` is set, which generates a `<link rel="preload">` -- good for LCP
- `sizes="100vw"` is appropriate for a full-width background
- **However**, the image is served from `/images/homepage/hero-bg.png` (local public directory) rather than Cloudinary, so it goes through Next.js image optimization on the server. This is fine for Vercel but adds server load.
- PNG format source -- Next.js will convert to AVIF/WebP at runtime

### 5.3 Value Props Background Image (Low)

**File**: `src/components/features/homepage/valuePropsSection.tsx:41-47`

```tsx
<Image
  src="/images/homepage/value-props-bg.png"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  loading="lazy"
/>
```

Properly lazy-loaded. Below the fold, so lazy is correct.

### 5.4 Deal Card Images (Medium)

**File**: `src/components/features/dealCard.tsx:70-75`

```tsx
<BlurredImage
  src={deal.imageUrl}
  alt={deal.title}
  sizes={isGrid ? '(max-width: 768px) 100vw, 33vw' : '192px'}
/>
```

The `BlurredImage` component (`src/components/patterns/blurredImage.tsx:27-35`) uses:
```tsx
<Image
  src={src}
  alt={alt}
  fill={fill}
  sizes={sizes}
  priority={priority}
  loading={priority ? 'eager' : 'lazy'}
  className="object-cover blur-xl scale-110"
/>
```

- `fill` + `sizes` is correctly configured
- Default `priority=false`, `loading="lazy"` -- good for card grids
- The `blur-xl scale-110` CSS class applies a heavy Gaussian blur and 10% scale-up -- this is purely decorative (the image is intentionally blurred as a business-hidden preview). The blur is CSS-only, no performance concern.
- **Missing**: No `placeholder="blur"` or `blurDataURL` for progressive loading. Images pop in without any placeholder.

### 5.5 No Cloudinary Images Currently Used

Searching through all Image components and `imageUrl` references, deal images (`deal.imageUrl`) are always `undefined` in the current data (set at `adapters.ts:115`: `imageUrl: undefined`). The Cloudinary integration exists in config but no actual Cloudinary URLs flow through the application yet. All images are local public directory files or non-existent.

---

## 6. Font Loading Analysis

### 6.1 Font Configuration (Good with Minor Issue)

**File**: `src/app/layout.tsx:12-26`

```ts
const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  weight: ['400', '500', '600', '700'],
})

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '500', '600', '700'],
})
```

**Good practices:**
- `display: 'swap'` prevents invisible text during font load (no FOIT)
- Sora is `preload: true` (primary font) -- generates preload link
- Manrope is `preload: false` (fallback font) -- does not preload, saving bandwidth
- Only Latin subset loaded
- CSS variable approach avoids layout shifts

**Issue**: Both fonts load 4 weight variants each (400, 500, 600, 700). That is 8 font files total. Each weight is a separate HTTP request. Consider whether all 4 weights are actually used for each font. If weight 500 or 700 is rarely used, removing it would reduce initial page weight by ~15-25KB per removed variant.

### 6.2 Font Stack (Good)

**File**: `src/app/globals.css:11`

```css
--font-sans: var(--font-sora), var(--font-manrope), system-ui, sans-serif;
```

Proper fallback chain: Sora (primary) --> Manrope (fallback web font) --> system-ui (OS font) --> generic sans-serif. This minimizes CLS from font swapping since system-ui metrics approximate the web fonts.

---

## 7. Component Architecture Profiling

### 7.1 Client Component Count

**125 files** contain `'use client'` directives across the `src/` directory.

Breakdown by layer:
- `src/components/features/` -- ~55 client components
- `src/components/patterns/` -- ~12 client components
- `src/components/ui/` -- ~8 client components
- `src/components/layout/` -- ~6 client components
- `src/app/` pages -- ~30 client pages (dashboards)
- `src/lib/` -- ~7 client files (hooks, contexts)

### 7.2 Unnecessarily Client-Side Components (High)

Several components marked `'use client'` have no client-side interactivity:

**`src/components/features/homepage/trendingDealsSection.tsx`**: Marked `'use client'` but only renders static content with links. The `ScrollRevealItem` wrapper requires client JS, but the section wrapper itself could be a server component with only the `ScrollRevealItem` items as client islands.

**`src/components/features/homepage/socialProofSection.tsx`**: Client component due to `AnimatedCounter` and `ScrollReveal`. The entire section is client-rendered even though only the counter animation and scroll reveal detection need JS.

**`src/components/features/homepage/valuePropsSection.tsx`**: Client component only because of `useScrollReveal` hook. The content is fully static.

**`src/components/features/homepage/categoryGrid.tsx`** and **`cityGrid.tsx`**: Likely marked client for scroll reveal animations but contain purely static content.

### 7.3 GlobalHeader Always Client-Rendered (Medium)

**File**: `src/components/layout/globalHeader.tsx`

The header is a `'use client'` component that imports:
- `useAuth()` -- pulls in AuthContext
- `useScrolled()` -- scroll detection hook
- `usePathname()` -- Next.js navigation
- `useState` -- modal state
- `dynamic()` import of AuthModal

Since this component is rendered in the root layout, it contributes to the initial client JS bundle on every page. The `dynamic()` import of `AuthModal` with `ssr: false` is a good optimization (line 10-13), deferring that code until the modal is opened.

### 7.4 SEO Components Barrel Export (Minor)

**File**: `src/components/seo/index.ts`

```ts
export { BreadcrumbSchema } from './breadcrumbSchema'
export { FaqSchema } from './faqSchema'
export { OrganizationSchema } from './organizationSchema'
export { WebsiteSchema } from './websiteSchema'
```

This is a barrel export, but since these are all server components (no `'use client'`), and Next.js/webpack will tree-shake unused exports, the performance impact is negligible.

---

## 8. CSS and Styling Analysis

### 8.1 Tailwind v4 (Good)

**File**: `src/app/globals.css:1`

```css
@import "tailwindcss";
```

Tailwind v4 uses CSS-first configuration and generates only the classes actually used in the codebase. No `tailwind.config.js` needed. CSS output is optimized at build time.

### 8.2 Custom CSS Size (Low)

The `globals.css` file is ~208 lines total, including:
- CSS custom properties for the design system (~125 lines, mostly duplicated between `:root` and `@theme inline`)
- Scroll reveal animation keyframes (~35 lines)
- Scroll reveal data attribute selectors (~25 lines)
- Reduced motion media query (~10 lines)

**Issue**: CSS custom properties are defined twice -- once in `:root` (lines 9-66) and again in `@theme inline` (lines 68-125). The `@theme inline` block is Tailwind v4 syntax that makes the values available as Tailwind utilities, while `:root` makes them available as standard CSS variables. This duplication adds ~60 lines of CSS to the output. The `@theme inline` block alone would suffice if all usage goes through Tailwind utilities or `var()` references.

### 8.3 Hardcoded Color Values (Maintenance Concern)

Many components use hardcoded hex values instead of CSS variables:
- `text-[#451a03]` instead of `text-text-primary`
- `bg-[#f2ebe2]` instead of `bg-bg-surface`
- `border-[#d4c4b0]` instead of `border-border-default`

This does not affect performance, but it bypasses Tailwind's purging optimization -- each unique arbitrary value generates a separate CSS rule. With dozens of hardcoded values repeated across 90+ components, this inflates the CSS output modestly.

---

## 9. Third-Party Script Impact

### 9.1 Vercel Analytics and Speed Insights (Low Impact)

**File**: `src/app/layout.tsx:89-90`

```tsx
<Analytics />
<SpeedInsights />
```

Both are Vercel-provided, lazy-loaded, and minimal (~1-2KB each). They use `requestIdleCallback` or equivalent to avoid blocking rendering. No performance concern.

### 9.2 Supabase Auth on Every Page Load (High Impact)

As noted in Section 4.3, the `AuthProvider` and `BusinessAuthProvider` both call `supabase.auth.getUser()` on mount, which triggers network requests to Supabase Auth servers on every page navigation. For unauthenticated users (majority), these return empty/null responses but still incur:

- 2 HTTPS round-trips to Supabase (typically `*.supabase.co`)
- ~50-200ms per request depending on user location
- Blocking the `isLoading: true --> false` transition in auth state

### 9.3 No Other Third-Party Scripts

No Google Analytics, Facebook Pixel, chat widgets, or other third-party scripts detected. This is good for performance.

---

## 10. Bottleneck Ranking

### CRITICAL (Must Fix)

| # | Issue | Impact | Location |
|---|---|---|---|
| C1 | `getOffersWithBusinesses()` missing `cache()` wrapper | Multiple identical Supabase queries per request on city pages | `src/lib/data/offers.ts:62` |
| C2 | Root layout wraps all pages in 3 client context providers | ~15-25KB extra client JS + 2 auth network requests on every page load for all visitors | `src/app/layout.tsx:81-88` |
| C3 | `getCityDealCounts()` fetches entire offers table on homepage | Full table scan with business joins on the most visited page | `src/lib/data/unified.ts:257` |

### HIGH (Should Fix)

| # | Issue | Impact | Location |
|---|---|---|---|
| H1 | Two-query waterfall in city-filtered offers | 100-300ms extra latency on every city-scoped page | `src/lib/data/offers.ts:71-83` |
| H2 | `getOfferCategories()` fetches all rows to count in JS | Unnecessary data transfer, should use SQL aggregation | `src/lib/data/offers.ts:120-143` |
| H3 | 54 client components use `@phosphor-icons/react` barrel import | Larger client chunks than necessary | Multiple files |
| H4 | Metadata generation functions re-derive data already computed | `getDealCountForCitySlug` and `getMinPriceForCitySlug` both call `getDealsForCitySlug` | `src/app/deals/[[...slugs]]/page.tsx:121-130` |

### MEDIUM (Should Consider)

| # | Issue | Impact | Location |
|---|---|---|---|
| M1 | Homepage components unnecessarily marked `'use client'` | Extra client JS for static content (scroll animations) | `src/components/features/homepage/*.tsx` |
| M2 | Mock data modules still imported in production pages | Dead code in server bundles | `src/lib/mock-data/` (19 files) |
| M3 | CSS custom properties duplicated between `:root` and `@theme inline` | Slightly larger CSS output | `src/app/globals.css:9-125` |
| M4 | No image placeholders (`placeholder="blur"`) on deal cards | Images pop in without progressive loading | `src/components/patterns/blurredImage.tsx` |
| M5 | `BusinessAuthProvider` re-hydrates on visibility change | Additional Supabase calls on every tab focus | `src/lib/context/businessAuthContext.tsx:182-187` |

### LOW (Nice to Have)

| # | Issue | Impact | Location |
|---|---|---|---|
| L1 | 8 font weight variants loaded (4 per font) | ~60-100KB extra font weight if not all used | `src/app/layout.tsx:12-26` |
| L2 | `useScrolled` hook adds scroll listener without throttle | High-frequency scroll handler on every page | `src/lib/hooks/useScrolled.ts` |
| L3 | Hardcoded hex values in Tailwind classes | Slightly inflated CSS output | Multiple components |

---

## 11. Baseline Metrics Estimates

Based on the architectural analysis, estimated performance characteristics for key user journeys:

### Homepage (`/`)

| Metric | Estimate | Bottleneck |
|---|---|---|
| TTFB | 200-500ms | ISR cache hit: <100ms; cache miss: 3 Supabase queries (featured offers, categories, city deal counts) |
| LCP | 1.5-3.0s | Hero background image (priority preload helps, but PNG source requires server optimization) |
| FID/INP | 100-300ms | 3 context providers hydrating + 2 auth network calls on mount |
| CLS | <0.05 | Font swap + proper font stack minimizes shift |
| Client JS | 150-250KB gzip | React + 3 context providers + Supabase browser client + icons + homepage client components |

### City Deals Page (`/deals/[city]`)

| Metric | Estimate | Bottleneck |
|---|---|---|
| TTFB | 300-800ms | ISR miss: resolveRoute() + getDealsForCitySlug() (2-query waterfall) + getBusinessCountForCity() + metadata queries |
| LCP | 1.0-2.0s | Text content (no heavy images on initial viewport) |
| FID/INP | 100-250ms | CityDealsPage is a client component with filter state |
| Client JS | 130-200KB gzip | React + contexts + CityDealsPage + FilterPanel + DealsGrid + DealCard |

### Treatment Category Page (`/treatments/[category]`)

| Metric | Estimate | Bottleneck |
|---|---|---|
| TTFB | 200-500ms | ISR miss: getUnifiedCategories() + getDealsByDbCategorySlug() + getUnifiedCities() |
| LCP | 0.8-1.5s | Text-based hero section |
| FID/INP | 50-100ms | Mostly server-rendered, minimal client interactivity |
| Client JS | 100-150KB gzip | React + contexts + DealCard (client) |

### Provider Page (`/[state]/[city]/provider/[slug]`)

| Metric | Estimate | Bottleneck |
|---|---|---|
| TTFB | <100ms | SSG (pre-rendered at build time) |
| LCP | 0.5-1.0s | Static HTML, fast |
| FID/INP | 50-100ms | Minimal client components (DealCard only) |
| Client JS | 100-150KB gzip | React + contexts + DealCard |

---

## 12. Critical User Journey Hot Paths

### Hot Path 1: Anonymous User Lands on Homepage

```
1. Server: ISR cache check
2. If miss: Promise.all([
     getFeaturedOffers(6)        --> Supabase query (offers + business join, ordered by discount_percent)
     getOfferCategories()        --> Supabase query (ALL offer service_categories, counted in JS)
     getCityDealCounts()         --> getOffersWithBusinesses() with NO FILTER (ALL offers + business join)
                                     then groups by city in JS
   ])
3. HTML streamed to client
4. Client hydration begins:
   - AuthProvider mounts --> creates Supabase browser client --> calls getUser() (network request)
   - BusinessAuthProvider mounts --> creates another Supabase browser client --> calls getUser() (network request)
   - ClaimsProvider mounts --> checks authState.user --> no-op for anon
   - GlobalHeader mounts --> useScrolled listener attached, usePathname resolved
   - HeroSection mounts --> setState(true) triggers entrance animation
   - TrendingDealsSection, CategoryGrid, CityGrid, SocialProofSection mounts --> ScrollReveal observers attached
5. Total JS parsed and executed: ~150-250KB gzip
6. Total network requests on mount: 2 (Supabase auth) + analytics
```

**Optimization opportunity**: Steps 4a and 4b (auth calls) are wasted for anonymous users. Deferring auth context to authenticated routes would eliminate ~15-25KB of client JS and 2 network requests for the vast majority of visitors.

### Hot Path 2: User Navigates to City Deals

```
1. Client-side navigation triggered (Next.js router)
2. Server: ISR cache check for /deals/[city]
3. If miss:
   a. resolveRoute([city]) --> getUnifiedCities() --> getBusinessCities() --> Supabase RPC or full scan
   b. generateMetadata:
      - getDealCountForCitySlug() --> getDealsForCitySlug() --> getCityNameFromSlug() --> getBusinessCities() [cached]
                                       --> getDealsByCity() --> getOffersWithBusinesses({city})
                                           --> Query 1: business_ids for city
                                           --> Query 2: offers for those business_ids
      - getBusinessCountForCity() --> getBusinesses(city) --> Supabase query
      - getMinPriceForCitySlug() --> getDealsForCitySlug() [cached by React cache()]
   c. Page render:
      - getDealsForCitySlug() [cached]
      - getUnifiedCities() [cached]
      - getBusinessCountForCity() [cached]
4. CityDealsPage (client component) hydrates with initialDeals prop
```

**Key finding**: Without `cache()` on `getOffersWithBusinesses()`, the 2-query waterfall could execute multiple times. With `cache()` on `getDealsForCitySlug`, the deals themselves are cached within the request, but the underlying `getOffersWithBusinesses` calls from different entry points (e.g., `getCityDealCounts` on homepage vs `getDealsForCitySlug` on deals page) are not deduplicated.

---

## Appendix: File Reference Index

| File | Key Concern |
|---|---|
| `src/app/layout.tsx` | Root layout with 3 client context providers wrapping all pages |
| `src/app/page.tsx` | Homepage -- ISR, 3 parallel Supabase fetches, `getCityDealCounts()` full scan |
| `src/app/deals/[[...slugs]]/page.tsx` | Deals routing -- redundant metadata queries, 2-query city waterfall |
| `src/lib/data/offers.ts` | Core data layer -- `getOffersWithBusinesses()` missing cache, city waterfall |
| `src/lib/data/unified.ts` | Aggregation layer -- `getCityDealCounts()` full table fetch |
| `src/lib/data/businesses.ts` | Business queries -- `getBusinessCities()` fallback full scan |
| `src/lib/context/authContext.tsx` | Auth provider -- 449 lines, Supabase client + getUser on every page |
| `src/lib/context/businessAuthContext.tsx` | Business auth -- duplicate Supabase client, visibility change re-fetch |
| `src/lib/context/claimsContext.tsx` | Claims provider -- depends on auth, fetches claims on auth change |
| `src/components/layout/globalHeader.tsx` | Client header on every page -- auth modal dynamic import (good) |
| `src/components/features/dealCard.tsx` | Client component with barrel icon imports |
| `src/components/features/homepage/heroSection.tsx` | Client component for entrance animation only |
| `src/app/globals.css` | Duplicated CSS vars, scroll animation keyframes |
| `next.config.ts` | Image optimization (good), package import optimization (good) |
| `src/lib/mock-data/` | 19 files of dead data still imported by production pages |
