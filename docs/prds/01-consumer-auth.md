# PRD: Consumer Authentication & Onboarding

**Document ID:** PRD-01
**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-20
**Author:** Product

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Research & Personas](#3-user-research--personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Schema](#6-database-schema)
7. [API Design — Server Actions](#7-api-design--server-actions)
8. [Frontend Integration Map](#8-frontend-integration-map)
9. [Session & Middleware Architecture](#9-session--middleware-architecture)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Dependencies & Blockers](#11-dependencies--blockers)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Out of Scope](#13-out-of-scope)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

### Problem Statement

CostFinders currently operates with fully mock authentication. Auth state is persisted in `localStorage` using a plain user ID, passwords are never validated, and no data survives a browser clear or a different device. All consumer data — saved deals, alert preferences, verification status — exists exclusively in browser memory or localStorage. This is a pre-launch stub.

The business model depends on the **"anonymous until committed" gate**: a consumer may freely browse deal prices and categories, but the business identity (name, address, phone, website) is hidden behind a wall that requires account creation and deal claim. That gate is currently unenforced at the data layer — any consumer can see the full `Deal` object in React state regardless of auth status.

### Solution Overview

Replace the mock auth layer with a production Supabase Auth integration. This involves:

- Supabase email/password signup and magic-link login wired to the existing UI components
- Server-side email verification via Supabase's built-in token flow
- Phone verification via Twilio Verify (SMS OTP)
- httpOnly cookie-based sessions managed by `@supabase/ssr` (replaces localStorage)
- Next.js middleware route protection for `/dashboard/**` routes
- `profiles` table in Postgres extending `auth.users` for all consumer metadata
- `saved_deals` table for persistent cross-device deal collections
- RLS policies enforcing per-user data access at the database layer

### Business Impact

| Metric | Current State | Post-Implementation |
|--------|--------------|---------------------|
| Auth persistence | Session only (localStorage) | Permanent (Supabase + cookie) |
| Cross-device continuity | None | Full |
| Business contact gate enforcement | UI only | Database + middleware |
| XSS risk from auth tokens | High (localStorage) | Eliminated (httpOnly cookies) |
| Route protection | Client-side context check | Server-side middleware |
| Deal claim data | localStorage | Supabase `claims` table |

### Resource Requirements

- 1 backend/fullstack engineer, approximately 2 weeks
- Twilio account with Verify product enabled (SMS OTP)
- Supabase project already provisioned (`kdlpkjzcnbkjcvwsvlwn`)
- Environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Twilio delivery failures in certain US regions | Low | Medium | Provide "resend" + "skip for now" fallback |
| Email deliverability for verification emails | Low | High | Configure custom SMTP in Supabase; SPF/DKIM |
| Existing localStorage data loss on migration | High | Low | Users have no real data to lose; mock only |
| Breaking existing UI components | Medium | Medium | Preserve identical prop interfaces; swap only the context implementation |
| Rate limit abuse on SMS OTP | Medium | Medium | Enforce Twilio rate limits + per-IP throttle in middleware |

---

## 2. Product Overview

### Product Vision

CostFinders enables price-transparent discovery of medical spa treatments. The consumer auth system is the foundation of the platform's lead generation model: an authenticated, email-verified consumer represents a qualified intent signal to the business. The authentication and onboarding flow must reflect the platform's Bold & Warm design language — warm, approachable, and low-friction — while collecting sufficient identity signal (email + optional phone) to generate credible leads.

### Target Users

**Primary: Deal-seeking consumer**
- Age 25–45, predominantly female
- Browsing on mobile, frequently in-session on an intent search
- Skeptical of creating accounts before seeing value
- Expects the process to take under 2 minutes

**Secondary: High-intent claimer**
- Has already found a deal they want
- Willing to verify email and phone to unlock business contact details
- May be in a busy context (at work, commuting) — must be able to complete verification asynchronously

### Value Proposition

For the consumer: a single account to save deals across devices, get notified of new offers in their treatment categories, and have a record of their claim history.

For the platform: a verified email address turns an anonymous page view into a marketable lead for the business.

### Key Constraint: Anonymous Until Committed

This is the most important business rule in this PRD.

Consumers browse anonymously. Deal listings display treatment type, price, discount percentage, and a blurred business image. **The business name, address, phone number, website, and social links are hidden.** These fields are exposed only after:

1. The consumer has a Supabase Auth session (email/password or magic link), AND
2. The consumer has confirmed their email address (Supabase `email_confirmed_at` is set), AND
3. The consumer has explicitly claimed the deal (a `claims` row exists linking consumer to deal)

This gate must be enforced at two layers:
- The Server Action that returns full deal data checks the session + claim record
- The `claimed_deals_access` RLS policy on the Supabase view enforces the same rule at the DB layer

### Success Criteria

| Goal | Metric | Target |
|------|--------|--------|
| Signup conversion | % of auth modal opens that result in account creation | > 55% |
| Email verification completion | % of signups that verify within 24h | > 70% |
| Phone verification completion | % of email-verified users who also add phone | > 40% |
| Session durability | % of returning users automatically signed in | > 95% |
| Auth errors in first 30 days | Sentry error rate on auth actions | < 0.5% |

---

## 3. User Research & Personas

### Jobs to Be Done

**Job 1 (Primary):** "When I find a medspa deal I want, I need to create an account quickly so I can unlock the business contact details before I lose interest."

**Job 2 (Secondary):** "When I return to the platform after a week, I need my saved deals and claim history to be intact so I don't have to start over."

**Job 3 (Tertiary):** "When a deal I bookmarked drops in price or expires soon, I need a notification so I don't miss it."

### User Journey: First-Time Claimer

```
Browse deal listing (anonymous)
  → Click "Claim this deal"
  → Auth gate triggered (ClaimCTA → AuthModal)
  → User chooses sign up
  → Enters email + password + optional name (SignUpForm)
  → Supabase creates auth.users record + profiles row
  → Redirected to email verification screen (EmailVerification)
  → User clicks link in verification email
  → Supabase confirms email, sets email_confirmed_at
  → User returned to app, session established
  → Phone verification offered but skippable (PhoneVerification)
  → Deal claim completes, business details revealed
  → User lands on /dashboard with active claim
```

### User Journey: Returning User

```
Lands on any page (no session)
  → Middleware checks for Supabase session cookie
  → No valid session found; public pages render normally
  → User clicks "Sign in" in GlobalHeader
  → AuthModal opens in signIn view
  → User enters email + password OR clicks magic link
  → Supabase validates credentials, sets session cookie
  → Modal closes, page re-renders with authenticated state
  → /dashboard/* routes now accessible
```

---

## 4. Functional Requirements

### 4.1 Core Authentication Features

#### F-AUTH-01: Email/Password Signup

The consumer provides an email address, a password (minimum 8 characters), and optional first/last name. On submission, the system:

1. Calls `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })`
2. Supabase creates an `auth.users` record with `email_confirmed_at = null`
3. Supabase sends a verification email containing a one-time token link
4. The system creates a `profiles` row via a Postgres `after insert` trigger on `auth.users`
5. The UI transitions to the `emailVerification` view within `AuthModal`

The trigger approach for `profiles` creation is preferred over a Server Action call to avoid race conditions and to ensure the profile row always exists regardless of how signup is performed.

#### F-AUTH-02: Magic Link Login

The consumer enters their email address and requests a magic link. The system:

1. Calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`
2. Supabase sends a magic link email valid for 1 hour
3. The consumer clicks the link, which redirects to `/auth/callback?token_hash=...&type=magiclink`
4. The callback route exchanges the token for a session via `supabase.auth.exchangeCodeForSession()`
5. The user is redirected to their original destination or `/dashboard`

`shouldCreateUser: false` prevents accidental account creation via magic link for users who have not yet signed up.

#### F-AUTH-03: Email/Password Sign In

The consumer provides their email and password. The system:

1. Calls `supabase.auth.signInWithPassword({ email, password })`
2. On success, `@supabase/ssr` writes the session to httpOnly cookies
3. The auth state in `AuthContext` updates with the session user
4. The UI closes the `AuthModal` and reflects the authenticated state

Error cases: "Invalid login credentials" (Supabase default) is mapped to the copy standard: "Email or password is incorrect."

#### F-AUTH-04: Sign Out

1. Calls `supabase.auth.signOut()`
2. `@supabase/ssr` clears the session cookies
3. `AuthContext` clears the user state
4. If the user is on a protected route (`/dashboard/**`), middleware redirects to `/`

#### F-AUTH-05: Password Reset

1. Consumer clicks "Forgot password?" in `SignInForm`
2. System calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/callback?next=/dashboard/settings' })`
3. Consumer receives a password reset email with a one-time link
4. On click, the callback route handles `type=recovery` and redirects to a password update form
5. Consumer sets a new password via `supabase.auth.updateUser({ password: newPassword })`

Note: The password update form is a new page required by this feature (`/auth/reset-password`). It is not part of the existing UI. It is in scope for this PRD.

### 4.2 Email Verification

#### F-VERIFY-EMAIL-01: Supabase-Native Token Flow

Supabase handles email verification natively. When the consumer signs up:

- Supabase emails a link: `https://[project].supabase.co/auth/v1/verify?token=...&type=signup`
- The link resolves to the app's `/auth/callback` route handler
- The route handler calls `supabase.auth.exchangeCodeForSession(code)` using the PKCE flow
- On success, `email_confirmed_at` is set in `auth.users`
- The `profiles` table is updated: `verification_status = 'email_verified'`
- The user is redirected to their original destination

#### F-VERIFY-EMAIL-02: Manual Code Entry (Optional Secondary Flow)

The existing `EmailVerification` component UI includes a "enter code manually" path. For this to work:

- Signup must use `options.emailRedirectTo` pointing to `/auth/callback`
- The 6-digit code entry UI in `emailVerification.tsx` requires a change: instead of accepting any 6-digit code, it must call `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })`
- This secondary path is lower-priority but keeps the existing UI functional

#### F-VERIFY-EMAIL-03: Resend Verification Email

- The "Resend" button calls `supabase.auth.resend({ email, type: 'signup' })`
- Rate limited to 1 resend per minute per email (enforced by Supabase natively)
- Copy on success: "Email sent. Check your inbox."

### 4.3 Phone Verification

#### F-VERIFY-PHONE-01: Send OTP via Twilio Verify

The consumer enters a US phone number. The Server Action:

1. Validates the number using the `libphonenumber-js` library (E.164 format)
2. Checks that this phone number is not already associated with another `profiles` row
3. Calls the Twilio Verify API: `client.verify.v2.services(VERIFY_SID).verifications.create({ to: e164Phone, channel: 'sms' })`
4. Returns `{ success: true }` — does not expose any Twilio internal IDs to the client

#### F-VERIFY-PHONE-02: Verify OTP Code

The consumer enters the 6-digit code. The Server Action:

1. Calls `client.verify.v2.services(VERIFY_SID).verificationChecks.create({ to: e164Phone, code })`
2. On `approved` status: updates `profiles` row — sets `phone`, `phone_verified_at`, and recalculates `verification_status`
3. On failure: returns the error message; after 5 failed attempts, Twilio cancels the verification automatically

#### F-VERIFY-PHONE-03: Verification Status State Machine

```
unverified
  → (email confirmed)     → email_verified
  → (phone confirmed)     → phone_verified
  → (both confirmed)      → fully_verified
email_verified
  → (phone confirmed)     → fully_verified
phone_verified
  → (email confirmed)     → fully_verified
```

The `verification_status` column in `profiles` is a computed-style denormalization derived from `email_verified_at` and `phone_verified_at`. It is kept in sync by the `update_verification_status()` Postgres trigger function, which fires after any update to `email_verified_at` or `phone_verified_at`.

### 4.4 Profile Management

#### F-PROFILE-01: Read Profile

On session restoration, the app fetches the consumer's full profile:

```sql
select * from profiles where id = auth.uid()
```

This is called server-side in the root layout's server component, passed as a prop to the `AuthProvider`, and used to initialize auth state. The `AuthProvider` no longer reads from localStorage.

#### F-PROFILE-02: Update Profile

The `ProfileForm` component's submit handler calls a Server Action `updateProfile()`:

Updatable fields: `first_name`, `last_name`, `phone` (unverified update), `location_city`, `location_state`

Updating `phone` here does not set `phone_verified_at`. That requires completing the phone OTP flow (F-VERIFY-PHONE-02). The UI should make this distinction clear.

#### F-PROFILE-03: Update Alert Preferences

The `AlertPreferences` component toggles call a Server Action `updateAlertPreferences()`:

Updatable fields: `alerts_email`, `alerts_sms`

SMS alerts can only be enabled if `phone_verified_at` is not null. The Server Action enforces this independently of the UI toggle state.

### 4.5 Saved Deals Persistence

#### F-SAVES-01: Save a Deal

When a consumer clicks the save/heart button on a deal:

1. If not authenticated: `AuthModal` opens with `initialView='signUp'`; deal save is queued and completes after auth
2. If authenticated: Server Action `saveDeal(dealId)` inserts a row into `saved_deals`
3. Optimistic UI: the save state updates immediately in `AuthContext`; on Server Action failure, it reverts

#### F-SAVES-02: Unsave a Deal

Server Action `unsaveDeal(dealId)` deletes the row from `saved_deals` where `consumer_id = auth.uid() AND deal_id = dealId`.

#### F-SAVES-03: List Saved Deals

The `/dashboard/favorites` page fetches saved deals server-side:

```sql
select deal_id, saved_at from saved_deals where consumer_id = auth.uid() order by saved_at desc
```

The `deal_id` values are UUIDs referencing deal records in `promo_offer_master`. The page then fetches deal details for each ID.

#### F-SAVES-04: Migration from localStorage

On first authenticated session load, the app checks localStorage for `costfinders_saved_deals`. If present and non-empty, a Server Action `migrateLocalSavedDeals(dealIds)` bulk-inserts the IDs into `saved_deals` (using `ON CONFLICT DO NOTHING`), then clears the localStorage key. This migration runs once per device.

### 4.6 Deal Alert Preferences Persistence

Alert preferences (`alerts_email`, `alerts_sms`) are stored in the `profiles` table and persist across devices. The `AlertPreferences` component reads from and writes to the `profiles` row. No separate table is needed for this feature.

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Auth Server Action round-trip (sign in) | < 800ms p95 | Vercel function logs |
| Profile fetch on page load | < 300ms p95 | Supabase dashboard |
| Phone OTP send | < 2s p95 | Twilio delivery reports |
| Session cookie read (middleware) | < 5ms | Middleware execution time |

Server-side session validation in middleware must not add perceptible latency to page loads. The `@supabase/ssr` cookie approach reads the session from the cookie header — no network round-trip to Supabase — and verifies it via JWT signature locally. This is the correct implementation; do not use `supabase.auth.getUser()` in the middleware hot path.

### 5.2 Security

**S-01: httpOnly Cookies — mandatory.** No auth tokens in localStorage or `sessionStorage`. Use `@supabase/ssr` `createServerClient` with the cookies adapter. The cookie must be set with `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'`.

**S-02: PKCE Flow.** All OAuth and magic link flows use PKCE. The code verifier is stored in a cookie (not localStorage) by `@supabase/ssr`.

**S-03: Input Sanitization.** All profile update fields (name, city, state) are trimmed and stripped of HTML before persistence. Use `DOMPurify` on the server or a simple strip-tags utility. Phone numbers are validated against E.164 format.

**S-04: Rate Limiting.** Phone OTP send endpoints are rate-limited to 3 requests per phone number per 10 minutes, enforced in the Server Action before calling Twilio. Email resend is rate-limited natively by Supabase.

**S-05: RLS Enforcement.** The `profiles` and `saved_deals` tables have RLS enabled. All queries from the app use the user's JWT (service role key is never exposed to the client). See Section 6 for policy SQL.

**S-06: No Sensitive Data in Client State.** The `AuthContext` consumer-facing object never includes `email_verified_at` raw timestamps, Twilio tokens, or any internal Supabase metadata beyond what the `Consumer` type in `src/types/consumer.ts` already defines.

### 5.3 Usability

- Email verification flow must be completable without leaving the original tab (the verification link opens in the same browser context)
- Phone verification is optional at sign-up; consumers can complete it later from `/dashboard/settings`
- The auth modal must close and return the user to their original context on success; no forced redirects for public page users
- SMS opt-in copy must comply with TCPA; include explicit opt-in language before the first SMS is sent

### 5.4 Reliability

- Supabase Auth has a published SLA of 99.9% uptime
- Twilio Verify has a published SLA of 99.95%
- The app must degrade gracefully when Twilio is unavailable: phone verification shows "SMS is temporarily unavailable. Try again later." and allows the user to skip
- Session cookies must include an appropriate `max-age` (default Supabase session: 1 hour access token, 7-day refresh token). The middleware must refresh the access token using the refresh token if it has expired, without requiring the user to sign in again

### 5.5 Compliance

- TCPA: explicit written consent required before sending SMS. The phone verification UI must include: "By continuing, you agree to receive a one-time verification code via SMS. Message and data rates may apply."
- CAN-SPAM: marketing email alerts (deal alerts) require a one-click unsubscribe mechanism. This is handled by the `alerts_email` preference toggle.
- CCPA: consumers can request account deletion. The current implementation routes to `support@costfinders.com` via the settings page UI. This is acceptable for v1.

---

## 6. Database Schema

### 6.1 `profiles` Table

Extends `auth.users`. Created automatically via trigger on user creation.

```sql
-- Enable UUID extension (already present in Supabase projects)
-- create extension if not exists "uuid-ossp";

create table public.profiles (
  -- Identity: mirrors auth.users.id
  id                  uuid primary key references auth.users(id) on delete cascade,

  -- Personal info
  first_name          text,
  last_name           text,
  avatar_url          text,

  -- Contact
  phone               text,
  phone_verified_at   timestamptz,

  -- Verification
  -- email_verified_at is read from auth.users; not duplicated here
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','email_verified','phone_verified','fully_verified')),

  -- Location preferences
  location_city       text,
  location_state      text,

  -- Alert preferences
  alerts_email        boolean not null default false,
  alerts_sms          boolean not null default false,

  -- Favorite categories (stored as a Postgres text array; small and bounded)
  favorite_categories text[] not null default '{}',

  -- Account status
  status              text not null default 'active'
    check (status in ('active','suspended')),

  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_login_at       timestamptz
);

comment on table public.profiles is 'Consumer profile data extending auth.users. One row per authenticated user.';
comment on column public.profiles.verification_status is 'Denormalized from email_verified_at (auth.users) and phone_verified_at. Maintained by trigger.';
```

### 6.2 `saved_deals` Table

```sql
create table public.saved_deals (
  id            bigint generated always as identity primary key,
  consumer_id   uuid not null references public.profiles(id) on delete cascade,
  -- deal_id references promo_offer_master.id (bigint FK)
  deal_id       bigint not null,
  saved_at      timestamptz not null default now(),

  constraint saved_deals_unique unique (consumer_id, deal_id)
);

create index saved_deals_consumer_idx on public.saved_deals (consumer_id);
create index saved_deals_deal_idx     on public.saved_deals (deal_id);

comment on table public.saved_deals is 'Persistent saved deals per consumer. Replaces localStorage costfinders_saved_deals.';
```

### 6.3 `claims` Table

Claims currently live in `localStorage` under `costfinders_claims`. This PRD moves them to Supabase. This table is required for the anonymous-until-committed gate to work — the Server Action that reveals business contact details queries this table.

```sql
create type public.claim_status as enum (
  'pending', 'contacted', 'booked', 'completed', 'cancelled', 'expired'
);

create table public.claims (
  id                uuid primary key default gen_random_uuid(),
  consumer_id       uuid not null references public.profiles(id) on delete cascade,
  deal_id           bigint not null,
  business_id       bigint not null,
  status            public.claim_status not null default 'pending',

  -- Consumer-provided scheduling context
  preferred_date    date,
  preferred_time    text,
  notes             text,

  -- Business response
  business_response text,
  responded_at      timestamptz,

  -- Booking confirmation
  booked_date       date,
  booked_time       text,

  -- Expiry: 7 days from creation if not contacted
  expires_at        timestamptz not null default (now() + interval '7 days'),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint claims_unique_active unique (consumer_id, deal_id)
    deferrable initially deferred
  -- Note: allows re-claiming if previous claim is cancelled/expired.
  -- The unique constraint is partial; see partial index below.
);

-- Only enforce uniqueness on active claims
create unique index claims_active_unique
  on public.claims (consumer_id, deal_id)
  where status not in ('cancelled', 'expired');

create index claims_consumer_idx  on public.claims (consumer_id);
create index claims_deal_idx      on public.claims (deal_id);
create index claims_business_idx  on public.claims (business_id);
create index claims_status_idx    on public.claims (status);
```

### 6.4 Triggers

#### Trigger 1: Auto-create `profiles` row on user signup

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, created_at, updated_at)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    now(),
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

#### Trigger 2: Sync `verification_status` when email or phone is verified

```sql
create or replace function public.sync_verification_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_email_verified boolean;
  v_phone_verified boolean;
  v_new_status     text;
begin
  -- Check email verification from auth.users
  select (email_confirmed_at is not null)
  into v_email_verified
  from auth.users
  where id = new.id;

  v_phone_verified := (new.phone_verified_at is not null);

  if v_email_verified and v_phone_verified then
    v_new_status := 'fully_verified';
  elsif v_email_verified then
    v_new_status := 'email_verified';
  elsif v_phone_verified then
    v_new_status := 'phone_verified';
  else
    v_new_status := 'unverified';
  end if;

  new.verification_status := v_new_status;
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_profile_verification_change
  before update of phone_verified_at on public.profiles
  for each row execute procedure public.sync_verification_status();
```

Note: Email verification happens in `auth.users`, not `profiles`. A second trigger on `auth.users` propagates the status change to `profiles`:

```sql
create or replace function public.sync_email_verification_to_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone_verified boolean;
  v_new_status     text;
begin
  -- Only act when email_confirmed_at transitions from null to a value
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select (phone_verified_at is not null)
    into v_phone_verified
    from public.profiles
    where id = new.id;

    if v_phone_verified then
      v_new_status := 'fully_verified';
    else
      v_new_status := 'email_verified';
    end if;

    update public.profiles
    set verification_status = v_new_status,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute procedure public.sync_email_verification_to_profile();
```

#### Trigger 3: Update `last_login_at` on sign in

```sql
create or replace function public.handle_user_login()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
    set last_login_at = new.last_sign_in_at,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_login
  after update of last_sign_in_at on auth.users
  for each row execute procedure public.handle_user_login();
```

### 6.5 Row Level Security Policies

```sql
-- ========== profiles ==========
alter table public.profiles enable row level security;

-- Consumers can read their own profile
create policy "profiles: owner read"
  on public.profiles for select
  using (auth.uid() = id);

-- Consumers can update their own profile
create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Inserts handled by trigger (security definer); no direct client insert
-- Service role can do anything (bypasses RLS by design)


-- ========== saved_deals ==========
alter table public.saved_deals enable row level security;

create policy "saved_deals: owner read"
  on public.saved_deals for select
  using (auth.uid() = consumer_id);

create policy "saved_deals: owner insert"
  on public.saved_deals for insert
  with check (auth.uid() = consumer_id);

create policy "saved_deals: owner delete"
  on public.saved_deals for delete
  using (auth.uid() = consumer_id);


-- ========== claims ==========
alter table public.claims enable row level security;

-- Consumers can read their own claims
create policy "claims: consumer read"
  on public.claims for select
  using (auth.uid() = consumer_id);

-- Consumers can create claims (authenticated + email verified required — enforced in Server Action)
create policy "claims: consumer insert"
  on public.claims for insert
  with check (auth.uid() = consumer_id);

-- Consumers can cancel their own pending claims
create policy "claims: consumer cancel"
  on public.claims for update
  using (auth.uid() = consumer_id and status = 'pending')
  with check (status = 'cancelled');
```

### 6.6 Environment Variables Required

```
# Already present
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# New — server-side only (never NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=

# Twilio Verify
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

---

## 7. API Design — Server Actions

All mutations use Next.js Server Actions (no separate API routes for auth operations). Server Actions run server-side and can safely hold service credentials.

File location convention: `src/lib/actions/auth.ts`, `src/lib/actions/profile.ts`, `src/lib/actions/deals.ts`

### 7.1 Auth Actions (`src/lib/actions/auth.ts`)

```typescript
// Sign up with email and password
// Returns: { error: string | null }
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<{ error: string | null }>

// Sign in with email and password
// Returns: { error: string | null }
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<{ error: string | null }>

// Request magic link (sign in only; no signup via magic link)
// Returns: { error: string | null }
export async function requestMagicLink(
  email: string,
): Promise<{ error: string | null }>

// Sign out
// Returns: void
export async function signOut(): Promise<void>

// Send password reset email
// Returns: { error: string | null }
export async function sendPasswordReset(
  email: string,
): Promise<{ error: string | null }>

// Update password after reset (called from /auth/reset-password page)
// Requires valid recovery session
// Returns: { error: string | null }
export async function updatePassword(
  newPassword: string,
): Promise<{ error: string | null }>

// Resend verification email
// Returns: { error: string | null }
export async function resendVerificationEmail(
  email: string,
): Promise<{ error: string | null }>
```

### 7.2 Phone Verification Actions (`src/lib/actions/phoneVerification.ts`)

```typescript
// Send SMS OTP via Twilio Verify
// e164Phone: validated E.164 format e.g. "+12025551234"
// Returns: { error: string | null }
export async function sendPhoneOtp(
  e164Phone: string,
): Promise<{ error: string | null }>

// Verify OTP code from SMS
// Returns: { success: boolean; error: string | null }
export async function verifyPhoneOtp(
  e164Phone: string,
  code: string,
): Promise<{ success: boolean; error: string | null }>
```

Internal logic for `verifyPhoneOtp`:

1. Call Twilio Verify check
2. If `approved`: run `supabase.from('profiles').update({ phone: e164Phone, phone_verified_at: new Date().toISOString() }).eq('id', userId)`
3. The `sync_verification_status` trigger fires and updates `verification_status` automatically
4. Return `{ success: true, error: null }`

### 7.3 Profile Actions (`src/lib/actions/profile.ts`)

```typescript
// Fetch current user's profile (used server-side in layouts)
// Returns: Profile | null
export async function getProfile(): Promise<Profile | null>

// Update profile fields
// Returns: { error: string | null }
export async function updateProfile(updates: {
  firstName?: string
  lastName?: string
  phone?: string          // setting phone here does NOT set phone_verified_at
  locationCity?: string
  locationState?: string
}): Promise<{ error: string | null }>

// Update alert preferences
// Enforces: alertsSms can only be true if phone_verified_at is set
// Returns: { error: string | null }
export async function updateAlertPreferences(
  alertsEmail: boolean,
  alertsSms: boolean,
): Promise<{ error: string | null }>
```

### 7.4 Saved Deals Actions (`src/lib/actions/deals.ts`)

```typescript
// Save a deal
// Requires: authenticated session
// Returns: { error: string | null }
export async function saveDeal(
  dealId: number,
): Promise<{ error: string | null }>

// Unsave a deal
// Returns: { error: string | null }
export async function unsaveDeal(
  dealId: number,
): Promise<{ error: string | null }>

// Get all saved deal IDs for the current user
// Used server-side in /dashboard/favorites
// Returns: number[]
export async function getSavedDealIds(): Promise<number[]>

// Migrate saved deals from localStorage (runs once per device on first auth)
// dealIds: array of deal IDs from localStorage
// Returns: { migratedCount: number; error: string | null }
export async function migrateLocalSavedDeals(
  dealIds: number[],
): Promise<{ migratedCount: number; error: string | null }>
```

### 7.5 Claims Actions (`src/lib/actions/claims.ts`)

```typescript
// Create a new claim
// Requires: authenticated + email_verified
// Returns: { claimId: string | null; error: string | null }
export async function createClaim(
  dealId: number,
  businessId: number,
  options?: { preferredDate?: string; preferredTime?: string; notes?: string },
): Promise<{ claimId: string | null; error: string | null }>

// Get claims for the current user
// Returns: Claim[]
export async function getClaims(): Promise<Claim[]>

// Cancel a pending claim
// Returns: { error: string | null }
export async function cancelClaim(
  claimId: string,
): Promise<{ error: string | null }>

// Reveal business contact details for a claimed deal
// Enforces: consumer must have active claim on this deal AND email must be verified
// Returns: BusinessContactDetails | null
export async function getBusinessContactDetails(
  dealId: number,
): Promise<BusinessContactDetails | null>
```

`getBusinessContactDetails` is the enforcement point for the "anonymous until committed" gate. It queries:

```sql
select
  b.name,
  b.address,
  b.city,
  b.website,
  b.facebook_url,
  b.instagram_url
from master_business_info b
inner join claims c on c.business_id = b.business_id
where
  c.deal_id = $1
  and c.consumer_id = auth.uid()
  and c.status not in ('cancelled', 'expired')
  and exists (
    select 1 from auth.users
    where id = auth.uid()
    and email_confirmed_at is not null
  )
```

If no row is returned, the Server Action returns `null` and the client shows the blurred/locked state.

---

## 8. Frontend Integration Map

### 8.1 `AuthContext` Replacement

**File:** `src/lib/context/authContext.tsx`

This is the central change. The context interface (`AuthContextValue`) must remain identical to the current definition — all consuming components (`signInForm.tsx`, `signUpForm.tsx`, `authModal.tsx`, etc.) must work without modification beyond their hook calls.

**What changes internally:**
- `signUp` calls `signUpWithEmailPassword` Server Action instead of creating a mock user
- `signIn` calls `signInWithEmailPassword` Server Action instead of a localStorage lookup
- `signOut` calls the `signOut` Server Action instead of clearing localStorage
- `verifyPhone` calls `verifyPhoneOtp` Server Action
- `updateProfile` calls `updateProfile` Server Action
- `updateAlertPreferences` calls `updateAlertPreferences` Server Action
- `savedDeals` is initialized from server-fetched data, not localStorage
- `saveDeal` / `unsaveDeal` call Server Actions with optimistic update
- Session restoration: reads from Supabase client `onAuthStateChange` listener instead of localStorage

**Migration path:** Replace the implementation inside `AuthProvider`, keep the exported `AuthContextValue` type and `useAuth` hook signature unchanged.

### 8.2 Component-by-Component Integration

| Component | File | Current Binding | Required Change |
|-----------|------|-----------------|-----------------|
| `SignUpForm` | `signUpForm.tsx` | `useAuth().signUp()` mock | No change to component — context implementation changes |
| `SignInForm` | `signInForm.tsx` | `useAuth().signIn()` mock | Add magic link tab (optional v1.1); password reset hook calls real action |
| `EmailVerification` | `emailVerification.tsx` | `updateVerificationStatus('email_verified')` mock | "Enter code manually" button calls `supabase.auth.verifyOtp()`; "Resend" calls `resendVerificationEmail` action |
| `PhoneVerification` | `phoneVerification.tsx` | `useAuth().verifyPhone()` mock | `handleSendCode` calls `sendPhoneOtp` action; `handleVerifyCode` calls `verifyPhoneOtp` action |
| `ProfileForm` | `profileForm.tsx` | `useAuth().updateProfile()` mock | No change — context implementation changes |
| `AlertPreferences` | `alertPreferences.tsx` | `useAuth().updateAlertPreferences()` mock | No change — context implementation changes |
| `AuthModal` | `authModal.tsx` | Orchestrates views via state | No change required |

### 8.3 Auth Callback Route (New)

**File:** `src/app/auth/callback/route.ts`

This route handles three cases:

1. **Email verification** (`type=signup`): Exchange the code for a session; redirect to `/dashboard`
2. **Magic link** (`type=magiclink`): Exchange the code for a session; redirect to original destination or `/dashboard`
3. **Password reset** (`type=recovery`): Exchange the code for a session; redirect to `/auth/reset-password`

```typescript
// src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Exchange code for session (PKCE)
    // ... createServerClient, supabase.auth.exchangeCodeForSession(code)
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/reset-password`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No code — something went wrong
  return NextResponse.redirect(`${origin}/?auth_error=callback_failed`)
}
```

### 8.4 Password Reset Route (New)

**File:** `src/app/auth/reset-password/page.tsx`

A simple form page: new password + confirm password fields. On submit, calls `updatePassword` Server Action. On success, redirects to `/dashboard/settings`. This page is only accessible with a valid recovery session; middleware redirects unauthenticated requests to `/`.

### 8.5 Dashboard Route Protection

**File:** `src/middleware.ts` (replacing the hypothetical `proxy.ts` naming from the brief)

Next.js 15/16 uses `middleware.ts` at the project root. Note: `middleware.ts` is not inside `src/app/` — it sits at `src/middleware.ts` or at the project root alongside `package.json`. Check the project's existing Next.js config; per the existing codebase there is no middleware file yet.

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  // Refresh session if expired — critical for token rotation
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Protect consumer dashboard
  if (path.startsWith('/dashboard') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.set('auth_required', 'dashboard')
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/callback',
    '/auth/reset-password',
  ],
}
```

Note: `supabase.auth.getUser()` (not `getSession()`) is used in middleware because it validates the token with the Supabase Auth server, not just locally. This is intentional and is the pattern recommended by Supabase for middleware. The slight network latency is acceptable in middleware because it only runs on matched paths.

Business dashboard (`/business/dashboard/**`) and admin (`/admin/dashboard/**`) route protection is outside the scope of this PRD (separate auth systems).

### 8.6 `AuthProvider` Session Initialization

Replace the current `useEffect` that reads from localStorage with:

```typescript
useEffect(() => {
  // Get initial session (reads from cookie, no network call)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      // Fetch full profile from Supabase
      fetchProfile(session.user.id).then((profile) => {
        setState({ user: mapProfileToConsumer(profile, session.user), isAuthenticated: true, isLoading: false, error: null })
        fetchSavedDeals().then(setSavedDeals)
      })
    } else {
      setState((prev) => ({ ...prev, isLoading: false }))
      // Attempt localStorage migration (one-time)
      attemptLocalStorageMigration()
    }
  })

  // Listen for auth state changes (sign in, sign out, token refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      fetchProfile(session.user.id).then((profile) => {
        setState({ user: mapProfileToConsumer(profile, session.user), isAuthenticated: true, isLoading: false, error: null })
      })
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false, error: null })
      setSavedDeals([])
    }
  })

  return () => subscription.unsubscribe()
}, [])
```

The `supabase` client used in `AuthProvider` must be the `@supabase/ssr` browser client, created via `createBrowserClient`. The existing `src/lib/supabase.ts` uses the bare `@supabase/supabase-js` client; it needs a parallel `src/lib/supabase-browser.ts` and `src/lib/supabase-server.ts` following the `@supabase/ssr` pattern.

---

## 9. Session & Middleware Architecture

### 9.1 Client Selection by Context

| Context | Client | Module |
|---------|--------|--------|
| Client components, `AuthProvider` | `createBrowserClient` | `@supabase/ssr` |
| Server Actions, Server Components | `createServerClient` (cookies adapter) | `@supabase/ssr` |
| Middleware (`middleware.ts`) | `createServerClient` (middleware cookies adapter) | `@supabase/ssr` |

The bare `createClient` from `@supabase/supabase-js` (current `src/lib/supabase.ts`) is only appropriate for read-only public queries (deal browsing, business listings) where auth is not required. It should not be used for any auth-related operations.

### 9.2 Cookie Configuration

Supabase `@supabase/ssr` manages three cookies:

| Cookie | Purpose | Lifetime |
|--------|---------|---------|
| `sb-[ref]-auth-token` | Access token (JWT) | ~1 hour |
| `sb-[ref]-auth-token.0` | Refresh token | 7 days (default) |
| `sb-[ref]-auth-token-code-verifier` | PKCE code verifier | Session |

All are set as httpOnly, Secure (production), SameSite=Lax by `@supabase/ssr` automatically.

### 9.3 Token Refresh Flow

Access tokens expire after 1 hour. The middleware calls `supabase.auth.getUser()` on every matched request, which internally refreshes the access token if it has expired using the refresh token. The middleware then copies the updated cookies onto the response via the `setAll` adapter. This means the user's session is silently extended on every page navigation — no user action required.

---

## 10. Edge Cases & Error Handling

### 10.1 Authentication Edge Cases

**EC-01: User signs up with an email already registered**
- Supabase returns error code `user_already_exists`
- Map to copy: "An account with this email already exists. Try signing in instead."
- The `signIn` link in the error message opens the sign-in view within `AuthModal`

**EC-02: User signs up but never verifies email, then tries to sign in**
- `signInWithPassword` succeeds (Supabase allows sign-in before email verification)
- `auth.users.email_confirmed_at` is null
- `profiles.verification_status` is `unverified`
- `AuthModal` detects `verificationStatus === 'unverified'` after sign-in and redirects to `emailVerification` view
- The user is shown the email verification screen again with a resend option

**EC-03: User claims a deal without email verification**
- `createClaim` Server Action checks `auth.users.email_confirmed_at` is not null before inserting
- If null: returns `{ error: 'Please verify your email before claiming deals.' }`
- `AuthModal` opens to `emailVerification` view

**EC-04: Magic link used after expiry (1 hour)**
- Supabase returns `AuthApiError: Invalid JWT`
- The `/auth/callback` route redirects to `/?auth_error=link_expired`
- A banner on the homepage detects this query param and shows: "Your sign-in link has expired. Request a new one."

**EC-05: User opens magic link in a different browser than the one that requested it**
- PKCE code verifier is in a cookie of the original browser — the verification will fail
- User is redirected to `/?auth_error=browser_mismatch`
- Banner copy: "This sign-in link must be opened in the same browser where you requested it."

**EC-06: Concurrent sessions (same user on two devices)**
- Supabase supports multiple sessions per user by default
- Each device has its own session cookie — no conflict
- Sign out on one device does not affect the other

**EC-07: localStorage has saved deals from anonymous user session, then user signs in**
- `attemptLocalStorageMigration()` runs in `AuthProvider` after session is established
- If `costfinders_saved_deals` key is present and non-empty, calls `migrateLocalSavedDeals()`
- Inserts with `ON CONFLICT DO NOTHING` — safe to call multiple times
- Clears localStorage after migration

### 10.2 Phone Verification Edge Cases

**EC-PHONE-01: User enters an already-verified phone number belonging to another account**
- Server Action queries `profiles` for existing `phone` value
- If another `consumer_id` owns that phone: returns `{ error: 'This phone number is already linked to another account.' }`
- Do not expose whose account it belongs to

**EC-PHONE-02: SMS OTP not received**
- User clicks "Resend" — calls `sendPhoneOtp` again (Twilio Verify cancels the previous pending verification and creates a new one)
- After 3 resend attempts within 10 minutes: `{ error: 'Too many requests. Try again in 10 minutes.' }`

**EC-PHONE-03: Twilio service unavailable**
- Catch the Twilio API error in the Server Action
- Return: `{ error: 'SMS is temporarily unavailable. Please try again later or skip for now.' }`
- The `PhoneVerification` component's `onSkip` prop is invoked to allow the user to proceed

**EC-PHONE-04: User enters wrong code multiple times**
- Twilio auto-cancels the verification after 5 failed attempts
- After cancellation, `client.verify.v2.services(SID).verificationChecks.create()` returns `status: 'canceled'`
- Server Action returns: `{ error: 'Code expired. Request a new code.' }`

### 10.3 Profile Edge Cases

**EC-PROFILE-01: User attempts to enable SMS alerts without phone verification**
- Server Action `updateAlertPreferences` checks `profiles.phone_verified_at`
- If null: ignores the `alertsSms=true` value, returns `{ error: 'Please verify your phone number to enable SMS notifications.' }`
- The UI toggle is already disabled for unverified users (existing `alertPreferences.tsx` logic) — this is belt-and-suspenders enforcement

**EC-PROFILE-02: Profile row missing for authenticated user**
- Should not occur if the `handle_new_user` trigger works correctly
- Defensive check: `getProfile()` Server Action returns null; `AuthProvider` creates a minimal `Consumer` object from `auth.users` metadata only and shows a banner prompting profile completion
- Does not block authentication

### 10.4 Session Edge Cases

**EC-SESSION-01: Refresh token expired (user inactive > 7 days)**
- `supabase.auth.getUser()` in middleware returns `null` user
- Middleware redirects `/dashboard/**` requests to `/` with `auth_required=session_expired`
- Banner copy: "Your session has expired. Please sign in again."

**EC-SESSION-02: User's account suspended by admin**
- `profiles.status = 'suspended'`
- The session is still technically valid at the Supabase Auth level
- `AuthProvider` checks `profiles.status` on profile fetch; if `suspended`, calls `signOut()` and shows: "Your account has been suspended. Contact support@costfinders.com."

---

## 11. Dependencies & Blockers

### 11.1 External Dependencies

| Dependency | Purpose | Required For | Notes |
|------------|---------|-------------|-------|
| `@supabase/ssr` | SSR-safe Supabase client with cookie management | All auth operations | Replace current `@supabase/supabase-js` calls for auth |
| `twilio` | Twilio Verify SDK | Phone OTP | Server-side only; never expose credentials |
| `libphonenumber-js` | Phone number validation and E.164 formatting | Phone verification | Lightweight; tree-shakable |

### 11.2 Internal Dependencies

| Item | Depends On | Notes |
|------|------------|-------|
| `middleware.ts` | `@supabase/ssr` installed | Must be added to `package.json` first |
| Phone OTP Server Actions | Twilio credentials in `.env.local` | Dev/staging can use Twilio's test credentials |
| `profiles` trigger | Applied to Supabase project | Run migration SQL via Supabase Studio or Supabase CLI |
| `claims` table | Applied to Supabase project | Required for anonymous-until-committed gate |
| `getBusinessContactDetails` | `claims` table + `profiles` table | Gate enforcement depends on both |
| Dashboard route protection | `middleware.ts` | Without middleware, dashboard is accessible without auth |

### 11.3 Blockers

| Blocker | Owner | Resolution |
|---------|-------|-----------|
| Supabase email SMTP configuration | DevOps / Supabase dashboard | Configure custom SMTP (SendGrid or Postmark) in Supabase Auth settings to avoid verification emails landing in spam |
| Twilio account creation + Verify service setup | DevOps | Create service in Twilio console, copy `VERIFY_SERVICE_SID` to environment variables |
| Supabase service role key | DevOps | Required for Server Actions that need to bypass RLS (e.g., admin-level reads). Available in Supabase dashboard → Settings → API |

### 11.4 Packages to Install

```
npm install @supabase/ssr twilio libphonenumber-js
```

The existing `@supabase/supabase-js` package stays for public read queries. `@supabase/ssr` is the additional package for auth-aware contexts.

---

## 12. Acceptance Criteria

### AC-01: Sign Up Flow

**Given** a visitor on any public page clicks a CTA that requires auth
**When** they complete the `SignUpForm` with a valid email, password (8+ chars), and optional name
**Then** a Supabase `auth.users` record is created, a `profiles` row is created automatically, the UI transitions to `EmailVerification`, and a verification email is sent to the provided address

**Given** the same visitor opens the verification email and clicks the link
**When** the `/auth/callback` route processes the code
**Then** `auth.users.email_confirmed_at` is set, `profiles.verification_status` becomes `email_verified`, the user is redirected to `/dashboard`, and no localStorage writes occur

### AC-02: Sign In Flow

**Given** a registered user with email_confirmed_at set
**When** they complete the `SignInForm` with correct credentials
**Then** a Supabase session is established, the session is stored in httpOnly cookies (not localStorage), `profiles.last_login_at` is updated, and the UI reflects the authenticated state without a page reload

**Given** a registered user enters incorrect credentials
**When** the form is submitted
**Then** the error message "Email or password is incorrect" is shown inline, no session is created, and no Supabase error codes are exposed to the UI

### AC-03: Session Persistence

**Given** a user has an active session (signed in)
**When** they close and reopen the browser (within 7-day refresh token window)
**Then** they are automatically signed in, the `AuthProvider` reflects `isAuthenticated: true`, and no localStorage auth keys are present

**Given** a user's session access token has expired (> 1 hour old)
**When** they navigate to any page matching the middleware matcher
**Then** the middleware silently refreshes the access token using the refresh token, and the user is not prompted to sign in

### AC-04: Route Protection

**Given** an unauthenticated user
**When** they navigate directly to `/dashboard`, `/dashboard/favorites`, `/dashboard/claims`, or `/dashboard/settings`
**Then** the middleware redirects them to `/` and the route is never rendered server-side

**Given** an authenticated user
**When** they navigate to `/dashboard`
**Then** the page renders with their profile data and no redirect occurs

### AC-05: Phone Verification

**Given** an email-verified consumer on the `PhoneVerification` step
**When** they enter a valid US phone number and click "Send code"
**Then** a Twilio Verify SMS is sent to that number within 10 seconds and the UI transitions to the code entry step

**Given** the consumer enters the correct 6-digit OTP
**When** they click "Verify"
**Then** `profiles.phone_verified_at` is set, `profiles.verification_status` becomes `fully_verified` (if email was already verified), and the `PhoneVerification` component calls `onVerified()`

**Given** the consumer clicks "Skip for now"
**Then** no phone data is written, `verification_status` remains `email_verified`, and the flow proceeds to deal claim completion

### AC-06: Anonymous Until Committed Gate

**Given** a deal detail page is rendered
**When** the consumer is anonymous (no session) or authenticated but has not claimed the deal
**Then** the business name, address, phone, website, and social links are not returned by any Server Action and are not present anywhere in the page's HTML or client-side state

**Given** a consumer has a valid session (email verified) and has claimed the deal
**When** `getBusinessContactDetails(dealId)` is called
**Then** the full business contact record is returned and rendered in the UI

### AC-07: Saved Deals Persistence

**Given** an authenticated consumer saves a deal
**When** they sign in on a different device
**Then** their saved deals are visible on the `/dashboard/favorites` page, loaded from Supabase

**Given** a consumer had saved deals in localStorage before signing up
**When** they complete account creation and email verification
**Then** those deals are migrated to the `saved_deals` table and the localStorage key is cleared

### AC-08: Alert Preferences

**Given** an authenticated consumer with a verified phone
**When** they toggle SMS notifications on in `/dashboard/settings`
**Then** `profiles.alerts_sms` is set to `true` in Supabase and the preference persists across sessions and devices

**Given** a consumer without phone verification
**When** they attempt to enable SMS notifications (edge case: direct API call)
**Then** the `updateAlertPreferences` Server Action ignores the `alertsSms=true` value and returns an appropriate error

### AC-09: Profile Updates

**Given** an authenticated consumer on `/dashboard/settings`
**When** they update their name, city, or state and click "Save changes"
**Then** the `profiles` row is updated in Supabase within 2 seconds and the change persists on page reload

### AC-10: Security

**Given** a browser developer tools inspection
**When** the consumer is signed in
**Then** no auth tokens, JWTs, or session data appear in localStorage, sessionStorage, or any non-httpOnly cookie

---

## 13. Out of Scope

The following are explicitly deferred to later PRDs or milestones:

- **Business owner authentication** — managed by `businessAuthContext.tsx`, a separate auth system. Not included here.
- **Admin authentication** — managed by `adminAuthContext.tsx`. Not included here.
- **Social OAuth (Google, Apple)** — feasible with Supabase but deferred to v1.1 to reduce scope.
- **Magic link as the primary sign-in method** — the UI for magic link is a tab addition to `SignInForm`; deferred to v1.1. The backend callback route supports it from day one.
- **Two-factor authentication (TOTP)** — deferred post-launch.
- **Account deletion self-service flow** — current implementation routes to email support; full self-service deletion is a future feature.
- **Consumer invite / referral flow** — deferred.
- **Supabase Realtime for live claim status updates** — deferred to the business dashboard PRD.
- **Email preferences beyond alerts_email/alerts_sms** — granular notification preferences are deferred.
- **Migration of existing claims from localStorage** — claims data migration follows the saved deals pattern (one-time migration on first login) but is handled in the claims feature PRD, not here.

---

## 14. Open Questions

| # | Question | Impact | Owner | Deadline |
|---|----------|--------|-------|----------|
| 1 | What is the desired Supabase Auth email verification template? The default Supabase template is minimal. Should we provide a custom HTML email matching the Bold & Warm design system? | Medium — affects first impression after signup | Product / Design | Before dev starts |
| 2 | Should the 7-day refresh token duration be extended? Consumer apps typically use 30–90 days to reduce re-auth friction. This is configurable in Supabase Auth settings. | Medium — affects user retention via session durability | Product | Before dev starts |
| 3 | Does the Twilio Verify service need to support international numbers (non-US)? The current `PhoneVerification` UI accepts `+1 (555) 000-0000` format only. | Low for launch (US-only market) | Product | Pre-launch |
| 4 | Is `ON CONFLICT DO NOTHING` the correct behavior for `claims_active_unique`? If a user cancelled a claim and wants to re-claim, should the system create a new claim or reactivate the old one? | Medium — affects claim history integrity | Product | Before claims table migration |
| 5 | The `phone` column in `profiles` is stored in plain text (E.164 format). Does the team need phone number encryption at rest, or is Supabase's default AES-256 database encryption sufficient for HIPAA-adjacent compliance considerations? | High if any PHI is involved | Legal / Compliance | Before production launch |
| 6 | Should `signUpWithEmailPassword` auto-sign-in the user before email verification? Supabase's default behavior creates a session immediately (user can browse dashboard but cannot claim deals until email verified). Is this desirable UX or should session creation be deferred until after email verification? | Medium — affects the onboarding flow post-signup | Product | Before dev starts |

---

## Appendix: File Change Summary

The following files require modification. No new components need to be created (existing UI components are wired as-is). New files are limited to infrastructure.

### Modified Files

| File | Change Type | Summary |
|------|-------------|---------|
| `src/lib/context/authContext.tsx` | Major rewrite | Replace mock implementation with Supabase Auth; preserve interface |
| `src/components/features/emailVerification.tsx` | Minor | Wire "enter code manually" to `supabase.auth.verifyOtp()`; wire "resend" to Server Action |
| `src/components/features/phoneVerification.tsx` | Minor | Wire `handleSendCode` and `handleVerifyCode` to Server Actions |
| `src/lib/supabase.ts` | Update | Keep for public queries; add exports for browser and server clients |

### New Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Route protection and session token refresh |
| `src/app/auth/callback/route.ts` | Handles email verification, magic link, and password reset redirects |
| `src/app/auth/reset-password/page.tsx` | Password update form for recovery flow |
| `src/lib/supabase-browser.ts` | `createBrowserClient` instance for use in client components |
| `src/lib/supabase-server.ts` | `createServerClient` factory for Server Actions and Server Components |
| `src/lib/actions/auth.ts` | Server Actions for all auth operations |
| `src/lib/actions/profile.ts` | Server Actions for profile read/update |
| `src/lib/actions/phoneVerification.ts` | Server Actions wrapping Twilio Verify |
| `src/lib/actions/deals.ts` | Server Actions for saved deals persistence |
| `src/lib/actions/claims.ts` | Server Actions for claims persistence and business contact reveal |
| `supabase/migrations/001_consumer_auth.sql` | All schema SQL: profiles, saved_deals, claims, triggers, RLS |

### Supabase Dashboard Configuration

| Setting | Value |
|---------|-------|
| Auth → Email → Confirm email | Enabled |
| Auth → Email → Custom SMTP | Configure before launch |
| Auth → Email → Site URL | `https://www.costfinders.ai` (production) |
| Auth → Email → Redirect URLs | `http://localhost:3000/auth/callback`, `https://www.costfinders.ai/auth/callback` |
| Auth → Sessions → JWT expiry | 3600 (1 hour, default) |
| Auth → Sessions → Refresh token rotation | Enabled |
| Auth → Sessions → Reuse interval | 10 seconds |

---

*End of PRD-01: Consumer Authentication & Onboarding*
*Review with engineering lead before sprint planning. All SQL should be applied to a Supabase branch before merging to production.*
