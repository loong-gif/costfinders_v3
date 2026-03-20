'use client'

import { Drop, Sparkle, Sun, Syringe } from '@phosphor-icons/react'
import type { TreatmentCategory } from '@/types/deal'

interface CategoryFilterProps {
  selected: TreatmentCategory | 'all'
  onChange: (category: TreatmentCategory | 'all') => void
}

interface CategoryOption {
  value: TreatmentCategory | 'all'
  label: string
  icon: React.ComponentType<{
    size?: number
    weight?: 'regular' | 'fill'
  }> | null
}

const categories: CategoryOption[] = [
  { value: 'all', label: 'All Deals', icon: null },
  { value: 'botox', label: 'Botox', icon: Syringe },
  { value: 'fillers', label: 'Fillers', icon: Drop },
  { value: 'facials', label: 'Facials', icon: Sparkle },
  { value: 'laser', label: 'Laser', icon: Sun },
]

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const isSelected = selected === category.value
        const Icon = category.icon

        return (
          <button
            type="button"
            key={category.value}
            onClick={() => onChange(category.value)}
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
              transition-all duration-200
              ${
                isSelected
                  ? 'bg-amber-400 text-white shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-100 hover:border-stone-700'
              }
            `}
            aria-pressed={isSelected}
          >
            {Icon && (
              <Icon size={16} weight={isSelected ? 'fill' : 'regular'} />
            )}
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
