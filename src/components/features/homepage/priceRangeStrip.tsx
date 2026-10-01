import Link from 'next/link'
import { formatPrice } from '@/lib/data/adapters'
import type { TreatmentPriceRange } from '@/lib/data/homepage'
import { minBrandText } from '@/lib/data/typicalPrice'

interface PriceRangeStripProps {
  ranges: TreatmentPriceRange[]
}

/**
 * The treatment browser and the price picture in one section. Each tile is a link to the
 * treatment's browse page and shows the advertised range across every provider we list.
 *
 * The figures pool `comparablePrice()` through computeGuidePricingStats, so Botox is per unit
 * and everything else is what you pay — the same rule the guides and the deal ranking use
 * (CLAUDE.md, "price basis"). Nothing here is an average of raw prices.
 *
 * The bar is a range, not a distribution: the track runs min → max and the coral fill runs
 * min → median, so where the fill stops says whether the typical price sits low or high in
 * the range. Fill and marker are graphics; every number is printed beside them in text.
 */
export function PriceRangeStrip({ ranges }: PriceRangeStripProps) {
  if (ranges.length === 0) return null

  return (
    <section className="w-full bg-bg-surface py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              What treatments cost
            </h2>
            <p className="mt-1 text-text-secondary">
              Advertised ranges across every provider we list. Neurotoxins are
              per unit; everything else is the price you pay.
            </p>
          </div>
          {/* shrink-0: beside the intro at 712–834px it was squeezed to three lines (2026-09-28). */}
          <Link
            href="/treatments"
            className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            All treatments →
          </Link>
        </div>

        <PriceRangeTiles ranges={ranges} />
      </div>
    </section>
  )
}

/**
 * The tiles alone, for pages that frame them with their own heading. `linked={false}` on a
 * treatment's own page, where every tile would link back to itself.
 */
export function PriceRangeTiles({
  ranges,
  linked = true,
}: PriceRangeStripProps & { linked?: boolean }) {
  const tileClass =
    'block h-full rounded-xl border border-border-default bg-bg-elevated p-4 transition-all duration-200 sm:p-5'
  const last = ranges.length - 1
  return (
    // One column below 400px: at 320px two 137px columns broke a range over four lines
    // ("$5.50 / (Daxxify) – / $16.63 / per unit", 2026-09-28).
    <ul className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3">
      {ranges.map((r, i) => {
        return (
          <li
            key={r.treatment}
            className={i === last ? loneLastSpan(ranges.length) : undefined}
          >
            <TileFrame href={linked ? r.href : null} className={tileClass}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {r.label}
                </span>
                <span className="hidden text-xs text-text-muted tabular-nums sm:inline">
                  {r.pricedDealCount} priced deals
                </span>
              </div>
              {/* Two unbreakable halves, so a narrow tile breaks before the dash: no price split
                  and no dash ending a line. */}
              <p className="mt-2 font-display text-xl font-bold tabular-nums tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
                <span className="whitespace-nowrap">
                  {formatPrice(r.minPrice)}
                  {/* The low end of a pooled neurotoxin range is one brand's unit — say which. Not
                      "lowest is": Dysport sits outside the range and can be lower. */}
                  {r.minBrand && r.minBrand !== 'Botox' && (
                    <span className="text-sm font-normal text-text-muted">
                      {minBrandText(r.minBrand)}
                    </span>
                  )}
                </span>{' '}
                <span className="whitespace-nowrap">
                  <span className="text-text-muted">– </span>
                  {formatPrice(r.maxPrice)}
                </span>
              </p>
              <p className="text-sm text-text-muted">
                {r.perUnit ? 'per unit' : 'per treatment'}
              </p>

              <RangeBar
                min={r.minPrice}
                max={r.maxPrice}
                median={r.medianPrice}
                className="mt-4"
              />
              <p className="mt-2 text-xs text-text-secondary">
                Median{' '}
                <span className="font-semibold text-text-primary tabular-nums">
                  {formatPrice(r.medianPrice)}
                </span>{' '}
                <span className="whitespace-nowrap text-text-muted">
                  · {r.providerCount}{' '}
                  {r.providerCount === 1 ? 'provider' : 'providers'}
                </span>
              </p>
            </TileFrame>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The last tile's span when it would sit alone in its row, so it fills the row instead of
 * leaving a hole: Body contouring, 7th of 7, and a treatment page's single tile, which sat in
 * the left third at 1024px (2026-09-28). Literal class names, for Tailwind's scanner.
 */
function loneLastSpan(count: number): string {
  const twoUp = count % 2 === 1 ? 'min-[400px]:col-span-2' : ''
  const threeUp =
    count % 3 === 1 ? 'lg:col-span-3' : twoUp ? 'lg:col-span-1' : ''
  return `${twoUp} ${threeUp}`.trim()
}

function TileFrame({
  href,
  className,
  children,
}: {
  href: string | null
  className: string
  children: React.ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link
      href={href}
      className={`group ${className} hover:border-border-hover hover:shadow-md`}
    >
      {children}
    </Link>
  )
}

/**
 * MASTER.md's range bar: a hairline track from min to max, the coral fill from min to the
 * median, an ink marker at the median. Decorative — the caller prints every number in text.
 */
export function RangeBar({
  min,
  max,
  median,
  className = '',
}: {
  min: number
  max: number
  median: number
  className?: string
}) {
  const span = max - min
  const medianAt = span > 0 ? ((median - min) / span) * 100 : 100
  return (
    <div
      className={`relative h-1.5 w-full rounded-full bg-border-default ${className}`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent-graphic"
        style={{ width: `${medianAt}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-text-primary"
        style={{ left: `calc(${medianAt}% - 1px)` }}
      />
    </div>
  )
}
