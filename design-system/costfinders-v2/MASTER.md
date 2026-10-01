# CostFinders v2 Design System — "Price Engine"

> Master design reference. Direction: white ground, ink-navy text, one coral accent; the data
> (prices, ranges, bars) is the visual. Chosen 2026-09-18, replacing Warm Sand, and rolled out to
> every page the same day.
> Stack: Next.js 16 + Tailwind CSS v4 + Phosphor Icons
>
> Tokens live in `src/app/globals.css` (`@theme inline`) and are used as utilities
> (`bg-bg-base`, `text-text-primary`, `border-border-default`…). Never write a hex in a className.
> `tests/unit/tokenContrast.test.ts` measures every pair below; change a value and it tells you.

---

## Color Palette

### Grounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#ffffff` | Page |
| `--color-bg-surface` | `#f4f5f7` | Grey bands, tinted panels, pills |
| `--color-bg-elevated` | `#ffffff` | Cards sitting on a band |
| `--color-bg-inverted` | `#0b1220` | The business CTA band |
| `--color-bg-overlay` | `rgba(11, 18, 32, 0.5)` | Modal backdrop |

### Accent (coral)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#cc3714` | Solid buttons with white text (5.09:1), link text (4.67:1 on the band) |
| `--color-accent-hover` | `#a82c0f` | Hover — darker, never lighter |
| `--color-accent-graphic` | `#ff5a36` | **Non-text marks on white only**: the headline underline, range-bar fills, the wordmark dot, the rating star. 3.1:1 on white clears the 3:1 graphics floor; it fails on the band and fails as text everywhere |
| `--color-accent-muted` | `rgba(204, 55, 20, 0.08)` | Tint. Text on it is `text-accent-hover`, never `text-accent` (4.16:1 over the band; `tokenContrast.test.ts` scans for the pair) |

### Text

| Token | Hex | On white / on band |
|-------|-----|-------|
| `--color-text-primary` | `#0b1220` | 18.7:1 / 17.2:1 |
| `--color-text-secondary` | `#4b5563` | 7.6:1 / 6.9:1 |
| `--color-text-muted` | `#5f6979` | 5.6:1 / 5.1:1 (gray-500 fails on the band) |
| `--color-text-on-dark` / `-muted` | `#f9fafb` / `#a1a8b3` | on `bg-inverted` |

### Semantic (verified as text on their own 10% tint; success and error also carry white text)

`--color-savings` `#065f46` · `--color-error` `#991b1b` · `--color-warning` `#9a3412` ·
`--color-info` `#1e40af` · `--color-success` `#065f46`, each with a `-bg` at alpha 0.1.

### Borders and shadows

`--color-border-default` `#e5e7eb` hairlines, `--color-border-hover` `#d1d5db`. One soft card shadow
(`shadow-md`), no glows. Focus ring: solid `#c23310`, 2px, offset 2px, site-wide from `globals.css`.

---

## Typography

- **Inter Tight** (`font-display`, weights 500–700) for the wordmark, headlines, card titles and prices.
  Tight tracking: `tracking-tight` on h2, `tracking-[-0.03em]` on the hero.
- **Inter** (`font-sans`, the body) for everything else.
- Prices: `font-display font-bold tabular-nums`. Not monospace.

| Name | Classes |
|------|---------|
| hero | `text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95]` |
| h2 | `text-2xl sm:text-3xl font-bold tracking-tight` + a one-line `text-text-secondary` sub |
| card title | `text-base font-semibold` |
| price lead | `text-2xl font-bold tabular-nums` (row cards `text-lg sm:text-xl`) |
| eyebrow | `text-xs font-semibold uppercase tracking-wider text-text-muted` |

---

## Components

| Component | Spec |
|-----------|------|
| Primary button | `bg-accent text-white font-semibold rounded-full min-h-[44px] px-6 hover:bg-accent-hover` |
| Outline pill | `border border-text-primary text-text-primary rounded-full hover:bg-bg-surface` |
| Button on the dark band | `bg-bg-base text-text-primary rounded-full` |
| Card | `bg-bg-elevated border border-border-default rounded-xl hover:border-border-hover hover:shadow-md` — colour and shadow only, no translate |
| Deal row (B) | `OfferRow` (`src/components/features/offerRow.tsx`), used by every deal list. A 32px (36px from `sm`) `bg-bg-surface rounded-lg` square with the treatment icon; the headline is the offer's own words (`subtitle ?? title`, `font-display font-semibold`, 2-line clamp); under it in `text-xs text-text-secondary`: the product line (`productLine()`), a bordered "Members" tag, "Provider in {city}" only where the list spans cities, and the tier label. Price column on the right: bold lead (`text-lg sm:text-xl`), basis and `<s>` regular price in `text-text-muted`, Save pill, vs-typical (`text-savings` only when below). Below `sm` the price drops to its own line, indented past the icon. Rows sit flush in one `DealList` frame (`rounded-2xl`, a rule between rows); `DealCard` adds the heart and the stretched link. "Provider names are revealed when you claim a deal" is said once above a list (`ProviderNamesNote`), never per row. No rating (it named the clinic). Price block always via `dealPricing()` |
| Grouped view (C) | The city page's "All deals" (`src/components/features/deals/dealGroups.tsx`): one `DealList` per treatment in `TREATMENT_SLUGS` order. Header on `bg-bg-surface`: icon, h2, "N deals · typical $X per unit" and a `TypicalBar` for neurotoxins, "N deals · from $X" for the rest (the floor's brand named when it isn't Botox), "See all N" to the treatment page. The 4 cheapest rows. No-treatment offers last as "Other offers", expanding in place. A single treatment (`/deals/{treatment}/{city}`) is one flat `DealList` under one `TypicalBar`, or "Prices from $X" |
| Compact tile (A) | `OfferTile` (`offerCard.tsx`), homepage showcases only: icon square and heart, 2-line headline, the product line under it (wraps, never truncates), bold price, basis and Save pill, then the Members tag, tier label and city. 4 per row on desktop, 2 on phones |
| PriceRangeBar | `src/components/patterns/priceRangeBar.tsx`: 6px `bg-border-default` track, `bg-accent-graphic` fill from the left end to the median, optional 4px ink tick for one deal. Median label above, the deal's label below, min and max printed at the ends; one `role="img"` whose label reads every number. White ground only: the coral fill fails on the band. Group headers, the treatment page and the deal page's Price in context |
| Treatment icons | `TREATMENT_ICONS` in `src/components/patterns/treatmentIcons.ts` (the `/ssr` entry): Syringe neurotoxins, Drop fillers, Sparkle facials, Sun laser, Eyedropper skincare, Heartbeat wellness, PersonSimple body; Tag for a deal with no treatment. Keyed on every treatment, so a new one is a compile error. They replace photos on every deal surface (owner decision, 2026-09-28) |
| Tier labels | `TIER_ICONS` beside the `TIER_LABELS` text everywhere: Quotes As advertised, Calculator Our math, WarningCircle Confirm when booking. SealCheck (`CONFIRMED_ICON`) with "Confirmed by the clinic" in `text-success` replaces the tier. Rows and tiles label Our math and Confirm when booking only (`text-text-muted`, 12px bold icon); the deal page always shows the tier as a pill, `bg-warning-bg text-warning` for Confirm when booking. Labels, never a numeric score |
| Category pill | `bg-bg-surface text-text-secondary text-xs rounded-full px-2.5 py-1` |
| Savings chip | `bg-savings-bg text-savings` on white |
| Search pill | white, `rounded-full` from `sm`, `shadow-lg`, two native `<select>`s + the primary button — `heroSearch.tsx` |
| Header | `bg-bg-base/95 backdrop-blur-sm border-b border-border-default`, wordmark + coral dot, four links (Deals, Treatments, Guides, For providers; hidden below `md`), outline "Request a listing" to `/business/listing-request?type=add` (signed out, from `sm`). Below `md` a Menu button opens a full-screen native `<dialog>` with the same links — `globalHeader.tsx` |
| Range bar (homepage tiles) | `priceRangeStrip.tsx`: 6px track `bg-border-default`, fill `bg-accent-graphic` from min to median, 2px ink marker at the median; every number printed in text beside it |
| City bar chart | one series, bars from zero, `bg-accent-graphic` fill on a `bg-bg-surface` track, value in ink text on the right, each row a link; treatment tabs (`aria-pressed` pills: active `bg-text-primary text-white`) — `cityPriceChart.tsx` |
| Answer panel | the hero's right column: `rounded-2xl` white card, `shadow-lg`, `aria-live="polite"`; range + basis, median line, a dot strip (`bg-accent-graphic` dots at 75%, ink median marker), the cheapest rows, one link — `heroPriceCheck.tsx` |
| Docked search | the compact `HeroSearch` fixed at `top-16` once the hero's form scrolls off (IntersectionObserver on a sentinel); labels `sr-only`, icon-only button below `sm` |
| Strip plot | one dot per priced offer, r = 6 in a 1000-wide viewBox, stacks capped at 9 rows per side and spilling one pitch right; IQR band `fill-bg-surface`, ink median rule, hairline axis; every dot is a link with a full `aria-label`; hover/focus tooltip — `priceStripPlot.tsx` |
| Histogram card | four bins on a `bg-bg-surface` card, bars from zero, counts in ink — `discountHistogram.tsx` |
| Flow diagram | white cards with fixed heights, inline-SVG connectors (`stroke: var(--color-text-primary)`), one ink node, coral only on the result figure and the fact numerals (`text-accent`); stacks with `ArrowDown` below `lg` — `priceBasisDiagram.tsx` |
| Claim-flow cards | `AnonymousCard` = OfferRow + a grey lock footer "Provider name hidden until you claim"; `RevealedCard` = OfferRow + a `border-accent` box with a green "Claimed" chip and "Provider name, address, phone and website revealed". Never a fabricated provider name — `claimRevealCards.tsx` |

---

## Page rhythm (homepage)

white hero (search + answer panel) → grey range tiles → white strip plot → white city chart with
tabs (hairline top) → grey "How we make prices comparable" diagram → white "How it works" with
real card states → grey guides row → white discounts grid with the histogram card → ink business
band with a crop of the real business dashboard's deals list. Sections are `py-14 sm:py-20`; the container
is `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.

---

## Anti-patterns

- No hex in classNames and no raw Tailwind palette colours (`amber-*`, `red-*`, `emerald-*`…) — use
  the semantic tokens; `tokenContrast.test.ts` fails the build on either.
- No `text-<colour>/<alpha>` — opacity is not a text step (the contrast test fails the build).
- `--color-accent-graphic` never carries text and never sits on the grey band.
- No dark backgrounds except `bg-bg-inverted` for the one provider band.
- No photograph on any deal surface: no stock spa imagery, and no clinic photo (we hold none, and before a claim one would name the clinic). A treatment icon stands in.
- No hover transforms that shift layout; no glows; no glassmorphism.
- No literal counts or prices in copy — derive them.
