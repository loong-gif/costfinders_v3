'use client'

import { useMemo, useState } from 'react'
import { formatPrice } from '@/lib/data/adapters'
import type { PriceDistribution, PriceDot } from '@/lib/data/homepage'

interface PriceStripPlotProps {
  distributions: PriceDistribution[]
}

/** Dot radius, in viewBox units. Fixed: a dot that shrinks stops reading as a dot. */
const R = 6
/**
 * Rows per side of the baseline before a column spills sideways. Prices cluster on round
 * numbers — 213 Botox offers hold only 45 distinct per-unit rates, 35 of them the same one —
 * so an unbounded stack came out 616 units tall against 1000 wide, and shrinking the dots
 * to fit turned the chart into a barcode.
 */
const MAX_ROWS = 9
/**
 * How far a dot may be pushed to the RIGHT of its true x to find a free row, in row pitches.
 * Three pitches is 39 viewBox units: 4% of the axis, which is the bound in every treatment
 * because the axis is what a reader measures against — under a dollar on Botox, ~$165 on
 * Fillers, where the axis itself spans $3,885. Today no treatment spills at all (Botox tops
 * out exactly at MAX_ROWS); the bound matters only if a wide-range treatment ever grows a
 * column deeper than 2 × MAX_ROWS + 1. Right only: dots arrive in price order, so a rightward
 * nudge keeps each row's rightmost-dot bookkeeping exact.
 */
const MAX_SPILL = 3
/** The plot's x extent inside the viewBox; the margin is the end labels' overhang. */
const X_MIN = 40
const X_MAX = 960
const VIEW_W = 1000
const MIN_HEIGHT = 160
/** Room above and below the outermost row for the axis hairline and the band's label. */
const V_PADDING = 56

interface PlacedDot extends PriceDot {
  /** viewBox units. */
  x: number
  y: number
}

interface Plot {
  height: number
  dots: PlacedDot[]
  scale: (price: number) => number
}

/**
 * One unit of air between touching dots. Used BOTH as the row pitch and as the minimum
 * distance between two centres: rows any further apart and a stacked column reads as a dotted
 * line rather than a column, which is most of what this chart draws.
 */
const GAP = 2 * R + 1

/** The row for the k-th try: 0, +1, −1, +2, −2 … */
const rowFor = (k: number) =>
  k === 0 ? 0 : k % 2 === 1 ? (k + 1) / 2 : -(k / 2)

/**
 * A beeswarm at one dot radius: every dot at (or within MAX_SPILL pitches right of) its
 * price on the x axis, nudged off the baseline only as far as it takes to stop it covering
 * its neighbour. Where the data piles up, so do the dots — the vertical thickness IS the
 * density, which is why this is not a bar chart. A column deeper than MAX_ROWS per side
 * continues in the next column to the right; only if every spill column is full too does a
 * dot go beyond MAX_ROWS, so nothing is ever dropped.
 */
function buildPlot(dist: PriceDistribution): Plot {
  const { min, max } = dist
  const scale = (price: number) =>
    max === min
      ? VIEW_W / 2
      : X_MIN + ((price - min) / (max - min)) * (X_MAX - X_MIN)

  const sorted = [...dist.dots].sort((a, b) => a.price - b.price)

  // The rightmost dot already placed in each row. Rows sit GAP apart, so two dots in different
  // rows are already GAP apart vertically and only the nearest dot in the SAME row can clash;
  // and a candidate left of a row's watermark is refused outright, so the watermark only ever
  // moves right and stays exact even though spilling breaks the strict left-to-right order.
  // ponytail: O(n) with this map rather than the all-pairs O(n²) scan the placement rule
  // implies. Allow a LEFTWARD spill and this has to become the full per-row list, because a
  // dot placed left of the watermark would be invisible to every dot after it.
  const rightmost = new Map<number, number>()
  let widest = 0
  const free = (row: number, x: number) => {
    const prev = rightmost.get(row)
    return prev === undefined || x - prev >= GAP
  }

  const rows = sorted.map((dot) => {
    const base = scale(dot.price)
    let placed: { x: number; row: number } | null = null
    // Nearest rows first at the true x, then the same rows one pitch to the right, and so on.
    for (let spill = 0; spill <= MAX_SPILL && !placed; spill++) {
      const x = base + spill * GAP
      for (let k = 0; k <= MAX_ROWS * 2; k++) {
        const row = rowFor(k)
        if (free(row, x)) {
          placed = { x, row }
          break
        }
      }
    }
    // Every bounded spot is taken: go deeper at the true x rather than lose the dot.
    for (let k = MAX_ROWS * 2 + 1; !placed; k++) {
      const row = rowFor(k)
      if (free(row, base)) placed = { x: base, row }
    }
    rightmost.set(placed.row, placed.x)
    widest = Math.max(widest, Math.abs(placed.row))
    return { dot, ...placed }
  })

  const height = Math.max(MIN_HEIGHT, widest * 2 * GAP + V_PADDING)
  return {
    height,
    scale,
    dots: rows.map(({ dot, x, row }) => ({
      ...dot,
      x,
      y: height / 2 + row * GAP,
    })),
  }
}

/** The 1 / 2 / 5 × 10ⁿ step nearest `raw` from below — the classic round-number ladder. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  return (normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1) * magnitude
}

/**
 * Both real endpoints — they are the numbers the copy underneath quotes — and up to four round
 * numbers between them.
 *
 * The interior labels are multiples of one step rather than the quarter points rounded
 * individually, which is what put $1,000 / $1,500 / $2,500 under the laser range: each one
 * round, the three of them unevenly spaced and reading as a mistake. Any that would print on
 * top of an endpoint is dropped instead.
 */
function axisTicks(min: number, max: number): number[] {
  if (max <= min) return [min]
  const span = max - min
  let step = niceStep(span / 4)
  const multiples = () => {
    const out: number[] = []
    for (let v = Math.ceil(min / step) * step; v < max; v += step) {
      if (v > min) out.push(v)
    }
    return out
  }
  let inner = multiples()
  while (inner.length > 4) {
    step *= 2
    inner = multiples()
  }
  return [
    min,
    ...inner.filter((v) => v - min > span * 0.08 && max - v > span * 0.08),
    max,
  ]
}

/** Keep a label positioned by percent from hanging off either end of the plot. */
function anchor(percent: number): string {
  if (percent < 8) return 'translateX(0)'
  if (percent > 92) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

/**
 * Every advertised price we hold for one treatment, one dot each.
 *
 * The range tiles say $3–$24.75; this says how many offers sit where inside it, which is the
 * question "is $12 a good price?" actually needs. The figures are the same pooled
 * `comparablePrice()` numbers as everywhere else (Botox per unit, everything else what you
 * pay), so the min/median/max printed underneath match the tiles by construction.
 *
 * Every dot is a link to its deal, so the chart is navigable rather than decorative, and the
 * grey band and the median rule are the only two summaries drawn — everything else a reader
 * needs is printed as text.
 */
export function PriceStripPlot({ distributions }: PriceStripPlotProps) {
  const [treatment, setTreatment] = useState(distributions[0]?.treatment)
  const [hovered, setHovered] = useState<PlacedDot | null>(null)

  const dist =
    distributions.find((d) => d.treatment === treatment) ?? distributions[0]
  const plot = useMemo(() => (dist ? buildPlot(dist) : null), [dist])

  if (!(dist && plot)) return null

  const ticks = axisTicks(dist.min, dist.max)
  const bandX = plot.scale(dist.p25)
  const bandWidth = plot.scale(dist.p75) - bandX
  const medianX = plot.scale(dist.median)
  const medianPercent = (medianX / VIEW_W) * 100
  const unit = dist.perUnit ? ' per unit' : ''
  const summary = `${dist.dealCount} ${dist.label} prices from ${formatPrice(dist.min)} to ${formatPrice(dist.max)}, median ${formatPrice(dist.median)}`

  return (
    <section className="w-full bg-bg-base py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Side by side only from xl: the seven treatment buttons need ~690px unshrunk, and beside
            the heading from sm up they pushed the page to 890px wide on a 768px iPad (Playwright,
            2026-09-28), which also zoomed a 712px Android tablet out to fit. */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Every price we list for {dist.label}
            </h2>
            <p className="mt-1 text-text-secondary">
              {dist.dealCount} advertised {dist.perUnit ? 'per-unit ' : ''}
              prices from {dist.providerCount} providers. Each dot is one offer.
            </p>
          </div>

          {/* <fieldset>, not a <div role="group">: same role, and Biome's useSemanticElements
              rejects the ARIA spelling. Preflight already strips its border and padding. */}
          <fieldset
            aria-label="Treatment"
            className="flex flex-wrap gap-2 xl:shrink-0"
          >
            {distributions.map((d) => {
              const isActive = d.treatment === dist.treatment
              return (
                <button
                  key={d.treatment}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setTreatment(d.treatment)
                    setHovered(null)
                  }}
                  className={`min-h-[44px] cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-text-primary text-white'
                      : 'border border-border-default text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </fieldset>
        </div>

        <p className="sr-only">{summary}</p>

        <div className="relative mt-8">
          {/* HTML, not an SVG <text>: the label has to stay Inter at 12px whatever width the
              plot scales to. Positioned by percent, which is exact — the viewBox maps 1:1 onto
              the rendered box because the svg is full-width with height auto. */}
          <div className="relative h-5">
            <span
              className="absolute whitespace-nowrap text-xs font-semibold text-text-primary"
              style={{
                left: `${medianPercent}%`,
                transform: anchor(medianPercent),
              }}
            >
              median {formatPrice(dist.median)}
            </span>
          </div>

          <div className="relative">
            {/* No preserveAspectRatio="none": non-uniform scaling turns every dot into an
                ellipse. The layout is computed in viewBox units and scales uniformly instead.
                No role="img" either — that makes descendants presentational, and the dots are
                links carrying the data. The sr-only summary above is what names the whole. */}
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: the rule's other fix is role="img", which is the one thing this svg must not have */}
            <svg
              viewBox={`0 0 ${VIEW_W} ${plot.height}`}
              className="h-auto w-full"
              aria-label={summary}
            >
              <rect
                x={bandX}
                y={0}
                width={bandWidth}
                height={plot.height}
                className="fill-bg-surface"
              />
              <text
                x={bandX + 8}
                y={plot.height - 6}
                fontSize={11}
                className="fill-current text-text-muted max-sm:hidden"
              >
                middle half of prices
              </text>
              {/* Stops short of the axis: the median sits inside the band on every treatment
                  in the corpus, so a full-height rule strikes straight through the band's
                  own label. The 20 units it gives up are below the lowest dot either way. */}
              <line
                x1={medianX}
                x2={medianX}
                y1={0}
                y2={plot.height - 20}
                stroke="var(--color-text-primary)"
                strokeWidth={2}
              />

              {plot.dots.map((dot) => {
                const isHovered = hovered?.id === dot.id
                return (
                  // Display-only under a coarse pointer: a dot is ~4px on a phone and the dots
                  // cluster, so a tap landed on whichever neighbour was on top. Mouse and
                  // keyboard keep the links; on touch the chart is a picture, and the hero and
                  // treatment tiles lead to the same deals.
                  <a
                    key={dot.id}
                    href={`/deals/${dot.id}`}
                    className="[@media(pointer:coarse)]:pointer-events-none"
                    aria-label={`${formatPrice(dot.price)}${unit}, provider in ${dot.cityLabel ?? 'an unlisted city'}`}
                    onMouseEnter={() => setHovered(dot)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(dot)}
                    onBlur={() => setHovered(null)}
                  >
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      r={R}
                      fill="var(--color-accent-graphic)"
                      fillOpacity={0.75}
                      stroke={isHovered ? 'var(--color-bg-base)' : undefined}
                      strokeWidth={isHovered ? 2 : undefined}
                    />
                  </a>
                )
              })}

              <line
                x1={X_MIN}
                x2={X_MAX}
                y1={plot.height - 0.5}
                y2={plot.height - 0.5}
                stroke="var(--color-border-default)"
              />
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute z-10 mt-2 whitespace-nowrap rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm shadow-md"
                style={{
                  left: `${(hovered.x / VIEW_W) * 100}%`,
                  top: `${(hovered.y / plot.height) * 100}%`,
                  transform:
                    (hovered.x / VIEW_W) * 100 > 60
                      ? 'translateX(-100%)'
                      : undefined,
                }}
              >
                <p className="font-display font-semibold text-text-primary">
                  {formatPrice(hovered.price)}
                  {unit}
                </p>
                <p className="text-text-secondary">
                  {hovered.cityLabel
                    ? `Provider in ${hovered.cityLabel}`
                    : 'Local provider'}
                </p>
              </div>
            )}
          </div>

          <div className="relative mt-2 h-4">
            {ticks.map((tick, i) => {
              const percent = (plot.scale(tick) / VIEW_W) * 100
              // At phone width the plot is ~340px, so two labels less than a tenth of it
              // apart print as one word ("$3$5"). The endpoints stay — they are the numbers
              // the copy quotes — and a crowded interior label drops on small screens only.
              const crowded =
                i > 0 &&
                i < ticks.length - 1 &&
                percent - (plot.scale(ticks[i - 1]) / VIEW_W) * 100 < 12
              return (
                <span
                  key={tick}
                  className={`absolute text-xs text-text-muted tabular-nums${crowded ? ' max-sm:hidden' : ''}`}
                  style={{
                    left: `${percent}%`,
                    transform:
                      i === 0
                        ? undefined
                        : i === ticks.length - 1
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                  }}
                >
                  {formatPrice(tick)}
                </span>
              )
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 text-center text-sm text-text-secondary sm:grid-cols-3">
          <p>
            Lowest {formatPrice(dist.min)}
            {unit}
          </p>
          <p className="font-semibold text-text-primary">
            Median {formatPrice(dist.median)}
          </p>
          <p>Highest {formatPrice(dist.max)}</p>
        </div>
      </div>
    </section>
  )
}
