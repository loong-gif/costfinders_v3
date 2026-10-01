'use client'

import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useId } from 'react'

export interface SearchOption {
  slug: string
  label: string
}

export interface SearchValue {
  treatment: string
  city: string
}

interface HeroSearchProps {
  treatments: SearchOption[]
  cities: SearchOption[]
  /** `${treatment}:${citySlug}` for every pair that has at least one visible offer. */
  pairs: string[]
  value: SearchValue
  onChange: (next: SearchValue) => void
  /** The docked bar under the header: one row, labels for screen readers only. */
  compact?: boolean
}

/**
 * Two selects and a button, not a search box. There is no text index over offers, and the
 * destination already exists for every pair: `/deals/{treatment}/{city}` is statically built
 * (src/app/deals/[[...slugs]]/page.tsx). `/deals` itself takes no query params, so a free-text
 * field would have nothing to submit to.
 *
 * The city list is filtered by `pairs` so the button never lands on one of the ~250 prebuilt
 * pairs that have no offers — a search that returns an empty page is worse than no search.
 *
 * Controlled: the hero's answer panel and the docked bar read the same value.
 * ponytail: native <select>s. A combobox with type-ahead can replace them when the city list
 * outgrows a picker; at ~34 cities it has not.
 */
export function HeroSearch({
  treatments,
  cities,
  pairs,
  value,
  onChange,
  compact = false,
}: HeroSearchProps) {
  const router = useRouter()
  const id = useId()

  const available = new Set(pairs)
  const cityOptions = cities.filter((c) =>
    available.has(`${value.treatment}:${c.slug}`),
  )
  const selectedCity = cityOptions.some((c) => c.slug === value.city)
    ? value.city
    : (cityOptions[0]?.slug ?? '')

  const handleTreatment = (treatment: string) => {
    const city = available.has(`${treatment}:${value.city}`)
      ? value.city
      : (cities.find((c) => available.has(`${treatment}:${c.slug}`))?.slug ??
        '')
    onChange({ treatment, city })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCity) return
    router.push(`/deals/${value.treatment}/${selectedCity}`)
  }

  const field = compact
    ? 'relative flex min-w-0 flex-1 items-center px-3'
    : 'relative flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-2 sm:px-5'
  const label = compact ? 'sr-only' : 'text-xs font-medium text-text-muted'
  const select = compact
    ? 'w-full min-h-[40px] cursor-pointer appearance-none rounded-md bg-transparent pr-6 font-display text-sm font-semibold text-text-primary'
    : 'w-full cursor-pointer appearance-none rounded-md bg-transparent pr-7 font-display text-base font-semibold text-text-primary sm:text-lg'
  const caret = compact
    ? 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted'
    : 'pointer-events-none absolute right-4 top-1/2 mt-2 -translate-y-1/2 text-text-muted'

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'flex items-stretch gap-1 rounded-full border border-border-default bg-bg-elevated p-1 shadow-md'
          : 'flex flex-col gap-2 rounded-2xl border border-border-default bg-bg-elevated p-2 shadow-lg sm:flex-row sm:items-stretch sm:rounded-full'
      }
      aria-label="Compare prices"
    >
      <div className={field}>
        <label htmlFor={`${id}-treatment`} className={label}>
          Treatment
        </label>
        <select
          id={`${id}-treatment`}
          name="treatment"
          value={value.treatment}
          onChange={(e) => handleTreatment(e.target.value)}
          className={select}
        >
          {treatments.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden="true"
          className={caret}
        />
      </div>

      <div className={`${field} border-l border-border-default`}>
        <label htmlFor={`${id}-city`} className={label}>
          Location
        </label>
        <select
          id={`${id}-city`}
          name="city"
          value={selectedCity}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className={select}
        >
          {cityOptions.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden="true"
          className={caret}
        />
      </div>

      <button
        type="submit"
        className={
          compact
            ? 'inline-flex min-h-[40px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:px-5'
            : 'inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-6 font-semibold text-white transition-colors hover:bg-accent-hover sm:rounded-full'
        }
      >
        <span className={compact ? 'sr-only sm:not-sr-only' : ''}>
          Search prices
        </span>
        <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
      </button>
    </form>
  )
}
