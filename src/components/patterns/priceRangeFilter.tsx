'use client'

import { CurrencyDollar } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

interface PriceRangeFilterProps {
  minPrice?: number
  maxPrice?: number
  onChange: (min: number | undefined, max: number | undefined) => void
}

export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onChange,
}: PriceRangeFilterProps) {
  const [min, setMin] = useState<string>(minPrice?.toString() ?? '')
  const [max, setMax] = useState<string>(maxPrice?.toString() ?? '')

  // Sync external prop changes to internal state
  useEffect(() => {
    setMin(minPrice?.toString() ?? '')
  }, [minPrice])

  useEffect(() => {
    setMax(maxPrice?.toString() ?? '')
  }, [maxPrice])

  const handleMinChange = (value: string) => {
    setMin(value)
    const parsed = value === '' ? undefined : Number(value)
    const maxParsed = max === '' ? undefined : Number(max)
    onChange(parsed, maxParsed)
  }

  const handleMaxChange = (value: string) => {
    setMax(value)
    const minParsed = min === '' ? undefined : Number(min)
    const parsed = value === '' ? undefined : Number(value)
    onChange(minParsed, parsed)
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[#78350f]">
        Price Range
      </legend>
      <div className="flex items-center gap-2">
        {/* Min Price Input */}
        <div className="relative flex-1">
          <CurrencyDollar
            size={18}
            weight="light"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
            aria-hidden="true"
          />
          <input
            type="number"
            value={min}
            onChange={(e) => handleMinChange(e.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
            min={0}
            className="
              w-full pl-8 pr-3 py-2.5 min-h-[44px]
              bg-[#f2ebe2]
              border border-[#d4c4b0] rounded-xl
              text-[#451a03] placeholder:text-[#92400e]
              focus:outline-none focus:border-amber-800/40 focus:ring-1 focus:ring-amber-800/15
              transition-all duration-200
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
        </div>

        <span className="text-[#92400e]" aria-hidden="true">
          —
        </span>

        {/* Max Price Input */}
        <div className="relative flex-1">
          <CurrencyDollar
            size={18}
            weight="light"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
            aria-hidden="true"
          />
          <input
            type="number"
            value={max}
            onChange={(e) => handleMaxChange(e.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
            min={0}
            className="
              w-full pl-8 pr-3 py-2.5 min-h-[44px]
              bg-[#f2ebe2]
              border border-[#d4c4b0] rounded-xl
              text-[#451a03] placeholder:text-[#92400e]
              focus:outline-none focus:border-amber-800/40 focus:ring-1 focus:ring-amber-800/15
              transition-all duration-200
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
        </div>
      </div>
    </fieldset>
  )
}
