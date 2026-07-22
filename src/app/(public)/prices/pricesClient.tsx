'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyPriceFilters,
  getPriceFilterOptions,
  type ParsedPriceFilters,
  type PriceQuote,
  parsePriceFilters,
} from '@/lib/data/marketplace'

interface PricesClientProps {
  quotes: PriceQuote[]
  initialSearchParams: Record<string, string | string[] | undefined>
}

function money(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function filtersToQuery(filters: ParsedPriceFilters): string {
  const params = new URLSearchParams()
  if (filters.city) params.set('city', filters.city)
  if (filters.category) params.set('category', filters.category)
  if (filters.min !== null) params.set('min', String(filters.min))
  if (filters.max !== null) params.set('max', String(filters.max))
  return params.toString()
}

function patchFilters(
  current: ParsedPriceFilters,
  patch: {
    city?: string | null
    category?: string | null
    min?: string | null
    max?: string | null
  },
): ParsedPriceFilters {
  const record: Record<string, string> = {}
  const city = patch.city !== undefined ? patch.city : current.city
  const category =
    patch.category !== undefined ? patch.category : current.category
  const minRaw =
    patch.min !== undefined
      ? patch.min
      : current.min !== null
        ? String(current.min)
        : null
  const maxRaw =
    patch.max !== undefined
      ? patch.max
      : current.max !== null
        ? String(current.max)
        : null

  if (city) record.city = city
  if (category) record.category = category
  if (minRaw) record.min = minRaw
  if (maxRaw) record.max = maxRaw

  return parsePriceFilters(record)
}

export function PricesClient({
  quotes,
  initialSearchParams,
}: PricesClientProps) {
  const pathname = usePathname()
  const [filters, setFilters] = useState(() =>
    parsePriceFilters(initialSearchParams),
  )
  const filterOptions = useMemo(() => getPriceFilterOptions(quotes), [quotes])
  const comparisons = useMemo(
    () => applyPriceFilters(quotes, filters),
    [quotes, filters],
  )
  const [minInput, setMinInput] = useState(
    filters.min !== null ? String(filters.min) : '',
  )
  const [maxInput, setMaxInput] = useState(
    filters.max !== null ? String(filters.max) : '',
  )

  useEffect(() => {
    setMinInput(filters.min !== null ? String(filters.min) : '')
    setMaxInput(filters.max !== null ? String(filters.max) : '')
  }, [filters.min, filters.max])

  const syncUrl = useCallback(
    (next: ParsedPriceFilters) => {
      const query = filtersToQuery(next)
      const url = query ? `${pathname}?${query}` : pathname
      window.history.replaceState(window.history.state, '', url)
    },
    [pathname],
  )

  const replaceFilters = useCallback(
    (patch: {
      city?: string | null
      category?: string | null
      min?: string | null
      max?: string | null
    }) => {
      setFilters((current) => {
        const next = patchFilters(current, patch)
        syncUrl(next)
        return next
      })
    },
    [syncUrl],
  )

  useEffect(() => {
    const onPopState = () => {
      setFilters(parsePriceFilters(new URLSearchParams(window.location.search)))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const hasActiveFilters = Boolean(
    filters.city ||
      filters.category ||
      filters.min !== null ||
      filters.max !== null,
  )

  const clearFilters = () => {
    setMinInput('')
    setMaxInput('')
    const next = parsePriceFilters({})
    setFilters(next)
    syncUrl(next)
  }

  const applyPriceRange = () => {
    replaceFilters({
      min: minInput.trim() || null,
      max: maxInput.trim() || null,
    })
  }

  return (
    <>
      <section className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px] flex-1">
            <label
              htmlFor="prices-city"
              className="block text-sm font-medium text-[#78350f]"
            >
              City
            </label>
            <select
              id="prices-city"
              value={filters.city ?? ''}
              onChange={(event) =>
                replaceFilters({
                  city: event.target.value || null,
                })
              }
              className="mt-1 w-full rounded-lg border border-[#d4c4b0] bg-[#faf5ee] px-3 py-2 text-[#451a03]"
            >
              <option value="">All cities</option>
              {filterOptions.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px] flex-1">
            <label
              htmlFor="prices-category"
              className="block text-sm font-medium text-[#78350f]"
            >
              Service category
            </label>
            <select
              id="prices-category"
              value={filters.category ?? ''}
              onChange={(event) =>
                replaceFilters({
                  category: event.target.value || null,
                })
              }
              className="mt-1 w-full rounded-lg border border-[#d4c4b0] bg-[#faf5ee] px-3 py-2 text-[#451a03]"
            >
              <option value="">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label
              htmlFor="prices-min"
              className="block text-sm font-medium text-[#78350f]"
            >
              Min price
            </label>
            <input
              id="prices-min"
              type="number"
              min="0"
              step="0.01"
              value={minInput}
              onChange={(event) => setMinInput(event.target.value)}
              onBlur={applyPriceRange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyPriceRange()
              }}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-[#d4c4b0] bg-[#faf5ee] px-3 py-2 text-[#451a03]"
            />
          </div>

          <div className="min-w-[120px]">
            <label
              htmlFor="prices-max"
              className="block text-sm font-medium text-[#78350f]"
            >
              Max price
            </label>
            <input
              id="prices-max"
              type="number"
              min="0"
              step="0.01"
              value={maxInput}
              onChange={(event) => setMaxInput(event.target.value)}
              onBlur={applyPriceRange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyPriceRange()
              }}
              placeholder="Any"
              className="mt-1 w-full rounded-lg border border-[#d4c4b0] bg-[#faf5ee] px-3 py-2 text-[#451a03]"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-[#d4c4b0] px-4 py-2 text-sm font-medium text-[#78350f] hover:bg-[#faf5ee]"
            >
              Clear filters
            </button>
          )}
        </div>

        {filters.rangeError && (
          <p className="mt-3 text-sm text-red-700">{filters.rangeError}</p>
        )}
      </section>

      <div className="mt-8 space-y-5">
        {comparisons.map((comparison) => (
          <section
            key={`${comparison.city}-${comparison.serviceCategory}`}
            className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5"
          >
            <p className="text-sm font-medium text-[#92400e]">
              {comparison.city}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#451a03]">
              {comparison.serviceCategory}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {comparison.units.map((unit) => (
                <article
                  key={unit.unitType}
                  className="rounded-lg bg-[#faf5ee] p-4"
                >
                  <p className="font-medium capitalize text-[#451a03]">
                    Per {unit.unitType}
                  </p>
                  {unit.providerCount === 1 ? (
                    <p className="mt-2 text-sm text-[#78350f]">
                      Sample insufficient — one provider
                    </p>
                  ) : (
                    <p className="mt-2 text-lg font-semibold text-[#92400e]">
                      {money(unit.minimum)}–{money(unit.maximum)}
                    </p>
                  )}
                  {unit.median !== null && (
                    <p className="mt-1 text-sm text-[#78350f]">
                      Median {money(unit.median)}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#78350f]">
                    {unit.providerCount}{' '}
                    {unit.providerCount === 1 ? 'provider' : 'providers'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {comparisons.length === 0 && (
        <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
          {hasActiveFilters ? (
            <>
              No prices match your filters.{' '}
              <button
                type="button"
                onClick={clearFilters}
                className="underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              No active offer prices are available yet.{' '}
              <Link href="/promotions" className="underline">
                Browse promotions instead.
              </Link>
            </>
          )}
        </p>
      )}
    </>
  )
}
