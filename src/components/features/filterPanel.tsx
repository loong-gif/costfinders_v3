'use client'

import { Funnel, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { PriceRangeFilter } from '@/components/patterns/priceRangeFilter'
import { SortSelector } from '@/components/patterns/sortSelector'
import type { DealFilters, SortOption } from '@/lib/mock-data'

interface FilterPanelProps {
  filters: DealFilters
  sortBy: SortOption
  onFiltersChange: (filters: DealFilters) => void
  onSortChange: (sort: SortOption) => void
  onReset: () => void
  activeFilterCount: number
}

export function FilterPanel({
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
  onReset,
  activeFilterCount,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handlePriceChange = (
    min: number | undefined,
    max: number | undefined,
  ) => {
    onFiltersChange({
      ...filters,
      minPrice: min,
      maxPrice: max,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Filter Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            inline-flex items-center gap-2 px-4 py-2.5
            rounded-xl text-sm font-medium
            transition-all duration-200
            ${
              isExpanded
                ? 'bg-amber-400 text-stone-950'
                : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-100 hover:border-stone-700'
            }
          `}
          aria-expanded={isExpanded}
        >
          <Funnel size={18} weight={isExpanded ? 'fill' : 'regular'} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              className={`
              inline-flex items-center justify-center
              w-5 h-5 text-xs font-bold rounded-full
              ${isExpanded ? 'bg-white/20 text-stone-950' : 'bg-amber-400 text-stone-950'}
            `}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Right Side: Clear All + Sort */}
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="
                inline-flex items-center gap-1.5 px-3 py-2
                text-sm text-stone-400 hover:text-stone-100
                transition-colors duration-200
              "
            >
              <X size={14} weight="bold" />
              <span>Clear all</span>
            </button>
          )}
          <SortSelector value={sortBy} onChange={onSortChange} />
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 bg-stone-900 border border-stone-800 rounded-xl space-y-4">
          <PriceRangeFilter
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onChange={handlePriceChange}
          />
        </div>
      )}
    </div>
  )
}
