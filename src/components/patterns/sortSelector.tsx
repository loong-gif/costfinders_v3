'use client'

import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  Check,
  Clock,
  Fire,
  Tag,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { SortOption } from '@/lib/mock-data'

interface SortSelectorProps {
  value: SortOption
  onChange: (value: SortOption) => void
}

interface SortOptionConfig {
  value: SortOption
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
}

const sortOptions: SortOptionConfig[] = [
  { value: 'popular', label: 'Most Popular', icon: Fire },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'discount', label: 'Biggest Discount', icon: Tag },
  { value: 'price-asc', label: 'Price: Low to High', icon: ArrowUp },
  { value: 'price-desc', label: 'Price: High to Low', icon: ArrowDown },
]

export function SortSelector({ value, onChange }: SortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption =
    sortOptions.find((opt) => opt.value === value) ?? sortOptions[0]
  const SelectedIcon = selectedOption.icon

  // Close on outside click
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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (option: SortOption) => {
    onChange(option)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-4 py-2.5 min-h-[44px]
          bg-[#f2ebe2]
          border border-[#d4c4b0] rounded-xl
          text-[#451a03] text-sm font-medium
          hover:border-[#c4b09a]
          transition-all duration-200 cursor-pointer
        "
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <SelectedIcon size={16} weight="regular" />
        <span>{selectedOption.label}</span>
        <CaretDown
          size={14}
          weight="regular"
          className={`text-[#92400e] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-56 z-50
            bg-[#f2ebe2]
            border border-[#d4c4b0] rounded-xl
            shadow-elevated
            overflow-hidden
          "
          role="listbox"
          aria-label="Sort options"
        >
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
                  ${
                    isSelected
                      ? 'bg-amber-800/8 text-amber-800'
                      : 'text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03]'
                  }
                `}
                role="option"
                aria-selected={isSelected}
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
