import { type ComparablePrice, comparablePrice } from '@/lib/data/adapters'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'

export interface DealFilters {
  category?: TreatmentCategory
  city?: string
  minPrice?: number
  maxPrice?: number
  minDiscount?: number
}

export type SortOption = 'price-asc' | 'price-desc' | 'discount' | 'newest'

// Keyed on every treatment, so a new one is a compile error here rather than a group on the city
// page that silently drops its deals. Key order is the order the groups and chips read in.
const TREATMENT_ORDER: Record<TreatmentCategory, true> = {
  botox: true,
  fillers: true,
  facials: true,
  laser: true,
  skincare: true,
  wellness: true,
  body: true,
}

/** Ordered as the groups, chips and tiles should read, not alphabetically. */
export const TREATMENT_SLUGS = Object.keys(
  TREATMENT_ORDER,
) as TreatmentCategory[]

/**
 * The city page's "All deals" groups: one per treatment in TREATMENT_SLUGS order, then the deals
 * that name none (a clinic-wide discount, an uncategorised offer). Each group keeps the input
 * order, so a sort applied before grouping applies inside every group. Empty groups are dropped.
 */
export function groupByTreatment(
  deals: AnonymousDeal[],
): { treatment: TreatmentCategory | null; deals: AnonymousDeal[] }[] {
  return [...TREATMENT_SLUGS, null]
    .map((treatment) => ({
      treatment,
      deals: deals.filter((deal) => (deal.category ?? null) === treatment),
    }))
    .filter((group) => group.deals.length > 0)
}

/** The group a price sorts in: 0 = what you pay, 1 = per unit (neurotoxins), 2 = none. */
function priceScale(price: ComparablePrice | null): number {
  if (!price) return 2
  return price.perUnit ? 1 : 0
}

/**
 * Price order by `comparablePrice()`, never raw `dealPrice`. Raw, "$10 per unit" Botox sorted
 * above "40 units for $299" — cheaper per unit ($7.48) — and every unpriced "20% off" row
 * (dealPrice 0) led a low-to-high sort as the cheapest deal on the page.
 *
 * Deals are ordered in three groups, in the same order in BOTH directions, each group sorted
 * by price in the requested direction and otherwise stable (Array.prototype.sort is stable):
 *   1. what you pay (`perUnit: false`),
 *   2. per unit (`perUnit: true`, neurotoxins),
 *   3. no comparable price — it has no place on a price scale, so it must not top one. A
 *      `check`-tier deal ("Confirm when booking") is always here: comparablePrice() is null
 *      for it, so it sorts after every comparable deal in both directions.
 * A per-unit figure and a total are different scales: on the mixed /deals/<city> page, one
 * ordering ranked "$299 for 40 units" as $7.48, below a $35 facial. A single-treatment page
 * only ever fills one of the first two groups, so there this is a plain price sort.
 */
function byComparablePrice(direction: 1 | -1) {
  return (a: AnonymousDeal, b: AnonymousDeal) => {
    const priceA = comparablePrice(a)
    const priceB = comparablePrice(b)
    if (!priceA || !priceB || priceA.perUnit !== priceB.perUnit) {
      return priceScale(priceA) - priceScale(priceB)
    }
    return (priceA.amount - priceB.amount) * direction
  }
}

/**
 * The price-range filter, on the same `comparablePrice()` the sort uses — so a Botox bound is a
 * bound per unit. While either bound is set, a deal with no comparable price is excluded: raw,
 * "Max $50" kept every unpriced row, because their dealPrice is 0.
 */
export function withinPriceRange(
  deal: AnonymousDeal,
  minPrice: number | undefined,
  maxPrice: number | undefined,
): boolean {
  if (minPrice === undefined && maxPrice === undefined) return true
  const price = comparablePrice(deal)?.amount
  if (price === undefined) return false
  return (
    (minPrice === undefined || price >= minPrice) &&
    (maxPrice === undefined || price <= maxPrice)
  )
}

export function sortDeals(
  dealsToSort: AnonymousDeal[],
  sortBy: SortOption,
): AnonymousDeal[] {
  const sorted = [...dealsToSort]

  switch (sortBy) {
    case 'price-asc':
      return sorted.sort(byComparablePrice(1))
    case 'price-desc':
      return sorted.sort(byComparablePrice(-1))
    case 'discount':
      return sorted.sort((a, b) => b.discountPercent - a.discountPercent)
    case 'newest':
      // updatedAt, not createdAt: the pipeline re-lists a clinic's current specials by
      // updating rows, so the scrape date of a row says little about when the deal went up.
      return sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    default:
      return sorted
  }
}
