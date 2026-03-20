'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  CaretLeft,
  Plus,
  MapPin,
  Buildings,
  Tag,
  CaretRight,
  X,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { City, LocationArea } from '@/types/location'
import {
  getCities,
  getAreasForCity,
  toggleCityStatus,
  toggleAreaStatus,
  addCity,
  addArea,
  getLocationStats,
  getBusinessCountForCity,
  getDealCountForCity,
} from '@/lib/mock-data/locations'

export default function LocationsManagementPage() {
  const [cities, setCities] = useState(() => getCities())
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [isAddingCity, setIsAddingCity] = useState(false)
  const [isAddingArea, setIsAddingArea] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // City form state
  const [cityForm, setCityForm] = useState({
    name: '',
    state: '',
    stateCode: '',
  })

  // Area form state
  const [areaForm, setAreaForm] = useState({
    name: '',
  })

  const selectedCity = useMemo(() => {
    return cities.find((c) => c.id === selectedCityId) || null
  }, [cities, selectedCityId])

  const selectedCityAreas = useMemo(() => {
    if (!selectedCityId) return []
    return getAreasForCity(selectedCityId)
  }, [selectedCityId])

  const stats = useMemo(() => getLocationStats(), [cities])

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const refreshCities = useCallback(() => {
    setCities(getCities())
  }, [])

  const handleToggleCityStatus = useCallback(
    (id: string) => {
      const updated = toggleCityStatus(id)
      if (updated) {
        refreshCities()
        showFeedback(
          `${updated.name} ${updated.isActive ? 'activated' : 'deactivated'}`
        )
      }
    },
    [refreshCities, showFeedback]
  )

  const handleToggleAreaStatus = useCallback(
    (id: string, areaName: string) => {
      const updated = toggleAreaStatus(id)
      if (updated) {
        // Force re-render by updating selected city
        setSelectedCityId((prev) => prev)
        showFeedback(
          `${areaName} ${updated.isActive !== false ? 'activated' : 'deactivated'}`
        )
      }
    },
    [showFeedback]
  )

  const handleAddCity = useCallback(() => {
    if (!cityForm.name.trim() || !cityForm.state.trim()) return

    const newCity = addCity({
      name: cityForm.name,
      state: cityForm.state,
      stateCode: cityForm.stateCode || cityForm.state.slice(0, 2).toUpperCase(),
      latitude: 0,
      longitude: 0,
      timezone: 'America/Chicago',
      isActive: true,
    })

    refreshCities()
    showFeedback(`${newCity.name} added`)
    setIsAddingCity(false)
    setCityForm({ name: '', state: '', stateCode: '' })
  }, [cityForm, refreshCities, showFeedback])

  const handleAddArea = useCallback(() => {
    if (!areaForm.name.trim() || !selectedCityId) return

    const newArea = addArea({
      cityId: selectedCityId,
      name: areaForm.name,
      latitude: 0,
      longitude: 0,
      radiusMiles: 5,
      isActive: true,
    })

    showFeedback(`${newArea.name} added`)
    setIsAddingArea(false)
    setAreaForm({ name: '' })
    // Force re-render
    setSelectedCityId((prev) => prev)
  }, [areaForm.name, selectedCityId, showFeedback])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard/content">
            <Button variant="ghost" size="sm" className="gap-1">
              <CaretLeft size={18} />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Service Locations
            </h1>
            <p className="text-text-secondary mt-1">
              Manage cities and service areas
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="gap-2"
          onClick={() => setIsAddingCity(true)}
        >
          <Plus size={18} />
          Add City
        </Button>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-success/10 border border-success/20 text-success-text px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-text-primary">{stats.totalCities}</p>
          <p className="text-sm text-text-secondary">Total Cities</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-text-primary">{stats.activeCities}</p>
          <p className="text-sm text-text-secondary">Active Cities</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-text-primary">{stats.totalAreas}</p>
          <p className="text-sm text-text-secondary">Total Areas</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-text-primary">{stats.activeAreas}</p>
          <p className="text-sm text-text-secondary">Active Areas</p>
        </Card>
      </div>

      {/* Add City Form */}
      {isAddingCity && (
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Add New City</h3>
            <button
              type="button"
              onClick={() => setIsAddingCity(false)}
              className="text-text-muted hover:text-text-secondary"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                City Name
              </label>
              <input
                type="text"
                value={cityForm.name}
                onChange={(e) =>
                  setCityForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Chicago"
                className="w-full bg-glass-bg border border-glass-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                State
              </label>
              <input
                type="text"
                value={cityForm.state}
                onChange={(e) =>
                  setCityForm((prev) => ({ ...prev, state: e.target.value }))
                }
                placeholder="e.g., Illinois"
                className="w-full bg-glass-bg border border-glass-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                State Code
              </label>
              <input
                type="text"
                value={cityForm.stateCode}
                onChange={(e) =>
                  setCityForm((prev) => ({
                    ...prev,
                    stateCode: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., IL"
                maxLength={2}
                className="w-full bg-glass-bg border border-glass-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" size="sm" onClick={handleAddCity}>
              Add City
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddingCity(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cities List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Cities</h2>
          <div className="space-y-2">
            {cities.map((city) => {
              const areaCount = getAreasForCity(city.id).length
              const businessCount = getBusinessCountForCity(city.id)
              const dealCount = getDealCountForCity(city.id)
              const isSelected = selectedCityId === city.id

              return (
                <Card
                  key={city.id}
                  variant="glass"
                  padding="md"
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-brand-primary/50'
                      : 'hover:bg-glass-bg-hover'
                  }`}
                  onClick={() => setSelectedCityId(city.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        city.isActive ? 'bg-brand-primary/10' : 'bg-glass-bg'
                      }`}
                    >
                      <MapPin
                        size={20}
                        weight="light"
                        className={
                          city.isActive ? 'text-brand-primary' : 'text-text-muted'
                        }
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ${
                            city.isActive ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {city.name}
                        </h3>
                        <span className="text-sm text-text-secondary">
                          {city.stateCode}
                        </span>
                        {!city.isActive && (
                          <Badge variant="default" size="sm">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {areaCount} areas
                        </span>
                        <span className="flex items-center gap-1">
                          <Buildings size={12} />
                          {businessCount} businesses
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag size={12} />
                          {dealCount} deals
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleCityStatus(city.id)
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          city.isActive ? 'bg-brand-primary' : 'bg-glass-bg'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            city.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <CaretRight
                        size={20}
                        weight="light"
                        className={`text-text-muted transition-transform ${
                          isSelected ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Areas Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              {selectedCity ? `${selectedCity.name} Areas` : 'Select a City'}
            </h2>
            {selectedCity && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => setIsAddingArea(true)}
              >
                <Plus size={16} />
                Add Area
              </Button>
            )}
          </div>

          {selectedCity ? (
            <div className="space-y-2">
              {/* Add Area Form */}
              {isAddingArea && (
                <Card variant="glass" padding="md">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={areaForm.name}
                      onChange={(e) =>
                        setAreaForm({ name: e.target.value })
                      }
                      placeholder="Area name (e.g., Downtown)"
                      className="flex-1 bg-glass-bg border border-glass-border rounded-xl px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    />
                    <Button variant="primary" size="sm" onClick={handleAddArea}>
                      Add
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsAddingArea(false)
                        setAreaForm({ name: '' })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}

              {/* Areas List */}
              {selectedCityAreas.length > 0 ? (
                selectedCityAreas.map((area) => (
                  <Card key={area.id} variant="glass" padding="md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            area.isActive !== false
                              ? 'bg-brand-primary/10'
                              : 'bg-glass-bg'
                          }`}
                        >
                          <MapPin
                            size={16}
                            weight="light"
                            className={
                              area.isActive !== false
                                ? 'text-brand-primary'
                                : 'text-text-muted'
                            }
                          />
                        </div>
                        <div>
                          <p
                            className={`font-medium ${
                              area.isActive !== false
                                ? 'text-text-primary'
                                : 'text-text-muted'
                            }`}
                          >
                            {area.name}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {area.radiusMiles} mile radius
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAreaStatus(area.id, area.name)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          area.isActive !== false
                            ? 'bg-brand-primary'
                            : 'bg-glass-bg'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            area.isActive !== false
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </Card>
                ))
              ) : (
                <Card variant="glass" padding="lg" className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-brand-primary/10 flex items-center justify-center mb-3">
                    <MapPin size={24} weight="light" className="text-brand-primary" />
                  </div>
                  <p className="text-text-secondary">
                    No areas defined for {selectedCity.name}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 gap-1"
                    onClick={() => setIsAddingArea(true)}
                  >
                    <Plus size={16} />
                    Add First Area
                  </Button>
                </Card>
              )}
            </div>
          ) : (
            <Card variant="glass" padding="lg" className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-brand-primary/10 flex items-center justify-center mb-3">
                <MapPin size={24} weight="light" className="text-brand-primary" />
              </div>
              <p className="text-text-secondary">
                Select a city to view and manage its service areas
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
