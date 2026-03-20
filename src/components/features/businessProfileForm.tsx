'use client'

import { useState, useEffect } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Business } from '@/types/business'
import { getBusinessById, updateBusiness } from '@/lib/mock-data/businesses'

// US States for dropdown
const US_STATES = [
  { value: 'TX', label: 'Texas' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'FL', label: 'Florida' },
  { value: 'IL', label: 'Illinois' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'GA', label: 'Georgia' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'CO', label: 'Colorado' },
  { value: 'WA', label: 'Washington' },
  { value: 'NV', label: 'Nevada' },
]

interface FormData {
  name: string
  description: string
  logoUrl: string
  coverImageUrl: string
  address: string
  city: string
  state: string
  zipCode: string
  locationArea: string
  phone: string
  email: string
  website: string
}

interface FormErrors {
  name?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  email?: string
}

interface BusinessProfileFormProps {
  businessId: string
}

export function BusinessProfileForm({ businessId }: BusinessProfileFormProps) {
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    logoUrl: '',
    coverImageUrl: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    locationArea: '',
    phone: '',
    email: '',
    website: '',
  })

  // Load business data
  useEffect(() => {
    const loadBusiness = () => {
      const biz = getBusinessById(businessId)
      if (biz) {
        setBusiness(biz)
        setFormData({
          name: biz.name || '',
          description: biz.description || '',
          logoUrl: biz.logoUrl || '',
          coverImageUrl: biz.coverImageUrl || '',
          address: biz.address || '',
          city: biz.city || '',
          state: biz.state || '',
          zipCode: biz.zipCode || '',
          locationArea: biz.locationArea || '',
          phone: biz.phone || '',
          email: biz.email || '',
          website: biz.website || '',
        })
      }
      setIsLoading(false)
    }

    loadBusiness()
  }, [businessId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Clear error on change
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }

    if (!formData.state) {
      newErrors.state = 'State is required'
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'Zip code is required'
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode.trim())) {
      newErrors.zipCode = 'Enter a valid zip code'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else {
      const digitsOnly = formData.phone.replace(/\D/g, '')
      if (digitsOnly.length < 10) {
        newErrors.phone = 'Enter a valid phone number (at least 10 digits)'
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Enter a valid email address'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)
    setSaveMessage(null)

    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    const updated = updateBusiness(businessId, {
      name: formData.name.trim(),
      description: formData.description.trim(),
      logoUrl: formData.logoUrl.trim() || undefined,
      coverImageUrl: formData.coverImageUrl.trim() || undefined,
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state,
      zipCode: formData.zipCode.trim(),
      locationArea: formData.locationArea.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      website: formData.website.trim() || undefined,
      latitude: business?.latitude || 0,
      longitude: business?.longitude || 0,
    })

    if (updated) {
      setBusiness(updated)
      setSaveMessage('Changes saved successfully')
      setTimeout(() => setSaveMessage(null), 3000)
    }

    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-brand-primary" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    )
  }

  if (!business) {
    return (
      <Card className="p-6">
        <p className="text-text-secondary text-center">Business not found</p>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Business Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Business Information
        </h3>
        <div className="space-y-4">
          <Input
            label="Business name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Radiant Aesthetics"
            error={errors.name}
            disabled={isSaving}
            required
          />

          <div className="w-full">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell customers about your medspa..."
              rows={3}
              disabled={isSaving}
              className="
                w-full px-4 py-2.5
                bg-glass-bg backdrop-blur-md
                border border-glass-border rounded-xl
                text-text-primary placeholder:text-text-muted
                transition-all duration-200
                hover:border-glass-border-hover
                focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
              "
            />
          </div>

          <Input
            label="Logo URL"
            name="logoUrl"
            type="url"
            value={formData.logoUrl}
            onChange={handleChange}
            placeholder="https://example.com/logo.png"
            disabled={isSaving}
          />
          {formData.logoUrl && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Preview:</span>
              <img
                src={formData.logoUrl}
                alt="Logo preview"
                className="h-12 w-12 object-cover rounded-lg border border-glass-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          <Input
            label="Cover Image URL"
            name="coverImageUrl"
            type="url"
            value={formData.coverImageUrl}
            onChange={handleChange}
            placeholder="https://example.com/cover.jpg"
            disabled={isSaving}
          />
          {formData.coverImageUrl && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">Preview:</span>
              <img
                src={formData.coverImageUrl}
                alt="Cover preview"
                className="h-32 w-full object-cover rounded-lg border border-glass-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Section 2: Location */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Location</h3>
        <div className="space-y-4">
          <Input
            label="Street address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Main Street, Suite 100"
            error={errors.address}
            disabled={isSaving}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="Austin"
              error={errors.city}
              disabled={isSaving}
              required
            />

            <div className="w-full">
              <label
                htmlFor="state"
                className="block text-sm font-medium text-text-secondary mb-1.5"
              >
                State <span className="text-error-text">*</span>
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={isSaving}
                className={`
                  w-full px-4 py-2.5
                  bg-glass-bg backdrop-blur-md
                  border rounded-xl
                  text-text-primary
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-brand-primary/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    errors.state
                      ? 'border-error/50 focus:border-error'
                      : 'border-glass-border hover:border-glass-border-hover focus:border-brand-primary/50'
                  }
                `}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.state && (
                <p className="mt-1.5 text-xs text-error-text">{errors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Zip code"
              name="zipCode"
              type="text"
              value={formData.zipCode}
              onChange={handleChange}
              placeholder="78701"
              error={errors.zipCode}
              disabled={isSaving}
              required
            />

            <Input
              label="Location area"
              name="locationArea"
              type="text"
              value={formData.locationArea}
              onChange={handleChange}
              placeholder="e.g., Downtown, North Side"
              disabled={isSaving}
            />
          </div>
        </div>
      </Card>

      {/* Section 3: Contact */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Contact Information
        </h3>
        <div className="space-y-4">
          <Input
            label="Business phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(512) 555-0123"
            error={errors.phone}
            disabled={isSaving}
            required
          />

          <Input
            label="Business email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="contact@yourbusiness.com"
            error={errors.email}
            disabled={isSaving}
            required
          />

          <Input
            label="Website"
            name="website"
            type="url"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://www.yourbusiness.com"
            disabled={isSaving}
          />
        </div>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <Button
          type="submit"
          size="lg"
          isLoading={isSaving}
          disabled={isSaving}
        >
          Save Changes
        </Button>
        {saveMessage && (
          <span className="text-sm text-success-text flex items-center gap-1">
            <CheckCircle size={16} weight="fill" />
            {saveMessage}
          </span>
        )}
      </div>
    </form>
  )
}
