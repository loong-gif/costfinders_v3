# PRD-05: Business Operations & Deal Management

**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-20
**Author:** Product
**Reviewers:** Engineering, Design, Admin Operations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Context & Background](#3-context--background)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Schema](#6-database-schema)
7. [API Design](#7-api-design)
8. [Frontend Integration Mapping](#8-frontend-integration-mapping)
9. [Image Upload Strategy](#9-image-upload-strategy)
10. [Deal Source Unification](#10-deal-source-unification)
11. [Edge Cases & Failure Modes](#11-edge-cases--failure-modes)
12. [User Stories & Acceptance Criteria](#12-user-stories--acceptance-criteria)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

### Problem Statement

CostFinders v1.0 shipped a complete UI for business deal management, business profile editing, sponsored placements, and analytics. All of this runs on in-memory mock data that resets on every page refresh. The platform also holds 347 scraped promotional offers in `promo_offer_master` that consumers can browse but businesses cannot manage or interact with.

There is no database table for business-created deals. There is no persistence layer for profile edits. Moderation decisions survive only until the next hard reload. No analytics data is real.

This PRD specifies the backend integration work required to make the business operations surface functional and production-ready.

### Solution Overview

Introduce a `business_deals` table as the authoritative store for business-authored deals, entirely separate from the read-only scraped `promo_offer_master`. Build Supabase-backed Server Actions and API routes to replace all mock data functions in `src/lib/mock-data/deals.ts`, `src/lib/mock-data/businesses.ts`, and `src/lib/mock-data/sponsorship.ts`. Implement deal image uploads through Supabase Storage or Cloudinary. Surface real analytics events from deal interactions.

The consumer-facing deal display continues to merge both sources seamlessly — scraped offers from `promo_offer_master` and business-authored deals from `business_deals` — with a unified normalized shape.

### Business Impact

| Metric | Current | Target (90 days post-launch) |
|--------|---------|------------------------------|
| Business-authored deals in system | 0 | 200+ |
| Profile completeness rate | N/A | 70% of claimed businesses |
| Moderation queue persistence | Session only | Permanent |
| Sponsored placement revenue | $0 (UI only) | First paid placements active |
| Analytics data freshness | Static mock | Real-time |

### Resource Requirements

- 1 backend engineer (primary): 5–6 weeks
- 1 frontend engineer (integration): 2–3 weeks (parallel after schema is stable)
- 1 QA engineer: 1 week final validation
- Supabase project already provisioned (`kdlpkjzcnbkjcvwsvlwn`)
- Cloudinary or Supabase Storage account (image uploads)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Schema migration breaks existing scraped data queries | Medium | High | Schema changes are additive only; `promo_offer_master` untouched |
| Image upload size abuse | Medium | Medium | 5MB per file limit enforced server-side + Supabase Storage policies |
| Moderation queue backlog at launch | High | Medium | Pre-seed admin workflow; set SLA of 48h review |
| Sponsored payment integration complexity | Low | Low | Phase 1 records intent only; Stripe wired in Phase 2 |
| RLS misconfiguration allowing cross-business data access | Low | Critical | All tables tested with multiple business accounts before launch |

---

## 2. Product Overview

### Product Vision

Enable medical spa owners who have claimed their CostFinders profile to publish and manage their own promotional deals, maintain accurate business information, and optionally pay for featured placement — all within the existing business dashboard UI with zero frontend rewrites required.

### Target Users

**Primary: Business Owner / Operator**
A medspa owner or their front-desk manager who has claimed a CostFinders business profile. They know their current promotions, understand their pricing, and need to get those deals in front of local consumers quickly. They are not technical. They expect the interface to work the same way their other business software works: save it and it stays saved.

**Secondary: Platform Admin**
A CostFinders staff member who reviews deal submissions before they go live, monitors sponsored placement activity, and occasionally needs to override deal or profile data.

### Value Proposition

For business owners: deals they create stay live until they choose to pause or expire them, their profile information reflects their actual business, and they can see real numbers behind how their deals are performing.

For the platform: business-created deals supplement the scraped offer inventory with richer, verified content. Moderated deals maintain content quality. Sponsored placements create the first direct revenue stream from businesses.

### Success Criteria

- A business owner can create a deal, submit it for review, and see it go live on the consumer-facing app after admin approval — all within one session.
- A deal edit by a business owner does not disrupt the consumer-facing display of that deal until the edit is re-approved.
- Profile changes saved by a business owner are visible to consumers within 60 seconds.
- An admin can work through the entire moderation queue without a page refresh losing their work.
- Sponsored placement records are persisted when a business selects a boost package.

### Assumptions

- The existing Supabase project (`kdlpkjzcnbkjcvwsvlwn`) will host all new tables.
- Business authentication is handled by Supabase Auth; the business owner's `auth.uid()` maps to a `business_owners` junction that links to `master_business_info.business_id`.
- The frontend team will swap mock data imports for Server Actions without redesigning any UI components — the existing `DealForm`, `DealList`, `BusinessProfileForm`, `SponsoredDealConfig`, `DealModerationCard`, and `AnalyticsDashboard` components ship as-is.
- Image hosting will use Supabase Storage in Phase 1 (already included in the Supabase project); Cloudinary migration is deferred to Phase 2 if needed for transformation capabilities.
- Payment processing for sponsored placements (Stripe) is out of scope for Phase 1; placement records are created but billing is manual.

---

## 3. Context & Background

### Two Deal Sources — The Core Distinction

CostFinders operates a dual-source deal model. This is the most important architectural constraint in this PRD.

**Source A: Scraped Deals (`promo_offer_master`)**
347 rows. Populated by an offline data pipeline that reads business websites, Instagram, and Facebook. These are read-only from the application's perspective. The app must never INSERT, UPDATE, or DELETE rows in this table. Column names do not match the frontend `Deal` type — a normalization layer is required when displaying them.

**Source B: Business-Authored Deals (`business_deals` — new table)**
Zero rows today. These are deals that a business owner creates directly through the CostFinders dashboard. Full CRUD. Go through a moderation workflow before appearing to consumers. Column names are designed to match the frontend `Deal` TypeScript interface directly, minimizing normalization overhead.

On consumer-facing pages, both sources must appear in a single unified feed. The consumer should have no indication which source a deal came from. The merge happens at the data-access layer, not in UI components.

### Existing Mock Data Functions Being Replaced

The following functions in `src/lib/mock-data/deals.ts` have direct Server Action equivalents specified in this PRD:

| Mock function | Replacement |
|---------------|-------------|
| `createDeal()` | `createBusinessDeal()` Server Action |
| `updateDeal()` | `updateBusinessDeal()` Server Action |
| `deleteDeal()` | `deleteBusinessDeal()` Server Action |
| `toggleDealStatus()` | `toggleBusinessDealStatus()` Server Action |
| `getDealsForBusiness()` | Supabase query in Server Component or `getBusinessDeals()` Server Action |
| `updateDealModeration()` | `moderateDeal()` Server Action (admin only) |
| `getAllDeals()` | `getAllDealsForModeration()` Server Action (admin only) |

The following functions in `src/lib/mock-data/sponsorship.ts` are replaced:

| Mock function | Replacement |
|---------------|-------------|
| `createBoost()` | `createSponsoredPlacement()` Server Action |
| `cancelBoost()` | `cancelSponsoredPlacement()` Server Action |
| `getActiveBoosts()` | Supabase query |
| `getBoostHistory()` | Supabase query |

The following function in `src/lib/mock-data/businesses.ts` is replaced:

| Mock function | Replacement |
|---------------|-------------|
| `updateBusiness()` | `updateBusinessProfile()` Server Action |

### Existing TypeScript Types

The frontend `Deal` type (from `src/types/deal.ts`) drives the column design of `business_deals`. Key fields and their database equivalents:

```
Deal.id                  → business_deals.id (uuid)
Deal.businessId          → business_deals.business_id (bigint FK → master_business_info)
Deal.title               → business_deals.title (text)
Deal.description         → business_deals.description (text)
Deal.category            → business_deals.category (text, enum constraint)
Deal.originalPrice       → business_deals.original_price (numeric)
Deal.dealPrice           → business_deals.deal_price (numeric)
Deal.discountPercent     → business_deals.discount_percent (integer, computed)
Deal.unit                → business_deals.unit (text)
Deal.minUnits            → business_deals.min_units (integer, nullable)
Deal.maxUnits            → business_deals.max_units (integer, nullable)
Deal.validFrom           → business_deals.valid_from (timestamptz)
Deal.validUntil          → business_deals.valid_until (timestamptz)
Deal.termsAndConditions  → business_deals.terms_and_conditions (text)
Deal.imageUrl            → derived from deal_images table (primary image)
Deal.isActive            → business_deals.is_active (boolean)
Deal.isFeatured          → business_deals.is_featured (boolean)
Deal.isSponsored         → derived from sponsored_placements (active row exists)
Deal.claimCount          → business_deals.claim_count (integer, denormalized counter)
Deal.viewCount           → business_deals.view_count (integer, denormalized counter)
Deal.moderationStatus    → business_deals.moderation_status (text, enum constraint)
Deal.moderationNotes     → business_deals.moderation_notes (text, nullable)
```

The `ModerationStatus` union type maps directly:

```
'pending_review'     → moderation_status = 'pending_review'
'approved'           → moderation_status = 'approved'
'rejected'           → moderation_status = 'rejected'
'changes_requested'  → moderation_status = 'changes_requested'
```

---

## 4. Functional Requirements

### 4.1 Business Deal CRUD

**FR-001: Create Deal**
A business owner can create a new deal with the following fields: title, description, treatment category, original price, deal price, pricing unit, minimum units (optional), maximum units (optional), valid from date, valid until date, terms and conditions, and up to 5 images.

Upon creation, the deal is assigned `moderation_status = 'pending_review'` and `is_active = false`. It is not visible to consumers until an admin approves it.

The frontend `DealForm` component already collects all required fields. The only integration change is replacing the `createDeal()` import from `src/lib/mock-data/deals` with a Server Action call.

**FR-002: Edit Deal**
A business owner can edit any field on a deal they own. When a previously-approved deal is edited, it transitions back to `moderation_status = 'pending_review'` and `is_active = false`, removing it from consumer visibility until re-approved.

Exception: editing only `is_active` (pause/resume) does not trigger re-moderation if the deal is already in `approved` status.

**FR-003: Pause and Resume Deal**
A business owner can toggle a deal between `is_active = true` and `is_active = false` without re-triggering moderation, provided the deal is in `approved` status. A paused deal is hidden from consumers immediately. Resuming makes it visible immediately.

**FR-004: Delete Deal**
A business owner can permanently delete a deal they own. Soft-delete is preferred: set `deleted_at = now()` rather than removing the row. This preserves analytics history and allows admin audit. Deleted deals are excluded from all consumer and business queries via a standard `WHERE deleted_at IS NULL` clause.

**FR-005: Expire Deal**
Deals with `valid_until < now()` are automatically treated as expired in all queries. A background job (Supabase pg_cron or an edge function on a schedule) sets `is_active = false` on expired deals nightly. The business dashboard reflects the expired status without requiring manual intervention.

### 4.2 Deal Submission and Moderation

**FR-006: Moderation Queue**
All deals with `moderation_status = 'pending_review'` appear in the admin moderation queue at `/admin/dashboard/deals`. The queue persists across sessions. The existing `DealModerationCard` component (approve / request changes / reject) drives the moderation UI with no changes to the component itself.

**FR-007: Approve Deal**
An admin approves a pending deal. The deal transitions to `moderation_status = 'approved'` and `is_active = true`. The business owner's dashboard reflects the new status on next load.

**FR-008: Reject Deal**
An admin rejects a pending deal. The deal transitions to `moderation_status = 'rejected'` and remains `is_active = false`. No notification to the business owner in Phase 1 (notification system is out of scope).

**FR-009: Request Changes**
An admin requests changes with a written note. The deal transitions to `moderation_status = 'changes_requested'` and the note is stored in `moderation_notes`. The business owner sees this note in their deal list (the `DealModerationCard` already renders `deal.moderationNotes`). The business owner can then edit the deal and resubmit, which sets status back to `pending_review` and clears the note.

**FR-010: Moderation History**
Each status transition is appended to a `deal_moderation_log` table with the admin's user ID, timestamp, new status, and any notes. This log is not exposed in the current UI but is required for audit and future dispute resolution.

### 4.3 Business Profile Management

**FR-011: Edit Business Profile**
A business owner can edit: business name, description, address, city, state, zip code, location area, phone, email, website URL, logo image, and cover image.

Profile changes take effect immediately for consumer-facing pages (no moderation required). This follows the v1.0 behavior in `businessProfileForm.tsx` where `updateBusiness()` is called directly.

**FR-012: Profile Images**
Logo and cover image are uploaded files, not URLs typed manually. The `businessProfileForm.tsx` currently accepts a URL string. This field behavior must change: the input becomes a file picker that uploads to Supabase Storage (bucket: `business-images`) and stores the resulting public URL in the database. The existing URL-string preview logic in the form can remain as a fallback for businesses with externally-hosted images.

**FR-013: Business Hours (Future)**
The current `Business` type does not include operating hours. This PRD does not add hours to Phase 1. A `business_hours` table is noted in the schema for Phase 2.

### 4.4 Sponsored Placements

**FR-014: Select Boost Package**
A business owner can select a boost package (7-day at $29, 14-day at $49, 30-day Featured at $99) for any approved and active deal. The existing boost options in `src/lib/mock-data/sponsorship.ts` match what will be stored in the `boost_packages` reference table.

**FR-015: Create Placement Record**
When a business owner confirms a boost, a row is inserted into `sponsored_placements` with `status = 'pending_payment'`. In Phase 1, an admin manually confirms payment and transitions status to `active`. In Phase 2, Stripe Checkout handles this transition automatically.

**FR-016: Active Boost Display**
The `DealList` component calls `isDealEligibleForSponsorship()` and `getActiveBoostForDeal()` to control the boost button visibility and the "Boosted" badge. These functions will query `sponsored_placements` via Supabase instead of the in-memory array.

**FR-017: Cancel Boost**
A business owner can cancel an active boost before it expires. The placement record transitions to `status = 'cancelled'`. No refund logic in Phase 1.

**FR-018: Boost History**
The sponsored deals page at `/business/dashboard/deals/sponsored` displays past placements from the `sponsored_placements` table filtered by `status IN ('completed', 'cancelled')`.

### 4.5 Deal Analytics

**FR-019: View Count Tracking**
When a consumer views a deal detail page for a `business_deals` deal, an event is recorded. The `view_count` column on `business_deals` is incremented via a Supabase database function to avoid race conditions. Scraped deals (`promo_offer_master`) do not have view tracking in Phase 1.

**FR-020: Claim Count Tracking**
When a consumer claims a deal (submits the `claimDealModal`), the `claim_count` on `business_deals` is incremented and a row is inserted into `deal_claims`. This links the deal, the consumer, and the timestamp.

**FR-021: Analytics Dashboard Data**
The `AnalyticsDashboard` component currently renders hardcoded mock metrics. In Phase 1, it will query real `view_count` and `claim_count` from `business_deals` aggregated per business. Time-series charts and trend computation are deferred to Phase 2.

**FR-022: Conversion Rate**
Conversion rate is computed client-side as `(claim_count / view_count) * 100`. No server-side computation required.

### 4.6 Deal Image Management

**FR-023: Upload Deal Images**
When creating or editing a deal, a business owner can upload up to 5 images. Each image is stored in Supabase Storage under `deal-images/{deal_id}/{filename}`. The public URL is stored in the `deal_images` table. The first image (by `sort_order = 0`) is used as the deal's primary display image, populating `Deal.imageUrl` in the normalized shape.

**FR-024: Delete Deal Image**
A business owner can remove any image from a deal during editing. The file is deleted from Supabase Storage and the `deal_images` row is removed.

**FR-025: Image URL in DealForm**
The current `DealForm` has a plain URL text input for `imageUrl`. This input is replaced with a file upload control. The uploaded image URL is passed back to the form state as the resolved Supabase Storage URL. The existing form validation and preview logic does not change — it still receives a URL string.

---

## 5. Non-Functional Requirements

### Performance

**NFR-001:** Deal list for a business owner (`/business/dashboard/deals`) must load within 1.5 seconds on a standard connection. Queries are scoped to the authenticated business — no full-table scans.

**NFR-002:** Consumer deal feed (merging `promo_offer_master` + `business_deals`) must return results within 800ms at p95 for a city with up to 100 total deals. Both tables require indexed queries on `city` or `business_id`.

**NFR-003:** Deal view count increment must be non-blocking — the consumer's page renders before the increment completes. Use a fire-and-forget Server Action or background API route call.

### Security

**NFR-004:** Row Level Security (RLS) must be enabled on all new tables. A business owner can only SELECT, INSERT, UPDATE, and DELETE rows where `business_id` matches their linked business. No business can access another business's deals, placements, or images.

**NFR-005:** Admin-only operations (approve, reject, request changes, view all moderation queue) must be gated by an admin role check in both RLS policies and the Server Action layer. A non-admin authenticated user calling a moderation Server Action must receive a 403.

**NFR-006:** Image uploads must validate MIME type server-side (allowed: `image/jpeg`, `image/png`, `image/webp`) and enforce a 5MB maximum file size. Client-side validation is also applied but is not the security boundary.

**NFR-007:** The `promo_offer_master` table must have an explicit RLS policy granting only SELECT to authenticated and anon roles. INSERT, UPDATE, and DELETE must be denied to all application roles.

### Reliability

**NFR-008:** Deal create and update operations are atomic. If the image upload succeeds but the database insert fails, the orphaned Storage file must be cleaned up. Implement a rollback pattern: insert deal record first, then upload images referencing the deal ID, then insert `deal_images` rows.

**NFR-009:** The moderation log (`deal_moderation_log`) writes must succeed even if the main deal status update fails. Use a Postgres trigger on `business_deals` that fires after any `moderation_status` change, rather than relying on application-level inserts.

### Usability

**NFR-010:** When a business owner submits a deal and it enters pending review, the UI shows a clear "Pending Review" status in the deal list immediately. The owner does not need to refresh to see the status change — the Server Action response updates the local state.

**NFR-011:** The moderation queue in admin is sortable by submission date and filterable by status. These are already implemented in the admin UI; the requirement is that the Supabase query supports `ORDER BY created_at` and `WHERE moderation_status = ?`.

### Compliance

**NFR-012:** Deal content containing pricing information must display in US dollars. The database stores prices as `numeric(10, 2)` to avoid floating-point precision issues with currency.

**NFR-013:** Business owner actions (create, update, delete, moderation status changes) must be attributable to an authenticated user for audit purposes. The `created_by` and `updated_by` columns reference `auth.uid()`.

---

## 6. Database Schema

### 6.1 New Tables

```sql
-- ============================================================
-- business_deals
-- Business-authored deals. Separate from promo_offer_master.
-- Full CRUD with moderation workflow.
-- ============================================================
CREATE TABLE business_deals (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         bigint          NOT NULL
                                        REFERENCES master_business_info(business_id)
                                        ON DELETE CASCADE,
  -- Core deal content
  title               text            NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description         text            NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  category            text            NOT NULL
                                        CHECK (category IN (
                                          'botox', 'fillers', 'facials',
                                          'laser', 'body', 'skincare'
                                        )),
  -- Pricing
  original_price      numeric(10, 2)  NOT NULL CHECK (original_price > 0),
  deal_price          numeric(10, 2)  NOT NULL CHECK (deal_price > 0),
  discount_percent    integer         NOT NULL
                                        GENERATED ALWAYS AS (
                                          ROUND(((original_price - deal_price) / original_price) * 100)::integer
                                        ) STORED,
  unit                text            NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 40),
  min_units           integer         CHECK (min_units > 0),
  max_units           integer         CHECK (max_units > 0),
  -- Validity
  valid_from          timestamptz     NOT NULL,
  valid_until         timestamptz     NOT NULL CHECK (valid_until > valid_from),
  -- Content
  terms_and_conditions text           NOT NULL CHECK (char_length(terms_and_conditions) BETWEEN 5 AND 500),
  -- State flags
  is_active           boolean         NOT NULL DEFAULT false,
  is_featured         boolean         NOT NULL DEFAULT false,
  -- Moderation
  moderation_status   text            NOT NULL DEFAULT 'pending_review'
                                        CHECK (moderation_status IN (
                                          'pending_review', 'approved',
                                          'rejected', 'changes_requested'
                                        )),
  moderation_notes    text,
  moderated_by        uuid            REFERENCES auth.users(id),
  moderated_at        timestamptz,
  -- Analytics counters (denormalized for read performance)
  view_count          integer         NOT NULL DEFAULT 0,
  claim_count         integer         NOT NULL DEFAULT 0,
  -- Soft delete
  deleted_at          timestamptz,
  -- Audit
  created_by          uuid            NOT NULL REFERENCES auth.users(id),
  updated_by          uuid            NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  -- Constraints
  CONSTRAINT deal_price_less_than_original CHECK (deal_price < original_price),
  CONSTRAINT max_units_gte_min_units CHECK (
    max_units IS NULL OR min_units IS NULL OR max_units >= min_units
  )
);

-- Index for business dashboard queries (most frequent read path)
CREATE INDEX idx_business_deals_business_id
  ON business_deals(business_id)
  WHERE deleted_at IS NULL;

-- Index for admin moderation queue
CREATE INDEX idx_business_deals_moderation_status
  ON business_deals(moderation_status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index for consumer feed queries (active + approved deals by category)
CREATE INDEX idx_business_deals_consumer_feed
  ON business_deals(category, is_active, moderation_status)
  WHERE deleted_at IS NULL AND is_active = true AND moderation_status = 'approved';

-- Trigger: auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_business_deals_updated_at
  BEFORE UPDATE ON business_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- deal_images
-- Up to 5 images per business_deals row.
-- Primary image is sort_order = 0.
-- ============================================================
CREATE TABLE deal_images (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid        NOT NULL REFERENCES business_deals(id) ON DELETE CASCADE,
  storage_path text       NOT NULL,           -- Supabase Storage object path
  public_url  text        NOT NULL,           -- CDN-accessible URL
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT max_images_per_deal UNIQUE (deal_id, sort_order),
  CONSTRAINT sort_order_range CHECK (sort_order BETWEEN 0 AND 4)
);

CREATE INDEX idx_deal_images_deal_id ON deal_images(deal_id);


-- ============================================================
-- boost_packages
-- Reference table. Replaces the hardcoded array in
-- src/lib/mock-data/sponsorship.ts.
-- Seed data matches the three existing mock boost options.
-- ============================================================
CREATE TABLE boost_packages (
  id                    text    PRIMARY KEY,    -- 'boost-7', 'boost-14', 'boost-30'
  name                  text    NOT NULL,
  duration_days         integer NOT NULL,
  price_cents           integer NOT NULL,
  impression_multiplier numeric(3, 1) NOT NULL,
  has_featured_badge    boolean NOT NULL DEFAULT false,
  description           text    NOT NULL,
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 0
);

INSERT INTO boost_packages
  (id, name, duration_days, price_cents, impression_multiplier, has_featured_badge, description, sort_order)
VALUES
  ('boost-7',  '7-Day Boost',     7,  2900, 2.0, false, 'Double your deal visibility for a week',              1),
  ('boost-14', '14-Day Boost',    14, 4900, 3.0, false, 'Triple impressions with extended reach',              2),
  ('boost-30', '30-Day Featured', 30, 9900, 5.0, true,  '5x visibility plus featured badge placement',         3);


-- ============================================================
-- sponsored_placements
-- One active placement per deal at a time.
-- Phase 1: status managed manually by admin.
-- Phase 2: automated via Stripe webhook.
-- ============================================================
CREATE TABLE sponsored_placements (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               uuid        NOT NULL REFERENCES business_deals(id) ON DELETE CASCADE,
  business_id           bigint      NOT NULL REFERENCES master_business_info(business_id),
  boost_package_id      text        NOT NULL REFERENCES boost_packages(id),
  status                text        NOT NULL DEFAULT 'pending_payment'
                                      CHECK (status IN (
                                        'pending_payment', 'active',
                                        'completed', 'cancelled'
                                      )),
  -- Dates
  starts_at             timestamptz,
  ends_at               timestamptz,
  -- Billing (Phase 1: manual; Phase 2: Stripe)
  amount_cents          integer     NOT NULL,
  stripe_payment_intent_id text,
  -- Performance
  impressions_delivered integer     NOT NULL DEFAULT 0,
  -- Audit
  created_by            uuid        NOT NULL REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- One active placement per deal at a time
  CONSTRAINT one_active_placement_per_deal UNIQUE (deal_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- Note: The UNIQUE constraint on (deal_id, status) is a partial enforcement.
-- A trigger enforces the true business rule: only one row where
-- status = 'active' per deal_id.

CREATE OR REPLACE FUNCTION enforce_single_active_placement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF EXISTS (
      SELECT 1 FROM sponsored_placements
      WHERE deal_id = NEW.deal_id
        AND status = 'active'
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Deal % already has an active placement', NEW.deal_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_single_active_placement
  BEFORE INSERT OR UPDATE ON sponsored_placements
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_placement();

CREATE INDEX idx_sponsored_placements_deal_id
  ON sponsored_placements(deal_id)
  WHERE status = 'active';

CREATE INDEX idx_sponsored_placements_business_id
  ON sponsored_placements(business_id);

CREATE TRIGGER set_sponsored_placements_updated_at
  BEFORE UPDATE ON sponsored_placements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- deal_moderation_log
-- Immutable append-only audit trail for all moderation actions.
-- Written by a trigger on business_deals, never by application code.
-- ============================================================
CREATE TABLE deal_moderation_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid        NOT NULL REFERENCES business_deals(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text        NOT NULL,
  notes           text,
  actioned_by     uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_moderation_log_deal_id ON deal_moderation_log(deal_id);

-- Trigger: write log entry on every moderation_status change
CREATE OR REPLACE FUNCTION log_moderation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.moderation_status IS DISTINCT FROM NEW.moderation_status THEN
    INSERT INTO deal_moderation_log
      (deal_id, from_status, to_status, notes, actioned_by)
    VALUES (
      NEW.id,
      OLD.moderation_status,
      NEW.moderation_status,
      NEW.moderation_notes,
      NEW.moderated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_moderation_change
  AFTER UPDATE ON business_deals
  FOR EACH ROW EXECUTE FUNCTION log_moderation_status_change();


-- ============================================================
-- deal_claims
-- One row per consumer claim event. Powers claim_count counter
-- and future lead management integration.
-- ============================================================
CREATE TABLE deal_claims (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid        NOT NULL REFERENCES business_deals(id) ON DELETE CASCADE,
  business_id     bigint      NOT NULL REFERENCES master_business_info(business_id),
  consumer_id     uuid        NOT NULL REFERENCES auth.users(id),
  status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending', 'contacted', 'booked', 'completed', 'cancelled'
                                )),
  preferred_time  text,                   -- free-text from claimDealModal
  consumer_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_active_claim_per_consumer_per_deal
    UNIQUE (deal_id, consumer_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_deal_claims_deal_id     ON deal_claims(deal_id);
CREATE INDEX idx_deal_claims_business_id ON deal_claims(business_id);
CREATE INDEX idx_deal_claims_consumer_id ON deal_claims(consumer_id);

-- Trigger: increment claim_count on business_deals when a claim is inserted
CREATE OR REPLACE FUNCTION increment_claim_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE business_deals
  SET claim_count = claim_count + 1
  WHERE id = NEW.deal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_deal_claimed
  AFTER INSERT ON deal_claims
  FOR EACH ROW EXECUTE FUNCTION increment_claim_count();
```

### 6.2 View Count Increment Function

```sql
-- Function called by Server Action to increment view count.
-- Uses advisory lock to avoid lost updates under concurrent views.
CREATE OR REPLACE FUNCTION increment_deal_view(p_deal_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE business_deals
  SET view_count = view_count + 1
  WHERE id = p_deal_id
    AND deleted_at IS NULL
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.3 Consumer Feed Merge View

```sql
-- Unified view merging scraped offers and business deals.
-- Consumers query this view; source column is NOT exposed to frontend.
-- Column names match the normalized shape consumed by deal cards.
CREATE VIEW unified_deals AS

  -- Source A: scraped offers from promo_offer_master
  SELECT
    'scraped_' || p.id::text          AS id,
    p.business_id                     AS business_id,
    COALESCE(p.service_name, 'Deal')  AS title,
    COALESCE(p.offer_raw_text, '')    AS description,
    CASE p.service_category
      WHEN 'Neurotoxins'                  THEN 'botox'
      WHEN 'Fillers & Other Injectables'  THEN 'fillers'
      WHEN 'Facials & Lasers Services'    THEN 'facials'
      ELSE 'skincare'
    END                               AS category,
    COALESCE(p.original_price, 0)     AS original_price,
    COALESCE(p.discount_price, 0)     AS deal_price,
    COALESCE(p.discount_percent, 0)   AS discount_percent,
    COALESCE(p.unit_type, 'per unit') AS unit,
    p.min_unit::integer               AS min_units,
    NULL::integer                     AS max_units,
    COALESCE(p.start_date::timestamptz, now()) AS valid_from,
    COALESCE(p.end_date::timestamptz, now() + interval '1 year') AS valid_until,
    COALESCE(p.eligibility, '')       AS terms_and_conditions,
    NULL                              AS image_url,
    true                              AS is_active,
    false                             AS is_featured,
    false                             AS is_sponsored,
    0                                 AS view_count,
    0                                 AS claim_count,
    'approved'                        AS moderation_status,
    p.created_at,
    p.created_at                      AS updated_at,
    'scraped'                         AS deal_source
  FROM promo_offer_master p

UNION ALL

  -- Source B: business-authored deals
  SELECT
    d.id::text                        AS id,
    d.business_id,
    d.title,
    d.description,
    d.category,
    d.original_price,
    d.deal_price,
    d.discount_percent,
    d.unit,
    d.min_units,
    d.max_units,
    d.valid_from,
    d.valid_until,
    d.terms_and_conditions,
    (SELECT public_url FROM deal_images
     WHERE deal_id = d.id AND sort_order = 0
     LIMIT 1)                         AS image_url,
    d.is_active,
    d.is_featured,
    EXISTS (
      SELECT 1 FROM sponsored_placements sp
      WHERE sp.deal_id = d.id AND sp.status = 'active'
    )                                 AS is_sponsored,
    d.view_count,
    d.claim_count,
    d.moderation_status,
    d.created_at,
    d.updated_at,
    'business'                        AS deal_source
  FROM business_deals d
  WHERE d.deleted_at IS NULL
    AND d.is_active = true
    AND d.moderation_status = 'approved';
```

### 6.4 Row Level Security Policies

```sql
-- business_deals: owners can manage their own deals; admins can manage all
ALTER TABLE business_deals ENABLE ROW LEVEL SECURITY;

-- Business owners SELECT their own deals (all statuses, including pending/deleted)
CREATE POLICY "business_owner_select_own_deals"
  ON business_deals FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_owner_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Business owners INSERT new deals for their business
CREATE POLICY "business_owner_insert_deals"
  ON business_deals FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_owner_profiles
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Business owners UPDATE their own deals (not moderation fields)
-- Moderation fields are controlled by a separate admin policy
CREATE POLICY "business_owner_update_own_deals"
  ON business_deals FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM business_owner_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Cannot self-approve
    moderation_status NOT IN ('approved')
    OR OLD.moderation_status = 'approved'  -- allow editing non-moderation fields when approved
  );

-- Admins have full access (requires is_admin() helper function)
CREATE POLICY "admin_full_access_deals"
  ON business_deals FOR ALL
  USING ( (SELECT is_admin()) );

-- Consumers can SELECT only active + approved deals (for unified feed)
CREATE POLICY "consumer_select_active_deals"
  ON business_deals FOR SELECT
  USING (
    is_active = true
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
  );


-- deal_images: owners can manage; consumers can read via public URL
ALTER TABLE deal_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_manage_deal_images"
  ON deal_images FOR ALL
  USING (
    deal_id IN (
      SELECT id FROM business_deals
      WHERE business_id IN (
        SELECT business_id FROM business_owner_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "admin_full_access_images"
  ON deal_images FOR ALL
  USING ( (SELECT is_admin()) );


-- sponsored_placements: owners manage their own placements
ALTER TABLE sponsored_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_manage_placements"
  ON sponsored_placements FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM business_owner_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admin_full_access_placements"
  ON sponsored_placements FOR ALL
  USING ( (SELECT is_admin()) );


-- deal_moderation_log: read-only for owners; admins have full access
ALTER TABLE deal_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_moderation_log"
  ON deal_moderation_log FOR SELECT
  USING (
    deal_id IN (
      SELECT id FROM business_deals
      WHERE business_id IN (
        SELECT business_id FROM business_owner_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "admin_full_access_moderation_log"
  ON deal_moderation_log FOR ALL
  USING ( (SELECT is_admin()) );


-- deal_claims: owners see claims for their deals; consumers see their own
ALTER TABLE deal_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_select_claims"
  ON deal_claims FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_owner_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "consumer_manage_own_claims"
  ON deal_claims FOR ALL
  USING ( consumer_id = auth.uid() );

CREATE POLICY "admin_full_access_claims"
  ON deal_claims FOR ALL
  USING ( (SELECT is_admin()) );


-- promo_offer_master: read-only for all application roles
-- (This policy should already exist; adding for completeness)
ALTER TABLE promo_offer_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_only_scraped_offers"
  ON promo_offer_master FOR SELECT
  USING (true);
-- No INSERT, UPDATE, or DELETE policies on promo_offer_master.
```

### 6.5 Supporting Table: business_owner_profiles

This table is required by the RLS policies above. It links a Supabase Auth `uid` to a `master_business_info.business_id`. It may already exist under a different name depending on what the authentication team has built. If not, create it:

```sql
CREATE TABLE business_owner_profiles (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id  bigint  NOT NULL REFERENCES master_business_info(business_id),
  role         text    NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id)
);

ALTER TABLE business_owner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_profile"
  ON business_owner_profiles FOR SELECT
  USING ( user_id = auth.uid() );
```

---

## 7. API Design

All write operations use Next.js Server Actions (`'use server'`). Read operations in Server Components use the Supabase server client directly. The Server Actions replace the mock data functions currently imported in the UI components.

### 7.1 File Structure

```
src/lib/actions/
  deals.ts            -- Business deal CRUD + moderation
  profile.ts          -- Business profile updates
  sponsorship.ts      -- Sponsored placement management
  analytics.ts        -- View/claim event recording
src/lib/data/
  deals.ts            -- Server-side read functions (not Server Actions)
  businesses.ts       -- Business profile reads
```

### 7.2 Deal Server Actions (`src/lib/actions/deals.ts`)

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import type { Deal, ModerationStatus, TreatmentCategory } from '@/types/deal'

// ---- Create Deal ----
export type CreateDealInput = {
  businessId: number
  title: string
  description: string
  category: TreatmentCategory
  originalPrice: number
  dealPrice: number
  unit: string
  minUnits?: number
  maxUnits?: number
  validFrom: string    // ISO date string YYYY-MM-DD
  validUntil: string   // ISO date string YYYY-MM-DD
  termsAndConditions: string
  isFeatured: boolean
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createBusinessDeal(
  input: CreateDealInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const { data, error } = await supabase
    .from('business_deals')
    .insert({
      business_id:           input.businessId,
      title:                 input.title,
      description:           input.description,
      category:              input.category,
      original_price:        input.originalPrice,
      deal_price:            input.dealPrice,
      unit:                  input.unit,
      min_units:             input.minUnits ?? null,
      max_units:             input.maxUnits ?? null,
      valid_from:            `${input.validFrom}T00:00:00Z`,
      valid_until:           `${input.validUntil}T23:59:59Z`,
      terms_and_conditions:  input.termsAndConditions,
      is_featured:           input.isFeatured,
      is_active:             false,
      moderation_status:     'pending_review',
      created_by:            user.id,
      updated_by:            user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals')
  return { success: true, data: { id: data.id } }
}

// ---- Update Deal ----
export type UpdateDealInput = Partial<CreateDealInput> & { id: string }

export async function updateBusinessDeal(
  input: UpdateDealInput,
): Promise<ActionResult> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  // Editing a previously-approved deal sends it back for moderation
  const { data: existing } = await supabase
    .from('business_deals')
    .select('moderation_status, is_active')
    .eq('id', input.id)
    .single()

  const requiresRemoderation =
    existing?.moderation_status === 'approved' && input.id

  const { error } = await supabase
    .from('business_deals')
    .update({
      ...(input.title          && { title: input.title }),
      ...(input.description    && { description: input.description }),
      ...(input.category       && { category: input.category }),
      ...(input.originalPrice  && { original_price: input.originalPrice }),
      ...(input.dealPrice      && { deal_price: input.dealPrice }),
      ...(input.unit           && { unit: input.unit }),
      ...(input.validFrom      && { valid_from: `${input.validFrom}T00:00:00Z` }),
      ...(input.validUntil     && { valid_until: `${input.validUntil}T23:59:59Z` }),
      ...(input.termsAndConditions && { terms_and_conditions: input.termsAndConditions }),
      ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
      ...(requiresRemoderation && {
        moderation_status: 'pending_review',
        moderation_notes: null,
        is_active: false,
      }),
      updated_by: user.id,
    })
    .eq('id', input.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals')
  revalidatePath(`/business/dashboard/deals/${input.id}/edit`)
  return { success: true, data: undefined }
}

// ---- Toggle Active Status (pause/resume) ----
export async function toggleBusinessDealStatus(
  dealId: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const { data: deal } = await supabase
    .from('business_deals')
    .select('is_active, moderation_status')
    .eq('id', dealId)
    .single()

  if (!deal) return { success: false, error: 'Deal not found' }
  if (deal.moderation_status !== 'approved') {
    return { success: false, error: 'Only approved deals can be paused or resumed' }
  }

  const newStatus = !deal.is_active

  const { error } = await supabase
    .from('business_deals')
    .update({ is_active: newStatus, updated_by: user.id })
    .eq('id', dealId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals')
  return { success: true, data: { isActive: newStatus } }
}

// ---- Soft Delete Deal ----
export async function deleteBusinessDeal(dealId: string): Promise<ActionResult> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const { error } = await supabase
    .from('business_deals')
    .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', dealId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals')
  return { success: true, data: undefined }
}

// ---- Moderate Deal (admin only) ----
export async function moderateDeal(
  dealId: string,
  status: ModerationStatus,
  notes?: string,
): Promise<ActionResult> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  // Admin check: call the is_admin() Postgres function via rpc
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { success: false, error: 'Forbidden' }

  const { error } = await supabase
    .from('business_deals')
    .update({
      moderation_status: status,
      moderation_notes:  notes ?? null,
      moderated_by:      user.id,
      moderated_at:      new Date().toISOString(),
      is_active:         status === 'approved',
      updated_by:        user.id,
    })
    .eq('id', dealId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/dashboard/deals')
  return { success: true, data: undefined }
}
```

### 7.3 Profile Server Action (`src/lib/actions/profile.ts`)

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'

export type UpdateProfileInput = {
  businessId: number
  name: string
  description: string
  address: string
  city: string
  state: string
  zipCode: string
  locationArea: string
  phone: string
  email: string
  website?: string
  logoUrl?: string
  coverImageUrl?: string
  latitude?: number
  longitude?: number
}

export async function updateBusinessProfile(
  input: UpdateProfileInput,
): Promise<ActionResult> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const { error } = await supabase
    .from('master_business_info')
    .update({
      name:           input.name,
      description:    input.description,
      address:        input.address,
      city:           input.city,
      state:          input.state,
      zip_code:       input.zipCode,
      location_area:  input.locationArea,
      phone:          input.phone,
      email:          input.email,
      website:        input.website ?? null,
      logo_url:       input.logoUrl ?? null,
      cover_image_url: input.coverImageUrl ?? null,
      updated_at:     new Date().toISOString(),
    })
    .eq('business_id', input.businessId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/profile')
  revalidatePath(`/[state]/[city]/provider/${input.businessId}`, 'page')
  return { success: true, data: undefined }
}
```

### 7.4 Sponsorship Server Actions (`src/lib/actions/sponsorship.ts`)

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'

export async function createSponsoredPlacement(
  dealId: string,
  boostPackageId: string,
): Promise<ActionResult<{ placementId: string }>> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  // Verify deal is approved and active
  const { data: deal } = await supabase
    .from('business_deals')
    .select('id, business_id, is_active, moderation_status')
    .eq('id', dealId)
    .single()

  if (!deal) return { success: false, error: 'Deal not found' }
  if (!deal.is_active || deal.moderation_status !== 'approved') {
    return { success: false, error: 'Only active, approved deals can be sponsored' }
  }

  // Verify no existing active placement
  const { data: existing } = await supabase
    .from('sponsored_placements')
    .select('id')
    .eq('deal_id', dealId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return { success: false, error: 'Deal already has an active placement' }

  // Get package price
  const { data: pkg } = await supabase
    .from('boost_packages')
    .select('price_cents, duration_days')
    .eq('id', boostPackageId)
    .single()

  if (!pkg) return { success: false, error: 'Boost package not found' }

  const { data, error } = await supabase
    .from('sponsored_placements')
    .insert({
      deal_id:          dealId,
      business_id:      deal.business_id,
      boost_package_id: boostPackageId,
      status:           'pending_payment',
      amount_cents:     pkg.price_cents,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals')
  revalidatePath('/business/dashboard/deals/sponsored')
  return { success: true, data: { placementId: data.id } }
}

export async function cancelSponsoredPlacement(
  placementId: string,
): Promise<ActionResult> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const { error } = await supabase
    .from('sponsored_placements')
    .update({ status: 'cancelled' })
    .eq('id', placementId)
    .eq('status', 'active')  -- only cancel active placements

  if (error) return { success: false, error: error.message }

  revalidatePath('/business/dashboard/deals/sponsored')
  return { success: true, data: undefined }
}
```

### 7.5 Analytics Server Action (`src/lib/actions/analytics.ts`)

```typescript
'use server'

import { createServerClient } from '@/lib/supabase-server'

// Called from deal detail page on mount. Fire-and-forget.
export async function recordDealView(dealId: string): Promise<void> {
  // Only track business_deals, not scraped offers
  if (dealId.startsWith('scraped_')) return

  const supabase = createServerClient()
  await supabase.rpc('increment_deal_view', { p_deal_id: dealId })
}
```

### 7.6 Image Upload API Route

Image uploads cannot be Server Actions because they require multipart form data. A dedicated API route handles this.

```
POST /api/business/upload-image
Content-Type: multipart/form-data

Body:
  file: File (max 5MB, MIME: image/jpeg|png|webp)
  type: 'deal' | 'business-logo' | 'business-cover'
  dealId?: string   (required when type = 'deal')
  businessId: number

Response (200):
  { url: string, storagePath: string }

Response (400):
  { error: string }
```

```typescript
// src/app/api/business/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string
  const dealId = formData.get('dealId') as string | null
  const businessId = formData.get('businessId') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }

  const ext = file.type.split('/')[1]
  const bucket = type === 'deal' ? 'deal-images' : 'business-images'
  const folder = type === 'deal' ? `${dealId}` : `${businessId}/${type}`
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${folder}/${filename}`

  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, storagePath: path })
}
```

---

## 8. Frontend Integration Mapping

Each section below identifies exactly which import line changes in which component file, and what it changes to. No component logic or JSX changes unless explicitly noted.

### 8.1 DealForm (`src/components/features/dealManagement/dealForm.tsx`)

**Current import:**
```typescript
import { createDeal, updateDeal } from '@/lib/mock-data/deals'
```

**Replace with:**
```typescript
import { createBusinessDeal, updateBusinessDeal } from '@/lib/actions/deals'
```

**Changes in handleSubmit:**
- `createDeal(dealData)` → `await createBusinessDeal({ businessId: Number(businessId), ...dealData })`
- `updateDeal(existingDeal.id, dealData)` → `await updateBusinessDeal({ id: existingDeal.id, businessId: Number(businessId), ...dealData })`
- Both now return `ActionResult`. Check `result.success` before showing success state.
- Remove `setTimeout` simulation around the call.

**Image URL field:**
- The `imageUrl` Input field becomes a file picker. On file selection, call `POST /api/business/upload-image`. On success, set `formData.imageUrl` to the returned URL. The existing preview logic works unchanged once the URL is in state.
- Keep the URL text input as a fallback behind a toggle ("Use URL instead") for advanced users.

**Note on deal_images integration:**
The `DealForm` currently handles one image via `imageUrl`. Phase 1 implementation stores that single image in `deal_images` with `sort_order = 0` when the deal is saved. Multi-image upload UI (up to 5) is a Phase 2 enhancement.

### 8.2 DealList (`src/components/features/dealManagement/dealList.tsx`)

**Current imports:**
```typescript
import { deleteDeal, getDealsForBusiness, toggleDealStatus } from '@/lib/mock-data/deals'
import { createBoost, getActiveBoostForDeal, getActiveBoosts, isDealEligibleForSponsorship } from '@/lib/mock-data/sponsorship'
```

**Replace with:**
```typescript
import { deleteBusinessDeal, toggleBusinessDealStatus } from '@/lib/actions/deals'
import { createSponsoredPlacement } from '@/lib/actions/sponsorship'
```

**Data loading:**
`getDealsForBusiness(businessId)` is currently called inside `useMemo`. This becomes a Server Component data-fetch. The `DealList` client component receives `initialDeals: Deal[]` as a prop from a Server Component wrapper. After mutations (delete, toggle), `revalidatePath` in the Server Action causes a re-render.

**Sponsorship functions:**
`getActiveBoostForDeal` and `isDealEligibleForSponsorship` become utilities that check the `isSponsored` field on the `Deal` object (already present in the type) rather than hitting the mock arrays. The `Deal` shape returned from Supabase includes `is_sponsored` as a computed column derived from `sponsored_placements`.

**`createBoost` → `createSponsoredPlacement`:**
In `handleBoostSelect`:
```typescript
// Before
createBoost(dealToBoost.id, boostOptionId)

// After
const result = await createSponsoredPlacement(dealToBoost.id, boostOptionId)
if (!result.success) {
  // show error toast
}
```

**`_refreshKey` state:**
Remove the `_refreshKey` workaround entirely. Server Action + `revalidatePath` handles re-rendering.

### 8.3 BusinessProfileForm (`src/components/features/businessProfileForm.tsx`)

**Current import:**
```typescript
import { getBusinessById, updateBusiness } from '@/lib/mock-data/businesses'
```

**Replace with:**
```typescript
import { updateBusinessProfile } from '@/lib/actions/profile'
```

**Data loading:**
`getBusinessById(businessId)` becomes a server-side data fetch, passed as a prop to the form. The form's initial state is populated from this prop.

**Image inputs:**
The `logoUrl` and `coverImageUrl` text inputs (`type="url"`) are replaced with file pickers that call `POST /api/business/upload-image` with `type = 'business-logo'` or `type = 'business-cover'`. The resulting URL is stored back into `formData.logoUrl` / `formData.coverImageUrl`. The existing `<img>` preview blocks work unchanged.

**handleSubmit:**
```typescript
// Before
const updated = updateBusiness(businessId, { ...formData fields })

// After
const result = await updateBusinessProfile({
  businessId: Number(businessId),
  ...formData (trimmed)
})
if (result.success) {
  setSaveMessage('Changes saved successfully')
} else {
  setSaveMessage(`Error: ${result.error}`)
}
```

### 8.4 SponsoredDealConfig (`src/components/features/sponsoredDealConfig.tsx`)

**Current import:**
```typescript
import { type BoostOption, calculateEstimatedReach, getBoostOptions } from '@/lib/mock-data/sponsorship'
```

**Replace with:**
The boost options list becomes a prop `boostPackages: BoostPackage[]` passed from the parent, fetched server-side from the `boost_packages` table. `calculateEstimatedReach` is a pure computation function that can remain in a utility file — it has no data dependency.

**`BoostOption` type:**
Rename to `BoostPackage` and align field names:
```typescript
// Before
interface BoostOption {
  id: string
  price: number          // dollars
  duration: number       // days (field name: duration)
}

// After
interface BoostPackage {
  id: string
  price_cents: number    // from DB column
  duration_days: number  // from DB column
  // ... other fields unchanged
}
```

The component renders `$${pkg.price_cents / 100}` instead of `$${option.price}`.

### 8.5 AnalyticsDashboard (`src/components/features/analytics/analyticsDashboard.tsx`)

**Current state:** Entirely hardcoded mock data. No data props.

**Phase 1 change:** Pass `analyticsData: BusinessAnalytics` as a prop:

```typescript
interface BusinessAnalytics {
  totalViews: number
  totalClaims: number
  dealPerformance: Array<{
    id: string
    title: string
    views: number
    claims: number
    conversionRate: number
    status: 'active' | 'paused' | 'expired'
  }>
}
```

Computed in the parent Server Component by querying `business_deals` for the authenticated business and aggregating `view_count` and `claim_count`.

The four `MetricCard` entries remain. `totalViews` and `totalClaims` use real numbers. `conversionRate` is computed as `(totalClaims / totalViews) * 100`. `Revenue Potential` remains an estimate (`totalClaims * average deal price`). The change/trend comparisons require historical data and are left as static text in Phase 1 ("vs last month" without a real delta).

### 8.6 DealModerationCard (`src/components/features/dealModeration/dealModerationCard.tsx`)

**Current import:**
```typescript
import { getBusinessById } from '@/lib/mock-data/businesses'
```

**Replace with:**
Business name passed as a prop from the parent rather than looked up inside the component. The parent (admin moderation page) fetches deals with a JOIN to `master_business_info` so business name is available without a separate lookup.

**Moderation actions (`onApprove`, `onReject`, `onRequestChanges`):**
These callbacks currently call mock functions in the parent. The parent is updated to call `moderateDeal()` Server Action. The component interface is unchanged.

### 8.7 Admin Moderation Page (`src/app/admin/dashboard/deals/page.tsx`)

**Current behavior:** Reads from `getAllDeals()` (mock) and calls `updateDealModeration()` (mock).

**After integration:**
- Page becomes a Server Component that queries `business_deals WHERE moderation_status = 'pending_review' ORDER BY created_at ASC`.
- Passes deals as props to a client-side moderation list.
- Moderation actions call `moderateDeal()` Server Action via `useTransition`.

---

## 9. Image Upload Strategy

### Storage Bucket Layout

```
Supabase Storage
├── deal-images/           (bucket)
│   └── {deal_id}/
│       └── {timestamp}-{random}.{ext}
│
└── business-images/       (bucket)
    └── {business_id}/
        ├── logo/
        │   └── {timestamp}-{random}.{ext}
        └── cover/
            └── {timestamp}-{random}.{ext}
```

### Storage Policies

```sql
-- deal-images bucket: owners can upload/delete; public can read
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('deal_images_select', 'deal-images', 'SELECT', 'true'),
  ('deal_images_insert', 'deal-images', 'INSERT',
    '(bucket_id = ''deal-images'' AND auth.uid() IS NOT NULL)'),
  ('deal_images_delete', 'deal-images', 'DELETE',
    '(bucket_id = ''deal-images'' AND auth.uid() IS NOT NULL)');

-- business-images bucket: same pattern
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('business_images_select', 'business-images', 'SELECT', 'true'),
  ('business_images_insert', 'business-images', 'INSERT',
    '(bucket_id = ''business-images'' AND auth.uid() IS NOT NULL)'),
  ('business_images_delete', 'business-images', 'DELETE',
    '(bucket_id = ''business-images'' AND auth.uid() IS NOT NULL)');
```

### Image Cleanup on Deal Delete

When a deal is soft-deleted, images remain in storage (preserving history). When a deal is hard-deleted (admin only, future feature), a Supabase Edge Function handles cleanup:

```typescript
// supabase/functions/cleanup-deal-images/index.ts
// Triggered by: DELETE on business_deals where deleted_at IS NOT NULL
// Lists all objects in deal-images/{deal_id}/ and removes them.
```

### Phase 2: Cloudinary Migration

If image transformation capabilities become needed (thumbnail generation, face detection, auto-cropping for consistent card display), migrate to Cloudinary. The `public_url` column in `deal_images` stores the full CDN URL — changing from Supabase Storage URLs to Cloudinary URLs is a data migration, not a code change. The component layer receives a URL string and is agnostic to the host.

---

## 10. Deal Source Unification

### Consumer Feed Query

Consumer-facing pages query the `unified_deals` view (defined in Section 6.3). This view merges both sources with normalized column names. The normalization logic for `promo_offer_master` (mapping `service_category` to `TreatmentCategory`, constructing `id` with `scraped_` prefix, coalescing nullable columns) lives in the view — not in application code.

### ID Namespace

To prevent collision between scraped offer IDs (bigint) and business deal IDs (uuid):
- Scraped offers: `id = 'scraped_' + promo_offer_master.id` (e.g., `scraped_123`)
- Business deals: `id = business_deals.id` (uuid, e.g., `9f4b2e01-...`)

The frontend `Deal.id` field is `string` in the existing TypeScript type, so both formats are compatible without a type change.

### Distinguishing Source at the Application Layer

The `unified_deals` view includes a `deal_source: 'scraped' | 'business'` column. This column is intentionally excluded from the normalized `Deal` TypeScript type to prevent consumer-facing UI from branching on source. However, it is available for:
- Admin reporting
- Analytics attribution
- Deciding whether to show moderation controls (only `business` source deals are moderatable)
- Deciding whether to show edit controls in business dashboard (only `business` source deals are editable by the owner)

### Business Dashboard Deal Source Filtering

The business dashboard at `/business/dashboard/deals` shows only `business_deals` rows — not scraped offers. A scraped offer associated with that business's `business_id` appears on the consumer-facing profile page but not in the business owner's deal management UI.

This is intentional: scraped offers are read-only and cannot be edited. Showing them alongside editable deals would create confusion about what the owner can control. If needed, a future "Scraped Offers" tab can be added to the dashboard as a read-only reference.

---

## 11. Edge Cases & Failure Modes

### Deal State Transitions

**EC-001: Business edits an approved deal**
The deal transitions to `pending_review` and `is_active = false`. Consumers can no longer see it. The edit is preserved. If the admin then rejects the re-submitted edit, the deal remains `rejected` and the prior approved content is not restored. The business must create a new deal or re-edit and resubmit. This is intentional — content integrity trumps availability for business deals.

**EC-002: Validity period expires while deal is active**
The deal remains in the database with `is_active = true` until the nightly expiry job runs. During the window between expiry and the job running (up to 24 hours), the deal is still queryable. The `unified_deals` view should include `AND valid_until > now()` in the `business_deals` subquery to handle this gap without relying on the job. Both defenses are applied.

**EC-003: Business owner deletes a deal with an active sponsored placement**
The placement must be cancelled before the deal can be deleted. The `deleteBusinessDeal` Server Action checks for active placements and returns `{ success: false, error: 'Cancel active boost before deleting' }` if one exists. The UI surfaces this error in the delete confirmation modal.

**EC-004: Business owner attempts to boost a deal in pending_review status**
`isDealEligibleForSponsorship` returns false for any deal not in `approved + is_active = true` state. The boost button in `DealList` is hidden for these deals. The Server Action also validates this condition and returns an error.

**EC-005: Two admins moderate the same deal simultaneously**
The second write wins. Both admins see the same deal because they query live state. If Admin A approves and Admin B simultaneously rejects, the last `UPDATE` to complete wins. The moderation log records both actions with timestamps, allowing reconstruction of what happened. An optimistic concurrency check (compare `updated_at` before write) is deferred to Phase 2.

**EC-006: Business owner updates profile while a deal is in pending_review**
Profile changes and deal moderation are independent. Updating the profile does not affect the deal's moderation status. There is no business logic linking the two.

**EC-007: Image upload succeeds but deal insert fails**
The API route returns the storage URL to the client before the deal is saved. If the subsequent `createBusinessDeal` Server Action fails, the uploaded image becomes an orphan in Supabase Storage. Mitigation: a weekly storage cleanup job removes any file in `deal-images/` whose path prefix (deal ID) has no corresponding row in `business_deals`. Deal IDs are UUIDs generated before upload to enable this cleanup.

**EC-008: Consumer claims a deal that expires between view and claim**
The `deal_claims` insert succeeds (the row is not gated on `valid_until`). The business owner sees the claim in their lead inbox. The business owner can honour or decline the claim at their discretion. The platform does not auto-cancel claims for expired deals in Phase 1.

**EC-009: Scraped offer and business deal exist for the same treatment at the same business**
Both appear in the consumer feed via the `unified_deals` view. The consumer may see two cards for what is effectively the same offer. This is acceptable in Phase 1. In Phase 2, a deduplication layer in the view or at query time can suppress scraped offers for treatments where the same business has an active, approved business deal.

**EC-010: Business owner deletes an image that is the primary deal image (sort_order = 0)**
After deleting, the deal has no `sort_order = 0` image. The `unified_deals` view's subquery for `image_url` returns `NULL`. The deal card renders without an image (the existing `DealCard` component already handles `imageUrl` being undefined — it shows a category icon fallback). If the owner later uploads a new image, it is inserted with `sort_order = 0`.

### RLS Edge Cases

**EC-011: New business owner not yet in business_owner_profiles**
If the owner authenticated but the `business_owner_profiles` row was not created (e.g., due to an error in the claim flow), all RLS policies deny them access to their own deals. The `createBusinessDeal` insert fails with a generic Supabase RLS error. Detection: monitor Supabase logs for RLS policy failures on `business_deals` insert. Resolution: backfill `business_owner_profiles` row via admin tool.

**EC-012: Business has multiple owners (e.g., owner + manager)**
The `business_owner_profiles` table supports multiple rows per `business_id` via the `role` column. Both users can read and write all deals for that business — RLS policies join on `business_id`, not `user_id`. This is the correct behavior: both the owner and a delegated manager should have full access.

---

## 12. User Stories & Acceptance Criteria

### Story 1: Create a Deal

**As a** business owner who has claimed my CostFinders profile,
**I want to** create a new promotional deal with pricing, dates, category, and an image,
**so that** it enters the moderation queue and goes live for consumers after approval.

**Acceptance Criteria:**

Given I am authenticated as a business owner with a linked business,
When I fill out the `DealForm` with all required fields (title, description, category, original price, deal price greater than zero and less than original, unit, valid dates, terms) and submit,
Then a row is inserted into `business_deals` with `moderation_status = 'pending_review'` and `is_active = false`,
And the deal appears in my deal list with a "Pending Review" badge immediately after submission,
And the deal does NOT appear on any consumer-facing page.

Given the deal price equals or exceeds the original price,
When I attempt to submit,
Then the form shows a validation error "Deal price must be less than original price" and does not submit.

Given I upload an image file larger than 5MB,
When I attempt to upload,
Then the upload is rejected with the message "File exceeds 5MB limit".

### Story 2: Edit an Approved Deal

**As a** business owner with an approved and active deal,
**I want to** edit the deal's description and pricing,
**so that** the updated information is reviewed and goes back live.

**Acceptance Criteria:**

Given my deal has `moderation_status = 'approved'` and `is_active = true`,
When I save edits to the description, pricing, or any non-status field,
Then the deal transitions to `moderation_status = 'pending_review'` and `is_active = false`,
And the deal is removed from the consumer feed immediately,
And the moderation log records a transition from `approved` to `pending_review`.

Given I only toggle the deal from active to paused (no field edits, just the `isActive` checkbox),
When I save,
Then `moderation_status` does not change,
And the deal becomes inactive but remains in `approved` state.

### Story 3: Admin Moderates a Deal

**As a** CostFinders admin,
**I want to** review pending deals and approve, reject, or request changes,
**so that** only quality, accurate deals reach consumers.

**Acceptance Criteria:**

Given there is at least one deal with `moderation_status = 'pending_review'`,
When I open the admin moderation queue at `/admin/dashboard/deals`,
Then all pending deals are listed sorted by submission date (oldest first),
And each deal card shows business name, title, category, pricing, validity dates, and terms.

Given I click "Approve" on a pending deal,
When the action completes,
Then the deal's `moderation_status = 'approved'`, `is_active = true`, `moderated_by = my user ID`, `moderated_at = now()`,
And the deal appears in the consumer feed,
And the moderation log records the approval.

Given I click "Request Changes" and submit a note,
When the action completes,
Then `moderation_status = 'changes_requested'` and `moderation_notes` contains my note,
And the deal remains `is_active = false`.

Given I refresh the moderation queue page,
Then the moderation decisions I made in the previous session persist.

### Story 4: Pause and Resume a Deal

**As a** business owner with an approved deal,
**I want to** pause a deal temporarily without losing its approved status,
**so that** I can re-activate it later without going through moderation again.

**Acceptance Criteria:**

Given a deal with `moderation_status = 'approved'` and `is_active = true`,
When I click the Pause button in the deal list,
Then `is_active = false` without changing `moderation_status`,
And the deal is removed from the consumer feed,
And the Pause button shows "Resume".

Given the same deal is paused (`is_active = false`, `moderation_status = 'approved'`),
When I click Resume,
Then `is_active = true`,
And the deal appears in the consumer feed within 60 seconds.

Given a deal with `moderation_status = 'pending_review'`,
When I attempt to click Pause/Resume,
Then the button is not shown (pending deals cannot be toggled).

### Story 5: Sponsor a Deal

**As a** business owner with an approved, active deal,
**I want to** purchase a sponsored placement to increase my deal's visibility,
**so that** it appears higher in consumer search results.

**Acceptance Criteria:**

Given I have an approved, active deal with no existing active placement,
When I click the "Boost" icon on the deal and select a boost package in the `SponsoredDealConfig` modal,
Then clicking "Start Boost" inserts a row into `sponsored_placements` with `status = 'pending_payment'`,
And the boost button is hidden for that deal (deal is no longer eligible for a second placement),
And the deal list shows a "Boosted" badge next to the deal title once the placement is set to `active` by admin.

Given I have a deal that already has an active sponsored placement,
When I view my deal list,
Then the rocket icon boost button is not shown for that deal.

### Story 6: Update Business Profile

**As a** business owner,
**I want to** update my business name, description, contact info, and images,
**so that** consumers see accurate information when they view my profile.

**Acceptance Criteria:**

Given I am on the profile edit page at `/business/dashboard/profile`,
When I change the business name and click "Save Changes",
Then the `master_business_info` row is updated,
And the updated name appears on the consumer-facing provider page within 60 seconds (via `revalidatePath`),
And a "Changes saved successfully" confirmation is shown.

Given I upload a new logo image (JPEG, under 5MB),
When the upload completes,
Then the image appears in the logo preview immediately,
And the form stores the Supabase Storage URL in `logoUrl`.

Given I submit the form without a business name,
Then the form shows "Business name is required" and does not submit.

### Story 7: View Real Analytics

**As a** business owner,
**I want to** see how many views and claims my deals have received,
**so that** I can understand which deals are performing well.

**Acceptance Criteria:**

Given I have at least one active, approved deal that has received consumer views,
When I navigate to `/business/dashboard/analytics`,
Then the "Total Views" metric reflects the sum of `view_count` across all my business deals,
And the "Total Claims" metric reflects the sum of `claim_count` across all my business deals,
And the deal performance table lists each deal with its individual view and claim counts.

Given a consumer views my deal detail page,
When the page loads,
Then `view_count` on that `business_deals` row is incremented by 1,
And this increment does not delay the page render (fire-and-forget).

---

## 13. Implementation Roadmap

### Phase 1: Core Persistence (Weeks 1–3)

**Goal:** Business deals persist, profile edits persist, moderation queue is permanent.

**Backend (Week 1):**
- Create `business_deals`, `deal_images`, `deal_moderation_log`, `deal_claims` tables with all indexes, triggers, and RLS policies.
- Create `business_owner_profiles` table if it does not already exist and backfill from existing auth data.
- Seed `boost_packages` table with the three existing mock options.
- Verify `promo_offer_master` has read-only RLS policy applied.
- Create `unified_deals` view.
- Create `increment_deal_view` function.
- Write `is_admin()` Postgres function (checks a `user_roles` table or a claim in JWT).
- Create Supabase Storage buckets `deal-images` and `business-images` with storage policies.

**Backend (Week 2):**
- Implement all Server Actions in `src/lib/actions/deals.ts`, `profile.ts`, `sponsorship.ts`, `analytics.ts`.
- Implement `/api/business/upload-image` route.
- Write unit tests for Server Actions (mock Supabase client).

**Frontend Integration (Week 2–3, parallel):**
- Swap mock imports in `DealForm`, `DealList`, `BusinessProfileForm`, `SponsoredDealConfig`, `DealModerationCard`.
- Convert deal list and profile pages to Server Components for initial data fetch; keep client components for interaction.
- Test all CRUD flows end-to-end in development against the live Supabase instance.

**Phase 1 Deliverable:** A business owner can create, edit, pause, and delete deals that persist across sessions. An admin can moderate deals with permanent results. Profile changes are permanent.

### Phase 2: Analytics & Images (Weeks 4–5)

**Goal:** Real analytics data powers the dashboard; multi-image upload works; `AnalyticsDashboard` shows live numbers.

- Implement view count increment on deal detail page load.
- Implement claim count increment via `deal_claims` trigger.
- Connect `AnalyticsDashboard` to real `business_deals` aggregates.
- Implement multi-image upload UI in `DealForm` (file picker with 5-image limit, sort_order management, delete individual images).
- Consider 7/14/30-day time window filters for analytics.

**Phase 2 Deliverable:** Analytics dashboard shows real numbers. Deals support multiple images.

### Phase 3: Sponsored Placements (Week 6)

**Goal:** Sponsored placement records persist; admin workflow to activate placements; consumer feed respects boost ordering.

- Admin interface to transition `sponsored_placements.status` from `pending_payment` to `active`.
- Consumer feed query adds ordering boost for `is_sponsored = true` deals (e.g., `ORDER BY is_sponsored DESC, claim_count DESC`).
- `sponsored_placements` expiry job: nightly Supabase edge function sets `status = 'completed'` when `ends_at < now()`.
- Boost history page queries real `sponsored_placements` with `status IN ('completed', 'cancelled')`.

**Phase 3 Deliverable:** Full sponsored placement workflow from selection through expiry.

### Out of Scope (Future)

- Stripe integration for automated payment processing of placements.
- Multi-image upload for business profile (logo and cover only in Phase 1).
- Historical time-series analytics with trend lines.
- Email/SMS notification to business owners when deal moderation status changes.
- Scraped offer deduplication against business deals.
- Business hours management.
- Native mobile app support.

---

## 14. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-1 | Does `master_business_info` have `phone`, `email`, `logo_url`, `cover_image_url`, `state`, `zip_code` columns? The DATABASE.md schema does not list them. If not, they need to be added as nullable columns before the profile update Server Action can write them. | Engineering | Before schema migration |
| OQ-2 | How is the `is_admin()` Postgres function currently implemented, or does it need to be created from scratch? The authentication team should confirm the admin role storage pattern (JWT claim vs user_roles table). | Auth team | Before Phase 1 complete |
| OQ-3 | Should a business owner be notified (email, in-app badge) when their deal moderation status changes? Phase 1 has no notification system, but this is a significant UX gap that affects re-submission rates. | Product | Before Phase 2 |
| OQ-4 | What happens to scraped `promo_offer_master` offers when a business claims their profile? Should they be linked to the claimed business, hidden, or left unchanged? Currently the `business_id` FK exists in `promo_offer_master` but the application does not use it to gate visibility. | Product | Phase 2 deduplication planning |
| OQ-5 | Is there a limit on how many active deals a business can have? Free tier vs paid tier may differ. The current `business_deals` schema has no deal count constraint. If a tier-based limit exists, it needs a check in the `createBusinessDeal` Server Action. | Business / Product | Before Phase 1 launch |
| OQ-6 | Should the `discount_percent` computed column use `ROUND()` or `FLOOR()`? The mock data uses `Math.round()`. The schema uses `ROUND()`. Confirm which is displayed to consumers. | Design / Engineering | Before schema migration |
| OQ-7 | Should category mapping from `promo_offer_master.service_category` to the frontend `TreatmentCategory` enum be done in the view (as specified here) or in application-layer normalization? The view approach couples the DB schema to the app category taxonomy. | Engineering | Before Phase 1 |

---

*This document is the authoritative specification for the Business Operations & Deal Management backend integration. Changes to scope must be reflected here before implementation begins.*

*Last updated: 2026-03-20*
