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
          bg-glass-bg backdrop-blur-md
          border border-glass-border rounded-xl
          text-left
          transition-all duration-200
          hover:border-glass-border-hover
          focus:outline-none focus:ring-2 focus:ring-brand-primary/50
          ${isOpen ? 'border-brand-primary/50 ring-2 ring-brand-primary/50' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin
            size={18}
            weight={selectedCity ? 'fill' : 'regular'}
            className="text-brand-primary flex-shrink-0"
          />
          {selectedCity ? (
            <span className="text-text-primary truncate">
              {selectedCity.name}, {selectedCity.stateCode}
            </span>
          ) : (
            <span className="text-text-muted">{placeholder}</span>
          )}
        </div>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-text-tertiary flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`
            absolute z-50 w-full mt-2
            bg-bg-secondary backdrop-blur-xl
            border border-glass-border rounded-xl
            shadow-elevated
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-glass-border">
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cities..."
                className={`
                  w-full pl-9 pr-4 py-2
                  bg-glass-bg backdrop-blur-md
                  border border-glass-border rounded-lg
                  text-sm text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-brand-primary/50
                `}
              />
            </div>
          </div>

          {/* City List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCities.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-tertiary text-center">
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
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'text-text-primary hover:bg-glass-bg'
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
