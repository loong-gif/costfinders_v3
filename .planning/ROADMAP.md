# Roadmap: CostFinders

## Overview

Build the complete CostFinders platform — a price transparency and lead generation platform for medical spas. Live Supabase integration with 354 businesses and 347 offers. Hosted on Vercel with CI/CD, structured logging, analytics, and performance optimization.

## Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-10) — SHIPPED 2026-01-11
- ✅ [v1.1 UI Consistency & Polish](milestones/v1.1-ROADMAP.md) (Phases 11-15) — SHIPPED 2026-01-12
- ✅ **v1.2 Messaging Style Guide** — Phases 16-23 — SHIPPED 2026-01-12
- ✅ **v1.3 Location SEO Clusters** — Phases 24-33 — SHIPPED 2026-01-14
- ✅ **v1.4 Mobile Polish + Performance** — Phases 34-41 — SHIPPED 2026-03-24
- ✅ **v1.5 PRD Completion** — SHIPPED 2026-03-24

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-10) — SHIPPED 2026-01-11</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-01-09
- [x] Phase 2: Location Discovery (2/2 plans) — completed 2026-01-09
- [x] Phase 3: Deal Browsing (4/4 plans) — completed 2026-01-09
- [x] Phase 3.1: Image Blur (1/1 plan) — completed 2026-01-09 (INSERTED)
- [x] Phase 4: Consumer Auth (5/5 plans) — completed 2026-01-09
- [x] Phase 5: Consumer Dashboard (5/5 plans) — completed 2026-01-09
- [x] Phase 6: Business Onboarding (3/3 plans) — completed 2026-01-10
- [x] Phase 7: Business Dashboard (5/5 plans) — completed 2026-01-10
- [x] Phase 8: Admin Core (4/4 plans) — completed 2026-01-12
- [x] Phase 9: Admin Platform (2/2 plans) — completed 2026-01-12
- [x] Phase 10: Monetization UI (5/5 plans) — completed 2026-01-12

**Total:** 11 phases, 39 plans, 3.8 hours execution time

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.1 UI Consistency & Polish (Phases 11-15) — SHIPPED 2026-01-12</summary>

- [x] Phase 11: Design System Audit (3/3 plans) — completed 2026-01-12
- [x] Phase 12: Shared Components (2/2 plans) — completed 2026-01-12
- [x] Phase 13: Navigation Overhaul (2/2 plans) — completed 2026-01-12
- [x] Phase 14: Module Polish (6/6 plans) — completed 2026-01-12
- [x] Phase 15: Admin Polish & QA (2/2 plans) — completed 2026-01-12

**Total:** 5 phases, 15 plans

See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.2 Messaging Style Guide (Phases 16-23) — SHIPPED 2026-01-12</summary>

- [x] Phase 16: Messaging Audit (3/3 plans) — completed 2026-01-12
- [x] Phase 17: Voice & Tone Definition (1/1 plan) — completed 2026-01-12
- [x] Phase 18: Error Messaging System (1/1 plan) — completed 2026-01-12
- [x] Phase 19: Success & Confirmation States (1/1 plan) — completed 2026-01-12
- [x] Phase 20: Empty States & Placeholders (1/1 plan) — completed 2026-01-12
- [x] Phase 21: Form Validation Copy (1/1 plan) — completed 2026-01-12
- [x] Phase 22: Notification Templates (1/1 plan) — completed 2026-01-12
- [x] Phase 23: Documentation & Guidelines (1/1 plan) — completed 2026-01-12

**Total:** 8 phases, 10 plans

</details>

<details>
<summary>v1.3 Location SEO Clusters (Phases 24-33) — SHIPPED 2026-01-14</summary>

- [x] Phase 24: SEO Foundation (3/3 plans) — completed 2026-01-12
- [x] Phase 25: State Pages (1/1 plan) — completed 2026-01-12
- [x] Phase 26: City Pages (1/1 plan) — completed 2026-01-12
- [x] Phase 27: Neighborhood Pages (1/1 plan) — completed 2026-01-12
- [x] Phase 28: Provider Pages (1/1 plan) — completed 2026-01-13
- [x] Phase 29: Service Category Pages (1/1 plan) — completed 2026-01-13
- [x] Phase 30: Dynamic Sitemap (1/1 plan) — completed 2026-01-14
- [x] Phase 31: Internal Linking (2/2 plans) — completed 2026-01-14
- [x] Phase 32: Content Optimization (1/1 plan) — completed 2026-01-14
- [x] Phase 33: Performance & Core Web Vitals (1/1 plan) — completed 2026-01-14

**Total:** 10 phases, 13 plans

</details>

### ✅ v1.4 Mobile Polish + Performance (SHIPPED 2026-03-24)

**Milestone Goal:** Enhance mobile experience, implement comprehensive performance optimization, add reliability infrastructure, analytics, and CI/CD.

**Performance work included:** WebP images (84% size reduction), Supabase RPC functions, React cache() deduplication, Promise.all() parallelization, lazy auth providers, hero server component, CSS-only animations, CDN caching headers, Cloudinary pipeline, structured logging in all 58 server action catch blocks, 6 custom analytics events, GitHub Actions CI, k6 load tests, segment error boundaries, health check endpoint.

#### Phase 34: Mobile Form Optimization ✓

**Goal**: Fix form layouts to stack properly on mobile, improve input spacing
**Depends on**: Previous milestone complete
**Research**: Unlikely (internal patterns)
**Plans**: 1/1 complete

Plans:
- [x] 34-01: Responsive grid fixes for all form components

#### Phase 35: Mobile Table Alternatives ✓

**Goal**: Add card-based mobile variants for tables missing them
**Depends on**: Phase 34
**Research**: Unlikely (existing BillingHistory pattern)
**Plans**: 6/6 complete

Plans:
- [x] 35-01: DealList Mobile Cards
- [x] 35-02: DealPerformanceTable Mobile Cards
- [x] 35-03: Boost History Mobile Cards
- [x] 35-04: Business Activity Mobile Cards
- [x] 35-05: Credit Packages Mobile Cards
- [x] 35-06: Activity Log Mobile Cards

#### Phase 36: Bottom Sheet Component ✓

**Goal**: Create reusable bottom sheet for mobile menus and forms
**Depends on**: Phase 35
**Research**: Complete (CSS-only approach, following Modal pattern)
**Plans**: 1/1 complete

Plans:
- [x] 36-01: Bottom Sheet Component

#### Phase 37: Modal Mobile Optimization (Partial)

**Goal**: Full-screen and bottom-anchored modals on mobile
**Depends on**: Phase 36
**Research**: Unlikely (internal patterns)
**Plans**: 1/? complete

Plans:
- [x] 37-01: Add mobileVariant prop to Modal + apply to form-heavy modals

#### Phase 38: Touch Gesture Foundation ✓

**Goal**: Add swipe gestures for key interactions
**Plans**: 1/1 complete

Plans:
- [x] 38-01: BottomSheet swipe-to-dismiss (pointer events, 100px threshold, snap-back)

#### Phase 39: Mobile Navigation Enhancements ✓

**Goal**: Improve mobile navigation UX
**Plans**: 2/2 complete

Plans:
- [x] 39-01: Sticky filter/category bar on deals listing
- [x] 39-02: Reduce loading skeleton cards on mobile (6-9 → 3 visible)

#### Phase 40: Touch Target & Spacing Audit ✓

**Goal**: Ensure all interactive elements meet 44px minimum
**Plans**: 1/1 complete

Plans:
- [x] 40-01: Fix undersized touch targets (notification close, more menu close) + verify audit

#### Phase 41: Mobile QA & Polish ✓

**Goal**: Viewport configuration, safe-area support, cross-device readiness
**Plans**: 1/1 complete

Plans:
- [x] 41-01: Viewport export with viewportFit:cover, themeColor, safe-area-inset-bottom on mobile nav

### ✅ v1.5 PRD Completion (SHIPPED 2026-03-24)

**Milestone Goal:** Complete all well-built PRDs (01, 03, 05, 07, 09) to 100% coverage. Fill remaining gaps in auth, lead management, business tools, messaging, and admin operations.

**What was built:**
- PRD-03: Admin lead relay dashboard with relay tracking (relayed_at, relayed_by, relay_method)
- PRD-05: Moderation notes storage (reject/changes_requested persist notes to DB), deal image upload via Supabase Storage
- PRD-07: Supabase Realtime messaging (replaces 5s polling), typing indicator, realtime unread badge
- PRD-09: Admin audit log system (6 actions logged), content management CRUD (categories + locations with real data), user suspension RLS enforcement

**Supabase migrations applied:**
- admin_audit_log table + indexes
- Lead relay columns on claims table
- moderation_notes column on promo_offer_master
- content_categories + content_locations tables (seeded)
- deal-images storage bucket
- 3 suspension RLS policies

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → ... → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-01-09 |
| 2. Location Discovery | v1.0 | 2/2 | Complete | 2026-01-09 |
| 3. Deal Browsing | v1.0 | 4/4 | Complete | 2026-01-09 |
| 3.1 Image Blur | v1.0 | 1/1 | Complete | 2026-01-09 |
| 4. Consumer Auth | v1.0 | 5/5 | Complete | 2026-01-09 |
| 5. Consumer Dashboard | v1.0 | 5/5 | Complete | 2026-01-09 |
| 6. Business Onboarding | v1.0 | 3/3 | Complete | 2026-01-10 |
| 7. Business Dashboard | v1.0 | 5/5 | Complete | 2026-01-10 |
| 8. Admin Core | v1.0 | 4/4 | Complete | 2026-01-12 |
| 9. Admin Platform | v1.0 | 2/2 | Complete | 2026-01-12 |
| 10. Monetization UI | v1.0 | 5/5 | Complete | 2026-01-12 |
| 11. Design System Audit | v1.1 | 3/3 | Complete | 2026-01-12 |
| 12. Shared Components | v1.1 | 2/2 | Complete | 2026-01-12 |
| 13. Navigation Overhaul | v1.1 | 2/2 | Complete | 2026-01-12 |
| 14. Module Polish | v1.1 | 6/6 | Complete | 2026-01-12 |
| 15. Admin Polish & QA | v1.1 | 2/2 | Complete | 2026-01-12 |
| 16. Messaging Audit | v1.2 | 3/3 | Complete | 2026-01-12 |
| 17. Voice & Tone Definition | v1.2 | 1/1 | Complete | 2026-01-12 |
| 18. Error Messaging System | v1.2 | 1/1 | Complete | 2026-01-12 |
| 19. Success & Confirmation States | v1.2 | 1/1 | Complete | 2026-01-12 |
| 20. Empty States & Placeholders | v1.2 | 1/1 | Complete | 2026-01-12 |
| 21. Form Validation Copy | v1.2 | 1/1 | Complete | 2026-01-12 |
| 22. Notification Templates | v1.2 | 1/1 | Complete | 2026-01-12 |
| 23. Documentation & Guidelines | v1.2 | 1/1 | Complete | 2026-01-12 |
| 24. SEO Foundation | v1.3 | 3/3 | Complete | 2026-01-12 |
| 25. State Pages | v1.3 | 1/1 | Complete | 2026-01-12 |
| 26. City Pages | v1.3 | 1/1 | Complete | 2026-01-12 |
| 27. Neighborhood Pages | v1.3 | 1/1 | Complete | 2026-01-12 |
| 28. Provider Pages | v1.3 | 1/1 | Complete | 2026-01-13 |
| 29. Service Category Pages | v1.3 | 1/1 | Complete | 2026-01-13 |
| 30. Dynamic Sitemap | v1.3 | 1/1 | Complete | 2026-01-14 |
| 31. Internal Linking | v1.3 | 2/2 | Complete | 2026-01-14 |
| 32. Content Optimization | v1.3 | 1/1 | Complete | 2026-01-14 |
| 33. Performance & CWV | v1.3 | 1/1 | Complete | 2026-01-14 |
| 34. Mobile Form Optimization | v1.4 | 1/1 | Complete | 2026-01-14 |
| 35. Mobile Table Alternatives | v1.4 | 6/6 | Complete | 2026-01-14 |
| 36. Bottom Sheet Component | v1.4 | 1/1 | Complete | 2026-01-14 |
| 37. Modal Mobile Optimization | v1.4 | 1/? | Partial | 2026-01-14 |
| 38. Touch Gesture Foundation | v1.4 | 1/1 | Complete | 2026-03-23 |
| 39. Mobile Navigation Enhancements | v1.4 | 2/2 | Complete | 2026-03-24 |
| 40. Touch Target & Spacing Audit | v1.4 | 1/1 | Complete | 2026-03-24 |
| 41. Mobile QA & Polish | v1.4 | 1/1 | Complete | 2026-03-24 |
| PRD-03: Lead Relay | v1.5 | 1/1 | Complete | 2026-03-24 |
| PRD-05: Moderation + Images | v1.5 | 1/1 | Complete | 2026-03-24 |
| PRD-07: Realtime Messaging | v1.5 | 1/1 | Complete | 2026-03-24 |
| PRD-09: Audit + Content + RLS | v1.5 | 1/1 | Complete | 2026-03-24 |
