'use client'

import { ArrowLeft, FloppyDisk, Sparkle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createDeal, updateDeal } from '@/lib/mock-data/deals'
import type { Deal, TreatmentCategory } from '@/types/deal'

const categories: { value: TreatmentCategory; label: string }[] = [
  { value: 'botox', label: 'Botox' },
  { value: 'fillers', label: 'Fillers' },
  { value: 'facials', label: 'Facials' },
  { value: 'laser', label: 'Laser' },
  { value: 'body', label: 'Body' },
  { value: 'skincare', label: 'Skincare' },
]

interface DealFormData {
  title: string
  description: string
  category: TreatmentCategory
  originalPrice: string
  dealPrice: string
  unit: string
  minUnits: string
  maxUnits: string
  validFrom: string
  validUntil: string
  termsAndConditions: string
  imageUrl: string
  isFeatured: boolean
  isActive: boolean
}

interface FormErrors {
  title?: string
  description?: string
  category?: string
  originalPrice?: string
  dealPrice?: string
  unit?: string
  validFrom?: string
  validUntil?: string
  termsAndConditions?: string
}

interface DealFormProps {
  businessId: string
  existingDeal?: Deal
  mode: 'create' | 'edit'
}

function getInitialFormData(deal?: Deal): DealFormData {
  if (deal) {
    return {
      title: deal.title,
      description: deal.description,
      category: deal.category,
      originalPrice: deal.originalPrice.toString(),
      dealPrice: deal.dealPrice.toString(),
      unit: deal.unit,
      minUnits: deal.minUnits?.toString() || '',
      maxUnits: deal.maxUnits?.toString() || '',
      validFrom: deal.validFrom.split('T')[0],
      validUntil: deal.validUntil.split('T')[0],
      termsAndConditions: deal.termsAndConditions,
      imageUrl: deal.imageUrl || '',
      isFeatured: deal.isFeatured,
      isActive: deal.isActive,
    }
  }

  // Default values for new deal
  const today = new Date()
  const threeMonthsLater = new Date(today)
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)

  return {
    title: '',
    description: '',
    category: 'botox',
    originalPrice: '',
    dealPrice: '',
    unit: 'per unit',
    minUnits: '',
    maxUnits: '',
    validFrom: today.toISOString().split('T')[0],
    validUntil: threeMonthsLater.toISOString().split('T')[0],
    termsAndConditions: '',
    imageUrl: '',
    isFeatured: false,
    isActive: true,
  }
}

export function DealForm({ businessId, existingDeal, mode }: DealFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<DealFormData>(() =>
    getInitialFormData(existingDeal),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')

  // Update form when existingDeal changes (for edit mode)
  useEffect(() => {
    if (existingDeal) {
      setFormData(getInitialFormData(existingDeal))
    }
  }, [existingDeal])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error for this field when user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Title required
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    // Description required
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    // Original price required and must be a number
    const originalPrice = Number.parseFloat(formData.originalPrice)
    if (
      !formData.originalPrice ||
      Number.isNaN(originalPrice) ||
      originalPrice <= 0
    ) {
      newErrors.originalPrice = 'Original price must be a positive number'
    }

    // Deal price required and must be less than original
    const dealPrice = Number.parseFloat(formData.dealPrice)
    if (!formData.dealPrice || Number.isNaN(dealPrice) || dealPrice <= 0) {
      newErrors.dealPrice = 'Deal price must be a positive number'
    } else if (!Number.isNaN(originalPrice) && dealPrice >= originalPrice) {
      newErrors.dealPrice = 'Deal price must be less than original price'
    }

    // Unit required
    if (!formData.unit.trim()) {
      newErrors.unit = 'Unit is required'
    }

    // Valid dates
    if (!formData.validFrom) {
      newErrors.validFrom = 'Start date is required'
    }
    if (!formData.validUntil) {
      newErrors.validUntil = 'End date is required'
    }
    if (
      formData.validFrom &&
      formData.validUntil &&
      formData.validFrom > formData.validUntil
    ) {
      newErrors.validUntil = 'End date must be after start date'
    }

    // Terms required
    if (!formData.termsAndConditions.trim()) {
      newErrors.termsAndConditions = 'Terms and conditions are required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      const originalPrice = Number.parseFloat(formData.originalPrice)
      const dealPrice = Number.parseFloat(formData.dealPrice)
      const discountPercent = Math.round(
        ((originalPrice - dealPrice) / originalPrice) * 100,
      )

      const dealData = {
        businessId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        originalPrice,
        dealPrice,
        discountPercent,
        unit: formData.unit.trim(),
        minUnits: formData.minUnits
          ? Number.parseInt(formData.minUnits, 10)
          : undefined,
        maxUnits: formData.maxUnits
          ? Number.parseInt(formData.maxUnits, 10)
          : undefined,
        validFrom: `${formData.validFrom}T00:00:00Z`,
        validUntil: `${formData.validUntil}T23:59:59Z`,
        termsAndConditions: formData.termsAndConditions.trim(),
        imageUrl: formData.imageUrl.trim() || undefined,
        isFeatured: formData.isFeatured,
        isActive: formData.isActive,
      }

      if (mode === 'create') {
        createDeal(dealData)
      } else if (existingDeal) {
        updateDeal(existingDeal.id, dealData)
      }

      setSubmitStatus('success')

      // Redirect after short delay
      setTimeout(() => {
        router.push('/business/dashboard/deals')
      }, 1000)
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/business/dashboard/deals')}
        >
          <ArrowLeft size={20} weight="light" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#451a03]">
            {mode === 'create' ? 'Create New Deal' : 'Edit Deal'}
          </h1>
          <p className="text-[#78350f] mt-1">
            {mode === 'create'
              ? 'Add a new special offer for your customers'
              : 'Update your deal details'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <Input
              label="Deal Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Botox Special"
              error={errors.title}
            />

            <div className="w-full">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-[#78350f] mb-1.5"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your deal..."
                rows={3}
                className={`
                  w-full px-4 py-2.5
                  bg-[#f2ebe2]
                  border rounded-xl
                  text-[#451a03] placeholder:text-[#92400e]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-amber-800/40
                  resize-none
                  ${
                    errors.description
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[#d4c4b0] hover:border-[#c4b09a] focus:border-amber-800/40'
                  }
                `}
              />
              {errors.description && (
                <p className="mt-1.5 text-xs text-red-600">
                  {errors.description}
                </p>
              )}
            </div>

            <div className="w-full">
              <label
                htmlFor="category"
                className="block text-sm font-medium text-[#78350f] mb-1.5"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="
                  w-full px-4 py-2.5
                  bg-[#f2ebe2]
                  border border-[#d4c4b0] hover:border-[#c4b09a]
                  rounded-xl
                  text-[#451a03]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800/40
                "
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Original Price"
              name="originalPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.originalPrice}
              onChange={handleChange}
              placeholder="e.g., 14"
              error={errors.originalPrice}
            />

            <Input
              label="Deal Price"
              name="dealPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.dealPrice}
              onChange={handleChange}
              placeholder="e.g., 10"
              error={errors.dealPrice}
            />

            <Input
              label="Unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="e.g., per unit, per session"
              error={errors.unit}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Min Units"
                name="minUnits"
                type="number"
                min="0"
                value={formData.minUnits}
                onChange={handleChange}
                placeholder="Optional"
                hint="Minimum purchase"
              />

              <Input
                label="Max Units"
                name="maxUnits"
                type="number"
                min="0"
                value={formData.maxUnits}
                onChange={handleChange}
                placeholder="Optional"
                hint="Maximum purchase"
              />
            </div>
          </div>

          {/* Discount Preview */}
          {formData.originalPrice && formData.dealPrice && (
            <div className="mt-4 p-3 bg-amber-800/8 rounded-xl">
              <p className="text-sm text-amber-800">
                <Sparkle size={16} weight="fill" className="inline mr-1" />
                {Math.round(
                  ((Number.parseFloat(formData.originalPrice) -
                    Number.parseFloat(formData.dealPrice)) /
                    Number.parseFloat(formData.originalPrice)) *
                    100,
                )}
                % discount
              </p>
            </div>
          )}
        </Card>

        {/* Validity */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Validity Period
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valid From"
              name="validFrom"
              type="date"
              value={formData.validFrom}
              onChange={handleChange}
              error={errors.validFrom}
            />

            <Input
              label="Valid Until"
              name="validUntil"
              type="date"
              value={formData.validUntil}
              onChange={handleChange}
              error={errors.validUntil}
            />
          </div>
        </Card>

        {/* Terms and Image */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Additional Details
          </h2>
          <div className="space-y-4">
            <div className="w-full">
              <label
                htmlFor="termsAndConditions"
                className="block text-sm font-medium text-[#78350f] mb-1.5"
              >
                Terms & Conditions
              </label>
              <textarea
                id="termsAndConditions"
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleChange}
                placeholder="e.g., New clients only. Cannot be combined with other offers."
                rows={3}
                className={`
                  w-full px-4 py-2.5
                  bg-[#f2ebe2]
                  border rounded-xl
                  text-[#451a03] placeholder:text-[#92400e]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-amber-800/40
                  resize-none
                  ${
                    errors.termsAndConditions
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[#d4c4b0] hover:border-[#c4b09a] focus:border-amber-800/40'
                  }
                `}
              />
              {errors.termsAndConditions && (
                <p className="mt-1.5 text-xs text-red-600">
                  {errors.termsAndConditions}
                </p>
              )}
            </div>

            <Input
              label="Image URL"
              name="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              hint="Optional cover image for your deal"
            />
          </div>
        </Card>

        {/* Settings */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">
            Settings
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-5 h-5 rounded border-[#d4c4b0] bg-[#f2ebe2] text-amber-800 focus:ring-amber-800/40"
              />
              <div>
                <p className="font-medium text-[#451a03]">Active</p>
                <p className="text-sm text-[#78350f]">
                  Deal will be visible to customers when active
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isFeatured"
                checked={formData.isFeatured}
                onChange={handleChange}
                className="w-5 h-5 rounded border-[#d4c4b0] bg-[#f2ebe2] text-amber-800 focus:ring-amber-800/40"
              />
              <div>
                <p className="font-medium text-[#451a03]">Featured</p>
                <p className="text-sm text-[#78350f]">
                  Featured deals appear at the top of search results
                </p>
              </div>
            </label>
          </div>
        </Card>

        {/* Submit Status */}
        {submitStatus === 'success' && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-green-400">
              Deal {mode === 'create' ? 'created' : 'updated'} successfully!
              Redirecting...
            </p>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-600">
              Failed to {mode === 'create' ? 'create' : 'update'} deal. Please
              try again.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/business/dashboard/deals')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FloppyDisk size={20} weight="light" />
            {mode === 'create' ? 'Create Deal' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
