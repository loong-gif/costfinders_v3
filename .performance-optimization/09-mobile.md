# CostFinders v2 -- Mobile Performance Optimization Plan

**Date**: 2026-03-21
**Scope**: Mobile rendering performance, touch responsiveness, adaptive loading, virtual scrolling, mobile navigation, PWA/offline strategy, mobile image optimization, input optimization, viewport and layout
**Depends on**: `07-frontend.md` (bundle optimization, component splitting, image optimization, animation performance), `08-cdn.md` (caching, compression, resource hints), `05-backend.md` (provider architecture changes)

---

## Table of Contents

1. [Mobile Audience Profile](#1-mobile-audience-profile)
2. [Mobile Rendering Performance](#2-mobile-rendering-performance)
3. [Touch Responsiveness](#3-touch-responsiveness)
4. [Mobile-Specific Loading](#4-mobile-specific-loading)
5. [Virtual Scrolling & List Performance](#5-virtual-scrolling--list-performance)
6. [Mobile Navigation Performance](#6-mobile-navigation-performance)
7. [PWA & Offline Strategy](#7-pwa--offline-strategy)
8. [Mobile Image Optimization](#8-mobile-image-optimization)
9. [Input Optimization](#9-input-optimization)
10. [Viewport & Layout](#10-viewport--layout)
11. [Loading State Quality on Mobile](#11-loading-state-quality-on-mobile)
12. [Implementation Plan & Expected Impact](#12-implementation-plan--expected-impact)

---

## 1. Mobile Audience Profile

### User Context

CostFinders targets consumers searching for local cosmetic/medspa deals. This audience skews heavily mobile:

| Factor | Implication |
|---|---|
| **Discovery-driven browsing** | Users search "botox near me" on phones, land on deal listing pages |
| **Local intent** | Often browsing while commuting, at lunch, or in waiting rooms -- intermittent connectivity |
| **Comparison shopping** | Scroll through 20-50 deal cards, tap to compare details |
| **Price-sensitive** | May be on older/mid-range Android devices with constrained CPU and memory |
| **Impulse-driven** | Fast page loads directly correlate with deal claim conversion |

### Device Budget

A realistic mobile performance budget for this audience:

| Metric | Target | Current Estimate | Notes |
|---|---|---|---|
| **LCP** | < 2.5s on 4G | ~3-4s (hero images, JS-gated content) | Blocked by `mounted` state pattern + unoptimized PNGs |
| **INP** | < 200ms | ~150-250ms (filter interactions) | Category filter + sort cause re-renders of full deal list |
| **CLS** | < 0.1 | ~0.05-0.15 (font swap, lazy images) | `display: 'swap'` on Sora causes measurable shift |
| **FCP** | < 1.8s | ~2-3s | Auth providers + hydration delay |
| **TTI** | < 3.5s | ~4-5s | 125 client components, 3 root providers |
| **Total JS (gzipped)** | < 150KB | ~170-200KB | Per `07-frontend.md` estimates |

### Simulated Mobile Environment

All mobile optimizations should be tested against this baseline:

```
Device: Moto G Power (mid-range Android)
CPU: 4x throttle in DevTools
Network: Fast 3G (1.6 Mbps down, 768 Kbps up, 150ms RTT)
Viewport: 375x812 (iPhone SE / standard mobile)
```

---

## 2. Mobile Rendering Performance

### 2.1 JavaScript Execution Cost on Mobile CPUs

**Problem**: Mobile CPUs are 4-6x slower than desktop CPUs. A 200KB JS bundle that parses in 50ms on a MacBook takes 200-300ms on a mid-range Android phone.

**Current mobile JS execution breakdown (estimated)**:

| JS Component | Gzipped Size | Parse + Execute (mobile, est.) | Ships To |
|---|---|---|---|
| React + React DOM | ~45KB | ~120-150ms | All pages |
| Next.js framework | ~90KB | ~200-250ms | All pages |
| Auth providers (3) + Supabase (2 clients) | ~15-25KB | ~80-120ms | All pages (root layout) |
| GlobalHeader + useScrolled + useAuth | ~3-5KB | ~20-30ms | All pages |
| DealCard (x30) + SaveButton + BlurredImage | ~5-8KB | ~40-60ms | Deal listings |
| ScrollReveal (x10+) + IntersectionObserver hooks | ~2-3KB | ~15-25ms | Homepage, treatments |
| Phosphor Icons (tree-shaken) | ~2-4KB per page | ~10-20ms | Varies |
| **Total estimated main thread blocking** | | **~500-650ms** | |

**Critical path on mobile**: On a 4G connection with a mid-range phone, the sequence is:

```
DNS + TCP + TLS:               ~150ms
HTML download (ISR cached):     ~100ms
CSS parse:                      ~30ms
Font download (Sora, 4 weights): ~200-400ms (4 requests)
JS download (framework):       ~300-500ms
JS parse + compile:            ~200-300ms
Hydration:                     ~150-250ms
Auth provider mount + fetch:   ~200-400ms
setMounted(true) re-render:    ~50-100ms
═══════════════════════════════════════
Total to interactive:          ~1.4-2.5s (cached ISR)
                               ~2.5-4.5s (cache miss with regen)
```

### 2.2 Hydration Cost Reduction

The optimizations in `07-frontend.md` Sections 2-3 directly reduce mobile hydration cost. Here is the mobile-specific impact:

| Optimization | Desktop Savings | Mobile Savings (4x multiplier) | Reference |
|---|---|---|---|
| Remove auth providers from public pages | ~15-25KB JS | 80-120ms parse time saved | `05-backend.md` Section 1.2 |
| DealCard server/client split | ~5-8KB JS | 40-60ms, eliminates 30x `useAuth()` | `07-frontend.md` Section 3.1 |
| Hero section CSS-only animation | ~3-5KB JS | 20-40ms + removes LCP-blocking JS gate | `07-frontend.md` Section 9.2 |
| Homepage sections to server components | ~8-15KB JS | 60-100ms parse + hydration removed | `07-frontend.md` Section 3.2 |
| Dynamic import deal page variants | ~4-8KB JS per page | 30-60ms per route | `07-frontend.md` Section 3.3 |
| Variable font (1 file vs 4) | ~30-65KB font data | Eliminates 3 HTTP requests | `07-frontend.md` Section 6.3 |
| **Combined mobile impact** | | **~230-380ms faster TTI** | |

### 2.3 Main Thread Scheduling

**Problem**: When the browser is parsing and executing 170KB+ of JavaScript, the main thread is blocked. During this time, the user cannot scroll, tap, or interact with the page. On mobile, this blocking window is 2-4x longer than on desktop.

**Recommendations**:

**A. Yield to main thread during hydration** -- Next.js 16 with React 19 uses concurrent features that automatically yield during hydration. Ensure the project does not opt out of this behavior.

**B. Defer non-critical client components** -- Components that are not visible on initial mobile viewport should not block the critical path:

```tsx
// Components safe to defer on mobile (below initial viewport):
// - SocialProofSection (below fold on all mobile viewports)
// - BusinessCtaSection (always below fold)
// - CityGrid (below fold on mobile)
// - ValuePropsSection (always below fold)
// - FAQ sections on all pages

// Pattern: Wrap below-fold client components in dynamic import
import dynamic from 'next/dynamic'

const SocialProofSection = dynamic(
  () => import('@/components/features/homepage/socialProofSection').then(m => m.SocialProofSection),
  { ssr: true } // Still server-render for SEO, but defer client JS
)
```

Note: `ssr: true` with `dynamic()` still server-renders the HTML but splits the client JS into a separate chunk that loads after the main bundle. The component is visible immediately (SSR) but interactive once the chunk loads.

**C. `requestIdleCallback` for non-critical initializations**:

```tsx
// In AuthProvider -- defer non-essential work
useEffect(() => {
  // Critical: Set up auth listener immediately
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...)

  // Non-critical: Fetch saved deals list
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => fetchSavedDeals())
  } else {
    setTimeout(() => fetchSavedDeals(), 100)
  }

  return () => subscription.unsubscribe()
}, [])
```

### 2.4 GPU Compositing on Mobile

**Problem**: The `BlurredImage` component applies `blur-xl scale-110` CSS to images. On mobile GPUs, each blur creates a composited layer requiring GPU memory. On a deals listing page with 30 cards, this means 30 separate GPU layers.

**Measured impact**: Each blur layer on a mobile GPU consumes ~1-4MB of GPU memory. Thirty layers = 30-120MB of GPU memory on a device that may only have 512MB-1GB total GPU memory.

**Optimizations** (extending `07-frontend.md` Section 5.4):

```tsx
// Mobile-specific: Use CSS contain to limit GPU layer scope
<div className="relative w-full h-full overflow-hidden contain-paint">
  {src ? (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes="48px"       // Tiny source since blurred anyway
      quality={10}       // Very low quality
      loading={priority ? 'eager' : 'lazy'}
      className="object-cover blur-xl scale-110 will-change-auto"
      // will-change-auto (not will-change-transform) tells the browser
      // this layer is NOT expected to animate, reducing GPU reservation
    />
  ) : (
    // Placeholder: no GPU cost
    <div className="absolute inset-0 flex items-center justify-center bg-[#faf5ee]">
      <Tag size={48} weight="light" className="text-[#92400e] blur-sm" />
    </div>
  )}
</div>
```

**CSS addition for `globals.css`**:

```css
/* Reduce GPU layer count on mobile */
@media (max-width: 768px) {
  .blur-xl {
    /* On mobile, use a smaller blur radius to reduce GPU cost */
    /* Tailwind blur-xl = 24px. Reduce to 16px on mobile. */
    --tw-blur: blur(16px);
  }
}
```

Alternative: Replace `blur-xl` with a CSS gradient overlay that simulates blur without GPU compositing:

```css
/* Zero-GPU blur alternative for listing cards */
.blur-placeholder {
  background: linear-gradient(
    135deg,
    var(--color-bg-surface) 0%,
    var(--color-bg-elevated) 50%,
    var(--color-bg-surface) 100%
  );
}
```

This eliminates GPU compositing entirely while maintaining the "obscured" visual effect. Recommended for listing pages where 20-50 blurred images appear simultaneously.

---

## 3. Touch Responsiveness

### 3.1 Touch Target Audit

The minimum touch target for mobile is 44x44px (Apple HIG) / 48x48dp (Material Design).

**Current state audit**:

| Component | Touch Target Size | Compliant? | File |
|---|---|---|---|
| `Button` (all sizes) | `min-h-[44px]` (sm, md, lg) | Yes | `button.tsx` line 23-25 |
| `CategoryFilter` buttons | `min-h-[44px]` | Yes | `categoryFilter.tsx` line 41 |
| `SortSelector` trigger | `min-h-[44px]`, dropdown items `min-h-[44px]` | Yes | `sortSelector.tsx` lines 71, 114 |
| `PriceRangeFilter` inputs | `min-h-[44px]` | Yes | `priceRangeFilter.tsx` lines 65, 98 |
| `SaveButton` | `w-11 h-11` (44px) | Yes | `saveButton.tsx` line 23 |
| `FilterPanel` toggle | `px-4 py-2.5` (~40px tall) | Borderline | `filterPanel.tsx` line 48 |
| `ViewModeToggle` buttons | `p-2` (~36px) | **No** | `dealsGrid.tsx` lines 30-31 |
| Category chips (hero) | `px-4 py-1.5` (~30px tall) | **No** | `heroSection.tsx` line 118 |
| Sign-in text button | `text-sm` with no padding | **No** | `globalHeader.tsx` line 80 |
| "View all deals" link | Text link, no padding | **No** | `trendingDealsSection.tsx` line 30 |
| City grid cards | Full card is tappable | Yes | `cityGrid.tsx` line 48 |
| DealCard | Full card is tappable | Yes | `dealCard.tsx` |
| OfferCard | Full card is tappable | Yes | `offerCard.tsx` |
| Back navigation links | Text + icon, no min-height | **No** | `treatments/[category]/page.tsx` line 257 |

**Fixes needed**:

```tsx
// ViewModeToggle: Increase from p-2 to p-2.5 with min dimensions
<button className="p-2.5 min-w-[44px] min-h-[44px] rounded-md transition-colors ...">

// Hero category chips: Add vertical padding
<Link className="... rounded-full px-4 py-2.5 min-h-[44px] ...">

// Sign-in text button: Add touch padding
<button className="text-sm text-[#78350f] px-3 py-2.5 min-h-[44px] ...">

// "View all deals" link: Wrap in touch-friendly container
<Link className="... inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] ...">

// Back navigation: Add padding
<Link className="inline-flex items-center gap-2 px-3 py-2.5 min-h-[44px] ...">
```

### 3.2 Tap Delay Elimination

**Current state**: Next.js sets `<meta name="viewport" content="width=device-width, initial-scale=1">` by default, which eliminates the 300ms tap delay in all modern mobile browsers. No action needed.

However, the `touch-action` CSS property can further optimize specific interactions:

```css
/* Add to globals.css */

/* Buttons and interactive elements: disable double-tap zoom */
button, [role="button"], a, input, select, textarea {
  touch-action: manipulation;
}

/* Horizontal scrolling containers (category filter): disable vertical scroll interference */
.overflow-x-auto {
  touch-action: pan-x;
}
```

The `touch-action: manipulation` declaration disables double-tap-to-zoom on interactive elements, eliminating any remaining browser-side tap delay on iOS Safari and older Android WebViews.

### 3.3 Scroll Performance

**Current state**: The `useScrolled` hook adds a scroll listener for the GlobalHeader shadow effect. It correctly uses `{ passive: true }`, which prevents scroll jank.

**Issues**:

**A. Multiple IntersectionObserver instances on homepage**:

Each `ScrollRevealItem` creates its own `IntersectionObserver` instance via `useScrollReveal`. On the homepage with ~20 scroll-reveal elements, this means 20 separate IntersectionObserver instances.

**Optimization**: Use a shared IntersectionObserver pattern:

```tsx
// src/lib/hooks/useSharedScrollReveal.ts
'use client'

const observerCallbacks = new Map<Element, (entry: IntersectionObserverEntry) => void>()
let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(threshold: number = 0.1): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const callback = observerCallbacks.get(entry.target)
          if (callback) callback(entry)
        }
      },
      { threshold }
    )
  }
  return sharedObserver
}

export function useSharedScrollReveal(options: { threshold?: number; once?: boolean } = {}) {
  const { once = true } = options
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }

    const observer = getSharedObserver()

    observerCallbacks.set(element, (entry) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        if (once) {
          observer.unobserve(element)
          observerCallbacks.delete(element)
        }
      } else if (!once) {
        setIsVisible(false)
      }
    })

    observer.observe(element)

    return () => {
      observer.unobserve(element)
      observerCallbacks.delete(element)
    }
  }, [once])

  return { ref, isVisible }
}
```

**Impact**: Reduces 20 IntersectionObserver instances to 1 on the homepage. Each IntersectionObserver has a setup cost and creates its own internal callback queue. On mobile, reducing to a single shared observer saves ~10-20ms of initialization time and reduces memory pressure.

**B. Momentum scrolling CSS**:

```css
/* Ensure smooth momentum scrolling on iOS */
.overflow-y-auto,
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}
```

Note: Modern iOS Safari enables this by default, but explicit declaration ensures consistency on older iOS versions (14 and below).

### 3.4 Active State Feedback

Mobile users need immediate visual feedback on tap. Current buttons use `hover:` states which don't trigger on mobile tap. The `active:scale-95` pattern on `CategoryFilter` is correct.

**Add active states to all tappable elements**:

```css
/* Add to globals.css */

/* Touch feedback for all interactive elements */
@media (hover: none) and (pointer: coarse) {
  button:active,
  [role="button"]:active,
  a:active {
    transform: scale(0.97);
    transition-duration: 50ms;
  }
}
```

This provides instant visual feedback (97% scale) on tap, independent of the CSS transition duration. The `@media (hover: none)` query ensures this only applies to touch devices.

---

## 4. Mobile-Specific Loading

### 4.1 Adaptive Loading for Slow Networks

**Network Information API** can detect connection quality and adapt the experience:

```tsx
// src/lib/hooks/useNetworkQuality.ts
'use client'

import { useEffect, useState } from 'react'

type NetworkQuality = 'high' | 'medium' | 'low' | 'unknown'

interface NetworkInfo {
  quality: NetworkQuality
  saveData: boolean
  effectiveType: string | null
}

export function useNetworkQuality(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    quality: 'unknown',
    saveData: false,
    effectiveType: null,
  })

  useEffect(() => {
    const connection = (navigator as any).connection

    if (!connection) {
      setInfo({ quality: 'unknown', saveData: false, effectiveType: null })
      return
    }

    function update() {
      const conn = (navigator as any).connection
      const effectiveType = conn?.effectiveType ?? null
      const saveData = conn?.saveData ?? false

      let quality: NetworkQuality = 'high'
      if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
        quality = 'low'
      } else if (effectiveType === '3g') {
        quality = 'medium'
      }

      setInfo({ quality, saveData, effectiveType })
    }

    update()
    connection.addEventListener('change', update)
    return () => connection.removeEventListener('change', update)
  }, [])

  return info
}
```

**Usage in components**:

```tsx
// In DealsGrid or any listing component
const { quality, saveData } = useNetworkQuality()

// Reduce initial render count on slow connections
const initialDisplayCount = quality === 'low' ? 6 : quality === 'medium' ? 12 : 30
const [displayCount, setDisplayCount] = useState(initialDisplayCount)

// Disable animations on slow connections
const enableAnimations = quality !== 'low' && !saveData

// Disable blur effects on save-data mode
const enableBlur = !saveData
```

**Browser support**: Network Information API is available in Chrome/Edge/Samsung Internet (Android). Not available in Safari/Firefox. Falls back to `quality: 'unknown'` (full experience).

### 4.2 Reduced Motion Preferences

**Current state**: The project correctly handles `prefers-reduced-motion`:

- `useScrollReveal` checks `window.matchMedia('(prefers-reduced-motion: reduce)')` and skips animation (line 24-29 of `useScrollReveal.ts`)
- `globals.css` has a `@media (prefers-reduced-motion: reduce)` block that disables scroll-reveal animations and smooth scrolling (lines 198-207)

**Gap**: The `heroSection.tsx` and `treatmentsPageContent.tsx` `mounted` state animations do NOT respect reduced motion. They always animate opacity/translate regardless of user preference.

**Fix** (if these components remain client-side before the CSS-only migration from `07-frontend.md` Section 9.2):

```tsx
// In heroSection.tsx
const [mounted, setMounted] = useState(false)

useEffect(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // If reduced motion, skip the animation -- show content immediately
  setMounted(true)
  // The CSS classes below should also check:
}, [])

// In className:
const shouldAnimate = mounted && !prefersReducedMotion
// Better: After the CSS-only migration, this is handled automatically by the
// @media (prefers-reduced-motion) CSS rule
```

The CSS-only approach from `07-frontend.md` Section 9.2 handles this correctly via the `@media` query. Prioritize that migration.

### 4.3 Data Saver Mode Adaptations

When `navigator.connection.saveData` is `true`, the user has explicitly requested reduced data usage:

| Feature | Normal Mode | Data Saver Mode |
|---|---|---|
| Deal card images | Load all visible | Skip `BlurredImage`, show gradient placeholder |
| Hero background | Full image with priority | Skip image, use solid gradient |
| City grid images | Lazy load | Skip entirely, use text-only cards |
| Scroll animations | Enabled | Disabled |
| Font weights | 4 weights preloaded | Variable font only (single file) |
| Prefetch | Next.js default (viewport) | Disable prefetch on `<Link>` |

**Implementation pattern**:

```tsx
// Server-side: Check Sec-CH-UA-Data-Saver header (requires client hint opt-in)
// Client-side: Check navigator.connection.saveData

// Simplest approach: CSS-only data-saver handling
// In globals.css:
@media (prefers-reduced-data: reduce) {
  /* Hide decorative images */
  [data-decorative-image] {
    display: none;
  }

  /* Disable background images */
  .hero-bg-image {
    display: none;
  }
}
```

Note: `prefers-reduced-data` is a CSS media query that is not yet widely supported (behind flags in most browsers). The JavaScript `navigator.connection.saveData` approach is more reliable for now.

### 4.4 Skeleton Shimmer Direction on Mobile

Current loading skeletons use `animate-pulse` (opacity-based shimmer). On mobile, a directional shimmer provides a stronger sense of progress:

```css
/* Add to globals.css */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #f2ebe2 25%,
    #faf5ee 50%,
    #f2ebe2 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

Replace `animate-pulse` with `skeleton-shimmer` in loading states for a more polished mobile experience. The directional shimmer suggests content is loading from left to right, matching the reading direction.

---

## 5. Virtual Scrolling & List Performance

### 5.1 Current List Sizes

| Page | Max Items | Card Complexity | Total DOM Nodes (est.) |
|---|---|---|---|
| `/deals/[city]` | 20-50 deals | `DealCard`: ~40 nodes each | 800-2000 |
| `/treatments/[category]` | 10-40 deals | `DealCard`: ~40 nodes each | 400-1600 |
| Homepage trending | 6 offers | `OfferCard`: ~25 nodes each | 150 |
| Homepage city grid | 4-8 cities | Image card: ~15 nodes each | 60-120 |
| `/deals` city selector | 15-20 cities | Simple link: ~8 nodes each | 120-160 |

### 5.2 Virtual Scrolling Assessment

**Recommendation: Virtual scrolling is NOT needed for CostFinders.**

Reasons:

1. **List sizes are bounded**: Maximum ~50 deal cards per page. Virtual scrolling provides measurable benefit above ~100-200 items. Below that threshold, the virtualization overhead (scroll position tracking, dynamic height calculation, intersection observer) often exceeds the DOM cost savings.

2. **Cards have dynamic height**: `DealCard` height varies based on content (title length, description in list mode, presence of discount badge). Virtual scrolling libraries require either fixed heights or expensive height measurement passes. With Tailwind's `line-clamp-2`, heights vary by ~20-40px.

3. **SEO requirement**: Deal cards must be in the DOM for search engine crawlers. Virtual scrolling hides off-screen content, which conflicts with SSG/ISR SEO benefits.

4. **ISR pre-rendering**: Since pages are server-rendered with all cards already in the HTML, removing cards from the DOM to virtualize them would waste the server rendering work.

### 5.3 Recommended Alternative: Progressive Rendering

Instead of virtual scrolling, use progressive rendering to reduce initial paint cost on mobile:

```tsx
// In DealsGrid -- progressive rendering pattern
'use client'

import { useEffect, useState } from 'react'

export function DealsGrid({ deals, onDealClick }: DealsGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // On mobile, render first 9 cards immediately (fills ~2 viewport heights)
  // Then render remaining cards after a paint frame
  const [renderAll, setRenderAll] = useState(deals.length <= 9)

  useEffect(() => {
    if (deals.length <= 9) return

    // Wait for the first paint with initial cards, then render the rest
    const id = requestAnimationFrame(() => {
      setRenderAll(true)
    })
    return () => cancelAnimationFrame(id)
  }, [deals.length])

  const visibleDeals = renderAll ? deals : deals.slice(0, 9)

  return (
    <div>
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
        : 'flex flex-col gap-4'
      }>
        {visibleDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            variant={viewMode}
            onClick={onDealClick ? () => onDealClick(deal.id) : undefined}
          />
        ))}
      </div>

      {/* Show count indicator while remaining cards load */}
      {!renderAll && deals.length > 9 && (
        <div className="text-center py-4 text-sm text-[#92400e]">
          Loading {deals.length - 9} more deals...
        </div>
      )}
    </div>
  )
}
```

**Impact**: The first 9 cards render and become interactive faster. The remaining cards appear within one frame (~16ms). Users see a complete initial viewport immediately, with below-fold cards filling in before they can scroll to them.

### 5.4 CSS `content-visibility` for Below-Fold Cards

CSS `content-visibility: auto` tells the browser to skip rendering for off-screen elements until they scroll into view. This is native browser-level virtual rendering without any JS overhead:

```css
/* Add to globals.css */

/* Skip rendering for off-screen deal cards */
@media (max-width: 768px) {
  .deal-card-container > :nth-child(n+4) {
    content-visibility: auto;
    contain-intrinsic-size: auto 380px; /* Estimated card height */
  }
}

@media (min-width: 769px) {
  .deal-card-container > :nth-child(n+7) {
    content-visibility: auto;
    contain-intrinsic-size: auto 380px;
  }
}
```

Then add the class to the grid container:

```tsx
<div className="deal-card-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Browser support**: Chrome 85+, Edge 85+, Firefox 124+. Safari: No support (renders all cards normally, which is fine -- no degradation).

**Impact**: On a 30-card mobile listing page, the browser skips rendering ~27 cards initially (only the first 3 are in viewport). This can reduce initial render time by 50-70% for the card grid. The `contain-intrinsic-size` prevents layout shift by reserving the correct height.

---

## 6. Mobile Navigation Performance

### 6.1 Current Mobile Navigation

The app uses a fixed header (`GlobalHeader`) but does NOT have an explicit bottom navigation component. The `pb-20 md:pb-0` padding pattern throughout the codebase reserves space for a bottom nav on mobile, but no bottom nav component exists in the codebase. The padding is likely a placeholder for a future implementation.

**Header performance**: The `GlobalHeader` is a `'use client'` component that:
1. Calls `useAuth()` on every page (forces auth provider hydration)
2. Calls `useScrolled()` (scroll listener on every page)
3. Dynamically imports `AuthModal` (correct -- deferred until click)
4. Renders `NotificationBell` (another client component)

**Mobile-specific issue**: On mobile, the header takes 64px (`h-16`) of the 812px viewport = 7.9% of screen real estate. With the reserved `pb-20` (80px) for bottom nav, the combined navigation chrome consumes 144px = 17.7% of the mobile viewport.

### 6.2 Route Transition Performance

**Current state**: Next.js App Router uses client-side navigation for `<Link>` components. The transition between pages involves:

1. Prefetch the route's RSC payload (automatic for viewport-visible Links)
2. Download any new JS chunks needed for the target page
3. Render the new page's server component tree
4. Hydrate new client components

**Optimization -- Prefetch critical routes explicitly**:

```tsx
// In GlobalHeader -- prefetch the deals route since it's the primary CTA
<Link href="/deals" prefetch={true}>
```

Next.js prefetches Links that enter the viewport by default, but for the primary CTA this should be prefetched eagerly regardless of viewport position.

**Route transition indicator**: On mobile, route transitions can feel slow if no visual feedback is provided. Next.js App Router shows a loading state if `loading.tsx` exists. Verify that all routes with data fetching have loading states (see `07-frontend.md` Section 8 for missing loading states).

### 6.3 Bottom Navigation Implementation (if planned)

The `pb-20 md:pb-0` pattern suggests a bottom nav is planned. Key performance considerations:

```tsx
// Mobile bottom nav should be:
// 1. Lightweight -- no auth state, no data fetching
// 2. Static HTML where possible (server component with client islands)
// 3. Fixed position with GPU compositing hint

// Example implementation pattern:
export function MobileBottomNav() {
  const pathname = usePathname() // Only client hook needed

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-40
        md:hidden
        bg-[#e8ddd0]/95 backdrop-blur-sm
        border-t border-[#d4c4b0]
        safe-area-bottom
        will-change-transform
      "
      style={{
        // Hardware acceleration for smooth scroll-hide behavior
        transform: 'translate3d(0, 0, 0)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-16">
        {/* 4-5 nav items with 44px+ touch targets */}
      </div>
    </nav>
  )
}
```

**Performance requirements**:
- Must not jank during scroll (use `will-change-transform` or `transform: translateZ(0)` to promote to composited layer)
- Must respect safe area insets for notched devices (see Section 10)
- Must not re-render on scroll events
- Keep under 2KB client JS

### 6.4 Scroll-to-Hide Bottom Nav (Optional)

A pattern used by many mobile apps: hide the bottom nav on scroll-down, show on scroll-up. This recovers 80px of viewport on mobile.

```tsx
// src/lib/hooks/useScrollDirection.ts
'use client'

import { useEffect, useRef, useState } from 'react'

export function useScrollDirection() {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const lastScrollY = useRef(0)

  useEffect(() => {
    const threshold = 10 // Minimum scroll distance to trigger

    function handleScroll() {
      const currentScrollY = window.scrollY
      const diff = currentScrollY - lastScrollY.current

      if (Math.abs(diff) < threshold) return

      setDirection(diff > 0 ? 'down' : 'up')
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return direction
}
```

```tsx
// In MobileBottomNav:
const direction = useScrollDirection()

<nav className={`
  fixed bottom-0 left-0 right-0 z-40 md:hidden
  transition-transform duration-300
  ${direction === 'down' ? 'translate-y-full' : 'translate-y-0'}
`}>
```

---

## 7. PWA & Offline Strategy

### 7.1 PWA Assessment for CostFinders

| Factor | Assessment |
|---|---|
| **User revisit frequency** | Medium -- users compare deals over days/weeks |
| **Content freshness** | High -- deals change frequently (1h ISR) |
| **Offline utility** | Low -- deal data is the value, which requires fresh server data |
| **Install motivation** | Low -- no push notifications, no offline-first features |
| **Add-to-homescreen value** | Medium -- removes browser chrome, provides app icon |
| **Competitor benchmark** | Groupon: PWA; Kayak: native app; Zocdoc: native app |

**Recommendation**: Implement a **light PWA** -- web app manifest for add-to-homescreen + a caching service worker for static assets and ISR page shell. Do NOT implement offline-first data sync or push notifications at this stage.

### 7.2 Web App Manifest

```tsx
// src/app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CostFinders - Compare MedSpa Prices',
    short_name: 'CostFinders',
    description: 'Find and compare the best medspa deals near you.',
    start_url: '/deals',
    display: 'standalone',
    background_color: '#e8ddd0',
    theme_color: '#92400e',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['health', 'beauty', 'shopping'],
  }
}
```

**Note on `start_url`**: Set to `/deals` rather than `/` because users who install the PWA are likely repeat visitors looking for deals, not first-time visitors who need the marketing homepage.

**Required icon assets**: Generate `icon-192.png` and `icon-512.png` from the existing `icon.png`. The 512px icon should use the `maskable` purpose for Android adaptive icons.

### 7.3 Service Worker Strategy

**Approach**: Runtime caching with `next-pwa` or a manual service worker. Given that the project does not currently use `next-pwa`, a lightweight manual approach is recommended.

**Caching strategy by asset type**:

| Asset Type | Strategy | TTL | Rationale |
|---|---|---|---|
| `_next/static/*` (JS, CSS) | Cache First | Immutable (content-hashed) | Never changes for a given hash |
| Font files (`_next/static/media/*`) | Cache First | Immutable | Same as above |
| `public/images/*` | Cache First | 30 days | Decorative, rarely changes |
| ISR HTML pages (`/`, `/deals/*`, `/treatments/*`) | Network First, Cache Fallback | 1 hour | Show fresh data when online, cached version when offline |
| API routes | Network Only | -- | Never cache user-specific data |

**Service worker registration** (in layout or a client component):

```tsx
// src/lib/hooks/useServiceWorker.ts
'use client'

import { useEffect } from 'react'

export function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed -- not critical
      })
    }
  }, [])
}
```

### 7.4 Offline Fallback Page

When the user is offline and tries to navigate to a page not in the cache, show a branded offline page:

```tsx
// public/offline.html (static HTML, no framework dependency)
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline | CostFinders</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #e8ddd0;
      color: #451a03;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .container { max-width: 400px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #78350f; font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
    button {
      background: #92400e;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
    }
    button:active { transform: scale(0.97); }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>CostFinders needs an internet connection to show you the latest medspa deals. Check your connection and try again.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>
```

### 7.5 What NOT to Implement

| Feature | Reason to Skip |
|---|---|
| **Offline deal browsing** | Deal data changes hourly. Stale cached deals would show incorrect prices, creating trust issues. |
| **Push notifications** | Requires backend infrastructure (web push subscriptions, notification server). Out of scope for current build. |
| **Background sync** | No offline write operations exist (deal claims require real-time verification). |
| **Full offline-first architecture** | The value proposition is comparing live prices. An offline-first approach would require significant data sync infrastructure for minimal user benefit. |

---

## 8. Mobile Image Optimization

### 8.1 Mobile `sizes` Attribute Audit

The `sizes` attribute tells the browser which image width to request based on viewport. Incorrect `sizes` values waste bandwidth on mobile.

| Component | Current `sizes` | Mobile Viewport (375px) | Requested Width | Correct? |
|---|---|---|---|---|
| Hero bg | `100vw` | 375px | 640px (nearest deviceSize) | **Yes** -- full bleed |
| City grid images | `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw` | 375px | 640px | **Borderline** -- correct but could be `100vw` on mobile for single-column |
| DealCard `BlurredImage` (grid) | `(max-width: 768px) 100vw, 33vw` | 375px | 640px | **Too large** -- the blurred image should request tiny source (see Section 2.4) |
| DealCard `BlurredImage` (list) | `192px` | 375px | 256px (nearest imageSize) | **Correct** for list variant |
| Treatments hero | `100vw` | 375px | 640px | **Yes** |
| Value props bg | `100vw` | 375px | 640px | **Yes** |
| Header icon | No `sizes` | 375px | Default | Should be `36px` or use pre-optimized tiny image |

**Key fix**: The `BlurredImage` `sizes` attribute should be `48px` for both variants when images are blurred (per `07-frontend.md` Section 5.4). This single change prevents mobile browsers from downloading 640px images for blurred thumbnails.

### 8.2 Art Direction with `<picture>` for Hero Images

The hero images are full-bleed landscape photos. On mobile, the composition often loses impact because the subject is small in a wide frame. Art direction allows serving different crops:

```tsx
// Pattern for mobile-optimized hero (future enhancement)
// When Cloudinary is active, use URL transforms for different crops:

// Mobile: Taller crop (3:4) focused on the subject
// Desktop: Wide crop (16:9) for full-bleed

// In heroSection.tsx:
<Image
  src="/images/homepage/hero-bg.webp"
  alt=""
  fill
  className="object-cover"
  sizes="100vw"
  priority
  // When Cloudinary URLs are available:
  // src={isMobile
  //   ? 'https://res.cloudinary.com/.../c_crop,ar_3:4,g_auto/hero.jpg'
  //   : 'https://res.cloudinary.com/.../c_crop,ar_16:9,g_auto/hero.jpg'
  // }
/>
```

For now (with local images), this is not actionable. When Cloudinary integration is live, implement responsive art direction via Cloudinary URL transforms.

### 8.3 Image Loading Priority on Mobile

On mobile, the viewport shows less content. Adjust image loading accordingly:

| Image | Mobile Viewport Position | Recommended `loading` | Recommended `priority` |
|---|---|---|---|
| Hero background | Above fold | `eager` | `true` |
| Header icon | Above fold | `eager` | `true` (or pre-optimized tiny WebP) |
| Trending deals (first card) | Barely visible / at fold | `lazy` | `false` |
| Trending deals (cards 2-6) | Below fold | `lazy` | `false` |
| City grid images | Below fold | `lazy` | `false` |
| Value props background | Far below fold | `lazy` | `false` |

The current configuration is correct for all cases except the header icon (see `07-frontend.md` Section 5.5).

### 8.4 Mobile Image Format Savings

With the `deviceSizes` reduction from `07-frontend.md` Section 2.4, mobile image requests are bounded:

| Source Image | Mobile Request (375px vw) | Format | Estimated Size |
|---|---|---|---|
| Hero bg (637KB PNG) | 640px wide | AVIF | ~30-50KB |
| City image (963KB PNG) | 640px wide | AVIF | ~25-40KB |
| Treatments hero (795KB PNG) | 640px wide | AVIF | ~30-45KB |
| Value props bg (697KB PNG) | 640px wide | AVIF | ~25-40KB |
| BlurredImage (with `sizes="48px"` fix) | 48px wide | AVIF | ~0.5-1KB |

With the source image pre-optimization from `07-frontend.md` Section 5.1 (converting PNGs to WebP), the pipeline becomes:

```
Source WebP (~100KB) → Vercel Image Optimization → AVIF (640px, ~25-40KB) → Mobile browser
```

**Total mobile image payload for homepage**: ~130-200KB (down from ~2.5MB with current unoptimized PNGs).

---

## 9. Input Optimization

### 9.1 Price Range Filter Mobile Behavior

The `PriceRangeFilter` component uses `<input type="number">`. On mobile, this triggers:

- **iOS**: Numeric keyboard with +/- buttons (correct)
- **Android**: Full keyboard with number row visible

**Current implementation is acceptable**. The component already:
- Hides spinner buttons via `[appearance:textfield]` and webkit spin button overrides
- Uses `min={0}` to prevent negative values
- Has `min-h-[44px]` for touch targets
- Includes proper `aria-label` attributes

**Enhancement -- inputMode for better mobile keyboard**:

```tsx
<input
  type="number"
  inputMode="decimal"   // Shows numeric keyboard without +/- on iOS
  pattern="[0-9]*"      // Triggers numeric keyboard on older iOS
  min={0}
  // ... rest of props
/>
```

The `inputMode="decimal"` attribute provides a cleaner numeric keyboard on mobile without the `+/-` buttons that `type="number"` triggers on iOS.

### 9.2 Search Input Behavior (Future)

No search input currently exists on public pages. When implemented:

```tsx
// Mobile search input best practices:
<input
  type="search"
  inputMode="search"
  enterKeyHint="search"        // Shows "Search" on mobile keyboard return key
  autoComplete="off"           // Prevent address bar autocomplete interference
  autoCapitalize="none"        // Don't capitalize search terms
  spellCheck={false}           // Don't spellcheck search queries
  className="min-h-[44px] ..." // Touch-friendly height
/>
```

### 9.3 Form Autofill on Mobile

The `AuthModal` (dynamically imported) likely contains email/password inputs. Ensure proper `autoComplete` attributes for mobile autofill:

```tsx
// Login form
<input type="email" autoComplete="email" />
<input type="password" autoComplete="current-password" />

// Registration form
<input type="email" autoComplete="email" />
<input type="password" autoComplete="new-password" />
<input type="text" autoComplete="given-name" />  // First name
<input type="text" autoComplete="family-name" /> // Last name
```

These attributes enable iOS Keychain, Android Smart Lock, and third-party password managers to autofill on mobile, reducing friction in the deal claim flow.

### 9.4 Keyboard Management

**Problem**: When a mobile keyboard opens (e.g., on the price filter), it pushes the viewport up. If the input is near the bottom of the screen, it can push the fixed header off-screen or cause layout jumps.

**Mitigation**:

```css
/* Prevent layout shift when mobile keyboard opens */
/* The Visual Viewport API handles this in modern browsers */
html {
  /* Prevent the browser from scrolling the page when keyboard opens */
  overflow-anchor: auto;
}

/* Ensure inputs scroll into view when focused */
input:focus, textarea:focus, select:focus {
  scroll-margin-top: 80px;   /* Clear the fixed header */
  scroll-margin-bottom: 20px;
}
```

---

## 10. Viewport & Layout

### 10.1 Current Viewport Configuration

**Next.js default viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1">`

**Missing configuration**: No explicit `viewport` export in `layout.tsx`. Next.js uses its default, which is adequate but not optimized for mobile.

**Recommended viewport configuration**:

```tsx
// In src/app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,           // Allow zoom for accessibility (don't set to 1)
  viewportFit: 'cover',      // Extend content into safe area insets
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e8ddd0' },
  ],
}
```

**Key decisions**:
- `maximumScale: 5` (not `1`): Never disable zoom. WCAG 2.1 Success Criterion 1.4.4 requires users to be able to zoom to 200%. Setting `maximumScale: 1` or `user-scalable: no` fails accessibility audits and is penalized by Lighthouse.
- `viewportFit: 'cover'`: Required for safe area inset support on notched devices (iPhone X+).
- `themeColor`: Colors the browser chrome (URL bar, status bar) with the warm sand background.

### 10.2 Safe Area Insets

With `viewportFit: 'cover'`, content extends behind the notch and home indicator on modern iPhones. Without safe area inset handling, the fixed header and bottom nav will overlap with system UI.

**CSS additions for `globals.css`**:

```css
/* Safe area insets for notched devices */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}

/* Fixed header: account for notch */
.fixed-header {
  padding-top: var(--safe-area-top);
}

/* Bottom nav: account for home indicator */
.safe-area-bottom {
  padding-bottom: var(--safe-area-bottom);
}

/* Main content: account for both */
.safe-area-padding {
  padding-left: max(var(--safe-area-left), 1rem);
  padding-right: max(var(--safe-area-right), 1rem);
}
```

**Component updates**:

```tsx
// GlobalHeader: Add safe area top
<header className="fixed top-0 left-0 right-0 z-40 bg-[#e8ddd0]/95 backdrop-blur-sm border-b border-[#d4c4b0] pt-[env(safe-area-inset-top)]">

// Bottom nav (when implemented):
<nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">

// Main content areas: adjust pt-20 to account for safe area
// pt-20 = 80px (header height). With safe area: calc(80px + env(safe-area-inset-top))
<main className="pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
```

### 10.3 Overscroll Behavior

Prevent the "rubber band" overscroll effect from pulling the entire page when scrolling reaches the top/bottom. This is particularly important for modal/sheet components:

```css
/* Prevent overscroll bounce on the main page body */
html {
  overscroll-behavior-y: none;
}

/* Allow overscroll inside scrollable containers (natural feel) */
.overflow-y-auto,
.overflow-y-scroll {
  overscroll-behavior-y: contain;
}
```

The `overscroll-behavior-y: none` on `html` prevents the "pull to refresh" gesture on Chrome Android from interfering with the app. `contain` on scrollable containers prevents scroll chaining (scrolling past the end of a container scrolls the parent page).

### 10.4 Landscape Orientation

**Assessment**: The app is primarily portrait-oriented (deal browsing, vertical card lists). Landscape support is not critical but should not break the layout.

**Current state**: The responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) handles landscape on phones correctly:
- iPhone landscape: `sm` breakpoint triggers → 2-column grid
- Tablet landscape: `lg` breakpoint → 3-column grid

**Issue**: The hero section uses `min-h-[70vh] sm:min-h-[80vh]`. In landscape orientation on a phone (320px viewport height), this creates a hero that is 224px tall -- barely enough for the headline. The category chips may be cut off.

**Fix**:

```tsx
// In heroSection.tsx -- use min-h that adapts to orientation
<section className="relative w-full min-h-[70vh] min-h-[70svh] sm:min-h-[80vh] sm:min-h-[80svh] flex items-center overflow-hidden">
```

The `svh` unit (small viewport height) accounts for the mobile browser chrome. On portrait phones, `70svh` = 70% of the viewport excluding the URL bar. This prevents the hero from being too tall when the URL bar is visible.

### 10.5 Text Size and Readability on Mobile

**Current state**: Typography scales are reasonable for mobile:
- Hero headline: `text-4xl` (36px) on mobile → readable
- Deal card title: `font-semibold` (default size, ~16px) → readable
- Deal card pricing: `text-xl font-bold font-mono` → prominent
- Secondary text: `text-sm` (14px) → acceptable minimum

**Concern**: Some text uses `text-xs` (12px), which is below the 14px minimum recommended for body text on mobile:

| Location | Text Size | Content | Recommendation |
|---|---|---|---|
| Category badge label | `text-xs` (12px) | "Botox", "Fillers" | Acceptable -- short labels |
| Sponsored indicator | `text-xs` (12px) | "Sponsored" | Acceptable -- short label |
| Unit info | `text-xs` (12px) | "per unit" | Acceptable -- supplementary |
| Location text in OfferCard | `text-xs` (12px) | "Provider in Miami" | **Borderline** -- consider `text-sm` |
| Step labels in ValueProps | `text-xs` (12px) | "STEP 01" | Acceptable -- uppercase tracking increases readability |

No critical issues. The 12px text is used only for supplementary labels, not for primary content.

---

## 11. Loading State Quality on Mobile

### 11.1 Current Loading State Assessment (Mobile Context)

| Loading State | Mobile Experience | Issue |
|---|---|---|
| Root `loading.tsx` | Single rectangle + 6-card grid | Does not match homepage layout; hero skeleton is too short for mobile `min-h-[70vh]` |
| Deals `loading.tsx` | Header skeleton + 9-card grid | Shows 9 cards, but mobile only sees 1 at a time (single-column). 9 is wasteful. |
| Treatments `loading.tsx` | Header skeleton + 6-card grid | Same column issue as deals. |
| Deal detail | No loading state | Falls through to root. Mismatch with detail layout. |
| Provider page | No loading state | Falls through to root. |

### 11.2 Mobile-Specific Loading State Improvements

**A. Root loading.tsx -- Match mobile viewport**:

```tsx
export default function Loading() {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Hero skeleton -- match actual hero height */}
        <div className="min-h-[60vh] sm:min-h-[70vh] bg-[#f2ebe2] border border-[#d4c4b0] rounded-2xl mb-8 skeleton-shimmer" />

        {/* Section heading skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 bg-[#d4c4b0] rounded skeleton-shimmer" />
          <div className="h-6 w-36 bg-[#d4c4b0] rounded skeleton-shimmer" />
        </div>

        {/* Content grid -- show 3 on mobile (visible count), 6 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="h-[340px] bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl skeleton-shimmer"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
          {/* Additional cards hidden on mobile, visible on desktop */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skel-desktop-${i}`}
              className="hidden sm:block h-[340px] bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl skeleton-shimmer"
              style={{ animationDelay: `${(i + 3) * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
```

**B. Deals loading.tsx -- Reduce card count on mobile**:

The current deals loading shows 9 skeleton cards. On mobile (single-column), only 1-2 are visible. Rendering 9 skeleton cards adds unnecessary DOM weight during the loading phase.

```tsx
// Show 3 cards on mobile, 9 on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  {Array.from({ length: 3 }).map((_, i) => (
    <div key={`deal-skel-${i}`} className="h-56 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl skeleton-shimmer" />
  ))}
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={`deal-skel-desktop-${i}`} className="hidden sm:block h-56 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl skeleton-shimmer" />
  ))}
</div>
```

---

## 12. Implementation Plan & Expected Impact

### Priority Matrix

| # | Optimization | Effort | Mobile Impact | Depends On |
|---|---|---|---|---|
| **P0 -- Critical (do first)** | | | | |
| 1 | Viewport configuration (Section 10.1) | Low | Enables safe area support, theme color | None |
| 2 | Safe area insets (Section 10.2) | Low | Prevents notch overlap | #1 |
| 3 | Touch target fixes (Section 3.1) | Low | 5 non-compliant elements | None |
| 4 | `touch-action: manipulation` (Section 3.2) | Low | Eliminates residual tap delay | None |
| 5 | Active state feedback (Section 3.4) | Low | Immediate tap feedback | None |
| **P1 -- High Impact** | | | | |
| 6 | `content-visibility: auto` for card grids (Section 5.4) | Low | 50-70% render time reduction for card grids | None |
| 7 | Overscroll behavior (Section 10.3) | Low | Prevents pull-to-refresh interference | None |
| 8 | `BlurredImage` mobile optimization (Section 2.4) | Medium | Eliminates 30 GPU layers on listing pages | None |
| 9 | Shared IntersectionObserver (Section 3.3) | Medium | 20 observers → 1 on homepage | None |
| 10 | Skeleton shimmer animation (Section 4.4) | Low | Better perceived loading speed | None |
| 11 | Progressive rendering for deal grids (Section 5.3) | Medium | Faster first paint on listing pages | None |
| **P2 -- Medium Impact** | | | | |
| 12 | Web app manifest (Section 7.2) | Low | Enables add-to-homescreen | Generate icon assets |
| 13 | Network quality hook (Section 4.1) | Medium | Adaptive loading for slow connections | None |
| 14 | Mobile loading state improvements (Section 11) | Medium | Better skeleton fidelity on mobile | None |
| 15 | Keyboard management CSS (Section 9.4) | Low | Prevents layout shift on input focus | None |
| 16 | Price filter `inputMode` (Section 9.1) | Low | Cleaner mobile keyboard | None |
| **P3 -- Lower Priority** | | | | |
| 17 | Service worker (Section 7.3) | High | Offline fallback, static asset caching | #12 |
| 18 | Scroll-to-hide bottom nav (Section 6.4) | Medium | Recovers 80px viewport | Bottom nav implementation |
| 19 | Hero art direction (Section 8.2) | Medium | Better mobile hero composition | Cloudinary integration |
| 20 | Data saver mode (Section 4.3) | Medium | Bandwidth reduction for data-saver users | #13 |
| 21 | Landscape hero fix (Section 10.4) | Low | Prevents hero cutoff in landscape | None |

### Expected Mobile Performance Improvements

| Metric | Current (Estimated) | After P0-P1 | After All | Notes |
|---|---|---|---|---|
| **LCP** | 3-4s | 2-2.5s | 1.5-2s | Largest gains from `07-frontend.md` (CSS-only hero, image pre-optimization) |
| **INP** | 150-250ms | 100-150ms | <100ms | `content-visibility`, shared observer, progressive rendering |
| **CLS** | 0.05-0.15 | <0.05 | <0.025 | Safe area insets, font fallback adjustment, contain-intrinsic-size |
| **FCP** | 2-3s | 1.5-2s | 1-1.5s | Auth provider removal (from `05-backend.md`), server components |
| **TTI** | 4-5s | 2.5-3.5s | 2-2.5s | Bundle reduction, deferred non-critical JS, progressive rendering |
| **Total JS (gzipped)** | 170-200KB | 130-150KB | 100-130KB | Per `07-frontend.md` optimizations |
| **GPU memory (30-card listing)** | 30-120MB | 5-15MB | <5MB | BlurredImage optimization + gradient placeholder |
| **Image payload (homepage, mobile)** | ~2.5MB | ~200-300KB | ~130-200KB | Pre-optimization + `sizes` fixes |

### Dependencies on Other Plans

| This Plan Section | Depends On | Blocking? |
|---|---|---|
| Section 2.2 (hydration cost) | `07-frontend.md` Sections 2-3 (component splitting) | Yes -- implement component splitting first |
| Section 2.2 (auth provider removal) | `05-backend.md` Section 1.2 (route group layouts) | Yes -- architectural change required |
| Section 6.2 (route transition) | `07-frontend.md` Section 8 (loading states) | Partial -- missing loading states should be added |
| Section 7.3 (service worker) | `08-cdn.md` Section 3 (cache headers) | Partial -- cache headers inform SW caching strategy |
| Section 8 (image optimization) | `07-frontend.md` Section 5 (source image pre-optimization) | Yes -- pre-optimize source images before mobile sizes matter |

### Implementation Approach

**Phase 1 (P0 + P1, 1-2 days)**: CSS-only changes. No component refactoring. Viewport config, safe areas, touch targets, `content-visibility`, overscroll, shimmer animation. These can be done in a single PR with no risk of breaking changes.

**Phase 2 (P1-P2, 2-3 days)**: Component-level changes. BlurredImage optimization, shared IntersectionObserver, progressive rendering, web app manifest, mobile loading states. Requires testing on real devices.

**Phase 3 (P2-P3, 3-5 days)**: Feature additions. Service worker, network quality hook, data saver mode. These add new capabilities and require more extensive testing.

**Testing plan**: All mobile optimizations should be validated on:
1. Chrome DevTools mobile emulation (Moto G Power, 4x CPU throttle)
2. Safari on iOS (real device or BrowserStack)
3. Chrome on Android (real device or BrowserStack)
4. Lighthouse mobile audit (target: Performance 90+, Accessibility 95+)
