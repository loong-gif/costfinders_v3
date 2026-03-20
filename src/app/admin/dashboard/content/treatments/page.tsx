'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  CaretLeft,
  Plus,
  FirstAidKit,
  MagnifyingGlass,
  PencilSimple,
  X,
  Check,
  TrendUp,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TreatmentCategory } from '@/types/deal'
import {
  getTreatments,
  getTreatmentsByCategory,
  createTreatment,
  updateTreatment,
  toggleTreatmentStatus,
  getTreatmentStats,
  type Treatment,
} from '@/lib/mock-data/treatments'
import { getCategories } from '@/lib/mock-data/categories'

type FilterOption = 'all' | TreatmentCategory

const categoryColors: Record<TreatmentCategory, string> = {
  botox: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  fillers: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  facials: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  laser: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  body: 'bg-green-500/10 text-green-400 border-green-500/20',
  skincare: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

export default function TreatmentsManagementPage() {
  const categories = getCategories()
  const [treatments, setTreatments] = useState(() => getTreatments())
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: 'botox' as TreatmentCategory,
    averagePrice: 0,
    popularity: 50,
  })

  const stats = useMemo(() => getTreatmentStats(), [treatments])

  const filteredTreatments = useMemo(() => {
    let filtered = treatments

    // Filter by category
    if (activeFilter !== 'all') {
      filtered = filtered.filter((t) => t.categoryId === activeFilter)
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      )
    }

    // Sort by popularity
    return filtered.sort((a, b) => b.popularity - a.popularity)
  }, [treatments, activeFilter, searchQuery])

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const refreshTreatments = useCallback(() => {
    setTreatments(getTreatments())
  }, [])

  const handleToggleStatus = useCallback(
    (id: string) => {
      const updated = toggleTreatmentStatus(id)
      if (updated) {
        refreshTreatments()
        showFeedback(
          `${updated.name} ${updated.isActive ? 'activated' : 'deactivated'}`
        )
      }
    },
    [refreshTreatments, showFeedback]
  )

  const handleStartEdit = useCallback((treatment: Treatment) => {
    setEditingId(treatment.id)
    setFormData({
      name: treatment.name,
      description: treatment.description,
      categoryId: treatment.categoryId,
      averagePrice: treatment.averagePrice,
      popularity: treatment.popularity,
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAddingNew(false)
    setFormData({
      name: '',
      description: '',
      categoryId: 'botox',
      averagePrice: 0,
      popularity: 50,
    })
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!formData.name.trim()) return

    if (editingId) {
      const updated = updateTreatment(editingId, {
        name: formData.name,
        description: formData.description,
        categoryId: formData.categoryId,
        averagePrice: formData.averagePrice,
        popularity: formData.popularity,
      })
      if (updated) {
        showFeedback(`${updated.name} updated`)
      }
    }
    refreshTreatments()
    handleCancelEdit()
  }, [editingId, formData, refreshTreatments, showFeedback, handleCancelEdit])

  const handleAddNew = useCallback(() => {
    if (!formData.name.trim()) return

    const slug = formData.name.toLowerCase().replace(/\s+/g, '-')
    const newTreatment = createTreatment({
      name: formData.name,
      slug,
      description: formData.description,
      categoryId: formData.categoryId,
      averagePrice: formData.averagePrice,
      popularity: formData.popularity,
      isActive: true,
    })
    refreshTreatments()
    showFeedback(`${newTreatment.name} created`)
    handleCancelEdit()
  }, [formData, refreshTreatments, showFeedback, handleCancelEdit])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
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
            <h1 className="text-2xl font-bold text-stone-100">
              Treatment Types
            </h1>
            <p className="text-stone-400 mt-1">
              Manage treatment types across categories
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
          Add Treatment
        </Button>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-400/10 border border-success/20 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">{stats.total}</p>
          <p className="text-sm text-stone-400">Total Treatments</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">{stats.active}</p>
          <p className="text-sm text-stone-400">Active</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">
            {Object.keys(stats.byCategory).filter(
              (k) => stats.byCategory[k as TreatmentCategory] > 0
            ).length}
          </p>
          <p className="text-sm text-stone-400">Categories Used</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">
            {filteredTreatments.length}
          </p>
          <p className="text-sm text-stone-400">Showing</p>
        </Card>
      </div>

      {/* Bulk Actions Hint */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-400 flex items-center gap-2">
        <FirstAidKit size={18} className="text-amber-400" />
        <span>Select multiple treatments to activate/deactivate in bulk</span>
        <Badge variant="info" size="sm">
          Coming Soon
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
          />
          <input
            type="text"
            placeholder="Search treatments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeFilter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter('all')}
          className="gap-2"
        >
          All
          <span
            className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeFilter === 'all' ? 'bg-stone-800' : 'bg-stone-900'
            }`}
          >
            {stats.total}
          </span>
        </Button>
        {categories
          .filter((c) => c.isActive)
          .map((category) => {
            const count = stats.byCategory[category.slug] || 0
            return (
              <Button
                key={category.id}
                variant={activeFilter === category.slug ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveFilter(category.slug)}
                className="gap-2"
              >
                {category.name}
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full ${
                    activeFilter === category.slug ? 'bg-stone-800' : 'bg-stone-900'
                  }`}
                >
                  {count}
                </span>
              </Button>
            )
          })}
      </div>

      {/* Add New Form */}
      {isAddingNew && (
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-100">
              Add New Treatment
            </h3>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-stone-500 hover:text-stone-400"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Treatment name"
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    categoryId: e.target.value as TreatmentCategory,
                  }))
                }
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-400 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description"
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">
                Average Price ($)
              </label>
              <input
                type="number"
                value={formData.averagePrice}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    averagePrice: Number(e.target.value),
                  }))
                }
                placeholder="0"
                min="0"
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">
                Popularity Score (1-100)
              </label>
              <input
                type="number"
                value={formData.popularity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    popularity: Math.min(100, Math.max(1, Number(e.target.value))),
                  }))
                }
                placeholder="50"
                min="1"
                max="100"
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" size="sm" onClick={handleAddNew}>
              Create Treatment
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Treatments Grid/Table */}
      {filteredTreatments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTreatments.map((treatment) => {
            const isEditing = editingId === treatment.id

            return (
              <Card key={treatment.id} variant="glass" padding="md">
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    />
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Description"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    />
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                        <Check size={16} />
                        Save
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                        <X size={16} />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`font-semibold truncate ${
                              treatment.isActive
                                ? 'text-stone-100'
                                : 'text-stone-500'
                            }`}
                          >
                            {treatment.name}
                          </h3>
                          {!treatment.isActive && (
                            <Badge variant="default" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
                            categoryColors[treatment.categoryId]
                          }`}
                        >
                          {categories.find((c) => c.slug === treatment.categoryId)
                            ?.name || treatment.categoryId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(treatment)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-800 transition-colors"
                      >
                        <PencilSimple size={18} />
                      </button>
                    </div>

                    <p
                      className={`text-sm line-clamp-2 ${
                        treatment.isActive
                          ? 'text-stone-400'
                          : 'text-stone-500'
                      }`}
                    >
                      {treatment.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-stone-100 font-semibold">
                          {formatPrice(treatment.averagePrice)}
                        </span>
                        <span className="flex items-center gap-1 text-stone-500">
                          <TrendUp size={14} />
                          {treatment.popularity}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(treatment.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          treatment.isActive ? 'bg-amber-400' : 'bg-stone-900'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            treatment.isActive ? 'translate-x-6' : 'translate-x-1'
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
      ) : (
        <Card variant="glass" padding="lg" className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-400/10 flex items-center justify-center mb-4">
            <FirstAidKit size={32} weight="light" className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-100 mb-2">
            No treatments found
          </h3>
          <p className="text-stone-400">
            {searchQuery
              ? 'Try adjusting your search terms'
              : activeFilter !== 'all'
                ? `No treatments in ${categories.find((c) => c.slug === activeFilter)?.name || activeFilter}`
                : 'Add your first treatment to get started'}
          </p>
        </Card>
      )}
    </div>
  )
}
