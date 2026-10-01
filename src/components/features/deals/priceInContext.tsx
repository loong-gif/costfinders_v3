import Link from 'next/link'
import { PriceRangeBar } from '@/components/patterns/priceRangeBar'
import {
  comparablePrice,
  formatPrice,
  getTreatmentLabel,
} from '@/lib/data/adapters'
import {
  type TypicalPrice,
  typicalExclusion,
  vsTypical,
  vsTypicalLabel,
} from '@/lib/data/typicalPrice'
import type { AnonymousDeal, ComparablePrice } from '@/types/deal'

/** Why a deal with a typical price beside it has no mark of its own. */
function unmarkedBecause(
  deal: AnonymousDeal,
  typical: TypicalPrice,
  comparable: ComparablePrice | null,
): string {
  if (deal.interpretation.tier === 'check') {
    return "We don't rank a deal marked Confirm when booking"
  }
  if (!(deal.dealPrice > 0)) return 'This deal states no price to compare'
  // Before the per-unit line below: both deals state a per-unit price, so "we don't have one"
  // would be false (typicalExclusion() says why they are left out).
  const excluded = comparable && typicalExclusion(comparable)
  if (excluded === 'from-price') {
    return "This is the clinic's starting price, not what you pay"
  }
  if (excluded === 'unlike-unit') {
    const brand = comparable?.brand
    return `We don't compare ${brand}'s per-unit price with the others: a ${brand} unit is smaller than a Botox unit`
  }
  // A $79 lip flip, Botox per area, or a total we read with no unit count to divide by (8381
  // "70 units at $11 per unit - $770" is stored as a flat $770). "We don't have", not "it has
  // no": the clinic's own words, quoted below, may state one.
  if (typical.perUnit) {
    return "We don't have a per-unit price for this deal to compare"
  }
  // Left: a rate per `unit` or per nothing named (comparablePrice()) — nobody buys one unit of
  // filler, so it can't stand beside what the others cost.
  return 'This deal is priced as a rate, not as what you pay'
}

/**
 * This deal against its treatment's prices in its own city (spec §3.1). The page renders it only
 * when a TypicalPrice exists: a neurotoxin deal (TYPICAL_TREATMENTS in typicalPrice.ts says why
 * no other treatment has one) in a city with at least 5 comparable priced deals from 3 clinics.
 * Every other deal page has no block at all, rather than one that explains its absence.
 *
 * The deal is marked only when its comparable price is on the typical price's basis — per unit
 * for neurotoxins. A `check`-tier deal has no comparable price
 * (comparablePrice() reads the tier), so it is never marked and never called cheap.
 *
 * Every figure goes through formatPrice(), the formatter the price block beside it uses, so the
 * marker can never read differently from the price the deal prints.
 */
export function PriceInContext({
  deal,
  typical,
}: {
  deal: AnonymousDeal
  typical: TypicalPrice
}) {
  const comparable = comparablePrice(deal)
  const vs = vsTypical(comparable, typical)
  const per = typical.perUnit ? ' per unit' : ''
  const treatment = getTreatmentLabel(typical.treatment)
  const city = deal.locationArea
  // The floor's brand where it isn't Botox: the bar pools every brand but Dysport, and a Xeomin
  // floor printed bare reads as a Botox price.
  const min = `${formatPrice(typical.min)}${
    typical.minBrand && typical.minBrand !== 'Botox'
      ? ` (${typical.minBrand})`
      : ''
  }`
  const max = formatPrice(typical.max)
  const median = formatPrice(typical.median)
  const mine = vs && comparable ? formatPrice(comparable.amount) : null

  return (
    <section aria-labelledby="price-in-context-heading" className="space-y-3">
      <h2
        id="price-in-context-heading"
        className="font-display text-xl font-bold tracking-tight text-text-primary"
      >
        Price in context
      </h2>
      <p className="text-sm text-text-secondary">
        {treatment} in {city}: {typical.pricedDealCount} deals from{' '}
        {typical.providerCount} clinics,{' '}
        {typical.perUnit ? 'compared per unit' : 'compared on what you pay'}.{' '}
        <Link
          href="/how-it-works#typical-prices"
          className="font-medium text-accent hover:text-accent-hover"
        >
          How typical is worked out
        </Link>
      </p>

      {/* White, not the grey band: the bar's coral fill is 3.1:1 on white only (MASTER.md). */}
      <div className="space-y-4 rounded-2xl border border-border-default bg-bg-elevated p-5 sm:p-6">
        {vs && mine ? (
          <p>
            <span
              className={`block font-display text-2xl font-bold tracking-tight ${
                vs.direction === 'below' ? 'text-savings' : 'text-text-primary'
              }`}
            >
              {vsTypicalLabel(vs)}
            </span>
            <span className="mt-1 block text-sm text-text-secondary">
              This deal is {mine}
              {per}; the typical price is {median}
              {per}.
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            {unmarkedBecause(deal, typical, comparable)}, so it isn&apos;t
            marked on the range.
          </p>
        )}
        <PriceRangeBar
          min={typical.min}
          max={typical.max}
          median={typical.median}
          marker={vs ? comparable?.amount : null}
          minLabel={min}
          maxLabel={max}
          medianLabel={`Typical ${median}${per}`}
          markerLabel={mine ? `This deal ${mine}${per}` : undefined}
          label={`${treatment} in ${city}${per}: ${min} to ${max}, typical ${median}${
            mine ? `, this deal ${mine}` : ''
          }.`}
        />
      </div>
    </section>
  )
}
