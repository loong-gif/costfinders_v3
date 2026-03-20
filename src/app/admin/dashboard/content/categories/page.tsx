'use client'

import { useState, useCallback } from 'react'
import {
  Plus,
  DotsSixVertical,
  PencilSimple,
  X,
  Check,
  Syringe,
  Drop,
  Sparkle,
  Lightning,
  Person,
  Leaf,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  type Category,
} from '@/lib/mock-data/categories'

// Icon mapping for category icons
const iconMap: Record<string, React.ComponentType<{ size?: number; weight?: 'light' | 'fill'; className?: string }>> = {
  Syringe,
  Drop,
  Sparkle,
  Lightning,
  Person,
  Leaf,
}

const availableIcons = Object.keys(iconMap)

export default function CategoriesManagementPage() {
  const [categories, setCategories] = useState(() => getCategories())
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Form state for new/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Syringe',
  })

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const refreshCategories = useCallback(() => {
    setCategories(getCategories())
  }, [])

  const handleToggleStatus = useCallback(
    (id: string) => {
      const updated = toggleCategoryStatus(id)
      if (updated) {
        refreshCategories()
        showFeedback(
          `${updated.name} ${updated.isActive ? 'activated' : 'deactivated'}`
        )
      }
    },
    [refreshCategories, showFeedback]
  )

  const handleStartEdit = useCallback((category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon,
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAddingNew(false)
    setFormData({ name: '', description: '', icon: 'Syringe' })
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!formData.name.trim()) return

    if (editingId) {
      const updated = updateCategory(editingId, {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
      })
      if (updated) {
        showFeedback(`${updated.name} updated`)
      }
    }
    refreshCategories()
    handleCancelEdit()
  }, [editingId, formData, refreshCategories, showFeedback, handleCancelEdit])

  const handleAddNew = useCallback(() => {
    if (!formData.name.trim()) return

    // Generate a valid slug for the category
    const slug = formData.name.toLowerCase().replace(/\s+/g, '-') as 'botox' | 'fillers' | 'facials' | 'laser' | 'body' | 'skincare'
    const newCat = createCategory({
      name: formData.name,
      slug,
      description: formData.description,
      icon: formData.icon,
      isActive: true,
    })
    refreshCategories()
    showFeedback(`${newCat.name} created`)
    handleCancelEdit()
  }, [formData, refreshCategories, showFeedback, handleCancelEdit])

  const stats = {
    total: categories.length,
    active: categories.filter((c) => c.isActive).length,
    totalDeals: categories.reduce((sum, c) => sum + c.dealCount, 0),
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
        <div className="bg-emerald-600/10 border border-success/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.total}</p>
          <p className="text-sm text-[#78350f]">Total Categories</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.active}</p>
          <p className="text-sm text-[#78350f]">Active</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{stats.totalDeals}</p>
          <p className="text-sm text-[#78350f]">Total Deals</p>
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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Category name"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
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
                placeholder="Category description"
                className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#78350f] mb-1">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {availableIcons.map((iconName) => {
                  const Icon = iconMap[iconName]
                  return (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, icon: iconName }))
                      }
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        formData.icon === iconName
                          ? 'bg-amber-800 text-white'
                          : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                      }`}
                    >
                      <Icon size={20} weight="light" />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={handleAddNew}>
                Create Category
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((category) => {
          const Icon = iconMap[category.icon] || Syringe
          const isEditing = editingId === category.id

          return (
            <Card key={category.id} variant="glass" padding="md">
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
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
                    className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl px-3 py-2 text-sm text-[#451a03] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <div className="flex flex-wrap gap-2">
                    {availableIcons.map((iconName) => {
                      const IconOption = iconMap[iconName]
                      return (
                        <button
                          type="button"
                          key={iconName}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, icon: iconName }))
                          }
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            formData.icon === iconName
                              ? 'bg-amber-800 text-white'
                              : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                          }`}
                        >
                          <IconOption size={16} weight="light" />
                        </button>
                      )
                    })}
                  </div>
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
                <div className="flex items-start gap-4">
                  {/* Drag Handle (visual only) */}
                  <div className="flex-shrink-0 text-[#92400e] cursor-grab">
                    <DotsSixVertical size={20} weight="bold" />
                  </div>

                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      category.isActive
                        ? 'bg-amber-800/8'
                        : 'bg-[#f2ebe2] opacity-50'
                    }`}
                  >
                    <Icon
                      size={24}
                      weight="light"
                      className={
                        category.isActive
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
                          category.isActive
                            ? 'text-[#451a03]'
                            : 'text-[#92400e]'
                        }`}
                      >
                        {category.name}
                      </h3>
                      {!category.isActive && (
                        <Badge variant="default" size="sm">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p
                      className={`text-sm mt-0.5 ${
                        category.isActive
                          ? 'text-[#78350f]'
                          : 'text-[#92400e]'
                      }`}
                    >
                      {category.description}
                    </p>
                    <p className="text-xs text-[#92400e] mt-1">
                      {category.dealCount} deals
                    </p>
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
                      onClick={() => handleToggleStatus(category.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        category.isActive ? 'bg-amber-800' : 'bg-[#f2ebe2]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          category.isActive ? 'translate-x-6' : 'translate-x-1'
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
  )
}
