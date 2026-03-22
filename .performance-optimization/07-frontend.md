# CostFinders v2 -- Frontend Performance Optimization Plan

**Date**: 2026-03-21
**Scope**: Bundle optimization, component splitting, critical rendering path, image optimization, font loading, CSS optimization, loading states, animation performance, third-party impact
**Depends on**: `03-ux-analysis.md` (issue inventory), `05-backend.md` (component boundary changes, provider architecture)

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Bundle Optimization](#2-bundle-optimization)
3. [Component Splitting & Code Splitting](#3-component-splitting--code-splitting)
4. [Critical Rendering Path](#4-critical-rendering-path)
5. [Image Optimization](#5-image-optimization)
6. [Font Loading Strategy](#6-font-loading-strategy)
7. [CSS Optimization](#7-css-optimization)
8. [Loading States & Streaming](#8-loading-states--streaming)
9. [Animation Performance](#9-animation-performance)
10. [Third-Party Impact](#10-third-party-impact)
11. [Resource Hints](#11-resource-hints)
12. [Implementation Plan & Expected Impact](#12-implementation-plan--expected-impact)

---

## 1. Current State Assessment

### Dependency Profile

| Dependency | node_modules Size | Client Impact | Notes |
|---|---|---|---|
| `@phosphor-icons/react` | 57MB | HIGH -- barrel imports in 100+ files | `optimizePackageImports` enabled but 100 files import from barrel |
| `@supabase/supabase-js` | 488KB | HIGH -- loaded on every page via providers | Two browser clients created per page load |
| `@vercel/analytics` | 620KB (source) | LOW -- ~1KB gzipped client script | Loads async, minimal impact |
| `@vercel/speed-insights` | 492KB (source) | LOW -- ~1.5KB gzipped client script | Loads async, minimal impact |
| `react` + `react-dom` | N/A | BASELINE -- ~45KB gzipped | React 19.2.3, unavoidable |
| `next` | N/A | BASELINE -- ~90KB gzipped (framework) | Next.js 16.1.1 |
| `schema-dts` | Minimal | ZERO -- types only | No client impact |

### Public Asset Weight

| Asset Category | Total Size | Format | Notes |
|---|---|---|---|
| Homepage images | 5.9MB | PNG | 7 images, all unoptimized PNGs |
| Treatments hero | 795KB | PNG | Priority-loaded on `/treatments` |
| Deals hero | 1.0MB | PNG | Loaded on deals pages |
| Business owner | 662KB | PNG | Used on business page |
| App icon (`icon.png`) | 384KB | PNG | Rendered at 36x36px (26x oversized) |
| **Total public/images** | **8.3MB** | PNG | All unoptimized |

### Client Component Count

- **Total `'use client'` files**: 125 across `src/`
- **Public-facing pages**: 77 client components in `src/components/`
- **Forced-client by animation**: 7 homepage sections, 1 treatments hero
- **Forced-client by SaveButton**: `DealCard` (used on 4+ page types, 20-50 instances each)
- **Root-level client providers**: 3 (AuthProvider, BusinessAuthProvider, ClaimsProvider)

### Estimated Current Bundle (Client JS, Gzipped)

| Component | Est. Gzipped Size | Ships To |
|---|---|---|
| React + React DOM | ~45KB | All pages |
| Next.js framework | ~90KB | All pages |
| Auth providers (3) + Supabase client (2) | ~15-25KB | All pages (root layout) |
| GlobalHeader + hooks | ~3-5KB | All pages |
| Homepage sections (7 client components) | ~8-15KB | Homepage |
| DealCard + SaveButton + BlurredImage | ~5-8KB | Every deal listing page |
| DealsGrid + FilterPanel + CategoryFilter | ~4-6KB | Deal listing pages |
| Phosphor Icons (tree-shaken via `optimizePackageImports`) | ~2-4KB per page | Varies |
| **Estimated total homepage** | **~170-190KB gzipped** | |
| **Estimated total deals listing** | **~175-200KB gzipped** | |

---

## 2. Bundle Optimization

### 2.1 Phosphor Icons: Barrel vs Tree-Shakeable Imports

**Current state**: 100 files import from `@phosphor-icons/react` (barrel), 23 files import from `@phosphor-icons/react/dist/ssr`.

**Mitigation**: `next.config.ts` already has `optimizePackageImports: ['@phosphor-icons/react']`, which instructs the bundler to tree-shake the barrel imports at build time. This is the correct Next.js approach and likely already prevents the full 57MB from being bundled.

**Remaining issue**: The barrel import creates a client component boundary even in files that could otherwise be server components. Server components should use the `/dist/ssr` path to avoid shipping any icon JavaScript.

**Before** (forces client rendering):
```tsx
'use client'
import { MapPin, Star } from '@phosphor-icons/react'
```

**After** (server-compatible):
```tsx
import { MapPin, Star } from '@phosphor-icons/react/dist/ssr'
```

**Files to convert** (public-facing server component candidates):

| File | Current Import | Icon Count |
|---|---|---|
| `homepage/heroSection.tsx` | Barrel (2 icons) | MagnifyingGlass, TrendUp |
| `homepage/trendingDealsSection.tsx` | Barrel (2 icons) | ArrowRight, Fire |
| `homepage/categoryGrid.tsx` | Barrel (6 icons) | Drop, FirstAid, Heart, Sparkle, Stethoscope, Syringe |
| `homepage/cityGrid.tsx` | Barrel (1 icon) | MapPin |
| `homepage/valuePropsSection.tsx` | Barrel (3 icons) | MagnifyingGlass, PiggyBank, Scales |
| `homepage/socialProofSection.tsx` | Barrel (4 icons) | CheckCircle, CurrencyDollar, ShieldCheck, Users |
| `homepage/businessCtaSection.tsx` | Barrel (2 icons) | ArrowRight, Storefront |
| `dealCard.tsx` | Barrel (6 icons) | Lock, MapPin, ShieldCheck, Sparkle, Star, Syringe |

**Expected savings**: ~2-4KB gzipped per page where components convert to server components (icons no longer require client-side JS).

### 2.2 Supabase Client De-duplication

**Current state**: Both `AuthProvider` and `BusinessAuthProvider` each call `createSupabaseBrowserClient()`, instantiating two separate Supabase browser clients. Each client includes the full `@supabase/supabase-js` runtime.

**Optimization**: This is addressed in `05-backend.md` Section 1.2 (route group layout splitting). When public pages no longer load auth providers, zero Supabase browser clients load on public pages.

**For authenticated routes**: Share a single Supabase browser client instance via a factory pattern:

```tsx
// src/lib/supabase/browser.ts
let browserClient: SupabaseClient | null = null

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClient
}
```

**Expected savings**: ~5-8KB gzipped (one fewer Supabase client instance).

### 2.3 Dynamic Import Candidates

Components that are rarely used or only needed after user interaction should use `next/dynamic`:

| Component | Current | Trigger | Dynamic Import Strategy |
|---|---|---|---|
| `AuthModal` | Already `dynamic()` in GlobalHeader | Click "Sign In" | Correct -- no change needed |
| `BottomSheet` | Static import | Mobile filter interaction | `dynamic(() => import(...), { ssr: false })` |
| `ClaimDealModal` | Static import | Click "Claim Deal" | `dynamic(() => import(...), { ssr: false })` |
| `BusinessSearchModal` | Static import | Click "Search Business" | `dynamic(() => import(...), { ssr: false })` |
| `NotificationPanel` | Static import | Click bell icon | `dynamic(() => import(...), { ssr: false })` |

**Expected savings**: ~3-5KB gzipped per page (deferred until interaction).

### 2.4 Next.js Config Optimization

**Current `next.config.ts`**:
```ts
experimental: {
  optimizePackageImports: ['@phosphor-icons/react', '@supabase/supabase-js'],
}
```

**Recommended additions**:
```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.cloudinary.com' }],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200],     // Remove 1920, 2048, 3840 -- not needed
    imageSizes: [16, 32, 48, 64, 96, 128, 256],   // Add 128 for medium thumbnails
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', '@supabase/supabase-js'],
  },
  compress: true,  // Ensure gzip compression is enabled (default in Next.js, but explicit)
}
```

The `deviceSizes` reduction prevents Next.js Image Optimization from generating unnecessarily large variants. The largest container in the app is `max-w-7xl` (1280px), so images above 1200px device width are waste.

---

## 3. Component Splitting & Code Splitting

### 3.1 DealCard: Server/Client Split

**Problem**: `DealCard` (206 lines, `'use client'`) is forced into client rendering by `SaveButton`, which calls `useAuth()`. On deal listing pages with 20-50 cards, this means the entire card tree hydrates client-side.

**Architecture change**:

```
BEFORE:
DealCard ('use client', 206 lines)
├── BlurredImage (server-compatible but dragged into client)
├── SaveButton ('use client', requires useAuth)
├── Badge (server-compatible)
└── Card (server-compatible -- no onClick/state)

AFTER:
DealCard (server component, ~180 lines)
├── BlurredImage (already server-compatible -- uses /dist/ssr icons)
├── SaveButton ('use client' island, ~78 lines)
├── Badge (server component)
└── Card (server component)
```

**Before** (`dealCard.tsx`):
```tsx
'use client'
import { Lock, MapPin, ShieldCheck, Sparkle, Star, Syringe } from '@phosphor-icons/react'
import { BlurredImage } from '@/components/patterns/blurredImage'
import { SaveButton } from '@/components/patterns/saveButton'
// ... 206 lines of client component
```

**After** (`dealCard.tsx`):
```tsx
// NO 'use client' directive
import { Lock, MapPin, ShieldCheck, Sparkle, Star, Syringe } from '@phosphor-icons/react/dist/ssr'
import { BlurredImage } from '@/components/patterns/blurredImage'
import { SaveButton } from '@/components/patterns/saveButton' // remains 'use client'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AnonymousDeal } from '@/types/deal'

export function DealCard({ deal, variant = 'grid' }: DealCardProps) {
  // Same rendering logic, but server-rendered
  // SaveButton is a client island automatically
  return (
    <Card variant="glass" padding="none" hover>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <SaveButton dealId={deal.id} size="sm" />
        {/* badges... */}
      </div>
      {/* Static content -- all server-rendered */}
    </Card>
  )
}
```

**Prerequisite**: The `Card` component is already a server component (no `'use client'` directive). The `hover` prop uses only CSS classes (`hover:border-... hover:shadow-...`). The `onClick` prop is only used on deal detail pages -- for listing pages, wrap the card in a `<Link>`:

```tsx
// In listing page (server component):
<Link href={`/deals/${deal.id}`} className="block">
  <DealCard deal={deal} variant="grid" />
</Link>
```

**Impact**: On a 30-card listing page, this eliminates ~5-8KB of hydrated client JS and removes 30 unnecessary `useAuth()` subscriptions.

### 3.2 Homepage Sections: Remove `'use client'`

Seven homepage sections are `'use client'` solely for scroll-reveal animations. The actual content is static data passed from the server.

**Conversion path** (using Solution B from `05-backend.md` -- server components with client wrapper):

| Component | Lines | Current Reason for Client | Conversion Strategy |
|---|---|---|---|
| `heroSection.tsx` | 130 | `useState`/`useEffect` for mount animation | CSS-only animation (Section 9) |
| `trendingDealsSection.tsx` | 75 | `ScrollRevealItem` | Server component, pass children through `ScrollRevealItem` |
| `categoryGrid.tsx` | 81 | `ScrollRevealItem` | Server component with client wrapper |
| `cityGrid.tsx` | 86 | `ScrollRevealItem` | Server component with client wrapper |
| `valuePropsSection.tsx` | 162 | `useScrollReveal` | CSS scroll-driven animation OR client wrapper |
| `socialProofSection.tsx` | 113 | `ScrollReveal` + `AnimatedCounter` | Server component, keep `AnimatedCounter` as client island |
| `businessCtaSection.tsx` | 67 | `ScrollReveal` | Server component with client wrapper |

**Pattern for server component with client animation wrapper**:

```tsx
// trendingDealsSection.tsx -- AFTER (Server Component)
import { ArrowRight, Fire } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { OfferCard } from '@/components/features/offerCard'
import { ScrollRevealItem } from '@/components/patterns/scrollReveal'
import type { OfferWithBusiness } from '@/types/supabase'

export function TrendingDealsSection({ offers }: { offers: OfferWithBusiness[] }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading is now server-rendered */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Fire size={22} weight="fill" className="text-amber-800" />
              <h2 className="text-2xl font-bold text-[#451a03]">Trending deals</h2>
            </div>
            <p className="text-sm text-[#78350f]">Best savings right now</p>
          </div>
          <Link href="/deals" className="group hidden sm:flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-700 transition-colors">
            View all deals
            <ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer, index) => (
            <ScrollRevealItem key={offer.id} index={index} animation="fadeInUp" stagger={100}>
              {/* Server-rendered children passed through client boundary */}
              <Link href={`/deals/${offer.id}`} className="block">
                <OfferCard offer={offer} />
              </Link>
            </ScrollRevealItem>
          ))}
        </div>
      </div>
    </section>
  )
}
```

This works because React Server Components can pass server-rendered JSX as `children` through a client component boundary. `ScrollRevealItem` only manages the IntersectionObserver; it never re-renders its children.

**Impact**: ~8-15KB of homepage client JS eliminated. Server-rendered content is available in HTML immediately.

### 3.3 Deals Listing Page: Route-Level Code Splitting

The `DealsRoutingPage` (`src/app/deals/[[...slugs]]/page.tsx`) imports three heavy client components at the top:
```tsx
import { CityDealsPage } from '@/components/features/deals/cityDealsPage'
import { DealDetailPage } from '@/components/features/deals/dealDetailPage'
import { TreatmentCityPage } from '@/components/features/deals/treatmentCityPage'
```

Only one of these renders per route invocation. Use `next/dynamic` to code-split:

```tsx
import dynamic from 'next/dynamic'

const CityDealsPage = dynamic(() =>
  import('@/components/features/deals/cityDealsPage').then(m => m.CityDealsPage)
)
const DealDetailPage = dynamic(() =>
  import('@/components/features/deals/dealDetailPage').then(m => m.DealDetailPage)
)
const TreatmentCityPage = dynamic(() =>
  import('@/components/features/deals/treatmentCityPage').then(m => m.TreatmentCityPage)
)
```

**Expected savings**: Each page variant only loads its own component, rather than all three. Estimated: ~4-8KB gzipped per route.

---

## 4. Critical Rendering Path

### 4.1 Current Blocking Resources (Homepage)

1. **Font files**: Sora (4 weights, preload) -- ~60-100KB of font data blocks text rendering until loaded. `display: 'swap'` prevents FOIT but causes CLS on font swap.
2. **Hero image**: `/images/homepage/hero-bg.png` (637KB PNG) -- priority-loaded via `<link rel="preload">`. Next.js Image Optimization converts to AVIF on first request (~80-150KB), but first-request penalty exists.
3. **Auth provider cascade**: Three context providers fire network requests on mount, competing with content rendering.
4. **Client-side hydration**: 7 homepage section components + GlobalHeader require JS parsing and hydration before becoming interactive.

### 4.2 Optimization: Eliminate Provider Blocking

As detailed in `05-backend.md` Section 1.2, moving auth providers to route group layouts removes them from public pages entirely. This eliminates:
- ~15-25KB of client JS from the critical path
- 2 Supabase Auth network requests on page load
- Server action stubs for `getProfileAction` and `getSavedDealsAction`

**Impact on critical path**: The browser can begin rendering and hydrating visible content ~200-400ms sooner.

### 4.3 Optimization: Server-Render Above-the-Fold Content

Converting the homepage HeroSection from client to server component (via CSS animations, see Section 9) means the hero headline, subtitle, CTA button, and category chips are in the initial HTML payload. The browser can paint this content immediately without waiting for JS hydration.

**Before** (critical path):
```
HTML arrives → Parse CSS → Load fonts → Download JS → Parse JS → Hydrate HeroSection →
setState(mounted=true) → Re-render with opacity-100 → CONTENT VISIBLE
```

**After** (critical path):
```
HTML arrives → Parse CSS → Load fonts → CONTENT VISIBLE (CSS animation starts)
JS downloads and hydrates in background (non-blocking)
```

**LCP improvement**: 100-300ms on the homepage by removing the JS dependency from the LCP element.

### 4.4 Optimization: Inline Critical CSS

Tailwind CSS v4 with `@tailwindcss/postcss` generates a single CSS file. For pages with ISR/SSG, the entire CSS file is loaded before first paint.

**Recommendation**: Next.js 16 with App Router automatically inlines critical CSS for server-rendered pages. Verify this is working by checking the HTML source for `<style>` tags in the `<head>`. If not present, consider:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: true, // Enables CSS optimization via critters
  },
}
```

**Note**: `optimizeCss` requires the `critters` package as a dependency. Test build time impact before enabling in production.

---

## 5. Image Optimization

### 5.1 Source Image Pre-Optimization

All images in `public/images/` are unoptimized PNGs totaling 8.3MB. While Next.js Image Optimization converts these to AVIF/WebP at runtime, the source files create issues:

1. **First-request penalty**: The first visitor after a deployment or cache invalidation waits for server-side AVIF conversion. For a 637KB PNG, this can add 200-500ms.
2. **Vercel Image Optimization cost**: Vercel charges per image optimization. Smaller source files reduce processing time and cost.
3. **Fallback quality**: Browsers that don't support AVIF/WebP receive the original PNG.

**Action plan**:

| Image | Current | Target | Savings |
|---|---|---|---|
| `hero-bg.png` | 637KB PNG | ~80-120KB WebP | 80% reduction |
| `treatments-hero.png` | 795KB PNG | ~90-130KB WebP | 83% reduction |
| `value-props-bg.png` | 697KB PNG | ~80-110KB WebP | 84% reduction |
| `city-1.png` | 963KB PNG | ~100-150KB WebP | 84% reduction |
| `city-2.png` | 1.0MB PNG | ~100-150KB WebP | 85% reduction |
| `city-3.png` | 908KB PNG | ~90-140KB WebP | 84% reduction |
| `city-4.png` | 892KB PNG | ~90-130KB WebP | 85% reduction |
| `business-cta.png` | 870KB PNG | ~90-130KB WebP | 85% reduction |
| `deals-hero.png` | 1.0MB PNG | ~100-150KB WebP | 85% reduction |
| `business-owner.png` | 662KB PNG | ~70-100KB WebP | 85% reduction |
| `icon.png` | 384KB PNG | ~5-10KB WebP (72x72) | 97% reduction |
| **Total** | **8.3MB** | **~900KB-1.3MB** | **~85% reduction** |

**Tool**: Use `sharp` or `squoosh-cli` for batch conversion:
```bash
npx sharp-cli -i public/images/homepage/*.png -o public/images/homepage/ --format webp --quality 80
npx sharp-cli -i public/icon.png -o public/ --format webp --width 72 --height 72 --quality 85
```

Then update image references:
```tsx
// Before
<Image src="/images/homepage/hero-bg.png" ... />

// After
<Image src="/images/homepage/hero-bg.webp" ... />
```

### 5.2 Icon Image (icon.png): Critical Fix

The app icon `icon.png` (384KB) renders at 36x36px in the GlobalHeader. This is the most egregious image optimization issue -- the file is **26 times larger than needed**.

**Action**:
1. Resize to 72x72px (2x for retina)
2. Convert to WebP
3. Expected result: ~5-10KB

This also affects every page load since the GlobalHeader renders on every page.

### 5.3 Hero Image `sizes` Attribute Audit

**Current state**: All hero images use `sizes="100vw"`, which is correct for full-bleed images.

**City grid images**: Currently use `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"` -- this is correct.

**Business CTA image**: Uses `sizes="(max-width: 1024px) 100vw, 50vw"` -- correct for a 2-column grid layout.

**No changes needed** for `sizes` attributes.

### 5.4 BlurredImage GPU Cost

The `BlurredImage` component applies `blur-xl scale-110` CSS filters to images. On deal listing pages with 20-50 cards, this creates 20-50 GPU-composited layers.

**Optimization**:
```tsx
// Before: GPU-intensive live blur
<Image className="object-cover blur-xl scale-110" />

// After: Use a tiny placeholder with CSS blur (much cheaper)
<Image
  className="object-cover blur-xl scale-110"
  quality={10}        // Very low quality since it's blurred anyway
  sizes="48px"        // Request a tiny image since it's blurred
/>
```

Alternatively, generate blurred placeholder data URLs at build time using `next/image`'s `blurDataURL` + `placeholder="blur"` pattern.

### 5.5 Lazy Loading Audit

| Image | Current Loading | Correct? | Notes |
|---|---|---|---|
| Homepage hero | `priority` | Yes | LCP element |
| Treatments hero | `priority` | Yes | LCP element |
| City grid images | `lazy` (default) | Yes | Below fold |
| Value props bg | `lazy` | Yes | Below fold |
| Business CTA image | `lazy` | Yes | Below fold |
| Icon (header) | Default (lazy) | **No** | Always above fold -- should use `priority` or at minimum a tiny image |

**Fix for icon**: Add `priority` to the header icon, or better, use the pre-optimized tiny WebP:
```tsx
<Image src="/icon.webp" alt="CostFinders" width={36} height={36} priority />
```

---

## 6. Font Loading Strategy

### 6.1 Current Configuration

```tsx
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

### 6.2 Analysis

- **Sora**: Primary font, 4 weights preloaded. Each weight is ~15-25KB (woff2), so preloading all 4 adds ~60-100KB to the critical path.
- **Manrope**: Fallback font, 4 weights, NOT preloaded. Correct -- it only loads if referenced in CSS.
- **All 4 weights used**: `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-bold` (700) are all present in the codebase.

### 6.3 Optimizations

**A. Use `variable` font instead of 4 static weights**

Google Fonts serves variable fonts when a range is requested. A single variable font file covers all weights in one file (~25-35KB) instead of four separate files (~60-100KB):

```tsx
const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  // Remove explicit weight array to get variable font
})
```

Next.js `next/font/google` automatically uses variable fonts when no `weight` array is specified and the font supports it. Sora is a variable font.

**Expected savings**: ~30-65KB reduction in preloaded font data.

**B. Font `display: 'swap'` CLS mitigation**

`display: 'swap'` shows a fallback font immediately, then swaps to Sora when loaded. The glyph difference between `system-ui` and Sora causes CLS, especially on large hero headlines.

**Mitigation**: Use the `adjustFontFallback` option (Next.js generates a CSS `@font-face` with `size-adjust`, `ascent-override`, and `descent-override` to minimize the visual difference):

```tsx
const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true, // Next.js auto-generates size-adjusted fallback
})
```

**C. Consider `display: 'optional'` for Manrope**

Since Manrope is the fallback font and `preload: false`, it may never load on fast connections where Sora loads first. Using `display: 'optional'` prevents late swaps:

```tsx
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'optional',  // If not loaded in time, don't swap
  preload: false,
  weight: ['400', '500', '600', '700'],
})
```

---

## 7. CSS Optimization

### 7.1 Tailwind CSS v4 Configuration

The project uses Tailwind CSS v4 with `@tailwindcss/postcss`. The CSS entry point is:

```css
@import "tailwindcss";
```

Tailwind v4 automatically purges unused utilities based on content scanning. No explicit `content` configuration is needed -- the PostCSS plugin scans all files in the project.

### 7.2 Design Token Duplication

`globals.css` defines the same tokens twice: once in `:root` (lines 9-66) and again in `@theme inline` (lines 68-125). The `@theme inline` block makes tokens available to Tailwind's utility system, while `:root` makes them available as CSS custom properties.

**Optimization**: Remove the `:root` block entirely. In Tailwind v4, `@theme inline` variables are already injected as CSS custom properties in the generated output:

```css
/* BEFORE: 125 lines */
:root {
  --color-bg-base: #e8ddd0;
  /* ... 55 more tokens ... */
}

@theme inline {
  --color-bg-base: #e8ddd0;
  /* ... same 55 tokens again ... */
}

/* AFTER: ~60 lines */
@theme inline {
  --color-bg-base: #e8ddd0;
  /* ... tokens only once ... */
}
```

**Impact**: Reduces `globals.css` by ~60 lines and eliminates duplicate token declarations in the generated CSS output. Modest CSS size reduction (~1-2KB uncompressed).

### 7.3 Animation Keyframes in CSS

The `globals.css` file defines 6 keyframe animations and scroll-reveal rules (lines 140-207). These are always loaded even on pages that don't use scroll animations (e.g., deal detail, provider profile, guides).

**Optimization**: Since these are used primarily on the homepage and treatments page, they could be moved to page-specific CSS modules. However, the overhead is small (~2KB uncompressed) and not worth the architectural complexity. Keep as-is.

### 7.4 Unused Utility Audit

With 207 lines in `globals.css` and Tailwind v4's automatic purging, CSS bloat is unlikely. The main concern is the `@theme inline` block creating many custom properties that may not all be used. A quick audit:

- `--color-glass-bg`, `--color-glass-border`, `--color-glass-bg-hover`, `--color-glass-border-hover`: Legacy compat tokens. Verify if referenced anywhere.
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`: Legacy compat. May be unused if all code uses the newer `--color-bg-base`/`surface`/`elevated` names.

**Action**: Search for usage of legacy tokens and remove if unused.

---

## 8. Loading States & Streaming

### 8.1 Current Loading State Coverage

| Route | Has `loading.tsx`? | Quality | Notes |
|---|---|---|---|
| `/` | Yes | Generic | Single hero skeleton + 6-card grid |
| `/deals/[...]` | Yes | Good | Header skeleton + 9-card deals grid |
| `/treatments` | Yes | Good | Header skeleton + 6-card category grid |
| `/treatments/[category]` | No | -- | Falls through to `/treatments/loading.tsx` |
| `/[state]/[city]/provider/[slug]` | No | -- | Falls through to root `loading.tsx` |
| `/guides/[slug]` | No | -- | Falls through to root `loading.tsx` |
| `/error` | Yes (error.tsx) | Good | Error boundary with retry |
| `/not-found` | Yes | Good | Server component with navigation |

### 8.2 Missing Loading States

**A. `/treatments/[category]/loading.tsx`**

```tsx
export default function CategoryLoading() {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-4 w-12 bg-[#d4c4b0] rounded" />
          <div className="h-4 w-4 bg-[#d4c4b0] rounded" />
          <div className="h-4 w-20 bg-[#d4c4b0] rounded" />
          <div className="h-4 w-4 bg-[#d4c4b0] rounded" />
          <div className="h-4 w-16 bg-[#d4c4b0] rounded" />
        </div>

        {/* Hero card skeleton */}
        <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-8 mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#d4c4b0]" />
            <div className="h-9 w-64 bg-[#d4c4b0] rounded" />
          </div>
          <div className="h-5 w-96 bg-[#d4c4b0] rounded mb-6" />
          <div className="flex gap-6">
            <div className="h-5 w-24 bg-[#d4c4b0] rounded" />
            <div className="h-5 w-32 bg-[#d4c4b0] rounded" />
          </div>
        </div>

        {/* Deals grid skeleton */}
        <div className="h-6 w-48 bg-[#d4c4b0] rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`cat-deal-skel-${i}`} className="h-72 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  )
}
```

**B. `/[state]/[city]/provider/[slug]/loading.tsx`** and **`/guides/[slug]/loading.tsx`**: These are SSG pages, so loading states are less critical (pages are pre-rendered). However, during client-side navigation (Link clicks), a loading state prevents the blank-page flash. Create simple skeletons matching each page's layout.

### 8.3 Suspense Boundary Opportunities

The deals routing page (`/deals/[[...slugs]]/page.tsx`) makes multiple sequential server queries before rendering. For the `city` route type:

```tsx
const [cityDeals, allCities, cityBusinessCount] = await Promise.all([...])
```

This is already parallelized, which is good. However, the structured data JSON-LD script could be streamed separately:

```tsx
// Wrap non-critical sections in Suspense
<Suspense fallback={null}>
  <DealsFaq cityName={route.cityName} />
</Suspense>
```

**Impact**: Marginal for ISR-cached pages (content is pre-rendered). More meaningful for cache misses.

### 8.4 Homepage Loading State Quality

The current `src/app/loading.tsx` is generic -- a single rectangle + 6-card grid. It doesn't match the homepage's actual layout (hero section + trending deals + category grid + city grid + value props + social proof + CTA).

**Recommendation**: Since the homepage uses ISR with 3600s revalidation, the loading state is only seen during cache misses or initial deployments. The current generic skeleton is acceptable. If improved perceived performance is desired, create a homepage-specific loading state.

---

## 9. Animation Performance

### 9.1 Problem: `mounted` State Pattern Delays LCP

Two components use this pattern:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
// className={`... ${mounted ? 'opacity-100' : 'opacity-0'} ...`}
```

**Files**: `heroSection.tsx` (lines 20-24), `treatmentsPageContent.tsx` (lines 95-96)

This creates a render sequence:
1. Server renders HTML with `opacity-0` (content invisible)
2. Browser downloads and parses JS
3. React hydrates the component
4. `useEffect` fires, sets `mounted = true`
5. Re-render with `opacity-100` (content becomes visible)

Steps 2-5 add 50-150ms of invisibility after HTML arrives.

### 9.2 Solution: CSS-Only Hero Entrance Animations

Replace the JS `mounted` state with pure CSS animations:

```css
/* Add to globals.css */
@keyframes heroEntrance {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-entrance {
  animation: heroEntrance 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.hero-entrance-1 { animation-delay: 0ms; }
.hero-entrance-2 { animation-delay: 200ms; opacity: 0; }
.hero-entrance-3 { animation-delay: 400ms; opacity: 0; }
.hero-entrance-4 { animation-delay: 500ms; opacity: 0; }
.hero-entrance-5 { animation-delay: 700ms; opacity: 0; }
```

**HeroSection becomes a server component**:

```tsx
// NO 'use client'
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function HeroSection({ categories, totalOffers, totalBusinesses }: HeroSectionProps) {
  return (
    <section className="relative w-full min-h-[70vh] sm:min-h-[80vh] flex items-center overflow-hidden">
      <Image src="/images/homepage/hero-bg.webp" alt="" fill className="object-cover" sizes="100vw" priority />
      <div className="absolute inset-0 bg-gradient-to-b from-[#451a03]/75 via-[#451a03]/50 to-[#e8ddd0]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          {/* Stats badge */}
          <div className="hero-entrance hero-entrance-1 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <TrendUp size={16} weight="bold" className="text-amber-300" />
            <span className="text-sm text-white/90 font-medium">
              {totalOffers} deals from {totalBusinesses} providers
            </span>
          </div>

          {/* Headline -- VISIBLE IMMEDIATELY, animates in via CSS */}
          <h1 className="hero-entrance hero-entrance-2 text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight">
            Don&apos;t overpay for <span className="text-amber-300">medspa treatments</span>
          </h1>

          {/* ... remaining content with hero-entrance-3, -4, -5 classes */}
        </div>
      </div>
    </section>
  )
}
```

**Impact**: Content is in the HTML immediately. CSS animations start as soon as the stylesheet loads -- no JS dependency. LCP improves by 50-150ms. The component drops from 130 lines of client JS to 0.

### 9.3 Problem: Scroll Reveal Hides Content Until JS Loads

```css
/* Current globals.css */
[data-scroll-reveal] {
  opacity: 0;
}
```

This CSS rule makes ALL scroll-reveal content invisible on initial page load. For above-the-fold content (or users with slow connections), this creates a blank page until JS hydrates the IntersectionObserver.

### 9.4 Solution: CSS Scroll-Driven Animations (Progressive Enhancement)

**Preferred approach**: Use the CSS `animation-timeline: view()` API with a fallback that shows content immediately for unsupported browsers:

```css
/* Replace the current scroll-reveal rules in globals.css */

/* Default: content is visible */
[data-animate] {
  opacity: 1;
  transform: none;
}

/* Progressive enhancement: animate on scroll if supported */
@supports (animation-timeline: view()) {
  [data-animate="fadeInUp"] {
    animation: fadeInUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-timeline: view();
    animation-range: entry 0% entry 35%;
  }

  [data-animate="scaleIn"] {
    animation: scaleIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-timeline: view();
    animation-range: entry 0% entry 35%;
  }

  [data-animate="fadeIn"] {
    animation: fadeIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-timeline: view();
    animation-range: entry 0% entry 35%;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-animate] {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}
```

Then server components use `data-animate` instead of `ScrollRevealItem`:

```tsx
// Server component -- no JS needed
<div data-animate="fadeInUp">
  <OfferCard offer={offer} />
</div>
```

**Browser support** for `animation-timeline: view()`:
- Chrome 115+ (March 2023)
- Safari 18+ (September 2024)
- Firefox: Behind flag (not yet stable)

For Firefox users, content renders without animation (the `[data-animate]` rule shows content at `opacity: 1` by default). This is acceptable progressive enhancement.

**If JS scroll reveal is still desired for Firefox compatibility**: Keep the current `ScrollRevealItem` as a thin client wrapper, but change the base CSS rule from `opacity: 0` to `opacity: 1`. The JS IntersectionObserver then becomes a progressive enhancement layer that adds the animation, rather than a gate that hides content.

### 9.5 AnimatedCounter: Keep as Client Island

`AnimatedCounter` inherently requires client-side JavaScript (it uses `requestAnimationFrame` to animate a number). Keep it as a `'use client'` component. Its parent (`SocialProofSection`) can become a server component that passes static content alongside the `AnimatedCounter` client islands.

### 9.6 `useScrolled` Hook Optimization

The `useScrolled` hook in GlobalHeader fires `setScrolled()` on every scroll event, even when the boolean value hasn't changed:

```tsx
// BEFORE
function handleScroll() {
  setScrolled(window.scrollY > threshold)  // Called on EVERY scroll pixel
}
```

This triggers a React re-render on every scroll event where `window.scrollY` crosses the threshold boundary. While `{ passive: true }` prevents scroll jank, the unnecessary re-renders waste CPU.

```tsx
// AFTER
function handleScroll() {
  const isNowScrolled = window.scrollY > threshold
  if (isNowScrolled !== scrolledRef.current) {
    scrolledRef.current = isNowScrolled
    setScrolled(isNowScrolled)
  }
}
```

With a `useRef` to track the previous value, React only re-renders when the scrolled state actually changes (typically once per page visit).

**Impact**: Eliminates dozens of unnecessary re-renders during scrolling. Minor INP improvement.

---

## 10. Third-Party Impact

### 10.1 Vercel Analytics (`@vercel/analytics/react`)

- Loads asynchronously via `<Analytics />` at the bottom of the body
- Client-side script: ~1KB gzipped
- Does not block rendering
- **No action needed**

### 10.2 Vercel Speed Insights (`@vercel/speed-insights/next`)

- Loads asynchronously via `<SpeedInsights />` at the bottom of the body
- Client-side script: ~1.5KB gzipped
- Collects Core Web Vitals and reports to Vercel dashboard
- **No action needed**

### 10.3 Supabase Auth Listener

Both `AuthProvider` and `BusinessAuthProvider` subscribe to `onAuthStateChange()`, which creates a persistent WebSocket-like connection to Supabase Auth. For anonymous users, this is pure overhead.

**Resolution**: Handled by provider architecture changes in `05-backend.md`.

### 10.4 Schema.org Structured Data

`WebsiteSchema` and `OrganizationSchema` render `<script type="application/ld+json">` in the root layout. These are small (~500 bytes each) and do not affect rendering performance. Multiple pages also add their own JSON-LD scripts.

**Optimization**: These could use `next/script` with `strategy="lazyOnload"` to defer parsing, but JSON-LD scripts are already non-blocking and Googlebot processes them regardless of load timing. **No action needed**.

---

## 11. Resource Hints

### 11.1 Current Resource Hints

Next.js automatically generates:
- `<link rel="preload">` for fonts with `preload: true` (Sora)
- `<link rel="preload">` for images with `priority` (hero backgrounds)
- `<link rel="preconnect">` for Google Fonts (via `next/font`)

### 11.2 Recommended Additions

**A. Preconnect to Cloudinary** (used for deal images):
```tsx
// In src/app/layout.tsx <head>
<link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
<link rel="dns-prefetch" href="https://res.cloudinary.com" />
```

This saves ~100-200ms on the first Cloudinary image request by establishing the TCP+TLS connection early.

**B. Preconnect to Supabase** (for authenticated routes):
```tsx
// In src/app/(auth)/layout.tsx only
<link rel="preconnect" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" crossOrigin="" />
```

**C. Prefetch critical navigation targets**:

The homepage's primary CTA ("Find deals near you") links to `/deals`. Prefetch this route:
```tsx
<Link href="/deals" prefetch={true}>
```

Next.js App Router prefetches `<Link>` targets by default when they enter the viewport. Verify this behavior is not disabled.

### 11.3 Preload Hero Image Explicitly

For the homepage hero, the image URL is known statically. Add an explicit preload in the layout to start the download before the `<Image>` component renders:

```tsx
// In src/app/page.tsx or a layout
export function generateMetadata() {
  return {
    other: {
      'link': [
        { rel: 'preload', as: 'image', href: '/images/homepage/hero-bg.webp', type: 'image/webp' }
      ]
    }
  }
}
```

Note: `next/image` with `priority` already adds a preload hint. This is redundant but serves as documentation of intent.

---

## 12. Implementation Plan & Expected Impact

### Phase 1: Quick Wins (1-2 days, no architectural changes)

| Change | Files | Expected CWV Impact | Risk |
|---|---|---|---|
| Pre-optimize all PNG source images to WebP | `public/images/` | LCP: -200-500ms on homepage, treatments | None (visual fidelity) |
| Replace `icon.png` (384KB) with 72x72 WebP (~8KB) | `public/icon.png`, GlobalHeader | LCP: -50ms on all pages | None |
| Add `priority` to header icon image | `globalHeader.tsx` | LCP: -20ms | None |
| Fix `useScrolled` unnecessary re-renders | `useScrolled.ts` | INP: -5-10ms per scroll | None |
| Add Cloudinary `preconnect` | `layout.tsx` | LCP: -100-200ms on deal pages | None |
| Remove `:root` token duplication in CSS | `globals.css` | CSS size: -1-2KB | Low |
| Switch Sora to variable font (remove weight array) | `layout.tsx` | Font load: -30-65KB | Test visual |

**Estimated total Phase 1 impact**:
- LCP: -300-700ms on homepage (image + font + preconnect)
- LCP: -100-300ms on other pages (icon + preconnect)
- INP: Minor improvement from scroll optimization
- CLS: Improved with `adjustFontFallback` for Sora

### Phase 2: Component Boundary Optimization (3-5 days)

| Change | Files | Expected CWV Impact | Risk |
|---|---|---|---|
| CSS-only hero entrance animation | `heroSection.tsx`, `treatmentsPageContent.tsx`, `globals.css` | LCP: -50-150ms | Browser compat |
| Convert HeroSection to server component | `heroSection.tsx` | JS: -3KB gzipped | Low |
| Convert 5 homepage sections to server components (via client wrapper pattern) | 5 section files | JS: -8-15KB gzipped, TTI: -100-200ms | Medium |
| Split DealCard into server + SaveButton client island | `dealCard.tsx` | JS: -5-8KB per listing page, TTI: -100ms | Medium |
| CSS scroll-driven animations (progressive enhancement) | `globals.css`, remove `opacity:0` default | CLS: -0.05-0.1, perceived speed improvement | Browser compat |
| Dynamic import deals routing page components | `deals/[[...slugs]]/page.tsx` | JS: -4-8KB per route | Low |
| Add missing `loading.tsx` files | 3 new files | Perceived nav speed | None |

**Estimated total Phase 2 impact**:
- LCP: -50-150ms (hero animation fix)
- TTI: -200-400ms on homepage (removed client JS)
- TTI: -100-200ms on deal listing pages (DealCard server rendering)
- JS bundle: -20-35KB gzipped on homepage
- CLS: Improved by removing `opacity: 0` default for scroll content

### Phase 3: Architecture Changes (5-8 days, depends on `05-backend.md`)

| Change | Files | Expected CWV Impact | Risk |
|---|---|---|---|
| Route group layout splitting (providers out of public pages) | `layout.tsx`, new route group layouts | TTI: -200-400ms on all public pages, JS: -15-25KB | High |
| Public server-rendered header | New `publicHeader.tsx` + `authModalTrigger.tsx` | JS: -3-5KB, 2 fewer network requests | Medium |
| Dynamic import modals (BottomSheet, ClaimDealModal, etc.) | Multiple files | JS: -3-5KB per page | Low |
| Supabase browser client singleton | Auth context files | JS: -5-8KB | Medium |

**Estimated total Phase 3 impact**:
- TTI: -200-400ms on all public pages
- JS bundle: -25-40KB on public pages
- Network: 2 eliminated Supabase requests per page load

### Cumulative Expected Core Web Vitals Improvement

| Metric | Current Estimate | After Phase 1 | After Phase 2 | After Phase 3 |
|---|---|---|---|---|
| **LCP (Homepage, 4G)** | 1.5-2.5s | 1.0-1.8s | 0.9-1.5s | 0.8-1.3s |
| **LCP (Deals listing, 4G)** | 1.0-1.8s | 0.8-1.5s | 0.7-1.3s | 0.7-1.2s |
| **INP (Homepage)** | 100-200ms | 90-180ms | 60-120ms | 50-100ms |
| **INP (Deals listing)** | 150-250ms | 140-230ms | 100-180ms | 80-150ms |
| **CLS (Homepage)** | 0.05-0.15 | 0.03-0.08 | 0.01-0.05 | 0.01-0.05 |
| **TTI (Homepage, 4G)** | 2.5-4.0s | 2.0-3.2s | 1.5-2.5s | 1.2-2.0s |
| **Client JS (Homepage)** | ~170-190KB gz | ~140-160KB gz | ~120-145KB gz | ~95-120KB gz |

### Measurement Plan

After each phase, measure with:

1. **Vercel Speed Insights**: Real user metrics from the dashboard
2. **Lighthouse CI**: Run in CI pipeline against staging deployment
3. **WebPageTest**: Filmstrip comparison before/after on 4G throttled connection
4. **Chrome DevTools**: Performance panel recording for TTI and hydration timing
5. **Bundle analyzer**: `ANALYZE=true next build` with `@next/bundle-analyzer` for precise JS size tracking

### Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| CSS scroll-driven animations unsupported in Firefox | Low | Fallback shows content immediately without animation |
| DealCard server/client split breaks `onClick` handler | Medium | Use `<Link>` wrapper for navigation instead of `onClick` |
| Route group layout splitting requires moving many files | Medium | Test in a branch, verify all routes still resolve correctly |
| Variable font may render slightly differently than static weights | Low | Visual comparison before/after on key pages |
| Removing `opacity: 0` default changes scroll-reveal behavior | Low | Content appears instantly instead of animating -- acceptable degradation |

---

## Summary: Top 5 Changes by Impact-to-Effort Ratio

1. **Pre-optimize source images** (Phase 1) -- 1 hour of `sharp` CLI work saves 300-700ms LCP
2. **CSS-only hero entrance** (Phase 2) -- 2 hours saves 50-150ms LCP and removes ~3KB client JS
3. **Variable Sora font** (Phase 1) -- 5-minute config change saves 30-65KB of font data
4. **DealCard server/client split** (Phase 2) -- 4 hours saves 5-8KB per listing page and eliminates 20-50 unnecessary hydration targets
5. **Route group layout splitting** (Phase 3) -- Largest single improvement: 15-25KB JS + 2 network requests eliminated on every public page
