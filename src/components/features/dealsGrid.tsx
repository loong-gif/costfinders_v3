'use client'

import { List, MagnifyingGlass, SquaresFour } from '@phosphor-icons/react'
import { useState } from 'react'
import type { AnonymousDeal } from '@/types/deal'
import { DealCard } from './dealCard'
import { DealCardSkeleton } from './dealCardSkeleton'

interface DealsGridProps {
  deals: AnonymousDeal[]
  isLoading?: boolean
  onDealClick?: (dealId: string) => void
}

type ViewMode = 'grid' | 'list'

interface ViewModeToggleProps {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  disabled?: boolean
}

function ViewModeToggle({ viewMode, onChange, disabled }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-glass-bg rounded-lg border border-glass-border">
      <button
        type="button"
        onClick={() => onChange('grid')}
        disabled={disabled}
        className={`
          p-2 rounded-md transition-colors
          ${
            viewMode === 'grid'
              ? 'bg-brand-primary/20 text-brand-primary'
              : 'text-text-secondary hover:text-text-primary'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label="Grid view"
        aria-pressed={viewMode === 'grid'}
      >
        <SquaresFour
          size={18}
          weight={viewMode === 'grid' ? 'fill' : 'regular'}
        />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        disabled={disabled}
        className={`
          p-2 rounded-md transition-colors
          ${
            viewMode === 'list'
              ? 'bg-brand-primary/20 text-brand-primary'
              : 'text-text-secondary hover:text-text-primary'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label="List view"
        aria-pressed={viewMode === 'list'}
      >
        <List size={18} weight={viewMode === 'list' ? 'fill' : 'regular'} />
      </button>
    </div>
  )
}

export function DealsGrid({
  deals,
  isLoading = false,
  onDealClick,
}: DealsGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-end mb-4">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} disabled />
        </div>
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-4'
          }
        >
          {[
            'skeleton-1',
            'skeleton-2',
            'skeleton-3',
            'skeleton-4',
            'skeleton-5',
            'skeleton-6',
          ].map((id) => (
            <DealCardSkeleton key={id} variant={viewMode} />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (deals.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-end mb-4">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-glass-bg border border-glass-border flex items-center justify-center mb-4">
            <MagnifyingGlass
              size={32}
              weight="light"
              className="text-text-tertiary"
            />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No deals found
          </h3>
          <p className="text-text-secondary text-center max-w-md">
            Try adjusting your filters or location to see more deals in your
            area.
          </p>
        </div>
      </div>
    )
  }

  // Normal state
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'} found
        </p>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'flex flex-col gap-4'
        }
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            variant={viewMode}
            onClick={onDealClick ? () => onDealClick(deal.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
