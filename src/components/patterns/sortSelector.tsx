'use client'

import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  Check,
  Clock,
  Tag,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { SortOption } from '@/lib/utils/deal-sorting'

interface SortSelectorProps {
  value: SortOption
  onChange: (value: SortOption) => void
  /** Called as the menu opens, so a neighbouring panel can fold out of its way. */
  onOpen?: () => void
}

interface SortOptionConfig {
  value: SortOption
  label: string
  /**
   * What the trigger shows below sm. The END of `label`, so the words a phone shows stay inside
   * the button's accessible name, which keeps the whole label.
   */
  short: string
  icon: React.ComponentType<{
    size?: number
    weight?: 'regular' | 'fill'
    className?: string
  }>
}

// No "Most Popular": it ranked on a claim count that is 0 for every deal. Price first, the
// default (see DEFAULT_SORT in deals/cityDealsPage.tsx).
const sortOptions: SortOptionConfig[] = [
  {
    value: 'price-asc',
    label: 'Price: Low to High',
    short: 'Low to High',
    icon: ArrowUp,
  },
  {
    value: 'price-desc',
    label: 'Price: High to Low',
    short: 'High to Low',
    icon: ArrowDown,
  },
  {
    value: 'discount',
    label: 'Biggest Discount',
    short: 'Discount',
    icon: Tag,
  },
  { value: 'newest', label: 'Newest', short: 'Newest', icon: Clock },
]

export function SortSelector({ value, onChange, onOpen }: SortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selectedOption =
    sortOptions.find((opt) => opt.value === value) ?? sortOptions[0]
  const SelectedIcon = selectedOption.icon

  // Close on outside click, and on Escape. Escape was missing: a keyboard user
  // who opened this had to Tab through all five options to get past it, and the
  // panel stayed open over the listing. Same shape as the sheet dismissal in
  // baseSidebar.tsx and the Modal primitive.
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      // Focus would otherwise be left on a button that no longer exists,
      // dropping the user back to the top of the document.
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (option: SortOption) => {
    onChange(option)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger. At 320px "Price: Low to High" broke onto two lines of a 177px pill beside
          Filters (2026-09-28). Below sm it drops its icon and shows the short label: 135px. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isOpen) onOpen?.()
          setIsOpen(!isOpen)
        }}
        className="flex items-center gap-2 whitespace-nowrap px-4 min-h-[44px] rounded-full border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <SelectedIcon size={16} weight="regular" className="max-sm:hidden" />
        <span>
          <span className="max-sm:sr-only">
            {selectedOption.label.slice(
              0,
              selectedOption.label.length - selectedOption.short.length,
            )}
          </span>
          {selectedOption.short}
        </span>
        <CaretDown
          size={14}
          weight="regular"
          className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown — a disclosure revealing plain buttons, not a listbox. The
          previous role="listbox" + role="option" pair was an invalid composite:
          ARIA options are not buttons, and a real listbox owes the user
          arrow-key roving focus this never had. Unroled buttons are
          Tab-reachable and announce themselves correctly; aria-expanded on the
          trigger carries the open/closed state. */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 z-50 bg-bg-elevated border border-border-default rounded-xl shadow-lg overflow-hidden">
          {sortOptions.map((option) => {
            const Icon = option.icon
            const isSelected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                id={`sort-option-${option.value}`}
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 min-h-[44px]
                  text-sm transition-colors duration-150 cursor-pointer
                  focus-visible:-outline-offset-2
                  ${
                    isSelected
                      ? 'bg-bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'
                  }
                `}
                aria-current={isSelected}
              >
                <Icon size={18} weight={isSelected ? 'fill' : 'regular'} />
                <span className="flex-1 text-left">{option.label}</span>
                {isSelected && <Check size={16} weight="bold" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
