'use client'

import { Crosshair, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { AreaFilter } from '@/components/patterns/areaFilter'
import { CityPicker } from '@/components/patterns/cityPicker'
import { useLocation } from '@/lib/context/locationContext'

interface LocationSelectorProps {
  showAreaFilter?: boolean
  compact?: boolean
  onLocationChange?: () => void
}

export function LocationSelector({
  showAreaFilter = true,
  compact = false,
  onLocationChange,
}: LocationSelectorProps) {
  const {
    state,
    cities,
    getAreasForCity,
    detectLocation,
    selectCity,
    selectArea,
  } = useLocation()

  const { current, isLoading, error } = state
  const areas = current.city ? getAreasForCity(current.city.id) : []

  const handleDetectLocation = async () => {
    await detectLocation()
    onLocationChange?.()
  }

  const handleSelectCity = (city: typeof current.city) => {
    if (city) {
      selectCity(city)
      onLocationChange?.()
    }
  }

  const handleSelectArea = (area: typeof current.area) => {
    selectArea(area)
    onLocationChange?.()
  }

  return (
    <div className={`space-y-4 ${compact ? 'space-y-3' : ''}`}>
      {/* Near Me Button */}
      <button
        type="button"
        onClick={handleDetectLocation}
        disabled={isLoading}
        className={`
          w-full flex items-center justify-center gap-2
          px-4 py-3
          bg-amber-800/8 hover:bg-amber-800/15
          border border-amber-800/25 rounded-xl
          text-amber-800 font-medium
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-amber-800/40
          ${compact ? 'py-2.5 text-sm' : ''}
        `}
      >
        {isLoading ? (
          <>
            <SpinnerGap size={20} weight="bold" className="animate-spin" />
            <span>Detecting location...</span>
          </>
        ) : (
          <>
            <Crosshair size={20} weight="bold" />
            <span>Use my location</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg">
          <WarningCircle
            size={18}
            weight="fill"
            className="text-red-600 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#faf5ee]" />
        <span className="text-xs text-[#92400e] uppercase tracking-wider">
          or
        </span>
        <div className="flex-1 h-px bg-[#faf5ee]" />
      </div>

      {/* City Picker */}
      <CityPicker
        cities={cities}
        selectedCity={current.city}
        onSelect={handleSelectCity}
        placeholder="Select a city"
      />

      {/* Area Filter - Only show if enabled and city is selected */}
      {showAreaFilter && current.city && areas.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#78350f]">Filter by area:</span>
          <AreaFilter
            areas={areas}
            selectedArea={current.area}
            onSelect={handleSelectArea}
          />
        </div>
      )}

      {/* Current Selection Info */}
      {current.type === 'detected' && current.coordinates && (
        <p className="text-xs text-[#92400e] text-center">
          Detected nearest city based on your coordinates
        </p>
      )}
    </div>
  )
}
