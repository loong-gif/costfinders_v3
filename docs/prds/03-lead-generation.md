# PRD 03 — Lead Generation & Claim System

**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-20
**Author:** Product
**Reviewers:** Engineering, Design, Business Operations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas & Jobs-to-Be-Done](#3-user-personas--jobs-to-be-done)
4. [Functional Requirements](#4-functional-requirements)
5. [User Stories & Acceptance Criteria](#5-user-stories--acceptance-criteria)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Database Schema](#7-database-schema)
8. [API Design — Server Actions](#8-api-design--server-actions)
9. [Frontend Integration Map](#9-frontend-integration-map)
10. [Business Notification System](#10-business-notification-system)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [Claim Lifecycle & Status Machine](#12-claim-lifecycle--status-machine)
13. [Dependencies & Prerequisites](#13-dependencies--prerequisites)
14. [Success Metrics](#14-success-metrics)
15. [Risk Register](#15-risk-register)
16. [Out of Scope (Phase 1)](#16-out-of-scope-phase-1)
17. [Acceptance Criteria Checklist](#17-acceptance-criteria-checklist)

---

## 1. Executive Summary

### Problem Statement

The CostFinders platform currently stores deal claims exclusively in browser `localStorage` via `claimsContext.tsx`. This means every claim is ephemeral, device-locked, and invisible to the backend. No lead is ever recorded in a durable store, no business ever receives a notification, and the consumer's contact information is never exchanged. The platform's stated revenue mechanism — selling qualified leads to medical spas — is entirely non-functional.

### Solution Overview

Replace the localStorage mock with a real Supabase-backed claim system. When a consumer claims a deal, the claim is written to a `claims` table with proper foreign key relationships to `auth.users`, `promo_offer_master`, and `master_business_info`. The business contact details are revealed to the consumer upon successful claim creation. An email notification is dispatched to a CostFinders operations inbox for manual relay to the business. Consumers can track claim history; businesses can view incoming leads in their dashboard.

### Business Impact

Every successfully persisted claim is a monetizable lead. At current inventory (347 offers, 354 businesses), even a 1% conversion rate from anonymous browsers to claimants produces several hundred trackable lead events per month. Each lead represents direct value to a medspa that currently has no programmatic way to receive patient interest from price-comparison traffic.

| Metric | Baseline (mock) | Target (Phase 1) |
|--------|----------------|------------------|
| Leads persisted to database | 0 | 100% of submitted claims |
| Business notification latency | N/A | < 15 minutes (manual relay) |
| Consumer claim history retention | Session only | Indefinite (Supabase) |
| Duplicate claim prevention | None | Enforced by DB unique constraint |
| Claim spam (> 3 active) | None | Enforced by server-side check |

### Resource Requirements

- 1 backend/fullstack engineer: 2–3 sprint weeks
- Supabase migration: 1–2 hours (SQL + RLS policies)
- Operations: 1 person to monitor email inbox and relay leads manually
- No additional infrastructure cost within Supabase free tier at current volume

### Risk Assessment

**Highest risk:** Auth integration. The current `authContext.tsx` is a localStorage mock with no real Supabase Auth session. Claim creation requires a real `auth.users` row to satisfy the FK constraint. This is a hard prerequisite that must be resolved before this system can go live. See Section 13.

---

## 2. Product Overview

### Product Vision

The claim system is the conversion layer of the CostFinders funnel. A consumer arrives anonymously, browses deals shown without business identity, creates an account, claims a deal, and at that moment the platform fulfills its value exchange: the consumer receives the business's contact details, and the business receives a warm, opted-in lead.

### Value Exchange Diagram

```
Consumer                    Platform                    Business
   │                            │                           │
   │  Browses anonymized deals  │                           │
   │ ─────────────────────────► │                           │
   │                            │                           │
   │  Creates account           │                           │
   │ ─────────────────────────► │                           │
   │                            │                           │
   │  Submits claim             │                           │
   │ ─────────────────────────► │  INSERT claims row        │
   │                            │ ──────────────────────►   │
   │                            │                           │
   │  ◄─ Business details revealed                          │
   │     (name, phone, address) │                           │
   │                            │  Email notification sent  │
   │                            │ ──────────────────────►   │
   │                            │  (ops inbox → manual relay)
```

### Target Users

**Consumer (primary):** An adult in a US metro area (initial markets: Tucson, Oklahoma City, Irvine) who wants a medspa treatment at a verified price point, is willing to create an account to access business contact details, and has expressed genuine interest by selecting a preferred date/time.

**Business Owner (secondary):** A medspa operator or front-desk manager who receives a notification when a consumer claims one of their deals. In Phase 1, this notification arrives via CostFinders operations email. The business owner can also view incoming leads in the business dashboard at `/business/dashboard/leads`.

**CostFinders Operations (internal):** The person monitoring the notification inbox who relays lead details to the business by phone or email within the SLA window.

---

## 3. User Personas & Jobs-to-Be-Done

### Persona 1: Verified Consumer

**Profile:** Has completed email verification (`verificationStatus` in `['email_verified', 'phone_verified', 'fully_verified']`). Has browsed deal listings and clicked "Claim this deal" on a specific offer.

**Jobs to be done:**
- "When I find a medspa deal I want, I want to lock it in so the business knows I'm interested, so I don't lose the opportunity."
- "When I claim a deal, I want to immediately see the business name and contact details, so I can follow up myself if I want to."
- "When I've claimed multiple deals, I want to review my history and know the status of each one, so I stay informed."

**Friction points to eliminate:** Losing claims on browser refresh; not knowing if a claim was received; having to re-enter information.

### Persona 2: Business Owner

**Profile:** Medical spa operator whose business exists in `master_business_info`. Has either claimed their business profile or has not yet done so. Receives an email notification or phone call from CostFinders ops relaying lead details.

**Jobs to be done:**
- "When a consumer claims one of my deals, I want to know immediately, so I can follow up while their interest is fresh."
- "When I log into my dashboard, I want to see all my incoming leads in one place, so I can manage my pipeline."

**Friction points to eliminate:** Leads arriving too slowly; leads arriving without enough context to follow up; duplicate or spam leads wasting staff time.

---

## 4. Functional Requirements

### 4.1 Claim Creation

| ID | Requirement | Priority |
|----|-------------|----------|
| F-01 | A verified consumer can submit a claim for any active deal by providing optional preferred date, time window, and a free-text note (max 500 chars). | Must have |
| F-02 | On submission, a row is inserted into the `claims` table in Supabase with `status = 'pending'`. | Must have |
| F-03 | The claim must reference `consumer_id` (FK to `auth.users.id`), `offer_id` (FK to `promo_offer_master.id`), and `business_id` (FK to `master_business_info.business_id`). | Must have |
| F-04 | A consumer may not have more than 3 claims in `['pending', 'contacted', 'booked']` status simultaneously. This limit is enforced server-side before insert. | Must have |
| F-05 | A consumer may not claim the same deal twice if an active claim (status `pending`, `contacted`, or `booked`) already exists for that `(consumer_id, offer_id)` pair. This is enforced by a unique partial index. | Must have |
| F-06 | Claims expire 7 days after creation. The `expires_at` column is set to `NOW() + INTERVAL '7 days'` at insert time. A Supabase scheduled function (pg_cron) updates status to `expired` for all rows where `expires_at < NOW()` and status is still `pending`. | Must have |
| F-07 | The consumer sees a success state in the `ClaimDealModal` upon successful database insertion. | Must have |
| F-08 | After successful claim creation, the deal sidebar (`dealSidebar.tsx`) transitions from the auth wall to showing the real business name, address, phone, and website. | Must have |

### 4.2 Business Information Reveal

| ID | Requirement | Priority |
|----|-------------|----------|
| F-09 | Before a claim exists, deal pages show anonymized business information (currently implemented). | Must have |
| F-10 | After a claim exists for a given `(consumer_id, offer_id)`, the deal page server component fetches and displays the real `master_business_info` row for that business. | Must have |
| F-11 | Business details revealed include: `name`, `address`, `city`, `website_clean`, and any phone number stored against the business. | Must have |
| F-12 | The reveal is server-rendered or fetched via a Server Action. It must not be possible for an unauthenticated request to retrieve business contact details for a deal. | Must have |

### 4.3 Claim History — Consumer Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| F-13 | The page at `/dashboard/claims` fetches the authenticated consumer's claims from Supabase, joining `promo_offer_master` and `master_business_info` for display data. | Must have |
| F-14 | The existing filter tabs (All / Active / Completed / Cancelled) and `ClaimCard` component continue to function. The mock data source is replaced by real Supabase data. | Must have |
| F-15 | `ClaimCard` displays revealed business name for all claims (the consumer has already earned the reveal by claiming). | Must have |

### 4.4 Lead View — Business Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| F-16 | The page at `/business/dashboard/leads` fetches all claims where `business_id` matches the authenticated business owner's linked business. | Must have |
| F-17 | Each lead displays: consumer name, consumer email, deal title, preferred date/time, notes, and claim status. | Must have |
| F-18 | A business owner can update a claim's status to `contacted`, `booked`, or `cancelled` from the lead detail page at `/business/dashboard/leads/[claimId]`. | Should have |
| F-19 | When a business owner sets status to `booked`, they may optionally record `booked_date`, `booked_time`, and `business_response`. | Should have |

### 4.5 Business Notification

| ID | Requirement | Priority |
|----|-------------|----------|
| F-20 | On every new claim insertion, a Supabase Database Webhook or Edge Function sends an email to the CostFinders operations inbox. | Must have |
| F-21 | The notification email body contains: consumer first name, consumer email, consumer phone (if provided), deal title, preferred date, preferred time, notes, and a link to the admin/business dashboard. | Must have |
| F-22 | The system does not yet email businesses directly. Manual relay by CostFinders ops is the Phase 1 delivery mechanism. | Must have (constraint) |

### 4.6 Spam Prevention

| ID | Requirement | Priority |
|----|-------------|----------|
| F-23 | Server-side check: reject claim if consumer already has 3 active claims. Return a structured error that the modal can display. | Must have |
| F-24 | Server-side check: reject duplicate claim for same `(consumer_id, offer_id)` pair with any active status. | Must have |
| F-25 | Rate limiting at the Server Action level: no more than 5 claim creation attempts per consumer per minute. Implementation via a simple timestamp check against a `claim_attempts` ephemeral store or a Supabase RPC. | Should have |

---

## 5. User Stories & Acceptance Criteria

### Story 1 — Verified consumer submits a claim

**As a** verified consumer browsing a deal page,
**I want** to submit a claim with my preferred date and time,
**So that** the business knows I am interested and I receive their contact details.

**Acceptance Criteria:**

- **Given** I am authenticated with `verificationStatus` of `email_verified` or higher, and I have fewer than 3 active claims,
- **When** I click "Claim this deal", fill in optional fields, and click "Submit claim",
- **Then** a row is inserted into `claims` with `status = 'pending'`, the modal transitions to a success state, and the deal sidebar now shows real business name, phone, and address.

- **Given** the same conditions but the deal was already claimed by me (same `offer_id`, active status),
- **When** I attempt to submit,
- **Then** the server action returns `{ error: 'already_claimed' }` and the modal displays: "You've already claimed this deal."

- **Given** I already have 3 active claims,
- **When** I attempt to submit a fourth,
- **Then** the server action returns `{ error: 'limit_reached' }` and the modal displays: "You've reached the maximum claims for now. Complete or cancel an existing claim first."

---

### Story 2 — Consumer views claim history

**As a** consumer with existing claims,
**I want** to see all my claims with their current status,
**So that** I can track which businesses are following up with me.

**Acceptance Criteria:**

- **Given** I am authenticated and have at least one claim,
- **When** I navigate to `/dashboard/claims`,
- **Then** I see my claims fetched from Supabase, sorted newest first, displaying deal title, business name (revealed), preferred date/time, status badge, and time since submission.

- **Given** I have claims with mixed statuses,
- **When** I click the "Active" filter tab,
- **Then** I see only claims with status `pending`, `contacted`, or `booked`.

- **Given** I have no claims,
- **When** I visit `/dashboard/claims`,
- **Then** I see the existing empty state with "No claims yet" and a "Browse deals" CTA.

---

### Story 3 — Business owner views incoming leads

**As a** business owner with a linked business,
**I want** to see all consumers who claimed my deals,
**So that** I can follow up and convert them to bookings.

**Acceptance Criteria:**

- **Given** I am authenticated as a business owner with a linked `business_id`,
- **When** I navigate to `/business/dashboard/leads`,
- **Then** I see all claims where `business_id` matches mine, with consumer name, deal title, preferred date, and status.

- **Given** I am viewing a lead at `/business/dashboard/leads/[claimId]`,
- **When** I click "Mark as contacted",
- **Then** the claim's `status` is updated to `contacted` in Supabase and the UI reflects the change.

- **Given** I am viewing a lead with `status = 'contacted'`,
- **When** I enter a booked date and click "Confirm booking",
- **Then** the claim's `status` is updated to `booked`, `booked_date` is persisted, and the consumer can see this status change on their claims page.

---

### Story 4 — Operations team receives lead notification

**As a** CostFinders operations team member,
**I want** to receive an email every time a consumer claims a deal,
**So that** I can relay the lead to the business promptly.

**Acceptance Criteria:**

- **Given** a consumer successfully creates a claim,
- **When** the server action completes,
- **Then** an email arrives in the CostFinders ops inbox within 15 minutes containing: consumer name, consumer email, deal title, business name, preferred date/time, and any consumer notes.

- **Given** a claim creation fails (DB error, validation error),
- **When** the error occurs,
- **Then** no notification email is sent and the consumer sees a generic "Something went wrong. Please try again." message.

---

### Story 5 — Expired claims are auto-cleaned

**As a** platform,
**I want** claims to automatically expire after 7 days if no response,
**So that** consumers are not left in indefinite "pending" limbo and businesses are not chased for stale leads.

**Acceptance Criteria:**

- **Given** a claim row where `expires_at < NOW()` and `status = 'pending'`,
- **When** the nightly pg_cron job runs,
- **Then** the status is updated to `expired`.

- **Given** a claim that has already reached `contacted`, `booked`, or `completed`,
- **When** the pg_cron job runs,
- **Then** those rows are not modified (expiry only targets `pending` status).

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Claim creation Server Action response time (p95) | < 1,500ms |
| Claims list page initial load (from Supabase) | < 2,000ms |
| Business reveal after claim (incremental fetch) | < 800ms |

### Security

| Requirement | Implementation |
|-------------|----------------|
| Consumers can only read their own claims | Supabase RLS: `auth.uid() = consumer_id` |
| Business owners can only read claims for their business | Supabase RLS: `business_id = [owner's linked business_id]` from a `business_owners` table or matching JWT claim |
| Claim creation requires authenticated session | Server Action reads `supabase.auth.getUser()` and rejects if null |
| Business contact details not exposed to unauthenticated requests | Server Action for reveal requires session check before querying `master_business_info` |
| Notes field sanitized before storage | Max 500 chars enforced at DB level (`CHECK (char_length(notes) <= 500)`); HTML stripped server-side |

### Usability

| Requirement | Detail |
|-------------|--------|
| Modal success state visible for minimum 2 seconds before auto-close | Prevents disorienting instant dismissal |
| Claim limit error is actionable | Error message links directly to `/dashboard/claims` |
| Status transitions visible in real time on business dashboard | Optimistic update on UI; confirm on server response |

### Reliability

| Requirement | Detail |
|-------------|--------|
| pg_cron job runs daily at 02:00 UTC | Expiry processing during lowest-traffic window |
| Notification email delivery failure does not fail the claim transaction | Email dispatch is fire-and-forget; claim insert is committed regardless |
| Duplicate claim prevention is enforced at DB level (partial unique index), not only application level | Defense in depth against concurrent requests |

### Compliance

| Requirement | Detail |
|-------------|--------|
| Consumer contact data (email, phone) stored only in `auth.users` metadata; the `claims` table never duplicates PII | Reduces data surface area |
| Claims table has `created_at` and `updated_at` timestamps for audit | Supports data subject access requests |
| No consumer PII transmitted in notification email subject line | Subject line format: "New lead: deal #{{offer_id}}" |

---

## 7. Database Schema

### 7.1 New Table: `claims`

```sql
-- ============================================================
-- Migration: 20260320_001_create_claims_table.sql
-- ============================================================

-- Claim status enum
CREATE TYPE claim_status AS ENUM (
  'pending',
  'contacted',
  'booked',
  'completed',
  'cancelled',
  'expired'
);

-- Time preference enum (matches existing UI)
CREATE TYPE time_preference AS ENUM (
  'morning',
  'afternoon',
  'evening',
  'flexible'
);

-- Main claims table
CREATE TABLE public.claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  consumer_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id         bigint      NOT NULL REFERENCES public.promo_offer_master(id) ON DELETE CASCADE,
  business_id      bigint      NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,

  -- Status
  status           claim_status NOT NULL DEFAULT 'pending',

  -- Consumer request details
  preferred_date   date,
  preferred_time   time_preference,
  notes            text         CHECK (char_length(notes) <= 500),

  -- Business response
  business_response text        CHECK (char_length(business_response) <= 1000),
  responded_at      timestamptz,

  -- Booking confirmation (set when status → booked)
  booked_date      date,
  booked_time      text         CHECK (char_length(booked_time) <= 50),

  -- Lifecycle timestamps
  expires_at       timestamptz  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at       timestamptz  NOT NULL DEFAULT NOW(),
  updated_at       timestamptz  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

-- Primary lookup: all claims for a consumer (consumer dashboard)
CREATE INDEX idx_claims_consumer_id     ON public.claims (consumer_id);

-- Primary lookup: all claims for a business (business leads page)
CREATE INDEX idx_claims_business_id     ON public.claims (business_id);

-- Status filtering
CREATE INDEX idx_claims_status          ON public.claims (status);

-- Expiry job: quickly find rows that need to be expired
CREATE INDEX idx_claims_expires_at      ON public.claims (expires_at)
  WHERE status = 'pending';

-- Anti-spam: prevent duplicate active claims for same (consumer, offer)
-- Partial index: only enforce uniqueness when status is active
CREATE UNIQUE INDEX idx_claims_no_duplicate_active
  ON public.claims (consumer_id, offer_id)
  WHERE status IN ('pending', 'contacted', 'booked');

-- ============================================================
-- Auto-update updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 7.2 Row Level Security

```sql
-- ============================================================
-- RLS Policies: claims table
-- ============================================================

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Consumers: read own claims only
CREATE POLICY "consumers_read_own_claims"
  ON public.claims
  FOR SELECT
  TO authenticated
  USING (consumer_id = auth.uid());

-- Consumers: insert own claims only
CREATE POLICY "consumers_insert_own_claims"
  ON public.claims
  FOR INSERT
  TO authenticated
  WITH CHECK (consumer_id = auth.uid());

-- Consumers: cannot update claims (status changes go through Server Actions
-- that run with the service_role key on the server)
-- No UPDATE policy for consumers.

-- Business owners: read claims for their linked business
-- Requires a `business_owner_profiles` table (see Section 7.3) OR a
-- custom JWT claim set during business auth. This policy references a
-- helper function that returns the business_id linked to the current user.
CREATE POLICY "business_owners_read_own_leads"
  ON public.claims
  FOR SELECT
  TO authenticated
  USING (
    business_id = (
      SELECT business_id
      FROM public.business_owner_profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Service role (Server Actions using SUPABASE_SERVICE_ROLE_KEY):
-- bypasses RLS automatically. Used for:
-- - Status updates triggered by business owners (validated in Server Action)
-- - pg_cron expiry job
-- - Notification dispatch
```

### 7.3 Supporting Table: `business_owner_profiles`

This table records the linkage between a Supabase Auth user and a business. It is required for the business-owner RLS policy above and for the business dashboard lead queries.

```sql
-- ============================================================
-- Migration: 20260320_002_create_business_owner_profiles.sql
-- ============================================================

CREATE TABLE public.business_owner_profiles (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id  bigint  NOT NULL REFERENCES public.master_business_info(business_id) ON DELETE CASCADE,
  claim_status text    NOT NULL DEFAULT 'pending'
                       CHECK (claim_status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id),
  UNIQUE (business_id)  -- one owner per business in Phase 1
);

ALTER TABLE public.business_owner_profiles ENABLE ROW LEVEL SECURITY;

-- Business owners can read their own profile row
CREATE POLICY "read_own_business_profile"
  ON public.business_owner_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 7.4 pg_cron Expiry Job

```sql
-- ============================================================
-- Scheduled job: expire stale pending claims
-- Runs daily at 02:00 UTC
-- Requires pg_cron extension (enabled in Supabase by default)
-- ============================================================

SELECT cron.schedule(
  'expire-pending-claims',
  '0 2 * * *',
  $$
    UPDATE public.claims
    SET    status = 'expired'
    WHERE  status = 'pending'
    AND    expires_at < NOW();
  $$
);
```

### 7.5 Type Reference for Application Code

The Supabase TypeScript types should be regenerated after applying migrations:

```bash
npx supabase gen types typescript --project-id kdlpkjzcnbkjcvwsvlwn > src/types/supabase-generated.ts
```

The `Claim` type in `src/types/claim.ts` should be updated to align field names with the database (`offer_id` rather than `dealId`, snake_case throughout) or a mapping utility should be added. See Section 9.

---

## 8. API Design — Server Actions

All data mutations use Next.js Server Actions (`'use server'`). There are no dedicated API route handlers for these operations. Server Actions run in a Node.js context and use the Supabase **service role key** for writes that bypass RLS (validated in the action itself), and the **anon key with the user's session** for reads.

### 8.1 File Location

```
src/lib/actions/claims.ts
```

### 8.2 `createClaim`

```typescript
// Signature
async function createClaim(input: {
  offerId: number
  businessId: number
  preferredDate?: string       // ISO date string YYYY-MM-DD
  preferredTime?: 'morning' | 'afternoon' | 'evening' | 'flexible'
  notes?: string
}): Promise<
  | { data: { claimId: string }; error: null }
  | { data: null; error: 'unauthenticated' | 'unverified' | 'already_claimed' | 'limit_reached' | 'offer_not_found' | 'server_error' }
>
```

**Logic sequence:**

1. Call `supabase.auth.getUser()` with the session cookie. If null, return `{ error: 'unauthenticated' }`.
2. Check user metadata for `verification_status`. If not in `['email_verified', 'phone_verified', 'fully_verified']`, return `{ error: 'unverified' }`.
3. Count active claims for this consumer: `SELECT COUNT(*) FROM claims WHERE consumer_id = $userId AND status IN ('pending','contacted','booked')`. If count >= 3, return `{ error: 'limit_reached' }`.
4. Check for existing active claim: `SELECT id FROM claims WHERE consumer_id = $userId AND offer_id = $offerId AND status IN ('pending','contacted','booked')`. If found, return `{ error: 'already_claimed' }`.
5. Verify `$offerId` exists in `promo_offer_master`. If not, return `{ error: 'offer_not_found' }`.
6. Insert into `claims` using the **service role client** (bypasses consumer INSERT RLS for the expiry timestamp defaulting and validated input). Alternatively, use the user's session client if the INSERT RLS policy `consumers_insert_own_claims` is in place (preferred — defense in depth).
7. Fire-and-forget: dispatch notification email (see Section 10).
8. Return `{ data: { claimId: newRow.id } }`.

**Error codes and user-facing copy (per `MESSAGING-STYLE-GUIDE.md`):**

| Error code | UI message |
|------------|-----------|
| `unauthenticated` | "Sign in to claim this deal" |
| `unverified` | "Please verify your email to claim deals" |
| `already_claimed` | "You've already claimed this deal" |
| `limit_reached` | "You've reached the maximum claims for now. Complete or cancel an existing claim first." |
| `offer_not_found` | "This deal is no longer available" |
| `server_error` | "Something went wrong. Please try again." |

---

### 8.3 `getConsumerClaims`

```typescript
// Signature
async function getConsumerClaims(): Promise<
  | { data: ClaimWithDeal[]; error: null }
  | { data: null; error: 'unauthenticated' | 'server_error' }
>
```

**Logic:** Authenticated SELECT on `claims` joining `promo_offer_master` (for deal metadata) and `master_business_info` (for revealed business details). Sorted `created_at DESC`. RLS ensures only the calling user's rows are returned.

**Join shape returned:**

```typescript
interface ClaimWithDeal {
  id: string
  status: ClaimStatus
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  business_response: string | null
  booked_date: string | null
  booked_time: string | null
  created_at: string
  updated_at: string
  expires_at: string
  offer: {
    id: number
    service_name: string
    service_category: string
    discount_price: number | null
    original_price: number | null
    template_type: string
  }
  business: {
    business_id: number
    name: string
    address: string
    city: string
    website_clean: string | null
  }
}
```

---

### 8.4 `getClaimByOffer`

```typescript
// Returns the claim for a specific offer+consumer pair, if one exists.
// Used by dealSidebar and claimCTA to determine reveal state.
async function getClaimByOffer(offerId: number): Promise<
  | { data: { claimId: string; status: ClaimStatus } | null; error: null }
  | { data: null; error: 'unauthenticated' | 'server_error' }
>
```

---

### 8.5 `getBusinessLeads`

```typescript
// Business owner reads their incoming leads.
async function getBusinessLeads(): Promise<
  | { data: LeadWithConsumer[]; error: null }
  | { data: null; error: 'unauthenticated' | 'no_linked_business' | 'server_error' }
>
```

**Logic:** Server Action verifies session, looks up `business_owner_profiles` to get `business_id`, then fetches `claims` where `business_id` matches. Joins `auth.users` metadata for consumer display name. RLS on `claims` enforces business isolation.

**Note on joining `auth.users`:** Direct joins to `auth.users` from application code are not possible with the anon key. Options:
- Store consumer display name in a separate `consumer_profiles` table (`user_id`, `first_name`, `last_name`, `phone`), which the claim notification email also reads.
- Use the service role key in the Server Action to read the minimal fields needed.

The `consumer_profiles` table approach is preferred as it avoids service-role exposure for routine reads.

---

### 8.6 `updateClaimStatus`

```typescript
// Called by business owner to progress a claim.
async function updateClaimStatus(input: {
  claimId: string
  status: 'contacted' | 'booked' | 'cancelled'
  businessResponse?: string
  bookedDate?: string
  bookedTime?: string
}): Promise<
  | { data: { updated: true }; error: null }
  | { data: null; error: 'unauthenticated' | 'not_found' | 'unauthorized' | 'invalid_transition' | 'server_error' }
>
```

**Logic:**
1. Verify session.
2. Look up `business_owner_profiles` for calling user's `business_id`.
3. Fetch the claim. Verify `claim.business_id === owner.business_id`. If not, return `{ error: 'unauthorized' }`.
4. Validate status transition (see Section 12).
5. Update claim using service role client.
6. Return success.

---

### 8.7 `getBusinessReveal`

```typescript
// Returns business contact details for a deal the consumer has claimed.
// Returns null if no active claim exists for this consumer+offer.
async function getBusinessReveal(offerId: number): Promise<
  | { data: BusinessReveal | null; error: null }
  | { data: null; error: 'unauthenticated' | 'server_error' }
>

interface BusinessReveal {
  name: string
  address: string
  city: string
  website: string | null
  phone: string | null
  instagram_url: string | null
}
```

**Logic:** Check that an active claim exists for `(auth.uid(), offerId)`. If yes, return the `master_business_info` row. If no active claim, return `{ data: null }` (not an error — the component renders the locked state).

---

## 9. Frontend Integration Map

### 9.1 Files That Change

| File | Current State | Required Change |
|------|---------------|-----------------|
| `src/lib/context/claimsContext.tsx` | localStorage mock | Replace `createClaim` to call `createClaim` Server Action. Replace claim loading to call `getConsumerClaims`. Keep the same context shape so components require minimal updates. |
| `src/components/features/claimDealModal.tsx` | Calls `useClaims().createClaim()` | No interface change needed if context shape is preserved. Add error handling for structured error codes returned from Server Action. |
| `src/components/features/claimCTA.tsx` | Reads `getClaimByDealId(dealId)` from context | Add a server-fetched reveal state. The `dealId` prop will need to be the numeric Supabase `offer_id`, not the mock string ID. |
| `src/app/dashboard/claims/page.tsx` | Merges mock + localStorage claims | Switch to `getConsumerClaims()` Server Action as the sole data source. Remove mock data merge logic. |
| `src/components/features/claimCard.tsx` | Calls `getAnonymousDealById` and `getBusinessById` from mock data | Accept `ClaimWithDeal` type that already includes joined deal and business data from the Server Action. |
| `src/app/business/dashboard/leads/page.tsx` | Calls `LeadList` with `businessId` from localStorage mock auth | Call `getBusinessLeads()` Server Action. |
| `src/app/business/dashboard/leads/[claimId]/page.tsx` | Calls `getClaimByIdDynamic` from mock data | Fetch individual claim from Supabase via Server Action or direct query. |

### 9.2 Type Alignment

The existing `src/types/claim.ts` uses camelCase and string IDs (`dealId`, `businessId`). The new database uses snake_case and integer IDs (`offer_id`, `business_id`). A mapper function should bridge this:

```typescript
// src/lib/utils/claimMapper.ts
import type { ClaimWithDeal } from '@/lib/actions/claims'
import type { Claim } from '@/types/claim'

export function mapDbClaimToClient(dbClaim: ClaimWithDeal): Claim {
  return {
    id: dbClaim.id,
    dealId: String(dbClaim.offer.id),
    businessId: String(dbClaim.business.business_id),
    consumerId: '', // not exposed to client; omit or use placeholder
    status: dbClaim.status,
    preferredDate: dbClaim.preferred_date ?? undefined,
    preferredTime: dbClaim.preferred_time ?? undefined,
    notes: dbClaim.notes ?? undefined,
    businessResponse: dbClaim.business_response ?? undefined,
    bookedDate: dbClaim.booked_date ?? undefined,
    bookedTime: dbClaim.booked_time ?? undefined,
    createdAt: dbClaim.created_at,
    updatedAt: dbClaim.updated_at,
    expiresAt: dbClaim.expires_at,
  }
}
```

This preserves backward compatibility with `ClaimCard`, `ClaimStatusBadge`, and all other components that currently consume the `Claim` type.

### 9.3 Auth Dependency

`claimsContext.tsx` currently reads from `useAuth()` which is the localStorage mock. After real Supabase Auth is implemented:

- `consumer_id` for Server Actions is derived from `supabase.auth.getUser()` server-side — never trusted from the client.
- The context can remain as client state cache, but the source of truth moves to Supabase.
- `claimsContext.tsx` should transition to being a thin client cache layer over Server Action calls, or be replaced entirely with server component data fetching at the page level.

---

## 10. Business Notification System

### 10.1 Phase 1 Architecture (Manual Relay)

Trigger: Supabase Database Webhook on `INSERT` to `public.claims`.

Target: A Next.js API route (`/api/webhooks/new-claim`) or a Supabase Edge Function (`notify-new-claim`).

The handler:
1. Verifies the webhook signature (HMAC secret stored in environment variables).
2. Reads the new claim row from the event payload.
3. Fetches associated offer and business data (the webhook payload may only contain the claims row itself).
4. Composes the notification email.
5. Sends to the CostFinders ops inbox via Resend, SendGrid, or Supabase's built-in SMTP relay.

**Email body template (see `MESSAGING-STYLE-GUIDE.md` §6.1):**

```
Subject: New lead: {{offer_id}} — {{service_name}}

A consumer has claimed a deal.

Deal:     {{service_name}} ({{template_type}})
Business: {{business_name}}, {{city}}

Consumer contact:
  Name:  {{first_name}} {{last_name}}
  Email: {{consumer_email}}
  Phone: {{consumer_phone | "not provided"}}

Request:
  Preferred date: {{preferred_date | "flexible"}}
  Preferred time: {{preferred_time | "flexible"}}
  Notes: {{notes | "none"}}

Claim ID: {{claim_id}}
Submitted: {{created_at}}

Action required: Contact the consumer and relay deal details.
```

**No consumer PII in the subject line.** The subject uses `offer_id` and `service_name` only.

### 10.2 Phase 2 (Future — not in scope)

- Direct email to business using contact address in `master_business_info` or a verified business email added during profile claim.
- SMS notification via Twilio.
- In-app notification on the business dashboard.
- Configurable notification preferences per business.

---

## 11. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Consumer creates account but does not verify email, then tries to claim | `claimCTA.tsx` shows "Verification required" state (already implemented). Server Action also rejects with `unverified` as defense in depth. |
| Consumer submits claim while a concurrent request is in-flight (double-tap) | The unique partial index on `(consumer_id, offer_id)` causes the second INSERT to fail at the DB level. Server Action catches the unique constraint error and returns `already_claimed`. |
| `offer_id` in the claim request does not exist in `promo_offer_master` | Server Action validates existence before INSERT. Returns `offer_not_found`. |
| `business_id` passed by client does not match the business linked to the offer | Server Action fetches `business_id` from `promo_offer_master` directly — never trusts the client-supplied `business_id`. The client-supplied value is discarded. |
| A deal's `promo_offer_master` row is deleted after a claim is created | `ON DELETE CASCADE` on the `offer_id` FK means the claim row is also deleted. Consumer sees "Deal no longer available" in `ClaimCard` (already handled in the component). |
| Consumer's Supabase Auth session expires mid-claim | `supabase.auth.getUser()` returns null in the Server Action. Returns `unauthenticated`. The auth context should trigger a re-login prompt. |
| pg_cron job fails to run | Claims accumulate in `pending` state past their `expires_at`. This is a visibility problem, not a security problem. The expiry check can also be enforced at read time in `getConsumerClaims()` (filter out rows where `expires_at < NOW() AND status = 'pending'`). |
| Business owner account is not yet linked to a business | `getBusinessLeads()` returns `{ error: 'no_linked_business' }`. The leads page shows the "No business linked" state already present in the page component. |
| Notification email fails to deliver | The webhook handler logs the failure. The claim INSERT was already committed — the lead exists. Operations can query the `claims` table directly for leads that did not generate a notification. |
| Notes field contains HTML or script tags | Sanitize in the Server Action before INSERT using a simple strip (no HTML allowed; plain text only). |
| Consumer cancels their account | `ON DELETE CASCADE` from `auth.users` propagates to `claims`. Business is already in possession of the lead from the notification email. No recovery needed for already-notified leads. |

---

## 12. Claim Lifecycle & Status Machine

```
                   ┌─────────────────────────────────────────┐
                   │                                         │
  [Consumer]       │              [Operations/Business]      │
                   │                                         │
  Submit claim     │                                         │
       │           │                                         │
       ▼           │                                         │
   pending ────────┼──── expires_at exceeded ──────────► expired
       │           │                                         │
       │           │  Business contacts consumer             │
       ▼           │                                         │
  contacted        │                                         │
       │           │  Business confirms booking              │
       ▼           │                                         │
    booked         │                                         │
       │           │  Appointment completed                  │
       ▼           │                                         │
  completed        │                                         │
                   │                                         │
  Any active ──────┼──── Consumer or business cancels ──► cancelled
  state            │                                         │
                   └─────────────────────────────────────────┘
```

### Valid Transitions

| From | To | Actor | Condition |
|------|----|-------|-----------|
| `pending` | `contacted` | Business owner | Any time while pending |
| `pending` | `cancelled` | Consumer or Business owner | Any time while pending |
| `pending` | `expired` | pg_cron job | `expires_at < NOW()` |
| `contacted` | `booked` | Business owner | `booked_date` must be provided |
| `contacted` | `cancelled` | Consumer or Business owner | Any time |
| `booked` | `completed` | Business owner | After appointment date |
| `booked` | `cancelled` | Consumer or Business owner | Before appointment date |
| `completed` | — | Nobody | Terminal state |
| `cancelled` | — | Nobody | Terminal state |
| `expired` | — | Nobody | Terminal state |

**Invalid transitions** (rejected by `updateClaimStatus` with `invalid_transition`):
- Any transition into `pending`
- Any transition from terminal states (`completed`, `cancelled`, `expired`)
- `pending` → `booked` (must go through `contacted` first)
- `pending` → `completed`

---

## 13. Dependencies & Prerequisites

### Hard Prerequisites (blockers)

| Dependency | Status | Owner | Notes |
|------------|--------|-------|-------|
| **Supabase Auth integration** | Not done | Engineering | `authContext.tsx` is a localStorage mock. Real `auth.users` rows do not exist. The FK `consumer_id REFERENCES auth.users(id)` will fail until real sessions exist. This is the single largest blocker. |
| **Consumer profiles table** | Not done | Engineering | Business leads view needs consumer display name. A `consumer_profiles` table (`user_id`, `first_name`, `last_name`, `phone`) must be populated at signup. |
| **Supabase migrations applied** | Not done | Engineering | The `claims` and `business_owner_profiles` tables do not exist yet. |

### Soft Prerequisites (can develop in parallel but needed before launch)

| Dependency | Status | Notes |
|------------|--------|-------|
| Email sending service (Resend or SendGrid) | Not configured | Needed for ops notification. Can be stubbed in development by logging to console. |
| pg_cron extension enabled | Unknown | Supabase enables this by default on Pro plans; confirm for current project tier. |
| Business owner auth flow connected to `business_owner_profiles` | Not done | `businessAuthContext.tsx` is also a localStorage mock. The `linkBusiness` function must write to Supabase instead. |
| Numeric `offer_id` available on deal pages | Partially done | Deal detail pages currently use mock data with string IDs. Pages backed by real Supabase data already have numeric `offer.id`. Verify the deal detail route passes the real Supabase `id`, not the mock string. |

### Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL           # already present
NEXT_PUBLIC_SUPABASE_ANON_KEY      # already present
SUPABASE_SERVICE_ROLE_KEY          # needed for Server Actions that bypass RLS
CLAIM_NOTIFICATION_EMAIL           # ops inbox address
RESEND_API_KEY                     # or equivalent email provider key
NEW_CLAIM_WEBHOOK_SECRET           # HMAC secret for webhook signature verification
```

---

## 14. Success Metrics

### Phase 1 Launch Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Claim creation success rate | > 95% of submitted forms result in a persisted DB row | Count successful inserts / total form submissions |
| False positive rate (duplicate claims persisted) | 0 | Count rows violating `(consumer_id, offer_id)` uniqueness |
| Notification email delivery rate | > 90% | Email provider delivery webhook |
| Ops response time (lead relay to business) | < 4 business hours | Manual logging until automated |
| Claim history page load time | < 2 seconds | Vercel analytics |

### Business Metrics (30-day post-launch)

| Metric | Baseline | Target |
|--------|----------|--------|
| Total claims created | 0 | 50+ |
| Unique consumers who claimed | 0 | 30+ |
| Claims progressed past `pending` | 0 | 40% of claims |
| Claims reaching `booked` | 0 | 15% of claims |
| Unique businesses receiving at least 1 lead | 0 | 10+ |

---

## 15. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Supabase Auth migration takes longer than estimated, blocking claim FK | High | High | Implement `consumer_profiles` table with a UUID primary key that is not tied to `auth.users` as a temporary bridge. Migrate FK later. |
| pg_cron not available on current Supabase plan | Low | Medium | Implement expiry check at read time in `getConsumerClaims()` as a fallback. |
| Businesses ignore manual relay emails and leads go cold | Medium | High | Establish a 24-hour SLA for ops relay. Track relay latency manually. Prioritize direct business notification in Phase 2. |
| High claim volume overwhelms manual ops relay | Low (initially) | Medium | Volume at launch is expected to be low. If claims exceed 20/day, escalate to direct business email (Phase 2 acceleration). |
| Consumers submit claims as spam to see business details | Low | Medium | 3-claim active limit enforced server-side. Require email verification before any claim. Monitor for patterns and add CAPTCHA if needed. |
| Notification webhook fails silently | Medium | Medium | Add a daily SQL query to the ops process: `SELECT * FROM claims WHERE created_at > NOW() - INTERVAL '24h' AND status = 'pending'` to catch any unnotified leads. |
| RLS misconfiguration exposes claims cross-user | Low | Critical | Test RLS policies against both consumer and business owner session tokens before launch. Include RLS tests in acceptance criteria. |

---

## 16. Out of Scope (Phase 1)

The following are explicitly deferred to Phase 2 or later:

- Direct email notifications to businesses (all business contact goes through ops manually)
- SMS notifications to consumers or businesses
- In-app real-time notifications (WebSocket / Supabase Realtime subscriptions)
- Consumer ability to cancel a claim via the UI (status update path exists in DB but no consumer-facing cancel button)
- Business owner ability to set status to `completed` (tracked, but no UI built)
- Monetization gating (lead credits, pay-per-lead billing against businesses)
- Admin dashboard view of all claims across the platform
- Claim analytics (conversion rates, deal performance by category)
- Automated booking confirmations or calendar integration
- Two-way messaging between consumer and business (the `messages` mock exists but is not connected)
- Multi-location business support (one `business_id` per claim, one owner per business)

---

## 17. Acceptance Criteria Checklist

The following must all pass before the claim system is considered production-ready.

### Database

- [ ] `claims` table created with correct schema and constraints
- [ ] `business_owner_profiles` table created
- [ ] All FK relationships verified (auth.users, promo_offer_master, master_business_info)
- [ ] Partial unique index on `(consumer_id, offer_id)` for active claims verified
- [ ] RLS policies tested with a consumer session (cannot read another consumer's claims)
- [ ] RLS policies tested with a business owner session (can only read claims for own business)
- [ ] pg_cron job scheduled and verified to transition `pending` rows past `expires_at` to `expired`
- [ ] `set_updated_at` trigger fires on UPDATE

### Server Actions

- [ ] `createClaim` rejects unauthenticated requests
- [ ] `createClaim` rejects unverified consumers
- [ ] `createClaim` enforces 3-claim active limit
- [ ] `createClaim` prevents duplicate `(consumer_id, offer_id)` active claims
- [ ] `createClaim` derives `business_id` from `promo_offer_master` (not trusting client input)
- [ ] `getConsumerClaims` returns only the calling user's claims
- [ ] `getBusinessReveal` returns null (not an error) when no active claim exists
- [ ] `updateClaimStatus` rejects invalid transitions
- [ ] `updateClaimStatus` rejects updates to claims not belonging to the caller's business

### Frontend

- [ ] `ClaimDealModal` handles all 5 structured error codes with correct copy from messaging guide
- [ ] `ClaimCTA` transitions to revealed state after successful claim
- [ ] `/dashboard/claims` page loads claims from Supabase, not mock data
- [ ] `ClaimCard` displays real business name in revealed view
- [ ] `/business/dashboard/leads` page loads leads from Supabase
- [ ] Claim history sorted newest first
- [ ] Loading and empty states present for all async data fetches

### Notifications

- [ ] Ops notification email sent on every successful claim insert
- [ ] Notification email contains all required fields (consumer name, email, phone, deal title, preferred date/time, notes)
- [ ] Notification email does not include PII in the subject line
- [ ] Webhook signature verified before processing
- [ ] Email delivery failure does not roll back the claim transaction

### Security

- [ ] Service role key not exposed in client-side code (only in Server Actions)
- [ ] Business reveal endpoint cannot be called without an active claim for the requesting user
- [ ] Notes field HTML is stripped before storage
- [ ] No consumer `consumer_id` is included in client-facing API responses
