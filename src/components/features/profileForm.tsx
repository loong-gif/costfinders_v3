'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/authContext'

export function ProfileForm() {
  const { state, updateProfile } = useAuth()
  const { user } = state

  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [city, setCity] = useState(user?.locationCity || '')
  const [locationState, setLocationState] = useState(user?.locationState || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const validatePhone = (value: string): boolean => {
    if (!value.trim()) {
      setPhoneError(null)
      return true
    }
    // Basic phone validation: 10+ digits
    const digitsOnly = value.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      setPhoneError('Please enter a valid phone number (at least 10 digits)')
      return false
    }
    setPhoneError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePhone(phone)) return

    setIsSaving(true)
    setSaveMessage(null)

    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      locationCity: city.trim() || undefined,
      locationState: locationState.trim() || undefined,
    })

    setIsSaving(false)
    setSaveMessage('Profile updated')

    // Clear message after 3 seconds
    setTimeout(() => setSaveMessage(null), 3000)
  }

  if (!user) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          disabled={isSaving}
        />
        <Input
          label="Last name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          disabled={isSaving}
        />
      </div>

      <div className="relative">
        <Input
          label="Email"
          type="email"
          value={user.email}
          disabled
          className="pr-24"
        />
        {user.emailVerifiedAt && (
          <div className="absolute right-3 top-8 flex items-center gap-1 text-green-500 text-sm">
            <CheckCircle size={16} weight="fill" />
            <span>Verified</span>
          </div>
        )}
      </div>

      <div className="relative">
        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            if (phoneError) validatePhone(e.target.value)
          }}
          placeholder="(555) 123-4567"
          error={phoneError || undefined}
          disabled={isSaving}
          className="pr-24"
        />
        {user.phoneVerifiedAt && (
          <div className="absolute right-3 top-8 flex items-center gap-1 text-green-500 text-sm">
            <CheckCircle size={16} weight="fill" />
            <span>Verified</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="City"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Miami"
          disabled={isSaving}
        />
        <Input
          label="State"
          type="text"
          value={locationState}
          onChange={(e) => setLocationState(e.target.value)}
          placeholder="FL"
          disabled={isSaving}
        />
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" isLoading={isSaving} disabled={isSaving}>
          Save changes
        </Button>
        {saveMessage && (
          <span className="text-sm text-green-500 flex items-center gap-1">
            <CheckCircle size={16} weight="fill" />
            {saveMessage}
          </span>
        )}
      </div>
    </form>
  )
}
