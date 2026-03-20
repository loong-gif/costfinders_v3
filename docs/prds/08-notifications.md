# PRD-08: Notification System

> **Status**: Draft
> **Version**: 1.0
> **Date**: 2026-03-20
> **Author**: Product
> **Reviewers**: Engineering, Design, Admin Operations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Email System — Resend Integration](#7-email-system--resend-integration)
8. [Email Template Specifications](#8-email-template-specifications)
9. [Frontend Integration](#9-frontend-integration)
10. [Admin Notification Dashboard](#10-admin-notification-dashboard)
11. [User Story Inventory](#11-user-story-inventory)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Out of Scope (v1)](#13-out-of-scope-v1)
14. [Open Questions](#14-open-questions)
15. [Changelog](#15-changelog)

---

## 1. Executive Summary

### Problem Statement

CostFinders currently has no mechanism to close the loop between a consumer claiming a deal and the admin team relaying that lead to the business. The lead relay process is entirely manual with no tooling to support it. Consumers receive no confirmation after claiming. Businesses receive no notification until an admin manually sends one. Admins have no dashboard to see which leads are pending relay. The result is that leads go cold, consumers assume the platform is broken, and the admin team has no reliable queue to work from.

Additionally, the platform has no in-app notification surface — the bell icon referenced in the design system exists but renders nothing. Consumers and businesses operating inside the app have no way to see activity that happened since their last visit.

### Solution Overview

This PRD specifies a complete notification system covering:

- **In-app notification center**: Bell icon with unread badge count, dropdown panel showing recent notifications per user with mark-as-read and clear-all actions.
- **Email delivery via Resend**: Transactional emails for all key lifecycle events, implemented as Next.js API Routes calling Resend's REST API.
- **Notification preferences**: Granular per-type opt-in/out, replacing the current coarse `alertsEmail` / `alertsSms` boolean pair on the `Consumer` model.
- **Admin lead relay dashboard**: A dedicated view at `/admin/dashboard/leads` showing all pending leads with relay status, so the admin team has a reliable queue.
- **SMS (future)**: Architecture accommodates Twilio integration but SMS is excluded from v1.

### Business Impact

| Metric | Current State | Target with v1 |
|--------|--------------|----------------|
| Lead relay SLA | Undefined, ad-hoc | Admin sees every new lead within 5 min of claim |
| Consumer post-claim drop-off | High (no confirmation) | Reduced via immediate claim confirmation email |
| Admin lead visibility | Zero tooling | Centralized queue, relay tracked per lead |
| Business contact time | Unknown | < 24 hours from claim (measured via relay timestamps) |

### Resource Requirements

| Area | Estimate |
|------|----------|
| Backend (API routes, DB schema, Resend integration) | 6–8 days |
| Frontend (notification center UI, preferences UI, admin dashboard) | 5–7 days |
| Email template HTML/CSS | 2–3 days |
| QA and acceptance testing | 2 days |
| **Total** | **~15–20 days** |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Resend delivery rate below 95% | Low | High | Monitor via Resend dashboard; add retry logic on 5xx |
| Admin dashboard adds relay overhead | Medium | Medium | Keep UI minimal; one-click relay action |
| Notification volume spikes on deal digest day | Low | Medium | Rate limit digest sends; batch with Resend batch API |
| Preference table migration breaks existing `alertsEmail` state | Medium | High | Migrate existing booleans during seeding; no breaking change to Consumer type |

---

## 2. Product Overview

### Product Vision

Every actor on the CostFinders platform — consumer, business owner, admin — should receive timely, relevant, and actionable notifications through the channel they prefer. Notifications drive the claim-to-booking conversion funnel and give the admin team operational visibility.

### Target Users

| User Type | Primary Notification Need |
|-----------|--------------------------|
| **Consumer** | Claim confirmation, claim status updates, deal alert matches |
| **Business Owner** | New lead received (relayed by admin), new message in thread |
| **Admin** | New claim created (to trigger manual relay), platform operations |

### Value Proposition by User Type

**Consumers** learn immediately that their claim was received, reducing uncertainty and support inquiries. When the business has been contacted, they know to expect outreach. Deal alerts surface relevant savings without requiring consumers to check the app.

**Business owners** know when a lead has been relayed to them with full consumer contact details and deal context, enabling fast follow-up.

**Admins** have a single queue to work from instead of checking Supabase directly. Relay actions are one-click, logged, and timestamped.

### Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Claim confirmation email delivered | Resend delivery webhook | > 98% within 60s of claim |
| Admin notified of new claim | In-app notification + email | < 5 min from claim creation |
| Admin relay dashboard adopted | Admin relay actions logged | 100% of new leads processed via dashboard (not direct DB) |
| Unread badge renders correctly | Manual QA + Playwright | Pass |
| Email opt-out honored | Preference check in send path | 100% compliance |

### Assumptions

- Resend is added to the project via Vercel Marketplace and `RESEND_API_KEY` is provisioned as an environment variable.
- The admin team consists of 1–3 people and operates within the existing admin auth context (`adminAuthContext.tsx`).
- Business owners do not yet have their own app-facing notification surface in v1. Lead relay notifications go to their email address on file.
- The `from` address for all emails is `noreply@costfinders.com` (or `notifications@costfinders.com`) — the sending domain must be verified in Resend before launch.
- v1 uses polling (not Supabase Realtime) for the in-app notification badge. Realtime upgrades are noted but deferred.

---

## 3. Functional Requirements

### 3.1 In-App Notification Center

#### 3.1.1 Bell Icon with Unread Badge

The `GlobalHeader` component gains a bell icon (Phosphor `Bell` or `BellRinging`) positioned in the authenticated nav area. An amber badge overlays the bell when unread notifications exist. Badge displays a count: 1–99 displayed as the integer, 100+ displayed as "99+". Badge clears when the panel is opened (all visible notifications are marked read on panel open).

- Bell is only shown to authenticated users (consumer, business owner, or admin depending on role).
- Bell is hidden on public marketing pages where the user is unauthenticated.
- On mobile, the bell appears in the `GlobalHeader` row, not in the bottom nav.

#### 3.1.2 Notification Dropdown Panel

Clicking the bell opens a dropdown panel anchored to the bell icon on desktop. On mobile it opens as a `BottomSheet` (using the existing `BottomSheet` UI primitive).

Panel contents:

- Header row: "Notifications" label on the left, "Mark all read" text button on the right.
- Scrollable list of notification items, newest first, max visible height of 400px (desktop) / 60vh (mobile) before scroll.
- Each item shows: notification icon (type-specific), title (bold), body (truncated at 2 lines), relative timestamp ("2 min ago", "Yesterday"), and an unread dot indicator (amber) on the left when `read_at` is null.
- Clicking a notification item navigates to its `action_url` (if present) and marks it read.
- Empty state: Bell icon + "All caught up" + "You'll see new notifications here" (matches `MESSAGING-STYLE-GUIDE.md` empty state pattern).
- "View all" link at the bottom navigates to `/dashboard/notifications` (consumer) or equivalent.
- "Clear all" button removes all notifications from the panel view (sets `dismissed_at` on all records).

#### 3.1.3 Notification History Page

Route: `/dashboard/notifications` (consumer), `/business/dashboard/notifications` (business), `/admin/dashboard/notifications` (admin).

- Full paginated list of all notifications for the authenticated user, newest first.
- Filter tabs: "All" | "Unread".
- Bulk actions: "Mark all as read", "Clear all".
- Each notification row links to `action_url` on click.

### 3.2 Email Notifications via Resend

All email sends happen server-side in Next.js API Routes (or Server Actions). Client components never call Resend directly. All sends check the user's notification preferences before executing.

#### Notification Types and Email Trigger Matrix

| Notification Type | Trigger Event | Recipients | Email Required |
|-------------------|--------------|------------|----------------|
| `claim_created` | Consumer submits a claim | Admin team + consumer | Admin: always. Consumer: if `claim_created` email enabled |
| `claim_status_updated` | Admin changes claim status | Consumer | If `claim_status_updated` email enabled |
| `new_message` | Message added to claim thread | Other party in thread | If `new_message` email enabled |
| `deal_alert_match` | New deal matches consumer preferences | Consumer | If `deal_alert_match` email enabled |
| `admin_lead_relay` | Admin marks lead as relayed | Business owner (external email) | Always (business has no in-app account yet) |
| `welcome` | New consumer account created | Consumer | Always (no preference gate) |

#### 3.2.1 claim_created

When a consumer claims a deal:

1. An in-app notification is created for every admin user (type: `claim_created`, body references consumer name and deal title).
2. An email is sent to each admin at their registered email address with full lead context.
3. An in-app notification is created for the consumer (type: `claim_created`, confirming receipt).
4. A confirmation email is sent to the consumer if `claim_created` email is enabled in their preferences.

#### 3.2.2 claim_status_updated

When an admin updates claim status (pending → contacted, contacted → booked, etc.):

1. An in-app notification is created for the consumer.
2. A status update email is sent to the consumer if `claim_status_updated` email is enabled.

#### 3.2.3 new_message

When a message is added to a claim thread (`message.ts` model):

1. An in-app notification is created for the other party (consumer if sender is business/admin, business if sender is consumer).
2. An email is sent to the recipient if `new_message` email is enabled, but only if the recipient has not been active in the thread within the last 15 minutes (suppress noisy emails during active conversations).

#### 3.2.4 deal_alert_match

A scheduled or triggered process (Vercel Cron Job) evaluates new deals against consumer preferences:

- Match criteria: deal `category` is in consumer's `favoriteCategories` AND deal `locationArea` is near consumer's `locationCity`.
- Creates one in-app notification per consumer per matching deal (deduplicated — no duplicate alerts for the same deal/consumer pair).
- Emails are batched: consumers receive at most one deal alert email per day, consolidating all matches into a single digest email.

#### 3.2.5 admin_lead_relay

When an admin clicks "Relay to business" in the admin lead dashboard:

1. The `admin_lead_relay` notification is created for the admin (audit trail).
2. An email is sent to the business owner's email address (from `master_business_info` or the business owner's profile) containing full consumer lead details.
3. The claim record is updated with `relayed_at` timestamp and `relayed_by` admin ID.

### 3.3 Notification Preferences

The existing `alertPreferences.tsx` component handles only the coarse `alertsEmail` / `alertsSms` toggles. This is replaced by a granular system.

#### Preference Structure

Each user has a row per notification type in `notification_preferences`. Defaults on first login:

| Notification Type | Default: email_enabled | Default: in_app_enabled |
|-------------------|----------------------|------------------------|
| `claim_created` | true | true |
| `claim_status_updated` | true | true |
| `new_message` | true | true |
| `deal_alert_match` | true | true |
| `admin_lead_relay` | N/A (admin-only) | true |

#### Preference UI

The existing `alertPreferences.tsx` in `src/components/features/` is extended (not replaced) to render per-type toggles grouped by channel (email, in-app). The current `alertsEmail` / `alertsSms` top-level toggles become "master off" switches — if either is off, all sub-type sends for that channel are suppressed regardless of per-type settings.

Route: `/dashboard/settings` (consumer, existing page).

### 3.4 Notification History — Mark as Read / Clear All

- Individual mark-as-read: `PATCH /api/notifications/[id]/read`
- Mark all read: `PATCH /api/notifications/mark-all-read`
- Clear (dismiss) all: `DELETE /api/notifications` (sets `dismissed_at`, soft delete)
- Unread count for badge: `GET /api/notifications/unread-count`

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| Unread count API response time | < 200ms (p95) |
| Notification panel load time | < 300ms (p95) for first 20 items |
| Email delivery via Resend | < 60s from trigger event to inbox arrival |
| Resend API call timeout | 5s; fail gracefully without blocking claim flow |

### 4.2 Reliability

- Resend API calls are wrapped in try/catch. A failed email send must not fail the parent operation (e.g., claim creation still succeeds if the email send fails). Errors are logged via `console.error` and surfaced in Vercel runtime logs.
- Notification record creation in Supabase happens in the same transaction or immediately after the parent action. If notification insert fails, the parent action still succeeds; the failure is logged.
- No notification is sent twice: check `notifications` table for existing records with matching `(user_id, type, data->>'claim_id')` before inserting.

### 4.3 Security

- All notification API routes verify the authenticated session via Supabase Auth before reading or writing.
- Admin-only notification types (`admin_lead_relay`, `claim_created` admin copy) require `adminAuthContext` validation.
- The `data` JSONB column must not store PII beyond what is already visible to the recipient. Consumer contact details (email, phone) are only included in `admin_lead_relay` notifications destined for admins.
- Resend API key is stored only in environment variables, never in client-side code or repository.
- Business owner email addresses are sent only to verified admins. The relay email endpoint requires admin authentication.

### 4.4 Accessibility

- The notification bell and badge meet WCAG 2.1 AA contrast requirements.
- The badge uses `aria-label="X unread notifications"` where X is the count.
- The dropdown panel is keyboard navigable: Tab moves between items, Enter activates, Escape closes.
- Notification items use semantic markup (`<button>` or `<a>` with descriptive labels).

### 4.5 Compliance

- All emails include a one-click unsubscribe link that sets the relevant preference to disabled.
- The unsubscribe handler (`GET /api/notifications/unsubscribe?token=...`) uses a signed token (HMAC-SHA256 of `user_id:notification_type`, signed with `NOTIFICATION_UNSUBSCRIBE_SECRET`) to prevent enumeration.
- The welcome email and deal alert emails constitute marketing-adjacent communication; the preference gate must be honored before any send.
- No email send occurs after a user has been set to `status: 'suspended'`.

---

## 5. Database Schema

All SQL targets Supabase Postgres (v17.6, project `kdlpkjzcnbkjcvwsvlwn`).

### 5.1 notification_type Enum

```sql
-- Migration: 20260320_01_notification_types.sql

CREATE TYPE notification_type AS ENUM (
  'claim_created',
  'claim_status_updated',
  'new_message',
  'deal_alert_match',
  'admin_lead_relay',
  'welcome'
);
```

### 5.2 notifications Table

```sql
-- Migration: 20260320_02_notifications_table.sql

CREATE TABLE public.notifications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,

  -- Display content
  title           text NOT NULL,
  body            text NOT NULL,
  action_url      text,                    -- relative path to navigate on click, e.g. /dashboard/claims/abc123

  -- Structured payload for rendering / relay logic
  data            jsonb NOT NULL DEFAULT '{}',

  -- Lifecycle timestamps
  read_at         timestamptz,             -- null = unread
  dismissed_at    timestamptz,             -- null = visible in panel; set = cleared by user

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE UNIQUE INDEX idx_notifications_dedup
  ON public.notifications (user_id, type, (data->>'claim_id'))
  WHERE type IN ('claim_created', 'claim_status_updated', 'admin_lead_relay')
    AND data->>'claim_id' IS NOT NULL;
```

**JSONB `data` field shape by notification type:**

```jsonb
-- claim_created
{
  "claim_id": "uuid",
  "deal_id": "uuid",
  "deal_title": "Botox 20 Units",
  "business_id": "uuid",
  "consumer_id": "uuid",
  "consumer_name": "Jane S.",
  "consumer_email": "jane@example.com",   // admin-only, not stored for consumer copy
  "consumer_phone": "+15205551234"         // admin-only
}

-- claim_status_updated
{
  "claim_id": "uuid",
  "deal_title": "Botox 20 Units",
  "business_name": "Glow Medspa",
  "old_status": "pending",
  "new_status": "contacted"
}

-- new_message
{
  "claim_id": "uuid",
  "message_id": "uuid",
  "sender_name": "Glow Medspa",
  "sender_type": "business",
  "preview": "Hi! We'd love to book you in for..."
}

-- deal_alert_match
{
  "deal_id": "uuid",
  "deal_title": "Lip Filler — Buy 1 Get 1",
  "category": "fillers",
  "location_area": "Tucson, AZ",
  "deal_price": 299,
  "original_price": 599
}

-- admin_lead_relay
{
  "claim_id": "uuid",
  "business_id": "uuid",
  "business_name": "Glow Medspa",
  "business_email": "owner@glowmedspa.com",
  "relayed_by_admin_id": "uuid",
  "relayed_at": "ISO8601"
}
```

### 5.3 notification_preferences Table

```sql
-- Migration: 20260320_03_notification_preferences.sql

CREATE TABLE public.notification_preferences (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type   notification_type NOT NULL,

  email_enabled       boolean NOT NULL DEFAULT true,
  sms_enabled         boolean NOT NULL DEFAULT false,  -- reserved for Twilio v2
  in_app_enabled      boolean NOT NULL DEFAULT true,

  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, notification_type)
);

-- Seed default rows for all existing users
-- (Run once after migration; new users seeded via trigger below)
INSERT INTO public.notification_preferences (user_id, notification_type, email_enabled, in_app_enabled)
SELECT
  u.id,
  t.type,
  true,
  true
FROM auth.users u
CROSS JOIN (
  SELECT unnest(enum_range(NULL::notification_type)) AS type
) t
ON CONFLICT (user_id, notification_type) DO NOTHING;
```

### 5.4 Trigger: Auto-Seed Preferences on New User

```sql
-- Migration: 20260320_04_preference_seed_trigger.sql

CREATE OR REPLACE FUNCTION public.seed_notification_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, notification_type, email_enabled, in_app_enabled)
  SELECT
    NEW.id,
    t.type,
    true,
    true
  FROM (
    SELECT unnest(enum_range(NULL::notification_type)) AS type
  ) t
  ON CONFLICT (user_id, notification_type) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_notification_preferences();
```

### 5.5 claims Table Extensions

The existing `Claim` type (`src/types/claim.ts`) needs two additional columns to support admin relay tracking:

```sql
-- Migration: 20260320_05_claims_relay_columns.sql

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS relayed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS relayed_by    uuid REFERENCES auth.users(id);

CREATE INDEX idx_claims_unrelayed
  ON public.claims (created_at DESC)
  WHERE relayed_at IS NULL AND status = 'pending';
```

### 5.6 Row Level Security

```sql
-- notifications: users see only their own
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- notification_preferences: users manage only their own
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY prefs_select_own ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY prefs_update_own ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (used by API routes) bypasses RLS
-- The Supabase service role key is used in server-only API routes for cross-user writes
-- (e.g., admin creating a notification for a consumer)
```

---

## 6. API Design

All routes live under `src/app/api/notifications/`. Routes are Next.js App Router Route Handlers. Server-side Supabase client uses the service role key for writes that cross user boundaries (admin creating notifications for consumers).

### 6.1 Route Inventory

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/notifications` | User | List notifications for current user (paginated) |
| `GET` | `/api/notifications/unread-count` | User | Returns `{ count: number }` |
| `PATCH` | `/api/notifications/[id]/read` | User (owner) | Mark single notification read |
| `PATCH` | `/api/notifications/mark-all-read` | User | Mark all user notifications read |
| `DELETE` | `/api/notifications` | User | Soft-delete (dismiss) all user notifications |
| `POST` | `/api/notifications/send` | Service (internal) | Create notification record + trigger email |
| `GET` | `/api/notifications/unsubscribe` | None (signed token) | Honor email unsubscribe |
| `PATCH` | `/api/notifications/preferences` | User | Update notification preferences |
| `GET` | `/api/notifications/preferences` | User | Read notification preferences |
| `POST` | `/api/admin/leads/relay` | Admin | Mark claim as relayed, send business email |

### 6.2 GET /api/notifications

```
Query params:
  page     integer  default 1
  per_page integer  default 20, max 50
  unread   boolean  default false (filter to unread only)

Response 200:
{
  "notifications": [
    {
      "id": "uuid",
      "type": "claim_created",
      "title": "Claim confirmed",
      "body": "Your claim for Botox 20 Units has been received.",
      "action_url": "/dashboard/claims/abc123",
      "data": { ... },
      "read_at": null,
      "created_at": "2026-03-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 47,
    "has_more": true
  }
}
```

### 6.3 GET /api/notifications/unread-count

```
Response 200:
{
  "count": 3
}
```

Polling interval from client: 60 seconds. This is intentionally simple. Supabase Realtime subscription is the upgrade path (noted in section 13).

### 6.4 PATCH /api/notifications/[id]/read

```
Response 200:
{
  "id": "uuid",
  "read_at": "2026-03-20T10:05:00Z"
}

Response 403:
{
  "error": "Forbidden"
}
```

### 6.5 POST /api/notifications/send (Internal)

This route is called server-side by other API routes (claim creation, message creation, etc.). It is not exposed to browsers. Authentication is via the Supabase service role key passed in the `Authorization` header as `Bearer <SERVICE_ROLE_KEY>`.

```
Request body:
{
  "user_id": "uuid",
  "type": "claim_created",
  "title": "New lead: Jane S.",
  "body": "Jane S. claimed Botox 20 Units from Glow Medspa.",
  "action_url": "/admin/dashboard/leads",
  "data": {
    "claim_id": "uuid",
    "deal_title": "Botox 20 Units",
    "consumer_name": "Jane S.",
    "consumer_email": "jane@example.com",
    "consumer_phone": "+15205551234"
  },
  "send_email": true
}

Response 201:
{
  "notification_id": "uuid",
  "email_sent": true
}
```

### 6.6 POST /api/admin/leads/relay

```
Auth: Admin session required (adminAuthContext)

Request body:
{
  "claim_id": "uuid"
}

Processing:
1. Fetch claim with deal and consumer joins
2. Fetch business email from master_business_info
3. Send relay email to business via Resend
4. Create admin_lead_relay notification for the acting admin
5. Update claims.relayed_at = now(), claims.relayed_by = admin.id
6. Return updated claim

Response 200:
{
  "claim_id": "uuid",
  "relayed_at": "2026-03-20T10:10:00Z",
  "business_email": "owner@glowmedspa.com"
}

Response 400:
{
  "error": "Claim already relayed",
  "relayed_at": "2026-03-19T08:00:00Z"
}
```

### 6.7 GET /api/notifications/unsubscribe

```
Query params:
  token  string  HMAC-SHA256 signed token encoding user_id + notification_type

Processing:
1. Verify token signature using NOTIFICATION_UNSUBSCRIBE_SECRET
2. Decode user_id and notification_type from token
3. Set notification_preferences.email_enabled = false for that row
4. Render a plain confirmation page (no redirect, no re-auth required)

Response 200 (HTML):
  "You've been unsubscribed from [notification type] emails.
   To manage all notifications, sign in to CostFinders."
```

### 6.8 PATCH /api/notifications/preferences

```
Request body:
{
  "notification_type": "deal_alert_match",
  "email_enabled": false
}

Response 200:
{
  "user_id": "uuid",
  "notification_type": "deal_alert_match",
  "email_enabled": false,
  "in_app_enabled": true,
  "updated_at": "2026-03-20T10:15:00Z"
}
```

---

## 7. Email System — Resend Integration

### 7.1 Setup

Resend is added via Vercel Marketplace (`vercel env pull` will populate `RESEND_API_KEY`). The project installs the `resend` npm package:

```
npm install resend
```

Sending domain `costfinders.com` must be verified in the Resend dashboard (DNS TXT + DKIM records) before any production sends.

### 7.2 Resend Client

File: `src/lib/email/resendClient.ts` (server-only)

```typescript
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_ADDRESS = 'CostFinders <notifications@costfinders.com>'
export const REPLY_TO = 'support@costfinders.com'
```

### 7.3 Email Send Helper

File: `src/lib/email/sendEmail.ts` (server-only)

The helper checks preferences before any send and handles errors without throwing to the caller:

```typescript
import { resend, FROM_ADDRESS, REPLY_TO } from './resendClient'
import { createUnsubscribeToken } from './unsubscribeToken'
import type { notification_type } from '@/types/notification'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  notification_type: notification_type
  user_id: string
}

interface SendEmailResult {
  sent: boolean
  resend_id?: string
  error?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const unsubscribeToken = createUnsubscribeToken(opts.user_id, opts.notification_type)
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`

  const htmlWithFooter = `
    ${opts.html}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #d4c4b0;font-size:12px;color:#78350f;">
      <p>You're receiving this because you have an account on CostFinders.</p>
      <p><a href="${unsubscribeUrl}" style="color:#78350f;">Unsubscribe from these emails</a></p>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      replyTo: REPLY_TO,
      subject: opts.subject,
      html: htmlWithFooter,
    })

    if (result.error) {
      console.error('[sendEmail] Resend API error', result.error)
      return { sent: false, error: result.error.message }
    }

    return { sent: true, resend_id: result.data?.id }
  } catch (err) {
    console.error('[sendEmail] Unexpected error', err)
    return { sent: false, error: String(err) }
  }
}
```

### 7.4 Preference Gate

Before calling `sendEmail`, all notification send paths must call:

```typescript
// src/lib/email/checkEmailPreference.ts

export async function isEmailEnabled(
  supabase: SupabaseClient,
  userId: string,
  type: notification_type
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('email_enabled')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .single()

  // Default true if no preference row exists yet
  return data?.email_enabled ?? true
}
```

### 7.5 Cron Job: Deal Alert Digest

File: `src/app/api/cron/deal-alerts/route.ts`

Vercel Cron configuration (in `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/deal-alerts",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This route runs daily at 9:00 AM UTC. It:

1. Queries deals created in the last 24 hours.
2. For each deal, finds consumers whose `favoriteCategories` contains the deal's `category` and whose `locationCity` is in the same metro area as the deal's `locationArea`.
3. Checks the `notifications` table for existing `deal_alert_match` records for the same `(consumer_id, deal_id)` pair to deduplicate.
4. Creates in-app `deal_alert_match` notification records for matching consumers.
5. Groups matching deals per consumer and sends one digest email per consumer (not one per deal).

The cron route requires `CRON_SECRET` header validation:

```typescript
const authHeader = req.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## 8. Email Template Specifications

All templates follow these shared design rules:

- **Base width**: 600px max, centered, fluid below 600px.
- **Background**: `#faf5ee` (Warm Sand page background).
- **Card background**: `#ffffff`.
- **Primary text**: `#451a03` (amber-950).
- **Secondary text**: `#78350f` (amber-800).
- **Accent/CTA button background**: `#92400e` (amber-800 dark).
- **CTA button text**: `#ffffff`.
- **Font**: Arial, Helvetica, sans-serif (web-safe; Sora is not universally supported in email clients).
- **No external CSS or `<link>` tags** — all styles inline.
- **Alt text on all images**.
- **Plain-text version** provided alongside HTML for deliverability.

### 8.1 Welcome Email

**Trigger**: Consumer account creation (`signUp` action completes).
**To**: New consumer's email.
**Subject**: `Welcome to CostFinders`
**Preview text**: `Start saving on treatments near you`

**Body sections**:

1. Logo header (centered, 140px wide, links to `https://costfinders.com`).
2. Greeting: `Hi {{first_name}},` (falls back to "Hi," if first name not provided).
3. Hero line (H2): "Find treatments. Compare prices. Save."
4. Body paragraph: "You now have access to verified medspa deals in {{city}} and surrounding areas. Browse anonymously, save deals you like, and claim when you're ready."
5. Primary CTA button: "Browse deals near you" → `{{app_url}}/deals`.
6. Secondary CTA (text link): "Complete your profile" → `{{app_url}}/dashboard/settings`.
7. Footer: unsubscribe link, legal address, `© {{year}} CostFinders`.

**Variables**: `{{first_name}}`, `{{city}}`, `{{app_url}}`, `{{year}}`

### 8.2 Claim Confirmation (Consumer)

**Trigger**: `claim_created` event, consumer copy.
**To**: Consumer's email, gated by `claim_created` preference.
**Subject**: `Your claim for {{deal_title}}`
**Preview text**: `Here's what happens next`

**Body sections**:

1. Logo header.
2. Greeting: `Hi {{first_name}},`
3. Confirmation line (H2): "Claim received."
4. Deal summary box (bordered card):
   - Deal title: `{{deal_title}}`
   - Category badge
   - Price: `{{deal_price}}` (savings vs. `{{original_price}}`)
5. Next steps ordered list:
   1. "Our team will contact the business on your behalf."
   2. "The business will reach out to you within 24–48 hours."
   3. "Mention this deal when booking your appointment."
6. CTA button: "View your claim" → `{{claim_url}}`.
7. Note (small text): "Questions? Reply to this email or visit your dashboard."
8. Footer.

**Variables**: `{{first_name}}`, `{{deal_title}}`, `{{deal_price}}`, `{{original_price}}`, `{{claim_url}}`, `{{app_url}}`, `{{year}}`

### 8.3 New Lead Alert (Admin)

**Trigger**: `claim_created` event, admin copy.
**To**: All admin email addresses (queried from admin users table).
**Subject**: `New lead: {{consumer_name}} → {{deal_title}}`
**Preview text**: `Action needed — relay this lead to {{business_name}}`

**Body sections**:

1. Logo header.
2. Alert header (H2, amber background strip): "New lead received"
3. Lead summary card:
   - Consumer name: `{{consumer_name}}`
   - Consumer email: `{{consumer_email}}` (clickable `mailto:`)
   - Consumer phone: `{{consumer_phone}}` (clickable `tel:`)
   - Deal claimed: `{{deal_title}}`
   - Business: `{{business_name}}`
   - Claimed at: `{{claimed_at}}`
4. Primary CTA button: "Relay this lead" → `{{admin_lead_url}}` (links to the specific lead in admin dashboard).
5. Secondary note: "You can also relay directly from the admin dashboard."
6. Footer (no unsubscribe — admin operational email).

**Variables**: `{{consumer_name}}`, `{{consumer_email}}`, `{{consumer_phone}}`, `{{deal_title}}`, `{{business_name}}`, `{{claimed_at}}`, `{{admin_lead_url}}`, `{{year}}`

Note: Admin emails do not include the unsubscribe footer. They are operational emails, not marketing.

### 8.4 Lead Relay Notification (Business Owner)

**Trigger**: Admin clicks "Relay to business" action.
**To**: Business owner email from `master_business_info.website` owner's registered address, or from `business_owner.email`.
**Subject**: `New lead from CostFinders: {{consumer_name}}`
**Preview text**: `{{consumer_name}} is interested in {{deal_title}}`

**Body sections**:

1. Logo header.
2. Greeting: "Hello {{business_name}} team,"
3. Hero line (H2): "You have a new lead."
4. Lead details card:
   - Name: `{{consumer_name}}`
   - Email: `{{consumer_email}}` (clickable)
   - Phone: `{{consumer_phone}}` (clickable)
   - Interested in: `{{deal_title}}`
   - Preferred date: `{{preferred_date}}` (or "Flexible" if not specified)
   - Preferred time: `{{preferred_time}}` (or "Flexible")
   - Consumer notes: `{{notes}}` (or hidden section if empty)
5. Action guidance:
   - "Contact {{consumer_first_name}} within 24 hours to secure the booking."
   - "When they arrive, apply the CostFinders deal pricing."
6. CTA button: "Manage your listing on CostFinders" → `{{app_url}}/business`.
7. Footer with note: "This lead was sent by the CostFinders team. To stop receiving leads, reply to this email."

**Variables**: `{{business_name}}`, `{{consumer_name}}`, `{{consumer_first_name}}`, `{{consumer_email}}`, `{{consumer_phone}}`, `{{deal_title}}`, `{{preferred_date}}`, `{{preferred_time}}`, `{{notes}}`, `{{app_url}}`, `{{year}}`

### 8.5 Claim Status Update (Consumer)

**Trigger**: `claim_status_updated` event.
**To**: Consumer's email, gated by preference.
**Subject**: `Update on your claim: {{deal_title}}`
**Preview text**: `{{business_name}} {{status_message}}`

**Status message map** (for preview text and body):

| New Status | Status Message | Body Copy |
|------------|---------------|-----------|
| `contacted` | "has been notified" | "The business has been notified about your claim. Expect outreach within 24–48 hours." |
| `booked` | "confirmed your booking" | "Your appointment has been booked. We'll send a reminder closer to your date." |
| `completed` | "marked your visit complete" | "Thanks for visiting {{business_name}}! We hope you loved your treatment." |
| `cancelled` | "cancelled your claim" | "Your claim has been cancelled. Browse more deals if you'd like to find another option." |
| `expired` | "your claim expired" | "Your claim has expired without a response. Browse more deals to find another option." |

**Body sections**:

1. Logo header.
2. Greeting: `Hi {{first_name}},`
3. H2 status headline (from map above).
4. Deal reference: "Claim for **{{deal_title}}** at {{business_name}}."
5. Body copy (from map above).
6. CTA button: "View your claim" → `{{claim_url}}`.
7. Footer.

**Variables**: `{{first_name}}`, `{{deal_title}}`, `{{business_name}}`, `{{claim_url}}`, `{{status_message}}`, `{{year}}`

### 8.6 Deal Alert Digest (Consumer)

**Trigger**: Daily cron at 9:00 AM UTC, one email per consumer with 1+ matches.
**To**: Consumer's email, gated by `deal_alert_match` preference.
**Subject**: `{{count}} new deal{{s}} match your interests` (s = "" if count=1, "s" if count>1)
**Preview text**: `{{sample_deal_title}} and more in {{city}}`

**Body sections**:

1. Logo header.
2. Greeting: `Hi {{first_name}},`
3. H2: "New deals for you"
4. Location context: "Matching deals in {{city}} based on your treatment interests."
5. Deal cards (repeat per match, max 5 in digest; "View all X deals" link if more):
   - Deal title
   - Category
   - Price: `{{deal_price}}` / was `{{original_price}}` — `{{discount_percent}}% off`
   - Location area
   - CTA link: "View deal" → `{{deal_url}}`
6. Primary CTA button: "Browse all deals in {{city}}" → `{{city_deals_url}}`.
7. Preference note: "You're receiving this because you've saved {{categories}} as interests. Update preferences."
8. Footer.

**Variables**: `{{first_name}}`, `{{count}}`, `{{s}}`, `{{sample_deal_title}}`, `{{city}}`, `{{categories}}`, deals array, `{{city_deals_url}}`, `{{preferences_url}}`, `{{year}}`

### 8.7 Template File Structure

```
src/lib/email/
  resendClient.ts           Server-only Resend instance
  sendEmail.ts              Core send helper with preference gate
  unsubscribeToken.ts       HMAC token generation / verification
  checkEmailPreference.ts   Supabase preference lookup
  templates/
    welcome.ts              HTML string builder
    claimConfirmation.ts
    adminNewLead.ts
    businessLeadRelay.ts
    claimStatusUpdate.ts
    dealAlertDigest.ts
    _base.ts                Shared header/footer/button helpers
```

---

## 9. Frontend Integration

### 9.1 TypeScript Types

New file: `src/types/notification.ts`

```typescript
export type NotificationType =
  | 'claim_created'
  | 'claim_status_updated'
  | 'new_message'
  | 'deal_alert_match'
  | 'admin_lead_relay'
  | 'welcome'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  data: Record<string, unknown>
  readAt?: string
  dismissedAt?: string
  createdAt: string
}

export interface NotificationPreference {
  userId: string
  notificationType: NotificationType
  emailEnabled: boolean
  smsEnabled: boolean
  inAppEnabled: boolean
  updatedAt: string
}

export interface NotificationUnreadCount {
  count: number
}
```

### 9.2 useNotifications Hook

New file: `src/lib/hooks/useNotifications.ts`

This hook manages fetching, polling, and mutation for the notification panel.

```typescript
// Responsibilities:
// - Fetch unread count on mount (authenticated users only), poll every 60s
// - Fetch notification list when panel is opened (lazy)
// - markRead(id): optimistic update + PATCH
// - markAllRead(): optimistic update + PATCH
// - dismissAll(): optimistic update + DELETE
// - Expose: { notifications, unreadCount, isLoading, markRead, markAllRead, dismissAll, refetch }
```

Polling is implemented with `setInterval` inside a `useEffect`. The interval is cleared on component unmount and when the user signs out.

### 9.3 NotificationBell Component

New file: `src/components/features/notifications/notificationBell.tsx`
Layer: `features/` (has data dependency via hook).

```
Props:
  (none — reads from useAuth and useNotifications internally)

Renders:
  - Phosphor Bell icon (weight="regular") when unread count = 0
  - Phosphor BellRinging icon (weight="fill", amber color) when unread count > 0
  - Badge overlay: amber circle with white count text
  - aria-label="{{count}} unread notifications" when count > 0, "Notifications" when 0

On click:
  - Desktop: toggles NotificationDropdown
  - Mobile: opens BottomSheet with NotificationPanel contents

Keyboard:
  - Enter / Space: toggle panel
  - Escape: close panel
```

### 9.4 NotificationPanel Component

New file: `src/components/features/notifications/notificationPanel.tsx`
Layer: `features/`

```
Props:
  notifications: Notification[]
  isLoading: boolean
  onMarkAllRead: () => void
  onDismissAll: () => void
  onClose: () => void

Renders:
  - Panel header: "Notifications" + "Mark all read" button
  - Scrollable list of NotificationItem components
  - Empty state (Bell icon, "All caught up", subtext)
  - "View all" link to /dashboard/notifications
  - "Clear all" button
```

### 9.5 NotificationItem Component

New file: `src/components/features/notifications/notificationItem.tsx`
Layer: `features/`

```
Props:
  notification: Notification
  onRead: (id: string) => void

Renders:
  - Left: type icon (see icon map below), amber if unread
  - Center: title (bold if unread), body (2-line clamp), relative time
  - Right: unread dot (amber, 8px) if readAt is null

On click:
  - Calls onRead(id)
  - If actionUrl: router.push(actionUrl)

Type-to-icon map (Phosphor):
  claim_created        → ClipboardText
  claim_status_updated → ArrowCircleRight
  new_message          → ChatCircle
  deal_alert_match     → Tag
  admin_lead_relay     → PaperPlaneTilt
  welcome              → HandWaving
```

### 9.6 GlobalHeader Integration

The `GlobalHeader` component (`src/components/layout/globalHeader.tsx`) is updated to render `NotificationBell` in the authenticated nav slot — between the location display and the sign-out/profile area.

Integration point: add bell after the existing auth state check, only when `state.isAuthenticated` is true.

### 9.7 NotificationPreferences Component

The existing `src/components/features/alertPreferences.tsx` is extended to:

1. Load `notification_preferences` rows from the API on mount.
2. Render a master "Email notifications" toggle (maps to `alertsEmail` on Consumer type for backward compat).
3. Beneath the master toggle, render per-type rows — collapsed by default, expandable — showing email and in-app toggles per notification type.
4. Save on toggle change (debounced 500ms, PATCH to `/api/notifications/preferences`).

The existing `updateAlertPreferences` in `authContext.tsx` continues to control the master toggles. Per-type preferences are managed by the new API, not by auth context.

### 9.8 Admin Notification Dashboard (Lead Relay)

Existing route: `/admin/dashboard/leads` (file: `src/app/admin/dashboard/leads/page.tsx`).

This page is extended (not replaced) to show a **relay queue panel** at the top:

- Header: "Pending relay" with a count badge.
- Table columns: Consumer name, Deal title, Business, Claimed at, Relay action.
- Relay action: "Relay to business" button — calls `POST /api/admin/leads/relay`, shows loading state, replaces button with "Relayed [timestamp]" on success.
- Already-relayed leads are shown in a secondary "Relayed" section below the queue, with the relay timestamp and which admin relayed.
- Unrelayed leads older than 24 hours are highlighted with an amber warning background row.

New component: `src/components/features/leadManagement/leadRelayQueue.tsx` (Layer: `features/`).

```
Props:
  leads: Lead[]          // unrelayed claims
  relayedLeads: Lead[]   // recently relayed (last 48h)
  onRelay: (claimId: string) => Promise<void>

State:
  relayingIds: Set<string>   // tracks in-flight relay requests
```

---

## 10. Admin Notification Dashboard

### 10.1 Purpose

The admin lead relay dashboard gives the operations team a zero-ambiguity queue. Every unrelayed claim surfaces here. Every relay action is logged. No lead falls through the cracks.

### 10.2 Access

Route: `/admin/dashboard/leads`
Auth: Admin session (`adminAuthContext`). All admin roles (`super_admin`, `moderator`, `support`) have access. Only `super_admin` and `moderator` can perform relay actions.

### 10.3 Queue Behavior

- Claims appear in the queue immediately upon creation.
- Queue is sorted by `created_at ASC` (oldest first — FIFO to minimize lead age).
- Claims with `status = 'expired'` are automatically removed from the relay queue.
- Relay button is disabled if claim status is `expired` or `cancelled`.

### 10.4 Relay Action Flow

1. Admin clicks "Relay to business" on a claim row.
2. Button enters loading state ("Relaying...").
3. `POST /api/admin/leads/relay` is called with `{ claim_id }`.
4. On success:
   - Row moves from "Pending relay" to "Relayed" section.
   - Success toast: "Lead relayed to [business name]."
   - Claim status updates to `contacted`.
5. On error:
   - Error toast: "Couldn't relay this lead. Try again."
   - Button returns to normal state.

### 10.5 Admin In-App Notifications

Admins also receive in-app notifications (the same bell icon) for `claim_created` events. The bell renders in the admin `GlobalHeader` just as it does for consumers. Clicking a `claim_created` notification navigates directly to the relay queue with that lead highlighted.

---

## 11. User Story Inventory

### Consumer Stories

**US-C01: Claim confirmation in-app**
As a consumer, I want to see an in-app notification immediately after claiming a deal so that I know my claim was received and I understand what happens next.
Acceptance Criteria:
- Given I am authenticated and submit a deal claim
- When the claim is successfully created
- Then a `claim_created` notification appears in my bell panel within 5 seconds (via polling or immediate insert)
- And the notification reads: "[Deal title] claim received. The business will be in touch within 48 hours."
- And the unread badge count increments by 1

**US-C02: Claim confirmation email**
As a consumer, I want to receive a confirmation email after claiming a deal so that I have a record outside the app.
Acceptance Criteria:
- Given I have `claim_created` email enabled in preferences (default true)
- When my claim is submitted
- Then I receive an email with subject "Your claim for [deal title]" within 60 seconds
- And the email body includes the deal title, price, and "View your claim" CTA link
- And the link resolves to `/dashboard/claims/[claim_id]`

**US-C03: Status update notification**
As a consumer, I want to receive a notification when my claim status changes so that I know when to expect business contact.
Acceptance Criteria:
- Given an admin updates my claim status from `pending` to `contacted`
- When the update is saved
- Then an in-app notification appears: "Update: your claim for [deal title] — the business has been notified"
- And if email is enabled, I receive a status update email within 60 seconds

**US-C04: Deal alert notification**
As a consumer who has saved treatment categories, I want to receive a daily notification when new matching deals are available so that I can take advantage of savings without checking the app constantly.
Acceptance Criteria:
- Given I have `botox` in my `favoriteCategories` and `deal_alert_match` email enabled
- When the cron runs at 9:00 AM UTC and finds new botox deals in my city
- Then I receive one in-app notification and one digest email listing the matching deals
- And the email contains no more than 5 deals with a "View all" link for more

**US-C05: Manage notification preferences**
As a consumer, I want to control which notification types send emails so that I only receive the emails I want.
Acceptance Criteria:
- Given I navigate to `/dashboard/settings`
- When I expand the "Email notifications" section
- Then I see per-type toggles for: deal alerts, claim updates, new messages
- And toggling "deal alerts" off immediately disables future deal alert emails
- And the change persists after page reload

**US-C06: Mark notifications as read**
As a consumer, I want to mark individual and all notifications as read so that my unread badge is accurate.
Acceptance Criteria:
- Given I open the notification panel
- When I click "Mark all read"
- Then all notification items lose their unread dot
- And the bell badge clears to 0
- And after page reload, the badge remains 0

**US-C07: Email unsubscribe**
As a consumer, I want to unsubscribe from email notifications via a link in the email so that I don't need to sign in to manage preferences.
Acceptance Criteria:
- Given I receive a CostFinders notification email
- When I click the "Unsubscribe" link in the footer
- Then I am taken to a confirmation page without requiring login
- And future emails of that type are not sent to me
- And the preference change is reflected if I later sign in to the settings page

### Admin Stories

**US-A01: New lead in-app notification**
As an admin, I want to receive an in-app notification whenever a consumer claims a deal so that I know immediately when a lead needs relaying.
Acceptance Criteria:
- Given a consumer submits a claim
- When the claim is saved
- Then every admin user receives a `claim_created` notification in their bell panel
- And the notification body includes consumer name and deal title
- And clicking it navigates to `/admin/dashboard/leads` with the relevant claim visible

**US-A02: New lead email alert**
As an admin, I want to receive an email for every new lead with the consumer's contact details so that I can relay manually even if I'm not in the app.
Acceptance Criteria:
- Given a consumer claims a deal
- When the claim is created
- Then all admin email addresses receive the new lead email within 60 seconds
- And the email contains consumer name, email, phone, deal title, and a "Relay this lead" CTA link

**US-A03: Lead relay queue**
As an admin, I want to see all unrelayed leads in a queue at the top of the leads page so that I have a clear action list.
Acceptance Criteria:
- Given there are 3 unrelayed claims
- When I navigate to `/admin/dashboard/leads`
- Then I see a "Pending relay (3)" section at the top
- And each row shows consumer name, deal title, business name, time since claim
- And claims older than 24 hours show an amber row highlight

**US-A04: One-click relay**
As an admin, I want to relay a lead to the business with one click so that the process is fast and the action is tracked.
Acceptance Criteria:
- Given I am viewing a pending claim in the relay queue
- When I click "Relay to business"
- Then the business owner receives the lead relay email within 60 seconds
- And the claim moves to the "Relayed" section with my name and timestamp
- And the claim `status` updates to `contacted`
- And I cannot relay the same claim twice (button is replaced by relay confirmation)

**US-A05: Prevent duplicate relay**
As an admin, I want the system to prevent relaying a claim that has already been relayed so that the business does not receive duplicate emails.
Acceptance Criteria:
- Given a claim with `relayed_at` set
- When any admin attempts to relay it again
- Then the API returns 400 with "Claim already relayed"
- And no email is sent

---

## 12. Acceptance Criteria

### AC-1: Database Migration

- [ ] All four migration files run without error on Supabase (`kdlpkjzcnbkjcvwsvlwn`).
- [ ] `notification_type` enum contains all 6 values.
- [ ] `notifications` table has correct columns, indexes, and unique dedup constraint.
- [ ] `notification_preferences` has correct columns and unique constraint on `(user_id, notification_type)`.
- [ ] Preference seed trigger fires on new auth user creation (tested by inserting a test user).
- [ ] RLS policies are active and verified: user A cannot query user B's notifications.
- [ ] `claims` table has `relayed_at` and `relayed_by` columns.

### AC-2: API Routes

- [ ] `GET /api/notifications` returns paginated results with correct shape.
- [ ] `GET /api/notifications/unread-count` returns `{ count: N }` for authenticated user.
- [ ] `PATCH /api/notifications/[id]/read` sets `read_at` and returns 403 for non-owner.
- [ ] `PATCH /api/notifications/mark-all-read` marks all unread notifications read for current user.
- [ ] `DELETE /api/notifications` sets `dismissed_at` on all user notifications.
- [ ] `POST /api/admin/leads/relay` sends relay email, updates claim, returns 400 on duplicate.
- [ ] `GET /api/notifications/unsubscribe` with valid token disables preference; with invalid token returns 400.

### AC-3: Email Delivery

- [ ] Welcome email delivers to consumer inbox within 60 seconds of signup.
- [ ] Claim confirmation email delivers to consumer within 60 seconds of claim creation.
- [ ] Admin new lead email delivers to all admin inboxes within 60 seconds of claim creation.
- [ ] Lead relay email delivers to business email within 60 seconds of admin relay action.
- [ ] Claim status update email delivers to consumer within 60 seconds of status change.
- [ ] Deal alert digest delivers once per consumer per day (no duplicates) when cron runs.
- [ ] All emails render correctly in Gmail (desktop and mobile), Apple Mail, Outlook web.
- [ ] Unsubscribe link appears in all consumer-facing email footers.
- [ ] Admin operational emails (new lead alert, relay confirmation) do not include unsubscribe footer.

### AC-4: Preference Gate

- [ ] Disabling `claim_created` email for a consumer prevents confirmation email on next claim.
- [ ] Disabling `deal_alert_match` email prevents digest email on next cron run.
- [ ] Master `alertsEmail = false` on Consumer suppresses all email sends regardless of per-type settings.
- [ ] Preferences persist across sessions (stored in Supabase, not localStorage).

### AC-5: In-App Notification Center

- [ ] Bell icon renders in `GlobalHeader` for authenticated consumers, business owners, and admins.
- [ ] Unread badge is absent when count = 0, shows correct integer for 1–99, shows "99+" for 100+.
- [ ] Bell opens dropdown on desktop, BottomSheet on mobile (viewport < 768px).
- [ ] Notification panel marks all items as read when opened (badge clears).
- [ ] "Mark all read" button marks all items read immediately (optimistic).
- [ ] "Clear all" removes all items from panel view (sets `dismissed_at`).
- [ ] Clicking a notification item with `action_url` navigates to that URL.
- [ ] Empty state renders with Bell icon, "All caught up" headline, subtext.
- [ ] Panel is keyboard navigable (Tab, Enter, Escape).
- [ ] Badge `aria-label` reflects correct count.

### AC-6: Admin Lead Relay Dashboard

- [ ] "Pending relay" section shows only claims with `relayed_at IS NULL`.
- [ ] Claims older than 24 hours display amber row highlight.
- [ ] "Relay to business" button shows loading state during API call.
- [ ] On successful relay, row moves to "Relayed" section with timestamp and admin name.
- [ ] Already-relayed claims cannot trigger a second relay (button absent or disabled).
- [ ] Admin in-app notifications appear for every new claim.

### AC-7: Polling and Performance

- [ ] Unread count API response time is under 200ms for users with up to 1,000 notifications.
- [ ] Notification panel loads first 20 items within 300ms.
- [ ] Polling does not fire when the browser tab is hidden (use `document.visibilityState` check).
- [ ] No memory leaks: interval is cleared on unmount and sign-out.

---

## 13. Out of Scope (v1)

| Feature | Notes for v2 |
|---------|-------------|
| SMS notifications (Twilio) | Architecture accommodates it: `sms_enabled` column exists in `notification_preferences`, `alertsSms` on Consumer type is preserved. Implement after phone verification flow is production-ready. |
| Supabase Realtime for live badge updates | Replace polling with `supabase.channel()` subscription on `notifications` table for the current user. Reduces latency from 60s to near-instant. |
| Push notifications (Web Push API) | Requires service worker. Deferred until mobile PWA strategy is confirmed. |
| Business portal in-app notifications | Business owners do not yet have a production auth system. Lead relay email is the v1 channel for businesses. |
| Email open/click tracking | Resend provides webhook delivery events. Build analytics view in admin once base system is stable. |
| Notification snooze / do not disturb | Product decision needed on whether this complexity serves the user base at current scale. |
| Multi-language email templates | Platform is English-only in v1. |
| Notification grouping / threading | Group multiple `new_message` notifications from the same claim into one row. Deferred for UX simplicity. |

---

## 14. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | What is the verified sending domain for Resend? Does `costfinders.com` have DNS access for DKIM setup? | Infra | Unresolved |
| Q2 | Which admin email addresses receive new lead notifications? Hard-code a list or query `admin` users from Supabase? | Admin Ops | Unresolved |
| Q3 | Should the claim confirmation email reveal the business name, or remain anonymous consistent with the "anonymous until committed" model? (The claim has already been committed, so reveal seems appropriate.) | Product | Unresolved |
| Q4 | For lead relay email to businesses: is the recipient the `master_business_info` website domain owner, or the `business_owner.email` from the claimed business profile? For unclaimed businesses, there is no `business_owner` row — relay must go to the manually-curated business contact. | Admin Ops | Unresolved |
| Q5 | Should the deal alert digest run daily or weekly by default? Weekly reduces email volume but delays alerts for time-sensitive deals. | Product | Unresolved |
| Q6 | What is the production `NEXT_PUBLIC_APP_URL` for email CTA links? Staging vs. production differences needed for Resend template testing. | Infra | Unresolved |
| Q7 | Is there a `CRON_SECRET` already set in Vercel environment variables, or does one need to be provisioned? | Infra | Unresolved |

---

## 15. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-03-20 | Product | Initial draft |
