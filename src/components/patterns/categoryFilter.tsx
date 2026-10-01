'use client'

import { TREATMENT_ICONS } from '@/components/patterns/treatmentIcons'
import { TREATMENT_LABELS } from '@/lib/data/adapters'
import type { TreatmentCategory } from '@/types/deal'

interface CategoryFilterProps {
  selected: TreatmentCategory | 'all'
  onChange: (category: TreatmentCategory | 'all') => void
  /** Only these chips render (plus "All deals"), in this order. Omit for all of them. */
  available?: TreatmentCategory[]
}

/**
 * Labels come from TREATMENT_LABELS, the one name per treatment that deal-card badges and the
 * /deals/{treatment} pages use. This list used to be hard-coded to four treatments, so a city
 * with Skincare or Wellness deals (and pages for them) showed no chip for either.
 */
export function CategoryFilter({
  selected,
  onChange,
  available,
}: CategoryFilterProps) {
  const treatments =
    available ?? (Object.keys(TREATMENT_LABELS) as TreatmentCategory[])
  const shown = [
    { value: 'all' as const, label: 'All deals', icon: null },
    ...treatments.map((value) => ({
      value,
      label: TREATMENT_LABELS[value],
      icon: TREATMENT_ICONS[value],
    })),
  ]
  return (
    // One scrolling row at every width: wrapped, the pills made the sticky filter bar ~170px
    // tall on phones and two rows on desktop. A city with every treatment still runs past the
    // row (8 chips are ~930px), so the right edge fades (the empty end of a short row fades
    // nothing) and pr-8 lets the last chip scroll clear of it. py-1 keeps focus rings inside.
    // A mouse gets a thin scrollbar: with none, a wheel could not reach "Wellness" at 1024px
    // (2026-09-28). Touch keeps swiping, with the cut chip and the fade as the cue.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] pointer-fine:[scrollbar-width:thin] sm:mx-0 sm:pr-8 sm:pl-0 sm:[mask-image:linear-gradient(to_right,black_calc(100%_-_2rem),transparent)]">
      {shown.map((category) => {
        const isSelected = selected === category.value
        const Icon = category.icon

        return (
          <button
            type="button"
            key={category.value}
            onClick={() => onChange(category.value)}
            className={`inline-flex shrink-0 items-center gap-1.5 px-3.5 min-h-[44px] rounded-full text-sm font-medium transition-colors cursor-pointer ${
              isSelected
                ? 'bg-text-primary text-white'
                : 'border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
            }`}
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
