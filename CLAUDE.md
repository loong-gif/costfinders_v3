# CostFinders - Project Instructions

> **Documentation lives in Obsidian**: `/Users/haris/CampusVault/Projects/CostFinders/` (start at `index.md`): overview, UX journeys
> per role, route map, architecture, database, pricing and trust, SEO, operations, the cutover plan,
> open issues and ADRs (`Decisions/`). This file keeps only the rules and traps a session needs
> before touching code. The repo keeps docs that change with the code: `docs/OPERATIONS.md` (runbooks),
> `docs/MESSAGING-STYLE-GUIDE.md`, `supabase/migrations/README.md`, `design-system/costfinders-v2/MASTER.md`,
> `CONTEXT.md` files, `.planning/DEAL-BROWSE-AND-TRUST.md` (spec cited by code) and
> `.planning/SCHEMA-GOVERNANCE-ASK.md` (shared with the data team). Everything else was retired to
> git history on 2026-09-30.
> **Every commit, push or merge to `main` updates the vault in the same unit of work** — see
> "Vault sync rule (CRITICAL)" below. A push with a stale vault is an unfinished change.
> **Continuing the cutover?** Open the vault's `Cutover/cutover-plan.md` → "Next session: start here".
> Global standards: `~/.claude/PRINCIPLES.md`

## Tech Stack Additions

Project-specific additions to global stack (Next.js 16 + React + TS + Tailwind):

- **Images**: **no stock photo on any deal surface** (owner decision, 2026-09-28): we hold no clinic photos, and one would name the clinic before a claim, so a treatment icon stands in (`treatmentIcons.ts`, MASTER.md). Otherwise local `/images` assets through `next/image`; deal uploads go to the Supabase `deal-images` bucket (rendered `unoptimized`). There is **no Cloudinary** — the module, the env var and the dead URL builder were deleted on 2026-09-16; `adapters.ts` sets `imageUrl: undefined` and says why. `images.remotePatterns` is deliberately empty until deal images ship from the bucket
- **Font**: Inter (UI/body, `font-sans`) + Inter Tight (display, `font-display`), via next/font. Sora was declared for six months and never rendered — see the `body` comment in `globals.css`
- **Icons**: Phosphor Icons only (`@phosphor-icons/react`)
- **Hosting**: Vercel
- **Database**: Supabase (project: "costfinder", `kdlpkjzcnbkjcvwsvlwn`)
  - `master_business_info` → business directory. **16 columns, including `phone` and `phone_source`; no email, no hours, no booking URL.** Several screens have been built assuming otherwise
  - `promo_offer_master` → the offer/price row. Price-before-discount is `regular_price`, **not** `original_price`
  - **Row counts move under you.** They were 957/1931 in an earlier doc, 419/1000 on 9 Sep, 419/1125 the next morning. Never hardcode a count or quote one in copy — derive it. See the pipeline warning below
  - Schema: `src/types/supabase.generated.ts` (generated), `supabase/schema-snapshot.json` (what the gate
    believes), vault `Database/` notes (the readable map)
- **Design System**: "Price Engine" — white ground, ink-navy text (`#0b1220`), one coral accent (`#cc3714`; `#ff5a36` for non-text marks only). See `design-system/costfinders-v2/MASTER.md`. Chosen 2026-09-18, replacing Warm Sand; **every page is on it** as of the same day. Colours come only from tokens — `tests/unit/tokenContrast.test.ts` fails `npm test` (so the pre-push gate) on a `[#hex]` class or a raw Tailwind palette colour. Any doc calling the site "Warm Sand" or "glassmorphic medium-dark" is stale.

---

## Frontend Architecture

Strict layered component architecture.

### Component Layers

```
src/components/
  ui/        → Layer 1: Design Primitives (no business logic)
  patterns/  → Layer 2: Reusable compositions (business-agnostic)
  features/  → Layer 3: Domain components (with data/logic)
  layout/    → App shell & navigation
```

### Import Rules (CRITICAL)

| Layer | Can Import From |
|-------|-----------------|
| `ui/` | External libraries only |
| `patterns/` | `ui/`, external libs |
| `features/` | `ui/`, `patterns/`, external libs |
| `layout/` | All layers |

**If upward import needed** → Extract to lower layer instead.

### App Structure

```
src/
  app/
    [state]/ deals/ treatments/ guides/   # public, data-backed (dynamicParams = false)
    dashboard/ business/ admin/           # role-gated by src/proxy.ts (no route groups)
    api/               # health, cron, Resend webhooks
    layout.tsx
  components/
    ui/ → patterns/ → features/ → layout/
  lib/
    actions/           # Server Actions
    utils/             # Helpers
  types/
```

---

## Design System

### Tokens

All design tokens are CSS variables in `globals.css`, surfaced as Tailwind utilities via `@theme`. There is no JS token module.

```tsx
// ❌ className="bg-[#FF6D00]"
// ✅ className="bg-brand-primary"
```

### Icons (Phosphor Only)

```tsx
import { House, User } from "@phosphor-icons/react";
<House size={20} weight="light" />   // default
<House size={20} weight="fill" />    // active
```

### Defaults

| Element | Default |
|---------|---------|
| Radius | `rounded-xl`, containers `rounded-2xl` |
| Padding | `px-4 sm:px-6 lg:px-8` |
| Container | `max-w-6xl` standard, `max-w-7xl` wide |

### Layout Pattern

Standard page structure with fixed header clearance:

```tsx
<PageWrapper moduleId="example">
  <GlobalHeader module="example" />
  {/* pt-20 clears the 64px fixed header. The padding sits INSIDE max-w-7xl, as in the
      header and footer — outside it, page content starts 32px left of the wordmark. */}
  <main className="pt-20 pb-20 md:pb-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{/* Page content */}</div>
  </main>
</PageWrapper>
```

---

## Conventions

- **Components**: camelCase (`profileHeader.tsx`)
- **Utilities**: camelCase (`useSomething.ts`)
- **Server-first**: Default Server Components; `'use client'` only when needed
- **No barrel files**: Import directly, not through index.ts

---

## The database moves without the repo (READ THIS FIRST)

**A second engineering process owns the data side of this project and reshapes the live
database from outside this repo.** It is not hypothetical and it is not finished:

- On 2026-09-05 it split the wide `promo_offer_master` into
  `promo_offer_items` / `clinic_services` / `clinic_promotions` / `clinic_memberships` and
  dropped 16 columns. Nothing in the repo noticed. `lint`, `tsc` and `build` all passed —
  the hand-written types still declared the dead columns — while `npm run build` died on
  `42703` and every dynamic offer query failed in production.
- On 2026-09-10 it applied **12 migrations in one hour**, grew offers 1000 → 1125, and moved
  `public.is_admin()` into a `private` schema. That last one silently locked every admin out
  of `/admin/dashboard`, because the app calls it over PostgREST and PostgREST only resolves
  `public`.

**What this means for you:** before diagnosing any "impossible" bug, check whether the schema
moved. `npm run schema:check` answers that in seconds, and the Vercel cron `/api/cron/gates`
runs the same check every 6 hours, alerting through `ALERT_WEBHOOK_URL`. A red drift gate is the
gate working — do not suppress it. (I suppressed it once as a "false positive" and it was hiding the admin
lockout above.)

Schema changes still ship as tracked SQL under `supabase/migrations/` and are then applied —
the file is the record, never the MCP call alone. Ledger versions never match file versions
(the ledger stamps its own); `supabase/migrations/README.md` maps them, and the drift gate
matches on **name**.

## Database & Server Rules (CRITICAL)

A production-readiness audit on 2026-09-03 found 41 P0 defects. Each rule below is one of them.

| Rule | Why |
|------|-----|
| **Migrations are tracked files** | Schema changes ship as SQL under `supabase/migrations/`, never applied ad-hoc through the Supabase MCP tool. Use the MCP to inspect and to apply a file you wrote, not to change things directly. |
| **Schema types are GENERATED** | `src/types/supabase.generated.ts` comes from the live schema — regenerate with `supabase gen types typescript --project-id kdlpkjzcnbkjcvwsvlwn`, never hand-edit, not even "just one function entry". Hand-maintained types are exactly how a nonexistent `original_price`, and later 22 dropped columns, passed a clean typecheck and took the site down. `src/types/supabase.ts` is thin aliases over it plus the app-facing `OfferView`. Note no client is parameterised with `Database`, so `.rpc()` is untyped and a new function needs no entry to compile. |
| **RLS policies ship with the table** | Every new table gets its policies in the same migration that creates it. RLS enabled with no policies returns **empty results, not errors** — which renders as a confident but false empty state in the UI. |
| **Server Actions are public HTTP endpoints** | Anyone can POST to one. Re-verify caller identity and ownership server-side in every action. Never trust a client-supplied id. |
| **`user_metadata` never gates authorization** | It is client-writable. Read privileges from a server-controlled table (`profiles`, `admin_profiles`), never from the JWT. |
| **"Done" means exercised** | A green build is not verification. Run the code path against the real database and report what you observed. |
| **Attack every security fix** | Get a real token, try the exploit, confirm `42501` — then confirm the legitimate operation still returns 200. A fix that also breaks the happy path is not a fix. |
| **A write is not done until a SELECT proves it** | `supabase-js` resolves rather than throws, and an RLS-filtered UPDATE returns `error: null` with zero rows. Every action here treated that as success and told the user, the owner and the audit log so. Select the row back. |
| **Grants are not RLS** | Supabase's default `GRANT ALL` was never tightened on most tables. `TRUNCATE` is not row-level, so RLS never sees it. Check `information_schema.role_table_grants` when adding a table. |

---

## The offer schema, and how to read it

`promo_offer_master` is the price row (19 cols). Everything else joins:

```
promo_offer_master
  ├─ business_id        → master_business_info
  ├─ promotion_id       → clinic_promotions   (campaign_start/end_date)
  ├─ membership_plan_id → clinic_memberships  (name, price, billing_period)
  └─ promo_offer_items  (item_name, delivered_units) → clinic_services (service_category, unit_type)
```

Three canonical rules live in `src/lib/data/offers.ts`. Do not reinvent them:

- **Title** = `item_name` of the lowest `offer_item_id`, falling back to `offer_raw_text`.
  Never join `clinic_services` just for a name — it costs a join and loses ~150 offers.
- **Category** = `service_category` of the first item that resolves one, **or null**. Some
  visible offers resolve none, and a **blanket offer** (a clinic-wide discount the pipeline
  linked to one service) is forced to null: `isBlanketWording()` on its text in `flattenOffer`,
  and `blanketOfferIds()` over its sibling rows in `forShoppers()`. `dbCategoryToTreatment(null)`
  is null, **not** `body`: such an offer gets no badge and no treatment page but stays on city
  and provider listings. `offerTreatmentRoute` is the same function. `service_category` is a
  **Postgres enum** since 2026-09-15 (10 members on 2026-09-24: Neurotoxin, Dermal Filler,
  Microneedling, Facial, Laser & Light, Laser Hair Removal, Wellness, Regenerative Injectable,
  Body Contouring, Skin Tightening) and
  `CATEGORY_MAP` / `DB_TO_TREATMENT` are keyed on it, so a dead key or an unmapped member is
  now a **compile error** rather than silent inventory loss. That vocabulary has been replaced
  under this repo twice; both times every filter had a total fallback and a whole bucket
  emptied with no error anywhere.
- **Visible** = `is_active` AND (`campaign_end_date` IS NULL OR not past). The promotion join
  **must be LEFT** — a third of offers have no promotion and an inner join silently drops them.

A fourth rule, the **price basis**, lives in `src/lib/data/adapters.ts` (`offerPriceBasis`). It
decides what a price buys: a rate ("$4.25 per unit"), a quantity ("$299 for 40 units") or a flat
total.
- The basis comes from `price_model` + `delivered_units` + `item_count`. It **never** comes from
  `clinic_services.unit_type`: that column is the service's vocabulary, and printing it after
  prices made 201 of 497 offers read wrong ("$299 unit").
- A price label always goes through `dealPricing()`.
- Ranking, filters and "from $X" go through `comparablePrice()`. Neurotoxins compare **per unit**
  (owner decision, 2026-09-18), everything else on what you pay. Any per-unit figure must say
  "per unit".
- A price the offer's own text does not state is never printed: `priceIsStated()` runs on every
  render, the same rule `npm run prices:check` flags.
- Over a pooled neurotoxin price the label is **"Neurotoxins", never "Botox"**: the cheapest row
  is usually Dysport, whose unit is a third the size. Name the floor's brand with
  `neurotoxinBrand()` (`floorBrandText()` on browse), and say "Botox … from $X" only over
  Botox-brand rows.

**How sure we are, and what a price sits beside** (2026-09-28; spec and decisions in
`.planning/DEAL-BROWSE-AND-TRUST.md`; counts from `getOffersWithBusinesses()` that day):
- Every deal carries a tier from `interpretOffer()`: **As advertised** / **Our math** /
  **Confirm when booking**. Labels, never a numeric score (owner decision). The names live only
  in `TIER_LABELS` in `interpretation.ts`, beside `describeInterpretation()` (the deal page's
  lines). `interpretOffer()`, `priceDefects()` and `isBlanketWording()` live in `adapters.ts`:
  `offerToAnonymousDeal()` calls them and every other data module imports adapters, so anywhere
  else is a cycle (`price-defects.ts` and `interpretation.ts` re-export). `check` = any price
  defect, or a discount the card leads with that the text doesn't state (`discount-unstated`);
  our correct count of "buy N, get M free" is `discount-derived`, Our math. A `check` deal has no
  `comparablePrice()`, so it is never ranked or pooled. 807 / 113 / 18 of 938 shown offers.
- **A regular price prints only in the clinic's own words** (`statedRegularPrice()`: in the
  text, or owner-typed). Otherwise no strike-through, no "Save X%", no list price in JSON-LD, and
  no percent or amount derived from it (`printableDiscount()`). 114 of the 292 offers carrying
  one did not state it.
- **"Typical" is neurotoxins only, per unit, one city at a time** (`TYPICAL_TREATMENTS` in
  `typicalPrice.ts`). Every other treatment pools unlike services — Newport Beach skincare's
  "typical $599" sat over $199–$4,500, one vial beside a three-session package — so its group
  says "from $X". Floor: ≥5 comparable priced deals from ≥3 providers. 8 cities cleared it.
  `computeGuidePricingStats()` moved into that file, because the browser imports it;
  `guide-stats.ts` re-exports it.
- **One rule for every neurotoxin figure, at the root** (owner: "be consistent", 2026-09-28).
  Two concepts, both in `typicalPrice.ts`: a **range** (typical, median, min–max, dot strips)
  pools through `pooledPrice()` — no Dysport units, no starting prices, no `check` deals —
  inside `computeGuidePricingStats()`, so the deals pages, the homepage hero, city chart and
  national strip, and the guides print the same number; a **floor** ("from $X", "Starting at",
  "lowest is …") is the real cheapest price through `floorPrice()`, Dysport included and named,
  starting prices never. Daxxify stays pooled (owner call). Cross-checked over 145
  treatment/city pairs, 0 mismatches. A guide's prose carries figures from the day it was
  drafted: when a pooled figure moves, the guide text must move with it (San Diego's $10.50
  became $11 that day). A guide page prints a median, range or "typical" only where
  `publishedGuideStats()` says the market supports one (a typical for neurotoxins; 3 priced
  deals from 3 clinics otherwise; "Median price" off neurotoxins), and the generator drafts
  only such pairs — `--existing` refreshes published ones (docs/OPERATIONS.md).
- **The membership fee shows only on the deal page** (`offerMembershipTerms()`, deal-detail path
  only). Listings say "for members" with a Members tag, never the fee. **Plan names are withheld
  until a claim** (owner, 2026-09-28): "Club FX" pointed at DermFx. `public_offers` returns
  `membership_name` NULL (`20260928010004`) and strips a row's own *distinctive* plan name out of
  its offer wording (`20260928010005`; names made only of generic words — "Deluxe Hydrafacial
  Membership", "Gold" — stay, the vocabulary is in the migration); a claimant gets the name
  through `claimed_membership_name()`, shown in the revealed clinic card. With the names gone,
  tiers the card cannot tell apart merge in `forShoppers()`, which keeps the **cheapest
  membership a year** (`keepsOver()`), never just the lowest id.
- **Feedback** (app-owned, `20260928010001`–`03`; detail in the vault's `Database/schema-and-offer-model.md`): `deal_reports`
  (Report a problem, signed out too, and "Did the clinic honor this price?" per claim) and
  `offer_confirmations` (an owner's Confirm / Suggest a correction). The "Confirmed by the
  clinic" badge is the `public_offer_confirmations` view: per offer, the latest row **not
  dismissed**, shown while it is a confirmation whose snapshot still equals the offer. So
  **dismissing a correction brings the earlier confirmation's badge back**: resolve a correction
  that stands. `admin_note` and `resolved_by` are not granted to `authenticated`; admins read
  them through `admin_feedback_notes()`. Admins work the queue at `/admin/dashboard/feedback`.
  `/how-it-works` explains all of it to shoppers; the deal page and browse lists link its
  anchors `#how-we-read-deals`, `#typical-prices` and `#why-names-are-hidden`. The browse and
  deal-page components are mapped in `src/components/features/deals/CONTEXT.md`.

**There is no moderation column any more.** `drop_promo_offer_moderation_columns` (2026-09-15,
out-of-band) dropped `moderation_status` and `moderation_notes`. Since `20260924050002` anon has no
grant on `promo_offer_master` at all: public reads go through the `public_offers` view, which applies
the same `is_active` predicate. `is_active` is the only
publication switch left, and it **defaults to TRUE** — so review happens by holding a deal
inactive: `20260916010001_owner_deals_start_inactive.sql` adds a BEFORE trigger that forces an
owner's insert inactive and rejects a non-admin flipping `is_active` (42501). The admin queue
publishes and takes down through that one switch; there is no approve/reject vocabulary left in
the app. The trigger short-circuits on `current_user`, so the pipeline (postgres, service_role)
is unaffected.

---

## Commands

```bash
npm run dev             # Development (overrides Cache-Control — cache work needs `next start`)
npm run build           # Production build
npm run lint            # Biome
npm run check           # Lint + format (writes)
npm test                # node:test, no framework
npm run schema:check    # Live schema vs committed snapshot
npm run schema:snapshot # Regenerate the snapshot — commit the diff
npm run prices:check    # Live priced rows the site cannot label truthfully, vs the baseline
npm run prices:baseline # Rewrite supabase/price-defects-baseline.json — a deliberate, committed decision
npm run generate:guides # Write the cost guides the live data qualifies for (Claude-drafted); `-- --dry-run` lists the gap
npm run gate            # The full gate below, by hand
```

**Full gate before calling anything done.** The Husky pre-push hook runs the same thing;
`npm run gate` runs it by hand. There is no CI: GitHub Actions was removed on 2026-09-24, so this
hook is the only gate a push meets before Vercel builds it. `HUSKY=0 git push` skips it and is
forbidden outside an incident.

```bash
npm run gate   # scripts/gate.sh: lint → check-error-logging → schema:check → next typegen
               # → tsc --noEmit → npm test → next build (into .next-gate) → prices:check
               # → guides:coverage (prints qualifying treatment/city pairs with no guide; never fails)
```

It loads `.env.local`, so the live-database steps and tests really run; stops at the first
failure; and prints each step's seconds. The build goes to `.next-gate` (`NEXT_DIST_DIR`, read in
`next.config.ts`), so the gate is safe beside a running `next dev`. `tsconfig.json` includes
`.next-gate/types` because `next build` insists on it for its distDir; the gate clears that
directory before `tsc`.

`next typegen` before `tsc` is required — `.next/types` is gitignored and generated. If a
hand-run tsc reports missing modules for routes you deleted, `rm -rf .next/types` first.

---

## Non-obvious things that will cost you time

- **Stop every running `next dev` / `next start` BEFORE `npm install`, `npm audit fix` or
  `next build` — then start it again.** (`npm run gate` is the exception: its build writes
  `.next-gate`, not `.next`.) Next is pinned exact (16.3.6) so a bump is a visible
  diff, not because upgrades break: the note that used to live here ("16.3.4 500s every route:
  `Cannot read properties of undefined (reading 'validationLevel')`") was a mixed-version
  process, not a Next bug. A 16.2.12 dev server whose `node_modules/next` was swapped
  underneath it recompiled routes with 16.3.4's page template against its in-memory 16.2.12
  config; a clean install serves every route. Likewise a `next build` under a running
  `next start` leaves it serving HTML whose `/_next/static` chunks 500. `rm -rf .next` after a
  Next bump before `next start`. The `sharp` override floor (`^0.35.4` = libheif 1.23.2) is the
  fix for GHSA-2xp9-vwfh-vxw4 — never lower it; 16.3.4 re-enables the HEIF loader on trust.
  `agentRules: false` in `next.config.ts` stops 16.3+ `next dev` from appending a managed
  block to this file.
- **Table-level grants silently defeat column-level REVOKE.** To restrict columns you must
  `REVOKE UPDATE ON <table>` first, then `GRANT UPDATE (col, col)`. Verify with
  `information_schema.column_privileges`.
- **Admins authenticate as the `authenticated` role**, so `REVOKE ... FROM authenticated`
  disables admins too. For "users can't set this but admins can", use a `BEFORE UPDATE` trigger
  comparing OLD/NEW and short-circuiting on `is_admin()` — see `guard_business_privileged_columns`.
- **RLS denies silently.** PostgREST returns an empty set, not an error, so the UI renders a
  confident false empty state. When a screen shows zero rows, check for a missing policy before
  assuming the data is absent. This has now caused three separate "feature is broken" bugs.
- **Every exported async function in a `'use server'` module is a public HTTP endpoint**, whether
  or not client code imports it. Helpers that don't need to be callable belong in a plain module —
  see `src/lib/email/send.ts`.
- **`Next inlines NEXT_PUBLIC_*` at build time.** A dynamic `process.env[name]` lookup is
  `undefined` at runtime. Read them as static property accesses.
- **Supabase Auth config and email templates are dashboard-only** — no file in this repo. Current
  text and rollbacks are recorded in `docs/OPERATIONS.md`. Magic Link, Confirm signup and Reset
  password (the last two since 2026-09-30) append `&token_hash=` to `{{ .RedirectTo }}`, so an
  origin missing from the redirect allowlist (or a reset sent from the Supabase Users page, which
  passes none) produces a malformed link with no token and nothing logged anywhere.
  **To change them:** use Chrome in the owner's signed-in Supabase dashboard. The Management API
  route using the Supabase CLI's keychain token is blocked by the auto-mode classifier (credential
  exploration), so don't try it. The template body is a Monaco editor: set it with
  `monaco.editor.getModels()[0].setValue(text)` (typing auto-closes tags), click Save, reload and
  compare in-page.
- **Vercel env values are all Sensitive: nobody can read one back**, not even the owner. To know a
  value, replace it (`vercel env add NAME production --value … --sensitive --force --yes`).
  `CLAIM_NOTIFICATION_EMAIL` and `SUPPORT_FORWARD_EMAIL` were set to haris@brandrap.com on 2026-09-30.
- **Mail to support@/leads@ is forwarded by the Resend inbound webhook** (option A, 2026-09-30).
  It breaks silently if Resend → Domains → costfinders.ai → Receiving is turned off, or if
  `RESEND_API_KEY` loses **full access** (reading a received body needs it). Both Resend webhooks
  (bounce and inbound) point at `costfindersv2.vercel.app` until cutover step C8.
- **Chrome automation here: the screenshot's coordinate frame is not the viewport**, so coordinate
  clicks miss and screenshots can lag the DOM. Click by `find` ref or a DOM `.click()` through
  `javascript_tool`, and confirm state in-page (`aria-pressed`, text) rather than from a screenshot.
- **If other agents are editing concurrently, re-read a file immediately before editing it**, not
  once at task start. An `Edit` failing with "string not found" is the signature of a stale read.

---

## Key Files

- `src/lib/data/offers.ts` - The offer data layer: joins, canonical rules, visibility predicate
- `src/lib/data/adapters.ts` - Offer → deal: price basis, `dealPricing()`, `comparablePrice()`,
  `statedRegularPrice()`, `interpretOffer()`, `priceDefects()`, `productLine()`
- `src/lib/data/typicalPrice.ts` - Typical prices and vs-typical; client-safe on purpose
- `.planning/DEAL-BROWSE-AND-TRUST.md` - Rows, groups, tiles, the deal page and the trust
  features: the spec, the owner decisions and the measured numbers
- `src/app/auth/callback/route.ts` - Handles all three shapes Supabase can return (`code`,
  `token_hash`, implicit fragment → `/auth/complete`)
- `src/lib/gates/schemaDrift.ts` - The drift gate; its header documents every blind spot.
  `npm run schema:check` and the `/api/cron/gates` Vercel cron both run it
- `scripts/gate.sh` - The pre-push gate (`npm run gate`)
- `docs/OPERATIONS.md` - Everything outside the repo: email templates, health check, domain
  cutover runbook, what is owner-blocked
- `docs/MESSAGING-STYLE-GUIDE.md` - Messaging patterns and copy standards
- `supabase/migrations/README.md` - file→ledger version mapping
- `.planning/SCHEMA-GOVERNANCE-ASK.md` - the working agreement with the data team
- Vault `Cutover/cutover-plan.md` and `open-issues.md` - **the current work queue**: live state, the
  cutover runbook, everything open and who can unblock it. Start at the plan's "Next session: start
  here". Re-measure before acting

---

## Owner-blocked (do not fake these)

Needs a person with console access or a business decision — leave the surface honest and say so
rather than inventing a value: a payment processor (Stripe account, prices, tax entity); the
company facts and counsel review the `/privacy` and `/terms` drafts need (every one is a `null`
in `src/lib/legal/companyFacts.ts`, and the draft banner stays up until none is; the owner chose
to hold the cutover for them, and a questionnaire went out on 2026-09-30); revoking
the unused Google Places key; deleting the old GitHub Actions secrets; rotating the Resend key
(it must stay **full access**: the support@/leads@ forward reads received mail with it); and
whether relaying a lead should move `claims.status` off `pending`. (`ALERT_WEBHOOK_URL`,
`CRON_SECRET`, `VERCEL_DEPLOY_HOOK_URL` and, since 2026-09-30, the inbound mail forward to
`SUPPORT_FORWARD_EMAIL` are set.) An external uptime monitor on `/api/health` is handled by the
owner outside this project (2026-09-30): don't list it as a blocker. The vault's `open-issues.md`
tracks each one's status.

---

## Self-Documentation

### After Feature Implementation
- Update structure if directories changed
- Create `src/[feature]/CONTEXT.md` for modules with 3+ files
- **Update the vault**: mandatory, before the push. See "Vault sync rule (CRITICAL)" below
- **Consult `docs/MESSAGING-STYLE-GUIDE.md`** for all copy-related changes (error messages, success states, form labels, notifications)

### Standards
- **Reference, don't copy**: Link to files (`src/lib/auth.ts:45`)
- **Why over what**: Document rationale
- **Token budget**: Keep under 1500 tokens

---

## Testing as each user type

Three real accounts exist. **Use magic links for all three** — there are no passwords to type,
which also means an assistant that may not enter credentials can still reach every screen.

Password sign-in DOES exist as a live path (`src/app/admin/page.tsx` →
`admin-auth.ts` `signInWithPassword`). A second account, `admin@costfinder.local`, once had its
password committed to this repo; on 2026-09-24 migration `20260924000001` stripped its admin
row, revoked every session and replaced the password with a random value, so the string still
in git history is inert. `haris+admin@brandrap.com` is the only admin. Do not re-add the old
account — the three `haris+*` magic-link accounts below are the sanctioned ones.

| Account | Role | Backing |
|---|---|---|
| `haris+user@brandrap.com` | consumer | `profiles` row |
| `haris+biz@brandrap.com` | business owner | approved on `business_id` 765 (New Look Skin Center) |
| `haris+admin@brandrap.com` | admin | row in `admin_profiles` — **membership IS the privilege** |

### Getting a session

Send the link, pointing `next` at the screen you want to land on:

```bash
set -a; . ./.env.local; set +a
RT=$(python3 -c "import urllib.parse;print(urllib.parse.quote('http://localhost:3000/auth/callback?next=/business/dashboard/leads',safe=''))")
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/magiclink?redirect_to=$RT" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"haris+biz@brandrap.com"}'
```

`redirect_to` is a **query parameter** on GoTrue's REST API. Passing it in the JSON body is
silently ignored and the link falls back to Site URL — which looks exactly like a misconfigured
allowlist and will waste an hour. `supabase-js` gets this right on its own.

Then fetch the link and follow it. **Fastest (2026-09-30):** the Resend MCP (`list-emails`, then
`get-email`) shows the sent body at once, because Supabase's SMTP is Resend. Or use the Gmail MCP:
`search_threads`, then `get_message` with `FULL_CONTENT`, and take the `href` from `htmlBody` intact.
The addresses are aliases of `haris@brandrap.com`. Traps if you go through the Gmail UI instead:

- **All three addresses share one Gmail thread** (same subject). "The newest link in the DOM" is
  often the wrong recipient's. Filter to the message block whose own text contains the address
  you want, or open the message permalink `#all/<messageId>`.
- **Gmail's search index lags** — a link sent seconds ago may not appear in `search_threads`
  results yet. The DOM is current even when the index is not.
- **Plaintext/HTML bodies mangle the token** (`token=` renders as junk). Do not reconstruct the
  URL by hand; read the `href` from the DOM, or decode the RAW message.
- Programmatic `.click()` is popup-blocked. `window.location.href = link.href` works.

### What to verify per role

- **Consumer**: `/dashboard`, claim a deal end to end (it writes a real `claims` row and reveals
  the business), `/dashboard/claims` (the honor question), `/dashboard/messages`,
  `/dashboard/settings`.
- **Business**: `/business/dashboard/leads` (a lead should appear — it showed a confident empty
  state for months), lead detail → Mark Contacted → contact details, `deals/[id]/edit` price save,
  `/business/dashboard/deals` Confirm / Suggest a correction.
- **Admin**: `/admin/dashboard/deals` (take a deal off the site and put it back — that IS the
  review decision now, see the offer-schema section), `/admin/dashboard/leads` (relay),
  `/admin/dashboard/feedback`.

There is one real claim on business 765 kept for exactly this. If you consume or cancel it,
say so. A report, a claim answer or a correction you file lands in the feedback queue, and all
but a "Yes" answer email the ops inbox: say it is a test in its note and close it there (a
correction: resolve, never dismiss — see the offer-schema section). A confirmation is not a
queue item. `docs/OPERATIONS.md` lists the test rows closed so far.

### Things that are true and will confuse you

- **Every business owner is also a consumer** — `handle_new_user` gives every signup a
  `profiles` row. The owner can open `/dashboard/settings` and see consumer settings.
- **Business onboarding is closed.** Nothing in the app inserts `business_profiles`, and
  `20260924040004` made `handle_new_business_user()` a no-op, so no new account (consumer or
  otherwise) can become an owner. Fix ownership verification before running that migration's
  rollback block.
- Only **1 of 419** businesses has an owner account, so most claims can never produce a
  conversation. That is real, not a bug to paper over.
- `private.is_admin()` is the implementation (RLS policies call it); `public.is_admin()` is a
  thin wrapper that exists **only** because the app calls it over PostgREST. Do not delete it.

---

## UI Testing Rule (CRITICAL)

**After creating or modifying any page UI**, drive it with Chrome automation (`mcp__claude-in-chrome__*`): navigate to the page, screenshot it, click through the interactive elements, and check the screenshot for the Price Engine tokens (no brown, no sand), layout intent, visual regressions, and responsive behaviour.

**Mandatory** — never assume a UI change is correct without visual verification. This is not
ceremony: the authenticated screens passed code review and typecheck for months while the
business lead list was structurally incapable of returning a row, and a "reveal contact details"
promise rendered `Available after consumer profile integration` to the customer. Both were found
by clicking, not reading.

Client-rendered dashboard pages fetch after mount — wait ~3-5s before reading text, or you will
report an empty page that is merely loading.

---

## Git Workflow Override

**Work directly on `main` branch.** Do not create feature branches, worktree branches, or any other branches. Commit all changes directly to `main`. This overrides the default feature-branch workflow from RULES.md.

---

## Vault sync rule (CRITICAL)

**Every commit, push or merge that reaches `main` updates the Obsidian vault
(`/Users/haris/CampusVault/Projects/CostFinders/`) in the same unit of work, before the `git push`.**
The same applies to changes made outside git: the Supabase dashboard, Vercel env, Resend, DNS,
and data fixes. Those facts exist nowhere else. A push with a stale vault is an unfinished change, not a
follow-up.

**Enforced by a hook.** `.claude/hooks/vault_sync_check.py` (registered in `.claude/settings.json`) denies
`git push` and `gh pr merge` unless a vault note changed after the last push to `origin/main`. For a change
that truly needs no docs, add a line `Vault: none (<reason>)` to HEAD's commit message. The hook checks only
mtimes, so touching a note to get past it breaks this rule. A push from a terminal outside Claude Code is
not checked.

Before each push:
1. `git diff --stat origin/main..HEAD` (plus any out-of-repo change you made). Map every changed
   area to its vault notes with the table below.
2. Edit those notes: rewrite the now-stale statements, don't append contradictions. Grep the vault
   for the old fact (a count, a name, "open", `[!todo]`, "not yet") and fix every hit. Set
   frontmatter `date:` to today and link related notes with `[[wikilinks]]`.
3. Any number you write must be one you measured this session, with its date.
4. In your final message, list the vault notes you changed. If none needed changing, say "no vault
   change: <reason>" (for example a test-only change). Never skip silently.

| Change | Vault notes |
|---|---|
| Page or route added, changed or removed | `UX-Journeys/route-map.md` + the role's journey note |
| Owner or business decision | New `Decisions/YYYY-MM-DD-title.md` ADR + a row in `Decisions/index.md` |
| Blocker or owner item opened, closed or changed | `open-issues.md`; `Cutover/cutover-plan.md` if it touches the cutover |
| Migration, schema, RLS, grants, views | `Database/` notes (schema, security, pipeline & drift) |
| Price basis, typical prices, trust tiers, feedback | `Pricing-and-Trust/` |
| Redirects, sitemap, indexing, metadata, guides | `SEO/` |
| Env var, cron, webhook, email or mail routing, Vercel, Railway, alerting | `Operations/` |
| Server actions, API routes, auth, component layering | `Architecture/` |
| A milestone or a change to overall status | `00-Overview.md` (status callout and timeline) |

If the Obsidian MCP is unreachable, edit the files directly. `docs/OPERATIONS.md` and the vault are
separate: a runbook change updates both.

---

## Project-Specific Overrides

| Override | Reason |
|----------|--------|
| Price Engine design | White ground, ink text, one coral accent; the data is the visual. Tokens only — no hex in classNames |
| Live Supabase data | The app reads and writes the live `costfinder` project. **There is no staging database** — local dev and every PR preview hit production. Mock fixtures are largely gone; screens that had nothing real behind them were removed rather than labelled |
| Role-based views | Single app serves consumer, business, and admin experiences |
| Anonymous until committed | Business details hidden until user creates account + verifies |

---

## Design References

- **Kayak**: Comparison UX patterns
- **Groupon**: Deal presentation
- **Zocdoc**: Booking flows

---

# Global Config Imports
@~/.claude/PRINCIPLES.md
@~/.claude/RULES.md
@~/.claude/MCP_Context7.md
@~/.claude/MCP_Sequential.md
@~/.claude/MCP_Serena.md
@~/.claude/MCP_Linear.md
