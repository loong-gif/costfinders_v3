'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
  // Business details
  name: string
  description: string
  website: string
  // Location
  address: string
  city: string
  state: string
  zipCode: string
  locationArea: string
  // Contact
  phone: string
  email: string
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

interface CreateBusinessFormProps {
  onSubmit: (data: FormData) => void
  isLoading?: boolean
  defaultEmail?: string
}

export function CreateBusinessForm({
  onSubmit,
  isLoading = false,
  defaultEmail = '',
}: CreateBusinessFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    locationArea: '',
    phone: '',
    email: defaultEmail,
  })

  const [errors, setErrors] = useState<FormErrors>({})

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

    // Business name required
    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required'
    }

    // Address required
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }

    // City required
    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }

    // State required
    if (!formData.state) {
      newErrors.state = 'State is required'
    }

    // Zip code required
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'Zip code is required'
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode.trim())) {
      newErrors.zipCode = 'Enter a valid zip code'
    }

    // Phone required and valid
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else {
      const digitsOnly = formData.phone.replace(/\D/g, '')
      if (digitsOnly.length < 10) {
        newErrors.phone = 'Enter a valid phone number (at least 10 digits)'
      }
    }

    // Email required and valid
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Business Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[#451a03] mb-4">
          Business Details
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
            disabled={isLoading}
            required
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
              placeholder="Tell customers about your medspa..."
              rows={3}
              disabled={isLoading}
              className="
                w-full px-4 py-2.5
                bg-[#f2ebe2]
                border border-[#d4c4b0] rounded-xl
                text-[#451a03] placeholder:text-[#92400e]
                transition-all duration-200
                hover:border-[#c4b09a]
                focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800/40
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
              "
            />
          </div>

          <Input
            label="Website"
            name="website"
            type="url"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://www.yourbusiness.com"
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Section 2: Location */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[#451a03] mb-4">Location</h3>
        <div className="space-y-4">
          <Input
            label="Street address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Main Street, Suite 100"
            error={errors.address}
            disabled={isLoading}
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
              disabled={isLoading}
              required
            />

            <div className="w-full">
              <label
                htmlFor="state"
                className="block text-sm font-medium text-[#78350f] mb-1.5"
              >
                State <span className="text-red-600">*</span>
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={isLoading}
                className={`
                  w-full px-4 py-2.5
                  bg-[#f2ebe2]
                  border rounded-xl
                  text-[#451a03]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-amber-800/40
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    errors.state
                      ? 'border-red-400/50 focus:border-red-400'
                      : 'border-[#d4c4b0] hover:border-[#c4b09a] focus:border-amber-800/40'
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
                <p className="mt-1.5 text-xs text-red-600">{errors.state}</p>
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
              disabled={isLoading}
              required
            />

            <Input
              label="Location area"
              name="locationArea"
              type="text"
              value={formData.locationArea}
              onChange={handleChange}
              placeholder="e.g., Downtown, North Side"
              disabled={isLoading}
            />
          </div>
        </div>
      </Card>

      {/* Section 3: Contact */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[#451a03] mb-4">
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
            disabled={isLoading}
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
            disabled={isLoading}
            required
          />
        </div>
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={isLoading}
        disabled={isLoading}
      >
        Create Business Listing
      </Button>
    </form>
  )
}
