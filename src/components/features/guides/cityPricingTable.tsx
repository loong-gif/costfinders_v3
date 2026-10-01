import { formatPrice } from '@/lib/data/adapters'
import type { GuidePricingStats } from '@/types/guide'

interface CityPricingTableProps {
  treatmentLabel: string
  cityLabel: string
  stats: GuidePricingStats
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

/**
 * A product row on a guide that is not per unit: whole dollars on a package, cents below $10.
 * Per-unit figures go through formatPrice, which keeps cents at any size ($10.50/unit, not $11).
 */
function price(value: number): string {
  return value < 10 ? usdPrecise.format(value) : usd.format(value)
}

export function CityPricingTable({
  treatmentLabel,
  cityLabel,
  stats,
}: CityPricingTableProps) {
  const { byService, byUnitType } = stats
  const servicePrice = stats.perUnit ? formatPrice : price
  if (byService.length === 0 && byUnitType.length === 0) return null

  return (
    <section aria-labelledby="pricing-table-heading" className="mb-10">
      <h2
        className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3"
        id="pricing-table-heading"
      >
        Average {treatmentLabel} cost in {cityLabel}
      </h2>
      {/* pricedDealCount, NOT dealCount. The product figures are computed only over deals with a
          comparable price (comparablePrice() in src/lib/data/adapters.ts — per unit on a
          neurotoxin guide), while dealCount counts every visible offer, including a "20% off" with
          no base price and, on a per-unit guide, a flat price with no unit count to divide by.
          Attributing a median to dealCount overstates the sample behind a cost claim, so the
          sentence names the number the arithmetic actually used. */}
      <p className="text-text-secondary mb-6">
        Live costs from {stats.providerCount} local provider
        {stats.providerCount === 1 ? '' : 's'}, based on the{' '}
        {stats.pricedDealCount} {stats.pricedDealCount === 1 ? 'deal' : 'deals'}{' '}
        in {cityLabel}{' '}
        {stats.perUnit
          ? 'whose price works out per unit'
          : 'that publish a price'}
        {stats.dealCount > stats.pricedDealCount
          ? ` (of ${stats.dealCount} advertised here)`
          : ''}
        .{' '}
        {stats.perUnit
          ? 'Each heading names the unit its prices are per, with a package counted at what one of its units works out to. Midpoints are medians.'
          : 'Midpoints are medians, so a single package price cannot skew them.'}
      </p>

      {byService.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            {stats.perUnit ? 'By product, per unit' : 'By product'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {treatmentLabel} cost in {cityLabel} by product, showing the
                number of advertised deals and the low, midpoint and high cost
                {stats.perUnit ? ' per unit' : ''} for each.
              </caption>
              <thead>
                <tr className="border-b border-border-default">
                  <th
                    className="text-left py-3 pr-4 text-text-muted font-medium"
                    scope="col"
                  >
                    Product
                  </th>
                  <th
                    className="text-right py-3 px-4 text-text-muted font-medium"
                    scope="col"
                  >
                    Deals
                  </th>
                  <th
                    className="text-right py-3 px-4 text-text-muted font-medium"
                    scope="col"
                  >
                    Low
                  </th>
                  <th
                    className="text-right py-3 px-4 text-text-muted font-medium"
                    scope="col"
                  >
                    Midpoint
                  </th>
                  <th
                    className="text-right py-3 pl-4 text-text-muted font-medium"
                    scope="col"
                  >
                    High
                  </th>
                </tr>
              </thead>
              <tbody>
                {byService.map((row) => (
                  <tr key={row.name} className="border-b border-border-default">
                    <th
                      className="py-3 pr-4 text-left text-text-primary font-medium"
                      scope="row"
                    >
                      {row.name}
                    </th>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      {row.count}
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      {servicePrice(row.minPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-display font-semibold tabular-nums text-text-primary">
                      {servicePrice(row.medianPrice)}
                    </td>
                    <td className="py-3 pl-4 text-right text-text-secondary">
                      {servicePrice(row.maxPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {byUnitType.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Cost by unit
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byUnitType.map((row) => (
              <div
                className="bg-bg-elevated border border-border-default rounded-xl p-4"
                key={row.unitType}
              >
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                  Per {row.unitType}
                </p>
                <p className="font-display text-xl font-bold tabular-nums text-text-primary">
                  {formatPrice(row.medianPrice)}
                </p>
                <p className="text-xs text-text-muted">
                  {formatPrice(row.minPrice)}–{formatPrice(row.maxPrice)} across{' '}
                  {row.count} {row.count === 1 ? 'deal' : 'deals'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
