# CostFinders

## What This Is

CostFinders is a price transparency and lead generation platform for medical spas. The v1.0 MVP is a complete UI-only Next.js application featuring consumer deal discovery, business portal, and admin tools — all with mock data structured for Supabase integration by a separate team.

## Core Value

**Deal discovery UX that makes finding and comparing medspa pricing effortless.** The browse → filter → compare → claim flow must feel intuitive, fast, and premium. Everything else supports this core experience.

## Current State (v1.0 MVP — Shipped 2026-01-11)

**Tech Stack:**
- Next.js 16 (App Router) + React + TypeScript
- Tailwind CSS v4 with Warm Sand design system
- Phosphor icons, Sora font (Manrope fallback)
- Mock data layer structured for Supabase

**Lines of Code:** 24,676 TypeScript
**Files:** 247

**What's Built:**
- Consumer: Deal browsing, location discovery, auth flows, dashboard, favorites, claims
- Business: Onboarding, deal management, lead inbox, messaging, analytics, profile
- Admin: Deal moderation, user management, content management, reporting, data tools
- Monetization: Tier system, billing UI, sponsored placements, lead pricing, admin overrides

## Requirements

### Validated

- [x] Location-first discovery (auto-detect + manual override) — v1.0
- [x] Deal browsing with filters (treatment type, price range, location) — v1.0
- [x] Anonymized deal cards (pricing visible, business hidden until claim) — v1.0
- [x] Account creation with email + SMS verification UI — v1.0
- [x] Business reveal on account creation — v1.0
- [x] Save deals to favorites — v1.0
- [x] Claim deals with preferred time request form — v1.0
- [x] Claim status tracking (Pending → Contacted → Booked → Completed) — v1.0
- [x] Deal alerts preferences (email/SMS toggles) — v1.0
- [x] User profile and settings — v1.0
- [x] Claim existing profile flow (find pre-created business, verify ownership) — v1.0
- [x] Create new business flow (if not in system) — v1.0
- [x] Business dashboard with deal management — v1.0
- [x] Lead inbox with claim details — v1.0
- [x] In-platform messaging with leads — v1.0
- [x] Performance analytics dashboard — v1.0
- [x] Business profile editing — v1.0
- [x] Scheduling integrations placeholder ("Coming Soon" UI) — v1.0
- [x] Deal moderation (approve, reject, request changes) — v1.0
- [x] User management (consumers and businesses) — v1.0
- [x] Content management (categories, locations, treatments) — v1.0
- [x] Platform reporting and metrics — v1.0
- [x] Data management tools UI — v1.0
- [x] Business tier system (Unclaimed → Free → Paid) — v1.0
- [x] Subscription billing UI (Stripe-ready) — v1.0
- [x] Sponsored placements configuration — v1.0
- [x] Per-lead pricing settings — v1.0
- [x] Admin overrides for all monetization settings — v1.0
- [x] Role-based views (consumer, business, admin) in single app — v1.0
- [x] Glassmorphic design system per style guide — v1.0
- [x] Responsive design (mobile-first, desktop-enhanced) — v1.0
- [x] Mock data layer structured for Supabase integration — v1.0

### Active

(None — v1.0 UI complete, awaiting backend integration)

### Out of Scope

- Native mobile apps (iOS/Android) — web only for v1
- Real backend integration — mock data, separate team handles backend
- Scraping/data collection tools — admin UI only, no actual scraping
- Scheduling system integrations — "Coming Soon" placeholder only
- Payment processing — UI only, no Stripe connection
- Real email/SMS sending — UI flows only

## Context

**Shipped v1.0 MVP** with complete UI covering all three user roles:
- Consumer deal discovery and account management
- Business onboarding, lead management, and monetization
- Admin moderation, content management, and platform reporting

**Business Model Insight**: Businesses don't need to sign up for deals to appear — CostFinders scrapes public sources. Three business tiers exist:
1. **Unclaimed** — scraped data, leads collected by CostFinders, business account pre-created
2. **Free** — business claims profile, can edit info/deals
3. **Paid** — premium placements, featured spots, newsletter inclusion, priority lead routing

**Next Steps**: Backend team integrates Supabase, then v1.1 connects real data.

## Constraints

- **Stack**: Next.js 16 (App Router) + React + TypeScript + Tailwind CSS v4 per CLAUDE.md
- **Hosting**: Vercel deployment
- **Images**: Cloudinary for image storage/optimization
- **SEO**: SSG where possible, meta tags, structured data
- **Icons**: Phosphor icons only
- **Design**: Glassmorphic style, grounded shadows, Manrope font
- **Structure**: Layered component architecture (ui → patterns → features → layout)
- **Mock Data**: Must align with Supabase schema structure for smooth handoff

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| UI-only build with mock data | Separate team handles backend; allows parallel development | Good — completed in 3 days |
| Single app with role-based views | Simpler deployment, shared components, unified codebase | Good — clean architecture |
| Location-first discovery | Medspa services are local; location is primary filter | Good — intuitive UX |
| Account creation triggers reveal | Ensures verified contact info before showing business details | Good — qualified leads |
| Three-tier business model | Supports gradual monetization as markets develop | Good — flexible model |
| Core medspa categories only | Focus on Botox, fillers, facials, lasers for v1 mock data | Good — clear scope |
| Glassmorphic design system | Medium-dark theme with glass effects | Good — premium feel |
| Biome over ESLint | Faster unified tooling | Good — faster dev cycle |
| CSS-first tokens with @theme | All values in :root, Tailwind utilities via @theme | Good — maintainable |
| AnonymousDeal pattern | Consumer-safe type excludes businessId | Good — privacy protection |
| localStorage for UI state | Simpler for mock data layer | Good — simple MVP |
| Icon-only sidebar | Minimal footprint (64px) with tooltips | Good — clean navigation |

---
*Last updated: 2026-01-11 after v1.0 milestone*
