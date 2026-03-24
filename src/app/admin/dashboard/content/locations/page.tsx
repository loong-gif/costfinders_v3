'use client'

import {
  CaretLeft,
  Check,
  MapPin,
  PencilSimple,
  Plus,
  Spinner,
  X,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type ContentLocation,
  createLocationAction,
  getLocationsAction,
  toggleLocationAction,
  updateLocationAction,
} from '@/lib/actions/admin-content'

export default function LocationsManagementPage() {
  const [locations, setLocations] = useState<ContentLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    stateCode: '',
  })

  const showFeedback = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      setFeedbackMessage({ text, type })
      setTimeout(() => setFeedbackMessage(null), 3000)
    },
    [],
  )

  const loadLocations = useCallback(async () => {
    const result = await getLocationsAction()
    if (result.success && result.locations) {
      setLocations(result.locations)
    } else if (result.error) {
      showFeedback(result.error, 'error')
    }
    setIsLoading(false)
  }, [showFeedback])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const handleToggleStatus = useCallback(
    async (id: string, currentActive: boolean) => {
      const result = await toggleLocationAction(id, !currentActive)
      if (result.success) {
        await loadLocations()
        showFeedback(
          `Location ${currentActive ? 'deactivated' : 'activated'}`,
        )
      } else {
        showFeedback(result.error ?? 'Failed to toggle status', 'error')
      }
    },
    [loadLocations, showFeedback],
  )

  const handleStartEdit = useCallback((location: ContentLocation) => {
    setEditingId(location.id)
    setFormData({
      city: location.city,
      state: location.state,
      stateCode: location.state_code,
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAddingNew(false)
    setFormData({ city: '', state: '', stateCode: '' })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!formData.city.trim() || !editingId) return

    setIsSaving(true)
    const result = await updateLocationAction(editingId, {
      city: formData.city,
      state: formData.state,
      state_code: formData.stateCode,
    })

    if (result.success) {
      await loadLocations()
      showFeedback('Location updated')
      handleCancelEdit()
    } else {
      showFeedback(result.error ?? 'Failed to update location', 'error')
    }
    setIsSaving(false)
  }, [editingId, formData, loadLocations, showFeedback, handleCancelEdit])

  const handleAddNew = useCallback(async () => {
    if (
      !formData.city.trim() ||
      !formData.state.trim() ||
      !formData.stateCode.trim()
    )
      return

    setIsSaving(true)
    const result = await createLocationAction(
      formData.city,
      formData.state,
      formData.stateCode,
    )

    if (result.success) {
      await loadLocations()
      showFeedback('Location created')
      handleCancelEdit()
    } else {
      showFeedback(result.error ?? 'Failed to create location', 'error')
    }
    setIsSaving(false)
  }, [formData, loadLocations, showFeedback, handleCancelEdit])

  // Group locations by state for display
  const locationsByState = locations.reduce<
    Record<string, ContentLocation[]>
  >((acc, loc) => {
    if (!acc[loc.state]) acc[loc.state] = []
    acc[loc.state].push(loc)
    return acc
  }, {})

  const stats = {
    total: locations.length,
    active: locations.filter((l) => l.is_active).length,
    states: Object.keys(locationsByState).length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} className="animate-spin text-amber-800" />
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold text-[#451a03]">
              Service Locations
            </h1>
            <p className="text-[#78350f] mt-1">
              Manage cities and service areas
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="gap-2"
          onClick={() => setIsAddingNew(true)}
        >
          <Plus size={18} />
          Add Location
        </Button>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-600/10 border border-success/20 text-emerald-600'
              : 'bg-red-600/10 border border-red-600/20 text-red-600'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.total}</p>
          <p className="text-sm text-[#78350f]">Total Locations</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.active}</p>
          <p className="text-sm text-[#78350f]">Active</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.states}</p>
          <p className="text-sm text-[#78350f]">States</p>
        </Card>
      </div>

      {/* Add New Form */}
      {isAddingNew && (
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#451a03]">
              Add New Location
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-[#92400e] hover:text-[#78350f]"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                City Name
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
                placeholder="e.g., Chicago"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
                placeholder="e.g., Illinois"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                State Code
              </label>
              <input
                type="text"
                value={formData.stateCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    stateCode: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., IL"
                maxLength={2}
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddNew}
              isLoading={isSaving}
              disabled={
                !formData.city.trim() ||
                !formData.state.trim() ||
                !formData.stateCode.trim()
              }
            >
              Add Location
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddingNew(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Locations grouped by state */}
      {Object.entries(locationsByState).map(([state, stateLocations]) => (
        <div key={state} className="space-y-3">
          <h2 className="text-lg font-semibold text-[#451a03]">{state}</h2>
          <div className="space-y-2">
            {stateLocations.map((location) => {
              const isEditing = editingId === location.id

              return (
                <Card key={location.id} variant="glass" padding="md">
                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#78350f] mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                city: e.target.value,
                              }))
                            }
                            className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#78350f] mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            value={formData.state}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                state: e.target.value,
                              }))
                            }
                            className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#78350f] mb-1">
                            State Code
                          </label>
                          <input
                            type="text"
                            value={formData.stateCode}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                stateCode: e.target.value.toUpperCase(),
                              }))
                            }
                            maxLength={2}
                            className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveEdit}
                          isLoading={isSaving}
                        >
                          <Check size={16} />
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          <X size={16} />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                          location.is_active
                            ? 'bg-amber-800/8'
                            : 'bg-[#f2ebe2] opacity-50'
                        }`}
                      >
                        <MapPin
                          size={20}
                          weight="light"
                          className={
                            location.is_active
                              ? 'text-amber-800'
                              : 'text-[#92400e]'
                          }
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-semibold ${
                              location.is_active
                                ? 'text-[#451a03]'
                                : 'text-[#92400e]'
                            }`}
                          >
                            {location.city}
                          </h3>
                          <span className="text-sm text-[#78350f]">
                            {location.state_code}
                          </span>
                          {!location.is_active && (
                            <Badge variant="default" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(location)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#78350f] hover:bg-[#faf5ee] transition-colors"
                        >
                          <PencilSimple size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(
                              location.id,
                              location.is_active,
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            location.is_active
                              ? 'bg-amber-800'
                              : 'bg-[#f2ebe2]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              location.is_active
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {locations.length === 0 && (
        <Card variant="glass" padding="lg" className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-3">
            <MapPin size={24} weight="light" className="text-amber-800" />
          </div>
          <p className="text-[#78350f]">
            No locations found. Add one to get started.
          </p>
        </Card>
      )}
    </div>
  )
}
