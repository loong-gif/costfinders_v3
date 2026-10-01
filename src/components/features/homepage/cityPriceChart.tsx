'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatPrice } from '@/lib/data/adapters'
import type { TreatmentCityMedians } from '@/lib/data/homepage'
import {
  TYPICAL_MIN_PRICED_DEALS,
  TYPICAL_MIN_PROVIDERS,
  TYPICAL_TREATMENTS,
} from '@/lib/data/typicalPrice'

interface CityPriceChartProps {
  byTreatment: TreatmentCityMedians[]
  /** Every city with visible deals, for the "all cities" list under the chart. */
  cities: { city: string; slug: string; dealCount: number }[]
}

/**
 * One series, one hue, bars from zero: the median advertised price in the cities with the most
 * priced offers for the selected treatment. Replaces the 46-tile city grid (2,344px, 39% of
 * the old page) with the one comparison a price site should make first.
 *
 * Bars are `<Link>`s to /deals/{treatment}/{city}. Values are printed in text beside every bar,
 * so the coral fill carries nothing a reader cannot get from the row itself. The "every city"
 * list below is the table view: name and deal count for all of them, including the ones with
 * too few priced offers in the active treatment to chart honestly.
 *
 * A neurotoxin bar is its city's typical price, the figure the deals page it links to prints
 * (cityMedians() in homepage.ts), so this chart says "typical" and states that floor.
 */
export function CityPriceChart({ byTreatment, cities }: CityPriceChartProps) {
  const [activeTreatment, setActiveTreatment] = useState(
    byTreatment[0]?.treatment,
  )
  const selected = byTreatment.find((t) => t.treatment === activeTreatment)
  const max = Math.max(...(selected?.rows.map((m) => m.medianPrice) ?? []), 0)
  const visibleCities = cities.filter((c) => c.dealCount > 0)
  const typical = selected ? TYPICAL_TREATMENTS.has(selected.treatment) : false

  return (
    <section className="w-full border-t border-border-default bg-bg-base py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {selected && selected.rows.length > 0 && (
            // The whole width when there is no city list beside it: a treatment page passes
            // cities={[]}, and the chart sat in 7 of 12 columns beside nothing (2026-09-28).
            <div
              className={
                visibleCities.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
              }
            >
              {/* A single tab switches nothing — a treatment page may hold only one. */}
              {byTreatment.length > 1 && (
                // biome-ignore lint/a11y/useSemanticElements: a toggle group of view-switching buttons, not a form field set — <fieldset> would be the wrong semantics.
                <div
                  role="group"
                  aria-label="Treatment"
                  className="mb-4 flex flex-wrap gap-2"
                >
                  {byTreatment.map((t) => (
                    <button
                      key={t.treatment}
                      type="button"
                      aria-pressed={t.treatment === activeTreatment}
                      onClick={() => setActiveTreatment(t.treatment)}
                      className={
                        t.treatment === activeTreatment
                          ? 'min-h-[36px] rounded-full bg-text-primary px-3.5 text-sm font-medium text-white'
                          : 'min-h-[36px] rounded-full border border-border-default px-3.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary'
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                {selected.label} price by city
              </h2>
              <p className="mt-1 text-text-secondary">
                {typical ? 'Typical' : 'Median advertised'}{' '}
                {selected.perUnit ? 'price per unit' : 'price'}, in the cities
                with the most {selected.label} offers.
              </p>

              <ol className="mt-8 space-y-3">
                {selected.rows.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`/deals/${selected.treatment}/${m.slug}`}
                      title={`${m.city}: ${formatPrice(m.minPrice)} – ${formatPrice(m.maxPrice)}${selected.perUnit ? ' per unit' : ''} across ${m.pricedDealCount} priced offers`}
                      className="group grid grid-cols-[7.5rem_1fr_4.25rem] items-center gap-3 rounded-lg py-1 sm:grid-cols-[10rem_1fr_8.5rem]"
                    >
                      <span className="truncate text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                        {m.city}
                      </span>
                      <span
                        className="relative block h-3 w-full overflow-hidden rounded-r-[4px] bg-bg-surface"
                        aria-hidden="true"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent-graphic transition-opacity group-hover:opacity-80"
                          style={{
                            width: `${max > 0 ? (m.medianPrice / max) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="text-right text-sm tabular-nums">
                        <span className="font-display font-semibold text-text-primary">
                          {formatPrice(m.medianPrice)}
                        </span>
                        <span className="hidden text-text-muted sm:inline">
                          {' '}
                          · {m.pricedDealCount} offers
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              {typical ? (
                <p className="mt-4 text-xs text-text-muted">
                  Cities with a typical price: at least{' '}
                  {TYPICAL_MIN_PRICED_DEALS} priced offers from{' '}
                  {TYPICAL_MIN_PROVIDERS} providers. Typical is the median
                  per-unit rate, leaving out starting prices and Dysport.{' '}
                  <Link
                    href="/how-it-works#typical-prices"
                    className="font-medium text-accent underline-offset-2 hover:text-accent-hover hover:underline"
                  >
                    How we work it out
                  </Link>
                </p>
              ) : (
                <p className="mt-4 text-xs text-text-muted">
                  Cities with at least three priced {selected.label} offers.
                  Each median pools every provider&apos;s advertised{' '}
                  {selected.perUnit ? 'per-unit rate' : 'price'}.
                </p>
              )}
            </div>
          )}

          {visibleCities.length > 0 && (
            <div
              className={
                selected && selected.rows.length > 0
                  ? 'lg:col-span-5'
                  : 'lg:col-span-12'
              }
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Every city
              </h2>
              <p className="mt-1 text-text-secondary">
                {visibleCities.length} cities with advertised deals.
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
                {visibleCities.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/deals/${c.slug}`}
                      className="text-sm text-text-primary hover:text-accent transition-colors"
                    >
                      {c.city}
                      <span className="ml-1 text-text-muted tabular-nums">
                        {c.dealCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
