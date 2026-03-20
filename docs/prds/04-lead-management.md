# PRD 04 — Business Lead Management

**Version:** 1.0
**Date:** 2026-03-20
**Status:** Draft
**Author:** Product
**Scope:** Business portal — lead inbox, credit system, analytics, export, admin relay tools

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas & Jobs to Be Done](#3-user-personas--jobs-to-be-done)
4. [Current State Audit](#4-current-state-audit)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Frontend Integration Mapping](#9-frontend-integration-mapping)
10. [Business Rules & Logic](#10-business-rules--logic)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [Analytics & Metrics](#12-analytics--metrics)
13. [Admin Tools — Manual Relay Workflow](#13-admin-tools--manual-relay-workflow)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Migration Path from Mock Data](#15-migration-path-from-mock-data)
16. [Open Questions](#16-open-questions)

---

## 1. Executive Summary

### Problem Statement

CostFinders collects consumer leads (deal claims) but has no persistent, queryable backend to store them, relay them to businesses, or track business responses. The current implementation uses localStorage with mock data, meaning leads are ephemeral, businesses cannot receive real leads, and the platform cannot monetize the lead flow.

### Solution Overview

Build the backend infrastructure and API layer that converts the existing UI-complete lead management system into a fully functional lead generation product. This includes:

- A durable lead/claims database extending the existing `claims` type contract
- A credit-based access control system (free tier: limited monthly leads, paid tier: unlimited)
- A credit purchase flow backed by Stripe
- Business response tracking with audit timestamps
- Lead analytics aggregated per business per period
- CSV export for lead data
- An admin-facing relay workflow for the manual relay phase (Phase 1), before automated email/SMS notification is built

### Business Impact

| Metric | Target (90 days post-launch) |
|--------|------------------------------|
| Businesses receiving real leads | 50 |
| Lead credit packages sold | 200 |
| Average revenue per active business/month | $45 |
| Admin relay response time | Under 4 hours |
| Lead-to-contact conversion rate | 40% |

### Key Constraint

**Phase 1 is manual relay only.** The system records every lead in the database, but a human admin views the admin lead queue and contacts the business by email or phone. The business portal UI shows lead status in real time even before automated notification exists. Automated email/SMS notification is a Phase 2 concern and is out of scope here.

### Resource Requirements

- 1 backend engineer (schema, API routes, Stripe integration): 3–4 weeks
- 1 frontend engineer (connect existing UI to real API, remove mock-data imports): 1–2 weeks
- 1 admin workflow designer (admin relay queue UI): 1 week
- QA: 1 week parallel

---

## 2. Product Overview

### Product Vision

Every consumer claim submitted on CostFinders reaches the right business within 4 hours, is tracked through to appointment completion, and generates measurable revenue for both the platform and the business.

### Target Users

| User | Role | Primary Goal |
|------|------|--------------|
| Business owner / manager | Authenticated business user | See incoming leads, update their status, understand ROI |
| CostFinders admin | Internal platform operator | Relay leads to businesses manually, monitor queue |
| Consumer | Anonymous → authenticated | Claim a deal and expect follow-up from the business |

### Value Proposition per User

**Business:** Qualified appointment leads delivered to your inbox — pay only for leads you receive, with full status tracking and analytics to measure ROI.

**Admin:** A single queue showing every unrelayed lead with business contact info, so no lead falls through the cracks during the manual relay phase.

**Consumer:** Assurance that their claim was received and is being acted on, via status updates visible in the consumer dashboard.

### Success Criteria

- Zero leads are lost between consumer submission and admin relay
- Business credit balance correctly gates lead access (free vs paid)
- Every status transition is timestamped and auditable
- CSV export produces complete, accurate data with no PII leakage beyond what the tier permits
- Admin relay queue empties within SLA on a per-lead basis

---

## 3. User Personas & Jobs to Be Done

### Persona 1 — Medspa Business Owner (Sofia)

**Background:** Owns a three-chair medspa in Irvine. Checks her phone between appointments. Has 15 free lead credits from claiming her CostFinders profile. Not yet on a paid plan.

**Jobs to Be Done:**
- "When a customer inquires, I need to know their contact info and what they want so I can call them back quickly."
- "I need to know how many leads I have left this month so I don't get caught off-guard."
- "I want to see which of my deals is driving the most bookings so I can decide what to promote."

**Pain Points:**
- Lead data scattered across email and text — no central log
- No way to know if a lead came through or expired without manually checking
- Can't export data for their own CRM

### Persona 2 — CostFinders Admin (Marcus)

**Background:** Operations lead at CostFinders. Responsible for ensuring every lead reaches a business in the manual relay phase. Uses the admin dashboard daily.

**Jobs to Be Done:**
- "I need to see all new leads the moment they come in so I can relay them before the SLA expires."
- "I need to record that I relayed a lead (how and when) so there's no duplicated effort."
- "I need to see which businesses are non-responsive so I can follow up."

### Persona 3 — Consumer (Priya)

**Background:** Claimed a Botox deal in Austin. Expects a call or text within a day or two.

**Jobs to Be Done:**
- "I want to know my request was received and when I can expect to hear from the business."
- "If the business never contacts me, I want to be able to cancel and try another deal."

---

## 4. Current State Audit

### What Exists (UI-complete, mock data)

The following components are built and functional against mock data. They require only API integration — no structural redesign is needed.

| Component | File | Current Data Source |
|-----------|------|---------------------|
| Lead list with filters | `src/components/features/leadManagement/leadList.tsx` | `getClaimsForBusiness()` / `getBusinessCredits()` from mock-data |
| Lead detail with status actions | `src/components/features/leadManagement/leadDetail.tsx` | `updateClaimStatus()` / `addBusinessResponse()` from mock-data |
| Lead balance card | `src/components/features/leadBalanceCard.tsx` | `BusinessCredits` type from `leadPricing.ts` |
| Lead cost card | `src/components/features/leadCostCard.tsx` | `TierPricing` / `calculateTierSavings()` from `leadPricing.ts` |
| Lead packages grid | `src/components/features/leadPackagesGrid.tsx` | `CreditPackage[]` from `leadPricing.ts` |
| Lead purchase modal | `src/components/features/leadPurchaseModal.tsx` | `purchaseCredits()` mock function |
| Analytics dashboard | `src/components/features/analytics/analyticsDashboard.tsx` | Hardcoded mock arrays |

### Existing Type Contract (`src/types/claim.ts`)

The frontend `Claim` type defines the shape that components depend on. The database schema and API responses must satisfy this contract.

```typescript
export type ClaimStatus =
  | 'pending'
  | 'contacted'
  | 'booked'
  | 'completed'
  | 'cancelled'
  | 'expired'

export interface Claim {
  id: string
  dealId: string
  consumerId: string
  businessId: string
  status: ClaimStatus
  preferredDate?: string
  preferredTime?: string
  notes?: string
  businessResponse?: string   // maps to lead_responses.content
  respondedAt?: string        // maps to lead_responses.created_at (first response)
  bookedDate?: string
  bookedTime?: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}
```

### Existing Pricing Contract (`src/lib/mock-data/leadPricing.ts`)

The mock data establishes the pricing model that the real implementation must replicate:

| Package | Credits | Price | Per-Lead Cost | Savings |
|---------|---------|-------|---------------|---------|
| Starter | 10 | $45 | $4.50 | 10% |
| Standard | 25 | $100 | $4.00 | 20% |
| Professional | 50 | $175 | $3.50 | 30% |
| Enterprise | 100 | $300 | $3.00 | 40% |

Tier per-lead baseline:
- Free tier: $5.00/lead
- Paid tier: $3.00/lead

### Routes Already Defined (`docs/ROUTES.md`)

```
/business/dashboard/leads          → leadList.tsx
/business/dashboard/leads/[claimId] → leadDetail.tsx
/business/dashboard/leads/pricing  → redirects to /business/dashboard/pricing
/business/dashboard/analytics      → analyticsDashboard.tsx
```

---

## 5. Functional Requirements

### 5.1 Business Lead Inbox

#### FR-01: Display all claims for the authenticated business

The lead list must display all claims associated with deals owned by the authenticated business, ordered by `created_at` descending.

**Acceptance:** Business user sees all their claims. Newly submitted claims appear without page refresh (polling or realtime subscription, Phase 2).

#### FR-02: Filter claims by status tab

Five filter tabs: All, Pending, Active (contacted + booked), Completed, Cancelled (cancelled + expired). Each tab shows a count badge. Filter is applied client-side after initial data fetch.

**User Story:**
> As a business owner, I want to quickly see only my pending leads so I can prioritize follow-up.
>
> **Given** I am on the leads page with a mix of statuses,
> **When** I click the "Pending" tab,
> **Then** only claims with status `pending` are shown, and the badge count matches.

#### FR-03: Search claims

Full-text search across deal title and a consumer display identifier. Search executes client-side against the loaded dataset (no server-side search required for MVP).

#### FR-04: Credit balance indicator

A persistent credit indicator in the lead list header shows `credits_remaining` from `lead_credits`. If balance is below 5, display a low-balance warning. If balance is 0, show an "out of credits" banner that blocks new leads from being visible unless the business is on the paid tier.

**Business Rule:** A claim is only visible to the business if:
- The business is on the paid tier (unlimited), OR
- The business is on the free tier AND has credits_remaining > 0 when the claim was created AND a credit was deducted at claim creation time

See Section 10 for full credit deduction logic.

---

### 5.2 Lead Detail & Response Workflow

#### FR-05: View lead detail

Display all fields from the `Claim` type: consumer display name, deal info, preferred date/time, consumer notes, current status, activity timeline.

#### FR-06: Reveal contact information after first status transition

Contact info (email, phone) is hidden while a claim is in `pending` status. Once the business marks a lead as `contacted` (the first status transition), the consumer's real email and phone number are revealed from the `consumers` / `auth.users` table. This is the "contact unlock" mechanic — the business pays for the lead at this point (or the credit was already deducted at claim creation; see Section 10).

**User Story:**
> As a business owner, I want to see the customer's contact info so I can reach out.
>
> **Given** a claim in `pending` status,
> **When** I click "Mark Contacted",
> **Then** the status changes to `contacted`, the activity timeline records the timestamp, and the contact card reveals the consumer's email and phone.

#### FR-07: Status transitions

Valid state machine:

```
pending → contacted
pending → cancelled

contacted → booked
contacted → cancelled

booked → completed
booked → cancelled
```

Terminal states: `completed`, `cancelled`, `expired`. No further transitions allowed.

Each transition must:
1. Update `claims.status` and `claims.updated_at`
2. Write a row to `lead_responses` with `response_type: 'status_change'` and the new status as metadata
3. If transitioning to `contacted` for the first time, set `claims.responded_at`
4. If transitioning to `booked`, set `claims.booked_date`
5. If transitioning to `completed`, set `claims.completed_at`

#### FR-08: Business notes

A text area allows the business to save internal notes on a claim. Notes are stored in `lead_responses` with `response_type: 'internal_note'`. Previous notes are loaded and editable. Notes are not visible to the consumer.

**User Story:**
> As a business owner, I want to save notes on a lead (e.g., "called twice, no answer") so my staff knows the history.
>
> **Given** I am on a lead detail page,
> **When** I type in the notes field and click "Save Notes",
> **Then** the note is persisted to `lead_responses` and the "Last updated" timestamp updates.

#### FR-09: Activity timeline

The sidebar activity card must display each event in chronological order with a timestamp. Events include: claim created, business relayed (admin relay timestamp), status changes, notes added.

---

### 5.3 Lead Credit System

#### FR-10: Free tier credit allowance

Businesses on the free tier receive a monthly allocation defined in platform settings (default: 10 credits/month). Credits do not carry over month to month. The `lead_credits` table tracks `credits_remaining`, `credits_used`, and `monthly_reset_date`.

#### FR-11: Credit deduction on claim creation

When a consumer submits a claim for a free-tier business's deal, one credit is deducted from `lead_credits.credits_remaining` atomically. If `credits_remaining` is 0, the claim is still created (and the admin can see it) but is not surfaced in the business portal lead inbox — the business sees a "No credits remaining" state and is prompted to purchase credits or upgrade.

**Note on timing:** Deduction happens at claim creation, not at contact-unlock. The business pays for receiving the lead, not for viewing contact info. This matches the existing mock pricing model.

#### FR-12: Paid tier unlimited access

Businesses on the paid tier have `lead_credits.tier = 'paid'`. For paid-tier businesses, `credits_remaining` is not checked — all claims are visible without deduction.

#### FR-13: Monthly credit reset

A scheduled job (Supabase cron or external scheduler) runs on the first of each month. For every business with `tier = 'free'`, it sets `credits_remaining` to the platform's configured monthly free allocation and `credits_used = 0`. The `monthly_reset_date` is updated.

A `lead_credit_transactions` row with `transaction_type: 'monthly_reset'` is written for audit purposes.

---

### 5.4 Credit Purchase Flow

#### FR-14: Package selection

The `/business/dashboard/pricing` page renders `LeadPackagesGrid` with live package data from the database. The four packages defined in the mock match what must be seeded into the database.

#### FR-15: Purchase confirmation modal

`LeadPurchaseModal` shows a package summary, current balance, balance-after-purchase preview, and the saved payment method. On confirm, initiates a Stripe Payment Intent.

#### FR-16: Stripe payment processing

On purchase confirmation:
1. Call `/api/business/leads/purchase` with `package_id`
2. Server creates a Stripe Payment Intent
3. Client confirms the Payment Intent using the saved payment method
4. On payment success webhook, server:
   - Inserts a `lead_credit_transactions` row with `transaction_type: 'purchase'`, `amount_cents`, `credits_added`, `stripe_payment_intent_id`
   - Increments `lead_credits.credits_remaining` and `credits_purchased_total`
5. Client receives updated balance and shows the success state

**Stripe webhook must be idempotent** — duplicate `payment_intent.succeeded` events must not double-credit the balance.

#### FR-17: Balance reflects immediately after purchase

After purchase success, `LeadBalanceCard` must show the updated `credits_remaining` without requiring a page refresh. The purchase modal calls `onPurchaseComplete` with the new balance, which propagates up to the parent page state.

---

### 5.5 Lead Analytics

#### FR-18: Aggregated metrics

The analytics dashboard must display real data aggregated from `claims` for the authenticated business. The following metrics are required for the current 30-day window:

| Metric | Calculation |
|--------|-------------|
| Total views | Sum of `deal_views` for business's deals (separate `deal_views` event table, or from existing analytics) |
| Total claims | COUNT of claims for business in period |
| Conversion rate | (Total claims / Total views) * 100 |
| Revenue potential | SUM of `deals.deal_price` for all claims in period |
| Average response time | AVG(responded_at - created_at) for claims where responded_at IS NOT NULL |
| Booking rate | COUNT(status = 'booked' OR 'completed') / COUNT(all) * 100 |
| Completion rate | COUNT(status = 'completed') / COUNT(all) * 100 |

#### FR-19: Per-deal performance table

For each deal owned by the business:
- Deal title
- Views (30-day)
- Claims (30-day)
- Conversion rate (claims/views)
- Deal status (active/paused/expired)

Data sourced by joining `deals` with claim aggregates.

#### FR-20: Month-over-month credit usage

`LeadBalanceCard` renders the `usageHistory` prop showing 6-month credit usage. This is computed from `lead_credit_transactions` grouped by month.

---

### 5.6 Lead Export (CSV Download)

#### FR-21: Export all leads as CSV

On the lead list page, a "Export CSV" button triggers a download of the filtered claims dataset as a CSV file.

**Columns in export:**
- Claim ID
- Deal title
- Consumer first name (masked: first name only, last initial, no email/phone — free tier)
- Consumer full name + email + phone (paid tier only)
- Preferred date
- Preferred time
- Consumer notes
- Status
- Created at
- Responded at
- Booked date
- Completed at

**PII access rule:** Free-tier businesses receive masked consumer data in the export. Paid-tier businesses receive full contact info. This matches the in-app contact reveal logic.

#### FR-22: Export respects active filter

If a status filter tab is active, the export downloads only the filtered set. "All" tab exports everything.

**User Story:**
> As a business owner, I want to download my completed leads to import into my CRM.
>
> **Given** I have the "Completed" filter tab active,
> **When** I click "Export CSV",
> **Then** a CSV file downloads containing only completed claims, with appropriate contact info based on my tier.

---

### 5.7 Lead Expiry

#### FR-23: Automatic expiry of pending claims

Claims in `pending` status that have not been acted on by `expires_at` are automatically transitioned to `expired`. This is handled by a scheduled job that runs every hour:

```sql
UPDATE claims
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending'
  AND expires_at < NOW();
```

A `lead_responses` row with `response_type: 'system_event'` and `metadata: { event: 'auto_expired' }` is written.

**Default expiry window:** 7 days from claim creation (`expires_at = created_at + INTERVAL '7 days'`).

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Lead list initial load (P95) | < 800ms |
| Lead detail load (P95) | < 600ms |
| Status update round-trip | < 500ms |
| Credit purchase end-to-end | < 3s (Stripe included) |
| Analytics page load | < 1200ms |
| CSV export (up to 1000 leads) | < 2s |

### Security

- All business portal API routes must verify the authenticated user owns the `businessId` being queried (RLS policy + server-side check)
- Consumer PII (email, phone) must not be returned in API responses for `pending` claims regardless of tier
- Contact info for free-tier businesses must be masked in CSV exports
- Stripe webhook endpoints must validate `stripe-signature` headers
- `lead_credit_transactions` must be append-only — no UPDATE or DELETE permitted via API
- Admin relay endpoints must require `role = 'admin'` JWT claim

### Reliability

- Credit deduction at claim creation must be atomic (use Postgres transaction + `SELECT ... FOR UPDATE` on `lead_credits`)
- Stripe webhook must be processed idempotently using `stripe_payment_intent_id` as dedup key
- Monthly credit reset job must be idempotent (safe to run twice)

### Usability

- Existing UI components require no structural changes — only data source swaps
- The `Claim` TypeScript type contract must be preserved exactly as defined in `src/types/claim.ts`
- All empty states, error states, and loading skeletons are already built in the UI layer

### Compliance

- Consumer PII retention: email and phone stored in `auth.users` (Supabase Auth), not duplicated in `claims`
- GDPR: claims must be deletable as part of consumer account deletion
- Payment data: CostFinders stores no raw card data; Stripe handles all PCI-scoped data

---

## 7. Database Schema

### 7.1 Schema Overview

```
auth.users (Supabase Auth)
    ↓ 1:1
business_owners
    ↓ 1:1
lead_credits                          ← credit balance per business
    ↓ 1:N
lead_credit_transactions              ← audit log of all balance changes

master_business_info (existing)
    ↓ 1:N
deals (existing app schema)
    ↓ 1:N
claims                                ← extended with response + relay fields
    ↓ 1:N
lead_responses                        ← status changes, notes, system events
```

---

### 7.2 `claims` Table Extension

The `claims` table is the primary lead record. It extends the existing type contract with fields needed for relay tracking, analytics, and audit.

```sql
-- Migration: 004_claims_lead_management.sql

CREATE TABLE IF NOT EXISTS claims (
  -- Core identity
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  consumer_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id         bigint NOT NULL REFERENCES master_business_info(business_id) ON DELETE CASCADE,

  -- Status lifecycle
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','contacted','booked','completed','cancelled','expired')),

  -- Consumer request details
  preferred_date      date,
  preferred_time      text,
  notes               text,

  -- Business response (denormalized for fast read — canonical in lead_responses)
  business_response   text,          -- most recent internal note content
  responded_at        timestamptz,   -- when business first changed status away from pending

  -- Booking completion
  booked_date         date,
  booked_time         text,
  completed_at        timestamptz,

  -- Relay tracking (manual relay phase)
  relay_status        text NOT NULL DEFAULT 'unrelayed'
                        CHECK (relay_status IN ('unrelayed','relayed','acknowledged')),
  relayed_at          timestamptz,
  relayed_by          uuid REFERENCES auth.users(id), -- admin user who relayed
  relay_method        text CHECK (relay_method IN ('email','phone','sms',NULL)),
  relay_notes         text,

  -- Credit tracking
  credit_deducted     boolean NOT NULL DEFAULT false,  -- was a credit consumed for this claim?

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Indexes for common query patterns
CREATE INDEX idx_claims_business_id       ON claims(business_id);
CREATE INDEX idx_claims_consumer_id       ON claims(consumer_id);
CREATE INDEX idx_claims_deal_id           ON claims(deal_id);
CREATE INDEX idx_claims_status            ON claims(status);
CREATE INDEX idx_claims_relay_status      ON claims(relay_status);
CREATE INDEX idx_claims_created_at        ON claims(created_at DESC);
CREATE INDEX idx_claims_business_status   ON claims(business_id, status);
CREATE INDEX idx_claims_expires_at        ON claims(expires_at) WHERE status = 'pending';

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### 7.3 `lead_responses` Table

Append-only audit log for all events on a claim. Never updated, only inserted.

```sql
-- Migration: 004_lead_responses.sql

CREATE TABLE lead_responses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  actor_id            uuid REFERENCES auth.users(id),  -- null for system events
  actor_type          text NOT NULL
                        CHECK (actor_type IN ('business','admin','system')),

  -- Event classification
  response_type       text NOT NULL
                        CHECK (response_type IN (
                          'status_change',
                          'internal_note',
                          'contact_unlock',
                          'relay_event',
                          'system_event'
                        )),

  -- Content
  content             text,          -- note text for internal_note type
  metadata            jsonb,         -- structured data: { old_status, new_status, relay_method, event }

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- No UPDATE or DELETE via application code — append only
-- Revoke UPDATE, DELETE in RLS policies

CREATE INDEX idx_lead_responses_claim_id    ON lead_responses(claim_id);
CREATE INDEX idx_lead_responses_created_at  ON lead_responses(created_at DESC);
CREATE INDEX idx_lead_responses_type        ON lead_responses(response_type);
```

**Example rows:**

```json
// Status change
{
  "claim_id": "...",
  "actor_id": "biz-owner-uuid",
  "actor_type": "business",
  "response_type": "status_change",
  "metadata": { "old_status": "pending", "new_status": "contacted" }
}

// Internal note
{
  "claim_id": "...",
  "actor_id": "biz-owner-uuid",
  "actor_type": "business",
  "response_type": "internal_note",
  "content": "Called twice, left voicemail. Will try again tomorrow."
}

// Admin relay event
{
  "claim_id": "...",
  "actor_id": "admin-uuid",
  "actor_type": "admin",
  "response_type": "relay_event",
  "metadata": { "method": "email", "sent_to": "owner@business.com" }
}

// System expiry
{
  "claim_id": "...",
  "actor_id": null,
  "actor_type": "system",
  "response_type": "system_event",
  "metadata": { "event": "auto_expired" }
}
```

---

### 7.4 `lead_credits` Table

One row per business. Tracks the current credit balance and tier.

```sql
-- Migration: 004_lead_credits.sql

CREATE TABLE lead_credits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           bigint UNIQUE NOT NULL
                          REFERENCES master_business_info(business_id) ON DELETE CASCADE,

  -- Tier
  tier                  text NOT NULL DEFAULT 'free'
                          CHECK (tier IN ('free', 'paid')),

  -- Balance
  credits_remaining     integer NOT NULL DEFAULT 10 CHECK (credits_remaining >= 0),
  credits_used          integer NOT NULL DEFAULT 0,
  credits_purchased_total integer NOT NULL DEFAULT 0,

  -- Monthly reset tracking
  monthly_allocation    integer NOT NULL DEFAULT 10,
  monthly_reset_date    date NOT NULL DEFAULT date_trunc('month', now())::date,

  -- Timestamps
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_lead_credits_business_id ON lead_credits(business_id);
CREATE INDEX idx_lead_credits_tier               ON lead_credits(tier);
CREATE INDEX idx_lead_credits_reset_date         ON lead_credits(monthly_reset_date);

CREATE TRIGGER lead_credits_updated_at
  BEFORE UPDATE ON lead_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### 7.5 `lead_credit_transactions` Table

Append-only ledger for all credit balance changes.

```sql
-- Migration: 004_lead_credit_transactions.sql

CREATE TABLE lead_credit_transactions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               bigint NOT NULL
                              REFERENCES master_business_info(business_id) ON DELETE CASCADE,

  -- Transaction classification
  transaction_type          text NOT NULL
                              CHECK (transaction_type IN (
                                'purchase',
                                'claim_deduction',
                                'monthly_reset',
                                'admin_adjustment',
                                'refund'
                              )),

  -- Amount
  credits_delta             integer NOT NULL,   -- positive = added, negative = deducted
  credits_after             integer NOT NULL,   -- balance after this transaction

  -- Purchase-specific
  amount_cents              integer,            -- null for non-purchase transactions
  stripe_payment_intent_id  text UNIQUE,        -- dedup key for Stripe webhooks
  package_id                text,               -- e.g., 'pkg_50'

  -- Claim-specific (for claim_deduction)
  claim_id                  uuid REFERENCES claims(id),

  -- Audit
  performed_by              uuid REFERENCES auth.users(id),  -- admin for adjustments
  note                      text,

  created_at                timestamptz NOT NULL DEFAULT now()
);

-- No UPDATE or DELETE via application code
CREATE INDEX idx_transactions_business_id  ON lead_credit_transactions(business_id);
CREATE INDEX idx_transactions_type         ON lead_credit_transactions(transaction_type);
CREATE INDEX idx_transactions_created_at   ON lead_credit_transactions(created_at DESC);
CREATE INDEX idx_transactions_stripe_pi    ON lead_credit_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
```

---

### 7.6 Row Level Security Policies

```sql
-- claims: business sees only their own claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_business_read ON claims
  FOR SELECT
  USING (
    business_id = (
      SELECT b.business_id FROM business_owners bo
      JOIN master_business_info b ON bo.business_id = b.business_id
      WHERE bo.user_id = auth.uid()
    )
    OR
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY claims_business_update ON claims
  FOR UPDATE
  USING (
    business_id = (
      SELECT b.business_id FROM business_owners bo
      JOIN master_business_info b ON bo.business_id = b.business_id
      WHERE bo.user_id = auth.uid()
    )
    OR
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    -- Businesses cannot modify relay fields; only admins can
    (
      (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
      OR (relay_status = OLD.relay_status AND relayed_at IS NOT DISTINCT FROM OLD.relayed_at)
    )
  );

-- lead_responses: readable by claim owner and admins; insert only; no update/delete
ALTER TABLE lead_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_responses_read ON lead_responses
  FOR SELECT
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE business_id = (
        SELECT b.business_id FROM business_owners bo
        JOIN master_business_info b ON bo.business_id = b.business_id
        WHERE bo.user_id = auth.uid()
      )
    )
    OR (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY lead_responses_insert ON lead_responses
  FOR INSERT
  WITH CHECK (actor_id = auth.uid() OR actor_type = 'system');

-- No UPDATE or DELETE policies for lead_responses (append-only enforcement)

-- lead_credits: business sees only their own row
ALTER TABLE lead_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_credits_read ON lead_credits
  FOR SELECT
  USING (
    business_id = (
      SELECT b.business_id FROM business_owners bo
      JOIN master_business_info b ON bo.business_id = b.business_id
      WHERE bo.user_id = auth.uid()
    )
    OR (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- lead_credit_transactions: business reads their own; admins read all; append-only
ALTER TABLE lead_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_read ON lead_credit_transactions
  FOR SELECT
  USING (
    business_id = (
      SELECT b.business_id FROM business_owners bo
      JOIN master_business_info b ON bo.business_id = b.business_id
      WHERE bo.user_id = auth.uid()
    )
    OR (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );
```

---

## 8. API Design

All routes are Next.js App Router route handlers under `src/app/api/`. All authenticated routes verify the JWT from Supabase Auth. Business routes additionally verify the caller owns the `businessId` parameter.

---

### 8.1 Business Lead Routes

#### `GET /api/business/leads`

Returns paginated claims for the authenticated business.

**Query parameters:**
- `status` — optional, one of: `pending | contacted | booked | completed | cancelled | expired | active`
- `page` — default 1
- `per_page` — default 50, max 200

**Response:**
```json
{
  "claims": [
    {
      "id": "uuid",
      "deal_id": "uuid",
      "deal_title": "Premium Botox Treatment",
      "deal_price": 199,
      "deal_unit": "per area",
      "consumer_id": "uuid",
      "consumer_display": "Customer #4821",
      "status": "pending",
      "preferred_date": "2026-04-01",
      "preferred_time": "10:00 AM",
      "notes": "First time, nervous about the process",
      "business_response": null,
      "responded_at": null,
      "booked_date": null,
      "completed_at": null,
      "relay_status": "relayed",
      "relayed_at": "2026-03-20T14:22:00Z",
      "created_at": "2026-03-20T11:00:00Z",
      "updated_at": "2026-03-20T11:00:00Z",
      "expires_at": "2026-03-27T11:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 50,
  "credits": {
    "tier": "free",
    "credits_remaining": 8,
    "credits_used": 2,
    "credits_purchased_total": 10,
    "monthly_allocation": 10,
    "monthly_reset_date": "2026-04-01"
  }
}
```

**Note:** `consumer_display` is always the anonymized label ("Customer #XXXX"). Full contact info is only returned in the claim detail endpoint and only if status != 'pending'.

---

#### `GET /api/business/leads/[claimId]`

Returns full claim detail including contact info if unlocked.

**Response:**
```json
{
  "claim": {
    "id": "uuid",
    "deal_id": "uuid",
    "deal_title": "Premium Botox Treatment",
    "deal_price": 199,
    "deal_category": "neurotoxins",
    "consumer_id": "uuid",
    "consumer_display": "Customer #4821",
    "contact_info": {
      "unlocked": true,
      "email": "sarah@example.com",
      "phone": "+15125551234",
      "first_name": "Sarah"
    },
    "status": "contacted",
    "preferred_date": "2026-04-01",
    "preferred_time": "10:00 AM",
    "notes": "First time, nervous about the process",
    "business_response": "Looking forward to seeing you!",
    "responded_at": "2026-03-20T14:30:00Z",
    "booked_date": null,
    "completed_at": null,
    "relay_status": "relayed",
    "relayed_at": "2026-03-20T14:22:00Z",
    "created_at": "2026-03-20T11:00:00Z",
    "updated_at": "2026-03-20T14:30:00Z",
    "expires_at": "2026-03-27T11:00:00Z"
  },
  "activity": [
    {
      "id": "uuid",
      "response_type": "relay_event",
      "actor_type": "admin",
      "metadata": { "method": "email" },
      "created_at": "2026-03-20T14:22:00Z"
    },
    {
      "id": "uuid",
      "response_type": "status_change",
      "actor_type": "business",
      "metadata": { "old_status": "pending", "new_status": "contacted" },
      "created_at": "2026-03-20T14:30:00Z"
    }
  ]
}
```

**Contact info gating:**
- If `status == 'pending'`: `contact_info = { unlocked: false }`
- If `status != 'pending'`: full email, phone, first_name included

---

#### `PATCH /api/business/leads/[claimId]`

Updates claim status or business notes. At most one of `status` or `note` per request.

**Request body (status change):**
```json
{
  "action": "status_change",
  "new_status": "contacted"
}
```

**Request body (save note):**
```json
{
  "action": "save_note",
  "content": "Called twice, left voicemail."
}
```

**Validation:**
- `new_status` must be a valid transition from current status (enforce state machine server-side)
- `content` must be non-empty string, max 2000 chars
- Business must own the claim

**Response:** Updated claim object (same shape as `GET /api/business/leads/[claimId]`)

**Side effects on status_change:**
- Inserts `lead_responses` row with `response_type: 'status_change'`
- If transitioning to `contacted` for first time: sets `claims.responded_at`
- If transitioning to `booked`: sets `claims.booked_date`
- If transitioning to `completed`: sets `claims.completed_at`

---

#### `GET /api/business/leads/export`

Returns a CSV download of the authenticated business's claims.

**Query parameters:**
- `status` — optional filter (same values as list endpoint)

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`

**CSV columns (free tier):**
```
Claim ID, Deal Title, Customer, Preferred Date, Preferred Time, Notes, Status, Received, Responded At, Booked Date
```

**CSV columns (paid tier, adds):**
```
..., Customer Email, Customer Phone
```

---

#### `GET /api/business/leads/credits`

Returns the credit balance and transaction history for the authenticated business.

**Response:**
```json
{
  "credits": {
    "tier": "free",
    "credits_remaining": 8,
    "credits_used": 2,
    "credits_purchased_total": 10,
    "monthly_allocation": 10,
    "monthly_reset_date": "2026-04-01"
  },
  "usage_history": [
    { "month": "Oct 2025", "used": 5 },
    { "month": "Nov 2025", "used": 7 },
    { "month": "Dec 2025", "used": 3 },
    { "month": "Jan 2026", "used": 8 },
    { "month": "Feb 2026", "used": 6 },
    { "month": "Mar 2026", "used": 2 }
  ]
}
```

---

#### `POST /api/business/leads/purchase`

Initiates a credit package purchase via Stripe.

**Request body:**
```json
{
  "package_id": "pkg_50",
  "payment_method_id": "pm_xxxx"
}
```

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_yyy",
  "payment_intent_id": "pi_xxx",
  "amount_cents": 17500,
  "credits_to_add": 50
}
```

The client uses `client_secret` with Stripe.js to confirm the payment. Balance is updated via Stripe webhook, not immediately on this response.

---

#### `GET /api/business/leads/packages`

Returns the available credit packages.

**Response:**
```json
{
  "packages": [
    {
      "id": "pkg_10",
      "credits": 10,
      "price_cents": 4500,
      "price_per_lead_cents": 450,
      "savings_percent": 10,
      "is_best_value": false
    },
    {
      "id": "pkg_25",
      "credits": 25,
      "price_cents": 10000,
      "price_per_lead_cents": 400,
      "savings_percent": 20,
      "is_best_value": false
    },
    {
      "id": "pkg_50",
      "credits": 50,
      "price_cents": 17500,
      "price_per_lead_cents": 350,
      "savings_percent": 30,
      "is_best_value": false
    },
    {
      "id": "pkg_100",
      "credits": 100,
      "price_cents": 30000,
      "price_per_lead_cents": 300,
      "savings_percent": 40,
      "is_best_value": true
    }
  ]
}
```

---

### 8.2 Analytics Routes

#### `GET /api/business/analytics`

Returns aggregated analytics for the authenticated business.

**Query parameters:**
- `period` — `30d | 90d | 12m` (default: `30d`)

**Response:**
```json
{
  "period": "30d",
  "metrics": {
    "total_views": 1234,
    "total_claims": 45,
    "conversion_rate": 3.6,
    "revenue_potential_cents": 1245000,
    "avg_response_time_minutes": 218,
    "booking_rate": 42.2,
    "completion_rate": 31.1
  },
  "month_over_month": {
    "total_views_change": 12.0,
    "total_claims_change": 8.0,
    "conversion_rate_change": -0.2
  },
  "deal_performance": [
    {
      "deal_id": "uuid",
      "deal_title": "Premium Botox Treatment",
      "views_30d": 523,
      "claims_30d": 24,
      "conversion_rate": 4.6,
      "status": "active"
    }
  ]
}
```

---

### 8.3 Stripe Webhook Route

#### `POST /api/webhooks/stripe`

Handles `payment_intent.succeeded` events for credit purchases.

**Logic:**
1. Validate `stripe-signature` header
2. Parse event, ensure `type == 'payment_intent.succeeded'`
3. Extract `payment_intent_id`, `metadata.business_id`, `metadata.package_id`
4. Check if a `lead_credit_transactions` row with this `stripe_payment_intent_id` already exists — if so, skip (idempotent)
5. Begin Postgres transaction:
   - Insert `lead_credit_transactions` row
   - Increment `lead_credits.credits_remaining` and `credits_purchased_total`
6. Return 200

---

### 8.4 Consumer Claim Submission Route

#### `POST /api/claims`

Submitted by the consumer when claiming a deal.

**Request body:**
```json
{
  "deal_id": "uuid",
  "preferred_date": "2026-04-01",
  "preferred_time": "10:00 AM",
  "notes": "First time, a bit nervous!"
}
```

**Server logic:**
1. Verify consumer is authenticated
2. Verify deal exists and is active
3. Check if consumer already has an active (non-cancelled, non-expired) claim for this deal — if so, return 409
4. Fetch `lead_credits` for the deal's `business_id`
5. Begin transaction:
   - If `tier = 'free'` AND `credits_remaining = 0`: create claim with `credit_deducted = false`, claim is created but will not appear in business portal (consumer still gets confirmation)
   - If `tier = 'free'` AND `credits_remaining > 0`: create claim with `credit_deducted = true`, decrement `credits_remaining`, increment `credits_used`, insert `lead_credit_transactions` row with `transaction_type: 'claim_deduction'`
   - If `tier = 'paid'`: create claim with `credit_deducted = false` (no deduction needed)
6. Set `relay_status = 'unrelayed'`
7. Return created claim (consumer-facing shape, no business contact info)

**Response (201):**
```json
{
  "claim": {
    "id": "uuid",
    "deal_id": "uuid",
    "status": "pending",
    "created_at": "2026-03-20T11:00:00Z",
    "expires_at": "2026-03-27T11:00:00Z"
  }
}
```

---

### 8.5 Admin Relay Routes

#### `GET /api/admin/leads/relay-queue`

Returns all claims with `relay_status = 'unrelayed'`, ordered by `created_at` ascending (oldest first for SLA).

**Requires:** `role = 'admin'` in JWT

**Response:**
```json
{
  "queue": [
    {
      "claim_id": "uuid",
      "created_at": "2026-03-20T11:00:00Z",
      "expires_at": "2026-03-27T11:00:00Z",
      "hours_since_creation": 3.2,
      "deal_title": "Premium Botox Treatment",
      "consumer_display": "Customer #4821",
      "consumer_preferred_date": "2026-04-01",
      "business_id": 12345,
      "business_name": "Glow Medspa",
      "business_phone": "+15125551234",
      "business_email": "owner@glowmedspa.com",
      "business_tier": "free"
    }
  ],
  "total": 7
}
```

---

#### `POST /api/admin/leads/relay/[claimId]`

Marks a claim as relayed.

**Requires:** `role = 'admin'` in JWT

**Request body:**
```json
{
  "method": "email",
  "notes": "Sent email to owner@glowmedspa.com at 2:30 PM"
}
```

**Side effects:**
1. Sets `claims.relay_status = 'relayed'`, `relayed_at = now()`, `relayed_by = auth.uid()`, `relay_method = method`, `relay_notes = notes`
2. Inserts `lead_responses` row with `response_type: 'relay_event'`

**Response:** `200` with updated claim summary.

---

## 9. Frontend Integration Mapping

This section maps each existing component to the API endpoint and data transformation needed to replace the mock-data import.

### 9.1 `leadList.tsx`

| Current | Target |
|---------|--------|
| `getClaimsForBusiness(businessId)` | `GET /api/business/leads` |
| `getBusinessCredits()` | Included in `/api/business/leads` response as `credits` |
| `getDealByIdDynamic(claim.dealId)` | Denormalized into response: `deal_title`, `deal_price`, `deal_unit` |

**State management change:** Replace `useMemo` over static mock array with `useState` + `useEffect` that fetches on mount. Pass `credits` down to the credits indicator.

**Filter tabs:** Keep existing client-side filter logic. All claims for the period are fetched on mount (max 200). If a business has more than 200 claims, add pagination controls.

---

### 9.2 `leadDetail.tsx`

| Current | Target |
|---------|--------|
| `getDealByIdDynamic(claim.dealId)` | `deal_*` fields from `GET /api/business/leads/[claimId]` |
| `getMockContactInfo(consumerId)` | `contact_info` from `GET /api/business/leads/[claimId]` (conditional on status) |
| `updateClaimStatus(claim.id, newStatus)` | `PATCH /api/business/leads/[claimId]` `{ action: 'status_change', new_status }` |
| `addBusinessResponse(claim.id, notes)` | `PATCH /api/business/leads/[claimId]` `{ action: 'save_note', content }` |
| Activity timeline (hardcoded) | `activity` array from `GET /api/business/leads/[claimId]` |

**Type adapter:** The API response shape differs slightly from the frontend `Claim` type (snake_case vs camelCase). A thin adapter function in `src/lib/api/leads.ts` converts the API response to the `Claim` interface. This keeps all component code unchanged.

```typescript
// src/lib/api/leads.ts
export function adaptClaim(raw: ApiClaim): Claim {
  return {
    id: raw.id,
    dealId: raw.deal_id,
    consumerId: raw.consumer_id,
    businessId: String(raw.business_id),
    status: raw.status as ClaimStatus,
    preferredDate: raw.preferred_date ?? undefined,
    preferredTime: raw.preferred_time ?? undefined,
    notes: raw.notes ?? undefined,
    businessResponse: raw.business_response ?? undefined,
    respondedAt: raw.responded_at ?? undefined,
    bookedDate: raw.booked_date ?? undefined,
    bookedTime: raw.booked_time ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    expiresAt: raw.expires_at,
  }
}
```

---

### 9.3 `leadBalanceCard.tsx`

| Current | Target |
|---------|--------|
| `BusinessCredits` from `getBusinessCredits()` | `credits` from `GET /api/business/leads/credits` |
| `usageHistory` (mock 6-month array) | `usage_history` from same endpoint |

**Type adapter:**
```typescript
// API response → BusinessCredits type
function adaptCredits(raw: ApiCreditsResponse): BusinessCredits {
  return {
    available: raw.credits.credits_remaining,
    used: raw.credits.credits_used,
    totalPurchased: raw.credits.credits_purchased_total,
  }
}
```

---

### 9.4 `leadCostCard.tsx`

| Current | Target |
|---------|--------|
| `currentTier` (hardcoded 'free') | From `lead_credits.tier` (included in credits response) |
| `currentPricing` from `getLeadPricing(tier)` | From `GET /api/business/leads/packages` (extract tier-baseline pricing) |
| `paidPricing` hardcoded | Same packages endpoint |

The `TierPricing` interface is unchanged; only the data source changes.

---

### 9.5 `leadPackagesGrid.tsx` + `leadPurchaseModal.tsx`

| Current | Target |
|---------|--------|
| `getCreditPackages()` static array | `GET /api/business/leads/packages` |
| `purchaseCredits(packageId)` mock | `POST /api/business/leads/purchase` → Stripe confirmation → wait for webhook |
| `BusinessCredits` balance | Polled or re-fetched after Stripe webhook signals success |

**Purchase flow change:** The mock `purchaseCredits()` is synchronous. The real flow has an async gap (Stripe webhook). The purchase modal will poll `GET /api/business/leads/credits` every 2 seconds for up to 30 seconds after Stripe confirmation, waiting for `credits_remaining` to increase. On success, call `onPurchaseComplete`. On timeout, show a "processing" message with instructions to refresh.

---

### 9.6 `analyticsDashboard.tsx`

| Current | Target |
|---------|--------|
| Hardcoded `metrics` array | `GET /api/business/analytics?period=30d` |
| Hardcoded `dealPerformanceData` | `deal_performance` array from same endpoint |
| Hardcoded `trends` array | Computed on backend from real data, returned as `insights` |

The `MetricCard` and `DealPerformanceTable` component shapes are unchanged. Only the data passed as props changes.

---

### 9.7 New: Export Button (to be added to `leadList.tsx`)

A "Export CSV" button needs to be added to the `LeadList` header. When clicked:
1. Construct the URL: `/api/business/leads/export?status={activeTab === 'all' ? '' : activeTab}`
2. Open in a new window or use a programmatic download via `<a href>` with `download` attribute
3. The server returns the file inline with correct headers

No new component is needed — a simple `<a>` or `<button onClick>` inside the existing header `div`.

---

## 10. Business Rules & Logic

### 10.1 Credit Deduction Rules

| Business Tier | Credits Remaining | Claim Behavior |
|---------------|-------------------|----------------|
| free | > 0 | Claim created, 1 credit deducted, `credit_deducted = true` |
| free | = 0 | Claim created, `credit_deducted = false`, hidden from business portal inbox |
| paid | any | Claim created, no deduction, always visible |

Claims hidden from the business portal (zero-credit free tier) are still visible to:
- The consumer (they see their claim status)
- The admin relay queue (admin decides whether to relay or hold)

**Rationale:** A consumer should not be penalized for a business running out of credits. Their claim is recorded and the business will be prompted to top up.

### 10.2 State Machine Enforcement

Status transitions are enforced server-side in the PATCH handler. Attempting an invalid transition returns 422 with an error message.

```
pending     → contacted    VALID
pending     → cancelled    VALID
pending     → booked       INVALID (must contact first)
pending     → completed    INVALID
pending     → expired      INVALID (system only)
contacted   → booked       VALID
contacted   → cancelled    VALID
contacted   → completed    INVALID (must book first)
booked      → completed    VALID
booked      → cancelled    VALID
completed   → *            INVALID (terminal)
cancelled   → *            INVALID (terminal)
expired     → *            INVALID (terminal)
```

### 10.3 Contact Info Reveal Gate

Consumer contact info (email, phone) is gated by claim status. This gate is enforced server-side:

- `status = 'pending'` → `contact_info: { unlocked: false }`
- `status != 'pending'` → `contact_info: { unlocked: true, email, phone, first_name }`

The reveal is permanent — once a claim moves past `pending`, contact info remains visible regardless of further status changes.

### 10.4 Monthly Credit Reset

Reset job behavior:
1. Find all `lead_credits` rows where `monthly_reset_date < date_trunc('month', now())`
2. For each `tier = 'free'` business: set `credits_remaining = monthly_allocation`, `credits_used = 0`, `monthly_reset_date = date_trunc('month', now())`
3. For each `tier = 'paid'` business: update only `monthly_reset_date` (no credit changes needed)
4. Write a `lead_credit_transactions` row for each free-tier reset with `transaction_type: 'monthly_reset'` and `credits_delta = monthly_allocation`

Job must be idempotent: if re-run on the same day, the `monthly_reset_date` check prevents double-reset.

### 10.5 Lead Expiry Behavior

When a claim auto-expires:
- The consumer sees status `expired` on their dashboard
- The business sees the claim in the Cancelled tab (expired is grouped with cancelled in the UI filter)
- The `credit_deducted` field is not reversed — expired leads still consumed a credit
- Exception: if `credit_deducted = false` (business had zero credits), no credit was consumed

**Rationale for no credit refund on expiry:** The business received the lead notification (via admin relay). Non-response is the business's responsibility.

### 10.6 Duplicate Claim Prevention

A consumer may not have two active claims for the same deal. "Active" means any status except `cancelled` or `expired`. The server enforces this at claim creation and returns a 409 with a descriptive message.

### 10.7 Admin Relay SLA

Target: every new lead relayed within 4 hours of creation. The relay queue displays `hours_since_creation` to help admins prioritize. Claims over 4 hours old are visually flagged (e.g., warning color) in the queue.

---

## 11. Edge Cases & Error Handling

### Credit System Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Two consumers claim the same free-tier deal simultaneously when 1 credit remains | Atomic transaction with `SELECT ... FOR UPDATE` ensures only one succeeds; second claim gets `credit_deducted = false` |
| Business upgrades to paid tier mid-month | Existing hidden claims (credit_deducted = false from this month) are NOT retroactively surfaced. Business sees new claims immediately. |
| Business downgrades to free tier | Credit balance initialized to `monthly_allocation`. Prior unlimited claims remain visible in history. |
| Stripe webhook fires twice for same payment | `stripe_payment_intent_id` UNIQUE constraint prevents double-credit |
| Monthly reset job crashes halfway | Per-row `monthly_reset_date` check ensures partial completion is safe to re-run |
| Business has no `lead_credits` row | Auto-create on first deal claim using `INSERT ... ON CONFLICT DO NOTHING` with `tier = 'free'`, `credits_remaining = 10` |

### API Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Invalid status transition | 422 | `INVALID_STATUS_TRANSITION` |
| Claim not found | 404 | `CLAIM_NOT_FOUND` |
| Claim belongs to different business | 403 | `CLAIM_ACCESS_DENIED` |
| Note content too long (>2000 chars) | 422 | `NOTE_TOO_LONG` |
| Duplicate active claim | 409 | `DUPLICATE_ACTIVE_CLAIM` |
| Invalid package ID | 400 | `INVALID_PACKAGE` |
| Stripe payment failure | 402 | `PAYMENT_FAILED` |
| Admin access to non-admin route | 403 | `ADMIN_REQUIRED` |
| Status transition on terminal claim | 422 | `TERMINAL_STATUS` |

### UI Edge Cases

| Scenario | UI Behavior |
|----------|-------------|
| Business has 0 credits, new lead arrives | Banner on leads page: "You're out of leads. Purchase credits to view new inquiries." |
| All pending claims expire | Pending tab shows 0, claims move to Cancelled tab |
| Analytics page loads with no data (new business) | Empty state with guidance text (already built in component) |
| CSV export with 0 results | Download a valid CSV with headers only and no data rows |
| Business on free tier attempts export with `paid` field columns | Server strips PII fields from CSV regardless of UI request |
| Session expires during status update | API returns 401, UI shows re-auth prompt |

### Relay Queue Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Claim auto-expires before admin relays it | Removed from relay queue; no action needed |
| Admin relays same claim twice (duplicate submit) | `relay_status` is already `relayed`; server returns 200 with a note that it was already relayed |
| Business email bounces after relay | Admin notes this in relay_notes; claim remains `relayed`; business follows up separately |

---

## 12. Analytics & Metrics

### Business-Facing Metrics (in `analyticsDashboard.tsx`)

| Metric | Source Table | SQL Summary |
|--------|-------------|-------------|
| Total claims | `claims` | `COUNT(*) WHERE business_id = ? AND created_at >= period_start` |
| Conversion rate | `claims` + `deal_views` | `claims / views * 100` |
| Avg response time | `claims` | `AVG(EXTRACT(EPOCH FROM responded_at - created_at) / 60)` |
| Booking rate | `claims` | `COUNT(*) FILTER (WHERE status IN ('booked','completed')) / COUNT(*) * 100` |
| Completion rate | `claims` | `COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*) * 100` |
| Revenue potential | `claims` JOIN `deals` | `SUM(deals.deal_price) WHERE business_id = ? AND period` |
| Credit usage history | `lead_credit_transactions` | `SUM(ABS(credits_delta)) GROUP BY date_trunc('month', created_at)` |

### Platform-Facing Metrics (internal, admin dashboard)

| Metric | Purpose |
|--------|---------|
| Relay queue depth | Operational: are leads getting to businesses? |
| Average relay latency | SLA tracking: time from claim creation to `relayed_at` |
| Credit depletion rate | Revenue signal: how fast are free-tier businesses exhausting credits? |
| Purchase conversion rate | Revenue: % of businesses who hit $0 credits that purchase |
| Lead-to-booking rate by business tier | Product: do paid-tier businesses convert better? |
| Claim expiry rate | Product health: too high = notification problem |

---

## 13. Admin Tools — Manual Relay Workflow

This section defines the admin-facing functionality for Phase 1, when all lead relay is manual.

### 13.1 Admin Relay Queue Page

**Route:** `/admin/dashboard/leads` (new page to be added to `docs/ROUTES.md`)

**Purpose:** Shows all claims with `relay_status = 'unrelayed'`, allowing an admin to mark each as relayed after contacting the business.

**UI elements:**
- Table with columns: Business name, Consumer request summary, Deal, Received, Hours in queue, Business contact info
- Age-based visual flag: claims over 4 hours show in warning amber
- Per-row action: "Mark Relayed" button opens an inline form asking for relay method (email/phone) and optional notes
- Bulk action: "Mark selected as relayed" for efficiency

**No new component is required for the table rows** — the existing `businessTable.tsx` pattern in `src/components/features/admin/` can serve as a structural reference.

### 13.2 Relay Status Tracking

The admin can see three relay statuses per claim:
- `unrelayed` — not yet contacted
- `relayed` — admin has contacted the business
- `acknowledged` — business has logged into the portal and taken action (status changed from `pending`)

The `acknowledged` state is set automatically when the business makes the first status transition.

### 13.3 Business Contact Info in Admin View

The admin relay queue shows the real business email and phone from `master_business_info` so the admin can contact them directly. This data is already in the existing table.

### 13.4 Relay Notes

Admin relay notes (`relay_notes` on `claims`) are visible only in the admin view. They are not surfaced in the business portal. This allows internal notes like "business owner said they don't check email, prefer SMS."

### 13.5 SLA Dashboard (Future)

A planned (not in-scope) addition to the admin dashboard: a chart showing average relay latency over time and a breakdown of expired-before-relayed claims as a percentage of total. This is tracked in `lead_responses` data and can be built as a reporting query later.

---

## 14. Acceptance Criteria

### AC-01: Lead Inbox Loads Real Data

**Given** a business owner is authenticated and has at least one claim in the database,
**When** they navigate to `/business/dashboard/leads`,
**Then** the lead list loads within 800ms showing real claims from Supabase, the credit balance shows actual `credits_remaining`, and the filter tabs show accurate counts.

### AC-02: Status Transitions Persist

**Given** a claim in `pending` status,
**When** the business clicks "Mark Contacted",
**Then** the claim status updates to `contacted` in the database, a `lead_responses` row is inserted, `claims.responded_at` is set, and on page reload the status persists.

### AC-03: Contact Info Revealed on First Transition

**Given** a claim in `pending` status with contact info hidden,
**When** the business transitions the status to `contacted`,
**Then** the contact card in the sidebar immediately shows the consumer's real email and phone number without a page reload.

### AC-04: Business Notes Persist

**Given** a business enters a note in the Business Notes field,
**When** they click "Save Notes",
**Then** the note is written to `lead_responses` and the "Last updated" timestamp updates. On page reload, the note text is pre-populated in the textarea.

### AC-05: Free Tier Credit Gating

**Given** a free-tier business with 0 credits remaining,
**When** a consumer submits a new claim for their deal,
**Then** the consumer receives a successful claim confirmation, but the lead does NOT appear in the business portal inbox. An "out of credits" banner appears on the leads page prompting the business to buy more.

### AC-06: Credit Purchase Updates Balance

**Given** a business with 3 credits remaining purchases the 10-credit package ($45),
**When** the Stripe payment succeeds,
**Then** `credits_remaining` increases to 13 within 30 seconds of payment, a `lead_credit_transactions` row is inserted with `transaction_type: 'purchase'`, and `LeadBalanceCard` reflects the new balance without requiring a manual page refresh.

### AC-07: CSV Export Downloads Correctly

**Given** a business with 5 completed leads,
**When** they select the "Completed" filter tab and click "Export CSV",
**Then** a CSV file downloads containing exactly 5 rows plus a header row. Free-tier businesses have the consumer email and phone columns omitted. Paid-tier businesses receive full contact data.

### AC-08: Monthly Credit Reset

**Given** a free-tier business that has used 10 of 10 credits,
**When** the first of the month arrives and the reset job runs,
**Then** `credits_remaining` resets to 10 (or the configured `monthly_allocation`), `credits_used` resets to 0, and a `lead_credit_transactions` row with `transaction_type: 'monthly_reset'` is written.

### AC-09: Claim Auto-Expiry

**Given** a claim in `pending` status with `expires_at` in the past,
**When** the expiry job runs,
**Then** the claim status changes to `expired`, a `lead_responses` system event row is inserted, and the claim appears in the Cancelled tab of the business portal.

### AC-10: Admin Relay Queue Shows All Unrelayed Leads

**Given** a logged-in admin with `role = 'admin'`,
**When** they access `/admin/dashboard/leads`,
**Then** all claims with `relay_status = 'unrelayed'` are shown, ordered oldest-first, with business contact info and hours-in-queue displayed. Claims over 4 hours old are visually flagged.

### AC-11: Admin Can Mark a Lead as Relayed

**Given** an admin is viewing the relay queue,
**When** they mark a claim as relayed via email,
**Then** `claims.relay_status` changes to `relayed`, `relayed_at` and `relayed_by` are set, a `lead_responses` relay_event row is written, and the claim disappears from the unrelayed queue.

### AC-12: Invalid Status Transition Rejected

**Given** a claim in `completed` status,
**When** the business attempts to change the status via the API,
**Then** the API returns 422 with error code `TERMINAL_STATUS`, and the UI shows a descriptive error message.

### AC-13: Duplicate Active Claim Prevented

**Given** a consumer already has an active (pending) claim for a deal,
**When** they attempt to submit another claim for the same deal,
**Then** the API returns 409 with error code `DUPLICATE_ACTIVE_CLAIM` and a user-facing message like "You already have an active inquiry for this deal."

### AC-14: Analytics Reflect Real Data

**Given** a business has 10 claims over the last 30 days with 3 completed,
**When** they load the analytics page,
**Then** Total Claims shows 10, Completion Rate shows 30%, and the per-deal performance table shows correct view and claim counts.

### AC-15: RLS Prevents Cross-Business Data Access

**Given** Business A is authenticated,
**When** they attempt to access a claim belonging to Business B via `/api/business/leads/[claimId]`,
**Then** the API returns 403 with error code `CLAIM_ACCESS_DENIED` and Business B's claim data is not exposed.

---

## 15. Migration Path from Mock Data

### Phase 1: Parallel Operation

The current mock data layer and all components that depend on it remain in place. New API routes are built and tested independently. A feature flag `NEXT_PUBLIC_USE_REAL_API=true` controls which data source is active. When false (default), the app uses mock data as before.

### Phase 2: Component-by-Component Migration

Components are migrated one at a time:

1. `leadList.tsx` — replace `getClaimsForBusiness` and `getBusinessCredits` with API calls
2. `leadDetail.tsx` — replace `getDealById`, `getMockContactInfo`, `updateClaimStatus`, `addBusinessResponse`
3. `leadBalanceCard.tsx` + `leadCostCard.tsx` — replace pricing mock functions
4. `leadPackagesGrid.tsx` + `leadPurchaseModal.tsx` — connect to Stripe purchase flow
5. `analyticsDashboard.tsx` — replace hardcoded metrics arrays

Each migration is independently deployable. The feature flag can be toggled per component until all are migrated.

### Phase 3: Remove Mock Data

After all components are verified against real data:
1. Remove `src/lib/mock-data/leadPricing.ts` (or keep as fallback seeding data)
2. Remove lead-related mock functions from `src/lib/mock-data/consumers.ts`
3. Remove lead-related exports from `src/lib/mock-data/index.ts`
4. Remove `NEXT_PUBLIC_USE_REAL_API` flag

### Seed Data

The following data must be seeded into the database for the migration to work:

```sql
-- Seed credit packages (used by /api/business/leads/packages)
CREATE TABLE credit_packages (
  id            text PRIMARY KEY,
  credits       integer NOT NULL,
  price_cents   integer NOT NULL,
  savings_percent integer NOT NULL DEFAULT 0,
  is_best_value boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true
);

INSERT INTO credit_packages VALUES
  ('pkg_10',  10,  4500,  10, false, true),
  ('pkg_25',  25, 10000,  20, false, true),
  ('pkg_50',  50, 17500,  30, false, true),
  ('pkg_100', 100, 30000, 40, true,  true);

-- Seed lead_credits for existing claimed businesses
INSERT INTO lead_credits (business_id, tier, credits_remaining, monthly_allocation)
SELECT
  bo.business_id,
  CASE WHEN sub.tier = 'paid' THEN 'paid' ELSE 'free' END,
  10,
  10
FROM business_owners bo
LEFT JOIN business_subscriptions sub ON bo.business_id = sub.business_id
ON CONFLICT (business_id) DO NOTHING;
```

---

## 16. Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| 1 | Should expired leads consume a credit? Current spec says yes (credit deducted at claim creation, not refunded on expiry). Confirm with product. | Product | Credit fairness |
| 2 | What is the exact monthly free allocation — 10 leads/month or 5? Mock data uses 10. Confirm with business team. | Business | Pricing model |
| 3 | Are credit packages one-time purchases only, or can auto-renewal be enabled? MVP spec says one-time; confirm if auto-renewal is needed before Stripe integration begins. | Product | Stripe integration scope |
| 4 | When a claim is `credit_deducted = false` (free-tier, zero credits), should the consumer be notified their inquiry may not reach the business promptly? Or is this invisible to them? | Product / UX | Consumer trust |
| 5 | The `deals` table foreign key in `claims` — is there a `deals` table in Supabase, or is deal data entirely from `promo_offer_master`? The CLAUDE.md references `promo_offer_master` as the existing deal store. Backend team must clarify whether a normalized `deals` table will exist or if `claims` should reference `promo_offer_master.id` directly. | Backend | Schema FK |
| 6 | Who creates the `lead_credits` row when a new business claims their profile? Should this be part of the claim-business flow (PRD 03) or lazily created on first consumer claim? | Backend | Initialization timing |
| 7 | Phase 2 notification: when automated email/SMS notification replaces manual relay, will the `relay_status` field be retired or repurposed? Plan for backward compatibility now. | Product | Schema evolution |
| 8 | Admin relay SLA is 4 hours. Is this enforced (escalation alerts) or aspirational? If enforced, an alert mechanism (Slack/email to ops) needs to be designed. | Operations | Scope |

---

*End of PRD 04 — Business Lead Management*
*Next related PRD: 05 — Stripe Billing Integration (subscription tiers, invoicing, plan changes)*
