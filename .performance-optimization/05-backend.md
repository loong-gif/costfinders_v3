# CostFinders v2 -- Backend & Server Optimization Plan

**Date**: 2026-03-21
**Scope**: Provider architecture, client/server component boundaries, server action patterns, import optimization, caching strategy, metadata deduplication
**Depends on**: `01-profiling.md` (issue inventory), `04-database.md` (RPC functions, query optimizations)

---

## Table of Contents

1. [Provider Optimization](#1-provider-optimization)
2. [Client/Server Component Boundary Optimization](#2-clientserver-component-boundary-optimization)
3. [Server Action Improvements](#3-server-action-improvements)
4. [Import Optimization](#4-import-optimization)
5. [Metadata Optimization](#5-metadata-optimization)
6. [Caching Strategy](#6-caching-strategy)
7. [Implementation Plan](#7-implementation-plan)

---

## 1. Provider Optimization

### 1.1 Problem Statement

The root layout (`src/app/layout.tsx:81-88`) wraps every page in three nested `'use client'` context providers:

```tsx
<AuthProvider>        // 449 lines, creates Supabase browser client, calls getUser() on mount
  <BusinessAuthProvider>  // 395 lines, creates another Supabase browser client, calls getUser() on mount
    <ClaimsProvider>      // 215 lines, depends on AuthProvider, fetches claims if authenticated
      <GlobalHeader />
      {children}
    </ClaimsProvider>
  </BusinessAuthProvider>
</AuthProvider>
```

**Cost for anonymous visitors (majority of traffic):**
- ~15-25KB client JS (3 providers + 2 Supabase browser clients + server action stubs)
- 2 network requests to Supabase Auth on every page load (`supabase.auth.getUser()` in both `AuthProvider` and `BusinessAuthProvider`)
- `BusinessAuthProvider` also re-hydrates on every tab visibility change (`visibilitychange` event at line 182-187)

**Root cause**: Every page, including fully static public pages (homepage, deals, treatments, guides), loads all auth infrastructure whether or not the visitor is authenticated.

### 1.2 Solution: Route Group Layout Splitting

Split the root layout into two route groups: public pages that do not need auth providers, and authenticated pages that do.

**Before** (single root layout wraps everything):
```
src/app/layout.tsx  <-- AuthProvider + BusinessAuthProvider + ClaimsProvider
  ├── page.tsx (homepage)
  ├── deals/
  ├── treatments/
  ├── guides/
  ├── dashboard/
  ├── business/
  └── admin/
```

**After** (providers only on authenticated routes):
```
src/app/layout.tsx  <-- Minimal: fonts, metadata, Analytics, SpeedInsights. NO providers.
  ├── (public)/
  │   ├── layout.tsx  <-- GlobalHeader (server version) + {children}
  │   ├── page.tsx (homepage)
  │   ├── deals/
  │   ├── treatments/
  │   ├── guides/
  │   └── [state]/
  ├── (auth)/
  │   ├── layout.tsx  <-- AuthProvider + ClaimsProvider + GlobalHeader (client)
  │   ├── dashboard/
  │   └── account/
  ├── (business)/
  │   ├── layout.tsx  <-- BusinessAuthProvider + business nav
  │   └── business/
  └── (admin)/
      ├── layout.tsx  <-- Admin auth provider + admin nav
      └── admin/
```

**Root layout becomes minimal:**

```tsx
// src/app/layout.tsx -- AFTER
import type { Metadata } from 'next'
import { Sora, Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { OrganizationSchema, WebsiteSchema } from '@/components/seo'
import './globals.css'

const sora = Sora({ variable: '--font-sora', subsets: ['latin'], display: 'swap', preload: true, weight: ['400', '500', '600', '700'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = { /* ... unchanged ... */ }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${manrope.variable} font-sans antialiased`}>
        <WebsiteSchema />
        <OrganizationSchema />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Public layout -- no providers, server-rendered header:**

```tsx
// src/app/(public)/layout.tsx
import { PublicHeader } from '@/components/layout/publicHeader'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  )
}
```

**Auth layout -- providers only here:**

```tsx
// src/app/(auth)/layout.tsx
import { AuthProvider } from '@/lib/context/authContext'
import { ClaimsProvider } from '@/lib/context/claimsContext'
import { GlobalHeader } from '@/components/layout/globalHeader'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClaimsProvider>
        <GlobalHeader />
        {children}
      </ClaimsProvider>
    </AuthProvider>
  )
}
```

### 1.3 Solution: Public Header as Server Component

Create a minimal server-rendered header for public pages that does not import `useAuth`, `useScrolled`, or the Supabase browser client.

```tsx
// src/components/layout/publicHeader.tsx -- Server Component (no 'use client')
import Image from 'next/image'
import Link from 'next/link'
import { SignIn } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import { AuthModalTrigger } from '@/components/layout/authModalTrigger'

export function PublicHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#e8ddd0]/95 backdrop-blur-sm border-b border-[#d4c4b0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon.png" alt="CostFinders" width={36} height={36} />
          <span className="font-bold text-xl text-amber-800">CostFinders</span>
        </Link>
        <AuthModalTrigger />
      </div>
    </header>
  )
}
```

```tsx
// src/components/layout/authModalTrigger.tsx -- Small client island for modal only
'use client'

import { SignIn } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)

export function AuthModalTrigger() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'signIn' | 'signUp'>('signIn')

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => { setView('signIn'); setIsOpen(true) }}
        className="text-sm text-[#78350f] hover:text-[#451a03] transition-colors hidden sm:block cursor-pointer">
        Sign in
      </button>
      <Button variant="primary" size="sm" onClick={() => { setView('signUp'); setIsOpen(true) }}>
        <SignIn size={18} weight="bold" />
        <span className="hidden sm:inline">Get Started</span>
      </Button>
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialView={view} onSuccess={() => setIsOpen(false)} />
    </div>
  )
}
```

**Impact**: Public pages no longer ship `AuthProvider` (449 lines), `BusinessAuthProvider` (395 lines), `ClaimsProvider` (215 lines), two Supabase browser clients, or server action stubs. Estimated savings: **15-25KB client JS** and **2 eliminated network requests** on every public page load.

### 1.4 Solution: Debounce BusinessAuthProvider Visibility Re-hydration

The `BusinessAuthProvider` at line 182-187 fires `hydrateUser()` on every `visibilitychange` event (every tab focus). This triggers `supabase.auth.getUser()` + `getBusinessProfileAction()` network requests.

**Before:**
```tsx
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    hydrateUser()
  }
}
```

**After** (debounce with 5-second cooldown):
```tsx
const lastHydrateRef = useRef(0)

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    const now = Date.now()
    if (now - lastHydrateRef.current > 5000) {
      lastHydrateRef.current = now
      hydrateUser()
    }
  }
}
```

**Impact**: Prevents rapid-fire auth calls when user switches between tabs quickly. Minimal code change, prevents unnecessary Supabase round-trips.

---

## 2. Client/Server Component Boundary Optimization

### 2.1 Problem: DealCard Forces Client Rendering of All Deal Listings

`DealCard` (`src/components/features/dealCard.tsx`) is `'use client'` because it imports `SaveButton`, which calls `useAuth()`. This means every deal listing page (20-50 cards) hydrates all cards client-side, even though the card content is fully static except for the save button.

**Before** (entire DealCard is client):
```tsx
'use client'
// ... 206 lines of client component
export function DealCard({ deal }: DealCardProps) {
  return (
    <Card>
      {/* ...static content... */}
      <SaveButton dealId={deal.id} size="sm" />  {/* <-- only interactive element */}
      {/* ...more static content... */}
    </Card>
  )
}
```

**After** (Server DealCard with client SaveButton island):
```tsx
// src/components/features/dealCard.tsx -- Server Component (no 'use client')
import { Lock, MapPin, ShieldCheck, Star } from '@phosphor-icons/react/dist/ssr'
import { SaveButton } from '@/components/patterns/saveButton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DealCardIcon } from './dealCardIcon'
import type { AnonymousDeal } from '@/types/deal'

export function DealCard({ deal, variant = 'grid' }: DealCardProps) {
  // ... same rendering logic, but now server-rendered
  // SaveButton remains a client island
  return (
    <Card variant="glass" padding="none" hover>
      {/* Static content server-rendered */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <SaveButton dealId={deal.id} size="sm" />
        {/* badges... */}
      </div>
      {/* ... rest of static card content ... */}
    </Card>
  )
}
```

**Key requirement**: `Card` component must not require `'use client'` for the `hover` and `onClick` props. If `Card` uses `onClick`, extract that to a wrapper:

```tsx
// For deal listing pages (no onClick needed):
<DealCard deal={deal} />

// For pages needing click handler, wrap in a client Link:
<Link href={`/deals/${deal.id}`}><DealCard deal={deal} /></Link>
```

**Impact**: 20-50 deal cards per listing page go from fully hydrated client components to server-rendered HTML with tiny client islands (SaveButton only). Estimated savings: **5-10KB JS per listing page**, faster TTI.

### 2.2 Problem: Homepage Sections Unnecessarily Client-Rendered

Five homepage sections are marked `'use client'` solely because they use `ScrollRevealItem` or `useScrollReveal` for entrance animations. The actual content is fully static.

| Component | Lines | Reason for `'use client'` | Content Type |
|-----------|-------|---------------------------|-------------|
| `trendingDealsSection.tsx` | 75 | `ScrollRevealItem` | Static deals grid with links |
| `categoryGrid.tsx` | 81 | `ScrollRevealItem` | Static category cards with links |
| `cityGrid.tsx` | 86 | `ScrollRevealItem` | Static city cards with links |
| `valuePropsSection.tsx` | 162 | `useScrollReveal` | Static "How it works" content |
| `socialProofSection.tsx` | 113 | `ScrollReveal` + `AnimatedCounter` | Static stats display |

**Solution A: CSS-only scroll animations (preferred)**

Replace the JS-based `useScrollReveal` with the native CSS `@starting-style` rule + `IntersectionObserver`-free approach, or use the CSS `animation-timeline: view()` property (supported in Chrome 115+, Safari 18+):

```css
/* In globals.css -- replace JS scroll reveal */
@supports (animation-timeline: view()) {
  [data-animate] {
    animation: fadeInUp linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 30%;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fallback for unsupported browsers: show immediately */
@supports not (animation-timeline: view()) {
  [data-animate] {
    opacity: 1;
    transform: none;
  }
}
```

Then the homepage sections become server components:

```tsx
// src/components/features/homepage/trendingDealsSection.tsx -- AFTER (Server Component)
import { ArrowRight, Fire } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { OfferCard } from '@/components/features/offerCard'
import type { OfferWithBusiness } from '@/types/supabase'

export function TrendingDealsSection({ offers }: { offers: OfferWithBusiness[] }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* heading... */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <div key={offer.id} data-animate>
              <Link href={`/deals/${offer.id}`} className="block">
                <OfferCard offer={offer} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Solution B: Minimal client wrapper (if CSS-only is insufficient)**

Keep the `ScrollRevealItem` as a tiny client component (~30 lines) but make the parent sections server components. Pass static children as React Server Component children through the client wrapper:

```tsx
// Parent section is a Server Component
export function TrendingDealsSection({ offers }: Props) {
  return (
    <section>
      {offers.map((offer, index) => (
        <ScrollRevealItem key={offer.id} index={index}>
          {/* This content is server-rendered, passed as children */}
          <Link href={`/deals/${offer.id}`}><OfferCard offer={offer} /></Link>
        </ScrollRevealItem>
      ))}
    </section>
  )
}
```

This works because React can pass server-rendered children through a client component boundary. The `ScrollRevealItem` only manages the intersection observer; it does not need to re-render its children.

**Impact**: ~400 lines of homepage components move from client to server. Estimated savings: **8-15KB client JS** on the homepage.

### 2.3 Problem: HeroSection Client-Only for Entrance Animation

`HeroSection` (130 lines) is `'use client'` solely for this pattern:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
// ... className includes `mounted ? 'opacity-100' : 'opacity-0'`
```

This is a mount animation that can be replaced with CSS:

```css
/* In globals.css */
@keyframes heroEntrance {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero-animate {
  animation: heroEntrance 700ms ease-out forwards;
}

.hero-animate-delay-200 { animation-delay: 200ms; opacity: 0; }
.hero-animate-delay-400 { animation-delay: 400ms; opacity: 0; }
.hero-animate-delay-500 { animation-delay: 500ms; opacity: 0; }
.hero-animate-delay-700 { animation-delay: 700ms; opacity: 0; }
```

Then `HeroSection` becomes a Server Component using the `/dist/ssr` icon import.

**Impact**: Removes ~130 lines of client JS + `useState`/`useEffect` from the homepage critical path.

### 2.4 Summary: Component Boundary Changes

| Component | Current | Proposed | JS Savings |
|-----------|---------|----------|-----------|
| `DealCard` | Client (206 lines) | Server + SaveButton island | ~5KB per listing page |
| `HeroSection` | Client (130 lines) | Server (CSS animations) | ~3KB |
| `TrendingDealsSection` | Client (75 lines) | Server | ~2KB |
| `CategoryGrid` | Client (81 lines) | Server | ~2KB |
| `CityGrid` | Client (86 lines) | Server | ~2KB |
| `ValuePropsSection` | Client (162 lines) | Server | ~3KB |
| `SocialProofSection` | Client (113 lines) | Server (except AnimatedCounter) | ~2KB |
| `GlobalHeader` (public) | Client (103 lines) | Server + AuthModalTrigger island | ~3KB |

---

## 3. Server Action Improvements

### 3.1 Error Handling: Consistent but with Logging Gap

All 17 server action files follow the same try/catch pattern:

```tsx
try {
  // ... logic
} catch {
  return { success: false, error: 'An unexpected error occurred.' }
}
```

**Issue**: The `catch` block discards the error entirely. No `console.error`, no error reporting service, no request ID. When something fails in production, there is zero diagnostic information.

**Fix: Add structured error logging**

```tsx
// src/lib/actions/error-handler.ts -- Shared error handler
export function handleActionError(
  actionName: string,
  error: unknown,
): { success: false; error: string } {
  const message = error instanceof Error ? error.message : String(error)

  // Log with action name for traceability
  console.error(`[${actionName}] Unhandled error:`, message)

  // Future: send to error reporting service (Sentry, Vercel Log Drain, etc.)
  // reportError({ action: actionName, error: message, timestamp: Date.now() })

  return {
    success: false,
    error: 'An unexpected error occurred.',
  }
}
```

**Before** (every action file):
```tsx
} catch {
  return { success: false, error: 'An unexpected error occurred.' }
}
```

**After**:
```tsx
} catch (error) {
  return handleActionError('createClaimAction', error)
}
```

**Impact**: Zero runtime cost increase. Provides observability into action failures. Affects all 17 action files.

### 3.2 Redundant `stripHtml` Duplication

`stripHtml` is defined identically in 4 separate action files:
- `src/lib/actions/claims.ts:445-447`
- `src/lib/actions/profile.ts:204-206`
- `src/lib/actions/business-profile.ts:254-256`
- `src/lib/actions/deal-management.ts:46-48`

**Fix**: Extract to shared utility:

```tsx
// src/lib/utils/sanitize.ts
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
```

### 3.3 Redundant `createSupabaseServerClient` + `getUser()` Pattern

Every authenticated action repeats the same 8-line boilerplate:

```tsx
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return { success: false, error: 'Not authenticated' }
}
```

This appears in **28 action functions** across all action files. Extract to a helper:

```tsx
// src/lib/actions/auth-guard.ts
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase: null, user: null } as const
  }

  return { supabase, user } as const
}
```

**Before** (repeated 28 times):
```tsx
export async function someAction(): Promise<Result> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    // ... action logic
```

**After**:
```tsx
export async function someAction(): Promise<Result> {
  try {
    const { supabase, user } = await getAuthenticatedClient()
    if (!supabase || !user) {
      return { success: false, error: 'Not authenticated' }
    }
    // ... action logic
```

**Impact**: ~100 lines of boilerplate eliminated across 17 files. Single place to modify auth checking logic (e.g., adding rate limiting, session validation).

### 3.4 `createClaimAction` Sequential Queries

`createClaimAction` (`src/lib/actions/claims.ts:77-240`) runs 4 sequential Supabase queries before the insert, plus 2 post-insert queries:

```
Sequential pre-insert:
1. supabase.auth.getUser()
2. supabase.from('promo_offer_master').select(...)  -- derive business_id
3. supabase.from('claims').select(count)            -- spam prevention
4. supabase.from('claims').select(...)              -- duplicate check

Insert:
5. supabase.from('claims').insert(...)

Post-insert (best-effort):
6. supabase.from('master_business_info').select(...)  -- for notification
7. sendClaimNotificationEmail(...)                     -- fire-and-forget
```

Queries 3 and 4 can be parallelized since they are independent reads:

**Before**:
```tsx
// Sequential
const { count, error: countError } = await supabase
  .from('claims').select('id', { count: 'exact', head: true })
  .eq('consumer_id', user.id)
  .in('status', ACTIVE_STATUSES)
  .gte('expires_at', new Date().toISOString())

if ((count ?? 0) >= MAX_ACTIVE_CLAIMS) { /* ... */ }

const { data: existing, error: existingError } = await supabase
  .from('claims').select('id')
  .eq('consumer_id', user.id)
  .eq('deal_id', dealId)
  .in('status', ACTIVE_STATUSES)
  .gte('expires_at', new Date().toISOString())
  .limit(1)
```

**After**:
```tsx
// Parallel
const [countResult, existingResult] = await Promise.all([
  supabase
    .from('claims').select('id', { count: 'exact', head: true })
    .eq('consumer_id', user.id)
    .in('status', ACTIVE_STATUSES)
    .gte('expires_at', new Date().toISOString()),
  supabase
    .from('claims').select('id')
    .eq('consumer_id', user.id)
    .eq('deal_id', dealId)
    .in('status', ACTIVE_STATUSES)
    .gte('expires_at', new Date().toISOString())
    .limit(1),
])

if (countResult.error) return { success: false, error: countResult.error.message }
if ((countResult.count ?? 0) >= MAX_ACTIVE_CLAIMS) { /* ... */ }

if (existingResult.error) return { success: false, error: existingResult.error.message }
if (existingResult.data && existingResult.data.length > 0) { /* ... */ }
```

**Impact**: Saves one Supabase round-trip (~50-150ms) per claim creation.

---

## 4. Import Optimization

### 4.1 Problem: 96 Files Use Barrel Import

The grep results confirm:
- **96 files** import from `@phosphor-icons/react` (client barrel)
- **20 files** import from `@phosphor-icons/react/dist/ssr` (tree-shakeable)

While `optimizePackageImports` in `next.config.ts` helps at build time, every `'use client'` component that barrel-imports icons includes those icon components in its client chunk. When components can be converted to server components (Section 2), they must use the `/dist/ssr` path.

### 4.2 Solution: Migrate Server-Eligible Components

For components that can become server components (per Section 2), change the import path:

**Before**:
```tsx
import { MapPin, Star, Lock } from '@phosphor-icons/react'
```

**After**:
```tsx
import { MapPin, Star, Lock } from '@phosphor-icons/react/dist/ssr'
```

Files to migrate (server component candidates):

| File | Icon Count | Priority |
|------|-----------|----------|
| `dealCard.tsx` | 6 icons | High (20-50 instances per listing) |
| `trendingDealsSection.tsx` | 2 | High (homepage) |
| `categoryGrid.tsx` | 6 | High (homepage) |
| `cityGrid.tsx` | 1 | High (homepage) |
| `heroSection.tsx` | 2 | High (homepage) |
| `valuePropsSection.tsx` | 3 | Medium |
| `socialProofSection.tsx` | 4 | Medium |
| `businessCtaSection.tsx` | icons | Medium |

### 4.3 Solution: Lint Rule for Import Path

Add a Biome lint rule (or ESLint rule if Biome does not support import restrictions) to flag barrel imports in server component files. Alternatively, add a comment to `next.config.ts` documenting the convention:

```ts
// next.config.ts
experimental: {
  optimizePackageImports: [
    '@phosphor-icons/react',      // Client components: use this
    // Server components: use @phosphor-icons/react/dist/ssr
    '@supabase/supabase-js',
  ],
},
```

### 4.4 Components That Must Stay Client

These components use `useAuth()`, `useState`, or event handlers and must remain client components. They should keep the `@phosphor-icons/react` barrel import (which is tree-shaken by `optimizePackageImports`):

- `saveButton.tsx` (useAuth)
- `globalHeader.tsx` (useAuth, useState, usePathname)
- `filterPanel.tsx` (useState)
- `claimCTA.tsx` (useAuth, useClaims)
- `authModal` components
- Dashboard pages (all interactive)

**Impact**: Reduces client JS by avoiding inclusion of icon components in server-rendered chunks. Marginal per-file, but compounds across 20+ server-eligible files.

---

## 5. Metadata Optimization

### 5.1 Problem: Metadata Functions Re-derive Data

In `src/app/deals/[[...slugs]]/page.tsx`, `generateMetadata()` for city routes makes three separate calls that each fetch the full deals dataset:

```tsx
// Line 122-125
const dealCount = await getDealCountForCitySlug(route.citySlug)    // getDealsForCitySlug() -> getOffersWithBusinesses({city})
const businessCount = await getBusinessCountForCity(cityName)       // getBusinesses(city) -> full business objects
const minPrice = await getMinPriceForCitySlug(route.citySlug)      // getDealsForCitySlug() -> [cached]
```

`getDealCountForCitySlug` calls `getDealsForCitySlug()` which returns full deal objects, then discards everything except `.length`. `getMinPriceForCitySlug` calls the same function to find a single minimum value. Thanks to `cache()` on `getDealsForCitySlug`, the Supabase query runs only once, but the full dataset is still fetched when only count + min are needed.

Similarly, the page component at line 220-224 calls `getDealsForCitySlug` again (cached) plus `getBusinessCountForCity` (also cached within the request).

### 5.2 Solution: Use `get_deal_stats_for_city` RPC (from 04-database.md)

Once the `get_deal_stats_for_city` RPC is deployed (see `04-database.md` Section 2.5), replace the three metadata calls with one:

**Before**:
```tsx
export async function generateMetadata({ params }: DealsPageProps): Promise<Metadata> {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'city': {
      const dealCount = await getDealCountForCitySlug(route.citySlug)
      const cityName = route.citySlug.replace(/-/g, ' ')
      const businessCount = await getBusinessCountForCity(cityName)
      const minPrice = await getMinPriceForCitySlug(route.citySlug)
      return generateCityDealsMetadata(route.cityName, route.citySlug, {
        dealCount, businessCount, minPrice: minPrice ?? undefined,
      })
    }
```

**After**:
```tsx
export async function generateMetadata({ params }: DealsPageProps): Promise<Metadata> {
  const { slugs } = await params
  const route = await resolveRoute(slugs)

  switch (route.type) {
    case 'city': {
      const stats = await getCityDealStats(route.cityName)
      return generateCityDealsMetadata(route.cityName, route.citySlug, {
        dealCount: stats.dealCount,
        businessCount: stats.businessCount,
        minPrice: stats.minPrice ?? undefined,
      })
    }
```

```tsx
// src/lib/data/unified.ts -- new function
export const getCityDealStats = cache(async function getCityDealStats(cityName: string) {
  const { data, error } = await supabase.rpc('get_deal_stats_for_city', {
    city_name: cityName,
  })

  if (error) {
    // Fallback: use existing approach
    const [deals, businesses] = await Promise.all([
      getDealsByCity(cityName),
      getBusinesses(cityName),
    ])
    const prices = deals.map((d) => d.dealPrice).filter((p) => p > 0)
    return {
      dealCount: deals.length,
      businessCount: businesses.length,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
    }
  }

  const row = data?.[0] ?? { deal_count: 0, min_price: null, business_count: 0 }
  return {
    dealCount: Number(row.deal_count),
    minPrice: row.min_price,
    businessCount: Number(row.business_count),
  }
})
```

**Impact**: Replaces 3 function calls (each fetching full datasets) with 1 RPC returning 3 scalars. Saves 2 Supabase round-trips on ISR cache misses for city deals pages.

### 5.3 Treatment-City Metadata Same Pattern

The `treatment-city` case (lines 133-151) has the same issue -- `getDealCountForTreatmentAndCity` and `getMinPriceForTreatmentAndCity` both call `getDealsForTreatmentAndCity` for scalar results. Apply the same RPC pattern or at minimum ensure they share the cached result:

```tsx
case 'treatment-city': {
  // Single call -- cache() ensures reuse between metadata and page
  const deals = await getDealsForTreatmentAndCity(route.treatmentSlug, route.citySlug)
  const cityName = route.citySlug.replace(/-/g, ' ')
  const businessCount = await getBusinessCountForCity(cityName)
  const prices = deals.map((d) => d.dealPrice).filter((p) => p > 0)

  return generateTreatmentCityMetadata(
    route.treatmentName, route.treatmentSlug, route.cityName, route.citySlug,
    {
      dealCount: deals.length,
      businessCount,
      minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
    },
  )
}
```

### 5.4 Guide Page Duplicate Data Fetching

In `src/app/guides/[slug]/page.tsx`, `generateMetadata()` (line 47) and the page component (line 78-80) both call `getGuidePricingStats()` with the same arguments. `getGuidePricingStats` is NOT wrapped with `cache()`, so the Supabase queries execute twice.

Additionally, `getGuidePricingStats` and `getGuideDealsPreview` in `src/lib/data/guide-stats.ts` both call `getOffersWithBusinesses()` with the same `{serviceCategory, city}` filters (lines 21-26 and 107-112). Without `cache()` on `getOffersWithBusinesses`, these are fully redundant queries.

**Fix**: Wrap `getGuidePricingStats` with `cache()`:

```tsx
import { cache } from 'react'

export const getGuidePricingStats = cache(async function getGuidePricingStats(
  treatment: TreatmentCategory,
  citySlug: string,
): Promise<GuidePricingStats> {
  // ... existing logic
})
```

And ensure `getOffersWithBusinesses` is also wrapped (covered in `04-database.md`).

**Impact**: Eliminates 1-3 redundant Supabase queries per guide page ISR miss.

---

## 6. Caching Strategy

### 6.1 React `cache()` -- Complete Coverage

React's `cache()` deduplicates function calls within a single server-side render pass (same request). Functions that should have `cache()` but currently do not:

| Function | File | Calls per request | Fix |
|----------|------|-------------------|-----|
| `getOffersWithBusinesses()` | `offers.ts:62` | 2-5 (via multiple wrappers) | **Critical** -- wrap with `cache()` |
| `getOffers()` | `offers.ts:19` | Rarely called directly | Low -- add `cache()` |
| `getBusinessCategories()` | `businesses.ts:65` | 1-2 | Low -- add `cache()` |
| `searchBusinesses()` | `businesses.ts:83` | 1 per call | Low -- not needed |
| `getActiveDeals()` | `unified.ts:51` | 1 | Low -- add `cache()` |
| `getDealsByCity()` | `unified.ts:56` | 1-2 | Medium -- add `cache()` |
| `getDealsByCategory()` | `unified.ts:61` | 1 | Low -- add `cache()` |
| `getGuidePricingStats()` | `guide-stats.ts:11` | 2 (metadata + page) | **High** -- add `cache()` |
| `getGuideDealsPreview()` | `guide-stats.ts:96` | 1 | Low -- add `cache()` |

**Priority order**: `getOffersWithBusinesses` > `getGuidePricingStats` > `getDealsByCity` > rest.

### 6.2 `cache()` Key Serialization Caveat

React `cache()` uses strict reference equality for non-primitive arguments. `getOffersWithBusinesses` takes an `OfferFilters` object, so each call site creates a new object reference. This means `cache()` on `getOffersWithBusinesses` alone will NOT deduplicate across different callers.

The fix is to ensure the higher-level wrapper functions (which use string/number keys) are the primary dedup layer:

```
getDealsForCitySlug('dallas')  <-- cache() with string key, deduplicates
  -> getDealsByCity('Dallas')
    -> getOffersWithBusinesses({ city: 'Dallas' })  <-- cache() won't dedup (new object each time)
```

This is already the correct architecture -- `getDealsForCitySlug` is cached and serves as the dedup point. Wrapping `getOffersWithBusinesses` with `cache()` provides a safety net for any direct callers.

### 6.3 ISR Revalidation -- Current Configuration (Good)

| Route | Current `revalidate` | Assessment |
|-------|---------------------|------------|
| `/` (homepage) | 3600s (1 hour) | Good -- deals change infrequently |
| `/deals/[...]` | 3600s (1 hour) | Good |
| `/treatments` | 86400s (24 hours) | Good -- categories are stable |
| `/treatments/[category]` | 3600s (1 hour) | Good |
| `/guides/[slug]` | 86400s (24 hours) | Good -- content is semi-static |
| State/city pages | SSG (no revalidate) | Good -- pre-rendered at build |

No changes needed. The ISR periods are appropriate for the data freshness requirements.

### 6.4 `unstable_cache` -- When to Consider

`unstable_cache` (Next.js Data Cache) persists across requests, unlike React `cache()` which only deduplicates within a single request. For ISR pages, this is less relevant because the entire page is cached. It would matter for:

- Dynamic (non-ISR) pages that fetch the same data repeatedly
- API routes that serve cached data

Currently all public pages use ISR, so `unstable_cache` adds limited value. If dynamic pages are introduced (e.g., search results), consider wrapping their data functions:

```tsx
import { unstable_cache } from 'next/cache'

const getCachedCityDeals = unstable_cache(
  async (citySlug: string) => getDealsForCitySlug(citySlug),
  ['city-deals'],
  { revalidate: 3600, tags: ['deals'] }
)
```

**Recommendation**: Defer `unstable_cache` until dynamic pages are added. ISR already provides cross-request caching.

### 6.5 Supabase Client Architecture

The data layer uses a module-level singleton (`src/lib/supabase.ts`):

```tsx
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

This is appropriate for the current use case (read-only public data using anon key, no RLS differentiation). No change needed. The separate `supabase-server.ts` (used by server actions for authenticated operations) correctly uses per-request cookie-based clients.

---

## 7. Implementation Plan

### Phase 1: Critical Wins (1-2 days, highest impact)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 1.1 | Add `cache()` to `getOffersWithBusinesses()` | Eliminates 1-3 redundant Supabase queries per request on city pages | Low | `offers.ts` |
| 1.2 | Add `cache()` to `getGuidePricingStats()` | Eliminates duplicate query on guide pages | Low | `guide-stats.ts` |
| 1.3 | Parallelize claim validation queries | Saves ~50-150ms per claim creation | Low | `claims.ts` |
| 1.4 | Extract `handleActionError()` utility | Adds observability to all action failures | Low | New file + 17 action files |

**Expected impact**: 100-300ms latency reduction on city pages (ISR miss), diagnostic visibility for all action errors.

### Phase 2: Provider Architecture (2-3 days, high impact)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 2.1 | Create route groups: `(public)`, `(auth)`, `(business)`, `(admin)` | Structural prerequisite for provider splitting | Medium -- requires moving page files into route groups | Multiple |
| 2.2 | Create `PublicHeader` server component + `AuthModalTrigger` client island | Eliminates auth provider from public pages | Low | New files |
| 2.3 | Move providers into `(auth)` and `(business)` layouts | 15-25KB JS savings + 2 eliminated network requests for anonymous visitors | Medium -- must verify all auth-dependent components are in correct route group | Layout files |
| 2.4 | Debounce `BusinessAuthProvider` visibility handler | Eliminates rapid-fire auth calls on tab switching | Low | `businessAuthContext.tsx` |

**Expected impact**: ~15-25KB client JS reduction on all public pages, 2 fewer network requests on every public page load.

### Phase 3: Component Boundaries (2-3 days, medium impact)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 3.1 | Convert `HeroSection` to server component (CSS animations) | ~3KB JS savings on homepage | Low | `heroSection.tsx`, `globals.css` |
| 3.2 | Convert `TrendingDealsSection`, `CategoryGrid`, `CityGrid` to server components | ~6KB JS savings on homepage | Low -- if using Solution B (client wrapper for children) | 3 files |
| 3.3 | Convert `DealCard` to server component with `SaveButton` client island | ~5-10KB per listing page | Medium -- requires `Card` component to work without `onClick` in server context | `dealCard.tsx`, may need `Card` refactor |
| 3.4 | Convert `ValuePropsSection`, `SocialProofSection` (except `AnimatedCounter`) | ~5KB JS savings on homepage | Low | 2 files |

**Expected impact**: ~20-30KB total client JS reduction across homepage and listing pages.

### Phase 4: Import Cleanup (1 day, low impact per file, cumulative)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 4.1 | Migrate all newly-server components from `@phosphor-icons/react` to `/dist/ssr` | Slightly smaller client chunks, correct SSR rendering | Low -- search-and-replace | ~20 files |
| 4.2 | Extract shared `stripHtml` to utility | DRY cleanup | Low | 4 action files + 1 new utility |
| 4.3 | Extract shared `getAuthenticatedClient` helper | ~100 lines boilerplate eliminated | Low | 17 action files + 1 new utility |

### Phase 5: Metadata + Database (depends on 04-database.md RPC deployment)

| # | Task | Impact | Risk | Files |
|---|------|--------|------|-------|
| 5.1 | Implement `getCityDealStats()` using `get_deal_stats_for_city` RPC | 3 calls -> 1 for city deals metadata | Low (with RPC fallback) | `unified.ts`, `deals/page.tsx` |
| 5.2 | Implement `getCityDealCounts()` using `get_city_deal_counts` RPC | Full table scan -> ~1KB response on homepage | Low (with fallback) | `unified.ts` |
| 5.3 | Implement `getOfferCategories()` using `get_offer_category_counts` RPC | 347 rows -> 6 rows | Low (with fallback) | `offers.ts` |
| 5.4 | Refactor treatment-city metadata to reuse cached deals | Eliminates redundant wrapper calls | Low | `deals/page.tsx` |

**Expected impact**: 2-4 fewer Supabase round-trips per ISR cache miss on city pages and homepage. ~50-100KB less data transferred from Supabase per homepage render.

---

## Appendix: Risk Assessment

| Change | Rollback Strategy | Test Coverage Needed |
|--------|-------------------|----------------------|
| Route group splitting | Git revert -- all page moves are file-only, no logic changes | Verify all routes resolve correctly, especially nested dynamic routes |
| Provider removal from public | Re-wrap in root layout | Test auth flows (sign in modal, sign up from public pages) |
| DealCard server conversion | Restore `'use client'` directive | Test save button functionality, card click behavior |
| CSS scroll animations | Restore JS-based `ScrollRevealItem` | Visual testing across browsers (CSS `animation-timeline` support) |
| RPC functions | Each function has a JS fallback path | Verify RPCs exist in Supabase before deploying app changes |
| `cache()` additions | Remove `cache()` wrapper | No functional risk -- `cache()` only deduplicates, does not change behavior |

---

## Appendix: File Reference

| File | Relevant Section |
|------|-----------------|
| `src/app/layout.tsx` | Section 1 (provider architecture) |
| `src/lib/context/authContext.tsx` | Section 1 (449-line provider) |
| `src/lib/context/businessAuthContext.tsx` | Section 1.4 (visibility debounce) |
| `src/lib/context/claimsContext.tsx` | Section 1 (provider splitting) |
| `src/components/layout/globalHeader.tsx` | Section 1.3, 2.4 (server header) |
| `src/components/features/dealCard.tsx` | Section 2.1 (server component conversion) |
| `src/components/features/homepage/*.tsx` | Section 2.2, 2.3 (server component conversion) |
| `src/components/patterns/saveButton.tsx` | Section 2.1 (client island) |
| `src/components/patterns/scrollReveal.tsx` | Section 2.2 (CSS replacement) |
| `src/lib/hooks/useScrollReveal.ts` | Section 2.2 (CSS replacement) |
| `src/lib/hooks/useScrolled.ts` | Section 1.3 (eliminated from public header) |
| `src/lib/data/offers.ts` | Section 6.1 (`cache()` on `getOffersWithBusinesses`) |
| `src/lib/data/unified.ts` | Section 5.2, 6.1 (metadata + cache) |
| `src/lib/data/guide-stats.ts` | Section 5.4, 6.1 (`cache()` addition) |
| `src/app/deals/[[...slugs]]/page.tsx` | Section 5.1 (metadata deduplication) |
| `src/app/guides/[slug]/page.tsx` | Section 5.4 (duplicate stats fetch) |
| `src/app/treatments/[category]/page.tsx` | Section 2, 4 (server component, icon imports) |
| `src/lib/actions/*.ts` (17 files) | Section 3 (error handling, boilerplate) |
| `src/lib/supabase.ts` | Section 6.5 (no change needed) |
| `src/lib/supabase-server.ts` | Section 3.3 (auth guard extraction) |
| `next.config.ts` | Section 4.3 (optimizePackageImports) |
