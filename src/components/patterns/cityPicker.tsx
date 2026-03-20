'use client'

import {
  CaretDown,
  Check,
  MagnifyingGlass,
  MapPin,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { City } from '@/types/location'

interface CityPickerProps {
  cities: City[]
  selectedCity: City | null
  onSelect: (city: City) => void
  placeholder?: string
}

export function CityPicker({
  cities,
  selectedCity,
  onSelect,
  placeholder = 'Select a city',
}: CityPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredCities = cities.filter((city) => {
    const query = searchQuery.toLowerCase()
    return (
      city.name.toLowerCase().includes(query) ||
      city.state.toLowerCase().includes(query) ||
      city.stateCode.toLowerCase().includes(query)
    )
  })

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
      setSearchQuery('')
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClickOutside])

  const handleSelect = (city: City) => {
    onSelect(city)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          px-4 py-2.5
          bg-[#f2ebe2]
          border border-[#d4c4b0] rounded-xl
          text-left
          transition-all duration-200
          hover:border-[#c4b09a]
          focus:outline-none focus:border-amber-800/40 focus:ring-1 focus:ring-amber-800/15
          ${isOpen ? 'border-amber-800/40 ring-1 ring-amber-800/15' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin
            size={18}
            weight={selectedCity ? 'fill' : 'regular'}
            className="text-amber-800 flex-shrink-0"
          />
          {selectedCity ? (
            <span className="text-[#451a03] truncate">
              {selectedCity.name}, {selectedCity.stateCode}
            </span>
          ) : (
            <span className="text-[#92400e]">{placeholder}</span>
          )}
        </div>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-[#92400e] flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`
            absolute z-50 w-full mt-2
            bg-[#f2ebe2]
            border border-[#d4c4b0] rounded-xl
            shadow-elevated
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[#d4c4b0]">
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cities..."
                className={`
                  w-full pl-9 pr-4 py-2
                  bg-[#f2ebe2]
                  border border-[#d4c4b0] rounded-lg
                  text-sm text-[#451a03] placeholder:text-[#92400e]
                  focus:outline-none focus:border-amber-800/40
                `}
              />
            </div>
          </div>

          {/* City List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCities.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#92400e] text-center">
                No cities found
              </div>
            ) : (
              filteredCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelect(city)}
                  className={`
                    w-full flex items-center justify-between gap-2
                    px-4 py-2.5
                    text-left text-sm
                    transition-colors duration-150
                    ${
                      selectedCity?.id === city.id
                        ? 'bg-amber-800/8 text-amber-800'
                        : 'text-[#451a03] hover:bg-[#faf5ee]'
                    }
                  `}
                >
                  <span>
                    {city.name}, {city.stateCode}
                  </span>
                  {selectedCity?.id === city.id && (
                    <Check size={16} weight="bold" className="flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
