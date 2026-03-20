'use client'

import { CaretDown, Check, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LocationArea } from '@/types/location'

interface AreaFilterProps {
  areas: LocationArea[]
  selectedArea: LocationArea | null
  onSelect: (area: LocationArea | null) => void
  disabled?: boolean
}

export function AreaFilter({
  areas,
  selectedArea,
  onSelect,
  disabled = false,
}: AreaFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClickOutside])

  // Return null if no areas available
  if (areas.length === 0) {
    return null
  }

  const handleSelect = (area: LocationArea | null) => {
    onSelect(area)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(null)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button - Pill/Chip Style */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1.5
          px-3 py-1.5
          bg-glass-bg backdrop-blur-md
          border border-glass-border rounded-full
          text-sm
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-glass-border-hover'}
          focus:outline-none focus:ring-2 focus:ring-brand-primary/50
          ${isOpen ? 'border-brand-primary/50 ring-2 ring-brand-primary/50' : ''}
          ${selectedArea ? 'bg-brand-primary/10 border-brand-primary/30' : ''}
        `}
      >
        {selectedArea ? (
          <>
            <span className="text-text-primary">{selectedArea.name}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e as unknown as React.MouseEvent)
                }
              }}
              className="p-0.5 rounded-full hover:bg-glass-bg transition-colors cursor-pointer"
              aria-label="Clear area filter"
            >
              <X size={14} weight="bold" className="text-text-tertiary" />
            </span>
          </>
        ) : (
          <>
            <span className="text-text-secondary">All areas</span>
            <CaretDown
              size={14}
              weight="bold"
              className={`text-text-tertiary transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-2 min-w-48
            bg-bg-secondary backdrop-blur-xl
            border border-glass-border rounded-xl
            shadow-elevated
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
        >
          {/* All Areas Option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              w-full flex items-center justify-between gap-2
              px-4 py-2.5
              text-left text-sm
              transition-colors duration-150
              ${
                selectedArea === null
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-text-primary hover:bg-glass-bg'
              }
            `}
          >
            <span>All areas</span>
            {selectedArea === null && (
              <Check size={16} weight="bold" className="flex-shrink-0" />
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-glass-border" />

          {/* Area List */}
          <div className="max-h-48 overflow-y-auto">
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => handleSelect(area)}
                className={`
                  w-full flex items-center justify-between gap-2
                  px-4 py-2.5
                  text-left text-sm
                  transition-colors duration-150
                  ${
                    selectedArea?.id === area.id
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-text-primary hover:bg-glass-bg'
                  }
                `}
              >
                <span>{area.name}</span>
                {selectedArea?.id === area.id && (
                  <Check size={16} weight="bold" className="flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
