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
          bg-stone-900
          border border-stone-800 rounded-xl
          text-left
          transition-all duration-200
          hover:border-stone-700
          focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20
          ${isOpen ? 'border-amber-400/50 ring-1 ring-amber-400/20' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin
            size={18}
            weight={selectedCity ? 'fill' : 'regular'}
            className="text-amber-400 flex-shrink-0"
          />
          {selectedCity ? (
            <span className="text-stone-100 truncate">
              {selectedCity.name}, {selectedCity.stateCode}
            </span>
          ) : (
            <span className="text-stone-500">{placeholder}</span>
          )}
        </div>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-stone-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`
            absolute z-50 w-full mt-2
            bg-stone-900
            border border-stone-800 rounded-xl
            shadow-elevated
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-stone-800">
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cities..."
                className={`
                  w-full pl-9 pr-4 py-2
                  bg-stone-900
                  border border-stone-800 rounded-lg
                  text-sm text-stone-100 placeholder:text-stone-500
                  focus:outline-none focus:border-amber-400/50
                `}
              />
            </div>
          </div>

          {/* City List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCities.length === 0 ? (
              <div className="px-4 py-3 text-sm text-stone-500 text-center">
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
                        ? 'bg-amber-400/10 text-amber-400'
                        : 'text-stone-100 hover:bg-stone-800'
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
