'use client'

import {
  ArrowLeft,
  FloppyDisk,
  Image as ImageIcon,
  Sparkle,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  deleteDealImageAction,
  uploadDealImageAction,
} from '@/lib/actions/deal-images'
import {
  createDealAction,
  updateDealAction,
} from '@/lib/actions/deal-management'
import type { TreatmentCategory } from '@/types/deal'
import type { Offer } from '@/types/supabase'

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
  existingDeal?: Offer
  existingDealId?: number
  mode: 'create' | 'edit'
}

function getInitialFormData(deal?: Offer): DealFormData {
  if (deal) {
    return {
      title: deal.service_name ?? '',
      description: deal.offer_raw_text ?? '',
      category: (deal.service_category as TreatmentCategory) ?? 'botox',
      originalPrice: deal.original_price?.toString() ?? '',
      dealPrice: deal.discount_price?.toString() ?? '',
      unit: deal.unit_type ?? '',
      minUnits: deal.min_unit?.toString() ?? '',
      maxUnits: '',
      validFrom: deal.start_date?.split('T')[0] ?? '',
      validUntil: deal.end_date?.split('T')[0] ?? '',
      termsAndConditions: deal.eligibility ?? '',
      imageUrl: '',
      isFeatured: false,
      isActive: true,
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

export function DealForm({ businessId, existingDeal, existingDealId, mode }: DealFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<DealFormData>(() =>
    getInitialFormData(existingDeal),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploadStatus, setImageUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle')
  const [imageError, setImageError] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)

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

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
      if (!allowedTypes.includes(file.type)) {
        setImageError('Invalid file type. Use JPEG, PNG, WebP, or AVIF.')
        return
      }

      // Validate size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setImageError('File too large. Maximum 5MB.')
        return
      }

      setImageError(null)
      setImageFile(file)

      // Generate preview
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    },
    [],
  )

  const handleImageUpload = useCallback(async () => {
    const dealId = existingDealId ?? existingDeal?.id
    if (!imageFile || !dealId) {
      setImageError('Save the deal first, then upload an image.')
      return
    }

    setImageUploadStatus('uploading')
    setImageError(null)

    const formData = new FormData()
    formData.append('image', imageFile)

    const result = await uploadDealImageAction(
      dealId,
      Number(businessId),
      formData,
    )

    if (result.success && result.url) {
      setImageUploadStatus('success')
      setUploadedImageUrl(result.url)
      setImageFile(null)
    } else {
      setImageUploadStatus('error')
      setImageError(result.error ?? 'Upload failed.')
    }
  }, [imageFile, existingDealId, existingDeal?.id, businessId])

  const handleImageDelete = useCallback(async () => {
    const dealId = existingDealId ?? existingDeal?.id
    if (!dealId) return

    setImageUploadStatus('uploading')
    setImageError(null)

    const result = await deleteDealImageAction(dealId, Number(businessId))

    if (result.success) {
      setImagePreview(null)
      setImageFile(null)
      setUploadedImageUrl(null)
      setImageUploadStatus('idle')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } else {
      setImageUploadStatus('error')
      setImageError(result.error ?? 'Delete failed.')
    }
  }, [existingDealId, existingDeal?.id, businessId])

  const handleRemovePreview = useCallback(() => {
    setImagePreview(null)
    setImageFile(null)
    setImageError(null)
    setImageUploadStatus('idle')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

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
      const originalPrice = Number.parseFloat(formData.originalPrice)
      const dealPrice = Number.parseFloat(formData.dealPrice)
      const discountPercent = Math.round(
        ((originalPrice - dealPrice) / originalPrice) * 100,
      )

      // Map form fields to promo_offer_master columns
      const mappedData = {
        service_name: formData.title.trim(),
        service_category: formData.category,
        original_price: originalPrice,
        discount_price: dealPrice,
        discount_percent: discountPercent,
        unit_type: formData.unit.trim(),
        offer_raw_text: formData.description.trim(),
        template_type: 'FIXED_PRICE',
        start_date: formData.validFrom ? `${formData.validFrom}T00:00:00Z` : undefined,
        end_date: formData.validUntil ? `${formData.validUntil}T23:59:59Z` : undefined,
        min_unit: formData.minUnits || undefined,
      }

      let result: { success: boolean; error?: string }

      if (mode === 'create') {
        result = await createDealAction(Number(businessId), mappedData)
      } else {
        const dealId = existingDealId ?? existingDeal?.id
        if (!dealId) {
          setSubmitStatus('error')
          return
        }
        result = await updateDealAction(Number(dealId), Number(businessId), mappedData)
      }

      if (!result.success) {
        setSubmitStatus('error')
        return
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

            {/* Deal Image Upload */}
            <div className="w-full">
              <label className="block text-sm font-medium text-[#78350f] mb-1.5">
                Deal Image
              </label>

              {/* Preview area */}
              {(imagePreview || uploadedImageUrl) ? (
                <div className="relative group rounded-xl overflow-hidden border border-[#d4c4b0] bg-[#f2ebe2]">
                  <img
                    src={imagePreview ?? uploadedImageUrl ?? ''}
                    alt="Deal preview"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    {uploadedImageUrl && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={handleImageDelete}
                        disabled={imageUploadStatus === 'uploading'}
                      >
                        <Trash size={16} weight="light" />
                        Delete
                      </Button>
                    )}
                    {!uploadedImageUrl && imagePreview && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleRemovePreview}
                      >
                        <Trash size={16} weight="light" />
                        Remove
                      </Button>
                    )}
                  </div>
                  {/* Upload status badge */}
                  {uploadedImageUrl && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-600/90 text-white text-xs rounded-lg">
                      Uploaded
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="
                    w-full h-48 flex flex-col items-center justify-center gap-3
                    bg-[#f2ebe2] border-2 border-dashed border-[#d4c4b0]
                    rounded-xl cursor-pointer
                    hover:border-amber-800/40 hover:bg-[#ede5da]
                    transition-all duration-200
                  "
                >
                  <ImageIcon size={32} weight="light" className="text-[#92400e]" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#78350f]">
                      Click to select an image
                    </p>
                    <p className="text-xs text-[#92400e] mt-1">
                      JPEG, PNG, WebP, or AVIF (max 5MB)
                    </p>
                  </div>
                </button>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Upload button (shown when file is selected but not yet uploaded) */}
              {imageFile && !uploadedImageUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleImageUpload}
                    disabled={imageUploadStatus === 'uploading'}
                    isLoading={imageUploadStatus === 'uploading'}
                  >
                    <UploadSimple size={16} weight="light" />
                    {imageUploadStatus === 'uploading' ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose different file
                  </Button>
                </div>
              )}

              {/* Change image button when already uploaded */}
              {uploadedImageUrl && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadSimple size={16} weight="light" />
                    Replace image
                  </Button>
                </div>
              )}

              {/* Error message */}
              {imageError && (
                <p className="mt-1.5 text-xs text-red-600">{imageError}</p>
              )}

              {/* Help text */}
              {!imageFile && !uploadedImageUrl && (
                <p className="mt-1.5 text-xs text-[#92400e]">
                  {mode === 'create'
                    ? 'Save the deal first, then you can upload an image.'
                    : 'Optional cover image for your deal'}
                </p>
              )}
            </div>
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
