'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { OfferRow } from '@/components/features/offerRow'
import { formatPrice } from '@/lib/data/adapters'
import type { PairStat } from '@/lib/data/homepage'
import {
  floorBrandText,
  minBrandText,
  priceText,
  TYPICAL_TREATMENTS,
} from '@/lib/data/typicalPrice'
import { HeroSearch, type SearchOption, type SearchValue } from './heroSearch'

interface HeroPriceCheckProps {
  /** The server-rendered headline and sub line, placed above the search. */
  children: React.ReactNode
  treatments: SearchOption[]
  cities: SearchOption[]
  pairs: string[]
  pairStats: PairStat[]
  defaultValue: SearchValue
  counts: { deals: number; providers: number; cities: number }
}

const formatCount = (n: number) => n.toLocaleString('en-US')

/**
 * The hero's two columns and the bar that docks under the header, sharing one search value:
 * change a select and the right column answers before you click. The stats are precomputed
 * per (treatment, city) pair on the server (`pairStats` in src/lib/data/homepage.ts) and
 * inlined, so the panel updates with no request at all.
 */
export function HeroPriceCheck({
  children,
  treatments,
  cities,
  pairs,
  pairStats,
  defaultValue,
  counts,
}: HeroPriceCheckProps) {
  const [value, setValue] = useState<SearchValue>(defaultValue)
  const [docked, setDocked] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  // Dock a compact copy of the search under the header once the real one has scrolled off.
  // IntersectionObserver rather than a scroll listener: it fires only on the crossing.
  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) =>
        setDocked(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const treatmentLabel =
    treatments.find((t) => t.slug === value.treatment)?.label ?? value.treatment
  const pair = pairStats.find(
    (p) => p.treatment === value.treatment && p.city === value.city,
  )
  const cityLabel =
    pair?.cityLabel ??
    cities.find((c) => c.slug === value.city)?.label ??
    value.city

  const search = (compact: boolean) => (
    <HeroSearch
      treatments={treatments}
      cities={cities}
      pairs={pairs}
      value={value}
      onChange={setValue}
      compact={compact}
    />
  )

  return (
    <>
      {/* Solid, not /95 + backdrop-blur: WebKit let the page text show through the bar
          (2026-09-28). */}
      {docked && (
        <div className="fixed inset-x-0 top-16 z-30 border-b border-border-default bg-bg-base">
          <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            {search(true)}
          </div>
        </div>
      )}

      {/* Side by side from xl only. At 1024px the panel's 5 of 12 columns was ~350px: row titles
          collapsed to "696 / member…" and the selects clipped "Newport Be" (2026-09-28). */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24 xl:grid-cols-12 xl:items-start xl:gap-10">
        <div className="min-w-0 xl:col-span-7">
          {children}

          <div className="mt-8 animate-hero-fade-in [animation-delay:300ms]">
            {search(false)}
          </div>
          <div ref={sentinel} aria-hidden="true" />

          {/* Live counts, derived in page.tsx from the same corpus every section below reads.
              This line replaced the Social Proof section: the counters were the only live thing
              in it. */}
          <p className="mt-5 text-sm text-text-muted animate-hero-fade-in [animation-delay:450ms]">
            <span className="font-semibold text-text-secondary tabular-nums">
              {formatCount(counts.deals)}
            </span>{' '}
            advertised deals
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <span className="font-semibold text-text-secondary tabular-nums">
              {formatCount(counts.providers)}
            </span>{' '}
            providers
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <span className="font-semibold text-text-secondary tabular-nums">
              {formatCount(counts.cities)}
            </span>{' '}
            cities
          </p>
        </div>

        <div className="min-w-0 xl:col-span-5 animate-hero-fade-in [animation-delay:400ms]">
          <PairPanel
            pair={pair}
            treatment={value.treatment}
            treatmentLabel={treatmentLabel}
            city={value.city}
            cityLabel={cityLabel}
          />
        </div>
      </div>
    </>
  )
}

interface PairPanelProps {
  pair: PairStat | undefined
  treatment: string
  treatmentLabel: string
  city: string
  cityLabel: string
}

/**
 * The instant answer for one (treatment, city): range, median, a dot strip, the cheapest three.
 * For neurotoxins every figure is the city's typical price (typicalPrices(), via pairStats), and
 * the middle one is called "typical" as on the deals page this panel links to; below its floor
 * the panel says what that page's group header says, "from $X per unit".
 */
function PairPanel({
  pair,
  treatment,
  treatmentLabel,
  city,
  cityLabel,
}: PairPanelProps) {
  const href = `/deals/${treatment}/${city}`
  const priced =
    pair &&
    pair.minPrice !== null &&
    pair.maxPrice !== null &&
    pair.medianPrice !== null
  const basis = pair?.perUnit ? 'per unit' : 'per treatment'
  const typical = pair ? TYPICAL_TREATMENTS.has(pair.treatment) : false
  // aria-live so a screen-reader user who changes a select hears the new answer.
  return (
    <div
      className="rounded-2xl border border-border-default bg-bg-elevated p-5 shadow-lg sm:p-6"
      aria-live="polite"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {treatmentLabel} in {cityLabel}
        <span className="font-normal normal-case tracking-normal">
          {' '}
          · right now
        </span>
      </p>

      {!pair && (
        <p className="mt-3 text-text-secondary">
          No {treatmentLabel} offers listed in {cityLabel} yet.
        </p>
      )}

      {pair && priced && (
        <>
          {/* Two unbreakable halves, the basis riding with the high end: at 320px "per unit"
              split and "unit" dropped onto a line of its own (2026-09-28). 24px below 360px
              keeps "$6.99 – $16.63 per unit" on one line there. */}
          <p className="mt-3 font-display text-2xl font-bold tabular-nums tracking-tight text-text-primary min-[360px]:text-3xl sm:text-4xl">
            <span className="whitespace-nowrap">
              {formatPrice(pair.minPrice as number)}
              {/* The range's low end names its brand as the deals page bar does, "(Xeomin)". Not
                  "lowest is": that is the floor, and Dysport can sit below this range. */}
              {pair.minBrand && pair.minBrand !== 'Botox' && (
                <span className="text-base font-normal text-text-muted">
                  {minBrandText(pair.minBrand)}
                </span>
              )}
            </span>{' '}
            <span className="whitespace-nowrap">
              <span className="text-text-muted">– </span>
              {formatPrice(pair.maxPrice as number)}
              <span className="ml-2 text-base font-normal text-text-muted">
                {basis}
              </span>
            </span>
          </p>
          {/* Each "· N things" wraps whole, the dot leading: it split "6 / providers". */}
          <p className="mt-1 text-sm text-text-secondary">
            {typical ? 'typical' : 'median'}{' '}
            <span className="whitespace-nowrap font-semibold text-text-primary tabular-nums">
              {typical
                ? priceText({
                    amount: pair.medianPrice as number,
                    perUnit: pair.perUnit,
                  })
                : formatPrice(pair.medianPrice as number)}
            </span>{' '}
            <span className="whitespace-nowrap">
              · {pair.pricedDealCount} priced offers
            </span>{' '}
            <span className="whitespace-nowrap">
              · {pair.providerCount}{' '}
              {pair.providerCount === 1 ? 'provider' : 'providers'}
            </span>
          </p>
          <DotStrip
            prices={pair.prices}
            min={pair.minPrice as number}
            max={pair.maxPrice as number}
            median={pair.medianPrice as number}
          />
        </>
      )}

      {pair && !priced && pair.from && (
        <p className="mt-3 text-text-secondary">
          {pair.dealCount} {treatmentLabel}{' '}
          {pair.dealCount === 1 ? 'offer' : 'offers'} in {cityLabel} · from{' '}
          <span className="whitespace-nowrap font-semibold text-text-primary tabular-nums">
            {priceText(pair.from)}
          </span>
          {/* Whole, the dot leading, as on the guides index: never "lowest is / Dysport". */}
          {floorBrandText(pair.from.brand) && (
            <>
              {' '}
              <span className="whitespace-nowrap">
                {floorBrandText(pair.from.brand).trim()}
              </span>
            </>
          )}
        </p>
      )}

      {pair && !priced && !pair.from && (
        <p className="mt-3 text-text-secondary">
          {pair.dealCount} {treatmentLabel}{' '}
          {pair.dealCount === 1 ? 'offer' : 'offers'} in {cityLabel} — too few
          with a comparable price to chart yet.
        </p>
      )}

      {pair && pair.lowest.length > 0 && (
        <ol className="mt-5 space-y-2 border-t border-border-default pt-5">
          {pair.lowest.map((offer) => (
            <li key={offer.id}>
              <Link href={`/deals/${offer.id}`} className="block">
                <OfferRow offer={offer} />
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Link
        href={pair ? href : `/deals/${city}`}
        className="group mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
      >
        {/* Deals, not "prices": most of a pair's deals state a discount, not a price. The city
            only from sm: the panel's heading names it, and at 393px "Beach" wrapped alone
            (2026-09-28). One span, so the flex link keeps it one wrapping run. */}
        {pair ? (
          <span>
            See all {pair.dealCount} {treatmentLabel.toLowerCase()}{' '}
            {pair.dealCount === 1 ? 'deal' : 'deals'}
            <span className="hidden sm:inline"> in {cityLabel}</span>
          </span>
        ) : (
          `See every deal in ${cityLabel}`
        )}
        <ArrowRight
          size={16}
          weight="bold"
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </Link>
    </div>
  )
}

/** Prices repeat, so a key is the price plus which repeat of it this is: "$10#3". */
function dotKeys(prices: number[]): [string, number][] {
  const seen = new Map<number, number>()
  return prices.map((p) => {
    const n = (seen.get(p) ?? 0) + 1
    seen.set(p, n)
    return [`${p}#${n}`, p]
  })
}

/**
 * Every pooled price in the pair as a dot on one track, the median as an ink marker.
 * Graphics only — the numbers are printed above it. Overlapping dots stack visually darker
 * (75% opacity), which is the density signal.
 */
function DotStrip({
  prices,
  min,
  max,
  median,
}: {
  prices: number[]
  min: number
  max: number
  median: number
}) {
  const span = max - min
  const at = (p: number) => (span > 0 ? ((p - min) / span) * 100 : 50)
  return (
    <div
      className="relative mt-4 h-3 rounded-full bg-bg-surface"
      aria-hidden="true"
    >
      {dotKeys(prices).map(([key, p]) => (
        <span
          key={key}
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-graphic opacity-75"
          style={{ left: `${at(p)}%` }}
        />
      ))}
      <span
        className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
        style={{ left: `${at(median)}%` }}
      />
    </div>
  )
}
