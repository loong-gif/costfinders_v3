'use client'

import { Phone } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/authContext'

interface PhoneVerificationProps {
  onVerified?: () => void
  onSkip?: () => void
}

export function PhoneVerification({
  onVerified,
  onSkip,
}: PhoneVerificationProps) {
  const { verifyPhone } = useAuth()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState(false)

  // Format phone for display
  const formatPhoneForDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // Validate phone has at least 10 digits
  const isValidPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    return digits.length >= 10
  }

  const handleSendCode = async () => {
    setError(null)

    if (!isValidPhone(phoneNumber)) {
      setError('Please enter a valid phone number (10+ digits)')
      return
    }

    setIsSubmitting(true)

    // Simulate sending SMS
    await new Promise((resolve) => setTimeout(resolve, 500))

    setIsSubmitting(false)
    setStep('code')
  }

  const handleVerifyCode = async () => {
    setError(null)

    // Validate 6-digit code
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsSubmitting(true)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock verification: accept any 6-digit code
    // Extract just digits for storage
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    verifyPhone(cleanPhone)

    setIsSubmitting(false)
    onVerified?.()
  }

  const handleResend = () => {
    setResendMessage(true)
    // Hide message after 3 seconds
    setTimeout(() => setResendMessage(false), 3000)
  }

  const handleChangeNumber = () => {
    setStep('phone')
    setCode('')
    setError(null)
  }

  if (step === 'code') {
    return (
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center">
            <Phone size={32} weight="light" className="text-amber-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-stone-100">
            Enter verification code
          </h3>
          <p className="text-sm text-stone-400">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-stone-100">
              {formatPhoneForDisplay(phoneNumber)}
            </span>
          </p>
        </div>

        {/* Code Input */}
        <div className="space-y-4">
          <Input
            type="text"
            value={code}
            onChange={(e) => {
              // Only allow digits and limit to 6 characters
              const value = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCode(value)
              setError(null)
            }}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg tracking-widest"
            error={error || undefined}
            disabled={isSubmitting}
          />

          <Button
            onClick={handleVerifyCode}
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting || code.length !== 6}
          >
            Verify
          </Button>
        </div>

        {/* Resend */}
        <div className="space-y-2">
          {resendMessage ? (
            <p className="text-sm text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg">
              Code sent!
            </p>
          ) : (
            <p className="text-sm text-stone-400">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
              >
                Resend
              </button>
            </p>
          )}
        </div>

        {/* Back link */}
        <button
          type="button"
          onClick={handleChangeNumber}
          className="text-sm text-stone-500 hover:text-stone-400 transition-colors"
        >
          Use different number
        </button>
      </div>
    )
  }

  return (
    <div className="text-center space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center">
          <Phone size={32} weight="light" className="text-amber-400" />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-stone-100">
          Verify your phone
        </h3>
        <p className="text-sm text-stone-400">
          Add your phone number to secure your account
        </p>
      </div>

      {/* Phone Input */}
      <div className="space-y-4">
        <Input
          type="tel"
          value={phoneNumber}
          onChange={(e) => {
            // Allow formatted input
            setPhoneNumber(e.target.value)
            setError(null)
          }}
          placeholder="+1 (555) 000-0000"
          error={error || undefined}
          disabled={isSubmitting}
        />

        <Button
          onClick={handleSendCode}
          className="w-full"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting || !phoneNumber.trim()}
        >
          Send Code
        </Button>
      </div>

      {/* Skip link */}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-stone-500 hover:text-stone-400 transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
