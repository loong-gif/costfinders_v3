'use client'

import { Funnel, WarningCircle, X } from '@phosphor-icons/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PriceRangeFilter } from '@/components/patterns/priceRangeFilter'
import { SortSelector } from '@/components/patterns/sortSelector'
import { trackEvent } from '@/lib/analytics'
import type { DealFilters, SortOption } from '@/lib/utils/deal-sorting'

interface FilterPanelProps {
  filters: DealFilters
  sortBy: SortOption
  onFiltersChange: (filters: DealFilters) => void
  onSortChange: (sort: SortOption) => void
  onReset: () => void
  activeFilterCount: number
  /** Legend for the price bounds — "Price per unit" where every deal compares per unit. */
  priceLabel?: string
  /** The treatment chips (CategoryFilter). Share the row with Sort and Filters from xl up. */
  chips?: ReactNode
}

/**
 * The browse filter bar, sticky under the 64px header. One row from xl up — chips, then Filters
 * and Sort — 61px tall by its classes. Below xl the chips get a row of their own above Filters
 * and Sort: sharing it at 1024px cut "Skincare" in half and left "Wellness" out of a mouse's
 * reach, and at 712–834px a chip read "Fac" (2026-09-28).
 */
export function FilterPanel({
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
  onReset,
  activeFilterCount,
  priceLabel,
  chips,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const panelRef = useRef<HTMLFormElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // The panel sits inside the sticky bar, so while it is open it stays pinned over the list: on
  // a 390x844 phone the pinned block measured 395px, nearly half the screen, until "Filters" was
  // tapped again (2026-09-28). Fold it once the shopper scrolls on to the results. Not while
  // they are typing in it: the on-screen keyboard and the live re-filter both move the page.
  useEffect(() => {
    if (!isExpanded) return
    const openedAt = performance.now()
    let start = window.scrollY
    const onScroll = () => {
      // globals.css scrolls smoothly, so a tap can land mid-scroll: on a Pixel 7 the scroll
      // still running folded the panel the moment it opened (2026-09-28). For its first
      // 300ms, follow the page instead of measuring from where it was.
      if (performance.now() - openedAt < 300) {
        start = window.scrollY
        return
      }
      if (panelRef.current?.contains(document.activeElement)) return
      if (Math.abs(window.scrollY - start) > 64) setIsExpanded(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsExpanded(false)
      toggleRef.current?.focus()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isExpanded])

  // An inverted range matches nothing — say so instead of letting the list
  // silently come back empty.
  const hasInvalidRange =
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice

  const handlePriceChange = (
    min: number | undefined,
    max: number | undefined,
  ) => {
    trackEvent('filter_applied', {
      type: 'price',
      min: min ?? 0,
      max: max ?? 0,
    })
    onFiltersChange({
      ...filters,
      minPrice: min,
      maxPrice: max,
    })
  }

  return (
    // Solid, not bg-bg-base/95 with a blur: on WebKit the rows scrolling underneath stayed
    // legible through it and read as text overlapping the chips (2026-09-28).
    <div className="sticky top-16 z-30 -mx-4 mb-4 border-b border-border-default bg-bg-base px-4 py-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:gap-3">
        {chips && <div className="min-w-0 xl:flex-1">{chips}</div>}
        {/* Sort last: its menu opens leftwards from its right edge, so on a phone that edge
            has to be the screen's right margin or the menu runs off the left. */}
        <div className="flex items-center justify-between gap-2 xl:ml-auto xl:shrink-0">
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center gap-2 px-4 min-h-[44px] rounded-full text-sm font-medium transition-colors ${
              isExpanded
                ? 'bg-text-primary text-white'
                : 'border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
            }`}
            aria-expanded={isExpanded}
            aria-controls="deal-filter-panel"
          >
            <Funnel size={18} weight={isExpanded ? 'fill' : 'regular'} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  isExpanded
                    ? 'bg-white text-text-primary'
                    : 'bg-accent text-white'
                }`}
              >
                <span className="sr-only">(</span>
                {activeFilterCount}
                <span className="sr-only"> active)</span>
              </span>
            )}
          </button>
          {/* Opening Sort folds the panel: its menu dropped over the open panel and hid Done. */}
          <SortSelector
            value={sortBy}
            onChange={onSortChange}
            onOpen={() => setIsExpanded(false)}
          />
        </div>
      </div>

      {/* A form so Enter in a price box folds the panel too (implicit submission via Done). The
          prices already apply as they are typed; submitting only closes the panel. */}
      {isExpanded && (
        <form
          ref={panelRef}
          id="deal-filter-panel"
          onSubmit={(e) => {
            e.preventDefault()
            setIsExpanded(false)
            toggleRef.current?.focus()
          }}
          className="mt-1 mb-2 space-y-2 rounded-xl bg-bg-surface p-4"
        >
          <PriceRangeFilter
            label={priceLabel}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onChange={handlePriceChange}
          />
          {/* What withinPriceRange() actually compares (comparablePrice in adapters.ts). The
              old line, "prices shown are per unit, session, or treatment", described the
              printed figure, not the filter — which read raw dealPrice and so ranged "$10 per
              unit" against "$299 for 40 units" as if both were what you pay. */}
          <p className="text-xs text-text-muted">
            Botox and other neurotoxins are compared per unit, everything else
            by the price you pay. While a range is set, deals that can't be
            compared that way are hidden.
          </p>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={14} weight="bold" />
                Clear filters
              </button>
            )}
            <button
              type="submit"
              className="ml-auto inline-flex items-center px-5 min-h-[44px] rounded-full bg-text-primary text-sm font-semibold text-white transition-colors hover:bg-text-secondary"
            >
              Done
            </button>
          </div>
        </form>
      )}

      {/* Stays visible when the panel is collapsed — it explains an empty list */}
      {hasInvalidRange && (
        <p
          role="alert"
          className="mb-2 flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
        >
          <WarningCircle size={16} weight="fill" className="shrink-0" />
          Minimum price must be lower than maximum price
        </p>
      )}
    </div>
  )
}
