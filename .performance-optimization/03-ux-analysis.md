# CostFinders v2 -- UX Performance Analysis

**Date**: 2026-03-21
**Scope**: Full application -- Next.js 16 SSG/ISR site, Supabase backend, Cloudinary images, Vercel hosting
**Methodology**: Static code analysis of all page files, components, data layer, font loading, image handling, client-side interactivity, loading states, and error boundaries.

---

## Table of Contents

1. [Architecture Performance Profile](#1-architecture-performance-profile)
2. [Core Web Vitals Risk Analysis by User Journey](#2-core-web-vitals-risk-analysis-by-user-journey)
3. [Cross-Cutting Performance Issues](#3-cross-cutting-performance-issues)
4. [Business Impact Assessment](#4-business-impact-assessment)
5. [Prioritized Improvement Opportunities](#5-prioritized-improvement-opportunities)

---

## 1. Architecture Performance Profile

### Rendering Strategy

| Route | Strategy | Revalidation | Data Source |
|---|---|---|---|
| `/` (Homepage) | ISR | 3600s (1hr) | Supabase: `getFeaturedOffers`, `getOfferCategories`, `getCityDealCounts` |
| `/deals/[[...slugs]]` | ISR | 3600s (1hr) | Supabase: multiple queries per route type |
| `/treatments` | ISR | 86400s (24hr) | Supabase: `getUnifiedCategories` |
| `/treatments/[category]` | ISR | 3600s (1hr) | Supabase: `getDealsByDbCategorySlug`, `getUnifiedCities` |
| `/[state]/[city]/provider/[slug]` | SSG via `generateStaticParams` | Build-time | Supabase: `getProvidersByCity`, `getDealsForBusiness` |
| `/guides/[slug]` | SSG via `generateStaticParams` | 86400s (24hr) | Supabase + local JSON |

**Positive**: ISR and SSG are used appropriately. Pages are pre-rendered, meaning TTFB on Vercel's CDN will be fast for cached pages. The `revalidate` values are reasonable.

**Risk**: ISR cache misses (first request after revalidation window, or cold cache on new deployments) trigger full server-side rendering with live Supabase queries. These requests will be measurably slower.

### Client-Side JavaScript Budget

The root layout (`src/app/layout.tsx`) wraps the entire application in three nested client-side context providers:

```
AuthProvider > BusinessAuthProvider > ClaimsProvider
```

**Every page load** initializes all three providers, each performing:
- `AuthProvider`: Creates a Supabase browser client, calls `supabase.auth.getUser()`, fetches profile via server action, fetches saved deals via server action, subscribes to `onAuthStateChange`.
- `BusinessAuthProvider`: Similar pattern with business-specific auth.
- `ClaimsProvider`: Fetches claims when authenticated.

This creates a waterfall of network requests on every initial page load, even for anonymous users who will never use these features.

### Font Loading

- **Sora**: 4 weights (400, 500, 600, 700), `preload: true`, `display: 'swap'`
- **Manrope**: 4 weights (400, 500, 600, 700), `preload: false`, `display: 'swap'`

**Assessment**: `display: 'swap'` is correct for preventing FOIT (Flash of Invisible Text). Loading 4 weights of Sora with preload will add approximately 40-80KB of font data to the critical path. Manrope as fallback with `preload: false` is a reasonable choice. However, 4 weights per font is aggressive -- most pages only use 2-3 weights visibly.

### Image Handling

**Configuration** (`next.config.ts`):
- Formats: `['image/avif', 'image/webp']` -- correct, AVIF provides the best compression.
- `minimumCacheTTL: 31536000` (1 year) -- optimal for immutable images.
- Remote patterns: `*.cloudinary.com` configured.

**Local Image Sizes** (from `public/images/homepage/`):
- `hero-bg.png`: 637KB
- `value-props-bg.png`: 697KB
- `city-1.png` through `city-4.png`: 892KB to 1.0MB each
- `business-cta.png`: 870KB
- `treatments-hero.png`: 795KB

These are all PNGs. Next.js Image Optimization will convert them to AVIF/WebP on first request, but the source files are unnecessarily large. The hero background image (637KB PNG) will be the LCP element on the homepage.

---

## 2. Core Web Vitals Risk Analysis by User Journey

### Journey 1: Homepage (`/`)

**Page file**: `src/app/page.tsx`
**Rendering**: ISR (server component), 3600s revalidation
**Components**: HeroSection, TrendingDealsSection, CategoryGrid, CityGrid, ValuePropsSection, SocialProofSection, BusinessCtaSection

#### LCP (Largest Contentful Paint)

**Risk: MODERATE-HIGH**

The LCP element is the hero background image (`/images/homepage/hero-bg.png`, 637KB) rendered via `next/image` with `priority` and `fill`:

```tsx
// src/components/features/homepage/heroSection.tsx:29-36
<Image
  src="/images/homepage/hero-bg.png"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  priority
/>
```

**Concerns**:
1. The `priority` attribute is correctly set, which adds a `<link rel="preload">` hint. This is good.
2. However, the hero text (h1: "Don't overpay for medspa treatments") starts hidden with `opacity-0 translate-y-6` and only becomes visible after a `mounted` state triggers via `useEffect`. This means the actual visible text content is delayed by one render cycle (approximately 50-100ms) after hydration.
3. The HeroSection is a `'use client'` component. This means the browser must download, parse, and execute the component's JavaScript before any content renders. The server sends the initial HTML, but the entrance animations create a flash of invisible content.
4. The image uses `sizes="100vw"` which is correct for a full-bleed hero.

**Estimated LCP risk**: On cached ISR pages, LCP should be 1.5-2.5s on 4G connections (image load dominates). On ISR cache miss, add 200-500ms for Supabase queries.

#### FID/INP (Interaction to Next Paint)

**Risk: MODERATE**

1. The GlobalHeader (`src/components/layout/globalHeader.tsx`) is a `'use client'` component that renders on every page. It uses `useAuth()` which subscribes to auth state changes and runs `useScrolled()` with a scroll event listener. The scroll listener uses `{ passive: true }` which is correct.
2. The category chips in the hero section are standard `<Link>` components -- no interactivity concerns.
3. The three root context providers (`AuthProvider`, `BusinessAuthProvider`, `ClaimsProvider`) all run async operations on mount. While these don't block the main thread directly, they create async waterfall that can delay responsiveness if auth state resolution is slow.

**Primary INP concern**: The `SaveButton` component inside each `DealCard` calls `useAuth()`, which means every card in the TrendingDealsSection is coupled to the auth context. A state change in any auth-related operation re-renders every visible deal card.

#### CLS (Cumulative Layout Shift)

**Risk: MODERATE**

1. **Font swap**: Sora uses `display: 'swap'`, which means text renders in a fallback system font first, then shifts when Sora loads. The metric difference between system-ui and Sora glyphs will cause measurable CLS, especially in the hero headline text which is large (text-4xl to text-6xl).
2. **Entrance animations**: All homepage sections use scroll-reveal animations that start with `opacity: 0`. The CSS rule `[data-scroll-reveal] { opacity: 0; }` means content below the fold is invisible until IntersectionObserver triggers. This is generally safe for CLS since below-fold shifts don't count, but the hero badge and headline animations (`opacity-0 translate-y-6` to `opacity-100 translate-y-0`) do shift within the viewport on initial load.
3. **City grid images**: Each city card uses `next/image` with `fill` inside a fixed-height container (`h-40 sm:h-44`). The containers have explicit dimensions, so image loading should not cause CLS. Correct.
4. **Header**: Fixed position header with `h-16` and content uses `pt-16` for clearance. This is correctly handled.

**Primary CLS risk**: Font swap on the hero headline. The `translate-y` entrance animations also technically contribute to CLS if they fire during the LCP measurement window.

---

### Journey 2: Deals Listing (`/deals/[city-slug]`)

**Page file**: `src/app/deals/[[...slugs]]/page.tsx`
**Rendering**: ISR (server component), 3600s revalidation
**Key component**: `CityDealsPage` (`src/components/features/deals/cityDealsPage.tsx`) -- `'use client'`

#### LCP

**Risk: LOW-MODERATE**

The LCP element is likely the page heading ("Medspa Deals in {cityName}") or the first deal card, both of which are text-based. There is no hero image on this page. The server component fetches all deals via `getDealsForCitySlug` and passes them as `initialDeals` to the client component, so data is available on first render.

**Concern**: For cities with many deals (the full `getDealsForCitySlug` path involves `getOffersWithBusinesses` which does a two-step Supabase query -- first fetch business IDs by city, then fetch offers filtered by those IDs), ISR cache misses could add 300-800ms.

#### FID/INP

**Risk: MODERATE-HIGH**

The `CityDealsPage` is entirely a `'use client'` component with:
- Category filter state (`selectedCategory`)
- Price filter state (`filters`)
- Sort state (`sortBy`)
- `useMemo` for filtering/sorting all deals on every state change
- `useRouter()` for navigation

**Key concern**: When the user changes a category filter, this triggers `router.push()` to navigate to a treatment+city page (`/deals/${category}/${citySlug}`), which is a full navigation rather than client-side filtering. This creates a noticeable delay because it's a server-rendered page transition, not an instant filter toggle. The mixed interaction model (local state for price filters, server navigation for category changes) creates inconsistent perceived performance.

Each `DealCard` in the grid is a `'use client'` component that renders a `SaveButton` (requires auth context) and a `BlurredImage` (with Cloudinary blur effect). With 30-50+ deals per city, this creates a significant component tree.

#### CLS

**Risk: LOW**

The loading skeleton (`src/app/deals/loading.tsx`) dimensions match the actual content structure reasonably well. No hero images to cause shifts. The filter panel and category filter are rendered in fixed-height containers.

---

### Journey 3: Treatment Category Page (`/treatments/[category]`)

**Page file**: `src/app/treatments/[category]/page.tsx`
**Rendering**: ISR (server component), 3600s revalidation

#### LCP

**Risk: LOW**

Pure text/icon content. The LCP element is the hero card with the category icon, title, and stats. No images. The server component fetches deals and categories from Supabase in sequence (not parallelized -- see below).

**Data loading concern**: The page makes sequential queries:
1. `getUnifiedCategories()` -- to find the category
2. `getDealsByDbCategorySlug(categorySlug)` -- to get deals
3. `getUnifiedCities()` -- to build related links

These are not wrapped in `Promise.all()`. On ISR cache miss, this waterfall adds latency.

#### FID/INP

**Risk: LOW**

This is a server-rendered page with minimal client-side interactivity. The `DealCard` components are `'use client'` but the page itself is a server component. The FAQ accordion (`Faq` component) is a `'use client'` component using disclosure pattern.

#### CLS

**Risk: LOW**

No images, fixed-dimension containers, server-rendered content.

---

### Journey 4: Provider Profile (`/[state]/[city]/provider/[slug]`)

**Page file**: `src/app/[state]/[city]/provider/[slug]/page.tsx`
**Rendering**: SSG via `generateStaticParams`, fully static at build time

#### LCP

**Risk: LOW**

Text-based hero with provider name, rating, and stats. No images in the hero section. Deal cards below use `DealCard` with blurred images, but these are below the fold.

**Build-time concern**: The `generateStaticParams` function fetches all cities, then fetches all providers per city. This is already parallelized with `Promise.all()`, which is correct. However, for each provider page, the page component then makes additional sequential calls: `getUnifiedCities()`, `getProvidersByCity()`, `getDealsForBusiness()`. At build time this is acceptable; the pages are fully static.

#### FID/INP

**Risk: LOW**

Minimal client interactivity. The `DealCard` components and `DealSidebar` are client components, but the page is static.

#### CLS

**Risk: LOW**

Static content, no dynamic image loading in the viewport, fixed header clearance.

---

### Journey 5: Pricing Guides (`/guides/[slug]`)

**Page file**: `src/app/guides/[slug]/page.tsx`
**Rendering**: SSG via `generateStaticParams`, 86400s revalidation

#### LCP

**Risk: LOW**

The `PricingStatsHero` component is the primary above-fold element. It renders pricing statistics (min/max/avg prices) as text. No images. Data is fetched at build time from Supabase.

The page makes two parallel data fetches: `getGuidePricingStats` and `getGuideDealsPreview` via `Promise.all()` -- this is correct.

#### FID/INP

**Risk: LOW**

Content-heavy page with minimal interactivity. The FAQ section uses client-side disclosure toggles. The `GuideCta` section has navigation links. No complex state management.

#### CLS

**Risk: LOW**

Text content rendered server-side, no images in the critical path, consistent layout.

---

### Journey 6: Treatments Index (`/treatments`)

**Page file**: `src/app/treatments/page.tsx`
**Rendering**: ISR, 86400s revalidation
**Key component**: `TreatmentsPageContent` (`src/components/features/treatments/treatmentsPageContent.tsx`) -- `'use client'`

#### LCP

**Risk: MODERATE**

The LCP element is the hero section background image (`/images/treatments-hero.png`, 795KB) rendered with `priority`:

```tsx
// src/components/features/treatments/treatmentsPageContent.tsx:102-109
<Image
  src="/images/treatments-hero.png"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  priority
/>
```

Same pattern as the homepage hero: full-bleed image with priority preload. The 795KB source PNG will be optimized to AVIF/WebP by Next.js, but still represents a significant LCP resource.

Additionally, the hero headline uses the same `mounted` state pattern for entrance animations, delaying text visibility by one render cycle.

#### FID/INP

**Risk: LOW**

The category cards use `ScrollRevealItem` with IntersectionObserver. The cards themselves are `<Link>` elements with no complex click handlers.

#### CLS

**Risk: MODERATE**

Font swap CLS risk in the hero headline (same as homepage). The entrance animations in the hero section use `opacity-0 translate-y-6` transitions.

---

## 3. Cross-Cutting Performance Issues

### Issue 1: Root-Level Client Context Provider Waterfall

**Severity: HIGH**
**Files**: `src/app/layout.tsx`, `src/lib/context/authContext.tsx`, `src/lib/context/businessAuthContext.tsx`, `src/lib/context/claimsContext.tsx`

Every page load initializes three nested context providers:

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

On mount, `AuthProvider` fires:
1. `createSupabaseBrowserClient()` -- creates a Supabase client
2. `supabase.auth.getUser()` -- network request to Supabase Auth
3. `getProfileAction()` -- server action (network request)
4. `getSavedDealsAction()` -- server action (network request)
5. `supabase.auth.onAuthStateChange()` -- subscribes to auth events

For anonymous users (the majority of organic search traffic), requests 2-4 still execute and return empty results. This burns approximately 200-400ms of client-side time on every page load for no functional benefit.

`ClaimsProvider` depends on `AuthProvider` -- it re-fetches claims whenever `authState.user` changes, creating a cascading re-render chain.

### Issue 2: Excessive `'use client'` Boundaries

**Severity: MODERATE**
**Scope**: 77 files with `'use client'` directive across `src/components/`

Several components are marked `'use client'` solely because they use scroll-reveal animations or entrance transitions:
- `heroSection.tsx` -- uses `useState`/`useEffect` only for `mounted` animation state
- `trendingDealsSection.tsx` -- only uses `ScrollRevealItem` (IntersectionObserver)
- `categoryGrid.tsx` -- only uses `ScrollRevealItem`
- `cityGrid.tsx` -- only uses `ScrollRevealItem`
- `valuePropsSection.tsx` -- only uses `useScrollReveal`
- `socialProofSection.tsx` -- only uses `ScrollReveal` + `AnimatedCounter`
- `businessCtaSection.tsx` -- only uses `ScrollReveal`

Every `'use client'` component requires its JavaScript to be shipped to and executed by the browser. The homepage loads 7 client components solely for entrance animations. If these animations were implemented via CSS-only (using `@starting-style` or scroll-driven animations), the components could remain server components, reducing JavaScript bundle size.

### Issue 3: DealCard as Client Component

**Severity: MODERATE**
**File**: `src/components/features/dealCard.tsx`

`DealCard` is `'use client'` because it imports `SaveButton`, which uses `useAuth()`. On pages displaying 20-50 deal cards (deals listing pages), this means:
- Every card requires client-side hydration
- Every card is coupled to the auth context, meaning auth state changes re-render all visible cards
- The `BlurredImage` component renders an image with `blur-xl scale-110` CSS filter, which is GPU-intensive on lower-end devices

The `SaveButton` functionality is only useful for authenticated users. For anonymous users (the majority), the button is disabled with a tooltip. This means the entire `DealCard` tree is forced into the client bundle for a feature most users cannot use.

### Issue 4: Image Asset Size and Format

**Severity: MODERATE**
**Directory**: `public/images/`

| Image | Size | Used On | Loaded |
|---|---|---|---|
| `hero-bg.png` | 637KB | Homepage hero | `priority` (preloaded) |
| `treatments-hero.png` | 795KB | Treatments index | `priority` (preloaded) |
| `value-props-bg.png` | 697KB | Homepage "How it works" | `lazy` |
| `city-1.png` through `city-4.png` | 892KB-1.0MB each | Homepage city grid | `lazy` |
| `business-cta.png` | 870KB | Homepage CTA section | `lazy` |
| `deals-hero.png` | 1.0MB | Deals hero (if used) | Unknown |

Total uncompressed PNG weight for the homepage: approximately 5.9MB across 8 images. While Next.js Image Optimization will compress these significantly (typically 60-80% reduction for AVIF), the source files should be pre-optimized to:
- Reduce build-time processing
- Reduce the source size served to browsers that don't support AVIF/WebP
- Reduce Vercel Image Optimization costs

### Issue 5: Supabase Query Patterns

**Severity: MODERATE**
**Files**: `src/lib/data/offers.ts`, `src/lib/data/businesses.ts`, `src/lib/data/unified.ts`

Several query patterns are suboptimal:

1. **City-based deal filtering** (`getOffersWithBusinesses` in `offers.ts:62-118`): When filtering by city, the function first queries `master_business_info` to get business IDs, then queries `promo_offer_master` filtered by those IDs. This is a two-query waterfall that could be replaced by a Supabase RPC function or a view joining the tables.

2. **Category counting** (`getOfferCategories` in `offers.ts:120-143`): Fetches ALL offer rows to count categories client-side. This should be a `GROUP BY` query or an RPC call. For 347 offers this is tolerable, but it fetches all `service_category` values and counts in JavaScript rather than SQL.

3. **Sequential queries on treatment category pages** (`treatments/[category]/page.tsx`): `getUnifiedCategories()`, `getDealsByDbCategorySlug()`, and `getUnifiedCities()` are called sequentially rather than via `Promise.all()`.

4. **React `cache()` usage**: Functions like `getUnifiedCities`, `getBusinesses`, `getOfferCategories` use React `cache()` correctly, which deduplicates calls within a single render pass. This mitigates the sequential query issue partially when the same data is needed by both `generateMetadata` and the page component.

### Issue 6: Missing Loading States for Sub-Routes

**Severity: LOW**
**Coverage**:
- `/` -- has `src/app/loading.tsx` (generic skeleton)
- `/deals/` -- has `src/app/deals/loading.tsx` (deals-specific skeleton)
- `/treatments/` -- has `src/app/treatments/loading.tsx` (category skeleton)
- `/treatments/[category]` -- NO dedicated loading state (falls through to `/treatments/loading.tsx`)
- `/[state]/[city]/provider/[slug]` -- NO loading state
- `/guides/[slug]` -- NO loading state

Missing loading states means that on ISR cache misses or slow navigations, users see either the generic skeleton or nothing (depending on navigation method). Since provider pages are SSG, this is less of a concern. Guide pages are also SSG but have 24hr revalidation.

### Issue 7: GlobalHeader is `'use client'` with Image

**Severity: LOW**
**File**: `src/components/layout/globalHeader.tsx`

The fixed header renders on every page and includes:
- `next/image` for the logo (`/icon.png`, 384KB source -- extremely large for a 36x36px icon)
- `usePathname()` for conditional rendering
- `useAuth()` context consumption
- `useScrolled()` scroll listener
- `dynamic()` import for AuthModal

The 384KB `icon.png` file for a 36x36px display is 100x larger than needed. At that display size, the image should be 5-15KB maximum.

### Issue 8: Entrance Animation Delay Pattern

**Severity: LOW**
**Files**: `heroSection.tsx`, `treatmentsPageContent.tsx`

Both hero sections use this pattern:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])

// Then:
className={`... ${mounted ? 'opacity-100' : 'opacity-0'} ...`}
```

This creates a two-phase render:
1. Server renders HTML with `opacity-0` classes (content invisible)
2. Client hydrates, runs `useEffect`, sets `mounted=true`, re-renders with `opacity-100`

The content is invisible for approximately 50-150ms after HTML arrives, which degrades perceived performance and can negatively impact LCP if the hidden text is the LCP element.

---

## 4. Business Impact Assessment

### Conversion Funnel Impact (Ranked by Severity)

#### 1. Homepage Load Speed -- CRITICAL

The homepage is the primary landing page for organic search traffic and paid campaigns. Performance issues here directly impact bounce rate and deal discovery.

- **LCP at 1.5-2.5s**: Acceptable for 4G but marginal. Google considers LCP > 2.5s as "Needs Improvement". The hero image (637KB PNG) is the bottleneck.
- **Client-side context providers**: Add 200-400ms of unnecessary JavaScript execution for anonymous users (the majority of organic traffic).
- **Entrance animations**: Hero text is invisible for 50-150ms after HTML arrives, creating a "flash of invisible content" that makes the page feel slower than it is.

**Business impact**: Every 100ms of load time improvement correlates with approximately 1% improvement in conversion rate for e-commerce-adjacent sites. The homepage likely loses 2-5% of potential users due to the combination of large hero image, client context overhead, and animation delays.

#### 2. Deals Listing Performance -- HIGH

This is the primary conversion page where users compare deals and click through to details. The `CityDealsPage` component's mixed interaction model (local price filters vs. server navigation for category changes) creates inconsistent performance:

- Category filter changes trigger full page navigations (300-800ms), while price filter changes are instant (client-side).
- 20-50 DealCards, each a `'use client'` component with auth context dependency, create a heavy hydration cost.

**Business impact**: Users comparing deals across categories will experience noticeable lag on category switches. This friction directly reduces the number of deals viewed per session, lowering claim conversion rates.

#### 3. Deal Detail Page -- MODERATE

The deal detail page (`DealDetailPage`) is where conversion (deal claiming) happens. The `DealSidebar` and `ClaimCTA` components depend on auth context, which means the "Claim" button state may flash between loading/disabled/enabled states as auth resolves.

**Business impact**: The claim flow depends on `ClaimsProvider` and `AuthProvider` both being resolved. On slower connections, the claim button may appear disabled for 200-500ms before auth state resolves, potentially confusing users.

#### 4. Provider Profile -- LOW

Provider pages are fully SSG and load fast. These pages primarily serve SEO purposes (location-based search) and funnel users to deal pages.

#### 5. Pricing Guides -- LOW

Content-heavy pages that serve SEO purposes. Performance is not a conversion concern here; users are in research mode, not transactional mode.

---

## 5. Prioritized Improvement Opportunities

### Priority 1 (High Impact, Low Effort)

#### P1-A: Optimize Source Image Assets

**Impact**: LCP improvement of 200-500ms on homepage and treatments page
**Effort**: 1-2 hours
**Files**: `public/images/`

Actions:
- Convert all PNG source files to WebP or optimized JPEG. The hero-bg.png at 637KB can likely be reduced to 80-150KB as WebP.
- Resize `icon.png` (384KB) to a proper 72x72px (2x for 36px display) WebP file, reducing to approximately 5-10KB.
- Pre-optimize city images (currently 892KB-1.0MB each) to 100-200KB WebP.
- Consider using `<picture>` with explicit `srcset` for hero images to avoid reliance on Next.js runtime optimization.

#### P1-B: Defer Auth Context for Anonymous Users

**Impact**: 200-400ms reduction in TTI for all pages
**Effort**: 4-6 hours
**Files**: `src/app/layout.tsx`, `src/lib/context/authContext.tsx`

Actions:
- Move `AuthProvider`/`BusinessAuthProvider`/`ClaimsProvider` out of the root layout. Instead, wrap them only around routes that need authentication (dashboard, business dashboard, admin).
- For public pages, use a lightweight "lazy auth" provider that only initializes auth when the user interacts with auth-dependent features (clicking "Save", "Sign In", etc.).
- Or: keep the providers but defer the `hydrateUser()` call using `requestIdleCallback` or a short timeout, so it doesn't compete with initial render.

#### P1-C: Fix Entrance Animation LCP Penalty

**Impact**: 50-150ms perceived LCP improvement
**Effort**: 2-3 hours
**Files**: `src/components/features/homepage/heroSection.tsx`, `src/components/features/treatments/treatmentsPageContent.tsx`

Actions:
- Remove the `mounted` state pattern. Instead, use CSS `@starting-style` (supported in Chrome 117+, Safari 17.5+, Firefox 129+) or CSS `animation` with a short delay applied via the stylesheet rather than JavaScript.
- Alternatively, render the hero text server-side without the initial `opacity-0` state, and only apply animations to below-fold content. The hero should be instantly visible.

### Priority 2 (Moderate Impact, Moderate Effort)

#### P2-A: Convert Homepage Sections to Server Components

**Impact**: Reduce homepage JavaScript bundle by approximately 30-40%
**Effort**: 6-8 hours
**Files**: All homepage section components

Actions:
- Refactor scroll-reveal animations to use CSS `@scroll-timeline` or `animation-timeline: view()` (CSS scroll-driven animations). This eliminates the need for `IntersectionObserver` JavaScript and `'use client'` directives.
- If browser support is a concern, use a single thin client wrapper for the scroll-reveal behavior and keep the actual content as server components.
- The `TrendingDealsSection`, `CategoryGrid`, `CityGrid`, `ValuePropsSection`, `SocialProofSection`, and `BusinessCtaSection` can all become server components.

#### P2-B: Separate DealCard into Server and Client Parts

**Impact**: Reduce hydration cost on deal listing pages
**Effort**: 4-5 hours
**Files**: `src/components/features/dealCard.tsx`, `src/components/patterns/saveButton.tsx`

Actions:
- Create `DealCardServer` (server component) for the card structure, pricing, location, and rating.
- Keep `SaveButton` as a small, isolated client component.
- Use composition: render `DealCardServer` with a `SaveButton` slot from the parent.
- This way, only the save button hydrates on the client, not the entire card tree.

#### P2-C: Parallelize Treatment Category Page Queries

**Impact**: 100-300ms reduction on ISR cache miss
**Effort**: 1 hour
**File**: `src/app/treatments/[category]/page.tsx`

Change:
```tsx
const categories = await getUnifiedCategories()
const deals = await getDealsByDbCategorySlug(categorySlug)
const cities = await getUnifiedCities()
```

To:
```tsx
const [categories, deals, cities] = await Promise.all([
  getUnifiedCategories(),
  getDealsByDbCategorySlug(categorySlug),
  getUnifiedCities(),
])
```

#### P2-D: Add Loading States for Missing Routes

**Impact**: Improved perceived performance on navigation
**Effort**: 2-3 hours

Actions:
- Add `src/app/treatments/[category]/loading.tsx` with a deal grid skeleton
- Add `src/app/[state]/[city]/provider/[slug]/loading.tsx` with a provider profile skeleton
- Add `src/app/guides/[slug]/loading.tsx` with a content skeleton

### Priority 3 (Lower Impact, Worth Tracking)

#### P3-A: Optimize Supabase Query Patterns

**Impact**: 50-200ms per ISR cache miss
**Effort**: 4-8 hours (requires Supabase migration)

Actions:
- Create a Supabase database view or RPC function that joins `promo_offer_master` with `master_business_info` to eliminate the two-query pattern in `getOffersWithBusinesses`.
- Replace the client-side category counting in `getOfferCategories` with a proper SQL `GROUP BY` query.
- Consider Supabase Edge Functions for complex data aggregation.

#### P3-B: Reduce Font Weight Count

**Impact**: 10-30KB reduction in critical CSS
**Effort**: 1 hour

Actions:
- Audit which Sora weights are actually used. If only 400, 600, 700 are used, remove 500 from the font configuration.
- Same for Manrope.

#### P3-C: Implement `fetchPriority` on Hero Images

**Impact**: Potential 100-200ms LCP improvement
**Effort**: 30 minutes

Next.js Image with `priority` already sets `fetchPriority="high"`, but verify this in production. Also consider adding an explicit `<link rel="preload" as="image" fetchpriority="high">` in the layout for the hero image since its URL is known statically.

#### P3-D: Scroll Event Throttling in GlobalHeader

**Impact**: Minor INP improvement
**Effort**: 30 minutes
**File**: `src/lib/hooks/useScrolled.ts`

The `useScrolled` hook fires on every scroll event. While `{ passive: true }` prevents jank, the state update on every pixel of scroll is unnecessary. Add a simple threshold check or use `requestAnimationFrame` throttling:

```tsx
function handleScroll() {
  const isScrolled = window.scrollY > threshold
  if (isScrolled !== scrolledRef.current) {
    scrolledRef.current = isScrolled
    setScrolled(isScrolled)
  }
}
```

---

## Summary Risk Matrix

| Journey | LCP Risk | INP Risk | CLS Risk | Priority |
|---|---|---|---|---|
| Homepage | MODERATE-HIGH | MODERATE | MODERATE | P1 |
| Deals Listing | LOW-MODERATE | MODERATE-HIGH | LOW | P2 |
| Treatment Category | LOW | LOW | LOW | P3 |
| Provider Profile | LOW | LOW | LOW | P4 |
| Pricing Guides | LOW | LOW | LOW | P4 |
| Treatments Index | MODERATE | LOW | MODERATE | P2 |

**Top 3 Actions by Expected Impact**:
1. Optimize source image assets (P1-A) -- reduces LCP on the two highest-traffic pages
2. Defer auth context for anonymous users (P1-B) -- reduces TTI on every page
3. Fix entrance animation LCP penalty (P1-C) -- eliminates artificial content delay on highest-traffic pages
