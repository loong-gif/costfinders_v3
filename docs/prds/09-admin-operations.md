# PRD 09 — Admin Panel Backend Operations

**Status**: Draft
**Version**: 1.0
**Date**: 2026-03-20
**Author**: Product
**Supabase Project**: costfinder (`kdlpkjzcnbkjcvwsvlwn`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Current State Audit](#3-current-state-audit)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Schema](#6-database-schema)
7. [RLS Policy Design](#7-rls-policy-design)
8. [Permission Matrix](#8-permission-matrix)
9. [API Design](#9-api-design)
10. [Frontend Integration](#10-frontend-integration)
11. [Edge Cases and Error Handling](#11-edge-cases-and-error-handling)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Implementation Phases](#13-implementation-phases)
14. [Risk Assessment](#14-risk-assessment)

---

## 1. Executive Summary

### Problem Statement

The CostFinders admin panel exists entirely as a UI prototype backed by in-memory mock data. Every admin action — approving deals, suspending users, managing content — operates on JavaScript objects that reset on page refresh. Authentication is a localStorage stub that accepts any email from a hardcoded list with no password verification. This is unsuitable for any operational use.

### Solution Overview

Replace all mock data and fake authentication with real Supabase-backed operations. The solution introduces:

- Supabase Auth-based admin login with email/password and role verification
- Role-based access control using Supabase user metadata and a `user_roles` table
- Real CRUD for deals, businesses, consumers, content, and claims
- An `admin_audit_log` table capturing every admin action
- Server Actions for all write operations (no client-side mutations to sensitive data)
- New tables: `content_categories`, `content_locations`, `business_claims`, `platform_leads`

### Business Impact

The admin panel cannot be operated in production without this work. Every moderation decision made today is lost on browser refresh. Admin access has no real security. This PRD unblocks production operations.

### Resource Requirements

- Backend: 3–4 sprints to implement schema, RLS, Server Actions, and context rewiring
- No new UI: all pages already exist and render correctly against mock data. The work is plumbing, not design.

### Risk Assessment Summary

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| RLS misconfiguration exposing admin data | Medium | High | Automated tests against anon key after each migration |
| Breaking existing consumer/business auth flows | Medium | High | Admin tables are separate; consumer auth is unaffected |
| Audit log growing unboundedly | Low | Medium | Partition by month; expose export in Data Management page |
| Supabase service key leaking | Low | Critical | Service key used only in Server Actions, never in client bundles |

---

## 2. Product Overview

### Product Vision

The admin panel is CostFinders' internal operations hub. It must allow a small team of super admins, moderators, and support staff to run the platform without accessing the Supabase dashboard directly.

### Target Users

| Role | Description | Access Level |
|------|-------------|-------------|
| `super_admin` | Full platform control. Creates other admins. | Unrestricted |
| `moderator` | Reviews deal submissions. Cannot manage admins or monetization settings. | Deals, businesses, users, content |
| `support` | Handles consumer and business inquiries. Read-mostly. | Users, businesses (read + suspend only), leads |

### Value Proposition

- Moderators can approve/reject deals without Supabase dashboard access
- Support can relay leads and view account details without direct database access
- Every action is auditable for accountability and debugging
- Content (categories, locations) is managed without code deployments

### Success Criteria

| Metric | Target |
|--------|--------|
| Auth round-trip (login → dashboard) | Under 2 seconds |
| Moderation action persistence | 100% — no action is lost on refresh |
| Audit log coverage | 100% of write operations produce a log entry |
| RLS correctness | anon key cannot read `admin_audit_log` or `user_roles` |
| Admin creation | Only possible via super_admin UI or direct Supabase dashboard |

---

## 3. Current State Audit

### What Exists (UI Only)

All pages in `src/app/admin/dashboard/` are fully built and functional against mock data:

| Route | Component | Mock Data Source |
|-------|-----------|-----------------|
| `/admin` | Login page | `src/lib/mock-data/admins.ts` |
| `/admin/dashboard` | Overview metrics | Inline hardcoded + `businesses`, `consumers`, `deals` mock arrays |
| `/admin/dashboard/deals` | Deal moderation | `src/lib/mock-data/deals.ts` — `getAllDeals()`, `updateDealModeration()` |
| `/admin/dashboard/businesses` | Business management | `src/lib/mock-data/businesses.ts` — `getAllBusinesses()`, `updateBusinessStatus()`, `updateBusinessTier()` |
| `/admin/dashboard/users` | Consumer management | `src/lib/mock-data/consumers.ts` — `getAllConsumers()`, `updateConsumerStatus()` |
| `/admin/dashboard/content` | Content hub | N/A (index page) |
| `/admin/dashboard/content/categories` | Category CRUD | `src/lib/mock-data/categories.ts` |
| `/admin/dashboard/content/locations` | Location CRUD | `src/lib/mock-data/locations.ts` |
| `/admin/dashboard/content/treatments` | Treatment CRUD | `src/lib/mock-data/treatments.ts` |
| `/admin/dashboard/reports` | Platform metrics | Inline hardcoded numbers |
| `/admin/dashboard/monetization` | Pricing settings | `src/lib/mock-data/platformSettings.ts` |
| `/admin/dashboard/data` | Export + audit log | Inline mock activity log |

### What Does Not Exist

- `AdminAuthContext` uses `localStorage` and hardcoded admin records; no Supabase session
- No `user_roles` table or admin role stored in Supabase
- No `admin_audit_log` table
- No `content_categories` table (categories are in-memory only)
- No `content_locations` / `content_areas` tables
- No `business_claims` table (claims are mock)
- No Server Actions for any admin write operation
- No RLS policies for admin-scoped operations

### Files to Replace

| File | Current Role | Replacement |
|------|-------------|------------|
| `src/lib/context/adminAuthContext.tsx` | Mock localStorage auth | Supabase Auth + role check |
| `src/lib/mock-data/admins.ts` | Hardcoded admin list | Removed; admin identity comes from Supabase session |
| `src/lib/mock-data/deals.ts` (admin functions) | In-memory mutation | Server Actions against `promo_offer_master` + new `deal_submissions` table |
| `src/lib/mock-data/businesses.ts` (admin functions) | In-memory mutation | Server Actions against `master_business_info` |
| `src/lib/mock-data/consumers.ts` (admin functions) | In-memory mutation | Server Actions against Supabase Auth users table |
| `src/lib/mock-data/categories.ts` | In-memory CRUD | Server Actions against `content_categories` |
| `src/lib/mock-data/locations.ts` | In-memory CRUD | Server Actions against `content_locations` + `content_areas` |
| `src/lib/mock-data/platformSettings.ts` | In-memory settings | Server Actions against `platform_settings` table |

---

## 4. Functional Requirements

### 4.1 Admin Authentication

**FR-AUTH-01**: Admin login uses Supabase Auth `signInWithPassword`. No magic link, no OAuth.

**FR-AUTH-02**: After successful auth, the system checks `user_roles` for a role of `super_admin`, `moderator`, or `support`. If no admin role exists, the session is signed out and the user is shown "Access denied — this account does not have admin privileges."

**FR-AUTH-03**: Admin sessions persist across browser refreshes using Supabase's built-in session storage (not localStorage).

**FR-AUTH-04**: The `AdminAuthContext` must expose `admin.role`, `admin.email`, and `admin.id` (the Supabase auth user UUID) to all admin pages.

**FR-AUTH-05**: Admin creation is not self-service. New admins are created by a super_admin using a "Create Admin" form that calls `supabase.auth.admin.createUser` (service key, Server Action only) and inserts a record into `user_roles`.

**FR-AUTH-06**: Session expiry must redirect to `/admin` with the error "Your session expired. Please sign in again."

**FR-AUTH-07**: Concurrent session detection is out of scope for this PRD.

---

### 4.2 Deal Moderation Workflow

**FR-DEAL-01**: The deals moderation page (`/admin/dashboard/deals`) loads submissions from a new `deal_submissions` table (separate from `promo_offer_master` which stores scraped data). Deal submissions come from business owners via the business dashboard.

**FR-DEAL-02**: Filter tabs — All, Pending Review, Approved, Rejected, Changes Requested — map directly to the `moderation_status` column on `deal_submissions`.

**FR-DEAL-03**: Approve action:
- Sets `moderation_status = 'approved'`, `moderated_at = now()`, `moderated_by = admin_user_id`
- Writes to `admin_audit_log`
- Returns the updated record to the UI for optimistic update

**FR-DEAL-04**: Reject action:
- Sets `moderation_status = 'rejected'`, `moderation_notes` = required rejection reason
- Writes to `admin_audit_log`
- A rejection reason is mandatory. The existing notes textarea in `dealModerationCard.tsx` handles this for "Request Changes" — rejection must also prompt for a reason. This is a UI addition to the existing card component.

**FR-DEAL-05**: Request Changes action:
- Sets `moderation_status = 'changes_requested'`, `moderation_notes` = required change description
- Writes to `admin_audit_log`
- Notifies business owner (email notification is out of scope for this PRD; stub a `notify_business_on_moderation_update` function that logs intent)

**FR-DEAL-06**: Re-review: A deal with `changes_requested` status can be resubmitted by the business owner (sets status back to `pending_review`). When a moderator revisits it, the original notes and history are visible in the card.

**FR-DEAL-07**: Bulk approve is not functional in the current UI (disabled button). It remains disabled in this PRD. It is listed in acceptance criteria as an explicit out-of-scope acknowledgment.

---

### 4.3 Business Claim Approval

**FR-CLAIM-01**: A `business_claims` table records when a business owner submits a claim for an unclaimed business in `master_business_info`.

**FR-CLAIM-02**: The businesses management page gains a "Pending Claims" tab that shows claims with `status = 'pending'`.

**FR-CLAIM-03**: Approve claim:
- Sets `business_claims.status = 'approved'`, `approved_by = admin_user_id`, `approved_at = now()`
- Updates `master_business_info` to record the claiming user (a new `claimed_by_user_id` column)
- Writes to `admin_audit_log`

**FR-CLAIM-04**: Reject claim:
- Sets `business_claims.status = 'rejected'`, `rejection_reason` is required
- Does not modify `master_business_info`
- Writes to `admin_audit_log`

**FR-CLAIM-05**: A business can have at most one pending claim at a time. Submitting a new claim while one is pending returns an error to the business owner.

---

### 4.4 User Management

**FR-USER-01**: The users page loads real consumers from `auth.users` joined with a `consumer_profiles` table (to be defined in a separate consumer-facing PRD, or queried from existing Supabase auth metadata for now).

**FR-USER-02**: Suspend consumer:
- Sets `consumer_profiles.status = 'suspended'` and `consumer_profiles.suspended_at = now()`
- Writes to `admin_audit_log` with the reason (reason is optional for suspension, unlike rejection)
- Does not delete the Supabase auth user account

**FR-USER-03**: Reactivate consumer: reverses the above.

**FR-USER-04**: View consumer details: admin can click a consumer row to see their full profile, claims history, and deal interaction history. This is a detail panel or modal, not a separate page.

**FR-USER-05**: Business owner management (business users who have claimed a business) follows the same suspend/reactivate pattern. Suspending a business owner does not affect the `master_business_info` record; it prevents login.

**FR-USER-06**: The support role can suspend consumers but cannot delete accounts. The super_admin can delete accounts.

---

### 4.5 Content Management

**FR-CONTENT-01**: Treatment categories are stored in `content_categories`. All existing mock data must be seeded into this table as part of the migration.

**FR-CONTENT-02**: Category CRUD:
- Create: `name`, `slug`, `description`, `icon_name`, `is_active = true`
- Update: `name`, `description`, `icon_name`
- Toggle: `is_active`
- Delete: only if zero deals reference this category (enforced by FK constraint). If deals exist, the UI shows "Cannot delete — X deals are linked to this category."

**FR-CONTENT-03**: Cities and service areas are stored in `content_locations` (cities) and `content_areas` (areas within a city). All existing mock location data is seeded.

**FR-CONTENT-04**: Location CRUD:
- Create city: `name`, `state`, `state_code`, `latitude`, `longitude`, `timezone`, `is_active = true`
- Create area: `city_id`, `name`, `latitude`, `longitude`, `radius_miles`, `is_active = true`
- Toggle city and area active status
- Delete: only if no businesses reference this city (same guard as categories)

**FR-CONTENT-05**: Treatments management — the existing `content/treatments` page operates on a `content_treatments` table. Structure mirrors categories. Not detailed further in this PRD as no unique workflow exists; it follows the same pattern as categories.

**FR-CONTENT-06**: All content mutations write to `admin_audit_log`.

---

### 4.6 Lead Relay Dashboard

**FR-LEAD-01**: A "leads" section of the dashboard (currently accessible via the businesses page) shows new business ownership claims that require manual relay to the business owner by phone or email.

**FR-LEAD-02**: The `platform_leads` table stores every consumer "claim" of a deal — the consumer intent to contact a business about a deal they found on the platform.

**FR-LEAD-03**: Admin can view leads by business, filter by `relayed_status = 'pending' | 'relayed' | 'failed'`.

**FR-LEAD-04**: Mark as relayed:
- Sets `relayed_status = 'relayed'`, `relayed_by = admin_user_id`, `relayed_at = now()`
- Writes to `admin_audit_log`

**FR-LEAD-05**: Mark as failed:
- Sets `relayed_status = 'failed'`, `failure_reason` stored in `details`
- Writes to `admin_audit_log`

**FR-LEAD-06**: The existing reports page mock activity feed is replaced by real data from `admin_audit_log` (most recent 50 records).

---

### 4.7 Platform Metrics

**FR-METRICS-01**: The dashboard overview page metrics are real counts:
- "Total Active Deals" — `COUNT(*) FROM deal_submissions WHERE moderation_status = 'approved' AND is_active = true`
- "Pending Moderation" — `COUNT(*) FROM deal_submissions WHERE moderation_status = 'pending_review'`
- "Active Businesses" — `COUNT(*) FROM master_business_info WHERE is_active = true`
- "Total Consumers" — `COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'user_type' = 'consumer'` (or `consumer_profiles` table count)

**FR-METRICS-02**: The reports page time-period selector (7d / 30d / 90d / all) filters real counts. For this PRD, counts are computed at request time using SQL `WHERE created_at >= now() - INTERVAL '7 days'`. No pre-aggregation or analytics infrastructure.

**FR-METRICS-03**: Platform revenue metrics remain stubbed ("coming soon") until a payments integration PRD is completed.

---

### 4.8 Admin Audit Log

**FR-AUDIT-01**: Every write operation performed by an admin produces one row in `admin_audit_log`. Reads are not logged.

**FR-AUDIT-02**: Schema:

| Column | Value |
|--------|-------|
| `admin_id` | UUID of the acting admin (`auth.uid()`) |
| `action` | Enum: `deal_approved`, `deal_rejected`, `deal_changes_requested`, `business_suspended`, `business_activated`, `business_tier_changed`, `claim_approved`, `claim_rejected`, `consumer_suspended`, `consumer_activated`, `content_created`, `content_updated`, `content_deleted`, `lead_relayed`, `admin_created`, `platform_settings_updated` |
| `target_type` | Enum: `deal`, `business`, `business_claim`, `consumer`, `category`, `location`, `area`, `treatment`, `lead`, `admin`, `platform_settings` |
| `target_id` | Text — the UUID or bigint ID of the affected record, stored as text |
| `details` | JSONB — additional context (e.g., `{ "from": "pending_review", "to": "approved" }`) |
| `created_at` | Timestamptz, defaultNow |

**FR-AUDIT-03**: The Data Management page "Admin Activity Log" table reads from `admin_audit_log` ordered by `created_at DESC`, limit 50. Filter tabs (All / Moderation / User Actions / Exports) are implemented client-side.

**FR-AUDIT-04**: Audit log rows are immutable. No update or delete is permitted via the application. Only a `super_admin` can export logs (CSV export button in Data Management page).

---

## 5. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Admin login (auth + role check) | Under 1.5 seconds |
| Deal list load (100 items) | Under 800ms |
| Moderation action (approve/reject/request changes) | Under 1 second |
| Dashboard metrics query | Under 2 seconds |
| Audit log load (50 rows) | Under 500ms |

All admin pages use Server Components for initial data fetch where possible, with client-side optimistic updates for moderation actions. The `AdminAuthContext` is the only persistent client state.

### Security

- The Supabase service role key is never exposed to the client. All admin mutations that bypass RLS use Server Actions that import from a server-only Supabase client.
- Admin routes (`/admin/dashboard/*`) are protected by middleware that checks the Supabase session and the `user_roles` table. A missing or invalid admin role redirects to `/admin`.
- The `admin_audit_log` table is readable only by admin roles (RLS). It is not readable by the anon key, business owners, or consumers.
- Passwords are managed entirely by Supabase Auth. No password storage in application tables.
- Rate limiting on `/admin` login: Supabase Auth's built-in rate limiting applies. No additional custom rate limiting is required for this PRD.

### Usability

- All existing admin UI components remain unchanged in appearance and behavior. This PRD only replaces data sources.
- Loading states must be shown during Server Action calls. The existing `isLoading` / `isProcessing` patterns in `DealModerationCard` are reused.
- Optimistic UI: moderation card status updates immediately on action; the Server Action result confirms or rolls back.

### Reliability

- Server Actions are idempotent: approving an already-approved deal returns a success result without duplicate audit log entries (check `moderation_status` before writing).
- If the audit log insert fails, the primary action is not rolled back. Audit log writes are best-effort in the first iteration. A Postgres trigger can be used to make them atomic if audit completeness becomes a hard requirement.

### Compliance

- Admin user personally identifiable information (email, IP) is not stored in `admin_audit_log`. Only the admin's Supabase UUID is stored.
- Consumer PII accessed by admins is not cached outside of the browser session.

---

## 6. Database Schema

### Migration Order

Migrations must be applied in this sequence to satisfy foreign key dependencies:

1. `user_roles`
2. `content_categories`
3. `content_locations` + `content_areas`
4. `content_treatments`
5. `deal_submissions`
6. `business_claims`
7. `platform_leads`
8. `platform_settings`
9. `admin_audit_log`
10. Seed scripts for categories, locations, treatments

---

### Migration 01: user_roles

```sql
-- Migration: 20260320_01_user_roles.sql

CREATE TABLE IF NOT EXISTS public.user_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id)  -- one role per user; a user cannot hold two admin roles
);

-- Index for fast role lookups on every admin page load
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

COMMENT ON TABLE public.user_roles IS
  'Admin role assignments. Only entries here grant admin panel access. '
  'Created via super_admin UI or Supabase dashboard seeding.';
```

---

### Migration 02: content_categories

```sql
-- Migration: 20260320_02_content_categories.sql

CREATE TABLE IF NOT EXISTS public.content_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  description  text NOT NULL DEFAULT '',
  icon_name    text NOT NULL DEFAULT 'Tag',
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_categories_slug ON public.content_categories(slug);
CREATE INDEX idx_content_categories_active ON public.content_categories(is_active);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_categories_updated_at
  BEFORE UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: existing mock categories
INSERT INTO public.content_categories (name, slug, description, icon_name, is_active, sort_order)
VALUES
  ('Botox & Neurotoxins', 'botox',    'Wrinkle-relaxing neurotoxin treatments',            'Syringe',   true, 1),
  ('Fillers',             'fillers',  'Dermal and lip filler treatments',                   'Drop',      true, 2),
  ('Facials & Lasers',    'facials',  'Skin-resurfacing and hydration treatments',          'Sparkle',   true, 3),
  ('Laser Treatments',    'laser',    'Laser hair removal and skin resurfacing',            'Lightning', true, 4),
  ('Body Contouring',     'body',     'Non-surgical body sculpting treatments',             'Person',    true, 5),
  ('Skincare',            'skincare', 'Medical-grade skincare products and treatments',     'Leaf',      true, 6)
ON CONFLICT (slug) DO NOTHING;
```

---

### Migration 03: content_locations and content_areas

```sql
-- Migration: 20260320_03_content_locations.sql

CREATE TABLE IF NOT EXISTS public.content_locations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  state        text NOT NULL,
  state_code   char(2) NOT NULL,
  latitude     float8 NOT NULL DEFAULT 0,
  longitude    float8 NOT NULL DEFAULT 0,
  timezone     text NOT NULL DEFAULT 'America/Chicago',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_locations_active ON public.content_locations(is_active);
CREATE INDEX idx_content_locations_state  ON public.content_locations(state_code);

CREATE TRIGGER content_locations_updated_at
  BEFORE UPDATE ON public.content_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.content_areas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id      uuid NOT NULL REFERENCES public.content_locations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  latitude     float8 NOT NULL DEFAULT 0,
  longitude    float8 NOT NULL DEFAULT 0,
  radius_miles float4 NOT NULL DEFAULT 5,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

CREATE INDEX idx_content_areas_city_id ON public.content_areas(city_id);
CREATE INDEX idx_content_areas_active  ON public.content_areas(is_active);

CREATE TRIGGER content_areas_updated_at
  BEFORE UPDATE ON public.content_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: top cities from master_business_info
-- (Abbreviated; full seed script covers all cities from mock-data/locations.ts)
INSERT INTO public.content_locations (name, state, state_code, timezone, is_active)
VALUES
  ('Tucson',          'Arizona',      'AZ', 'America/Phoenix',  true),
  ('Oklahoma City',   'Oklahoma',     'OK', 'America/Chicago',  true),
  ('Irvine',          'California',   'CA', 'America/Los_Angeles', true),
  ('Tustin',          'California',   'CA', 'America/Los_Angeles', true),
  ('Costa Mesa',      'California',   'CA', 'America/Los_Angeles', true),
  ('Boulder',         'Colorado',     'CO', 'America/Denver',   true),
  ('Edmond',          'Oklahoma',     'OK', 'America/Chicago',  true),
  ('Santa Ana',       'California',   'CA', 'America/Los_Angeles', true),
  ('Norman',          'Oklahoma',     'OK', 'America/Chicago',  true),
  ('Laguna Hills',    'California',   'CA', 'America/Los_Angeles', true)
ON CONFLICT DO NOTHING;
```

---

### Migration 04: content_treatments

```sql
-- Migration: 20260320_04_content_treatments.sql

CREATE TABLE IF NOT EXISTS public.content_treatments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES public.content_categories(id) ON DELETE RESTRICT,
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  description  text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_treatments_category ON public.content_treatments(category_id);
CREATE INDEX idx_content_treatments_active   ON public.content_treatments(is_active);

CREATE TRIGGER content_treatments_updated_at
  BEFORE UPDATE ON public.content_treatments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### Migration 05: deal_submissions

This table holds business-owner-submitted deals awaiting moderation. It is distinct from `promo_offer_master` (scraped data). Eventually the two will be unified; for now they are separate.

```sql
-- Migration: 20260320_05_deal_submissions.sql

CREATE TYPE deal_moderation_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'changes_requested'
);

CREATE TABLE IF NOT EXISTS public.deal_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         bigint NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  submitted_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Deal content
  title               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  category_id         uuid REFERENCES public.content_categories(id) ON DELETE SET NULL,
  original_price      numeric(10,2) NOT NULL CHECK (original_price > 0),
  deal_price          numeric(10,2) NOT NULL CHECK (deal_price >= 0),
  discount_percent    numeric(5,2) GENERATED ALWAYS AS (
                        ROUND(((original_price - deal_price) / original_price) * 100, 2)
                      ) STORED,
  unit                text NOT NULL DEFAULT 'per session',
  min_units           integer,
  max_units           integer,
  valid_from          date NOT NULL,
  valid_until         date NOT NULL CHECK (valid_until > valid_from),
  terms_and_conditions text NOT NULL DEFAULT '',
  image_url           text,
  is_featured         boolean NOT NULL DEFAULT false,
  is_sponsored        boolean NOT NULL DEFAULT false,

  -- Moderation
  moderation_status   deal_moderation_status NOT NULL DEFAULT 'pending_review',
  moderation_notes    text,
  moderated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at        timestamptz,

  -- Metrics
  claim_count         integer NOT NULL DEFAULT 0,
  view_count          integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_submissions_business   ON public.deal_submissions(business_id);
CREATE INDEX idx_deal_submissions_status     ON public.deal_submissions(moderation_status);
CREATE INDEX idx_deal_submissions_submitted  ON public.deal_submissions(submitted_by);
CREATE INDEX idx_deal_submissions_created    ON public.deal_submissions(created_at DESC);
CREATE INDEX idx_deal_submissions_active     ON public.deal_submissions(is_active) WHERE is_active = true;

CREATE TRIGGER deal_submissions_updated_at
  BEFORE UPDATE ON public.deal_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### Migration 06: business_claims

```sql
-- Migration: 20260320_06_business_claims.sql

CREATE TYPE business_claim_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE IF NOT EXISTS public.business_claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         bigint NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  claimed_by          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Claim details
  verification_method text NOT NULL CHECK (verification_method IN ('phone', 'email', 'document')),
  verification_data   text,       -- phone number, email, or document reference
  notes               text,       -- claimant's message to admin

  -- Moderation
  status              business_claim_status NOT NULL DEFAULT 'pending',
  rejection_reason    text,
  reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Only one pending claim per business at a time
  CONSTRAINT one_pending_claim_per_business
    EXCLUDE USING btree (business_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX idx_business_claims_business    ON public.business_claims(business_id);
CREATE INDEX idx_business_claims_claimed_by  ON public.business_claims(claimed_by);
CREATE INDEX idx_business_claims_status      ON public.business_claims(status);

CREATE TRIGGER business_claims_updated_at
  BEFORE UPDATE ON public.business_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Column on master_business_info to record approved claim owner
ALTER TABLE public.master_business_info
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

---

### Migration 07: platform_leads

```sql
-- Migration: 20260320_07_platform_leads.sql

CREATE TYPE lead_relay_status AS ENUM ('pending', 'relayed', 'failed');

CREATE TABLE IF NOT EXISTS public.platform_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid REFERENCES public.deal_submissions(id) ON DELETE SET NULL,
  business_id     bigint NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  consumer_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Consumer intent
  preferred_date  date,
  preferred_time  text,
  notes           text,

  -- Relay status
  relay_status    lead_relay_status NOT NULL DEFAULT 'pending',
  relayed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  relayed_at      timestamptz,
  failure_reason  text,

  -- Expiry
  expires_at      timestamptz NOT NULL DEFAULT (now() + INTERVAL '72 hours'),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_leads_business  ON public.platform_leads(business_id);
CREATE INDEX idx_platform_leads_consumer  ON public.platform_leads(consumer_id);
CREATE INDEX idx_platform_leads_status    ON public.platform_leads(relay_status);
CREATE INDEX idx_platform_leads_created   ON public.platform_leads(created_at DESC);

CREATE TRIGGER platform_leads_updated_at
  BEFORE UPDATE ON public.platform_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### Migration 08: platform_settings

```sql
-- Migration: 20260320_08_platform_settings.sql

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed: default pricing values matching current mock-data/platformSettings.ts
INSERT INTO public.platform_settings (key, value) VALUES
  ('tier_pricing',         '{"free": 0, "paid": 99}'),
  ('lead_pricing_by_tier', '{"free": 15, "paid": 10}'),
  ('sponsorship_pricing',  '{"sevenDay": 49, "fourteenDay": 89, "thirtyDay": 149}'),
  ('platform_fees',        '{"transactionFee": 0.029, "platformFee": 0.05}')
ON CONFLICT (key) DO NOTHING;
```

---

### Migration 09: admin_audit_log

```sql
-- Migration: 20260320_09_admin_audit_log.sql

CREATE TYPE audit_action AS ENUM (
  'deal_approved',
  'deal_rejected',
  'deal_changes_requested',
  'business_suspended',
  'business_activated',
  'business_tier_changed',
  'claim_approved',
  'claim_rejected',
  'consumer_suspended',
  'consumer_activated',
  'content_created',
  'content_updated',
  'content_deleted',
  'lead_relayed',
  'lead_failed',
  'admin_created',
  'platform_settings_updated',
  'data_exported'
);

CREATE TYPE audit_target_type AS ENUM (
  'deal',
  'business',
  'business_claim',
  'consumer',
  'category',
  'location',
  'area',
  'treatment',
  'lead',
  'admin',
  'platform_settings'
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action       audit_action NOT NULL,
  target_type  audit_target_type NOT NULL,
  target_id    text NOT NULL,
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — audit rows are immutable
-- Partitioning by month is recommended once log volume exceeds ~100k rows.
-- Implement as a follow-up task; omit for initial launch.

CREATE INDEX idx_audit_log_admin_id    ON public.admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_action      ON public.admin_audit_log(action);
CREATE INDEX idx_audit_log_target      ON public.admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_created     ON public.admin_audit_log(created_at DESC);

-- Revoke all non-admin mutations
-- (enforced further by RLS below)
```

---

## 7. RLS Policy Design

### Principle

All admin tables use Row Level Security. The anon key and consumer/business owner keys must never be able to read or write admin-only tables. All admin writes go through Server Actions that use the service role key, which bypasses RLS. Admin reads go through an authenticated Supabase client that verifies the session and role.

### Policy Definitions

```sql
-- ============================================================
-- user_roles
-- ============================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Admin can read their own role (needed by AdminAuthContext)
CREATE POLICY user_roles_read_own
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (all mutations go through Server Actions)
-- No application-level INSERT/UPDATE/DELETE policies needed; service role bypasses RLS.

-- ============================================================
-- admin_audit_log
-- ============================================================
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- An admin can read audit log entries they created, plus all entries if super_admin.
-- In practice, the UI reads all entries (for the activity log).
-- We allow any authenticated admin role to read all rows.
CREATE POLICY audit_log_admin_read
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- No application INSERT policy — inserts come from Server Actions using service key.

-- ============================================================
-- content_categories (public read, admin write)
-- ============================================================
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_categories_public_read
  ON public.content_categories FOR SELECT
  USING (true);  -- Categories are public; consumers and businesses can read them.

-- No application-level INSERT/UPDATE/DELETE — Server Actions use service key.

-- ============================================================
-- content_locations, content_areas (public read, admin write)
-- ============================================================
ALTER TABLE public.content_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_locations_public_read
  ON public.content_locations FOR SELECT
  USING (true);

ALTER TABLE public.content_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_areas_public_read
  ON public.content_areas FOR SELECT
  USING (true);

-- ============================================================
-- deal_submissions
-- ============================================================
ALTER TABLE public.deal_submissions ENABLE ROW LEVEL SECURITY;

-- Business owners can read and create their own submissions
CREATE POLICY deal_submissions_owner_read
  ON public.deal_submissions FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE POLICY deal_submissions_owner_insert
  ON public.deal_submissions FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- Admins can read all (for moderation queue)
CREATE POLICY deal_submissions_admin_read
  ON public.deal_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- No application UPDATE — moderation updates use service key via Server Actions.

-- ============================================================
-- business_claims
-- ============================================================
ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_claims_owner_read
  ON public.business_claims FOR SELECT
  USING (auth.uid() = claimed_by);

CREATE POLICY business_claims_owner_insert
  ON public.business_claims FOR INSERT
  WITH CHECK (auth.uid() = claimed_by);

CREATE POLICY business_claims_admin_read
  ON public.business_claims FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- ============================================================
-- platform_leads
-- ============================================================
ALTER TABLE public.platform_leads ENABLE ROW LEVEL SECURITY;

-- Consumers can read their own leads
CREATE POLICY platform_leads_consumer_read
  ON public.platform_leads FOR SELECT
  USING (auth.uid() = consumer_id);

-- Consumers can create leads
CREATE POLICY platform_leads_consumer_insert
  ON public.platform_leads FOR INSERT
  WITH CHECK (auth.uid() = consumer_id);

-- Admins can read all leads
CREATE POLICY platform_leads_admin_read
  ON public.platform_leads FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- ============================================================
-- platform_settings (admin read only via application)
-- ============================================================
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_admin_read
  ON public.platform_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );
```

---

## 8. Permission Matrix

The matrix below defines what each admin role can do. All operations not listed are denied.

| Operation | super_admin | moderator | support |
|-----------|-------------|-----------|---------|
| **Authentication** | | | |
| Sign in | Yes | Yes | Yes |
| Create admin accounts | Yes | No | No |
| **Deal Moderation** | | | |
| View all deal submissions | Yes | Yes | No |
| Approve deal | Yes | Yes | No |
| Reject deal | Yes | Yes | No |
| Request changes on deal | Yes | Yes | No |
| **Business Management** | | | |
| View all businesses | Yes | Yes | Yes |
| Suspend / activate business | Yes | Yes | No |
| Change business tier | Yes | No | No |
| Approve business claim | Yes | Yes | No |
| Reject business claim | Yes | Yes | No |
| **User Management** | | | |
| View all consumers | Yes | Yes | Yes |
| Suspend / activate consumer | Yes | No | Yes |
| Delete consumer account | Yes | No | No |
| View business owner accounts | Yes | Yes | Yes |
| Suspend / activate business owner | Yes | No | Yes |
| **Content Management** | | | |
| View categories / locations / treatments | Yes | Yes | Yes |
| Create / edit / delete categories | Yes | Yes | No |
| Create / edit / delete locations | Yes | Yes | No |
| Create / edit / delete treatments | Yes | Yes | No |
| **Lead Management** | | | |
| View platform leads | Yes | No | Yes |
| Mark lead as relayed | Yes | No | Yes |
| Mark lead as failed | Yes | No | Yes |
| **Reports & Analytics** | | | |
| View platform metrics | Yes | Yes | Yes |
| View audit log | Yes | Yes | No |
| Export data | Yes | No | No |
| **Monetization Settings** | | | |
| View pricing settings | Yes | No | No |
| Edit pricing settings | Yes | No | No |
| **Data Tools** | | | |
| Export deals / businesses / users | Yes | No | No |
| Run bulk actions (archive, cleanup) | Yes | No | No |

### Permission Enforcement

Permissions are enforced at two layers:

1. **Server Action layer**: Every Server Action checks `await getAdminRole(adminId)` before executing. If the role does not have permission for the action, a `{ error: 'Insufficient permissions' }` response is returned.

2. **UI layer**: Buttons and tabs that require a role the current admin does not have are either hidden or rendered disabled. This is a UX convenience, not a security boundary — the Server Action layer is the authoritative guard.

---

## 9. API Design

All admin write operations are implemented as Next.js Server Actions (`'use server'`). There are no `/api/` routes for admin operations. Reads for initial page data use Server Components where possible, falling back to client-side fetch via a typed Supabase client.

### Server Actions Location

All admin Server Actions live in `src/lib/actions/admin/`. Each file corresponds to a domain:

```
src/lib/actions/admin/
  auth.ts          — signIn, signOut, createAdmin
  deals.ts         — approveDeal, rejectDeal, requestDealChanges
  businesses.ts    — updateBusinessStatus, updateBusinessTier, approveBusinessClaim, rejectBusinessClaim
  users.ts         — suspendConsumer, activateConsumer, deleteConsumer
  content.ts       — createCategory, updateCategory, deleteCategory,
                     createLocation, updateLocation, deleteLocation,
                     createArea, updateArea, deleteArea
  leads.ts         — markLeadRelayed, markLeadFailed
  settings.ts      — updatePlatformSettings
  audit.ts         — getAuditLog (read helper, not a mutation)
```

### Supabase Client Setup

Two Supabase clients are needed:

```typescript
// src/lib/supabase/admin-server.ts  (server-only, never imported in client bundles)
import { createClient } from '@supabase/supabase-js'

// Uses service role key — bypasses all RLS
// Import ONLY in Server Actions and server components
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Never NEXT_PUBLIC_
  )
}
```

```typescript
// src/lib/supabase/admin-client.ts  (client-safe, uses anon key + session)
import { createBrowserClient } from '@supabase/ssr'

export function createAdminBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

### Server Action Signatures

The following are the complete type contracts for each Server Action. Implementation bodies are not part of this PRD.

```typescript
// src/lib/actions/admin/auth.ts

export async function adminSignIn(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }>

export async function adminSignOut(): Promise<void>

export async function createAdminUser(
  params: {
    email: string
    password: string
    firstName: string
    lastName: string
    role: 'super_admin' | 'moderator' | 'support'
  },
  actingAdminId: string,
): Promise<{ success: boolean; userId?: string; error?: string }>
```

```typescript
// src/lib/actions/admin/deals.ts

export async function approveDeal(
  dealId: string,
  adminId: string,
): Promise<{ success: boolean; deal?: DealSubmission; error?: string }>

export async function rejectDeal(
  dealId: string,
  reason: string,           // required — cannot be empty
  adminId: string,
): Promise<{ success: boolean; deal?: DealSubmission; error?: string }>

export async function requestDealChanges(
  dealId: string,
  notes: string,            // required — cannot be empty
  adminId: string,
): Promise<{ success: boolean; deal?: DealSubmission; error?: string }>

export async function getDealSubmissions(
  filter: {
    status?: 'pending_review' | 'approved' | 'rejected' | 'changes_requested' | 'all'
    search?: string
    limit?: number
    offset?: number
  },
): Promise<{ deals: DealSubmission[]; total: number; error?: string }>
```

```typescript
// src/lib/actions/admin/businesses.ts

export async function updateBusinessStatus(
  businessId: bigint,
  status: 'active' | 'suspended',
  adminId: string,
): Promise<{ success: boolean; error?: string }>

export async function updateBusinessTier(
  businessId: bigint,
  tier: 'unclaimed' | 'free' | 'paid',
  adminId: string,
): Promise<{ success: boolean; error?: string }>

export async function approveBusinessClaim(
  claimId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>

export async function rejectBusinessClaim(
  claimId: string,
  reason: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>
```

```typescript
// src/lib/actions/admin/users.ts

export async function suspendConsumer(
  consumerId: string,
  adminId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }>

export async function activateConsumer(
  consumerId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>

export async function deleteConsumerAccount(
  consumerId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>
```

```typescript
// src/lib/actions/admin/content.ts

export async function createCategory(
  params: { name: string; slug: string; description: string; icon_name: string },
  adminId: string,
): Promise<{ success: boolean; category?: ContentCategory; error?: string }>

export async function updateCategory(
  id: string,
  params: Partial<{ name: string; description: string; icon_name: string; is_active: boolean }>,
  adminId: string,
): Promise<{ success: boolean; category?: ContentCategory; error?: string }>

export async function deleteCategory(
  id: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>
  // Returns error if deals reference this category

export async function createLocation(
  params: { name: string; state: string; state_code: string; latitude: number; longitude: number; timezone: string },
  adminId: string,
): Promise<{ success: boolean; location?: ContentLocation; error?: string }>

export async function updateLocation(
  id: string,
  params: Partial<{ name: string; is_active: boolean }>,
  adminId: string,
): Promise<{ success: boolean; location?: ContentLocation; error?: string }>

export async function createArea(
  params: { city_id: string; name: string; latitude: number; longitude: number; radius_miles: number },
  adminId: string,
): Promise<{ success: boolean; area?: ContentArea; error?: string }>
```

```typescript
// src/lib/actions/admin/leads.ts

export async function markLeadRelayed(
  leadId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>

export async function markLeadFailed(
  leadId: string,
  reason: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }>
```

```typescript
// src/lib/actions/admin/settings.ts

export async function updatePlatformSettings(
  key: string,
  value: Record<string, unknown>,
  adminId: string,
): Promise<{ success: boolean; error?: string }>
```

### Internal Audit Log Helper

Not a public Server Action, but a shared helper called inside each action:

```typescript
// src/lib/actions/admin/_audit.ts  (private helper — not exported from actions barrel)

export async function writeAuditLog(
  supabase: SupabaseClient,   // the service-role client
  params: {
    admin_id: string
    action: AuditAction
    target_type: AuditTargetType
    target_id: string
    details?: Record<string, unknown>
  }
): Promise<void>
// Best-effort: does not throw on failure. Logs to console.error if insert fails.
```

---

## 10. Frontend Integration

### AdminAuthContext Replacement

The existing `src/lib/context/adminAuthContext.tsx` must be replaced entirely. The new implementation:

1. Calls `adminSignIn` Server Action on form submit
2. Uses `supabase.auth.onAuthStateChange` to track session
3. On session detected, fetches the admin's role from `user_roles` using the authenticated client
4. If no role found: calls `supabase.auth.signOut()` and sets `error = 'Access denied'`
5. Exposes `{ admin: { id, email, role, firstName, lastName } | null, isAuthenticated, isLoading, error }`

The Admin type in `src/types/admin.ts` gains `id` as a UUID (currently it is a mock string), and `role` maps to the same `AdminRole` union type already defined.

### Middleware

A new `src/middleware.ts` (or augmentation of existing middleware) intercepts all requests to `/admin/dashboard/*`:

```typescript
// Pattern for admin route guard in middleware.ts
// Uses @supabase/ssr createServerClient to read the session cookie

if (request.nextUrl.pathname.startsWith('/admin/dashboard')) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Role check: query user_roles
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single()

  if (!roleRow) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/admin?error=access_denied', request.url))
  }
}
```

### Page-Level Data Fetching

Replace mock data calls in each page with Server Component data fetches. The pattern for each page:

**Deal Moderation (`/admin/dashboard/deals`)**
- Remove: `import { getAllDeals, updateDealModeration } from '@/lib/mock-data/deals'`
- Add: Server Component wrapper that calls `getDealSubmissions({ status: 'pending_review' })`
- Handlers: `handleApprove`, `handleReject`, `handleRequestChanges` call Server Actions with `useTransition` for optimistic updates

**Business Management (`/admin/dashboard/businesses`)**
- Remove: `import { getAllBusinesses, updateBusinessStatus, updateBusinessTier } from '@/lib/mock-data/businesses'`
- Add: Server Component fetch from `master_business_info` with joined `business_claims` count
- Handlers: call `updateBusinessStatus`, `updateBusinessTier` Server Actions

**User Management (`/admin/dashboard/users`)**
- Remove: `import { getAllConsumers, updateConsumerStatus } from '@/lib/mock-data/consumers'`
- Add: Server Component fetch from `consumer_profiles` (or auth.users if profiles table not yet built)
- Handlers: call `suspendConsumer`, `activateConsumer` Server Actions

**Content Management (`/admin/dashboard/content/categories`)**
- Remove: `import { ... } from '@/lib/mock-data/categories'`
- Add: Server Component fetch from `content_categories`
- Handlers: call `createCategory`, `updateCategory`, `deleteCategory` Server Actions

**Data Management (`/admin/dashboard/data`)**
- Replace inline `mockActivityLog` with Server Component fetch of `admin_audit_log ORDER BY created_at DESC LIMIT 50`

**Dashboard Overview (`/admin/dashboard`)**
- Replace inline mock metric values with Server Component that runs the four COUNT queries in parallel

### Optimistic Update Pattern

The deal moderation page is the primary user of optimistic updates. The recommended pattern:

```typescript
// Inside the 'use client' deals page

const [optimisticDeals, setOptimisticDeals] = useOptimistic(
  deals,
  (state, { dealId, newStatus }: { dealId: string; newStatus: ModerationStatus }) =>
    state.map(d => d.id === dealId ? { ...d, moderationStatus: newStatus } : d)
)

const [isPending, startTransition] = useTransition()

function handleApprove(dealId: string) {
  startTransition(async () => {
    setOptimisticDeals({ dealId, newStatus: 'approved' })
    const result = await approveDeal(dealId, admin.id)
    if (!result.success) {
      // React rolls back optimistic state automatically on throw
      throw new Error(result.error)
    }
  })
}
```

This pattern is available in React 19, which ships with Next.js 15+. The existing Next.js version in this project should be verified before implementing `useOptimistic`.

---

## 11. Edge Cases and Error Handling

### Authentication Edge Cases

**EC-AUTH-01: User has Supabase account but no admin role**
- Scenario: A business owner accidentally navigates to `/admin` and enters their credentials
- Behavior: Auth succeeds, role check fails. `signOut()` is called, user sees "Access denied — this account does not have admin privileges" at the login form. No redirect to dashboard.

**EC-AUTH-02: Admin's role is removed while they have an active session**
- Scenario: super_admin removes a moderator's role while they are logged in
- Behavior: Middleware checks role on every request. Next navigation to any `/admin/dashboard/*` route fails the middleware check and redirects to `/admin`. The current page remains loaded until the next navigation.

**EC-AUTH-03: Supabase Auth is unavailable**
- Behavior: The login Server Action returns `{ success: false, error: 'Authentication service unavailable. Please try again.' }`.

### Deal Moderation Edge Cases

**EC-DEAL-01: Two moderators try to approve the same deal simultaneously**
- Behavior: The second approver's Server Action checks `moderation_status` before updating. If it is already `approved`, the action returns `{ success: true, deal: existingDeal }` without writing a duplicate audit log entry. The UI shows the already-approved state.

**EC-DEAL-02: Reject without a reason**
- Behavior: Client-side validation prevents submission. Server Action also validates: `if (!reason?.trim()) return { success: false, error: 'Rejection reason is required' }`.

**EC-DEAL-03: Deal's business is deleted while deal is in pending_review**
- Behavior: The `ON DELETE CASCADE` on `deal_submissions.business_id` removes the deal. The moderation queue auto-refreshes and no longer shows it.

**EC-DEAL-04: Moderator tries to re-approve an already-approved deal**
- Behavior: Server Action is idempotent. Returns success. Audit log entry is not written (check before insert).

### Business Claim Edge Cases

**EC-CLAIM-01: Business owner submits a second claim while one is pending**
- Behavior: The `EXCLUDE USING btree (business_id WITH =) WHERE (status = 'pending')` constraint on `business_claims` causes the insert to fail. The business owner's UI shows "A claim for this business is already under review."

**EC-CLAIM-02: Admin approves a claim, but the business already has a different approved owner**
- Behavior: The `claimed_by_user_id` column on `master_business_info` is already non-null. The Server Action checks this before approving. If it is already set to a different user, the admin sees "This business already has a verified owner. Contact support to transfer ownership." The claim remains in pending state.

**EC-CLAIM-03: Business owner who was approved via claim later has their account deleted**
- Behavior: `claimed_by_user_id` FK has `ON DELETE SET NULL`. The business reverts to an effectively unclaimed state, though no automatic notification is sent.

### Content Management Edge Cases

**EC-CONTENT-01: Delete category that has active deals**
- Behavior: Server Action queries `deal_submissions WHERE category_id = :id AND is_active = true`. If count > 0, returns `{ success: false, error: 'Cannot delete — 5 active deals use this category. Deactivate or reassign them first.' }`.

**EC-CONTENT-02: Delete city that has businesses**
- Behavior: `master_business_info` stores city as a text field, not a FK to `content_locations`. Therefore deletion is allowed at the DB level. The Server Action should check `SELECT COUNT(*) FROM master_business_info WHERE city = :cityName AND is_active = true`. If > 0, return an error.

**EC-CONTENT-03: Duplicate category slug**
- Behavior: The `UNIQUE(slug)` constraint on `content_categories` causes the insert to fail. The Server Action returns `{ success: false, error: 'A category with this name already exists.' }`.

### User Management Edge Cases

**EC-USER-01: Suspend a consumer who has active leads**
- Behavior: Suspension sets `consumer_profiles.status = 'suspended'` but does not cancel pending leads. Active leads remain in `platform_leads` and must be resolved independently.

**EC-USER-02: Delete a consumer who has submitted leads**
- Behavior: `platform_leads.consumer_id` FK has `ON DELETE CASCADE`, meaning their leads are also deleted. The Server Action warns: "Deleting this account will permanently remove 3 pending leads. This cannot be undone." Requires `confirm: true` parameter in the Server Action call.

**EC-USER-03: Support role tries to suspend a moderator account via URL manipulation**
- Behavior: The user whose `user_roles.role` is being acted on is checked. If the target user has a role in `user_roles`, only `super_admin` can suspend them. The Server Action returns `{ success: false, error: 'Insufficient permissions to modify admin accounts.' }`.

### Audit Log Edge Cases

**EC-AUDIT-01: Audit log insert fails**
- Behavior: Per FR-AUDIT-04, audit log writes are best-effort. The primary action is not rolled back. The Server Action logs `console.error('Audit log write failed:', error)`. This will appear in Vercel function logs for monitoring.

**EC-AUDIT-02: Admin attempts to delete audit log entries via direct API**
- Behavior: RLS does not define a DELETE policy for `admin_audit_log`. The anon key, authenticated user key, and any non-service-role client cannot delete rows. Deletion is only possible via the Supabase dashboard by a Supabase project owner.

---

## 12. Acceptance Criteria

### AC-01: Admin Authentication

```
GIVEN a valid admin email and password stored in Supabase Auth with a matching user_roles entry
WHEN the admin submits the login form at /admin
THEN they are redirected to /admin/dashboard within 2 seconds
AND the AdminAuthContext exposes their id, email, and role

GIVEN a valid Supabase account with no entry in user_roles
WHEN the user submits the login form
THEN they remain on /admin
AND see the message "Access denied — this account does not have admin privileges"
AND they are not redirected to the dashboard

GIVEN an admin with an active session at /admin/dashboard/deals
WHEN their session cookie expires
AND they attempt a navigation
THEN they are redirected to /admin
AND see the message "Your session expired. Please sign in again."
```

### AC-02: Deal Moderation

```
GIVEN a deal with moderation_status = 'pending_review' in deal_submissions
WHEN a moderator clicks Approve on the DealModerationCard
THEN the deal's moderation_status updates to 'approved' immediately (optimistic)
AND a Server Action call confirms the update
AND a row appears in admin_audit_log with action = 'deal_approved', target_id = dealId

GIVEN a pending deal
WHEN a moderator clicks Reject without entering a reason
THEN the rejection is blocked
AND an error "Rejection reason is required" is shown

GIVEN two moderators both viewing the same pending deal
WHEN moderator A approves and moderator B also tries to approve
THEN moderator B's action succeeds without error (idempotent)
AND only one audit log entry is written for that deal approval
```

### AC-03: Business Claim Approval

```
GIVEN a business_claim with status = 'pending'
WHEN a moderator approves the claim
THEN business_claims.status updates to 'approved'
AND master_business_info.claimed_by_user_id is set to the claiming user's UUID
AND an audit log entry is written with action = 'claim_approved'

GIVEN a business that already has a claimed_by_user_id
WHEN a moderator tries to approve a new pending claim for that same business
THEN the action fails with "This business already has a verified owner"
AND business_claims.status remains 'pending'
```

### AC-04: User Management

```
GIVEN an active consumer
WHEN a support admin clicks Suspend
THEN consumer_profiles.status = 'suspended' and suspended_at = now()
AND the user table row in the UI shows "Suspended" status

GIVEN a suspended consumer
WHEN a support admin clicks Reactivate
THEN consumer_profiles.status = 'active' and suspended_at is cleared

GIVEN a moderator (role = 'moderator') attempting to suspend a consumer
WHEN the suspend action is triggered
THEN the Server Action returns { success: false, error: 'Insufficient permissions' }
```

### AC-05: Content Management

```
GIVEN the content_categories table has been seeded
WHEN the admin navigates to /admin/dashboard/content/categories
THEN the same categories visible in the current mock UI are shown
AND add/edit/toggle operations persist to the database on refresh

GIVEN an active category with 3 linked deals in deal_submissions
WHEN a super_admin clicks Delete on that category
THEN an error is shown: "Cannot delete — 3 active deals use this category"
AND the category is not deleted

GIVEN a new category is created with slug 'botox'
WHEN the create action runs
THEN the Server Action returns an error "A category with this name already exists"
```

### AC-06: Lead Relay

```
GIVEN a platform_lead with relay_status = 'pending'
WHEN a support admin clicks "Mark as Relayed"
THEN platform_leads.relay_status = 'relayed', relayed_by = admin UUID, relayed_at = now()
AND an audit log entry is written with action = 'lead_relayed'
```

### AC-07: Platform Metrics

```
GIVEN real deal_submissions, master_business_info, and auth.users data
WHEN the admin visits /admin/dashboard
THEN the four metric cards show counts that match direct Supabase SQL queries
AND the pending moderation count reflects only deals with moderation_status = 'pending_review'
```

### AC-08: Audit Log

```
GIVEN a moderator performs 5 different actions in sequence
WHEN the admin visits /admin/dashboard/data
THEN all 5 actions appear in the activity log table
AND each row shows the correct action label, timestamp, and admin identity

GIVEN the anon Supabase key
WHEN a query is run: SELECT * FROM admin_audit_log
THEN zero rows are returned (RLS enforcement)
```

### AC-09: Permission Enforcement

```
GIVEN a moderator (role = 'moderator') is logged in
THEN monetization settings are not visible in the sidebar or at /admin/dashboard/monetization
OR the page renders with all inputs disabled and a "View only" indicator

GIVEN a support user (role = 'support') is logged in
THEN the deal moderation tab is not accessible
AND attempting a direct navigation to /admin/dashboard/deals
THEN they see "You do not have permission to view this page"
```

---

## 13. Implementation Phases

### Phase 1: Authentication Foundation (Sprint 1)

All other work depends on this being complete first.

- [ ] Create `user_roles` table (Migration 01)
- [ ] Seed initial admin users via Supabase dashboard
- [ ] Replace `AdminAuthContext` with Supabase Auth implementation
- [ ] Add admin route guard middleware
- [ ] Verify login/logout/session persistence end-to-end
- [ ] Verify access-denied flow for non-admin Supabase users

Deliverable: Admin can log in with real credentials. The dashboard renders. No mock data yet replaced on the pages themselves.

---

### Phase 2: Core Moderation (Sprint 2)

- [ ] Create `content_categories` table (Migration 02) + seed
- [ ] Create `content_locations` + `content_areas` tables (Migration 03) + seed
- [ ] Create `deal_submissions` table (Migration 05)
- [ ] Create `admin_audit_log` table (Migration 09)
- [ ] Implement `approveDeal`, `rejectDeal`, `requestDealChanges` Server Actions
- [ ] Wire `/admin/dashboard/deals` to real data
- [ ] Wire `/admin/dashboard/content/categories` to `content_categories`
- [ ] Wire `/admin/dashboard/content/locations` to `content_locations` + `content_areas`
- [ ] Implement `writeAuditLog` helper and confirm entries appear in Supabase

Deliverable: Deal moderation and content management operate on real data. Every moderation action is logged.

---

### Phase 3: User and Business Management (Sprint 3)

- [ ] Create `business_claims` table (Migration 06)
- [ ] Alter `master_business_info` to add `claimed_by_user_id`, `claimed_at`, `is_active` columns
- [ ] Implement `updateBusinessStatus`, `updateBusinessTier`, `approveBusinessClaim`, `rejectBusinessClaim` Server Actions
- [ ] Wire `/admin/dashboard/businesses` to real data
- [ ] Implement `suspendConsumer`, `activateConsumer` Server Actions (consumer_profiles or auth metadata)
- [ ] Wire `/admin/dashboard/users` to real data
- [ ] Implement permission checks by role for all actions in Phase 3

Deliverable: Business and user management fully backed by Supabase. Claims workflow operational.

---

### Phase 4: Metrics, Leads, Settings (Sprint 4)

- [ ] Create `platform_leads` table (Migration 07)
- [ ] Create `platform_settings` table (Migration 08) + seed
- [ ] Implement `markLeadRelayed`, `markLeadFailed` Server Actions
- [ ] Implement `updatePlatformSettings` Server Action
- [ ] Wire `/admin/dashboard` metrics to real COUNT queries
- [ ] Wire `/admin/dashboard/reports` activity feed to `admin_audit_log`
- [ ] Wire `/admin/dashboard/data` audit log table to real data
- [ ] Wire `/admin/dashboard/monetization` to `platform_settings` table
- [ ] Implement `createAdminUser` Server Action (super_admin only)
- [ ] Remove all remaining mock data imports from admin pages

Deliverable: Full admin panel operating on real data. All mock data removed from admin context. Data Management page shows real audit log.

---

## 14. Risk Assessment

### Risk 01: RLS Misconfiguration

**Description**: An incorrectly written RLS policy could allow anon key access to admin tables, or block legitimate admin operations.

**Probability**: Medium — RLS policies are error-prone, especially the "admin can read all" policies that depend on a subquery against `user_roles`.

**Mitigation**:
- After each migration, run the Supabase RLS advisor
- Write automated tests that run queries under both the anon key and a test admin key and assert correct row visibility
- Never skip RLS testing before merging a migration

---

### Risk 02: Service Role Key Exposure

**Description**: If `SUPABASE_SERVICE_ROLE_KEY` is accidentally used in a client component or `NEXT_PUBLIC_` prefixed variable, it would be visible in browser network requests.

**Probability**: Low with discipline; higher under time pressure.

**Mitigation**:
- The admin server client file (`src/lib/supabase/admin-server.ts`) must have `'server-only'` as its first import, which throws a build error if imported in a client context
- CI linting rule: grep for `SUPABASE_SERVICE_ROLE_KEY` in any file under `src/app/` that is not a Server Action or Server Component

---

### Risk 03: Consumer/Business Auth Regression

**Description**: Adding admin auth and middleware could accidentally break the existing consumer and business owner auth flows.

**Probability**: Medium — middleware applies to all routes unless scoped correctly.

**Mitigation**:
- The admin middleware matcher is `'/admin/:path*'` only
- Consumer auth context and business auth context are unchanged
- After Phase 1 deployment, test consumer sign-up, sign-in, and business dashboard access before proceeding to Phase 2

---

### Risk 04: Audit Log Unbounded Growth

**Description**: At production scale (moderate admin activity), `admin_audit_log` could accumulate millions of rows over months, degrading query performance.

**Probability**: Low in the first 12 months given the platform's current size.

**Mitigation**:
- Index on `created_at DESC` handles the 50-row read efficiently for years
- Partition the table by month before it exceeds 500k rows (document as a deferred task in the backlog)
- The CSV export in Data Management page allows periodic archival to external storage

---

### Risk 05: `useOptimistic` API Availability

**Description**: The `useOptimistic` hook requires React 19. If the project is on React 18, this API is unavailable.

**Probability**: Low — the project uses Next.js 16 which ships with React 19.

**Mitigation**: Verify `react` version in `package.json` before implementing the optimistic update pattern. Fallback: use a simple `useState` + re-fetch after Server Action confirmation, accepting a brief flash of stale state.

---

*End of PRD 09 — Admin Panel Backend Operations*
