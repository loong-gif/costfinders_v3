# PRD-02: Business Authentication & Business Claiming

**Document status:** Draft
**Version:** 1.0
**Date:** 2026-03-20
**Author:** Product
**Reviewers:** Engineering, Design, Admin Operations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas & Jobs to Be Done](#3-user-personas--jobs-to-be-done)
4. [Functional Requirements](#4-functional-requirements)
5. [User Stories & Acceptance Criteria](#5-user-stories--acceptance-criteria)
6. [Database Schema](#6-database-schema)
7. [Row Level Security Policies](#7-row-level-security-policies)
8. [API Design](#8-api-design)
9. [Frontend Integration Points](#9-frontend-integration-points)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Dependencies & Risks](#12-dependencies--risks)
13. [Acceptance Criteria (System-Level)](#13-acceptance-criteria-system-level)
14. [Out of Scope](#14-out-of-scope)
15. [Appendix: Migration Checklist](#15-appendix-migration-checklist)

---

## 1. Executive Summary

### Problem Statement

CostFinders holds 354 scraped business profiles in `master_business_info`. These profiles generate consumer leads and deal impressions today, but no business owner can currently claim or manage them because the authentication layer is a localStorage mock (`src/lib/context/businessAuthContext.tsx`). The mock stores no data in Supabase, issues no real sessions, and performs no ownership verification.

This means:
- A bad actor could claim any business with any email address.
- Ownership data is lost on page reload after mock session expiry.
- Admin approval workflows cannot be enforced — mock code calls `linkBusiness()` immediately upon entering a 6-digit code.
- The business dashboard exists but is permanently disconnected from real business data.

### Solution Overview

Replace the localStorage mock with a production-grade Supabase Auth integration that:

1. Provisions real `auth.users` accounts for business owners using a `role` metadata flag.
2. Stores extended business-owner profile data in a new `business_owners` table.
3. Records claim requests in a new `business_claims` table, with file-based evidence upload to Supabase Storage.
4. Enforces admin approval before linking an owner to a `master_business_info` row.
5. Supports a "create new listing" path for businesses not yet in the database.

### Business Impact

| Metric | Current State | Target State |
|--------|--------------|--------------|
| Claimable businesses | 0 (mock only) | 354 |
| Fraud risk | High (no verification) | Low (admin approval gate) |
| Owner session durability | Lost on reload | Persists via Supabase JWT |
| Admin claim visibility | None | Full queue with approve/reject |
| Business profile accuracy | Scraped only | Owner-enriched |

### Resource Requirements

- 1 backend engineer: 2–3 sprints
- 1 frontend engineer: 1–2 sprints (replacing mock contexts)
- 1 admin/ops resource: ongoing (claim review queue)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Fraudulent business claims | Medium | High | Admin approval required before access |
| Scraped data has wrong contact info (blocks email/phone OTP) | High | Medium | Allow document upload as fallback |
| Owner attempts to claim already-claimed business | Medium | Medium | Enforce DB unique constraint + clear UI state |
| Email verification token delivery failures | Low | Medium | Resend endpoint + 24h token expiry |

---

## 2. Product Overview

### Product Vision

Business owners discover that their business is already listed on CostFinders (via organic search or a consumer forwarding the deal link), search for it by name, confirm the details match, create an account, submit ownership proof, and receive access to their dashboard within 24–48 hours of admin approval.

### Key Constraint: Pre-Populated Database

Businesses exist in `master_business_info` before any owner signs up. This is a foundational data constraint that shapes every part of this feature:

- The claim flow is not "register then add a business" — it is "find your pre-existing listing then prove ownership."
- The `master_business_info.business_id` (bigint PK) is the authoritative identifier for a business entity.
- The frontend's mock `Business` type (`src/types/business.ts`) uses a string `id` and a richer schema than Supabase. The integration layer must map between these.

### Business Tier Model (Unchanged)

| Tier | Trigger | Access |
|------|---------|--------|
| `unclaimed` | Default for scraped rows | No owner, leads held by CostFinders |
| `free` | Claim approved | Owner can edit profile, view leads |
| `paid` | Subscription upgrade | Featured placement, priority leads |

After an approved claim, the business tier transitions `unclaimed` → `free` on `master_business_info`.

### Success Criteria

1. A new business owner can complete the claim flow end-to-end in the staging environment.
2. Admin can view, approve, and reject claim requests through the existing admin dashboard at `/admin/dashboard/businesses`.
3. An approved owner can sign in and reach `/business/dashboard` with their real business data.
4. A fraudulent claim attempt (wrong business, wrong identity) is blocked at the admin review step.
5. The existing mock-data UI continues to render without errors before and during the migration.

---

## 3. User Personas & Jobs to Be Done

### Persona A: Business Owner (Claimant)

**Name:** Maria, owner of "Radiant Aesthetics Med Spa" in Tucson
**Context:** Discovers her business on CostFinders via a Google search. The listing exists but has scraped data she wants to correct. A customer mentions they found her Botox price on the platform.
**Jobs to Be Done:**
- *Functional:* "Take control of my listing so I can update incorrect information."
- *Emotional:* "Feel confident that my brand is represented accurately."
- *Social:* "Look professional relative to competitors on the platform."

**Scenario — Claim Existing Business:**
1. Finds listing via `/business` search or directly via `/[state]/[city]/provider/[slug]`.
2. Clicks "Claim this business."
3. Navigates to `/business/claim/[businessId]`.
4. Confirms business details match.
5. Creates account or signs in.
6. Selects verification method (business email or business phone from DB record).
7. Receives OTP, enters it.
8. Uploads supporting document (optional, for businesses with incorrect scraped contact info).
9. Submits claim — enters pending state.
10. Receives email when admin approves/rejects.
11. Signs back in, reaches dashboard.

**Scenario — Create New Listing:**
1. Searches for business, not found.
2. Clicks "Create a new listing" from search results or `businessSearchModal`.
3. Creates account or signs in.
4. Fills `CreateBusinessForm` (name, address, contact, description).
5. Submits — new row created in `master_business_info` (or a staging table pending admin review).
6. Redirected to dashboard with pending status.

### Persona B: Platform Admin (Reviewer)

**Name:** Alex, CostFinders operations team
**Jobs to Be Done:**
- *Functional:* "Review and action a queue of claim requests efficiently."
- *Social:* "Protect the platform's data integrity and legitimate business owners."

**Key Actions:**
- View all pending claims with submitted evidence.
- Approve: links owner to business, transitions tier to `free`, emails owner.
- Reject: marks claim rejected with reason, emails owner.
- Request more info: adds note to claim, emails owner.

### Persona C: Duplicate/Fraudulent Claimant

The system must handle this actor. A competitor or bad actor attempts to claim a business they do not own. Mitigations are detailed in section 10.

---

## 4. Functional Requirements

### FR-01: Business Owner Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01-01 | Business owners authenticate via Supabase Auth using email + password | Must Have |
| FR-01-02 | A `user_role` metadata field on `auth.users` distinguishes business owners from consumers (`role: 'business_owner'` vs `role: 'consumer'`) | Must Have |
| FR-01-03 | Email verification is required before a claim can be submitted | Must Have |
| FR-01-04 | Password minimum 8 characters, validated both client and server | Must Have |
| FR-01-05 | Sign-in returns a JWT with role in claims; frontend reads role to determine dashboard routing | Must Have |
| FR-01-06 | "Forgot password" via Supabase Auth magic link / password reset email | Must Have |
| FR-01-07 | Session persistence via Supabase client (replaces localStorage mock) | Must Have |
| FR-01-08 | Sign-out invalidates the Supabase session | Must Have |
| FR-01-09 | One `auth.users` account maps to one `business_owners` row | Must Have |
| FR-01-10 | A consumer `auth.users` account cannot be used to sign into the business portal and vice versa; role mismatch shown as error | Should Have |

### FR-02: Business Claim Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02-01 | Owner searches `master_business_info` by business name (debounced, case-insensitive, min 2 chars) | Must Have |
| FR-02-02 | Search results show business name, address, city, and current tier badge | Must Have |
| FR-02-03 | Already-claimed businesses show "Already Claimed" and are not selectable | Must Have |
| FR-02-04 | Selecting a business navigates to `/business/claim/[businessId]` (existing route, to be made real-data) | Must Have |
| FR-02-05 | The claim page shows the full business record from `master_business_info` | Must Have |
| FR-02-06 | Owner must be authenticated before submitting a claim | Must Have |
| FR-02-07 | Owner selects verification method: business email OTP or business phone OTP | Must Have |
| FR-02-08 | OTP is 6 digits, expires after 10 minutes, max 3 attempts before lockout | Must Have |
| FR-02-09 | If OTP delivery is not possible (missing/invalid scraped contact info), owner can upload a supporting document instead | Should Have |
| FR-02-10 | On OTP or document submission, a `business_claims` row is inserted with `status = 'pending'` | Must Have |
| FR-02-11 | Owner cannot submit a second claim for the same business while one is `pending` | Must Have |
| FR-02-12 | Owner sees a success state with "under review" messaging after claim submission | Must Have |
| FR-02-13 | Owner receives a confirmation email when claim is submitted | Should Have |
| FR-02-14 | Owner receives an approval or rejection email when admin acts on the claim | Must Have |

### FR-03: Business Creation Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03-01 | If a business is not found in search, owner can initiate the create flow | Must Have |
| FR-03-02 | Owner must be authenticated before submitting a new business | Must Have |
| FR-03-03 | `CreateBusinessForm` data is validated server-side (name, address, phone, email required) | Must Have |
| FR-03-04 | On submit, a new row is inserted into `master_business_info` with `tier = 'unclaimed'` and `process_flag = 'owner_created_pending_review'` | Must Have |
| FR-03-05 | Simultaneously, a `business_claims` row is inserted for the new business with `claim_type = 'new_listing'` and `status = 'pending'` | Must Have |
| FR-03-06 | New listings are NOT auto-approved — they enter the same admin review queue | Must Have |
| FR-03-07 | Owner is redirected to dashboard with a "pending review" banner after creation | Must Have |

### FR-04: Business-to-Owner Linking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04-01 | One business can have at most one approved owner at a time | Must Have |
| FR-04-02 | `master_business_info` gains a nullable FK column `owner_id` referencing `business_owners.id` | Must Have |
| FR-04-03 | When admin approves a claim, `master_business_info.owner_id` is set and `tier` transitions to `'free'` | Must Have |
| FR-04-04 | When admin approves a claim, `business_owners.business_id` and `business_owners.claim_status` are updated | Must Have |
| FR-04-05 | An owner can only be linked to one business at a time (enforced via unique constraint) | Must Have |
| FR-04-06 | If an owner wants to claim a different business (error/change), admin must manually unlink the old claim first | Should Have |

### FR-05: Business Profile Management Post-Claim

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05-01 | After claim approval, owner can edit: name, description, address, phone, email, website, social links | Must Have |
| FR-05-02 | Edits update `master_business_info` directly (no separate approval needed for profile edits) | Must Have |
| FR-05-03 | Owner can upload a logo and cover image (stored in Supabase Storage, URL saved to `master_business_info`) | Should Have |
| FR-05-04 | Profile changes are timestamped in `updated_at` | Must Have |

### FR-06: Admin Claim Review Workflow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06-01 | `/admin/dashboard/businesses` shows a "Pending Claims" tab/filter | Must Have |
| FR-06-02 | Each pending claim shows: claimant name, email, business name, city, claim type, submission timestamp, verification method used, evidence file (if any) | Must Have |
| FR-06-03 | Admin can approve a claim — triggers DB update, tier change, email to owner | Must Have |
| FR-06-04 | Admin can reject a claim with a mandatory reason — triggers email to owner with reason | Must Have |
| FR-06-05 | Admin can add an internal note to a claim without changing its status | Should Have |
| FR-06-06 | Admin cannot approve two different owners for the same business | Must Have |
| FR-06-07 | Approved/rejected claims remain visible in history with final status | Must Have |

---

## 5. User Stories & Acceptance Criteria

### Epic 1: Business Owner Authentication

---

**Story BA-01: Sign Up as Business Owner**
*As a business owner, I want to create a business owner account so that I can claim my business listing.*

**Acceptance Criteria:**
- Given I am on the sign-up view at `/business/claim/[businessId]` or `/business/create`
- When I enter a valid email, a password of at least 8 characters, and matching confirmation
- Then a new `auth.users` row is created with `raw_user_meta_data.role = 'business_owner'`
- And a corresponding `business_owners` row is created with `verification_status = 'unverified'`
- And a verification email is sent to the provided address
- And I am shown a "verify your email" prompt before proceeding

- Given I enter an email that already exists in `auth.users`
- When I submit the form
- Then I see the error message "An account with this email already exists" and am offered the sign-in option
- And no new row is created in `auth.users` or `business_owners`

- Given I enter a password shorter than 8 characters
- When I submit the form
- Then I see inline validation error "Password must be at least 8 characters" before the form is submitted to the server

---

**Story BA-02: Email Verification**
*As a business owner, I want to verify my email address so that my account is activated.*

**Acceptance Criteria:**
- Given I have just signed up
- When I click the verification link in the confirmation email
- Then `auth.users.email_confirmed_at` is populated by Supabase Auth
- And I am redirected back to the claim or create flow I started
- And `business_owners.verification_status` is updated to `'email_verified'`

- Given the verification link has expired (24+ hours)
- When I click it
- Then I see a message "This link has expired" with a "Resend email" button
- And clicking "Resend email" triggers a new confirmation email

---

**Story BA-03: Sign In as Business Owner**
*As a returning business owner, I want to sign in so that I can access my dashboard.*

**Acceptance Criteria:**
- Given I have a verified business owner account
- When I enter correct email and password on the sign-in view
- Then I receive a Supabase JWT with `role = 'business_owner'` in the claims
- And I am redirected to `/business/dashboard`

- Given I enter incorrect credentials
- When I submit
- Then I see "Invalid email or password" with no indication of which is wrong (prevents enumeration)
- And the failed attempt is not logged (no brute-force tracking in v1; rate limiting is handled by Supabase Auth)

---

**Story BA-04: Password Reset**
*As a business owner who has forgotten their password, I want to reset it.*

**Acceptance Criteria:**
- Given I am on any auth view
- When I click "Forgot password" and enter my email
- Then Supabase sends a password reset email if the address exists
- And I see "If an account exists with that email, a reset link has been sent" regardless of whether the email exists (prevents enumeration)

---

### Epic 2: Business Claim Flow

---

**Story BC-01: Search for My Business**
*As a business owner, I want to search for my business by name so that I can find my existing listing.*

**Acceptance Criteria:**
- Given I am on `/business` and I open the search modal
- When I type at least 2 characters into the search input
- Then results from `master_business_info` matching the query appear (case-insensitive, name contains match)
- And each result shows: business name, address, city, and tier badge (unclaimed/free/paid)
- And results appear within 300ms of the debounce settling

- Given a business has `owner_id IS NOT NULL` (already claimed)
- When it appears in results
- Then its "Claim This Business" button is disabled and labelled "Already Claimed"

- Given no results match the query
- When the search resolves
- Then I see "No businesses found matching [query]" and a "Create a New Listing" button

---

**Story BC-02: Confirm Business and Start Claim**
*As a business owner, I want to confirm the business details before starting the claim flow.*

**Acceptance Criteria:**
- Given I have selected a business from search results
- When I arrive at `/business/claim/[businessId]`
- Then I see the full business record: name, address, city, state, zip, phone, email (from `master_business_info`)
- And I see a "Yes, this is my business" CTA

- Given the `businessId` in the URL does not exist in `master_business_info`
- When the page loads
- Then a 404 is shown via Next.js `notFound()`

---

**Story BC-03: Authenticate During Claim**
*As a business owner, I want to sign up or sign in during the claim flow without losing my place.*

**Acceptance Criteria:**
- Given I am not authenticated
- When I click "Yes, this is my business"
- Then I see the auth step (sign up / sign in toggle) with the target business displayed above for context

- Given I complete authentication
- When the auth step succeeds
- Then I proceed to the verification step with the same business in context
- And the URL remains `/business/claim/[businessId]` throughout (no redirect that loses the businessId)

---

**Story BC-04: Verify Ownership via OTP**
*As a business owner, I want to receive a verification code at my business's contact to prove I own it.*

**Acceptance Criteria:**
- Given I am authenticated and on the verification step
- When I select "Verify via email" (business email from DB record)
- Then a 6-digit OTP is generated and emailed to the address stored in `master_business_info`
- And I am shown an input for the 6-digit code
- And the OTP expires after 10 minutes

- Given I enter a correct 6-digit OTP
- When I submit
- Then `business_claims` receives a new row with `verification_method = 'email_otp'` and `status = 'pending'`
- And I see the success / "under review" screen

- Given I enter an incorrect code 3 times
- When the third failure occurs
- Then the form is locked with message "Too many attempts. Please start over or contact support."
- And the OTP is invalidated

- Given the phone option is selected
- When I submit
- Then an automated call delivers the OTP to the number stored in `master_business_info` (via Twilio or equivalent, out of scope for v1 — see section 14)

---

**Story BC-05: Submit Claim with Document**
*As a business owner whose listed contact info is wrong, I want to upload a document to prove ownership.*

**Acceptance Criteria:**
- Given I am on the verification step and the OTP method is unavailable or I choose "I don't have access to that contact"
- When I select "Upload ownership document"
- Then I see a file upload area accepting JPG, PNG, or PDF, max 10 MB
- And I can upload a business license, utility bill, or similar document

- Given I upload a valid file
- When I submit
- Then the file is stored in Supabase Storage at `claim-documents/{claim_id}/{filename}`
- And `business_claims.evidence_url` stores the storage path
- And `verification_method = 'document'` is set on the claim row
- And the claim status is `'pending'`

---

**Story BC-06: Claim Already Pending**
*As a business owner with a pending claim, I should not be able to submit a duplicate.*

**Acceptance Criteria:**
- Given I have a claim in `business_claims` for business B with `status = 'pending'`
- When I or anyone else attempts to submit another claim for business B
- Then the API returns an error "A claim for this business is already under review"
- And no duplicate row is inserted into `business_claims`

---

### Epic 3: Business Creation Flow

---

**Story BN-01: Create New Business Listing**
*As a business owner whose business is not in the system, I want to create a new listing.*

**Acceptance Criteria:**
- Given I am authenticated and on `/business/create`
- When I fill all required fields (name, address, city, state, zip, phone, business email) and submit
- Then a new row is inserted into `master_business_info` with `tier = 'unclaimed'` and `process_flag = 'owner_created_pending_review'`
- And a `business_claims` row is created with `claim_type = 'new_listing'` and `status = 'pending'`
- And I am redirected to `/business/dashboard` with a "Your listing is under review" banner
- And the admin claim queue shows the new listing

- Given I omit a required field
- When I submit
- Then I see inline validation errors and the form is not submitted

- Given I submit a business name that already exists in `master_business_info` with the same address
- When the API processes the submission
- Then I receive the error "A business with this name and address may already exist. Please search to claim it." with a search link

---

### Epic 4: Admin Claim Review

---

**Story AC-01: View Pending Claims Queue**
*As an admin, I want to see all pending business claims so that I can review and action them.*

**Acceptance Criteria:**
- Given I am authenticated as admin at `/admin/dashboard/businesses`
- When I select the "Pending Claims" filter tab
- Then I see a list of all `business_claims` rows with `status = 'pending'`
- And each row shows: claimant full name, email, business name, city, claim type, verification method, submission date
- And claims are sorted by `submitted_at` ascending (oldest first)

---

**Story AC-02: Approve a Claim**
*As an admin, I want to approve a verified ownership claim.*

**Acceptance Criteria:**
- Given I am viewing a pending claim
- When I click "Approve"
- Then `business_claims.status` is updated to `'approved'` with `reviewed_at = now()` and `reviewed_by = admin_id`
- And `master_business_info.owner_id` is set to the claimant's `business_owners.id`
- And `master_business_info.tier` is updated from `'unclaimed'` to `'free'`
- And `business_owners.claim_status` is updated to `'approved'`
- And `business_owners.business_id` is set to the approved `master_business_info.business_id`
- And a confirmation email is sent to the business owner
- And all other pending claims for the same business are auto-rejected with reason "Another owner has been approved for this business"

---

**Story AC-03: Reject a Claim**
*As an admin, I want to reject a claim that cannot be verified.*

**Acceptance Criteria:**
- Given I am viewing a pending claim
- When I click "Reject" and enter a rejection reason (required field)
- Then `business_claims.status` is updated to `'rejected'` with `rejection_reason` stored, `reviewed_at = now()`, and `reviewed_by = admin_id`
- And `business_owners.claim_status` is updated to `'rejected'`
- And a rejection email is sent to the owner including the reason
- And the owner is not linked to the business

---

## 6. Database Schema

All SQL targets Postgres 17 on Supabase. Run as migrations in the listed order.

### Migration 001: Extend `master_business_info`

```sql
-- Add owner relationship columns to the existing scraped-data table.
-- owner_id is nullable: NULL means unclaimed.
ALTER TABLE master_business_info
  ADD COLUMN IF NOT EXISTS owner_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier            text        NOT NULL DEFAULT 'unclaimed'
                                                       CHECK (tier IN ('unclaimed', 'free', 'paid')),
  ADD COLUMN IF NOT EXISTS status          text        NOT NULL DEFAULT 'active'
                                                       CHECK (status IN ('active', 'pending', 'suspended')),
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS logo_url        text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS claimed_at      timestamptz;

-- Only one owner per business at a time.
CREATE UNIQUE INDEX IF NOT EXISTS master_business_info_owner_id_unique
  ON master_business_info (owner_id)
  WHERE owner_id IS NOT NULL;
```

**Note on existing columns:** `master_business_info` already has `business_id` (bigint PK), `name`, `address`, `city`, `website`, `review_count`, `score`, `category`, `facebook_url`, `instagram_url`, `membership`, `embedding`, `process_flag`, `created_at`, `updated_at`. This migration extends — it does not replace.

---

### Migration 002: Create `business_owners`

```sql
-- Stores business-owner-specific profile data that extends auth.users.
-- Created on signup. One row per auth.users account with role = 'business_owner'.
CREATE TABLE IF NOT EXISTS business_owners (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id         uuid         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile
  first_name           text,
  last_name            text,
  phone                text,

  -- Business linkage (set after claim approval)
  business_id          bigint       REFERENCES master_business_info(business_id) ON DELETE SET NULL,

  -- Status
  verification_status  text         NOT NULL DEFAULT 'unverified'
                                    CHECK (verification_status IN ('unverified', 'email_verified', 'fully_verified')),
  claim_status         text         NOT NULL DEFAULT 'none'
                                    CHECK (claim_status IN ('none', 'pending', 'approved', 'rejected')),

  -- Timestamps
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- One owner per business.
CREATE UNIQUE INDEX IF NOT EXISTS business_owners_business_id_unique
  ON business_owners (business_id)
  WHERE business_id IS NOT NULL;

-- Trigger: keep updated_at current.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_owners_updated_at
  BEFORE UPDATE ON business_owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### Migration 003: Create `business_claims`

```sql
-- Records every claim request, whether for an existing listing or a new one.
-- Persists through approval/rejection for audit trail.
CREATE TABLE IF NOT EXISTS business_claims (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is claiming
  owner_id            uuid         NOT NULL REFERENCES business_owners(id) ON DELETE CASCADE,

  -- What is being claimed
  business_id         bigint       NOT NULL REFERENCES master_business_info(business_id) ON DELETE CASCADE,

  -- Claim metadata
  claim_type          text         NOT NULL DEFAULT 'existing_listing'
                                   CHECK (claim_type IN ('existing_listing', 'new_listing')),
  verification_method text         CHECK (verification_method IN ('email_otp', 'phone_otp', 'document', 'none')),

  -- Status lifecycle
  status              text         NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  -- Evidence
  evidence_url        text,        -- Supabase Storage path for uploaded document

  -- OTP verification (transient; cleared after use or expiry)
  otp_hash            text,        -- bcrypt hash of the issued OTP
  otp_expires_at      timestamptz,
  otp_attempts        int          NOT NULL DEFAULT 0,

  -- Admin review
  rejection_reason    text,
  admin_notes         text,
  reviewed_by         uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,

  -- Timestamps
  submitted_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),

  -- Constraints
  -- Prevent duplicate pending claims for the same business
  CONSTRAINT no_duplicate_pending_claim
    EXCLUDE USING btree (business_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS business_claims_owner_id_idx     ON business_claims (owner_id);
CREATE INDEX IF NOT EXISTS business_claims_business_id_idx  ON business_claims (business_id);
CREATE INDEX IF NOT EXISTS business_claims_status_idx       ON business_claims (status);

CREATE TRIGGER business_claims_updated_at
  BEFORE UPDATE ON business_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**OTP storage note:** Only the bcrypt hash of the OTP is stored, never the plaintext. The 6-digit code is generated server-side, hashed, stored in `otp_hash`, and the plaintext is sent to the contact method. Verification compares the submitted code against the stored hash.

---

### Migration 004: Add Supabase Storage Bucket

```sql
-- Create the storage bucket for claim evidence documents.
-- Run via Supabase Dashboard > Storage > New Bucket, or via management API.
-- Bucket: claim-documents
-- Public: false (files require authenticated access via signed URLs)
-- File size limit: 10 MB
-- Allowed MIME types: image/jpeg, image/png, application/pdf
```

The bucket itself is created via the Supabase dashboard or CLI. The SQL comment above documents the required configuration. Signed URLs (1-hour expiry) are used when admins need to view uploaded evidence.

---

### Entity Relationship Summary

```
auth.users (Supabase managed)
    |
    | 1:1 (auth_user_id)
    v
business_owners
    |           \
    | 1:1        | 1:many
    | (business_id FK, set after approval)
    v             v
master_business_info    business_claims
    ^                       |
    | (business_id FK)       |
    +------------------------+
```

---

## 7. Row Level Security Policies

RLS is already enabled on all tables. The following policies are additive.

### `business_owners` Table

```sql
-- Anyone can read their own row (needed to hydrate businessAuthContext).
CREATE POLICY "business_owners: owner reads own row"
  ON business_owners FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Owner can update their own non-critical fields.
-- business_id and claim_status are updated only by server-side functions.
CREATE POLICY "business_owners: owner updates profile"
  ON business_owners FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (
    auth.uid() = auth_user_id
    -- Prevent client from updating claim_status or business_id directly
  );

-- Insert on signup: owner inserts their own row.
CREATE POLICY "business_owners: owner inserts own row"
  ON business_owners FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- Admins can read all rows.
CREATE POLICY "business_owners: admin full access"
  ON business_owners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### `business_claims` Table

```sql
-- Owner can read their own claims.
CREATE POLICY "business_claims: owner reads own claims"
  ON business_claims FOR SELECT
  USING (
    owner_id IN (
      SELECT id FROM business_owners WHERE auth_user_id = auth.uid()
    )
  );

-- Owner can insert a claim (DB constraint prevents duplicate pending).
CREATE POLICY "business_claims: owner inserts claim"
  ON business_claims FOR INSERT
  WITH CHECK (
    owner_id IN (
      SELECT id FROM business_owners WHERE auth_user_id = auth.uid()
    )
  );

-- Only server-side functions (service role) update claims (OTP verification, approval, rejection).
-- No client-level UPDATE policy. All mutations go through API routes.

-- Admins can read and update all claims.
CREATE POLICY "business_claims: admin full access"
  ON business_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### `master_business_info` Table (Additions)

```sql
-- Authenticated business owner can update their own linked business profile.
CREATE POLICY "master_business_info: owner updates own business"
  ON master_business_info FOR UPDATE
  USING (
    owner_id IN (
      SELECT id FROM business_owners WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id IN (
      SELECT id FROM business_owners WHERE auth_user_id = auth.uid()
    )
  );

-- The existing public read policy (anon key) remains unchanged.
```

---

## 8. API Design

All routes are Next.js App Router Route Handlers (`src/app/api/**`). They use the Supabase server client (service-role key for admin operations, user session for owner operations).

### Auth Routes

These delegate entirely to Supabase Auth; no custom endpoints needed for sign-up, sign-in, sign-out, or password reset. The frontend calls `supabase.auth.*` methods directly.

The one custom endpoint required is the post-signup hook:

#### `POST /api/auth/business-owner/register`
Creates the `business_owners` row after Supabase Auth signup succeeds client-side.

**Request body:**
```json
{
  "firstName": "Maria",
  "lastName": "Vasquez",
  "phone": "+15205550123"
}
```

**Behavior:**
1. Validates the calling user's JWT (must be a valid `auth.users` session).
2. Confirms `raw_user_meta_data.role = 'business_owner'` on the token.
3. Inserts a row into `business_owners` using the `auth.uid()` as `auth_user_id`.
4. Returns the created `business_owners` row.

**Responses:**
- `201` — created, returns `{ owner: BusinessOwner }`
- `409` — row already exists for this user
- `401` — unauthenticated
- `422` — validation failure

---

### Claim Routes

#### `GET /api/businesses/search?q={query}&limit={n}`
Searches `master_business_info` by name. Replaces the mock data lookup in `businessSearchModal.tsx`.

**Query params:**
- `q` (required): search string, min 2 chars
- `limit` (optional): max results, default 10, max 50

**Behavior:**
- `SELECT business_id, name, address, city, tier, owner_id IS NOT NULL AS is_claimed FROM master_business_info WHERE name ILIKE '%{q}%' AND status = 'active' LIMIT {limit}`
- Returns results ordered by `score DESC NULLS LAST` (surface highest-rated businesses first).

**Response:**
```json
{
  "results": [
    {
      "business_id": 42,
      "name": "Radiant Aesthetics Med Spa",
      "address": "2100 N Oracle Rd",
      "city": "Tucson",
      "state": null,
      "tier": "unclaimed",
      "is_claimed": false
    }
  ]
}
```

**Note on `state` field:** The current `master_business_info` schema does not have a `state` column (only `city`). This is a known gap. The API returns `null` for state; city is sufficient for disambiguation in v1.

---

#### `GET /api/businesses/[businessId]`
Fetches a single business for the claim confirmation step. Replaces `getBusinessById` mock.

**Response:** Full `master_business_info` row (excluding `otp_hash`, `embedding`).

**Authorization:** Public (anon key). Business details are visible to anyone who has the ID.

---

#### `POST /api/claims`
Submits a business ownership claim.

**Request body (OTP path):**
```json
{
  "businessId": 42,
  "claimType": "existing_listing",
  "verificationMethod": "email_otp",
  "otpCode": "847261"
}
```

**Request body (document path):**
```json
{
  "businessId": 42,
  "claimType": "existing_listing",
  "verificationMethod": "document",
  "evidenceStoragePath": "claim-documents/tmp/upload-abc123.pdf"
}
```

**Behavior:**
1. Authenticates the calling user; looks up their `business_owners` row.
2. Checks no `pending` claim exists for `businessId` (enforced by DB constraint, also checked here for clean error messaging).
3. If `verificationMethod = 'email_otp'` or `'phone_otp'`: verifies OTP against `otp_hash` and `otp_expires_at`, increments `otp_attempts`, enforces 3-attempt lockout.
4. If `verificationMethod = 'document'`: moves the temp file to `claim-documents/{claimId}/` in storage.
5. Inserts `business_claims` row with appropriate fields.
6. Updates `business_owners.claim_status = 'pending'`.
7. Sends submission confirmation email (via Supabase Email or Resend).

**Responses:**
- `201` — claim submitted, returns `{ claimId, status: 'pending' }`
- `409` — duplicate pending claim
- `422` — OTP invalid or expired, remaining attempts included in response
- `410` — OTP locked (3 failures)
- `401` — unauthenticated

---

#### `POST /api/claims/otp/send`
Sends a new OTP to the business's registered contact method.

**Request body:**
```json
{
  "businessId": 42,
  "method": "email"
}
```

**Behavior:**
1. Fetches the business's `email` (or `phone`) from `master_business_info`.
2. Generates a 6-digit OTP server-side.
3. Stores `bcrypt.hash(otp, 10)` into `business_claims.otp_hash` (or a temp table if no claim row exists yet), with `otp_expires_at = now() + interval '10 minutes'`.
4. Dispatches the OTP to the contact.

**Rate limit:** 1 OTP per business per 2 minutes. Returns `429` if called more frequently.

---

#### `GET /api/claims/my`
Returns all claims for the authenticated business owner.

**Authorization:** Owner-level JWT.
**Response:** Array of `business_claims` rows joined with `master_business_info.name` and `master_business_info.city`.

---

### Admin Routes

All admin routes require a valid JWT with `raw_user_meta_data.role = 'admin'`. The existing `adminAuthContext.tsx` mock will be replaced following a separate PRD (admin auth is out of scope here; treat admin as a super-privileged role for now).

#### `GET /api/admin/claims?status={status}&page={n}&limit={n}`
Lists claims for the admin review queue.

**Query params:**
- `status`: `pending` | `approved` | `rejected` | `all` (default: `pending`)
- `page`, `limit`: pagination

**Response:** Array of claim records joined with `business_owners` (claimant name, email) and `master_business_info` (business name, city).

---

#### `POST /api/admin/claims/[claimId]/approve`
Approves a pending claim. Executes as a database transaction:

1. Update `business_claims` row: `status = 'approved'`, `reviewed_at = now()`, `reviewed_by = admin_uid`.
2. Update `master_business_info`: `owner_id = claim.owner_id`, `tier = 'free'`, `claimed_at = now()`.
3. Update `business_owners`: `claim_status = 'approved'`, `business_id = claim.business_id`.
4. Auto-reject any other `pending` claims for the same `business_id`.
5. Send approval email to owner.

All five steps run in a single Postgres transaction. If any step fails, the transaction is rolled back.

**Response:** `200` with updated claim and business records on success.

---

#### `POST /api/admin/claims/[claimId]/reject`
Rejects a pending claim.

**Request body:**
```json
{
  "reason": "Could not verify ownership of the provided documentation."
}
```

**Behavior:**
1. Update `business_claims`: `status = 'rejected'`, `rejection_reason`, `reviewed_at`, `reviewed_by`.
2. Update `business_owners.claim_status = 'rejected'`.
3. Send rejection email with reason to owner.

---

#### `GET /api/admin/claims/[claimId]/evidence`
Returns a short-lived signed URL (1-hour) for the uploaded evidence document.

**Authorization:** Admin JWT only (evidence files are not publicly accessible).

---

## 9. Frontend Integration Points

This section describes exactly which files need to change and what the changes look like. No implementation code is included — this is a contract for the engineering team.

### 9.1 Replace `businessAuthContext.tsx`

**File:** `src/lib/context/businessAuthContext.tsx`

**Current behavior:** Stores owner in `dynamicOwners[]` array in memory; persists only `ownerId` to localStorage; no real passwords; calls `linkBusiness()` immediately on OTP entry.

**Required changes:**
- Replace `signUp` with `supabase.auth.signUp({ email, password, options: { data: { role: 'business_owner' } } })` followed by `POST /api/auth/business-owner/register`.
- Replace `signIn` with `supabase.auth.signInWithPassword({ email, password })`.
- Replace `signOut` with `supabase.auth.signOut()`.
- Replace `loadStoredOwner` / `saveOwnerId` pattern with `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`.
- Remove `dynamicOwners[]` array entirely.
- `updateVerificationStatus`, `updateClaimStatus`, `linkBusiness` become server-side-only operations; the context reads the current state from the DB on session load rather than writing it locally.
- The context should expose an `isEmailVerified` boolean derived from `session.user.email_confirmed_at`.

**Key interface change:** `BusinessAuthContextValue.signUp` will need an additional step indicator (e.g., a `pendingEmailVerification: boolean` flag) so the UI can show the "check your email" state.

---

### 9.2 Upgrade `businessSearchModal.tsx`

**File:** `src/components/features/businessSearchModal.tsx`

**Current behavior:** Filters `businesses` from `@/lib/mock-data/businesses` in memory.

**Required changes:**
- Replace the in-memory filter with a `fetch('/api/businesses/search?q={query}')` call.
- Debounce is already implemented (300ms) — keep it.
- Map the API response (uses `business_id: bigint`) to the existing display format.
- The `is_claimed` boolean from the API drives whether "Already Claimed" or "Claim This Business" is shown.
- Handle loading and error states (currently not implemented).

---

### 9.3 Upgrade Claim Page

**File:** `src/app/business/claim/[businessId]/page.tsx`

**Current behavior:** Calls `getBusinessById(businessId)` from mock data.

**Required changes:**
- Replace `getBusinessById` with a server-side `fetch('/api/businesses/[businessId]')` or direct Supabase server client query.
- The `businessId` param is currently treated as a string; `master_business_info.business_id` is a bigint. The route param is a string in the URL — parse to integer when querying Supabase.
- `notFound()` if the business is not in `master_business_info`.

---

### 9.4 Upgrade `claimBusinessFlow.tsx`

**File:** `src/components/features/claimBusinessFlow.tsx`

**Current behavior:** Step 3 (`handleVerifySubmit`) mocks OTP acceptance (any 6-digit code works), calls `linkBusiness()` directly and transitions to a success step that implies immediate approval.

**Required changes:**
- Step 2 (auth): Use the real Supabase auth via `useBusinessAuth()` — no component-level change needed if context is replaced correctly.
- Step 3 (verify): Replace the mock OTP check with `POST /api/claims` (OTP path). The success step messaging must change from "Claim submitted and approved" to "Claim submitted, under review — you'll hear back within 24–48 hours." The current success copy ("Your claim is being reviewed") is already correct in the UI — the issue is that `linkBusiness()` fires before admin approval.
- Remove calls to `linkBusiness()` and `updateVerificationStatus('verified')` from this component. These are server-side actions triggered by admin approval.
- Add a "Upload document instead" option on the verification step for the document fallback path.

---

### 9.5 Upgrade `createBusinessForm.tsx` / Create Page

**File:** `src/app/business/create/page.tsx`

**Current behavior:** Calls `createBusiness()` mock function then immediately calls `linkBusiness()` and `updateClaimStatus('approved')`.

**Required changes:**
- Replace `createBusiness()` with `POST /api/businesses` (new API route to be specified separately) which inserts into `master_business_info` and creates the `business_claims` row.
- Remove `linkBusiness()` and `updateClaimStatus('approved')` — new listings are not auto-approved.
- Update success state copy to reflect pending review (the current UI already has a "listing will go live after a brief review" message — this is correct behavior, just needs real data behind it).

---

### 9.6 Admin Claim Queue

**File:** `src/app/admin/dashboard/businesses/page.tsx`

**Current behavior:** Manages business tier/status via mock data. No claim queue.

**Required changes:**
- Add a "Pending Claims" filter tab (alongside existing `all / unclaimed / free / paid / suspended`).
- When "Pending Claims" is active, fetch from `GET /api/admin/claims?status=pending`.
- Each row in the claims view shows: claimant name, email, business name, city, claim type, verification method, submitted date, and action buttons (Approve / Reject / View Evidence).
- "Approve" calls `POST /api/admin/claims/[claimId]/approve`.
- "Reject" opens an inline form for rejection reason, then calls `POST /api/admin/claims/[claimId]/reject`.
- "View Evidence" calls `GET /api/admin/claims/[claimId]/evidence` to get a signed URL and opens it in a new tab.

---

### 9.7 Business Dashboard Auth Guard

**File:** `src/app/business/dashboard/layout.tsx` (or equivalent)

**Current behavior:** Client-side check via `useBusinessAuth()`. If not authenticated, redirects. This check relies on the mock context.

**Required changes:**
- The layout should verify `session.user.user_metadata.role === 'business_owner'` from the real Supabase session.
- Additionally check `businessOwner.claim_status === 'approved'` before granting full dashboard access.
- Owners with `claim_status = 'pending'` should see a limited dashboard with only a "Claim Under Review" banner.
- Owners with `claim_status = 'rejected'` should see a rejection notice with a "Submit a new claim" link.

---

### 9.8 `src/types/businessOwner.ts`

**Current definition:**

```typescript
export type BusinessVerificationStatus = 'unverified' | 'pending' | 'verified'
export type BusinessClaimStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface BusinessOwner {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  businessId?: string
  verificationStatus: BusinessVerificationStatus
  claimStatus: BusinessClaimStatus
  createdAt: string
  updatedAt: string
}
```

**Required changes:**
- `id` maps to `business_owners.id` (UUID).
- Add `authUserId: string` (maps to `business_owners.auth_user_id`).
- `businessId` changes to `businessId?: number` (bigint → number in JS) to match `master_business_info.business_id`.
- `verificationStatus` aligns with DB: change `'pending'` → `'email_verified'`; add `'fully_verified'`. The existing UI uses `'verified'` — update all references.
- Add `isEmailVerified: boolean` as a computed/denormalized convenience field (derived from `auth.users.email_confirmed_at`).

---

### 9.9 Supabase Client Setup

The existing client (`src/lib/supabase.ts`) uses the anon key and is read-only safe. No changes needed for reads.

For write operations in API routes, a server-side client using the service-role key is required for admin operations and OTP verification. This client must never be exposed to the browser:

```
SUPABASE_SERVICE_ROLE_KEY  (server-only env var, not prefixed with NEXT_PUBLIC_)
```

Add this to `.env.local` and Vercel environment variables.

---

## 10. Edge Cases & Error Handling

### Case 1: Scraped business has wrong or missing contact info

**Scenario:** `master_business_info.email` for "Glow Aesthetics" is a generic booking email that the owner does not have access to. OTP fails to be received.

**Handling:**
- After OTP send, add a link "I don't have access to this contact" visible after 2 minutes.
- Clicking it reveals the document upload option.
- If both `email` and `phone` are null in the DB record, the document upload path is shown automatically without offering OTP.

---

### Case 2: Business owner tries to claim an already-claimed business

**Scenario:** "Radiant Aesthetics" was claimed and approved for Maria. A competitor, Kevin, attempts to claim it.

**Handling:**
- `businessSearchModal.tsx` shows "Already Claimed" badge and disables the claim button (relies on `is_claimed` flag from API).
- If somehow the claim page is reached directly (via URL), the page checks `master_business_info.owner_id IS NOT NULL` and displays "This business has already been claimed. If you believe this is an error, contact support."
- The API's `business_claims` EXCLUDE constraint prevents inserting a second `pending` claim for the same business.

---

### Case 3: Multiple simultaneous pending claims for the same business

**Scenario:** Maria and Kevin both start the claim flow within the same 5-minute window before either submits.

**Handling:**
- Both can start the flow (no lock at page-load time — this would create false rejections).
- The first to call `POST /api/claims` successfully creates the `pending` claim.
- The second caller hits the DB EXCLUDE constraint, gets a `409` response.
- UI shows: "A claim for this business is already under review."

---

### Case 4: Owner's email is the same as the business's scraped email

**Scenario:** Maria signs up with `maria@radiantaesthetics.com`, which is also the `email` stored in `master_business_info` for her business.

**Handling:**
- This is actually the ideal verification path. The OTP goes to `master_business_info.email`, which is the same as `auth.users.email`.
- No special handling needed — the OTP verify flow functions identically.
- This situation is a positive signal and could be logged in `admin_notes` as a confidence indicator.

---

### Case 5: Owner has a consumer account and wants a business account

**Scenario:** Alex has a consumer account at `alex@gmail.com` and now wants to claim his medspa.

**Handling (v1):**
- The same email cannot be used for both a consumer and a business owner account because Supabase Auth uses email as the unique identifier in `auth.users`.
- The business sign-up form detects that `alex@gmail.com` already exists in `auth.users` and shows: "An account already exists with this email. If you have a consumer account, please use a different email for your business account."
- Dual-role accounts are out of scope for v1 (see section 14).

---

### Case 6: Admin approves a claim but the DB transaction partially fails

**Scenario:** The `business_claims` update succeeds but the `master_business_info` update fails due to a transient DB error.

**Handling:**
- All approval steps run inside a single Postgres transaction.
- If any step fails, the entire transaction rolls back.
- The API returns a `500` with a generic error.
- The claim remains `pending` — admin can retry the approval.
- The DB is never left in a partial state.

---

### Case 7: Business owner submits claim, account gets deleted before admin reviews

**Scenario:** Maria submits a claim then deletes her Supabase Auth account.

**Handling:**
- `business_claims.owner_id` has `ON DELETE CASCADE` from `business_owners`.
- `business_owners.auth_user_id` has `ON DELETE CASCADE` from `auth.users`.
- Deleting `auth.users` cascades to delete `business_owners`, which cascades to delete `business_claims`.
- The claim disappears from the admin queue automatically.

---

### Case 8: OTP is requested but the business has no email or phone in the DB

**Scenario:** Some scraped records have null `email` and null `phone` (missing data from the scrape).

**Handling:**
- `POST /api/claims/otp/send` checks for null contact field before generating an OTP.
- If null, it returns a `422` with `{ error: 'no_contact_available', message: 'This business listing does not have a verified contact on file. Please upload a document to prove ownership.' }`.
- The frontend displays the document upload path directly, skipping the OTP method selection screen.

---

### Case 9: New business creation duplicates an existing record

**Scenario:** "Glow Medical Spa" already exists at "100 Main St, Tucson" but Maria couldn't find it (typo in search, different name spelling).

**Handling:**
- On `POST /api/businesses` (create new), the API performs a fuzzy match: `SELECT business_id FROM master_business_info WHERE name ILIKE '%{name}%' AND city ILIKE '%{city}%' LIMIT 5`.
- If matches are found, the API returns a `409` with a list of potential duplicates: `{ error: 'possible_duplicate', suggestions: [{ business_id, name, address }] }`.
- The frontend shows: "A similar business may already exist. Did you mean one of these?" with claim links for each suggestion.

---

### Case 10: OTP delivery failure (email bounce or phone not in service)

**Scenario:** The scraped email address returns a hard bounce. The OTP delivery fails silently.

**Handling:**
- Email sending (Supabase Email or Resend) should be configured with delivery status webhooks.
- If a hard bounce is detected within 30 seconds, the API returns an appropriate message: "The email address on file could not be reached. Please use the document upload option."
- In v1, async delivery failure (bounce after OTP send success response) is a known gap. The owner will simply not receive the OTP and must use document upload as fallback.

---

## 11. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Business search API response time (p95) | < 300 ms |
| Claim submission API response time (p95) | < 1 s |
| Admin claim list page load | < 2 s |
| OTP delivery latency (email) | < 30 s |
| Profile update API response | < 500 ms |

### Security

| Requirement | Implementation |
|-------------|---------------|
| OTP is never stored in plaintext | `bcrypt` hash with cost factor 10 |
| Evidence documents not publicly accessible | Supabase Storage bucket set to private; access via signed URLs only |
| Service-role key never sent to browser | Used only in API routes; env var not prefixed `NEXT_PUBLIC_` |
| Admin routes require role check | JWT claim `role = 'admin'` validated on every admin API call |
| Rate limiting on OTP send | 1 OTP per business per 2 minutes; standard Supabase rate limits apply to auth endpoints |
| Claim actions require ownership | RLS policies enforce that owners can only read/insert their own claims |
| CSRF protection | Next.js API routes use same-origin cookies via Supabase SSR client |

### Reliability

- OTP expiry enforced at the database layer (`otp_expires_at`), not just in application code.
- Claim approval is atomic (single transaction). No partial-approval state is possible.
- Supabase project is on a region with 99.9% uptime SLA (us-west-1).

### Usability

- All error messages follow `docs/MESSAGING-STYLE-GUIDE.md` conventions.
- The claim flow is completable on mobile (all existing components are responsive per `CLAUDE.md`).
- WCAG 2.1 AA: all interactive elements have accessible labels; error messages are associated with their inputs via `aria-describedby`.
- The "under review" state is clearly communicated; the owner knows they will receive an email (not poll the dashboard).

### Compliance

- GDPR / CCPA: Uploaded documents (evidence) containing personal data must be deletable on user request. Add a task to the business owner deletion flow: delete all files in `claim-documents/{owner_id}/` from Supabase Storage.
- Data minimization: OTP hash and `otp_attempts` are cleared from `business_claims` after the claim is resolved (approved or rejected).

---

## 12. Dependencies & Risks

### External Dependencies

| Dependency | Purpose | Owner | Risk |
|------------|---------|-------|------|
| Supabase Auth | Email/password auth, JWT, email verification | Supabase (managed) | Low — production service |
| Supabase Storage | Evidence document upload | Supabase (managed) | Low |
| Email delivery (Supabase Email or Resend) | OTP delivery, approval/rejection notifications | TBD — needs vendor selection | Medium — requires DNS setup (SPF/DKIM) |
| Phone OTP (Twilio or Supabase Phone Auth) | Phone verification for claim | Out of scope v1 | N/A |

### Internal Dependencies

| Dependency | Description | Status |
|------------|-------------|--------|
| Mock `businessAuthContext.tsx` | Must be replaced | In scope |
| `master_business_info` schema | Must be extended (Migration 001) | In scope |
| Admin auth system | Admin approval calls assume `role = 'admin'` in JWT; full admin Supabase Auth migration is a separate PRD | Dependency — admin auth PRD must ship first or concurrently |
| `src/types/business.ts` vs `src/types/supabase.ts` | These two type files model the same entity differently. A mapping layer or consolidated type is needed | Debt item — in scope as part of this integration |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `master_business_info` missing phone/email for many records | High | Medium | Implement document upload fallback (FR-02-09) |
| Admin auth not available when this ships | Medium | High | Define a temporary admin API key mechanism or ship admin auth PRD first |
| Email deliverability issues for OTP | Medium | Medium | Configure SPF/DKIM early; test with real addresses in staging |
| Business owner has wrong expectations (expects instant approval) | High | Low | "24–48 hours" messaging throughout the success flow (already in existing UI) |
| `business_id` bigint vs string `id` type mismatch causes runtime errors | High | Medium | Audit all usages of `business.id` before migration; update `src/types/business.ts` mapping |

---

## 13. Acceptance Criteria (System-Level)

The following scenarios must all pass in the staging environment before this feature is released to production.

### Happy Path: End-to-End Claim

1. A new user signs up at `/business/claim/42` with a valid email.
2. They verify their email via the confirmation link.
3. They return to the claim flow, select "Verify via email", receive an OTP, and enter it correctly.
4. `business_claims` contains a new row with `status = 'pending'`, `owner_id` matching the new user, `business_id = 42`.
5. `business_owners.claim_status = 'pending'`.
6. Admin signs in, navigates to `/admin/dashboard/businesses`, selects "Pending Claims", sees the new claim.
7. Admin approves the claim.
8. `business_claims.status = 'approved'`, `master_business_info.owner_id` is set, `master_business_info.tier = 'free'`.
9. Owner receives approval email.
10. Owner signs in and reaches `/business/dashboard` with their business profile loaded.

### Fraud Prevention: Duplicate Claim Blocked

1. Owner A submits a claim for business 42 (now pending).
2. Owner B attempts to submit a claim for business 42.
3. Owner B's submission returns an error "A claim for this business is already under review."
4. Only one `pending` row exists in `business_claims` for `business_id = 42`.

### Data Integrity: Claim Rejection

1. Admin rejects a pending claim with reason "Insufficient documentation."
2. `business_claims.status = 'rejected'`, `business_owners.claim_status = 'rejected'`.
3. `master_business_info.owner_id` remains `NULL`.
4. Owner receives rejection email with the stated reason.

### New Listing Path

1. Owner creates account, submits `CreateBusinessForm` for a business not in DB.
2. A new `master_business_info` row is created with `tier = 'unclaimed'` and `process_flag = 'owner_created_pending_review'`.
3. A `business_claims` row is created with `claim_type = 'new_listing'` and `status = 'pending'`.
4. Owner dashboard shows "Under Review" state, not full access.

### Session Durability

1. Owner signs in, navigates to `/business/dashboard`.
2. They close the browser tab and reopen it.
3. They are still authenticated (Supabase session cookie persists).
4. No localStorage is consulted for auth state.

---

## 14. Out of Scope

The following items are explicitly not in scope for this PRD:

| Item | Reason |
|------|--------|
| Phone OTP delivery via Twilio | Requires telephony vendor setup; document upload covers the verification gap |
| Admin Supabase Auth migration | Separate PRD. Admin auth must be resolved in parallel (see section 12 dependencies) |
| Dual-role accounts (consumer + business owner on same email) | Adds architectural complexity; owners can use a separate email for their business account |
| Business subscription / upgrade to `paid` tier | Separate billing PRD |
| Multi-owner / team access for a single business | v2 feature; one owner per business is sufficient for MVP |
| Full business profile enrichment UI beyond the existing `businessProfileForm.tsx` | UI already exists; integration with real data is a follow-on task |
| Automated business duplicate detection across the full DB | Case 9 covers the creation path; a broader deduplication sweep is a data-ops task |
| Stripe payment integration | Separate PRD |
| Real-time admin notifications for new claims (e.g., Slack webhook) | Operational enhancement; admin polling the queue manually is acceptable for v1 volumes |

---

## 15. Appendix: Migration Checklist

Use this as the engineering team's handoff reference when replacing the mock layer with real Supabase data.

### Pre-Migration

- [ ] Confirm Supabase project `kdlpkjzcnbkjcvwsvlwn` has Supabase Auth enabled with email provider
- [ ] Configure email provider (Supabase Email or Resend) with SPF/DKIM for the sending domain
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables (server-only)
- [ ] Create `claim-documents` storage bucket (private, 10 MB limit, JPEG/PNG/PDF only)
- [ ] Run Migration 001 (`master_business_info` extension) on staging
- [ ] Run Migration 002 (`business_owners` creation) on staging
- [ ] Run Migration 003 (`business_claims` creation) on staging
- [ ] Apply RLS policies from section 7 on staging
- [ ] Verify existing RLS on `master_business_info` still allows anon read access after Migration 001

### During Migration

- [ ] Replace `businessAuthContext.tsx` — keep the same exported interface until all consumers are updated
- [ ] Update `src/types/businessOwner.ts` per section 9.8
- [ ] Create the `src/types/business.ts` ↔ `master_business_info` mapping layer
- [ ] Upgrade `businessSearchModal.tsx` to use `GET /api/businesses/search`
- [ ] Upgrade claim page to use real `master_business_info` data
- [ ] Upgrade `claimBusinessFlow.tsx` to use real OTP and claim API
- [ ] Remove direct `linkBusiness()` and `updateClaimStatus('approved')` calls from claim flow
- [ ] Upgrade `create/page.tsx` to use real business creation API
- [ ] Add Pending Claims tab to admin businesses page
- [ ] Implement dashboard auth guard checking real `claim_status`

### Post-Migration Verification

- [ ] Run all system-level acceptance criteria from section 13 on staging
- [ ] Verify no references to `mock-data/businesses` remain in the claim or create flows
- [ ] Verify `dynamicOwners[]` array is removed from `businessAuthContext.tsx`
- [ ] Test session persistence across browser close and reopen
- [ ] Test OTP expiry (wait 10+ minutes, confirm code no longer accepted)
- [ ] Test 3-attempt OTP lockout
- [ ] Test admin approve → verify DB state and owner email
- [ ] Test admin reject → verify DB state and owner email
- [ ] Confirm evidence document signed URL requires admin JWT (try accessing without auth)
- [ ] Run `npm run check` (Biome linter) — no new lint errors

---

*This document is a living specification. Updates should be versioned by incrementing the version number and recording the change date in this header.*
