'use client'

import { Check, PencilSimple, Plus, Spinner, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type ContentCategory,
  createCategoryAction,
  getCategoriesAction,
  toggleCategoryAction,
  updateCategoryAction,
} from '@/lib/actions/admin-content'

export default function CategoriesManagementPage() {
  const [categories, setCategories] = useState<ContentCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  // Form state for new/edit
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  })

  const showFeedback = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      setFeedbackMessage({ text, type })
      setTimeout(() => setFeedbackMessage(null), 3000)
    },
    [],
  )

  const loadCategories = useCallback(async () => {
    const result = await getCategoriesAction()
    if (result.success && result.categories) {
      setCategories(result.categories)
    } else if (result.error) {
      showFeedback(result.error, 'error')
    }
    setIsLoading(false)
  }, [showFeedback])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const handleToggleStatus = useCallback(
    async (id: string, currentActive: boolean) => {
      const result = await toggleCategoryAction(id, !currentActive)
      if (result.success) {
        await loadCategories()
        showFeedback(`Category ${currentActive ? 'deactivated' : 'activated'}`)
      } else {
        showFeedback(result.error ?? 'Failed to toggle status', 'error')
      }
    },
    [loadCategories, showFeedback],
  )

  const handleStartEdit = useCallback((category: ContentCategory) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      slug: category.slug,
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAddingNew(false)
    setFormData({ name: '', slug: '' })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!formData.name.trim() || !editingId) return

    setIsSaving(true)
    const result = await updateCategoryAction(editingId, {
      name: formData.name,
      slug: formData.slug,
    })

    if (result.success) {
      await loadCategories()
      showFeedback('Category updated')
      handleCancelEdit()
    } else {
      showFeedback(result.error ?? 'Failed to update category', 'error')
    }
    setIsSaving(false)
  }, [editingId, formData, loadCategories, showFeedback, handleCancelEdit])

  const handleAddNew = useCallback(async () => {
    if (!formData.name.trim() || !formData.slug.trim()) return

    setIsSaving(true)
    const result = await createCategoryAction(formData.name, formData.slug)

    if (result.success) {
      await loadCategories()
      showFeedback('Category created')
      handleCancelEdit()
    } else {
      showFeedback(result.error ?? 'Failed to create category', 'error')
    }
    setIsSaving(false)
  }, [formData, loadCategories, showFeedback, handleCancelEdit])

  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }, [])

  const stats = {
    total: categories.length,
    active: categories.filter((c) => c.is_active).length,
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
      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          className="gap-2"
          onClick={() => setIsAddingNew(true)}
        >
          <Plus size={18} />
          Add Category
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
      <div className="grid grid-cols-2 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.total}</p>
          <p className="text-sm text-[#78350f]">Total Categories</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.active}</p>
          <p className="text-sm text-[#78350f]">Active</p>
        </Card>
      </div>

      {/* Add New Form */}
      {isAddingNew && (
        <Card variant="glass" padding="lg">
          <h3 className="text-lg font-semibold text-[#451a03] mb-4">
            Add New Category
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: generateSlug(name),
                  }))
                }}
                placeholder="Category name"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="category-slug"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddNew}
                isLoading={isSaving}
                disabled={!formData.name.trim() || !formData.slug.trim()}
              >
                Create Category
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Categories List */}
      <div className="space-y-3">
        {categories.map((category) => {
          const isEditing = editingId === category.id

          return (
            <Card key={category.id} variant="glass" padding="md">
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#78350f] mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78350f] mb-1">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          slug: e.target.value,
                        }))
                      }
                      className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                    />
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
                  {/* Order badge */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-800/8 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-800">
                      {category.display_order}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-semibold ${
                          category.is_active
                            ? 'text-[#451a03]'
                            : 'text-[#92400e]'
                        }`}
                      >
                        {category.name}
                      </h3>
                      <span className="text-xs text-[#92400e] font-mono">
                        /{category.slug}
                      </span>
                      {!category.is_active && (
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
                      onClick={() => handleStartEdit(category)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#78350f] hover:bg-[#faf5ee] transition-colors"
                    >
                      <PencilSimple size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleStatus(category.id, category.is_active)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        category.is_active ? 'bg-amber-800' : 'bg-[#f2ebe2]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          category.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {categories.length === 0 && (
          <Card variant="glass" padding="lg" className="text-center">
            <p className="text-[#78350f]">
              No categories found. Add one to get started.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
