# PRD 10: Analytics & Reporting

**Version**: 1.0
**Status**: Draft
**Author**: Product
**Date**: 2026-03-20
**Target Milestone**: v2.0 Backend Integration

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas & Jobs-to-Be-Done](#3-user-personas--jobs-to-be-done)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Schema](#6-database-schema)
7. [Supabase RPC Functions](#7-supabase-rpc-functions)
8. [API Design](#8-api-design)
9. [Frontend Integration](#9-frontend-integration)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Out of Scope (v1)](#12-out-of-scope-v1)
13. [Open Questions](#13-open-questions)

---

## 1. Executive Summary

### Problem Statement

All metrics displayed across CostFinders today are hardcoded mock values. Business owners see fabricated view counts and claim rates on their analytics dashboard. Admins see fake platform revenue and user totals on the reports page. No event is logged when a consumer views or claims a deal. This means the product cannot deliver on its core promise to business owners — that they can measure the ROI of being listed on the platform — and the admin team cannot make data-informed decisions about platform health.

### Solution Overview

Replace all mock metric data with a query-driven analytics layer built on top of the existing Supabase PostgreSQL database. The implementation consists of four parts:

1. A `deal_events` table that captures consumer interactions (view, save, unsave, claim) as they happen.
2. Supabase RPC functions that aggregate raw events into the metric shapes the UI already expects.
3. Next.js Server Actions that call those RPCs and return typed data to the pages.
4. Updated React components that replace hardcoded constants with live data.

No real-time streaming. No third-party analytics vendor. Metrics refresh on page load.

### Business Impact

| Stakeholder | Impact |
|---|---|
| Business owners | Can measure deal performance, justify continued listing, and identify which treatments drive leads |
| Admin team | Can track platform growth, identify top-performing markets, and report subscription revenue to investors |
| Product team | Can prioritize feature development using real usage patterns rather than assumptions |
| Sales team | Can use business-level metrics as proof points when selling paid tier upgrades |

### Resource Requirements

- **Backend work**: 1 engineer, estimated 5–8 days (migrations, RPCs, Server Actions)
- **Frontend work**: 1 engineer, estimated 2–3 days (wire existing UI to real data, remove mock imports)
- **QA**: 1–2 days end-to-end testing with real data

### Risk Summary

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| `deal_events` table grows unboundedly | Medium | Medium | Monthly partitioning from day one; reviewed in Open Questions |
| Missing events for existing deals | High | Low | Synthetic backfill is out of scope; dashboards show "no data" state for periods before launch |
| RLS misconfiguration exposes cross-business data | Medium | High | RPC functions use `auth.uid()` for scoping; reviewed in Acceptance Criteria |
| Export functionality blocks main thread | Low | Low | CSV generation is server-side; streamed as file download |

---

## 2. Product Overview

### Product Vision

Give every business owner a single screen where they can answer "Is my investment in CostFinders working?" with real numbers, not placeholders. Give the admin team a platform health view that reflects reality.

### Affected Routes

| Route | Role | Current State | Target State |
|---|---|---|---|
| `/business/dashboard/analytics` | Business owner | All mock data in `analyticsDashboard.tsx` | Live data from RPCs |
| `/admin/dashboard/reports` | Admin | All mock data, no filter works | Live data, time-period filter functional |
| `/admin/dashboard` | Admin | Mock counts from `mock-data/` imports | Live platform summary metrics |

### Success Criteria

| Metric | Target |
|---|---|
| All hardcoded metric values removed from UI | 100% |
| `deal_events` write latency (p95) | < 200ms |
| Business dashboard metrics load time (p95) | < 1500ms |
| Admin reports page load time (p95) | < 2000ms |
| Zero cross-business data leaks validated by test suite | 100% |
| CSV export produces valid file under 10 MB for 90-day window | 100% |

### Assumptions

- The Supabase Auth integration is complete before this work begins. All RPCs that scope to a business or user assume `auth.uid()` is populated.
- The `promo_offer_master` table's `id` column maps 1:1 to the application's `Deal.id`. The foreign key in `deal_events` references `promo_offer_master.id`.
- A `claims` table exists or will be created as part of the broader backend integration. This PRD defines the expected schema in Section 6 and references it in RPCs. If claims are stored differently, the RPC signatures remain the same but the query internals change.
- Business owners are authenticated via Supabase Auth. Their `auth.uid()` maps to a `business_owners` table row that contains a `business_id` foreign key into `master_business_info`.
- The `Revenue from leads` metric is deferred. The metric card exists in the UI but displays a "Coming Soon" state until the billing integration is live.

---

## 3. User Personas & Jobs-to-Be-Done

### Persona 1: Business Owner (Primary)

**Profile**: Owner or manager of a medical spa. Listed on CostFinders either through scraping (unclaimed) or by claiming their profile (free/paid tier). Checks the dashboard weekly.

**Jobs to be done:**
- "When I log into the analytics dashboard, I want to see how many people viewed my deals this week so I can decide if my deal pricing is attracting attention."
- "When a deal has low conversion, I want to identify it immediately so I can pause it or adjust pricing."
- "When I'm considering upgrading to the paid tier, I want to see concrete lead numbers so I can calculate ROI."

**Pain with current state**: Every metric shows the same fabricated numbers regardless of account. Business owners who notice this lose trust in the platform.

### Persona 2: Platform Admin (Secondary)

**Profile**: CostFinders internal team member managing the platform. Checks the reports page weekly to monitor growth and flag anomalies.

**Jobs to be done:**
- "When I open the reports page, I want to see real user and business counts so I can report accurate growth to leadership."
- "When I select a time period filter, I want the metrics to actually change so I can identify trends."
- "When I need to share platform data with investors, I want to export a CSV so I don't have to manually compile spreadsheets."

**Pain with current state**: The time-period filter buttons (`7d`, `30d`, `90d`, `all`) are rendered but non-functional — they change UI state but all metric values are static.

### Persona 3: Consumer (Internal / Indirect)

Consumers are not direct users of analytics features. Their interactions (views, saves, claims) generate the raw events that power business and admin metrics. Their privacy interests constrain the data model — see Section 6 for anonymization approach.

---

## 4. Functional Requirements

### 4.1 Event Tracking

**FR-01**: The system must record a `view` event when a consumer's browser renders a deal card or deal detail page, scoped to unique sessions (one view per deal per session per user).

**FR-02**: The system must record a `save` event when a consumer adds a deal to their favorites.

**FR-03**: The system must record an `unsave` event when a consumer removes a deal from their favorites.

**FR-04**: The system must record a `claim` event when a consumer submits a claim form for a deal.

**FR-05**: Events must store: `event_type`, `deal_id`, `user_id` (nullable for anonymous sessions), `session_id` (anonymous UUID from localStorage), `created_at`, and a `metadata` JSONB column for future extensibility.

**FR-06**: Events must be written server-side (via a Next.js API route or Server Action) to avoid exposing insert permissions to the anon key on the client.

**FR-07**: Duplicate view events within the same session for the same deal must be deduplicated at the database level via a partial unique index.

### 4.2 Business Dashboard Metrics

**FR-08**: The business analytics page must display the following metrics, all scoped to the authenticated business owner's `business_id`:

| Metric | Definition |
|---|---|
| Total Views (this month) | Count of `view` events for all deals owned by this business in the current calendar month |
| Total Claims (this month) | Count of `claim` events for all deals owned by this business in the current calendar month |
| Conversion Rate | `total_claims / total_views * 100`, expressed as a percentage rounded to one decimal place |
| Active Deals count | Count of deals belonging to this business where `is_active = true` and `valid_until >= now()` |
| New Leads (this week) | Count of `claim` events for this business's deals in the current ISO week (Monday to today) |
| New Leads (this month) | Count of `claim` events for this business's deals in the current calendar month |

**FR-09**: Each metric card must display a trend indicator comparing the current period to the equivalent prior period. For "this month", the prior period is last calendar month. For "this week", the prior period is last week. Trend is expressed as a percentage change with direction (positive/negative/neutral).

**FR-10**: The deal performance table must display per-deal metrics for all deals belonging to this business: views (all time), saves (all time), claims (all time), conversion rate (claims/views), and deal status.

**FR-11**: The "Revenue from leads" metric card must display a "Coming soon — available when billing is active" state until the billing integration is complete. The card must not display `$0` or any fabricated dollar amount.

**FR-12**: The "Insights & Trends" section must derive its content from real event data rather than hardcoded strings. For v1, three insights are sufficient: peak activity day of week (day with highest view count in last 30 days), top deal by claim count (last 30 days), and month-over-month view trend direction.

### 4.3 Deal Performance Detail

**FR-13**: The deal performance table must be sortable by views, saves, claims, and conversion rate in both ascending and descending order. Sorting is client-side (data is already fetched).

**FR-14**: Each row in the deal performance table must link to a deal detail view that shows a 30-day daily breakdown of views and claims. This view is read-only and pulls from time-series data (see FR-17).

**FR-15**: A deal with zero events must display `0` for all numeric columns and `0.0%` for conversion rate. It must not display `null`, `undefined`, or `NaN`.

### 4.4 Consumer Analytics (Internal Use)

**FR-16**: Consumer interaction patterns are captured passively through the event log and are surfaced only in admin reporting. No consumer-facing analytics UI is required.

Consumer-level aggregations available to admins:
- Save rate by deal category (saves / views per category)
- Claim rate by consumer verification status
- Claim abandonment (deals saved but never claimed, older than 30 days)

These are read by the admin RPC functions and displayed in the admin reports page. Individual consumer data is never exposed — aggregates only.

### 4.5 Admin Platform Reporting

**FR-17**: The admin reports page must display the following platform-wide metrics, filtered by the selected time period (`7d`, `30d`, `90d`, `all`):

| Metric Group | Metrics |
|---|---|
| Users | Total consumers, new consumers in period, total business owners, new business owners in period |
| Businesses | Total businesses, claimed vs unclaimed count, active vs suspended count, breakdown by tier |
| Deals | Total deals, active deals, scraped (from `promo_offer_master`, no `business_owner_id`) vs business-created, pending moderation count |
| Events | Total views in period, total claims in period, total saves in period, platform-wide conversion rate |
| Revenue | Placeholder — shows "Billing integration pending" until Stripe is connected |

**FR-18**: The "Top Performing Categories" section must show the top 5 service categories by claim count within the selected time period, with a relative percentage bar calculated against the highest-count category.

**FR-19**: The "Business Activity" table must show real counts for: New Businesses, New Claims, Deal Views, and Messages Sent within the selected period, along with the percentage change vs the equivalent prior period.

**FR-20**: The "Recent Platform Activity" feed must display the 10 most recent events from a combined feed of: new business registrations, new claim submissions, deal approvals, and new user registrations. Each entry must show a real timestamp, not a relative string like "2 hours ago" (relative display is acceptable but must be calculated from a real `created_at` timestamp).

**FR-21**: The "Geographic Distribution" section must display a table of the top 10 cities by total deal views within the selected time period, pulling from `master_business_info.city` joined through deal ownership.

### 4.6 Time-Series Data

**FR-22**: A `daily_deal_metrics` materialized view must aggregate `deal_events` into daily buckets (one row per `deal_id` per `date`) containing: `views`, `saves`, `unsaves`, `claims`, and `net_saves` (`saves - unsaves`).

**FR-23**: The materialized view must be refreshed on a schedule. For v1, manual refresh via a Supabase cron job running at midnight UTC daily is sufficient. The refresh must use `REFRESH MATERIALIZED VIEW CONCURRENTLY` to avoid locking reads.

**FR-24**: The deal detail time-series chart shows 30 daily data points. Missing dates (no events that day) must be filled with zeros, not omitted from the series.

### 4.7 Export Capability

**FR-25**: A "Export CSV" button on the admin reports page must trigger a server-side CSV download of all raw platform metrics for the selected time period.

**FR-26**: The exported CSV must contain: date, total views, total claims, total saves, new users, new businesses, new deals, platform-wide conversion rate. One row per day within the selected period.

**FR-27**: The export endpoint must require admin authentication. Unauthenticated or non-admin requests must receive a 403 response.

**FR-28**: The CSV filename must follow the pattern: `costfinders-report-{period}-{YYYY-MM-DD}.csv` where the date is the export date.

---

## 5. Non-Functional Requirements

### Performance

**NFR-01**: Business dashboard metrics RPC must complete in under 800ms at p95 on the current Supabase free tier (us-west-1). This is achievable with the indexes defined in Section 6.

**NFR-02**: Admin platform metrics RPC must complete in under 1500ms at p95.

**NFR-03**: Event write (single `INSERT` into `deal_events`) must complete in under 200ms at p95. Event writes must not block page rendering — they must be fire-and-forget from the client's perspective.

**NFR-04**: Materialized view refresh must not block reads. `REFRESH MATERIALIZED VIEW CONCURRENTLY` is required.

**NFR-05**: CSV export for a 90-day window must produce a file under 10 MB and complete within 10 seconds.

### Security

**NFR-06**: RLS must be enabled on `deal_events`. The `SELECT` policy must restrict to the row's `user_id = auth.uid()` for consumers. Admin reads bypass RLS via `SECURITY DEFINER` RPCs.

**NFR-07**: Business owners must only see metrics for deals belonging to their own `business_id`. The business dashboard RPC must use `auth.uid()` to resolve `business_id` and must not accept `business_id` as an input parameter (prevents IDOR).

**NFR-08**: The `deal_events` INSERT policy must allow the service role key only. Client-side code never writes directly to `deal_events` — all event writes go through a Next.js API route that uses the service role key.

**NFR-09**: The admin CSV export endpoint must verify the user's role via `auth.users` metadata before streaming the file.

### Usability

**NFR-10**: All metric values must display as human-readable formatted numbers: `1,234` not `1234`, `3.6%` not `0.0360`, `$12,450` not `12450`.

**NFR-11**: Loading states must be shown while metrics are fetching. The existing `Card` component's skeleton variant (or a simple pulse animation) must be applied to each metric card during the initial load.

**NFR-12**: If a metric RPC returns an error, the affected card must show an error state ("Could not load metric") rather than crashing the page or showing a stale value.

**NFR-13**: Empty states (zero events, newly created business) must display meaningful copy per the Messaging Style Guide, not raw zeros. Example: "No views yet — your deals will appear here once consumers start browsing."

### Reliability

**NFR-14**: Event tracking must be non-blocking. A failure in the event write must not prevent the consumer from viewing or claiming a deal. Client errors in event tracking must be logged but swallowed silently from the user's perspective.

**NFR-15**: The analytics dashboard must degrade gracefully if the Supabase connection is unavailable. It must show the last successfully loaded data (if any, from cache) or an error state, not a blank screen.

### Compliance

**NFR-16**: No personally identifiable consumer information (name, email, phone) may appear in the deal performance table or admin geographic reports. Consumer identity in event logs is represented only by `user_id` (UUID). Aggregated reports never surface individual consumer data.

**NFR-17**: The `metadata` JSONB column in `deal_events` must not store browser fingerprints, IP addresses, or device identifiers. Acceptable metadata: `{ source: 'deal_card' | 'deal_detail', referrer_category: string }`.

---

## 6. Database Schema

### 6.1 New Table: `deal_events`

```sql
-- Enable UUID extension (likely already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.deal_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text        NOT NULL,
  deal_id       bigint      NOT NULL REFERENCES public.promo_offer_master(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    text        NOT NULL,  -- anonymous UUID from localStorage, always present
  created_at    timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT deal_events_event_type_check
    CHECK (event_type IN ('view', 'save', 'unsave', 'claim'))
);

-- Partition consideration: at ~1000 views/day across all deals,
-- deal_events reaches ~365K rows/year — partitioning is NOT required for v1.
-- Revisit at 500K rows/month sustained traffic.

-- Indexes for query patterns used by RPCs
CREATE INDEX idx_deal_events_deal_id         ON public.deal_events (deal_id);
CREATE INDEX idx_deal_events_event_type      ON public.deal_events (event_type);
CREATE INDEX idx_deal_events_created_at      ON public.deal_events (created_at DESC);
CREATE INDEX idx_deal_events_user_id         ON public.deal_events (user_id) WHERE user_id IS NOT NULL;

-- Composite index for the most common RPC query pattern: events for a deal, by type, in a date range
CREATE INDEX idx_deal_events_deal_type_date  ON public.deal_events (deal_id, event_type, created_at DESC);

-- Composite index for business-scoped queries (requires join to promo_offer_master)
-- This is handled at the RPC level by filtering on deal_id IN (subquery)
-- rather than a denormalized business_id column — keeps schema normalized.

-- Deduplication: one view per (deal_id, session_id) per calendar day
-- This is enforced at the application layer in the event write route,
-- not via a unique index, to allow genuine multiple daily views in future.
-- The write route checks: SELECT 1 FROM deal_events
--   WHERE deal_id = $1 AND session_id = $2 AND event_type = 'view'
--   AND created_at >= date_trunc('day', now()) LIMIT 1
-- before inserting.
```

### 6.2 New Table: `claims` (If Not Yet Defined by Backend Team)

This PRD requires a `claims` table for lead and response-time metrics. If the backend team has a different name or schema, the RPC internals change but the interface contract defined in Section 7 remains stable.

```sql
CREATE TABLE public.claims (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             bigint      NOT NULL REFERENCES public.promo_offer_master(id) ON DELETE RESTRICT,
  consumer_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id         bigint      NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'pending',
  preferred_date      date,
  preferred_time      text,
  notes               text,
  business_response   text,
  responded_at        timestamptz,
  booked_date         date,
  booked_time         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),

  CONSTRAINT claims_status_check
    CHECK (status IN ('pending', 'contacted', 'booked', 'completed', 'cancelled', 'expired'))
);

CREATE INDEX idx_claims_deal_id     ON public.claims (deal_id);
CREATE INDEX idx_claims_business_id ON public.claims (business_id);
CREATE INDEX idx_claims_consumer_id ON public.claims (consumer_id);
CREATE INDEX idx_claims_status      ON public.claims (status);
CREATE INDEX idx_claims_created_at  ON public.claims (created_at DESC);
```

### 6.3 New Table: `business_owners`

Maps Supabase Auth users to business profiles. Required for RLS scoping in business RPCs.

```sql
CREATE TABLE public.business_owners (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id bigint  NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  role        text    NOT NULL DEFAULT 'owner',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT business_owners_role_check
    CHECK (role IN ('owner', 'manager'))
);

CREATE INDEX idx_business_owners_user_id     ON public.business_owners (user_id);
CREATE INDEX idx_business_owners_business_id ON public.business_owners (business_id);
```

### 6.4 Materialized View: `daily_deal_metrics`

```sql
CREATE MATERIALIZED VIEW public.daily_deal_metrics AS
SELECT
  deal_id,
  date_trunc('day', created_at)::date AS metric_date,
  COUNT(*) FILTER (WHERE event_type = 'view')   AS views,
  COUNT(*) FILTER (WHERE event_type = 'save')   AS saves,
  COUNT(*) FILTER (WHERE event_type = 'unsave') AS unsaves,
  COUNT(*) FILTER (WHERE event_type = 'claim')  AS claims,
  COUNT(*) FILTER (WHERE event_type = 'save')
    - COUNT(*) FILTER (WHERE event_type = 'unsave') AS net_saves
FROM public.deal_events
GROUP BY deal_id, date_trunc('day', created_at)::date;

-- Index for fast per-deal time-range lookups
CREATE UNIQUE INDEX idx_daily_deal_metrics_pk
  ON public.daily_deal_metrics (deal_id, metric_date);

-- Refresh job (Supabase cron via pg_cron)
-- Requires pg_cron extension enabled in Supabase dashboard
SELECT cron.schedule(
  'refresh-daily-deal-metrics',
  '0 0 * * *',  -- midnight UTC daily
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_deal_metrics$$
);
```

### 6.5 RLS Policies

```sql
-- deal_events: consumers can only read their own events
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consumers read own events"
  ON public.deal_events FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT is blocked via RLS for all roles; handled by SECURITY DEFINER RPC only
CREATE POLICY "No direct inserts"
  ON public.deal_events FOR INSERT
  WITH CHECK (false);

-- claims: consumers see their own, business owners see claims on their deals
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consumers read own claims"
  ON public.claims FOR SELECT
  USING (auth.uid() = consumer_id);

CREATE POLICY "Business owners read their claims"
  ON public.claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_owners bo
      WHERE bo.user_id = auth.uid()
        AND bo.business_id = claims.business_id
    )
  );
```

---

## 7. Supabase RPC Functions

All RPCs use `SECURITY DEFINER` to bypass RLS for aggregation. They enforce access control explicitly in the function body using `auth.uid()`.

### 7.1 `record_deal_event`

Writes a single event. This is the only insertion path for `deal_events`.

```sql
CREATE OR REPLACE FUNCTION public.record_deal_event(
  p_event_type  text,
  p_deal_id     bigint,
  p_session_id  text,
  p_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Validate event type
  IF p_event_type NOT IN ('view', 'save', 'unsave', 'claim') THEN
    RAISE EXCEPTION 'Invalid event_type: %', p_event_type;
  END IF;

  -- Get caller's user_id (null for anonymous sessions)
  v_user_id := auth.uid();

  -- Deduplicate views: skip if same session already viewed this deal today
  IF p_event_type = 'view' THEN
    IF EXISTS (
      SELECT 1 FROM deal_events
      WHERE deal_id     = p_deal_id
        AND session_id  = p_session_id
        AND event_type  = 'view'
        AND created_at >= date_trunc('day', now())
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO deal_events (event_type, deal_id, user_id, session_id, metadata)
  VALUES (p_event_type, p_deal_id, v_user_id, p_session_id, p_metadata);
END;
$$;
```

### 7.2 `get_business_dashboard_metrics`

Returns all metrics for the business owner's analytics dashboard. Resolves `business_id` from `auth.uid()` — no parameters accepted.

```sql
CREATE OR REPLACE FUNCTION public.get_business_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id       bigint;
  v_now               timestamptz := now();
  v_month_start       timestamptz := date_trunc('month', v_now);
  v_prev_month_start  timestamptz := date_trunc('month', v_now - INTERVAL '1 month');
  v_prev_month_end    timestamptz := v_month_start;
  v_week_start        timestamptz := date_trunc('week', v_now);
  v_prev_week_start   timestamptz := v_week_start - INTERVAL '1 week';
  v_prev_week_end     timestamptz := v_week_start;

  v_deal_ids          bigint[];
  v_views_month       bigint;
  v_claims_month      bigint;
  v_views_prev_month  bigint;
  v_claims_prev_month bigint;
  v_leads_week        bigint;
  v_leads_prev_week   bigint;
  v_active_deals      bigint;

  v_peak_day          text;
  v_top_deal_id       bigint;
  v_top_deal_title    text;
BEGIN
  -- Resolve business_id from caller identity
  SELECT business_id INTO v_business_id
  FROM business_owners
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business linked to authenticated user';
  END IF;

  -- Collect all deal IDs for this business
  SELECT ARRAY_AGG(id) INTO v_deal_ids
  FROM promo_offer_master
  WHERE business_id = v_business_id;

  -- If business has no deals yet, return zeroed-out structure
  IF v_deal_ids IS NULL OR array_length(v_deal_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'views_this_month',       0,
      'views_prev_month',       0,
      'views_trend_pct',        null,
      'claims_this_month',      0,
      'claims_prev_month',      0,
      'claims_trend_pct',       null,
      'conversion_rate',        0,
      'leads_this_week',        0,
      'leads_this_month',       0,
      'active_deals',           0,
      'peak_day_of_week',       null,
      'top_deal_title',         null
    );
  END IF;

  -- Current month views
  SELECT COUNT(*) INTO v_views_month
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'view'
    AND created_at >= v_month_start;

  -- Current month claims
  SELECT COUNT(*) INTO v_claims_month
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'claim'
    AND created_at >= v_month_start;

  -- Prior month views
  SELECT COUNT(*) INTO v_views_prev_month
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'view'
    AND created_at >= v_prev_month_start
    AND created_at <  v_prev_month_end;

  -- Prior month claims
  SELECT COUNT(*) INTO v_claims_prev_month
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'claim'
    AND created_at >= v_prev_month_start
    AND created_at <  v_prev_month_end;

  -- This week leads (claims)
  SELECT COUNT(*) INTO v_leads_week
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'claim'
    AND created_at >= v_week_start;

  -- Prior week leads
  SELECT COUNT(*) INTO v_leads_prev_week
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'claim'
    AND created_at >= v_prev_week_start
    AND created_at <  v_prev_week_end;

  -- Active deals count
  SELECT COUNT(*) INTO v_active_deals
  FROM promo_offer_master
  WHERE business_id = v_business_id
    AND end_date::date >= CURRENT_DATE;
    -- Note: end_date is text in promo_offer_master; cast assumes ISO date format.
    -- Backend team should normalize this column to date type.

  -- Peak day of week (last 30 days)
  SELECT TO_CHAR(created_at, 'Day') INTO v_peak_day
  FROM deal_events
  WHERE deal_id    = ANY(v_deal_ids)
    AND event_type = 'view'
    AND created_at >= now() - INTERVAL '30 days'
  GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Top deal by claims in last 30 days
  SELECT de.deal_id, pom.service_name INTO v_top_deal_id, v_top_deal_title
  FROM deal_events de
  JOIN promo_offer_master pom ON pom.id = de.deal_id
  WHERE de.deal_id    = ANY(v_deal_ids)
    AND de.event_type = 'claim'
    AND de.created_at >= now() - INTERVAL '30 days'
  GROUP BY de.deal_id, pom.service_name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'views_this_month',   v_views_month,
    'views_prev_month',   v_views_prev_month,
    'views_trend_pct',    CASE
                            WHEN v_views_prev_month = 0 THEN null
                            ELSE ROUND(
                              ((v_views_month::numeric - v_views_prev_month) / v_views_prev_month) * 100,
                              1
                            )
                          END,
    'claims_this_month',  v_claims_month,
    'claims_prev_month',  v_claims_prev_month,
    'claims_trend_pct',   CASE
                            WHEN v_claims_prev_month = 0 THEN null
                            ELSE ROUND(
                              ((v_claims_month::numeric - v_claims_prev_month) / v_claims_prev_month) * 100,
                              1
                            )
                          END,
    'conversion_rate',    CASE
                            WHEN v_views_month = 0 THEN 0
                            ELSE ROUND((v_claims_month::numeric / v_views_month) * 100, 1)
                          END,
    'leads_this_week',    v_leads_week,
    'leads_this_month',   v_claims_month,
    'active_deals',       v_active_deals,
    'peak_day_of_week',   TRIM(v_peak_day),
    'top_deal_title',     v_top_deal_title
  );
END;
$$;
```

### 7.3 `get_deal_performance_table`

Returns per-deal metrics for all deals belonging to the authenticated business owner.

```sql
CREATE OR REPLACE FUNCTION public.get_deal_performance_table()
RETURNS TABLE (
  deal_id         bigint,
  deal_title      text,
  service_name    text,
  views_total     bigint,
  saves_total     bigint,
  claims_total    bigint,
  conversion_rate numeric,
  is_active       boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id bigint;
BEGIN
  SELECT business_id INTO v_business_id
  FROM business_owners
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business linked to authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    pom.id                                                          AS deal_id,
    pom.offer_raw_text                                              AS deal_title,
    pom.service_name,
    COALESCE(SUM(CASE WHEN de.event_type = 'view'  THEN 1 ELSE 0 END), 0) AS views_total,
    COALESCE(SUM(CASE WHEN de.event_type = 'save'  THEN 1 ELSE 0 END), 0) AS saves_total,
    COALESCE(SUM(CASE WHEN de.event_type = 'claim' THEN 1 ELSE 0 END), 0) AS claims_total,
    CASE
      WHEN COALESCE(SUM(CASE WHEN de.event_type = 'view' THEN 1 ELSE 0 END), 0) = 0 THEN 0
      ELSE ROUND(
        COALESCE(SUM(CASE WHEN de.event_type = 'claim' THEN 1 ELSE 0 END), 0)::numeric
        / COALESCE(SUM(CASE WHEN de.event_type = 'view' THEN 1 ELSE 0 END), 0) * 100,
        1
      )
    END                                                             AS conversion_rate,
    (pom.end_date::date >= CURRENT_DATE)                           AS is_active
  FROM promo_offer_master pom
  LEFT JOIN deal_events de ON de.deal_id = pom.id
  WHERE pom.business_id = v_business_id
  GROUP BY pom.id, pom.offer_raw_text, pom.service_name, pom.end_date
  ORDER BY claims_total DESC, views_total DESC;
END;
$$;
```

### 7.4 `get_deal_time_series`

Returns 30 daily data points for a single deal. Zero-fills missing dates.

```sql
CREATE OR REPLACE FUNCTION public.get_deal_time_series(
  p_deal_id   bigint,
  p_days      integer DEFAULT 30
)
RETURNS TABLE (
  metric_date date,
  views       bigint,
  claims      bigint,
  saves       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id     bigint;
  v_deal_business   bigint;
BEGIN
  -- Verify caller owns this deal
  SELECT business_id INTO v_business_id
  FROM business_owners
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT business_id INTO v_deal_business
  FROM promo_offer_master
  WHERE id = p_deal_id;

  IF v_business_id IS NULL OR v_business_id != v_deal_business THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS metric_date
  )
  SELECT
    ds.metric_date,
    COALESCE(ddm.views,  0) AS views,
    COALESCE(ddm.claims, 0) AS claims,
    COALESCE(ddm.saves,  0) AS saves
  FROM date_series ds
  LEFT JOIN daily_deal_metrics ddm
    ON ddm.deal_id = p_deal_id
   AND ddm.metric_date = ds.metric_date
  ORDER BY ds.metric_date ASC;
END;
$$;
```

### 7.5 `get_admin_platform_metrics`

Returns all platform-wide metrics for the admin reports page. Requires admin role check.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_platform_metrics(
  p_period text DEFAULT '30d'  -- '7d' | '30d' | '90d' | 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start  timestamptz;
  v_prev_start    timestamptz;
  v_prev_end      timestamptz;
  v_interval      interval;

  v_total_consumers       bigint;
  v_new_consumers         bigint;
  v_new_consumers_prev    bigint;
  v_total_businesses      bigint;
  v_claimed_businesses    bigint;
  v_unclaimed_businesses  bigint;
  v_total_deals           bigint;
  v_active_deals          bigint;
  v_views_period          bigint;
  v_claims_period         bigint;
  v_saves_period          bigint;
  v_views_prev            bigint;
  v_claims_prev           bigint;
BEGIN
  -- Verify caller is admin
  IF (auth.jwt() ->> 'role') != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Resolve period boundaries
  v_interval := CASE p_period
    WHEN '7d'  THEN INTERVAL '7 days'
    WHEN '30d' THEN INTERVAL '30 days'
    WHEN '90d' THEN INTERVAL '90 days'
    WHEN 'all' THEN INTERVAL '100 years'
    ELSE            INTERVAL '30 days'
  END;

  v_period_start := CASE p_period
    WHEN 'all' THEN '2000-01-01'::timestamptz
    ELSE now() - v_interval
  END;

  v_prev_end   := v_period_start;
  v_prev_start := v_period_start - v_interval;

  -- User counts
  SELECT COUNT(*) INTO v_total_consumers
  FROM auth.users;  -- All registered users (admin bypasses auth.users RLS)

  SELECT COUNT(*) INTO v_new_consumers
  FROM auth.users
  WHERE created_at >= v_period_start;

  SELECT COUNT(*) INTO v_new_consumers_prev
  FROM auth.users
  WHERE created_at >= v_prev_start AND created_at < v_prev_end;

  -- Business counts
  SELECT COUNT(*) INTO v_total_businesses
  FROM master_business_info;

  SELECT COUNT(*) INTO v_claimed_businesses
  FROM business_owners;  -- Distinct businesses with at least one owner

  v_unclaimed_businesses := v_total_businesses - v_claimed_businesses;

  -- Deal counts
  SELECT COUNT(*) INTO v_total_deals
  FROM promo_offer_master;

  SELECT COUNT(*) INTO v_active_deals
  FROM promo_offer_master
  WHERE end_date::date >= CURRENT_DATE;

  -- Event counts for period
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'view'),
    COUNT(*) FILTER (WHERE event_type = 'claim'),
    COUNT(*) FILTER (WHERE event_type = 'save')
  INTO v_views_period, v_claims_period, v_saves_period
  FROM deal_events
  WHERE created_at >= v_period_start;

  -- Prior period events for trend calculation
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'view'),
    COUNT(*) FILTER (WHERE event_type = 'claim')
  INTO v_views_prev, v_claims_prev
  FROM deal_events
  WHERE created_at >= v_prev_start AND created_at < v_prev_end;

  RETURN jsonb_build_object(
    'period',                  p_period,
    'total_consumers',         v_total_consumers,
    'new_consumers',           v_new_consumers,
    'new_consumers_prev',      v_new_consumers_prev,
    'total_businesses',        v_total_businesses,
    'claimed_businesses',      v_claimed_businesses,
    'unclaimed_businesses',    v_unclaimed_businesses,
    'total_deals',             v_total_deals,
    'active_deals',            v_active_deals,
    'views_period',            v_views_period,
    'claims_period',           v_claims_period,
    'saves_period',            v_saves_period,
    'views_prev_period',       v_views_prev,
    'claims_prev_period',      v_claims_prev,
    'platform_conversion_rate', CASE
      WHEN v_views_period = 0 THEN 0
      ELSE ROUND((v_claims_period::numeric / v_views_period) * 100, 2)
    END
  );
END;
$$;
```

### 7.6 `get_admin_top_categories`

Returns top 5 service categories by claim count for the selected period.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_top_categories(
  p_period text DEFAULT '30d'
)
RETURNS TABLE (
  service_category  text,
  claim_count       bigint,
  pct_of_top        numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
BEGIN
  IF (auth.jwt() ->> 'role') != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  v_period_start := CASE p_period
    WHEN '7d'  THEN now() - INTERVAL '7 days'
    WHEN '30d' THEN now() - INTERVAL '30 days'
    WHEN '90d' THEN now() - INTERVAL '90 days'
    ELSE            '2000-01-01'::timestamptz
  END;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      pom.service_category,
      COUNT(*) AS claim_count
    FROM deal_events de
    JOIN promo_offer_master pom ON pom.id = de.deal_id
    WHERE de.event_type = 'claim'
      AND de.created_at >= v_period_start
    GROUP BY pom.service_category
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ),
  top_count AS (
    SELECT MAX(claim_count) AS max_count FROM ranked
  )
  SELECT
    r.service_category,
    r.claim_count,
    ROUND(r.claim_count::numeric / tc.max_count * 100, 1) AS pct_of_top
  FROM ranked r, top_count tc
  ORDER BY r.claim_count DESC;
END;
$$;
```

### 7.7 `get_admin_geographic_distribution`

Returns top 10 cities by deal views for the selected period.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_geographic_distribution(
  p_period text DEFAULT '30d'
)
RETURNS TABLE (
  city          text,
  view_count    bigint,
  claim_count   bigint,
  business_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
BEGIN
  IF (auth.jwt() ->> 'role') != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  v_period_start := CASE p_period
    WHEN '7d'  THEN now() - INTERVAL '7 days'
    WHEN '30d' THEN now() - INTERVAL '30 days'
    WHEN '90d' THEN now() - INTERVAL '90 days'
    ELSE            '2000-01-01'::timestamptz
  END;

  RETURN QUERY
  SELECT
    mbi.city,
    COUNT(*) FILTER (WHERE de.event_type = 'view')  AS view_count,
    COUNT(*) FILTER (WHERE de.event_type = 'claim') AS claim_count,
    COUNT(DISTINCT mbi.business_id)                 AS business_count
  FROM deal_events de
  JOIN promo_offer_master pom ON pom.id = de.deal_id
  JOIN master_business_info mbi ON mbi.business_id = pom.business_id
  WHERE de.created_at >= v_period_start
  GROUP BY mbi.city
  ORDER BY view_count DESC
  LIMIT 10;
END;
$$;
```

### 7.8 `get_admin_csv_export_data`

Returns raw daily platform metrics for CSV export. Admin-only.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_csv_export_data(
  p_period text DEFAULT '30d'
)
RETURNS TABLE (
  export_date       date,
  views             bigint,
  claims            bigint,
  saves             bigint,
  new_users         bigint,
  new_businesses    bigint,
  conversion_rate   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date;
  v_days         integer;
BEGIN
  IF (auth.jwt() ->> 'role') != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  v_days := CASE p_period
    WHEN '7d'  THEN 7
    WHEN '30d' THEN 30
    WHEN '90d' THEN 90
    ELSE            365
  END;

  v_period_start := CURRENT_DATE - v_days;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_period_start, CURRENT_DATE, INTERVAL '1 day')::date AS d
  ),
  event_agg AS (
    SELECT
      created_at::date AS d,
      COUNT(*) FILTER (WHERE event_type = 'view')  AS views,
      COUNT(*) FILTER (WHERE event_type = 'claim') AS claims,
      COUNT(*) FILTER (WHERE event_type = 'save')  AS saves
    FROM deal_events
    WHERE created_at::date >= v_period_start
    GROUP BY created_at::date
  ),
  user_agg AS (
    SELECT
      created_at::date AS d,
      COUNT(*) AS new_users
    FROM auth.users
    WHERE created_at::date >= v_period_start
    GROUP BY created_at::date
  ),
  biz_agg AS (
    SELECT
      created_at::date AS d,
      COUNT(*) AS new_businesses
    FROM master_business_info
    WHERE created_at::date >= v_period_start
    GROUP BY created_at::date
  )
  SELECT
    ds.d                                                          AS export_date,
    COALESCE(ea.views, 0)                                         AS views,
    COALESCE(ea.claims, 0)                                        AS claims,
    COALESCE(ea.saves, 0)                                         AS saves,
    COALESCE(ua.new_users, 0)                                     AS new_users,
    COALESCE(ba.new_businesses, 0)                                AS new_businesses,
    CASE
      WHEN COALESCE(ea.views, 0) = 0 THEN 0
      ELSE ROUND(COALESCE(ea.claims, 0)::numeric / ea.views * 100, 2)
    END                                                           AS conversion_rate
  FROM date_series ds
  LEFT JOIN event_agg ea ON ea.d = ds.d
  LEFT JOIN user_agg ua  ON ua.d = ds.d
  LEFT JOIN biz_agg ba   ON ba.d = ds.d
  ORDER BY ds.d ASC;
END;
$$;
```

---

## 8. API Design

### 8.1 Event Write Endpoint

```
POST /api/analytics/event
```

**Authentication**: None required (anonymous sessions supported). Rate-limited by IP.

**Request body**:
```typescript
{
  event_type: 'view' | 'save' | 'unsave' | 'claim'
  deal_id: number
  session_id: string  // UUID from localStorage, created on first visit
  metadata?: {
    source?: 'deal_card' | 'deal_detail'
    referrer_category?: string
  }
}
```

**Response**: `204 No Content` on success. `400` on invalid payload. `429` on rate limit exceeded.

**Implementation**: Uses the Supabase service role key (server-side only) to call `record_deal_event`. The service role key must never be exposed to the client.

**Rate limiting**: 60 requests per IP per minute via Vercel Edge Middleware.

```typescript
// src/app/api/analytics/event/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only, never NEXT_PUBLIC_
)

const VALID_EVENT_TYPES = ['view', 'save', 'unsave', 'claim'] as const

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || !VALID_EVENT_TYPES.includes(body.event_type) || !body.deal_id || !body.session_id) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.rpc('record_deal_event', {
    p_event_type: body.event_type,
    p_deal_id:    body.deal_id,
    p_session_id: body.session_id,
    p_metadata:   body.metadata ?? {},
  })

  if (error) {
    // Log server-side but do not surface to client
    console.error('[analytics/event]', error.message)
    return new NextResponse(null, { status: 204 })  // Still 204 — client must not retry on failure
  }

  return new NextResponse(null, { status: 204 })
}
```

### 8.2 Business Dashboard Server Actions

```typescript
// src/lib/actions/analytics.ts
'use server'

import { createClient } from '@/lib/supabase-server'  // server-side client with user session

export interface BusinessDashboardMetrics {
  views_this_month:    number
  views_prev_month:    number
  views_trend_pct:     number | null
  claims_this_month:   number
  claims_prev_month:   number
  claims_trend_pct:    number | null
  conversion_rate:     number
  leads_this_week:     number
  leads_this_month:    number
  active_deals:        number
  peak_day_of_week:    string | null
  top_deal_title:      string | null
}

export async function getBusinessDashboardMetrics(): Promise<{
  data: BusinessDashboardMetrics | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_business_dashboard_metrics')

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as BusinessDashboardMetrics, error: null }
}

export interface DealPerformanceRow {
  deal_id:         number
  deal_title:      string
  service_name:    string
  views_total:     number
  saves_total:     number
  claims_total:    number
  conversion_rate: number
  is_active:       boolean
}

export async function getDealPerformanceTable(): Promise<{
  data: DealPerformanceRow[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_deal_performance_table')

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as DealPerformanceRow[], error: null }
}

export async function getDealTimeSeries(dealId: number, days = 30) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_deal_time_series', {
    p_deal_id: dealId,
    p_days:    days,
  })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}
```

### 8.3 Admin Server Actions

```typescript
// src/lib/actions/adminAnalytics.ts
'use server'

import { createClient } from '@/lib/supabase-server'

export type TimePeriod = '7d' | '30d' | '90d' | 'all'

export async function getAdminPlatformMetrics(period: TimePeriod = '30d') {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_platform_metrics', {
    p_period: period,
  })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function getAdminTopCategories(period: TimePeriod = '30d') {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_top_categories', {
    p_period: period,
  })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

export async function getAdminGeographicDistribution(period: TimePeriod = '30d') {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_geographic_distribution', {
    p_period: period,
  })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}
```

### 8.4 CSV Export Endpoint

```
GET /api/admin/export/report?period=30d
```

**Authentication**: Admin session cookie required. Returns 403 if not admin.

**Response**: `text/csv` stream. `Content-Disposition: attachment; filename="costfinders-report-30d-2026-03-20.csv"`.

**Implementation note**: Calls `get_admin_csv_export_data`, transforms the result to CSV string server-side using a simple comma-join (no library dependency needed for flat tabular data), streams the response.

---

## 9. Frontend Integration

### 9.1 Replacing Mock Data in `analyticsDashboard.tsx`

The component currently hardcodes four metric values and five deal performance rows. The integration path:

1. Convert `AnalyticsDashboard` from a pure presentation component to one that accepts metric props:

```typescript
// New prop interface — matches RPC output shapes
interface AnalyticsDashboardProps {
  metrics: BusinessDashboardMetrics | null
  deals: DealPerformanceRow[]
  loading: boolean
  error: string | null
}
```

2. Move data fetching to `src/app/business/dashboard/analytics/page.tsx`. Since the page already has access to `businessId` from auth context, it calls the Server Actions directly:

```typescript
// src/app/business/dashboard/analytics/page.tsx
import { getBusinessDashboardMetrics, getDealPerformanceTable } from '@/lib/actions/analytics'

export default async function AnalyticsPage() {
  const [metricsResult, dealsResult] = await Promise.all([
    getBusinessDashboardMetrics(),
    getDealPerformanceTable(),
  ])

  return (
    <AnalyticsDashboard
      metrics={metricsResult.data}
      deals={dealsResult.data}
      loading={false}
      error={metricsResult.error ?? dealsResult.error}
    />
  )
}
```

3. The "Revenue Potential" metric card — currently showing `$12,450` — must be changed to display a "Coming soon" state rather than any dollar value. The icon and title remain; the value area renders a `Badge` with label "Billing integration pending".

4. The `TrendsSection` component — currently rendering four hardcoded strings — must derive content from the `metrics` prop:
   - Use `metrics.peak_day_of_week` for the peak activity insight.
   - Use `metrics.top_deal_title` for the top deal insight.
   - Use `metrics.views_trend_pct` for the month-over-month view trend.
   - A fourth static insight ("Fridays see highest claim volume") must be removed or replaced with a real insight. For v1, display only the three data-driven insights.

### 9.2 Replacing Mock Data in Admin Reports Page

The `AdminReportsPage` currently imports from `mock-data/` and renders static values regardless of the selected `timePeriod` state. The integration path:

1. Convert the page to a Server Component. The time-period selector becomes a client-side URL param (`?period=30d`) that triggers a full page reload, keeping the page server-rendered.

2. Extract the time-period selector buttons into a `TimePeriodSelector` Client Component that updates the URL param on click.

3. The page reads `searchParams.period` and calls all admin Server Actions in parallel:

```typescript
// src/app/admin/dashboard/reports/page.tsx
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const period = (['7d', '30d', '90d', 'all'].includes(searchParams.period ?? '')
    ? searchParams.period
    : '30d') as TimePeriod

  const [metricsResult, categoriesResult, geoResult] = await Promise.all([
    getAdminPlatformMetrics(period),
    getAdminTopCategories(period),
    getAdminGeographicDistribution(period),
  ])

  // render ...
}
```

4. Remove all imports from `mock-data/businesses`, `mock-data/consumers`, `mock-data/categories` in this file.

5. The "Recent Platform Activity" feed currently uses hardcoded strings with relative timestamps like "2 hours ago". Replace with a query against `deal_events` and `auth.users` (most recent 10 events platform-wide), computing the relative time from the real `created_at` column. The existing `formatRelativeTime` utility function in `admin/dashboard/page.tsx` can be reused.

### 9.3 Event Tracking Hook

A lightweight client hook fires events without blocking rendering:

```typescript
// src/lib/hooks/useAnalytics.ts
'use client'

import { useCallback } from 'react'

function getOrCreateSessionId(): string {
  const key = 'cf_session_id'
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
  }
  return sid
}

export function useAnalytics() {
  const track = useCallback(
    (
      eventType: 'view' | 'save' | 'unsave' | 'claim',
      dealId: number,
      metadata?: Record<string, string>
    ) => {
      // Fire-and-forget — never await, never block
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          deal_id:    dealId,
          session_id: getOrCreateSessionId(),
          metadata:   metadata ?? {},
        }),
        keepalive: true,  // survives page navigation
      }).catch(() => {
        // Intentionally swallowed — analytics must never surface errors to consumers
      })
    },
    []
  )

  return { track }
}
```

**Usage in deal card**:
```typescript
const { track } = useAnalytics()

// On mount (deal card visible in viewport via IntersectionObserver)
useEffect(() => {
  if (isVisible) track('view', deal.id, { source: 'deal_card' })
}, [isVisible])

// On save button click
const handleSave = () => {
  track('save', deal.id)
  // ... existing save logic
}
```

**Usage in claim form submission**:
```typescript
const handleClaimSubmit = async (formData) => {
  track('claim', deal.id, { source: 'deal_detail' })
  // ... existing claim logic
}
```

### 9.4 Loading and Error States

All metric cards must show a loading skeleton while data fetches. Given the page is a Server Component, the skeleton renders via React Suspense:

```typescript
// Wrap the metrics grid in Suspense with a skeleton fallback
<Suspense fallback={<MetricsGridSkeleton />}>
  <MetricsGrid />
</Suspense>
```

The `MetricsGridSkeleton` renders four `Card` components with a `animate-pulse` div in place of the metric value. This aligns with the existing `Card variant="glass"` pattern and requires no new component.

Error state in `MetricCard`: when `value` is `null` and `error` is non-null, render:
```
Could not load metric
```
in place of the numeric value, using `text-[#92400e]` (the existing muted amber tone).

---

## 10. Edge Cases & Error Handling

### 10.1 Business Has No Events Yet

**Scenario**: A business just claimed their profile or was recently added to the platform. No `deal_events` rows exist for their deals.

**Handling**: `get_business_dashboard_metrics` returns all-zero values (enforced by the early-return branch in the RPC). The frontend renders the metric cards with `0` values and a distinct empty-state message in the Insights section: "Your analytics will populate as consumers discover your deals." This message is defined in the Messaging Style Guide under `empty-states/analytics`.

### 10.2 Zero Views, Non-Zero Claims

**Scenario**: Possible during early data migration or if events were not recorded for older claims.

**Handling**: Conversion rate displays as `0.0%` (denominator guard in RPC). Never displays infinity, NaN, or `null`.

### 10.3 `end_date` Column Type Mismatch

The `promo_offer_master.end_date` column is typed as `text` in the current schema. RPCs that cast it with `end_date::date` will fail if the column contains non-ISO date strings or `null` values.

**Mitigation**: The `is_active` calculation in RPCs uses `end_date::date >= CURRENT_DATE` wrapped in a `CASE WHEN end_date IS NOT NULL AND end_date ~ '^\d{4}-\d{2}-\d{2}$' THEN ... ELSE false END` guard. Backend team must migrate `end_date` to a proper `date` type as part of the backend integration work. This is tracked as a prerequisite in the Open Questions section.

### 10.4 Time Period Filter Produces No Data

**Scenario**: Admin selects `7d` filter on a freshly launched platform with no events.

**Handling**: All counts display as `0`. The "Business Activity" table shows zero-valued rows rather than an empty table. The "Top Performing Categories" section displays the empty state: "No claim data for this period yet."

### 10.5 Materialized View Staleness

**Scenario**: The `daily_deal_metrics` cron job fails overnight. Time-series charts show yesterday's data as the most recent point.

**Handling**: The chart's X-axis always extends to `CURRENT_DATE`. Missing data for today shows as `0` (zero-fill from `generate_series`). A staleness warning is not shown to business owners in v1 — the discrepancy is minor (one day) and the admin team can manually trigger a refresh via the Supabase dashboard.

### 10.6 Rate Limit on Event Write Endpoint

**Scenario**: A scraper or malicious actor sends thousands of fake view events for a deal, inflating its metrics.

**Handling**: Vercel Edge Middleware rate limits the `/api/analytics/event` endpoint to 60 requests per IP per minute. Beyond this, return `429 Too Many Requests`. The deduplication logic in `record_deal_event` (one view per session per day) provides additional protection at the database level. Full fraud detection is out of scope for v1.

### 10.7 Concurrent Materialized View Refresh Failure

The `REFRESH MATERIALIZED VIEW CONCURRENTLY` command requires a unique index on the materialized view. `idx_daily_deal_metrics_pk` on `(deal_id, metric_date)` satisfies this requirement. If the index is missing, the refresh will fail silently in the cron job. The unique index creation is part of the migration and must be verified before enabling the cron schedule.

### 10.8 Admin Role Check Failure

**Scenario**: The `auth.jwt()` claim does not contain a `role` field because the Supabase user metadata has not been configured with custom claims.

**Handling**: Admin RPCs check `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. Backend team must set `app_metadata.role = 'admin'` on admin user accounts via the Supabase service role API, not `user_metadata` (which is user-editable). This is a hard prerequisite.

---

## 11. Acceptance Criteria

### AC-01: Event Recording

**Given** a consumer views a deal card
**When** the deal card enters the viewport
**Then** a `view` event row appears in `deal_events` within 1 second, with the correct `deal_id`, a non-null `session_id`, and `event_type = 'view'`

**Given** the same consumer views the same deal again in the same session on the same day
**When** a second view event is attempted
**Then** no duplicate row is inserted (confirmed by SELECT COUNT(*) query in test)

**Given** a consumer clicks the save icon on a deal
**When** the save action completes
**Then** a `save` event row appears with correct `deal_id` and `user_id` matching the authenticated user

**Given** the event write API receives an unknown `event_type`
**When** `POST /api/analytics/event` is called with `event_type: "click"`
**Then** the API returns `400 Bad Request` and no row is inserted

### AC-02: Business Dashboard Metrics

**Given** a business owner has 10 deals, with 500 view events and 20 claim events this calendar month
**When** the analytics dashboard loads
**Then** the Total Views card shows `500`, Total Claims shows `20`, Conversion Rate shows `4.0%`

**Given** a business owner with no events
**When** the analytics dashboard loads
**Then** all metric values show `0` and the Insights section shows the "no data yet" empty state message

**Given** a business owner authenticated as Business A
**When** `get_business_dashboard_metrics()` is called
**Then** the returned metrics contain only events for Business A's deals; events from Business B's deals are not counted (verified by creating test data for both businesses and confirming counts are isolated)

### AC-03: Deal Performance Table

**Given** a business has 5 deals, each with different event counts
**When** the deal performance table renders
**Then** each row shows the correct per-deal view, save, and claim counts; the row with the highest claims shows a crown icon; deals with `end_date < today` show "Expired" status

**Given** a deal has 0 events
**When** it appears in the deal performance table
**Then** all numeric columns show `0`, not `null`, `NaN`, or an empty string

### AC-04: Admin Reports

**Given** an admin selects the `7d` time period
**When** the platform metrics render
**Then** counts reflect only events and registrations from the last 7 calendar days, not all-time

**Given** an admin selects `30d` then selects `90d`
**When** each selection triggers a page reload
**Then** the metric values change between the two selections (assuming real data spans more than 7 days)

**Given** a non-admin authenticated user attempts to call `get_admin_platform_metrics`
**When** the RPC executes
**Then** it raises an exception and returns no data

### AC-05: CSV Export

**Given** an admin clicks "Export CSV" with the `30d` period selected
**When** the export completes
**Then** a CSV file downloads with the filename pattern `costfinders-report-30d-YYYY-MM-DD.csv`, containing exactly 31 data rows (one per day, inclusive), with valid numeric values in every cell

**Given** an unauthenticated user requests `GET /api/admin/export/report`
**When** the request is processed
**Then** the response is `403 Forbidden`

### AC-06: Performance

**Given** a business owner's analytics page on production Supabase
**When** the page loads cold (no cache)
**Then** metrics are visible within 1500ms (p95 over 10 manual test runs)

**Given** the event write endpoint
**When** 10 concurrent event writes are sent
**Then** all 10 return `204` within 200ms each (p95)

---

## 12. Out of Scope (v1)

The following capabilities are explicitly excluded from this implementation. They are documented here to prevent scope creep and provide a clear reference for future PRDs.

| Feature | Reason Deferred |
|---|---|
| Real-time streaming metrics (WebSocket / Supabase Realtime) | Adds infrastructure complexity with minimal benefit at current traffic volumes. Revisit when sustained traffic exceeds 10K events/day. |
| Revenue from leads metric | Requires Stripe integration to be complete. Card renders a "Coming Soon" state. |
| Average response time to leads metric | Requires the `claims.responded_at` field to be reliably populated. Deferred until claims workflow is validated in production. |
| Monthly partitioning of `deal_events` | Not needed at projected v1 volumes (<365K rows/year). Include in a future migration if row count exceeds 2M. |
| Funnel visualization (view → save → claim) | Requires a charting library (Recharts or similar). Adds bundle weight. Deferred to a dedicated data visualization phase. |
| Consumer-facing analytics (view history, claim rate) | No user research validation that consumers want this. |
| A/B testing framework for deal performance | Requires feature flag infrastructure. Not planned for v1. |
| Automated anomaly detection or alerting | Manual admin review is sufficient at current scale. |
| Business-to-business comparison benchmarking | Privacy and competitive sensitivity concerns; requires product/legal review. |
| Third-party analytics integration (Mixpanel, Amplitude) | First-party event data is sufficient. Third-party tools introduce GDPR/CCPA complexity. |

---

## 13. Open Questions

| # | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `end_date` in `promo_offer_master` be migrated to a `date` column type before analytics launch? RPCs currently use a text-cast workaround. | Backend team | Before migration is applied |
| Q2 | What is the expected `app_metadata.role` claim structure for admin users in Supabase Auth? The RPC assumes `app_metadata.role = 'admin'`. Confirm with backend team. | Backend team | Before admin RPCs are tested |
| Q3 | Will the `claims` table use the schema defined in this PRD, or does the backend team have an existing definition? If different, what are the column names for `responded_at` and `business_id`? | Backend team | Before `get_business_dashboard_metrics` RPC is tested |
| Q4 | Is `promo_offer_master.business_id` reliably populated for scraped deals? If some rows have `null` business_id, business-scoped metrics queries need a null guard. | Data team | Before migration is applied |
| Q5 | What is the Supabase plan tier at launch? The `pg_cron` extension required for the materialized view refresh schedule is available on Pro tier and above, not Free tier. If launching on Free tier, the refresh must be triggered via a Vercel cron job calling a Supabase Edge Function instead. | Infra | Before staging deployment |
| Q6 | Should anonymous (not logged in) `view` events be tracked? The current design uses a `session_id` from localStorage to deduplicate, but `user_id` is null. If yes, confirm the privacy policy covers anonymous session tracking. | Legal / Product | Before event tracking is enabled in production |
| Q7 | What is the expected data retention policy for `deal_events`? Indefinite retention is simple but increases storage costs over time. A rolling 2-year retention policy (delete events older than 24 months) is recommended. | Product / Legal | Within 90 days of launch |

---

*End of PRD 10: Analytics & Reporting*

*This document is a living specification. Update the version number and date when sections are revised. Major changes (schema alterations, RPC signature changes) require re-review by backend and frontend leads before implementation.*
