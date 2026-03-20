# PRD-06: Payments & Billing — Stripe Integration

**Version:** 1.0
**Status:** Ready for Development
**Date:** 2026-03-20
**Project:** CostFinders v2
**Author:** Product (PRD Specialist)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Business Context & Revenue Model](#3-business-context--revenue-model)
4. [User Personas & Jobs-to-Be-Done](#4-user-personas--jobs-to-be-done)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Stripe Integration Architecture](#9-stripe-integration-architecture)
10. [Webhook Event Handling](#10-webhook-event-handling)
11. [Frontend Integration Mapping](#11-frontend-integration-mapping)
12. [Admin Billing Override System](#12-admin-billing-override-system)
13. [Edge Cases & Error Handling](#13-edge-cases--error-handling)
14. [Security & Compliance](#14-security--compliance)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [Implementation Roadmap](#16-implementation-roadmap)
17. [Open Questions](#17-open-questions)

---

## 1. Executive Summary

### Problem Statement

CostFinders has a complete billing UI built on mock data. Every payment interaction — subscription upgrades, lead credit purchases, sponsored placements — executes against in-memory state that resets on page load and accepts any input. No money moves. No entitlements are enforced. The business cannot generate revenue.

### Solution Overview

Replace mock payment logic with Stripe as the payment processor. Implement three distinct payment flows: recurring subscriptions via Stripe Checkout, one-time lead credit purchases via Stripe Payment Intents, and sponsored placement purchases also as one-time charges. Add a webhook handler that keeps Supabase in sync with Stripe's authoritative state. Expose Stripe Customer Portal for self-service billing management.

### Business Impact

| Metric | Baseline (Mock) | Target (Post-Launch) |
|--------|-----------------|----------------------|
| Monthly Recurring Revenue | $0 | $9,900+ (100 Pro subscribers at launch) |
| Lead credit revenue | $0 | $4,000–8,000/mo |
| Sponsorship revenue | $0 | $2,000–5,000/mo |
| Payment failure visibility | None | Full (Stripe dashboard + webhooks) |
| Churn tracking | None | Automated via subscription events |

### Resource Requirements

- **Backend:** 2–3 sprints (API routes, webhook handler, Supabase schema)
- **Frontend:** 1 sprint (swap mock integrations for real Stripe calls)
- **Infrastructure:** Stripe account (test + live), webhook endpoint registered on Vercel, environment variables configured
- **Dependencies:** `stripe` npm package, `@stripe/stripe-js`, `@stripe/react-stripe-js`

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|------------|
| Webhook delivery failure | Low | High | Idempotency keys on all handlers; Stripe retry policy (72h) |
| Proration calculation drift | Medium | Medium | Delegate entirely to Stripe; never compute proration locally |
| Duplicate charge on retry | Low | High | Stripe idempotency keys on PaymentIntent creation |
| Subscription state desync | Medium | High | Reconciliation job + webhook as single source of truth |
| PCI scope creep | Low | High | Never log card data; use Stripe Elements exclusively |

---

## 2. Product Overview

### Product Vision

CostFinders is a price transparency and lead generation platform for medical spas. The billing system serves business owners — the paying customers — and must feel frictionless while remaining fully auditable for the platform operator.

### Scope

This PRD covers:

1. Stripe subscription management (Free -> Pro upgrade, downgrade, cancel)
2. Lead credit purchase — one-time packages
3. Payment method management (add, remove, set default via Stripe Customer Portal)
4. Billing history — invoices and receipts synced from Stripe
5. Sponsored placement payments — one-time charges per boost
6. Proration on mid-cycle plan changes
7. Webhook handler for all relevant Stripe events
8. Admin billing overrides (comp credits, manual tier assignment)

Out of scope for this PRD:

- Enterprise tier (custom contracts, multi-location — separate PRD)
- Refund processing UI (handled in Stripe dashboard by support staff)
- Consumer-facing payments (consumers do not pay in v2)
- Tax calculation beyond Stripe Tax automatic mode

### Target Users

**Primary:** Business owners who have claimed their CostFinders listing and want to upgrade to Pro or purchase lead credits.

**Secondary:** Platform admins who need to grant complimentary access, override billing status, and view revenue metrics.

### Success Criteria

- Pro subscription can be purchased end-to-end without manual intervention
- Lead credit balance updates within 5 seconds of a confirmed payment
- Webhook handler processes 99.9% of Stripe events without errors
- Zero card numbers stored in Supabase or application logs
- Admin can comp a business and have it take effect immediately

---

## 3. Business Context & Revenue Model

### Pricing Structure (from existing mock data)

**Subscription Tiers**

| Tier | Monthly Price | Lead Cost | Deal Limit | Features |
|------|---------------|-----------|------------|----------|
| Free | $0 | $5.00/lead | 3 active | Basic listing, email notifications |
| Professional | $99/month | $3.00/lead | Unlimited | Featured placement, analytics, priority support, sponsored slots |
| Enterprise | Custom | Custom | Unlimited | Multi-location, dedicated CSM (future) |

**Lead Credit Packages** (one-time purchases, tier-specific pricing applies separately)

| Package ID | Credits | Price | Per-Lead | Savings |
|------------|---------|-------|----------|---------|
| pkg_10 | 10 | $45 | $4.50 | 10% |
| pkg_25 | 25 | $100 | $4.00 | 20% |
| pkg_50 | 50 | $175 | $3.50 | 30% |
| pkg_100 | 100 | $300 | $3.00 | 40% |

**Sponsorship / Boost Packages** (one-time, per deal)

| Boost ID | Duration | Price | Impression Multiplier |
|----------|----------|-------|-----------------------|
| boost-7 | 7 days | $29 | 2x |
| boost-14 | 14 days | $49 | 3x |
| boost-30 | 30 days | $99 | 5x (+ Featured badge) |

### Revenue Streams

1. **Subscription MRR** — recurring monthly charges for Pro tier
2. **Lead credit sales** — one-time purchases; credits do not expire within the billing year
3. **Sponsored placements** — one-time charges; most businesses purchase 1–3 boosts per month

### Platform Fees

The existing mock data models a 2.9% Stripe transaction fee and a 2% platform fee. Net revenue calculations should account for these. Stripe's standard rate is 2.9% + $0.30 per transaction; this should be confirmed against the actual Stripe account plan before go-live.

---

## 4. User Personas & Jobs-to-Be-Done

### Persona 1: Sarah — Med Spa Owner, Free Tier

**Context:** Has claimed her listing, receives occasional leads, getting 5–8 per month. Finding the $5/lead cost adds up.

**Job-to-be-done:** Upgrade to Pro so she pays $3/lead, saving $16–$24/month before accounting for the $99 fee. Break-even is 50 leads per month.

**Friction points to eliminate:**
- Do not redirect away to Stripe Hosted Invoice pages unless necessary
- Preserve card details so she does not re-enter on next purchase
- Show her exactly what she is paying before confirming

### Persona 2: Marcus — Active Pro Subscriber

**Context:** Runs 3 locations (single account for now). Buys lead credits monthly. Wants to boost deals ahead of seasonal promotions.

**Job-to-be-done:** Purchase a lead credit pack and a sponsored boost in under 2 minutes without leaving the business dashboard.

**Friction points to eliminate:**
- Do not force re-authentication with Stripe (use saved payment method)
- Show remaining credit balance immediately after purchase
- Confirm boost is live on his deal page

### Persona 3: Admin — Platform Operator

**Context:** Needs to onboard a high-value partnership business at no cost for 3 months, adjust tiers for billing disputes, and grant bonus credits to compensate for a platform bug.

**Job-to-be-done:** Override billing state without touching Stripe subscriptions for comped accounts; full audit trail of all manual changes.

**Friction points to eliminate:**
- Reason field required before any change persists
- Override should not create Stripe subscription objects for comped accounts
- All override history visible in the same UI panel

---

## 5. Functional Requirements

### 5.1 Stripe Customer Setup

**REQ-CUST-01:** When a business owner completes account creation (claim flow), the system must create a Stripe Customer object and store the resulting `stripe_customer_id` on the `business_owners` profile row in Supabase.

**REQ-CUST-02:** If a business owner already has a `stripe_customer_id`, the system must use the existing customer object rather than creating a duplicate.

**REQ-CUST-03:** The Stripe Customer's email and name must be kept in sync with the business owner's profile. When a business owner updates their email, a background sync must update the Stripe Customer record.

### 5.2 Subscription Management

**REQ-SUB-01 — Subscribe to Pro:**
A Free-tier business owner can upgrade to the Professional plan ($99/month). The flow uses Stripe Checkout Session in `subscription` mode. On successful payment, Stripe fires `checkout.session.completed` which the webhook handler uses to create/update the `subscriptions` table row and update the `business_owners.tier` field.

**REQ-SUB-02 — Upgrade mid-cycle:**
If the owner is already on a paid tier (Enterprise beta), upgrading to Pro via plan change uses `stripe.subscriptions.update` with `proration_behavior: 'create_prorations'`. Proration credit appears on their next invoice.

**REQ-SUB-03 — Downgrade to Free:**
Business owner can cancel their Pro subscription. Cancellation is deferred to end of current billing period: `cancel_at_period_end: true`. The subscription remains `active` in Stripe until the period ends; the UI shows "Cancels on [date]". At period end, `customer.subscription.deleted` fires and the tier reverts to `free`.

**REQ-SUB-04 — Immediate cancellation:**
Admin override only. Sets `cancel_at_period_end: false` and cancels immediately. Not exposed in the self-service UI.

**REQ-SUB-05 — Reactivate cancelled subscription:**
If a subscription is `cancel_at_period_end: true` but the period has not ended, the owner can reactivate. This calls `stripe.subscriptions.update({ cancel_at_period_end: false })`.

**REQ-SUB-06 — Subscription status gate:**
All Pro-tier features (analytics, unlimited deals, priority placement) must check `subscriptions.status = 'active'` at the server-action level, not just in the UI. A subscription in `past_due` or `canceled` state should degrade to Free-tier entitlements.

**REQ-SUB-07 — Stripe Customer Portal:**
A "Manage Billing" button on `/business/dashboard/settings/account` opens the Stripe Customer Portal (via a server action that creates a portal session). The portal handles: payment method changes, billing address updates, invoice download, and subscription cancellation as a secondary path.

### 5.3 Lead Credit Purchase

**REQ-LC-01 — One-time charge:**
Credit packages are purchased as one-time Stripe Payment Intents. Amount is determined server-side by looking up the canonical `lead_credit_packages` table row — not from client-submitted price.

**REQ-LC-02 — Credit balance update:**
On successful payment, the webhook handler for `payment_intent.succeeded` (with `metadata.type = 'lead_credits'`) must:
1. Record the payment in the `payments` table
2. Increment `business_owners.lead_credit_balance` by the package's `credits` field
3. Create an entry in `lead_credit_transactions` for the audit trail

**REQ-LC-03 — Package validation:**
The API must validate that the requested `package_id` exists in `lead_credit_packages` and is currently active. If invalid, return 400 with a descriptive error.

**REQ-LC-04 — Default payment method:**
If the business has a saved Stripe payment method (default), the lead purchase modal must offer a "Pay with [card ending in XXXX]" path that skips re-entering card details. New card entry opens Stripe Elements inline.

**REQ-LC-05 — Purchase confirmation:**
The `LeadPurchaseModal` confirm step must display: package name, credit count, total price, and the card being charged. No payment fires until the user clicks the primary confirm button.

### 5.4 Sponsored Placement Purchase

**REQ-SP-01 — One-time charge:**
Boost packages are purchased as Stripe Payment Intents with `metadata.type = 'sponsored_placement'`, `metadata.boost_option_id`, and `metadata.deal_id`.

**REQ-SP-02 — Eligibility check:**
Before creating a Payment Intent, the API must verify: (a) the deal is active and approved, (b) the deal does not already have an active boost. If either check fails, return 400.

**REQ-SP-03 — Boost activation:**
On `payment_intent.succeeded`, the webhook must create a row in `sponsored_placements` with start/end dates calculated from the boost option's duration and set the deal's `is_sponsored` flag to `true`.

**REQ-SP-04 — Boost expiry:**
A Vercel cron job (daily at 00:00 UTC) must query `sponsored_placements` where `end_date < NOW()` and `status = 'active'`, set them to `completed`, and clear the `is_sponsored` flag on the associated deal.

**REQ-SP-05 — Refund on deal removal:**
If a business removes a deal that has an active sponsored placement with more than 24 hours remaining, flag the placement for admin review. Do not auto-refund; support staff processes refund in Stripe dashboard.

### 5.5 Payment Method Management

**REQ-PM-01 — Add payment method:**
The "Add New" button on the Payment Methods card opens a Stripe Elements `CardElement` embedded within the existing `paymentMethods.tsx` component. On submission, the client calls `stripe.confirmCardSetup` with a `setup_intent_client_secret` obtained from the server. On success, the new payment method is attached to the Stripe Customer.

**REQ-PM-02 — List payment methods:**
Payment methods are fetched from Stripe via a server action (`stripe.customers.listPaymentMethods`) and returned to the client. Never stored in Supabase beyond `stripe_customer_id`.

**REQ-PM-03 — Set default:**
Setting a default calls the server action that invokes `stripe.customers.update({ invoice_settings: { default_payment_method: pmId } })`.

**REQ-PM-04 — Remove payment method:**
Calls `stripe.paymentMethods.detach(pmId)`. If the removed method was the default and others exist, Stripe automatically promotes the next method. If no methods remain and there is an active subscription, block removal and show: "You must have at least one payment method while subscribed."

**REQ-PM-05 — Security:**
Payment method IDs (`pm_xxx`) may be stored client-side for UI display but must never be used to initiate charges client-side. All charge initiation is server-only.

### 5.6 Billing History

**REQ-BH-01 — Invoice list:**
The `BillingHistory` component fetches from the `payments` table in Supabase (populated by webhook handler). Display: date, description, amount, status (paid/pending/failed), and a download link.

**REQ-BH-02 — Invoice PDF:**
The download link calls a server action that retrieves the Stripe Invoice PDF URL (`stripe.invoices.retrieve(invoiceId).invoice_pdf`) and returns a temporary redirect. For one-time charges (lead credits, boosts), the PDF is the Stripe receipt URL from the PaymentIntent's charge.

**REQ-BH-03 — Pagination:**
The billing history table must paginate at 20 rows per page. The `payments` table query uses cursor-based pagination ordered by `created_at DESC`.

**REQ-BH-04 — Failed payment banner:**
If any payment in the last 30 days has `status = 'failed'`, the existing `Warning` banner in `BillingHistory` must display. Clicking it should link to the Stripe Customer Portal for payment retry.

### 5.7 Proration on Plan Changes

**REQ-PROR-01:** Proration is handled entirely by Stripe. The platform must never compute prorated amounts independently.

**REQ-PROR-02:** When a downgrade is scheduled (`cancel_at_period_end: true`), no proration credit is issued. The subscription simply stops at period end.

**REQ-PROR-03:** When an upgrade occurs mid-cycle (future Enterprise -> Pro scenario), Stripe creates a proration line item on the next invoice. The `payments` table records the actual invoice amount charged, not the base plan amount.

**REQ-PROR-04:** The UI must display "You will be charged a prorated amount of approximately $X for the remainder of this billing period" before confirming an upgrade. This estimate is fetched from `stripe.invoices.retrieveUpcoming` and cached for the duration of the modal session.

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Checkout session creation | < 800ms p95 |
| Payment Intent creation | < 600ms p95 |
| Webhook handler response | < 200ms (Stripe requires response before processing) |
| Lead credit balance update post-payment | < 5 seconds end-to-end (webhook round-trip) |
| Billing history page load | < 1 second (Supabase query, 20 rows) |

### Security

- PCI DSS compliance: card data never touches the application server. Stripe Elements handles all card input in an iframe.
- Webhook endpoint must verify `stripe-signature` header using `stripe.webhooks.constructEvent`. Any request without a valid signature returns 400 immediately.
- All server actions that initiate charges must authenticate the calling user against the business they claim to represent. A business owner for business A cannot create a payment intent for business B.
- Stripe secret key (`STRIPE_SECRET_KEY`) must not be used in any client-side code. Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` client-side only.
- Admin billing override actions require admin session validation; business owner sessions must not be able to call override endpoints.

### Reliability

- Webhook events must be idempotent. Receiving the same event twice must not double-credit an account or create duplicate `payments` rows.
- Idempotency keys: use `stripe_payment_intent_id` or `stripe_invoice_id` as the natural idempotency key when upserting to the `payments` table.
- If the webhook handler fails after Stripe receives a 200 acknowledgement, the event is lost. Therefore, acknowledge (200) only after the Supabase write completes. If the Supabase write fails, return 500 so Stripe retries.
- Stripe retries failed webhook deliveries up to 72 hours with exponential backoff.

### Compliance

- Stripe handles PCI DSS for card storage and processing.
- Platform must retain payment records for 7 years (IRS requirement). The `payments` table must never hard-delete rows; use `deleted_at` soft delete if cleanup is needed.
- Invoices generated by Stripe must include business owner's name, address (if provided), and itemized line items.
- GDPR: on account deletion request, do not delete Stripe Customer records (needed for chargeback defense). Flag as `gdpr_deletion_requested = true` and anonymize PII in Supabase while retaining financial records.

---

## 7. Database Schema

### SQL Migrations

```sql
-- ============================================================
-- Migration: 001_billing_stripe_integration
-- Description: Core billing tables for Stripe integration
-- ============================================================

-- Enable UUID extension (already enabled in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. Extend business_owners with Stripe customer ID
-- ------------------------------------------------------------
-- Note: business_owners table already exists from auth/claim flow.
-- This adds Stripe-specific columns.

ALTER TABLE business_owners
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS lead_credit_balance      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_status           TEXT NOT NULL DEFAULT 'active'
    CHECK (billing_status IN ('active', 'suspended', 'comped')),
  ADD COLUMN IF NOT EXISTS tier                     TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'paid', 'enterprise')),
  ADD COLUMN IF NOT EXISTS custom_lead_price        NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS gdpr_deletion_requested  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_synced_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_business_owners_stripe_customer_id
  ON business_owners (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_owners_tier
  ON business_owners (tier);

-- ------------------------------------------------------------
-- 2. subscriptions
-- Tracks the lifecycle of Stripe subscription objects.
-- One row per Stripe subscription (a business may have at most
-- one active subscription at a time).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_owner_id         UUID NOT NULL REFERENCES business_owners(id) ON DELETE RESTRICT,
  stripe_subscription_id    TEXT NOT NULL UNIQUE,
  stripe_customer_id        TEXT NOT NULL,
  stripe_price_id           TEXT NOT NULL,
  tier                      TEXT NOT NULL CHECK (tier IN ('paid', 'enterprise')),
  status                    TEXT NOT NULL
    CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_start      TIMESTAMPTZ NOT NULL,
  current_period_end        TIMESTAMPTZ NOT NULL,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at               TIMESTAMPTZ,
  trial_start               TIMESTAMPTZ,
  trial_end                 TIMESTAMPTZ,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_owner_id
  ON subscriptions (business_owner_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON subscriptions (stripe_subscription_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- ------------------------------------------------------------
-- 3. payments
-- Immutable ledger of all payment events. One row per
-- Stripe charge, PaymentIntent completion, or invoice payment.
-- Never delete rows from this table.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_owner_id         UUID NOT NULL REFERENCES business_owners(id) ON DELETE RESTRICT,
  stripe_payment_intent_id  TEXT UNIQUE,          -- null for subscription invoices
  stripe_invoice_id         TEXT UNIQUE,           -- null for one-time charges
  stripe_charge_id          TEXT,
  amount                    INTEGER NOT NULL,       -- amount in cents (USD)
  currency                  TEXT NOT NULL DEFAULT 'usd',
  status                    TEXT NOT NULL
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  payment_type              TEXT NOT NULL
    CHECK (payment_type IN ('subscription', 'lead_credits', 'sponsored_placement')),
  description               TEXT,
  invoice_pdf_url           TEXT,
  receipt_url               TEXT,
  metadata                  JSONB,                 -- e.g., {package_id, credits, boost_option_id, deal_id}
  failure_code              TEXT,
  failure_message           TEXT,
  refunded_amount           INTEGER DEFAULT 0,     -- partial refund support
  deleted_at                TIMESTAMPTZ,           -- soft delete only
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_business_owner_id
  ON payments (business_owner_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (status);

CREATE INDEX IF NOT EXISTS idx_payments_payment_type
  ON payments (payment_type);

CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON payments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_invoice_id
  ON payments (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- ------------------------------------------------------------
-- 4. lead_credit_packages
-- Canonical list of purchasable credit packages.
-- Prices are stored here — never trusted from client.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lead_credit_packages (
  id                TEXT PRIMARY KEY,               -- e.g., 'pkg_10'
  credits           INTEGER NOT NULL,
  price_cents       INTEGER NOT NULL,               -- amount in cents
  price_per_lead_cents INTEGER NOT NULL,
  savings_percent   INTEGER NOT NULL DEFAULT 0,
  is_best_value     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_lead_credit_packages_updated_at
  BEFORE UPDATE ON lead_credit_packages
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- Seed from existing mock data
INSERT INTO lead_credit_packages (id, credits, price_cents, price_per_lead_cents, savings_percent, is_best_value, display_order)
VALUES
  ('pkg_10',  10,  4500,  450, 10, FALSE, 1),
  ('pkg_25',  25,  10000, 400, 20, FALSE, 2),
  ('pkg_50',  50,  17500, 350, 30, FALSE, 3),
  ('pkg_100', 100, 30000, 300, 40, TRUE,  4)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. lead_credit_transactions
-- Append-only log of every credit balance change.
-- Enables balance reconstruction and dispute resolution.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lead_credit_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_owner_id     UUID NOT NULL REFERENCES business_owners(id) ON DELETE RESTRICT,
  payment_id            UUID REFERENCES payments(id),  -- null for admin grants
  transaction_type      TEXT NOT NULL
    CHECK (transaction_type IN ('purchase', 'admin_grant', 'admin_deduct', 'lead_consumed', 'refund')),
  credits_delta         INTEGER NOT NULL,              -- positive = add, negative = consume
  balance_after         INTEGER NOT NULL,              -- snapshot for auditability
  note                  TEXT,
  created_by            UUID,                          -- null = system; populated for admin actions
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_credit_transactions_business_owner_id
  ON lead_credit_transactions (business_owner_id);

CREATE INDEX IF NOT EXISTS idx_lead_credit_transactions_created_at
  ON lead_credit_transactions (created_at DESC);

-- ------------------------------------------------------------
-- 6. sponsored_placements
-- Active and historical boost records tied to deals.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sponsored_placements (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_owner_id       UUID NOT NULL REFERENCES business_owners(id) ON DELETE RESTRICT,
  deal_id                 TEXT NOT NULL,               -- references deal identifier
  payment_id              UUID REFERENCES payments(id),
  boost_option_id         TEXT NOT NULL,               -- e.g., 'boost-30'
  boost_name              TEXT NOT NULL,
  duration_days           INTEGER NOT NULL,
  price_cents             INTEGER NOT NULL,
  impression_multiplier   NUMERIC(4,1) NOT NULL,
  has_featured_badge      BOOLEAN NOT NULL DEFAULT FALSE,
  start_date              TIMESTAMPTZ NOT NULL,
  end_date                TIMESTAMPTZ NOT NULL,
  impressions_delivered   INTEGER NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_payment', 'active', 'completed', 'cancelled', 'flagged_for_review')),
  cancelled_at            TIMESTAMPTZ,
  flagged_reason          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_deal_id
  ON sponsored_placements (deal_id);

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_status
  ON sponsored_placements (status);

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_end_date
  ON sponsored_placements (end_date)
  WHERE status = 'active';

CREATE TRIGGER set_sponsored_placements_updated_at
  BEFORE UPDATE ON sponsored_placements
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- ------------------------------------------------------------
-- 7. billing_overrides
-- Audit log of all admin-initiated billing changes.
-- Append-only. Never update or delete rows.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS billing_overrides (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_owner_id         UUID NOT NULL REFERENCES business_owners(id) ON DELETE RESTRICT,
  admin_id                  UUID NOT NULL,              -- references admins table
  previous_tier             TEXT,
  new_tier                  TEXT,
  previous_billing_status   TEXT,
  new_billing_status        TEXT,
  credits_granted           INTEGER,
  credits_deducted          INTEGER,
  custom_lead_price         NUMERIC(10, 2),
  reason                    TEXT NOT NULL,              -- required, not nullable
  stripe_action_taken       TEXT,                       -- description of any Stripe API call made
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_overrides_business_owner_id
  ON billing_overrides (business_owner_id);

CREATE INDEX IF NOT EXISTS idx_billing_overrides_created_at
  ON billing_overrides (created_at DESC);

-- ------------------------------------------------------------
-- 8. boost_options
-- Canonical sponsorship package definitions (admin-managed).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS boost_options (
  id                    TEXT PRIMARY KEY,              -- e.g., 'boost-7'
  name                  TEXT NOT NULL,
  duration_days         INTEGER NOT NULL,
  price_cents           INTEGER NOT NULL,
  impression_multiplier NUMERIC(4,1) NOT NULL,
  has_featured_badge    BOOLEAN NOT NULL DEFAULT FALSE,
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  display_order         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from existing mock data
INSERT INTO boost_options (id, name, duration_days, price_cents, impression_multiplier, has_featured_badge, description, display_order)
VALUES
  ('boost-7',  '7-Day Boost',       7,  2900, 2.0, FALSE, 'Double your deal visibility for a week',             1),
  ('boost-14', '14-Day Boost',      14, 4900, 3.0, FALSE, 'Triple impressions with extended reach',             2),
  ('boost-30', '30-Day Featured',   30, 9900, 5.0, TRUE,  '5x visibility plus featured badge placement',        3)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 9. Row Level Security policies
-- Business owners can only read their own billing data.
-- Admins have full read access.
-- Webhook handler uses service role key (bypasses RLS).
-- ------------------------------------------------------------

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_overrides ENABLE ROW LEVEL SECURITY;

-- Subscriptions: owner read-only
CREATE POLICY "business_owner_read_own_subscriptions"
  ON subscriptions FOR SELECT
  USING (business_owner_id = auth.uid());

-- Payments: owner read-only
CREATE POLICY "business_owner_read_own_payments"
  ON payments FOR SELECT
  USING (business_owner_id = auth.uid());

-- Lead credit transactions: owner read-only
CREATE POLICY "business_owner_read_own_credit_transactions"
  ON lead_credit_transactions FOR SELECT
  USING (business_owner_id = auth.uid());

-- Sponsored placements: owner read-only
CREATE POLICY "business_owner_read_own_sponsored_placements"
  ON sponsored_placements FOR SELECT
  USING (business_owner_id = auth.uid());

-- Billing overrides: owner read-only (own history only)
CREATE POLICY "business_owner_read_own_billing_overrides"
  ON billing_overrides FOR SELECT
  USING (business_owner_id = auth.uid());

-- Lead credit packages: public read (all authenticated users)
ALTER TABLE lead_credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_credit_packages"
  ON lead_credit_packages FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Boost options: public read (all authenticated users)
ALTER TABLE boost_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_boost_options"
  ON boost_options FOR SELECT
  TO authenticated
  USING (is_active = TRUE);
```

---

## 8. API Design

All API routes are Next.js Route Handlers located under `src/app/api/billing/`.

### 8.1 Route Structure

```
src/app/api/billing/
  checkout/
    route.ts              POST  Create Stripe Checkout Session (subscription)
  portal/
    route.ts              POST  Create Stripe Customer Portal Session
  payment-intent/
    route.ts              POST  Create Payment Intent (lead credits, sponsorship)
  setup-intent/
    route.ts              POST  Create SetupIntent for adding payment methods
  payment-methods/
    route.ts              GET   List saved payment methods
    [pmId]/
      route.ts            DELETE  Detach payment method
      default/
        route.ts          POST  Set as default payment method
  subscriptions/
    route.ts              GET   Get current subscription status
    cancel/
      route.ts            POST  Schedule cancellation at period end
    reactivate/
      route.ts            POST  Undo cancel_at_period_end
  upcoming-invoice/
    route.ts              GET   Preview upcoming invoice / proration estimate
  webhooks/
    route.ts              POST  Stripe webhook endpoint
  admin/
    override/
      route.ts            POST  Admin billing override
    credits/
      route.ts            POST  Admin grant/deduct credits
```

### 8.2 Endpoint Specifications

#### POST /api/billing/checkout

Creates a Stripe Checkout Session for subscription to the Professional plan.

**Request body:**
```typescript
{
  businessOwnerId: string   // validated against authenticated user
  priceId: string           // Stripe Price ID for Pro plan (from env var)
  successUrl: string        // must be on the CostFinders domain
  cancelUrl: string         // must be on the CostFinders domain
}
```

**Response:**
```typescript
{
  sessionId: string         // Stripe Checkout Session ID
  url: string               // redirect URL to Stripe Checkout
}
```

**Auth:** Requires authenticated business owner session. Validates that `businessOwnerId` matches the authenticated user's business.

**Error responses:**
- `400` — invalid priceId or URLs not on allowed domain
- `401` — not authenticated
- `403` — businessOwnerId does not match authenticated user
- `409` — business already has an active Pro subscription
- `500` — Stripe API error

---

#### POST /api/billing/payment-intent

Creates a Payment Intent for a one-time charge (lead credits or sponsored placement).

**Request body:**
```typescript
{
  type: 'lead_credits' | 'sponsored_placement'
  businessOwnerId: string

  // For lead_credits:
  packageId?: string        // validated against lead_credit_packages table

  // For sponsored_placement:
  boostOptionId?: string    // validated against boost_options table
  dealId?: string
}
```

**Response:**
```typescript
{
  clientSecret: string      // Payment Intent client secret for Stripe.js
  amount: number            // amount in cents (for display)
  paymentIntentId: string
}
```

**Server-side logic:**
1. Validate auth; confirm businessOwnerId matches session
2. Look up canonical price from DB (never trust client-submitted amount)
3. For sponsored_placement: verify deal is active, approved, and has no active boost
4. Retrieve or create Stripe Customer for this business owner
5. Create Payment Intent with metadata: `{ type, packageId|boostOptionId, dealId, businessOwnerId }`
6. Return `client_secret`

---

#### GET /api/billing/payment-methods

Returns saved payment methods for the authenticated business owner's Stripe Customer.

**Response:**
```typescript
{
  paymentMethods: Array<{
    id: string             // pm_xxx
    brand: string
    last4: string
    expMonth: number
    expYear: number
    isDefault: boolean
  }>
}
```

**Note:** This calls `stripe.customers.listPaymentMethods` on every request. Do not cache in Supabase; Stripe is the source of truth for payment methods.

---

#### POST /api/billing/portal

Creates a Stripe Customer Portal session for self-service billing management.

**Request body:**
```typescript
{
  returnUrl: string   // must be on CostFinders domain
}
```

**Response:**
```typescript
{
  url: string         // Redirect to Stripe Customer Portal
}
```

---

#### GET /api/billing/subscriptions

Returns the current subscription state for the authenticated business owner.

**Response:**
```typescript
{
  subscription: {
    id: string
    status: string
    tier: string
    currentPeriodEnd: string    // ISO date
    cancelAtPeriodEnd: boolean
    cancelAt: string | null
  } | null
}
```

---

#### POST /api/billing/webhooks

Stripe webhook endpoint. Verifies signature, routes to handler. Must respond within 5 seconds.

**Headers required:** `stripe-signature`

**Security:** Uses `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. The raw request body must be read as a Buffer — do not parse as JSON before signature verification.

---

#### POST /api/billing/admin/override

Admin-only endpoint for manual billing changes.

**Request body:**
```typescript
{
  businessOwnerId: string
  newTier?: 'free' | 'paid' | 'enterprise'
  newBillingStatus?: 'active' | 'suspended' | 'comped'
  creditsToGrant?: number
  creditsToDeduct?: number
  customLeadPrice?: number
  reason: string              // required, minimum 10 characters
}
```

**Auth:** Requires admin session. Returns `403` for non-admin callers.

---

## 9. Stripe Integration Architecture

### 9.1 Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...    # Stripe Price ID for $99/mo Pro plan

# Vercel (production) — set via Vercel dashboard, not committed to git
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

### 9.2 Stripe Product & Price Setup

Before development begins, create in the Stripe dashboard:

1. **Product:** "CostFinders Professional" — `prod_xxx`
2. **Price:** $99.00/month recurring, `interval: month` — `price_xxx` (store in `STRIPE_PRO_PRICE_ID`)
3. **Webhook endpoint:** `https://[vercel-domain]/api/billing/webhooks` — register all events listed in Section 10.

No Stripe Products are needed for lead credits or boosts; these use Payment Intents with descriptive metadata.

### 9.3 Stripe.js Client Initialization

```typescript
// src/lib/stripe-client.ts
import { loadStripe } from '@stripe/stripe-js'

let stripePromise: ReturnType<typeof loadStripe>

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}
```

### 9.4 Server-Side Stripe Client

```typescript
// src/lib/stripe-server.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
```

### 9.5 Customer Lifecycle

```
Business owner claims listing
        |
        v
POST /api/billing/checkout called for first time
        |
        v
Does stripe_customer_id exist on business_owners row?
   NO  → stripe.customers.create({ email, name, metadata: { businessOwnerId } })
         → store stripe_customer_id on business_owners row
   YES → use existing stripe_customer_id
        |
        v
Create Checkout Session / Payment Intent with customer: stripe_customer_id
```

### 9.6 Checkout Flow (Subscription)

```
1. User clicks "Upgrade to Pro" on /business/dashboard/pricing
2. Client calls POST /api/billing/checkout
3. Server creates Checkout Session → returns { url }
4. Client redirects to Stripe Checkout (stripe.redirectToCheckout OR window.location)
5. User completes payment on Stripe's hosted page
6. Stripe redirects to successUrl (/business/dashboard/pricing?session_id={CHECKOUT_SESSION_ID})
7. Stripe fires checkout.session.completed webhook
8. Webhook handler updates subscriptions table + business_owners.tier = 'paid'
9. User sees updated plan on return to dashboard
```

### 9.7 Payment Intent Flow (One-Time Charges)

```
1. User selects lead credit package or boost option
2. LeadPurchaseModal / SponsoredDealConfig confirms selection
3. Client calls POST /api/billing/payment-intent
4. Server creates PaymentIntent → returns { clientSecret, amount }
5. If user has saved payment method:
   a. Client calls stripe.confirmCardPayment(clientSecret, { payment_method: defaultPmId })
6. If no saved payment method:
   a. Stripe Elements CardElement renders inline
   b. Client calls stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } })
7. On success: stripe.confirmCardPayment resolves with paymentIntent.status = 'succeeded'
8. Client shows success state (optimistic update)
9. Stripe fires payment_intent.succeeded webhook
10. Webhook handler credits balance / activates boost
11. Page refetch confirms updated state
```

---

## 10. Webhook Event Handling

### 10.1 Registered Events

The webhook endpoint must be registered for these Stripe event types:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
invoice.finalized
payment_intent.succeeded
payment_intent.payment_failed
customer.updated
```

### 10.2 Handler Logic Per Event

#### `checkout.session.completed`

Fires when a Stripe Checkout Session completes (subscription purchase path).

```
1. Extract session.customer, session.subscription, session.metadata
2. Retrieve full subscription object from Stripe API
3. Upsert subscriptions table:
   - stripe_subscription_id = subscription.id
   - status = subscription.status
   - tier = 'paid'
   - current_period_start / current_period_end
4. Update business_owners:
   - tier = 'paid'
   - stripe_customer_id (if not already set)
5. Record in payments table if session.payment_status = 'paid'
```

---

#### `customer.subscription.updated`

Fires on any subscription change: status change, plan change, cancel_at_period_end toggle.

```
1. Retrieve subscription from event.data.object
2. Find subscriptions row by stripe_subscription_id
3. Update: status, current_period_start, current_period_end, cancel_at_period_end, canceled_at
4. If status transitions to 'canceled' or 'unpaid':
   - Update business_owners.tier = 'free'
   - Update business_owners.billing_status = 'active' (remove suspended state if it was payment-failure-related)
5. If cancel_at_period_end transitions FALSE → TRUE:
   - Note: no tier change yet; tier changes on subscription.deleted
```

---

#### `customer.subscription.deleted`

Fires when a subscription is fully canceled (at period end or immediately).

```
1. Find subscriptions row by stripe_subscription_id
2. Update: status = 'canceled', canceled_at
3. Update business_owners.tier = 'free'
4. Log in billing_overrides with reason = 'Subscription canceled via Stripe'
   and admin_id = SYSTEM_ADMIN_UUID (a reserved system actor UUID)
```

---

#### `invoice.payment_succeeded`

Fires for every successfully paid subscription invoice.

```
1. Extract invoice.customer, invoice.id, invoice.amount_paid, invoice.hosted_invoice_url, invoice.invoice_pdf
2. Upsert payments table:
   - stripe_invoice_id = invoice.id
   - amount = invoice.amount_paid (in cents)
   - status = 'succeeded'
   - payment_type = 'subscription'
   - description = invoice.lines.data[0].description (e.g., "Professional Plan")
   - invoice_pdf_url = invoice.invoice_pdf
3. Update subscriptions.current_period_start / current_period_end from subscription object
   (retrieve stripe.subscriptions.retrieve(invoice.subscription))
```

---

#### `invoice.payment_failed`

Fires when a subscription renewal payment fails.

```
1. Upsert payments table with status = 'failed', failure_code, failure_message
2. If invoice.attempt_count >= 3:
   - Consider setting business_owners.billing_status = 'suspended'
   - (Stripe will eventually set subscription to 'past_due' then 'canceled' per dunning settings)
3. Send notification email to business owner (via email service, outside Stripe)
   Note: email notification implementation is out of scope for this PRD
```

---

#### `payment_intent.succeeded`

Fires for completed one-time payments (lead credits, boosts).

```
1. Extract metadata: { type, businessOwnerId, packageId?, boostOptionId?, dealId? }
2. Idempotency check: if payments row with stripe_payment_intent_id already exists and status = 'succeeded', skip
3. Upsert payments table: status = 'succeeded', payment_type = metadata.type
4. If type = 'lead_credits':
   a. Retrieve package from lead_credit_packages where id = metadata.packageId
   b. Increment business_owners.lead_credit_balance += package.credits
   c. Insert lead_credit_transactions row: type = 'purchase', credits_delta = package.credits,
      balance_after = new balance
5. If type = 'sponsored_placement':
   a. Retrieve boost option from boost_options where id = metadata.boostOptionId
   b. Calculate start_date = NOW(), end_date = NOW() + boost.duration_days
   c. Create sponsored_placements row with status = 'active'
   d. Update deal's is_sponsored = true (if deal is stored in Supabase;
      if deals are in a separate table, update accordingly)
```

---

#### `payment_intent.payment_failed`

```
1. Upsert payments table with status = 'failed', failure_code, failure_message
2. If type = 'lead_credits': no balance change (idempotent)
3. If type = 'sponsored_placement': ensure sponsored_placements row remains in 'pending_payment' status
```

---

#### `invoice.finalized`

```
1. Update payments row: invoice_pdf_url from invoice.invoice_pdf
   (PDF URL is not always available at payment_succeeded time)
```

---

#### `customer.updated`

```
1. Update business_owners.stripe_synced_at = NOW()
   (Used to track sync health; no functional changes needed)
```

---

### 10.3 Webhook Handler Implementation Pattern

```typescript
// src/app/api/billing/webhooks/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: disable Next.js body parsing — we need the raw buffer
export const config = { api: { bodyParser: false } }

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Use service role key to bypass RLS for write operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, supabase)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase)
        break
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, supabase)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, supabase)
        break
      default:
        // Acknowledge but take no action for unregistered events
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // Return 500 so Stripe retries delivery
    console.error(`[webhook] handler error for ${event.type}`, err)
    return NextResponse.json(
      { error: 'Handler failed' },
      { status: 500 }
    )
  }
}
```

### 10.4 Idempotency Pattern

All webhook handlers that write to the `payments` table must use upsert with the Stripe ID as the conflict target:

```typescript
await supabase
  .from('payments')
  .upsert({
    stripe_payment_intent_id: paymentIntentId,
    status: 'succeeded',
    // ... other fields
  }, { onConflict: 'stripe_payment_intent_id' })
```

This ensures that if Stripe delivers the same event twice (it will), the second delivery is a no-op.

---

## 11. Frontend Integration Mapping

This section maps each existing UI component to the real Stripe integration it requires.

### 11.1 pricingTierCard.tsx

**Current behavior:** `onSelect` prop is a no-op callback.

**Real behavior:** When `tier = 'paid'` and `isCurrentTier = false`, clicking "Upgrade Now" must:
1. Call POST /api/billing/checkout
2. Receive the checkout session URL
3. Redirect the browser to Stripe Checkout

**Props change required:** `onSelect` receives the upgrade flow result; no structural change to the component. The parent page (`/business/dashboard/pricing`) handles the API call and redirect.

**Loading state:** Disable the "Upgrade Now" button and show spinner while the API call is in flight.

---

### 11.2 mockPaymentForm.tsx

**Current behavior:** A fully custom card input form with manual card number formatting, brand detection, and submit. Does not call any payment API.

**Real behavior (migration path):** This component must be replaced with Stripe Elements. The visual design can be preserved by using Stripe's `appearance` API to match the Bold & Warm design system tokens, or by using individual Stripe Elements (`CardNumberElement`, `CardExpiryElement`, `CardCvcElement`) mounted inside the existing form layout.

**Recommended approach:** Mount Stripe Elements within the existing form structure. The cardholder name, country, state, and ZIP fields remain as custom inputs since Stripe's billing_details accept them separately. Only card number, expiry, and CVC are handled by Stripe Elements.

**Component rename:** Rename to `StripePaymentForm` or `CardPaymentForm`. The "mock" in the name must not survive to production.

**Props change required:**
```typescript
interface CardPaymentFormProps {
  clientSecret: string     // Payment Intent or SetupIntent client secret
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  amount?: number          // display only
  planName?: string        // display only
  isLoading?: boolean
}
```

---

### 11.3 paymentMethods.tsx

**Current behavior:** Receives static mock `PaymentMethod[]` array. `onAddMethod`, `onRemoveMethod`, `onSetDefault` are no-op props.

**Real behavior:**
- On mount, calls GET /api/billing/payment-methods and populates state
- `onAddMethod` opens a modal containing a Stripe Elements `CardElement` backed by a SetupIntent
- `onRemoveMethod` calls DELETE /api/billing/payment-methods/[pmId]
- `onSetDefault` calls POST /api/billing/payment-methods/[pmId]/default

**Data source change:** Remove `PaymentMethod[]` prop. Component owns its own data fetching via `useEffect` + SWR or React Query. The `PaymentMethod` type comes from the server response, not `@/lib/mock-data/billing`.

---

### 11.4 billingHistory.tsx

**Current behavior:** Receives static mock `Invoice[]` array.

**Real behavior:**
- Parent page fetches from Supabase: `SELECT * FROM payments WHERE business_owner_id = ? ORDER BY created_at DESC LIMIT 20`
- `onDownload` calls GET /api/billing/payment-methods — wait, it calls a server action that returns the `invoice_pdf_url` or `receipt_url` from the `payments` row, then opens it in a new tab
- `Invoice` type extended with `paymentType` and `receiptUrl`

**Migration:** The `Invoice` interface in `billing.ts` mock data closely matches the needed shape. The real type should be derived from the `payments` table schema.

---

### 11.5 leadPurchaseModal.tsx

**Current behavior:** `handlePurchase` calls `purchaseCredits(selectedPackage.id)` from mock data with a simulated 1500ms delay.

**Real behavior:**
1. On modal open, if no saved payment method → mount Stripe Elements
2. On "Pay $X.XX" click → call POST /api/billing/payment-intent with `{ type: 'lead_credits', packageId }`
3. Receive `clientSecret`
4. Call `stripe.confirmCardPayment(clientSecret, ...)` with saved or new card
5. On success: set state to 'success', show new balance (optimistic: currentBalance + credits)
6. Webhook handler eventually confirms and sets authoritative balance
7. On next page load, balance from Supabase overrides optimistic value

**The 'processing' state** already exists in the component and maps naturally to the payment confirmation in-flight period.

---

### 11.6 sponsoredDealConfig.tsx

**Current behavior:** `onBoostSelect(selectedBoostId)` triggers nothing real.

**Real behavior:**
1. "Start Boost" button click calls POST /api/billing/payment-intent with `{ type: 'sponsored_placement', boostOptionId, dealId }`
2. If saved payment method exists: confirm immediately using default PM
3. If no saved PM: open payment form modal
4. On success: show confirmation, redirect to `/business/dashboard/deals/sponsored`

---

### 11.7 businessBillingOverride.tsx (Admin)

**Current behavior:** `handleSave` calls `createBillingOverride()` from mock data after a simulated 500ms delay.

**Real behavior:**
1. POST /api/billing/admin/override
2. Server validates admin session
3. Server applies changes to `business_owners` table (tier, billing_status, lead_credit_balance)
4. If new tier = 'paid' and no active Stripe subscription, a `billing_overrides` row is created with `stripe_action_taken = 'none - admin override bypassed Stripe'`
5. If new billing_status = 'suspended' and there IS an active Stripe subscription, server cancels it immediately in Stripe
6. Server inserts `billing_overrides` audit row
7. Response includes updated business state

---

### 11.8 pricingHubHeader.tsx

**Current behavior:** `onUpgrade` is a no-op callback.

**Real behavior:** Same as pricingTierCard — calls POST /api/billing/checkout and redirects to Stripe.

---

## 12. Admin Billing Override System

### 12.1 Override Types

| Override Type | Stripe Action Required | Supabase Change |
|---------------|------------------------|-----------------|
| Tier: free → paid (comp) | None (bypass) | `business_owners.tier = 'paid'`, `billing_status = 'comped'` |
| Tier: paid → free | Cancel active subscription if exists | `business_owners.tier = 'free'` |
| Billing status: active → suspended | Cancel active subscription if exists | `business_owners.billing_status = 'suspended'` |
| Billing status: suspended → active | None | `business_owners.billing_status = 'active'` |
| Billing status: active → comped | Cancel active subscription | `business_owners.billing_status = 'comped'` |
| Grant credits | None | `business_owners.lead_credit_balance += n` |
| Deduct credits | None | `business_owners.lead_credit_balance -= n` (floor at 0) |
| Custom lead price | None | `business_owners.custom_lead_price = n` |

### 12.2 Comp Accounts

A comped account has `billing_status = 'comped'` and `tier = 'paid'`. The business receives all Pro features at no charge. No Stripe subscription exists for comped accounts.

The system must check `billing_status = 'comped'` when gating features, not just `tier = 'paid'`. A comped account has full feature access. A `billing_status = 'suspended'` account has no feature access regardless of tier.

### 12.3 Audit Trail Requirements

Every row in `billing_overrides` must capture:
- `admin_id` (the UUID of the admin who made the change)
- `reason` (minimum 10 characters, cannot be whitespace-only)
- `previous_tier` and `new_tier` (even if unchanged, for complete diff)
- `previous_billing_status` and `new_billing_status` (even if unchanged)
- `stripe_action_taken` (describe any Stripe API call, or 'none')
- `created_at` (server-set timestamp, not client-provided)

The `billing_overrides` table must never have UPDATE or DELETE policies. Corrections are made by creating new override rows, not editing old ones.

---

## 13. Edge Cases & Error Handling

### 13.1 Checkout Session Edge Cases

| Scenario | Behavior |
|----------|----------|
| User abandons Stripe Checkout | Session expires after 24h; no charge; user returns to cancelUrl |
| User opens two checkout tabs simultaneously | Second session creation returns the same client secret if within 10 minutes (implement deduplication via `client_reference_id`). If session already completed, return 409 from the API. |
| User's card is declined | Stripe Checkout handles decline messaging. User can retry with another card. No action needed on our side. |
| Business already has active Pro subscription | API returns 409 with message "You already have an active Professional subscription." |
| Stripe Checkout URL has expired when user clicks | Stripe returns an error page. Handle by showing "Your session expired, please try again" on the return URL. |

### 13.2 Webhook Edge Cases

| Scenario | Behavior |
|----------|----------|
| Webhook delivered out of order (updated before created) | Use upsert on `subscriptions` table. The `updated_at` column will reflect the latest write. |
| Webhook delivery duplicate | Idempotency key on upsert prevents double-crediting. |
| Webhook handler times out | Return 500 so Stripe retries. Do not acknowledge (200) before all DB writes complete. |
| Supabase connection failure during webhook | Return 500 (retry). Log error to observability platform. Alert if failure rate > 1% over 5 minutes. |
| `payment_intent.succeeded` fires but business owner no longer exists | Log error, skip credit/boost creation, do not refund automatically. Flag for admin review. |
| `customer.subscription.deleted` fires for a comped account | Should not happen (comped accounts have no Stripe subscription). If it does, ignore. |

### 13.3 Payment Method Edge Cases

| Scenario | Behavior |
|----------|----------|
| Attempt to remove last payment method with active subscription | Return 400: "You must have at least one payment method while subscribed." |
| Payment method expires mid-subscription | Stripe dunning handles retry with decline codes. Invoice moves to `past_due`. `invoice.payment_failed` webhook fires. |
| SetupIntent confirmation fails (3DS challenge abandoned) | Return to payment methods page with error toast. SetupIntent can be retried. |
| Stripe Customer Portal removes all payment methods | If subscription is active, Stripe will prevent this. Nothing additional needed. |

### 13.4 Lead Credit Edge Cases

| Scenario | Behavior |
|----------|----------|
| Balance goes negative (race condition on lead claim) | Never go below zero. `lead_credit_balance` has a floor constraint. If a lead is claimed when balance = 0, the claim still proceeds (this is a product decision: do not block lead delivery for billing reasons) but a low-balance notification is triggered. |
| Concurrent purchases of the same package | Payment Intents are independent; both will succeed. Both will credit balance. This is intentional. |
| Package ID in metadata refers to deactivated package | Webhook handler looks up by ID; deactivated packages remain in DB. Credit the amount for the `credits` field on that row. |
| Refund of lead credit purchase | Processed manually in Stripe dashboard. Webhook `charge.refunded` fires. Handler updates `payments.status = 'refunded'` and decrements balance by `refunded_amount / package.price_cents * package.credits` (approximate; support staff must verify). |

### 13.5 Sponsorship Edge Cases

| Scenario | Behavior |
|----------|----------|
| Payment succeeds but deal is deleted before webhook arrives | Skip sponsored_placements creation. Log warning. No refund automatically triggered. |
| Two simultaneous purchase attempts for the same deal | API eligibility check prevents this. First POST creates a Payment Intent and sets `pending_payment` row in sponsored_placements. Second POST returns 409. |
| Cron job misses expiry (Vercel cron failure) | Boosts appear active longer than paid for. Hourly health check: count boosts with `end_date < NOW() AND status = 'active'`; alert if > 0. |
| Business cancels deal during active boost with > 24h remaining | Flag `sponsored_placements.status = 'flagged_for_review'`. Admin adjudicates refund. |

### 13.6 Proration Edge Cases

| Scenario | Behavior |
|----------|----------|
| Upgrade preview fetch fails | Show "Unable to calculate proration estimate" message with a "Proceed anyway" option. Do not block the upgrade. |
| Proration invoice amount differs from preview | Expected. The preview is an estimate. Show actual charge in the next invoice. |
| Downgrade (Pro → Free) proration | No proration credit issued. Subscription cancels at period end. This is by design. |

---

## 14. Security & Compliance

### 14.1 PCI DSS

- Card numbers, CVCs, and expiry dates are never processed by application code.
- Stripe Elements renders in an isolated iframe. Card data is sent directly to Stripe's servers.
- The application receives only tokenized payment method IDs (`pm_xxx`).
- Do not log `clientSecret` values. They can be used to complete a payment and must be treated as sensitive.
- Do not log raw Stripe webhook payloads that may contain customer PII. Log only event type and relevant IDs.

### 14.2 Authentication Boundaries

| Action | Required Session |
|--------|-----------------|
| Create checkout session | Business owner, must own the business |
| Create payment intent | Business owner, must own the business |
| List payment methods | Business owner, own customer only |
| Remove payment method | Business owner, own methods only |
| View billing history | Business owner, own payments only |
| Admin override | Admin session (separate auth flow) |
| Webhook handler | No session (Stripe signature verification only) |

### 14.3 Server Action Validation Pattern

Every server action or API route that touches billing must:

1. Validate the JWT from the Supabase session cookie
2. Look up `business_owner_id` from the session
3. Confirm the requested resource (business, payment, subscription) belongs to that `business_owner_id`
4. Only then call the Stripe API

Never derive `businessOwnerId` from a client-submitted body parameter without cross-referencing the authenticated session.

### 14.4 Data Retention

- `payments` table: retain indefinitely (soft delete only)
- `billing_overrides` table: retain indefinitely (no delete policy)
- `lead_credit_transactions` table: retain indefinitely
- `subscriptions` table: retain all rows including canceled
- Stripe Customer records: do not delete on user request (maintain for chargeback defense); anonymize PII in Supabase on GDPR deletion request

---

## 15. Acceptance Criteria

### AC-01: Pro Subscription Purchase

```
Given a business owner with tier = 'free' and a valid Stripe test card
When they click "Upgrade to Pro" and complete the Stripe Checkout flow
Then:
  - The Stripe subscription is created with status = 'active'
  - The subscriptions table row reflects status = 'active' and tier = 'paid'
  - business_owners.tier = 'paid'
  - A payments row exists with payment_type = 'subscription' and status = 'succeeded'
  - The /business/dashboard/pricing page shows "Professional plan — Active"
  - The entire flow completes in under 60 seconds
```

### AC-02: Subscription Cancellation

```
Given a business owner with an active Pro subscription
When they navigate to Stripe Customer Portal and cancel
Then:
  - subscriptions.cancel_at_period_end = true
  - business_owners.tier remains 'paid' until period end
  - After the period end date, business_owners.tier = 'free'
  - The billing hub shows "Cancels on [date]"
```

### AC-03: Lead Credit Purchase (Saved Card)

```
Given a business owner with a saved default payment method and current balance of 15 credits
When they purchase the pkg_25 package (25 credits, $100)
Then:
  - A Payment Intent is created for $100 (10000 cents)
  - Payment is confirmed against the saved default card
  - A payments row exists with status = 'succeeded' and payment_type = 'lead_credits'
  - business_owners.lead_credit_balance = 40
  - A lead_credit_transactions row exists with credits_delta = 25 and balance_after = 40
  - The balance updates within 5 seconds of payment confirmation
```

### AC-04: Lead Credit Purchase (New Card)

```
Given a business owner with no saved payment methods
When they select a credit package and enter a valid test card in the Stripe Elements form
Then:
  - The payment succeeds
  - The new card is NOT automatically saved (setup_future_usage = 'off_session' only if user opts in)
  - All balance and transaction records match AC-03
```

### AC-05: Sponsored Boost Purchase

```
Given an active, approved deal with no current boost
When a business owner purchases the boost-30 option ($99)
Then:
  - A Payment Intent for $99 is created and confirmed
  - A sponsored_placements row is created with status = 'active'
  - start_date = NOW() and end_date = NOW() + 30 days
  - deal.is_sponsored = true
  - The deal appears with a "Sponsored" badge in listings
```

### AC-06: Duplicate Boost Prevention

```
Given a deal with an active boost
When a business owner attempts to purchase another boost for the same deal
Then:
  - POST /api/billing/payment-intent returns 400
  - Error message: "This deal already has an active sponsored placement."
  - No Payment Intent is created
```

### AC-07: Webhook Idempotency

```
Given a payment_intent.succeeded event for a lead credit purchase
When the webhook handler processes the same event ID twice
Then:
  - The payments table contains exactly one row for that stripe_payment_intent_id
  - business_owners.lead_credit_balance is incremented exactly once
  - The second delivery is silently acknowledged (200) without error
```

### AC-08: Admin Billing Override — Comp

```
Given a business with tier = 'free'
When an admin sets tier = 'paid', billing_status = 'comped' with reason "Partnership promo Q1"
Then:
  - business_owners.tier = 'paid'
  - business_owners.billing_status = 'comped'
  - No Stripe subscription is created
  - A billing_overrides row is created with the reason and admin_id
  - The business has access to all Pro features
  - The "Manage Billing" portal link is hidden for comped accounts (no Stripe Customer Portal needed)
```

### AC-09: Admin Credit Grant

```
Given a business owner with lead_credit_balance = 5
When an admin grants 50 bonus credits with reason "Platform bug compensation"
Then:
  - business_owners.lead_credit_balance = 55
  - A lead_credit_transactions row exists with transaction_type = 'admin_grant', credits_delta = 50
  - A billing_overrides row records the action
```

### AC-10: Payment Method Management

```
Given a business owner with two saved payment methods (Visa default, Mastercard secondary)
When they remove the Visa (default) card
Then:
  - The Visa is detached from the Stripe Customer
  - The Mastercard automatically becomes the new default
  - The payment methods list reflects this without a page reload
  - An active subscription continues charging against the Mastercard on next cycle
```

### AC-11: Failed Payment Handling

```
Given a business owner whose subscription renewal charge fails
When the invoice.payment_failed webhook is received
Then:
  - A payments row exists with status = 'failed' and failure_code
  - The BillingHistory component shows the "Payment failed" warning banner
  - The subscription status reflects Stripe's dunning state (past_due)
  - The business owner's tier is NOT immediately downgraded (dunning period applies)
```

### AC-12: Webhook Signature Rejection

```
Given a POST request to /api/billing/webhooks with an invalid or missing stripe-signature header
Then:
  - The handler returns 400
  - No database writes occur
  - The request is logged with caller IP for security monitoring
```

### AC-13: Proration Preview

```
Given a business owner on the Pro plan mid-cycle
When they initiate an upgrade (future: Pro -> Enterprise) flow
Then:
  - The upgrade confirmation screen shows the prorated charge estimate
  - The estimate is fetched from stripe.invoices.retrieveUpcoming
  - If the fetch fails, a fallback message is shown without blocking the upgrade
```

### AC-14: Billing History Pagination

```
Given a business owner with 45 payment records
When they load the billing history page
Then:
  - The first 20 records are displayed
  - A "Load more" or pagination control is visible
  - Clicking it loads records 21–40
  - The third page loads records 41–45
  - The download link for each record opens the correct Stripe PDF
```

---

## 16. Implementation Roadmap

### Phase 1 — Foundation (Sprint 1)

**Goal:** Stripe account setup, database migration, basic infrastructure.

| Task | Estimated Effort |
|------|-----------------|
| Create Stripe account, products, and prices | 0.5 days |
| Write and run database migrations | 1 day |
| Implement `src/lib/stripe-server.ts` and `src/lib/stripe-client.ts` | 0.5 days |
| Set up environment variables on Vercel | 0.5 days |
| Implement webhook handler skeleton with signature verification | 1 day |
| Test webhook locally with Stripe CLI (`stripe listen --forward-to localhost:3000/api/billing/webhooks`) | 0.5 days |

---

### Phase 2 — Subscription Flow (Sprint 2)

**Goal:** Business owners can subscribe to Pro via Stripe Checkout.

| Task | Estimated Effort |
|------|-----------------|
| POST /api/billing/checkout | 1 day |
| POST /api/billing/portal | 0.5 days |
| GET /api/billing/subscriptions | 0.5 days |
| POST /api/billing/subscriptions/cancel | 0.5 days |
| POST /api/billing/subscriptions/reactivate | 0.5 days |
| Webhook: checkout.session.completed | 1 day |
| Webhook: customer.subscription.updated + deleted | 1 day |
| Webhook: invoice.payment_succeeded + failed | 1 day |
| Wire pricingTierCard.tsx and pricingHubHeader.tsx to real API | 1 day |
| End-to-end test: subscribe, cancel, reactivate | 1 day |

---

### Phase 3 — One-Time Payments (Sprint 3)

**Goal:** Lead credits and sponsored boosts work end-to-end.

| Task | Estimated Effort |
|------|-----------------|
| POST /api/billing/payment-intent | 1 day |
| POST /api/billing/setup-intent | 0.5 days |
| GET /api/billing/payment-methods | 0.5 days |
| DELETE /api/billing/payment-methods/[pmId] | 0.5 days |
| POST /api/billing/payment-methods/[pmId]/default | 0.5 days |
| Replace mockPaymentForm.tsx with Stripe Elements | 1.5 days |
| Wire paymentMethods.tsx to real API | 1 day |
| Wire leadPurchaseModal.tsx to payment intent flow | 1 day |
| Wire sponsoredDealConfig.tsx to payment intent flow | 1 day |
| Webhook: payment_intent.succeeded (credits + boosts) | 1 day |
| Webhook: payment_intent.payment_failed | 0.5 days |
| End-to-end test: buy credits, buy boost, verify balance | 1 day |

---

### Phase 4 — Billing History & Admin (Sprint 4)

**Goal:** Complete billing history, admin overrides go live.

| Task | Estimated Effort |
|------|-----------------|
| Wire billingHistory.tsx to Supabase payments table | 1 day |
| Invoice PDF download server action | 0.5 days |
| Billing history pagination | 0.5 days |
| POST /api/billing/admin/override | 1 day |
| POST /api/billing/admin/credits | 0.5 days |
| Wire businessBillingOverride.tsx to real API | 1 day |
| Vercel cron job for boost expiry | 0.5 days |
| RLS policy testing and hardening | 1 day |
| Full end-to-end payment flow QA in Stripe test mode | 1.5 days |

---

### Phase 5 — Go-Live Preparation

| Task | Estimated Effort |
|------|-----------------|
| Switch to Stripe live mode keys on Vercel | 0.5 days |
| Verify webhook is registered in live mode | 0.5 days |
| Run smoke test with real $1 charge | 0.5 days |
| Monitor Stripe dashboard and webhook logs for first 48h | Ongoing |

**Total estimated engineering effort:** 8–10 sprints of focused backend/frontend work. Can be parallelized with two engineers after Phase 1.

---

## 17. Open Questions

| # | Question | Owner | Resolution Needed By |
|---|----------|-------|----------------------|
| 1 | Should lead credits expire? Current mock data has no expiry. If yes, what is the policy? | Product | Before Phase 3 |
| 2 | Is the $99/month Pro price confirmed, or is annual billing ($79/month, billed $948/year) planned? This affects Stripe price objects. | Product | Before Phase 2 |
| 3 | Should the payment failure dunning escalation (past_due → suspended) happen after 2 retries or 3? Stripe's default dunning is configurable in the dashboard. | Product + Finance | Before Phase 2 |
| 4 | For GDPR deletion requests, does the 7-year financial record retention override the deletion request, or should we consult legal on the interaction? | Legal | Before go-live |
| 5 | Do comped accounts receive complimentary lead credits on a recurring basis, or just Pro feature access? The current admin UI allows one-time credit grants but no recurring grant schedule. | Product | Before Phase 4 |
| 6 | Should sponsored placements offer a refund policy (e.g., pro-rated refund if cancelled before end date)? This affects REQ-SP-05 and admin tooling scope. | Product | Before Phase 3 |
| 7 | Is the Vercel project on a plan that supports cron jobs? The boost expiry job (REQ-SP-04) requires Vercel Cron, which is available on Pro and above. | Engineering | Before Phase 3 |
| 8 | Will the deals system use Supabase for deal storage, or remain in mock data? REQ-SP-03 assumes a writable `deals` table to set `is_sponsored`. | Engineering | Before Phase 3 |
| 9 | Should the billing history show lead credit transaction line items (individual lead claims) or only purchases? Current design shows only purchases. | Product | Before Phase 4 |
| 10 | The platform fee (2%) from `platformSettings.ts` — is this an internal accounting figure or is it added to the prices shown to customers? Clarification affects whether `calculateEffectivePrice` needs to be surfaced in the UI. | Finance | Before Phase 2 |

---

*This PRD is a living document. Update the version number and date when functional requirements change. All schema changes require a new numbered migration file. Acceptance criteria must be re-validated after each schema migration.*
