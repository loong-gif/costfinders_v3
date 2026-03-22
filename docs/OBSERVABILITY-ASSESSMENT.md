# CostFinders v2 -- Observability Assessment

**Assessment Date:** 2026-03-21
**Application:** CostFinders v2 (Next.js 16 / Vercel / Supabase / Cloudinary)
**Assessed By:** Observability Engineering Review

---

## 1. Current Observability State

### 1.1 What Exists Today

#### Vercel Analytics (Client-Side Page Analytics)
- **Package:** `@vercel/analytics` v2.0.1 (installed in `package.json`)
- **Integration:** `<Analytics />` component rendered in root `src/app/layout.tsx` (line 89)
- **Coverage:** Automatic page view tracking across all routes
- **Limitations:** Page-level only. No custom event tracking is implemented anywhere in the codebase. No business-critical funnel events are instrumented (e.g., deal views, claim submissions, search queries).

#### Vercel Speed Insights (Core Web Vitals / RUM)
- **Package:** `@vercel/speed-insights` v2.0.0 (installed in `package.json`)
- **Integration:** `<SpeedInsights />` component rendered in root `src/app/layout.tsx` (line 90)
- **Coverage:** Automatic Core Web Vitals collection (LCP, FID, CLS, TTFB, INP)
- **Limitations:** Default configuration only. No custom performance marks or measures. No route-specific performance budgets defined.

#### Root Error Boundary
- **File:** `src/app/error.tsx`
- **Coverage:** Catches unhandled runtime errors in the React tree and renders a user-friendly recovery UI with "Try Again" (calls `reset()`) and "Back to Home" options.
- **Critical Gap:** The `error` parameter is accepted but never logged, reported, or transmitted anywhere. The `error.digest` field (server-side error hash) is unused. Errors caught here vanish silently.

#### Root Not-Found Page
- **File:** `src/app/not-found.tsx`
- **Coverage:** Custom 404 page with navigation to deals and treatments.
- **Gap:** No tracking of 404 hits. No logging of the requested URL. No alerting on 404 spike patterns.

#### Loading States
- **Files:** `src/app/loading.tsx`, `src/app/deals/loading.tsx`, `src/app/treatments/loading.tsx`
- **Coverage:** Skeleton UIs for 3 route segments during Suspense loading.
- **Gap:** No loading duration measurement. No slow-load alerting.

#### Console Logging (Ad-Hoc)
- **Total `console.*` statements in `src/`:** 11 (across 3 files)
- **Breakdown:**
  - `src/lib/actions/notifications.ts` -- 8 statements (4 `console.log` for fallback mode, 4 `console.error` for Resend API failures)
  - `src/lib/actions/google-places.ts` -- 2 statements (`console.error` for Google Places API failures)
  - `src/lib/actions/claims.ts` -- 1 statement (`console.error` for notification delivery failure)
- **Pattern:** Logging exists only in external API integration points (Resend email, Google Places). All other server actions (17 files, ~3,800 lines) have zero logging.

#### Error Handling in Server Actions
- **Files with try/catch:** 17 server action files containing 84 total try/catch blocks
- **Pattern:** All catch blocks return `{ success: false, error: '...' }` to the client. None log the actual exception. Generic messages like "An unexpected error occurred" are returned while the original error is discarded.
- **Example** (`src/lib/actions/auth.ts`, lines 45-50):
  ```typescript
  } catch {
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
  ```
  The caught error is not bound to a variable, not logged, and not reported.

#### Error Handling in Data Layer
- **Files:** `src/lib/data/businesses.ts`, `src/lib/data/offers.ts`
- **Pattern:** Supabase query errors are thrown with `if (error) throw error` (11 occurrences across data files). These unhandled throws propagate to the Next.js error boundary but are never logged with context (query parameters, table name, timing).

### 1.2 What Does NOT Exist

| Category | Status |
|----------|--------|
| Error tracking service (Sentry, Bugsnag, etc.) | Not installed |
| Structured logging library | Not installed |
| Log aggregation / drain | Not configured |
| `instrumentation.ts` (Next.js instrumentation hook) | Does not exist |
| `middleware.ts` (request-level observability) | Does not exist |
| OpenTelemetry / distributed tracing | Not installed |
| Custom metrics collection | None |
| Alerting configuration | None |
| Uptime monitoring | Not configured |
| Synthetic monitoring / health checks | No `/api/health` endpoint |
| `vercel.json` | Does not exist |
| CSP (Content-Security-Policy) headers | Not configured |
| Security event logging | None |
| Business event tracking | None |
| Supabase query performance monitoring | None |
| Cloudinary performance monitoring | None |
| Route-level error boundaries | Only root `error.tsx` exists -- no segment-level boundaries for `/deals`, `/admin`, `/auth`, etc. |

---

## 2. Instrumentation Gaps (Priority-Ordered)

### CRITICAL -- Production Blind Spots

**Gap 1: Zero Error Reporting**
Server-side errors are silently swallowed in 84 catch blocks across 17 server action files. When a Supabase query fails, an auth operation breaks, or an email send throws, the error message is discarded and a generic string is returned to the client. There is no way to know these errors are occurring in production.

**Affected files:**
- `src/lib/actions/auth.ts` (5 catch blocks, 0 logged)
- `src/lib/actions/claims.ts` (8 catch blocks, 1 partially logged)
- `src/lib/actions/admin-actions.ts` (10 catch blocks, 0 logged)
- `src/lib/actions/admin-deal-moderation.ts` (9 catch blocks, 0 logged)
- `src/lib/actions/admin-user-actions.ts` (8 catch blocks, 0 logged)
- `src/lib/actions/business-data.ts` (5 catch blocks, 0 logged)
- Plus 11 more server action files

**Gap 2: No Supabase Query Observability**
The data layer (`src/lib/data/offers.ts`, `src/lib/data/businesses.ts`) makes 20+ Supabase queries with no timing, no query identification, and no error context. When `if (error) throw error` fires, the thrown error loses context about which query failed, what parameters were passed, and how long the query took.

**Gap 3: No Request-Level Observability**
No `middleware.ts` exists. There is no way to measure request latency, track response status codes, identify slow routes, or detect traffic anomalies across the application.

**Gap 4: Auth Callback Route Has No Error Logging**
`src/app/auth/callback/route.ts` silently redirects to `/?auth_error=true` when Supabase code exchange fails (line 37). The actual error from `exchangeCodeForSession` is not logged. Auth failures are invisible.

### HIGH -- Significant Operational Gaps

**Gap 5: No Business Event Tracking**
Critical user journeys have zero instrumentation:
- Deal views (which deals are users looking at?)
- Claim submissions (conversion funnel)
- Search queries (what are users searching for?)
- Business reveal events (post-claim engagement)
- Saved deal actions (engagement signals)
- Auth flow completion (signup/signin conversion)

**Gap 6: Error Boundary Swallows Errors**
`src/app/error.tsx` receives `error: Error & { digest?: string }` but does not use it. The `digest` field is a server-side error hash that could be correlated with server logs -- but no server logs exist to correlate with.

**Gap 7: Only Root-Level Error Boundary**
A single `error.tsx` at the app root catches all errors. Route segments like `/admin/dashboard`, `/deals`, `/auth`, and `/business` have no segment-level error boundaries. An error in the admin panel renders the same generic error page as a consumer-facing error.

**Gap 8: No ISR Monitoring**
Pages use ISR with `revalidate` values (3600s for homepage/deals, 86400s for guides/treatments). There is no monitoring of revalidation success/failure, stale content age, or cache hit rates.

### MEDIUM -- Operational Improvements

**Gap 9: No Health Check Endpoint**
No `/api/health` route exists. Uptime monitoring services have no endpoint to check. Supabase connectivity cannot be verified without a real page load.

**Gap 10: No External Service Monitoring**
Three external services are called with no performance tracking:
- Supabase (database queries, auth operations) -- `src/lib/supabase.ts`, `src/lib/supabase-server.ts`
- Resend (email delivery) -- `src/lib/actions/notifications.ts`
- Google Places API -- `src/lib/actions/google-places.ts`

**Gap 11: Client-Side Error Tracking**
The `AuthProvider` (`src/lib/context/authContext.tsx`) performs optimistic updates and reverts on failure (e.g., `saveDeal`, `updateProfile`), but failed operations are not tracked or reported. Users may experience silent data loss.

**Gap 12: No Performance Budgets**
Speed Insights collects Core Web Vitals but no budgets or thresholds are defined. There is no alerting when LCP exceeds 2.5s or CLS exceeds 0.1.

---

## 3. Recommendations

### Phase 1: Foundation (Immediate -- Week 1)

#### 3.1.1 Add Sentry for Error Tracking

Sentry is the standard for Next.js error tracking with first-class Vercel integration. It captures both client-side and server-side errors, provides source maps, and supports the Next.js `instrumentation.ts` hook.

**What it covers:**
- Automatic capture of unhandled exceptions (client + server)
- Server action error reporting with full stack traces
- Error grouping, deduplication, and alerting
- Source map upload via Vercel build integration
- `error.digest` correlation between client error boundary and server error

**Required files:**
- `sentry.client.config.ts` -- client-side SDK initialization
- `sentry.server.config.ts` -- server-side SDK initialization
- `sentry.edge.config.ts` -- edge runtime initialization (for middleware/edge routes)
- `instrumentation.ts` -- Next.js instrumentation hook to load Sentry server config
- Update `next.config.ts` to wrap with `withSentryConfig()`

**Required env vars:**
- `SENTRY_DSN` -- project DSN
- `SENTRY_AUTH_TOKEN` -- for source map uploads during build
- `SENTRY_ORG` -- organization slug
- `SENTRY_PROJECT` -- project slug

**Error boundary update** (`src/app/error.tsx`):
```typescript
// Add to error.tsx
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  // ... rest of component
}
```

#### 3.1.2 Add Structured Server-Side Logging

Replace ad-hoc `console.log`/`console.error` with a structured logger that outputs JSON for Vercel's log drain consumption.

**Recommended approach:** Lightweight custom logger (no heavy dependency needed for this stack size).

**Create `src/lib/logger.ts`:**
```typescript
type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string      // e.g., 'claims', 'auth', 'notifications'
  data?: Record<string, unknown>
  error?: string
  stack?: string
  timestamp: string
}

function log(level: LogLevel, message: string, meta?: { context?: string; data?: Record<string, unknown>; error?: unknown }) {
  const entry: LogEntry = {
    level,
    message,
    context: meta?.context,
    data: meta?.data,
    timestamp: new Date().toISOString(),
  }

  if (meta?.error instanceof Error) {
    entry.error = meta.error.message
    entry.stack = meta.error.stack
  } else if (meta?.error) {
    entry.error = String(meta.error)
  }

  // JSON output for log drain parsing
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(entry))
}

export const logger = {
  info: (msg: string, meta?: { context?: string; data?: Record<string, unknown> }) => log('info', msg, meta),
  warn: (msg: string, meta?: { context?: string; data?: Record<string, unknown> }) => log('warn', msg, meta),
  error: (msg: string, meta?: { context?: string; data?: Record<string, unknown>; error?: unknown }) => log('error', msg, meta),
}
```

**Then update all server action catch blocks.** Example for `src/lib/actions/auth.ts`:
```typescript
} catch (err) {
  logger.error('Sign-in failed', { context: 'auth', error: err })
  return { success: false, error: 'An unexpected error occurred. Please try again.' }
}
```

#### 3.1.3 Add a Health Check Endpoint

**Create `src/app/api/health/route.ts`:**
```typescript
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}

  // Check Supabase connectivity
  try {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('master_business_info').select('business_id').limit(1)
    checks.supabase = error ? 'error' : 'ok'
  } catch {
    checks.supabase = 'error'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')
  return Response.json({ status: allOk ? 'healthy' : 'degraded', checks }, { status: allOk ? 200 : 503 })
}
```

### Phase 2: Visibility (Week 2-3)

#### 3.2.1 Add Business Event Tracking via Vercel Analytics Custom Events

The `@vercel/analytics` package already installed supports custom events. Instrument the critical user funnel:

```typescript
import { track } from '@vercel/analytics'

// Deal viewed
track('deal_viewed', { dealId, category, city })

// Claim submitted
track('claim_submitted', { dealId, businessId, city })

// Business revealed
track('business_revealed', { dealId, businessId })

// Search performed
track('search_query', { query, resultCount })

// Auth completed
track('auth_signup', { method: 'email' })
track('auth_signin', { method: 'email' | 'magic_link' })
```

**Files to instrument:**
- `src/lib/actions/claims.ts` -- `createClaimAction` success path
- `src/lib/data/reveal.ts` -- reveal success path
- `src/lib/context/authContext.tsx` -- `signUp`/`signIn` success paths
- Deal detail page component -- on mount/render
- Search components -- on query submission

#### 3.2.2 Add Supabase Query Instrumentation

Wrap the Supabase client with timing instrumentation in `src/lib/supabase.ts`:

```typescript
// Wrapper to time and log Supabase queries
export async function timedQuery<T>(
  label: string,
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; durationMs: number }> {
  const start = performance.now()
  const result = await queryFn()
  const durationMs = Math.round(performance.now() - start)

  if (result.error) {
    logger.error(`Supabase query failed: ${label}`, {
      context: 'supabase',
      data: { durationMs, errorCode: result.error.code },
      error: result.error,
    })
  } else if (durationMs > 1000) {
    logger.warn(`Slow Supabase query: ${label}`, {
      context: 'supabase',
      data: { durationMs },
    })
  }

  return { ...result, durationMs }
}
```

#### 3.2.3 Add Segment-Level Error Boundaries

Create `error.tsx` files for critical route segments:
- `src/app/deals/error.tsx` -- deal-specific error recovery
- `src/app/admin/error.tsx` -- admin-specific error handling (should not expose internal details)
- `src/app/auth/error.tsx` -- auth-specific error handling
- `src/app/business/error.tsx` -- business dashboard error handling

Each should report to Sentry with route context.

#### 3.2.4 Add Request Middleware for Observability

**Create `src/middleware.ts`:**
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add request ID for correlation
  const requestId = crypto.randomUUID()
  response.headers.set('x-request-id', requestId)

  // Add timing header
  response.headers.set('x-request-start', Date.now().toString())

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Phase 3: Alerting and Dashboards (Week 3-4)

#### 3.3.1 Configure Vercel Log Drain

Set up a log drain to aggregate structured logs from Phase 1. Options:
- **Datadog** -- full observability platform with log search, dashboards, alerting
- **Axiom** -- cost-effective, native Vercel integration, good for Next.js
- **Better Stack (Logtail)** -- simple log search with alerting

Recommended for this project size: **Axiom** (free tier covers this volume, native Vercel marketplace integration).

#### 3.3.2 Configure Alerts

| Alert | Condition | Channel |
|-------|-----------|---------|
| Error rate spike | >10 errors in 5 minutes (Sentry) | Slack + Email |
| Health check failure | `/api/health` returns 503 for 2 consecutive checks | PagerDuty / Slack |
| Supabase latency | p95 query time >2s for 5 minutes | Slack |
| Auth failure spike | >20 auth errors in 10 minutes | Slack |
| Claim creation failure | Any claim insert error | Slack (high priority) |
| Email delivery failure | Resend API returns non-2xx | Slack |
| 404 spike | >50 404s in 10 minutes | Slack (may indicate broken links) |

#### 3.3.3 Uptime Monitoring

Configure an external uptime check (Vercel Checks, Better Uptime, or Uptime Robot) against:
- `https://www.costfinders.ai/api/health` -- application + Supabase connectivity
- `https://www.costfinders.ai/` -- homepage renders without 5xx
- `https://www.costfinders.ai/deals/tucson` -- dynamic route renders

---

## 4. Recommended Metrics and Dashboards

### 4.1 Key Metrics to Track

#### Application Health
| Metric | Source | Target |
|--------|--------|--------|
| Error rate (server actions) | Sentry / Structured logs | < 0.1% of invocations |
| p50/p95/p99 response time | Vercel Analytics | p95 < 1s for SSG, < 3s for dynamic |
| 4xx rate | Vercel logs | Baseline, alert on 2x spike |
| 5xx rate | Vercel logs | 0 (any 5xx is an incident) |
| Health check uptime | Uptime monitor | 99.9% |

#### Core Web Vitals
| Metric | Source | Target |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | Speed Insights | < 2.5s (75th percentile) |
| INP (Interaction to Next Paint) | Speed Insights | < 200ms (75th percentile) |
| CLS (Cumulative Layout Shift) | Speed Insights | < 0.1 (75th percentile) |
| TTFB (Time to First Byte) | Speed Insights | < 800ms |

#### Supabase / Data Layer
| Metric | Source | Target |
|--------|--------|--------|
| Query latency (p50/p95) | Custom instrumentation | p95 < 500ms |
| Query error rate | Structured logs | < 0.01% |
| Slow query count (>1s) | Structured logs | < 5 per hour |
| Connection failures | Structured logs | 0 |

#### Business Metrics
| Metric | Source | Target |
|--------|--------|--------|
| Deal views per hour | Custom events | Baseline + trend |
| Claim submission rate | Custom events | Baseline + trend |
| Claim conversion (view-to-claim) | Custom events | Track weekly |
| Business reveal rate | Custom events | Track weekly |
| Search queries per hour | Custom events | Baseline + trend |
| Auth signup conversion | Custom events | Track weekly |
| Email delivery success rate | Structured logs | > 99% |

#### ISR / Caching
| Metric | Source | Target |
|--------|--------|--------|
| ISR revalidation success | Vercel logs | 100% |
| Cache hit rate | Vercel headers | > 90% for SSG pages |
| Stale content age | Custom instrumentation | < 2x revalidate interval |

### 4.2 Dashboard Layout

**Dashboard 1: Operations Overview**
- Error rate over time (line chart, 24h window)
- p95 response time by route (bar chart)
- Health check status (status indicator)
- Active Sentry issues (count + list)
- Supabase query latency heatmap
- External service status (Supabase, Resend, Google Places)

**Dashboard 2: User Funnel**
- Page views by route (stacked area)
- Deal views -> Claim submissions -> Business reveals (funnel chart)
- Auth signups/signins over time
- Search query volume and top queries
- Saved deals activity

**Dashboard 3: Infrastructure**
- Vercel function invocations and cold starts
- ISR revalidation events
- Supabase query volume by table
- Email delivery success/failure
- Core Web Vitals trends by route

---

## 5. Cost Considerations

| Tool | Estimated Monthly Cost | Notes |
|------|----------------------|-------|
| Sentry (Team plan) | $26/month | 50K errors, 100K performance transactions |
| Axiom (Free) | $0 | 500GB ingest/month, 30-day retention |
| Better Uptime (Free) | $0 | 10 monitors, 3-min check interval |
| Vercel Analytics | $0 (included) | Already installed and running |
| Vercel Speed Insights | $0 (included) | Already installed and running |
| **Total** | **~$26/month** | Covers all critical gaps |

For a bootstrapping project, the free tiers of Axiom and Better Uptime combined with Sentry's team plan provide production-grade observability at minimal cost.

---

## 6. Summary

### Current Score: 1.5 / 10

The application has the bare minimum observability -- Vercel Analytics for page views and Speed Insights for Core Web Vitals. Everything else is a blind spot. There is no error tracking service, no structured logging, no alerting, no health checks, no business event tracking, no query performance monitoring, and no distributed tracing. Server-side errors are silently discarded in 84 catch blocks across 17 files.

### After Phase 1: ~5 / 10
Sentry for errors, structured logging, and a health check endpoint would eliminate the most dangerous blind spots.

### After Phase 2: ~7 / 10
Business event tracking, query instrumentation, segment error boundaries, and middleware would provide operational visibility.

### After Phase 3: ~8.5 / 10
Log aggregation, alerting, uptime monitoring, and dashboards would bring the application to production-grade observability.

### What Is Not Recommended at This Stage
- **OpenTelemetry / distributed tracing** -- The application is a single Next.js service with one database. Full distributed tracing adds complexity without proportional value until the architecture grows to multiple services.
- **DataDog / New Relic** -- Enterprise APM platforms are overkill for the current traffic and team size. Revisit if the application scales past 1M monthly page views.
- **Custom metrics infrastructure (Prometheus/Grafana)** -- Vercel's managed platform handles infrastructure metrics. Self-hosted metrics are unnecessary.
