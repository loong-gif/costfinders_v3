# Deal browsing and trust — spec (2026-09-28)

Owner-approved on 2026-09-28. Mockups: `design-system/costfinders-v2/mockups/deal-cards/`
(A compact tiles, B list rows, C grouped by treatment, plus a mobile comparison). This file is the
contract every implementing agent works from; where it names a file, type or function, that name
is binding so parallel work fits together.

## Why

- A deal card was 641px tall; the stock photo was ~60% of it; sticky chrome took 190 of 859px.
  About 3 deals per screen, 35,000px of scroll for Newport Beach's 156 deals.
- 15 stock images across 156 cards (`botox.webp` 20 times). We hold no clinic photos, and before a
  claim a clinic photo would identify the clinic anyway.
- Titles repeat ("Neurotoxin" x21); the offer text is what tells deals apart.
- Deals are read out of inconsistent clinic copy (units, brands, packages, memberships, discount
  shapes). Shoppers deserve to see how sure we are of our reading, and why.

## Owner decisions

1. **Browse = hybrid of B and C.** City "All deals" view is grouped by treatment (C); a single
   treatment (a chip or a `/deals/{treatment}/{city}` page) is a flat list of rows (B) with one
   range strip on top. Compact tiles (A) only for small homepage showcases.
2. **No stock photos on any deal surface.** A category icon in a tinted square replaces them.
3. **Interpretation labels, never a numeric confidence score.**
4. **Membership cost only on the deal detail page.** Listings say the price is for members
   ("for members" + Members tag) but never show the fee.
5. Trust items approved: How we read this deal (1), membership cost (2, detail only), clinic
   confirm/correct (3), Report a problem + post-claim "did they honor it" (4), no saving where the
   regular price is not in the clinic's own words (5), a "How CostFinders works" page (6).

6. **After the build (2026-09-28):** "typical" is neurotoxins only; see "Decisions after build".

Copy is US English ("honor"). Consult `docs/MESSAGING-STYLE-GUIDE.md` for every string.

---

## 1. Data contracts (foundation — `src/types/deal.ts`, `src/lib/data/*`)

### Interpretation (pure, `src/lib/data/interpretation.ts`)

```ts
export type InterpretationTier = 'as-advertised' | 'worked-out' | 'check'

/** Lowers the tier. */
export type InterpretationReason =
  | 'per-unit-divided'     // quantity basis: we print a per-unit figure we divided out
  | 'multiplied-out'       // stored total = stated rate x count; the total is our arithmetic
  | 'bundle'               // item_count > 1: one price across several treatments, titled by one
  | 'toxin-brand-unnamed'  // neurotoxin naming no single brand; compared against pooled brands
  | 'price-defect'         // any priceDefects(offer) — the site's own "cannot label truthfully"
  | 'discount-derived'     // no price; the % off is our count of "buy N, get M free"
  | 'discount-unstated'    // no price; the % or $ off it leads with is not in the text

/** Context only; never changes the tier. */
export type InterpretationNote =
  | 'from-price' | 'regular-price-unstated' | 'members-only' | 'new-patients-only'
  | 'clinic-wide' | 'no-treatment' | 'discount-only'

export interface DealInterpretation {
  tier: InterpretationTier
  reasons: InterpretationReason[]
  notes: InterpretationNote[]
}

export function interpretOffer(offer: OfferView): DealInterpretation
/** Headline + plain-language lines for the deal page, with the deal's own figures filled in. */
export function describeInterpretation(deal: AnonymousDeal): { headline: string; lines: string[] }
```

Tier rule: `check` if `price-defect` or `discount-unstated`; else `worked-out` if any other reason; else `as-advertised`.
Must reuse `priceDefects`, `offerPriceBasis`, `priceIsStated`, `figureInText`, `neurotoxinBrand`,
`isBlanketWording` — no second regex vocabulary. No circular import between `adapters.ts` and
`interpretation.ts` (compute it where the AnonymousDeal is built without a cycle).
Built: `interpretOffer()`, `priceDefects()` and `isBlanketWording()` live in `adapters.ts`;
`interpretation.ts` re-exports `interpretOffer()` and holds `TIER_LABELS` and
`describeInterpretation()`; `price-defects.ts` re-exports `priceDefects()`.

User-facing labels (single source: export `TIER_LABELS` from `interpretation.ts`):

| tier | label | one-line meaning |
|---|---|---|
| as-advertised | **As advertised** | Every figure here is in the clinic's own words. |
| worked-out | **Our math** | We worked something out from the clinic's wording. Here's what. |
| check | **Confirm when booking** | We couldn't be sure of the price from the clinic's wording. Confirm it when you book. |

Rows show the label for `worked-out` and `check` only (small grey text + icon); `as-advertised`
rows show nothing. The deal page always shows the tier. `check` deals sort after every comparable
deal in price sorts and never count toward typical prices.

### Carried fields

```ts
AnonymousDeal.interpretation: DealInterpretation
AnonymousDeal.clinicConfirmedAt: string | null      // foundation sets null; trust stage fills it
LeanOffer.interpretationTier: InterpretationTier
LeanOffer.requiresMembership: boolean
LeanOffer.clinicConfirmed: boolean
LeanOffer.comparable: ComparablePrice | null        // comparablePrice() of the deal
```

### Regular price must be the clinic's words (trust item 5)

In `offerToAnonymousDeal`: `originalPrice` is the regular price only when `figureInText(regular_price,
offer_raw_text)`, or the deal is owner-typed (`item_count === 0`); otherwise 0. So no strike-through,
no "Save X%", no "Regularly $X", no regular price in JSON-LD. `discountPercent` must not be derived
from an unstated regular price. Update `tests/unit/dealPricing.test.ts` accordingly.

### Typical price (pure, `src/lib/data/typicalPrice.ts`)

```ts
export interface TypicalPrice {
  treatment: TreatmentCategory; perUnit: boolean
  median: number; min: number; max: number
  pricedDealCount: number; providerCount: number
}
/** Pass ONE city's offers. Built on computeGuidePricingStats. Floor: >=5 comparable priced deals
 *  from >=3 providers. Excludes `check`-tier offers. */
export function typicalPrices(offers: OfferView[]): Partial<Record<TreatmentCategory, TypicalPrice>>
export function vsTypical(c: ComparablePrice | null, t: TypicalPrice | undefined):
  { percent: number; direction: 'below' | 'above' | 'about' } | null   // 'about' when |diff| < 5%
export function vsTypicalLabel(v): string  // "32% below typical" | "12% above typical" | "About typical"
```

Null unless the deal's comparable basis matches (perUnit === perUnit) and the deal is not `check`.
Published for `TYPICAL_TREATMENTS` only (neurotoxins; decision 6). `computeGuidePricingStats()`
moved into `typicalPrice.ts`, which the browser imports; `guide-stats.ts` re-exports it.

After review (2026-09-28): a named-Dysport row (`UNLIKE_UNIT_BRANDS`) and a "from $X" floor are
left out of the pool and never compared (`typicalExclusion()`; `ComparablePrice` carries `brand`
and `from`), and `TypicalPrice.minBrand` names a floor that isn't Botox. Every pooled neurotoxin
"from $X" names its brand when it isn't Botox (`floorBrandText()`). Daxxify is an owner call.

### Membership terms (detail page only)

```ts
export interface MembershipTerms {
  name: string | null          // null when it names the clinic (same scrub as offerTerms)
  price: number | null
  billingPeriod: 'monthly' | 'annual' | 'quarterly' | 'one_time' | null
  minimumCommitmentMonths: number | null
}
```

Built only on the deal-detail path; never serialised into a listing payload.

### Loader plumbing (`src/app/deals/[[...slugs]]/page.tsx`)

- city → `CityDealsPage typical={typicalPrices(cityOffers)}`
- treatment-city → `TreatmentCityPage typical={typicalPrices(cityOffers)[treatment] ?? null}`
- deal → `DealDetailPage typical={... ?? null} membership={MembershipTerms | null}`

### Shared UI primitives (created with the foundation so later agents reuse them)

- `src/components/patterns/priceRangeBar.tsx` — min to max track, coral fill to the median, optional
  ink marker for one deal; every number also printed as text; tokens only. Used by group headers,
  the single-treatment strip and the deal page.
- `src/components/patterns/treatmentIcons.ts` — `TreatmentCategory` to Phosphor icon (moved out of
  `categoryFilter.tsx`), plus a neutral icon for null.

### Measured 2026-09-28 (after the build, `getOffersWithBusinesses()`, 938 offers shown)

Tiers: 807 As advertised, 113 Our math, 18 Confirm when booking. Reasons: per-unit-divided 48,
bundle 41 (counted only where a price is shown), toxin-brand-unnamed 21, price-defect 16,
discount-unstated 3, multiplied-out 2, discount-derived 2. Notes: members-only 446, discount-only
419, regular-price-unstated 114, no-treatment 91, new-patients-only 80, clinic-wide 34,
from-price 10. None of the 18 check-tier deals had a comparable price even before
`comparablePrice()` learned the tier. Regular price: 114 of the 292 offers carrying one do not
state it, so they print no strike-through or saving; 163 strike-throughs remain. Typical price,
neurotoxins only (decision 6), with 37 Dysport and 3 "from" per-unit prices left out of the pool:
8 city pairs clear the floor, in 8 of 37 cities (Newport Beach $10/unit over 13 deals from 6
providers; Oklahoma City $10.10 over 28 from 9). On city pages 94 of 935 deals carry a vs-typical
label: 28 below, 24 above, 42 about typical. The foundation run the same morning, before
decision 6 and the Dysport rule, had 14 pairs in 10 cities and 176 labels.

---

## 2. Browse surfaces (B + C)

- **Row (B)** — `offerRow.tsx`, used everywhere a deal is listed. No photo: 36px (32px mobile)
  tinted square with the treatment icon. Offer text is the headline, from the existing
  `title`/`subtitle`; category + Members tag underneath. Right-aligned price column: lead,
  basis, strike-through; Save pill only where `savings` exists. `vsTypicalLabel` in text, green
  only for below. Interpretation label for worked-out/check. "Confirmed by the clinic" replaces
  the tier label when `clinicConfirmed`. Save (heart) action. Stretched link. Keep the phone
  wrap rules already in the file.
- **City "All deals" (C)** — groups in `TREATMENT_SLUGS` order: icon + label, "N deals" +
  "typical $X/unit" when a TypicalPrice exists, a `PriceRangeBar`, the 4 cheapest rows by
  `comparablePrice` (`check` last), "See all N" to `/deals/{treatment}/{city}`. Offers with no
  treatment go last, as "Other offers", expanding in place. Filters and sort apply inside groups.
- **Single treatment (B)** — `/deals/{treatment}/{city}`: one `PriceRangeBar` header, then every
  row. No vs-typical on `/treatments/{category}` (mixed cities); city label shown there and on
  favorites/dashboard lists, hidden on city and treatment-city pages.
- **Once, above the list:** "Provider names are revealed when you claim a deal" (with a link to
  `/how-it-works`). Delete the per-card lock line.
- **Filter bar** — one row on desktop (chips + Sort + Filters), sticky height ≤ 64px. Phone: chips
  scroll sideways, one compact row for Sort/Filters. Today it is 125px.
- **Remove** the grid/list toggle and the grid tile from browse. Skeletons match rows.
- **Homepage showcases (A)** — `OfferTile` in `offerCard.tsx` becomes a compact tile with no
  image: icon + category + heart, 2-line headline, big price + basis, Save pill. 4 columns desktop,
  2 on phones.
- **Delete** `treatmentThumbnail` and `public/images/treatments/*` once nothing references them.

## 3. Deal detail page

Replace the stock hero with, in order:
1. **Price in context** — `PriceRangeBar` for this treatment in this city with this deal's marker
   and `vsTypicalLabel`. Omitted when there is no TypicalPrice.
2. **How we read this deal** — tier label, the clinic's own words in quotes (already scrubbed
   `description`), `describeInterpretation` lines, conditions (members, new patients), a link to
   `/how-it-works`, and **Report a problem**. Shows "Confirmed by the clinic on {date}" when
   `clinicConfirmedAt` is set.
3. **Membership** (only when `requiresMembership`) — "This is a member price." then fee +
   billing period + minimum commitment; name if not null. No plan data → "The clinic didn't
   publish the membership price. Ask when you book."

**Report a problem** — reasons: The price is wrong / The deal has ended / The clinic wouldn't
honor it / The terms are different / Something else, plus an optional note (≤1000 chars). Works
signed out. Confirms in place. Does not trigger a browser dialog.

## 4. Database (tracked migrations, applied to live; the file is the record)

App-owned tables; `offer_id` follows the `listing_requests` precedent (`bigint references
public.promo_offer_master (id) on delete set null`). Policies ship with the table; revoke the
default grants (including TRUNCATE) and grant only what the policies need; admin via
`(select private.is_admin())`.

- **`deal_reports`** — id, offer_id, reporter_id (uuid null), claim_id (null), source
  (`deal_page` | `claim`), reason (`wrong_price` | `ended` | `not_honored` | `terms_differ` |
  `other` | `honored` | `different_price`), note (≤1000), status (`open` | `resolved` |
  `dismissed`), admin_note, created_at, resolved_at, resolved_by. One claim-sourced row per
  claim. Anyone may insert a `deal_page` report with a null reporter or their own uid; only the
  claim's consumer may insert or update a `claim` row; only admins select or update everything.
- **`offer_confirmations`** — id, offer_id, business_id, owner_id, kind (`confirmed` |
  `correction`), note (required for correction, ≤2000), snapshot jsonb (discount_price,
  regular_price, discount_percent, discount_amount, price_model, md5 of offer_raw_text),
  status (`open` | `resolved` | `dismissed`), created_at, resolved_at, resolved_by. Insert and
  select only by an approved owner of that business for that business's offers; admins select
  and update.
- **`public_offer_confirmations`** view — `(offer_id, confirmed_at)` for the latest `confirmed`
  row per active offer whose snapshot still equals the offer's current values. Exposes nothing
  else. Readable by anon, following the `public_offers` view precedent.

Server actions (every export is a public endpoint; re-verify identity; select the row back):
- `src/lib/actions/deal-feedback.ts` — `submitDealReportAction` (rate-limited per IP like
  listing requests; ops notice), `submitClaimFeedbackAction`, `getMyClaimFeedbackAction`.
- `src/lib/actions/offer-confirmations.ts` — `confirmOfferAction`,
  `requestOfferCorrectionAction`, `getOfferConfirmationsForBusinessAction` (with a stale flag).
- `src/lib/actions/admin-deal-reports.ts` — list/resolve reports and corrections; audit log.

## 5. Owner, admin and consumer surfaces

- **Business `/business/dashboard/deals`** — per deal: "Confirm it's correct", "Suggest a
  correction" (note). States: Confirmed on {date} / Changed since you confirmed / Correction sent.
- **Admin** — reports and correction requests queue with resolve/dismiss + admin note; a filter
  for `check`-tier deals. Corrections to scraped deals are applied by an admin through the
  existing deal editor. The pipeline may overwrite them; say so in the UI note.
- **Consumer `/dashboard/claims`** — per claim: "Did the clinic honor this price?" Yes / A
  different price / No. One answer per claim, changeable.
- **Confirmed badge** — `clinicConfirmedAt` filled from `public_offer_confirmations` in the offer
  data layer; shown on rows and the deal page.

## 6. "How CostFinders works" — `/how-it-works`

Where deals come from (clinics' own published offers; today mostly their websites' specials and
membership pages), how we read them (the three labels with examples), how "typical" is computed
(median of comparable prices in the city, at least 3 clinics; neurotoxins per unit), what we can
get wrong (units vs areas, Dysport vs Botox units, packages, membership fees, ended offers,
conditions), why names are hidden until a claim, how to report a problem, how clinics confirm or
correct. Present-tense facts only, no promises about the future. Linked from the footer, every
deal page and the browse note; in the sitemap.

## Not in scope

- "Last seen on the clinic's site." `updated_at` was rewritten for 761 of 947 offers on
  2026-09-19 and `monitor_state` records no processing dates. Needs the pipeline to stamp a
  last-seen date — a pipeline ask, not app work.

## Decisions after build (2026-09-28)

- **"Typical" is neurotoxins only, per unit** (`TYPICAL_TREATMENTS`, owner decision). Every other
  treatment pools unlike services, so its median is not a market: Newport Beach skincare's
  "typical $599" sat over a $199–$4,500 range (11 priced deals, 6 providers) that set a single
  vial beside a three-session package, and fillers pool single syringes, multi-syringe packages
  and Sculptra vials. Those groups and treatment pages say "from $X" with no range bar, and their
  deal pages have no Price in context. Within neurotoxins, Dysport units and "from" prices stay
  out of the pool and are never compared (`typicalExclusion()`); Daxxify is still pooled, an
  owner call.
- **A discount lead the clinic's words don't state is `check`.** With no price shown, a card
  leads with its percent or amount off, and that figure must be the clinic's too:
  `discount-unstated` (Confirm when booking) when the text states neither the percent nor the
  amount. The one shape we vouch for is our own arithmetic on "buy N, get M free" (M of N + M):
  a stored percent that matches it is `discount-derived` (Our math). One that doesn't is
  `discount-unstated`: 10431 "buy 6 … get 1 free" is stored as 16.67%, where 1 of 7 is 14%.
- **The product line** under a row's or tile's headline is `productLine()`, shared by rows,
  tiles and the deal page's icon line. Where the offer's words are the headline, the title goes
  underneath whenever it says more than the treatment (297 of 923 such offers never repeat their
  title: Botox 24, BBL Photofacial 14, Juvéderm 9, Sculptra 5). A title that only restates the
  treatment ("Neurotoxin") gives way to the treatment's label. A clinic-wide offer gets none,
  whatever service the pipeline linked it to; a blanket offer caught only through its siblings
  (`blanketOfferIds()`) still shows that service's name.

Owner answers, 2026-09-28 (second round):
- **Daxxify stays in the pool.**
- **"Be consistent":** every neurotoxin figure follows one rule at the root — ranges, medians and
  typicals pool through `pooledPrice()` (no Dysport, no starting prices), floors ("from",
  "Starting at", "lowest is") are the real cheapest price through `floorPrice()`, Dysport
  named. The homepage hero, city chart, national strip, guides and deals pages agree (145
  treatment/city pairs cross-checked, 0 mismatches). The hero says "typical", not "median".
- **The honor question stays on cancelled claims.**
- **Plan names are hidden until a claim:** withheld from `public_offers` (010004), scrubbed
  from offer wording where distinctive (010005), revealed to a claimant in the clinic card.
- **The phone Filters panel folds** on Done, on Enter, or once the shopper scrolls on while not
  typing in it.

Pipeline data, not app: 7720 stores 30 units for "30-40 units", 8087's per-unit regular price is
multiplied out, scraped markup in headlines. Guides drafted before the generator (2026-09-03)
carry a researched `localAvgPerUnit` that differs from the live median (e.g. Irvine 14 vs 10), and
Irvine's text quotes $13 where its chart plots $14: regenerate those when convenient.

## Status

- [x] Stage A — foundation, database, /how-it-works
- [x] Stage B — browse, homepage tiles, deal page, owner/admin/consumer trust UI
- [x] Gate green
- [ ] Browser verification (anon, consumer, business, admin; desktop and phone). Desktop done
  for all four. Phone done signed out and as admin; not yet as consumer or business owner
- [x] Adversarial review (14 findings, all fixed)
- [x] Docs
