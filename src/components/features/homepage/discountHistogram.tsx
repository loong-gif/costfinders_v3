import type { DiscountHistogram } from '@/lib/data/homepage'

/**
 * A compact histogram of advertised discount sizes, meant to sit beside "Biggest advertised
 * discounts" — context for a grid that leads with the biggest: most stated discounts cluster
 * well below the headline numbers those cards show.
 */
export function DiscountHistogramCard({
  histogram,
}: {
  histogram: DiscountHistogram
}) {
  if (histogram.stated === 0) return null

  const { bins, stated, total } = histogram
  const maxCount = Math.max(...bins.map((b) => b.count), 0)
  const largestBin = bins.reduce((a, b) => (b.count > a.count ? b : a))
  const fiftyPlus = bins.find((b) => b.label === '50% or more')?.count ?? 0

  return (
    <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        What discounts look like
      </h3>

      <div
        role="img"
        className="mt-3 space-y-2"
        aria-label={`Discount sizes: ${bins
          .map((b) => `${b.label}, ${b.count.toLocaleString('en-US')} deals`)
          .join('; ')}`}
      >
        {bins.map((bin) => (
          <div
            key={bin.label}
            className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm"
          >
            <span className="text-text-secondary">{bin.label}</span>
            <span
              className="relative block h-2.5 w-full overflow-hidden rounded-r-[4px] bg-bg-elevated"
              aria-hidden="true"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent-graphic"
                style={{
                  width: `${maxCount > 0 ? (bin.count / maxCount) * 100 : 0}%`,
                }}
              />
            </span>
            <span className="text-right font-display font-semibold tabular-nums text-text-primary">
              {bin.count.toLocaleString('en-US')}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-text-secondary">
        {stated.toLocaleString('en-US')} of {total.toLocaleString('en-US')}{' '}
        deals state a discount. Most are {largestBin.label};{' '}
        {fiftyPlus.toLocaleString('en-US')} claim 50% or more.
      </p>
    </div>
  )
}
