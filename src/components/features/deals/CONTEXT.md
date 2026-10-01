# Deal pages

The three deal pages `src/app/deals/[[...slugs]]/page.tsx` renders, and the blocks of the deal
page. Spec, owner decisions and measured numbers: `.planning/DEAL-BROWSE-AND-TRUST.md`. Every
deal these files receive comes through `toDeals()` in `src/lib/data/unified.ts`, so
`clinicConfirmedAt` is already stamped from `public_offer_confirmations`.

## Pages

| File | Route | Data it expects |
|------|-------|-----------------|
| `cityDealsPage.tsx` (client) | `/deals/{city}` | `initialDeals` (the city's `AnonymousDeal[]`), `treatmentCounts` (unfiltered deals per treatment: the chips and each group's "See all N"), `typical` = `typicalPrices(cityOffers)` over the same city's `OfferView[]`. Filters and sort run here; `DealsGrid` gets `groups` and draws `DealGroups` |
| `treatmentCityPage.tsx` (client) | `/deals/{treatment}/{city}` | The treatment's deals in the city, `treatmentCounts`, `typical` = `typicalPrices(cityOffers)[treatment] ?? null`. One flat list under a `TypicalBar`, or "Prices from $X" when `typical` is null. Imports `DEFAULT_SORT` and `treatmentLink` from `cityDealsPage` |
| `dealDetailPage.tsx` (server) | `/deals/{id}` | `deal`, `fullDeal` (plus `businessId`, for the claim sidebar), `typical` (null unless a neurotoxin deal whose city clears the floor; the loader skips the city fetch otherwise) and `membership` from `offerMembershipTerms()` |

## Blocks

| File | Renders | Notes |
|------|---------|-------|
| `dealGroups.tsx` (client) | The city's "All deals": one `DealList` per treatment in `TREATMENT_SLUGS` order, 4 cheapest rows, then "Other offers" (no treatment), which expands in place | `deals` must arrive filtered and sorted. Also exports `TypicalBar`, which `dealsGrid.tsx` reuses. The header words (`cheapestComparable`, `floorBrandText`, `priceText`, `typicalText`) live in `src/lib/data/typicalPrice.ts`, shared with the homepage hero |
| `priceInContext.tsx` | The deal against its city's typical price: vs-typical and a `PriceRangeBar` with this deal's tick | Rendered only when `typical` exists. Marks the deal only when `vsTypical()` is non-null; otherwise one sentence says why (Confirm when booking, no price, a starting price, a Dysport unit, no per-unit figure, a rate) |
| `howWeReadThisDeal.tsx` | The tier pill, "Confirmed by the clinic on {date}", the clinic's words, `describeInterpretation()` lines, Conditions, the `/how-it-works` link, `ReportDealProblem` | Relies on `describeInterpretation()` returning one line per reason, then one per note, in that order. `id="how-we-read"` is the price card's link target |
| `reportDealProblem.tsx` (client) | Report a problem: five reasons, optional note, inline sent/error states | `submitDealReportAction` (5 per IP per 10 minutes; emails the ops inbox). Works signed out. Moves focus to the result |
| `membershipTerms.tsx` | Membership: fee with its period, minimum commitment, or "The clinic didn't publish the membership price"; never the plan's name | Rendered only for `requiresMembership` |

## Rules that are easy to break

- **The membership fee is deal-page only** (owner decision, 2026-09-28). `MembershipTerms` is
  built on the deal-detail path and must never reach a listing payload; rows say "for members".
- **The plan's name waits for a claim** (owner decision, 2026-09-28). "Club FX" never says
  "DermFx" and still finds it in one search. `public_offers` returns it NULL, `offerTerms()` says
  "Membership required." and `MembershipTerms.name` is always null; a claimant sees it in the
  clinic card (`businessInfo.tsx`) through `claimed_membership_name()` in `getBusinessRevealAction`.
- **No photo, anywhere.** The treatment icon (`treatmentIcon()`) stands in; we hold no clinic
  photos, and one would name the clinic before a claim.
- **Quote `deal.description`, never `offer_raw_text`.** The description has been through
  `scrubProviderIdentity()`; the raw text can name the clinic.
- **"Typical" is neurotoxins only.** Every other treatment prints "from $X" and no bar
  (`TYPICAL_TREATMENTS` in `src/lib/data/typicalPrice.ts` says why).
- **A floor and a range are two things, each with one meaning site-wide** (owner, 2026-09-28;
  the header of `src/lib/data/typicalPrice.ts`). A FLOOR — "from $X", "Starting at", "lowest
  is …" — is `cheapestComparable()`/`floorPrice()`: any brand, a Dysport unit included and named
  with `floorBrandText()`, never a neurotoxin starting price. The guides' "Starting at" and the
  /guides hub print the same figure. A RANGE — the bar, "typical", a median, a dot strip — pools
  `pooledPrice()` (no Dysport, no starting price) and names its low end's brand in brackets with
  `minBrandText()`, never "lowest is". The homepage hero, its city chart and every neurotoxin
  median count the same prices as the typical here.
- **`/how-it-works` anchors** (`#how-we-read-deals`, `#typical-prices`, `#why-names-are-hidden`)
  are linked from here, `dealCard.tsx` and `dealsGrid.tsx`; rename one and those links break
  silently.
