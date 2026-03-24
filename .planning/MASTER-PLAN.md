# CostFinders — Master Execution Plan

> All remaining work organized into actionable tracks.
> Created: 2026-03-23 | Status: Active

---

## Track Overview

| # | Track | Type | Effort | Priority | Status |
|---|-------|------|--------|----------|--------|
| A | [Reliability & Observability](#a-reliability--observability) | Engineering | ~2 days | P0 | Not started |
| B | [Analytics & Business Intelligence](#b-analytics--business-intelligence) | Engineering | ~4 hours | P0 | Not started |
| C | [CDN & Caching](#c-cdn--caching) | Engineering | ~2 hours | P1 | Not started |
| D | [CI/CD Performance Gates](#d-cicd-performance-gates) | Engineering | ~2 days | P1 | Not started |
| E | [v1.4 Mobile Polish](#e-v14-mobile-polish-phases-38-41) | Feature | ~3 days | P1 | Phases 38-41 remaining |
| F | [Cloudinary Image Pipeline](#f-cloudinary-image-pipeline) | Engineering | ~2 days | P2 | Not started |
| G | [Load Testing Suite](#g-load-testing-suite) | Engineering | ~2 days | P2 | Not started |

---

## A. Reliability & Observability

**Why:** 84 server action catch blocks silently discard errors. If claims fail, auth breaks, or notifications don't send — nobody knows. This is the single biggest reliability gap.

### A1. Fix Silent Catch Blocks (~4h)

**Scope:** 17 files in `src/lib/actions/`, ~84 catch blocks

**Pattern — Before:**
```ts
} catch {
  return { success: false, error: 'An unexpected error occurred.' }
}
```

**Pattern — After:**
```ts
} catch (error) {
  logger.error('createClaim failed', {
    action: 'createClaimAction',
    dealId,
    error: error instanceof Error ? error.message : String(error),
  })
  return { success: false, error: 'An unexpected error occurred.' }
}
```

**Files to fix (in priority order):**
1. `src/lib/actions/claims.ts` — claim creation/status updates (revenue-critical)
2. `src/lib/actions/auth.ts` — sign in/up/out (user-critical)
3. `src/lib/actions/business-auth.ts` — business sign in/up
4. `src/lib/actions/business-profile.ts` — profile updates, claim verification
5. `src/lib/actions/saved-deals.ts` — save/unsave deals
6. `src/lib/actions/profile.ts` — consumer profile updates
7. `src/lib/actions/notifications.ts` — notification sending (already has some logging)
8. `src/lib/actions/google-places.ts` — external API (already has some logging)
9. `src/lib/actions/business-data.ts` — business search/data
10. `src/lib/actions/deal-management.ts` — deal CRUD
11. `src/lib/actions/leads.ts` — lead management
12. `src/lib/actions/messaging.ts` — in-platform messages
13. `src/lib/actions/admin/` — all admin actions
14. `src/lib/actions/moderation.ts` — deal moderation
15. `src/lib/actions/billing.ts` — billing operations
16. `src/lib/actions/analytics.ts` — analytics data
17. `src/lib/actions/settings.ts` — settings updates

**Approach:** Use `withAction()` wrapper from `src/lib/logger.ts` where possible. For actions that need custom context, add `logger.error()` directly.

**Verification:** `grep -r "} catch {" src/lib/actions/` should return 0 matches when done.

### A2. Install Sentry (~2h)

**Prerequisites:** User must run `npx @sentry/wizard@latest -i nextjs` interactively.

**Steps:**
1. Run Sentry wizard (creates config files)
2. Configure `sentry.client.config.ts` — set environment, traces sample rate 0.1
3. Configure `sentry.server.config.ts` — same settings
4. Update `src/app/error.tsx` to call `Sentry.captureException(error)` with `error.digest`
5. Add `captureConsoleIntegration` so `logger.error()` calls flow to Sentry automatically
6. Add `SENTRY_DSN` to Vercel env vars
7. Test with intentional error

**Cost:** Free tier = 5K errors/month, 10K transactions/month

### A3. Health Check Endpoint (~30min)

**Create:** `src/app/api/health/route.ts`

```ts
// GET /api/health — checks env vars + Supabase connectivity
// Returns: { status: 'healthy'|'degraded'|'unhealthy', checks: {...}, latency_ms }
```

**Use for:** Better Uptime monitoring (free tier), deployment verification.

### A4. Error Boundaries per Segment (~1h)

**Create `error.tsx` files for:**
- `src/app/deals/error.tsx`
- `src/app/treatments/error.tsx`
- `src/app/dashboard/error.tsx` (may exist via layout)
- `src/app/business/dashboard/error.tsx`
- `src/app/admin/dashboard/error.tsx`

Each should log the error digest and show a segment-appropriate fallback UI.

---

## B. Analytics & Business Intelligence

**Why:** `@vercel/analytics` is installed but only tracks page views. Zero visibility into the conversion funnel.

### B1. Business Event Tracking (~2h)

**10 events using `track()` from `@vercel/analytics`:**

| Event | Where | Properties |
|-------|-------|------------|
| `deal_viewed` | Deal detail page load | `{ dealId, category, city }` |
| `deal_saved` | SaveButton click | `{ dealId }` |
| `deal_claimed` | ClaimDealModal submit | `{ dealId, businessId }` |
| `business_revealed` | Post-auth business reveal | `{ dealId }` |
| `search_performed` | Deals page with city filter | `{ city, category }` |
| `filter_applied` | Any filter interaction | `{ filterType, value }` |
| `auth_signup` | Successful sign up | `{ method: 'email' }` |
| `auth_signin` | Successful sign in | `{ method: 'email' }` |
| `guide_viewed` | Guide page load | `{ slug, city, treatment }` |
| `business_search` | Business search modal submit | `{ query }` |

**Implementation:**
- Client components: `import { track } from '@vercel/analytics'` directly
- Server actions: Return event data, track on client after success

**Dashboard:** Vercel Analytics → Custom Events tab (Pro plan required for full filtering)

---

## C. CDN & Caching

**Why:** No custom Cache-Control headers configured. Repeat visitors re-download assets unnecessarily.

### C1. Cache-Control Headers in next.config.ts (~1h)

```ts
headers: async () => [
  {
    source: '/:path*',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ],
  },
  {
    // ISR pages — serve stale while revalidating
    source: '/deals/:path*',
    headers: [
      { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
    ],
  },
  {
    source: '/treatments/:path*',
    headers: [
      { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
    ],
  },
  {
    source: '/guides/:path*',
    headers: [
      { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
    ],
  },
]
```

### C2. Trim next/image deviceSizes (~15min)

Remove 1920, 2048, 3840 from `images.deviceSizes` — the app's max layout is `max-w-7xl` (1280px). Fewer variants = faster image optimization.

---

## D. CI/CD Performance Gates

**Why:** No automated way to catch performance regressions before they ship.

### D1. GitHub Actions Performance Workflow (~1d)

**File:** `.github/workflows/performance.yml`

**Jobs (run on PRs to main):**
1. **Build analysis** — Check total bundle size, fail if First Load JS > 250KB per route
2. **Lighthouse CI** — Run against 8 key URLs on preview deployment, assert scores
3. **k6 smoke test** — 2 VUs, 30s against preview URL, assert TTFB thresholds

**Dependencies:** `@lhci/cli`, `k6` (for local runs), Vercel preview URL

### D2. Bundle Budget Config (~2h)

**File:** `.bundlewatch.config.json`

Per-route First Load JS budgets based on current measurements + 10% buffer. PR comments showing size delta.

---

## E. v1.4 Mobile Polish (Phases 38-41)

**Why:** Roadmap milestone in progress — 4 phases remaining.

### Phase 38: Touch Gesture Foundation (~1d)

**Goal:** Swipe gestures for key mobile interactions.

**Plan:**
1. Research: Evaluate `@use-gesture/react` vs custom touch handlers
2. Implement swipe-to-dismiss on BottomSheet component
3. Implement swipe between deal cards in list view
4. Add pull-to-refresh pattern for deal listings
5. Haptic feedback via `navigator.vibrate()` on supported devices

### Phase 39: Mobile Navigation Enhancements (~4h)

**Plan:**
1. Breadcrumb → horizontal scrollable on mobile (no wrap/truncation)
2. Back navigation with swipe-from-edge gesture
3. Sticky filter bar on deal listing pages (visible on scroll-up, hidden on scroll-down)
4. Smooth page transition animations between routes

### Phase 40: Touch Target & Spacing Audit (~3h)

**Plan:**
1. Automated audit: script to find elements with `min-height < 44px` or `padding < 12px`
2. Fix remaining violations (some addressed in Sprint 1 quick wins)
3. Increase spacing between adjacent interactive elements on mobile
4. Verify all form inputs have adequate height and label spacing

### Phase 41: Mobile QA & Polish (~4h)

**Plan:**
1. Test on iPhone SE (smallest common viewport)
2. Test on iPhone 15 Pro (notch/Dynamic Island)
3. Test on Android mid-range (Samsung A series)
4. Fix safe-area issues for notched devices
5. Verify all loading states render well on mobile
6. Performance check: Lighthouse mobile scores on key pages

---

## F. Cloudinary Image Pipeline

**Why:** Business images currently come as `imageUrl: undefined` from the adapter. When real images are wired up, they should go through Cloudinary transformations for automatic format/quality/resize.

### F1. Cloudinary URL Helper (~2h)

**Create:** `src/lib/cloudinary.ts`

```ts
export function cloudinaryUrl(publicId: string, options: {
  width?: number
  height?: number
  quality?: 'auto' | number
  format?: 'auto' | 'webp' | 'avif'
  crop?: 'fill' | 'fit' | 'thumb'
}) { ... }
```

### F2. Wire Up Adapter (~3h)

Update `src/lib/data/adapters.ts` to map Supabase `image_url` fields through `cloudinaryUrl()` with appropriate transformations per context (thumbnail, card, hero, OG image).

### F3. Update Components (~3h)

Replace hardcoded image paths in components with adapter-provided Cloudinary URLs. Update `sizes` attributes to match actual rendered sizes.

---

## G. Load Testing Suite

**Why:** No baseline for how the app performs under load. Unknown breaking points.

### G1. k6 Test Scripts (~1d)

**Based on:** `.performance-optimization/10-load-testing.md`

**Scripts to create:**
1. `tests/load/smoke.js` — 2 VUs, 30s (CI-friendly)
2. `tests/load/average.js` — 50 VUs, 10 min
3. `tests/load/peak.js` — 250 VUs, 15 min
4. `tests/load/stress.js` — 50→500 VUs ramp, 30 min

**Traffic model:** 30% homepage, 25% city deals, 15% treatments, 10% guides

### G2. Run Baseline Tests (~4h)

Execute smoke + average against production, record baseline metrics:
- TTFB p50/p95/p99 per page type
- Error rate
- Vercel cache hit ratio
- Supabase API rate consumption

### G3. Weekly Automated Run (~2h)

**File:** `.github/workflows/load-test-weekly.yml`

Run average load test weekly against production. Alert on >20% regression from baseline.

---

## Recommended Execution Order

```
Week 1: A1 (catch blocks) + B1 (event tracking) + C1 (cache headers)
         ↳ Foundation: errors visible, funnel tracked, CDN optimized

Week 2: A2 (Sentry) + A3 (health check) + A4 (error boundaries)
         ↳ Full observability stack operational

Week 3: E38-E39 (touch gestures + mobile nav)
         ↳ Resume v1.4 roadmap progress

Week 4: E40-E41 (touch audit + mobile QA)
         ↳ v1.4 milestone complete

Week 5: D1-D2 (CI/CD gates + bundle budgets)
         ↳ Regressions prevented automatically

Week 6: F1-F3 (Cloudinary pipeline) + G1-G2 (load testing)
         ↳ Image pipeline ready, performance baselined
```

---

## What's NOT Planned (and why)

| Item | Reason |
|------|--------|
| Route group restructure (L1) | Lazy auth achieves same perf win without structural risk |
| DealCard server/client split (M5) | `optimizePackageImports` already handles tree-shaking; onClick prop complicates split |
| Homepage sections to server (M6) | All use ScrollReveal/AnimatedCounter — conversion breaks animations for minimal gain |
| PWA manifest (M17) | Low priority until traffic warrants installability |
| Column-level selects (L5) | Marginal gain at current data scale (354 businesses, 347 offers) |
