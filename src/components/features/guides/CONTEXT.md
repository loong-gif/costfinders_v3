# Guide Components

The section blocks of a `/guides/{treatment}-cost-{city}` page, rendered in this order by
`src/app/guides/[slug]/page.tsx`. Every one is a Server Component; none fetches its own data.

| Component | Renders | Skips itself when |
|-----------|---------|-------------------|
| `pricingStatsHero` | H1, deck, the four live stat cards, both dates. "Starting at" is the floor (`floorPrice`/`floorBrand`, the deals page's "from"); the range line and "Typical price" are pooled (`minPrice`…`medianPrice`) — see `src/lib/data/typicalPrice.ts` | never (stats block hides with no deals) |
| `pricingModelExplainer` | H2 `How much do/does X cost in Y?` + the charging-structure cards | never |
| `cityPricingTable` | `Average X cost in Y` — medians by product and by unit | no `byService` **and** no `byUnitType` |
| `cityFactors` | `What affects X cost in Y` | never |
| `cityMarketContext` | `The Y market at a glance` | every context field empty |
| `savingsTips` | `How to save on X in Y` + up to 3 live deals | — |
| `nationalComparison` | `Y vs national average` bar pair | no local/national pair set |
| `guideFaq` | `X cost in Y: frequently asked questions` (`<details>`) | no FAQs |
| `guideMethodology` | `How we compiled these costs` | never |
| `guideCta` | Deals CTA + `Related cost guides` | — |

## Why the data arrives split

Two sources, deliberately. Researched prose comes from
`src/content/guides/*.json` and is stamped `generatedAt`; prices come from Supabase and are
re-read every ISR pass. That is why `pricingStatsHero` prints **two** dates: stamping live
figures with the authoring date read as "Last updated March 2026" beside prices pulled that
morning.

A guide with **zero live deals still renders.** The researched analysis stays true when a
provider's promotions lapse, and hard-404ing an indexed URL over a transient feed gap throws
away the ranking it earned. Stats-driven blocks skip themselves instead.

## Copy rules

**Every ranking surface says "cost", never "pricing"** — H1, every H2, FAQ questions. The full
rule, including the cases where "price"/"pricing" is still correct, is
`docs/MESSAGING-STYLE-GUIDE.md` §3.5. Read it before editing a heading.

**Verb agreement is not optional.** Treatment labels are singular *and* plural ("Botox",
"Dermal Fillers"), so any templated sentence must use `treatmentDo()` / `treatmentCost()` from
`src/lib/utils/treatment-grammar.ts`. Hardcoding "does" ships "How much does dermal fillers
cost" on 9 of 31 pages.

## Gotchas

- `pricingModelExplainer` picks a card icon by matching a **token** in the model name
  (`unit`, `syringe`, `vial`, `area`, `session`, `flat`, `package`, `membership`…), first match
  wins. Renaming a `pricingModels[].name` out of those tokens silently falls back to the
  generic dollar sign — check `modelIcons` before renaming one.
- `cityPricingTable` shows **medians**, never means: package totals sit in the same column as
  single-treatment prices and wreck an average.
- `nationalComparison` plots two *researched* figures. It used to plot the national figure
  against a per-unit average derived from live offers, which mixed true per-unit rates ($8/unit)
  with package totals filed under the same unit ($139 for 20 units) — and printed "1053% above
  the national average" directly under prose reading "roughly 47% below".
- These components take `treatmentLabel`/`cityLabel` as props and never import from
  `features/` — they sit at Layer 3 and may only reach down into `ui/` and `patterns/`.
