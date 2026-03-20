# Routes & Pages

> Complete catalog of every route in CostFinders v2. 45+ pages across public, consumer, business, and admin sections.

---

## Public / Marketing

| Route | File | Purpose | Data Source | Rendering |
|-------|------|---------|-------------|-----------|
| `/` | `src/app/page.tsx` | Homepage — hero, trending deals, categories, cities, value props | Supabase (featured offers, categories, cities) | Dynamic |
| `/treatments` | `src/app/treatments/page.tsx` | All treatment categories with deal/provider counts | Mock data | Static |
| `/treatments/[category]` | `src/app/treatments/[category]/page.tsx` | Deals for a specific treatment (botox, fillers, etc.) | Mock data | SSG |
| `/deals` | `src/app/deals/[[...slugs]]/page.tsx` | Redirects to auto-detected city | Geolocation | Dynamic |
| `/deals/[city]` | `src/app/deals/[[...slugs]]/page.tsx` | City deals listing with filters | Mock data | SSG |
| `/deals/[treatment]/[city]` | `src/app/deals/[[...slugs]]/page.tsx` | Treatment + city combination page | Mock data | SSG |
| `/deals/[dealId]` | `src/app/deals/[[...slugs]]/page.tsx` | Deal detail with pricing, sidebar, CTA | Mock data | SSG |

## Location Hierarchy (SEO Cluster)

| Route | File | Purpose | Rendering |
|-------|------|---------|-----------|
| `/[state]` | `src/app/[state]/page.tsx` | State overview with city grid | SSG |
| `/[state]/[city]` | `src/app/[state]/[city]/page.tsx` | City overview with neighborhood grid | SSG |
| `/[state]/[city]/[neighborhood]` | `src/app/[state]/[city]/[neighborhood]/page.tsx` | Neighborhood deals listing | SSG |
| `/[state]/[city]/provider/[slug]` | `src/app/[state]/[city]/provider/[slug]/page.tsx` | Provider profile with deals, contact, rating | SSG |

**Supported states:** California, Texas, New York, Florida

## Consumer Dashboard

All routes require consumer authentication. Redirects to `/` if not signed in.

| Route | File | Purpose |
|-------|------|---------|
| `/dashboard` | `src/app/dashboard/page.tsx` | Overview — saved deals, active claims, verification status |
| `/dashboard/favorites` | `src/app/dashboard/favorites/page.tsx` | Saved/favorited deals |
| `/dashboard/claims` | `src/app/dashboard/claims/page.tsx` | Claim history with status filters (All, Active, Completed, Cancelled) |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | Profile, notifications, account management |

**Layout:** `src/app/dashboard/layout.tsx` wraps with `AuthenticatedDashboardLayout` + `DashboardSidebar`

## Business Portal

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/business` | `src/app/business/page.tsx` | Public | Entry point — find or create business |
| `/business/claim/[businessId]` | `src/app/business/claim/[businessId]/page.tsx` | Public | Multi-step ownership claim flow |
| `/business/create` | `src/app/business/create/page.tsx` | Prompts | Create new business (auth → form → success) |
| `/business/dashboard` | `src/app/business/dashboard/page.tsx` | Business | Overview — metrics, quick actions |
| `/business/dashboard/deals` | `.../deals/page.tsx` | Business | Deal management list |
| `/business/dashboard/deals/new` | `.../deals/new/page.tsx` | Business | Create new deal form |
| `/business/dashboard/deals/[dealId]/edit` | `.../deals/[dealId]/edit/page.tsx` | Business | Edit existing deal |
| `/business/dashboard/deals/sponsored` | `.../deals/sponsored/page.tsx` | Business | Sponsored deal configuration |
| `/business/dashboard/leads` | `.../leads/page.tsx` | Business | Lead management list |
| `/business/dashboard/leads/[claimId]` | `.../leads/[claimId]/page.tsx` | Business | Lead detail with response actions |
| `/business/dashboard/leads/pricing` | `.../leads/pricing/page.tsx` | Business | Lead credit packages |
| `/business/dashboard/messages` | `.../messages/page.tsx` | Business | Customer messaging |
| `/business/dashboard/analytics` | `.../analytics/page.tsx` | Business | Performance analytics |
| `/business/dashboard/profile` | `.../profile/page.tsx` | Business | Edit business info |
| `/business/dashboard/pricing` | `.../pricing/page.tsx` | Business | Subscription tiers and billing |
| `/business/dashboard/settings` | `.../settings/page.tsx` | Business | Settings hub |
| `/business/dashboard/settings/account` | `.../settings/account/page.tsx` | Business | Account details, billing history |
| `/business/dashboard/settings/account/checkout` | `.../settings/account/checkout/page.tsx` | Business | Checkout/upgrade flow |
| `/business/dashboard/settings/integrations` | `.../settings/integrations/page.tsx` | Business | Third-party integrations |

## Admin Panel

All routes require admin authentication. Login at `/admin`.

| Route | File | Purpose |
|-------|------|---------|
| `/admin` | `src/app/admin/page.tsx` | Email-based admin login (demo: admin@costfinders.com) |
| `/admin/dashboard` | `.../dashboard/page.tsx` | Platform overview — metrics, moderation queue |
| `/admin/dashboard/deals` | `.../deals/page.tsx` | Deal moderation (approve, reject, request changes) |
| `/admin/dashboard/users` | `.../users/page.tsx` | Consumer user management |
| `/admin/dashboard/businesses` | `.../businesses/page.tsx` | Business profile management |
| `/admin/dashboard/content` | `.../content/page.tsx` | Content management hub |
| `/admin/dashboard/content/categories` | `.../content/categories/page.tsx` | Treatment category CRUD |
| `/admin/dashboard/content/locations` | `.../content/locations/page.tsx` | Location/city management |
| `/admin/dashboard/content/treatments` | `.../content/treatments/page.tsx` | Treatment data management |
| `/admin/dashboard/reports` | `.../reports/page.tsx` | Analytics and platform reports |
| `/admin/dashboard/monetization` | `.../monetization/page.tsx` | Revenue and subscription overview |
| `/admin/dashboard/monetization/business/[businessId]` | `.../business/[businessId]/page.tsx` | Per-business billing overrides |
| `/admin/dashboard/data` | `.../data/page.tsx` | Data import/export tools |

## Utility Routes

| Route | File | Purpose |
|-------|------|---------|
| `/sitemap.xml` | `src/app/sitemap.ts` | XML sitemap (~131 URLs) with priorities and change frequencies |
| `/robots.txt` | `src/app/robots.ts` | Crawler directives (disallows `/admin/`, `/dashboard/`, `/api/` in production) |

---

## Access Control Summary

| Section | Auth Required | User Type |
|---------|---------------|-----------|
| Public pages | None | Anyone |
| Consumer dashboard | Yes | Consumer |
| Business portal entry | None | Anyone |
| Business dashboard | Yes | Business owner |
| Admin panel | Yes | Admin |

All auth checks are client-side via React Context. No server middleware yet.
