'use client'

import { EnvelopeSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/authContext'

interface EmailVerificationProps {
  email: string
  onVerified?: () => void
  onResendCode?: () => void
}

export function EmailVerification({
  email,
  onVerified,
  onResendCode,
}: EmailVerificationProps) {
  const { updateVerificationStatus } = useAuth()

  const [showCodeEntry, setShowCodeEntry] = useState(false)
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState(false)

  const handleVerifyCode = async () => {
    setError(null)

    // Validate 6-digit code
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock verification: accept any 6-digit code
    updateVerificationStatus('email_verified')
    setIsVerifying(false)
    onVerified?.()
  }

  const handleResend = () => {
    setResendMessage(true)
    onResendCode?.()
    // Hide message after 3 seconds
    setTimeout(() => setResendMessage(false), 3000)
  }

  const handleOpenEmailApp = () => {
    // Mock action - in real app, could use mailto: or show instructions
    setResendMessage(true)
    setTimeout(() => setResendMessage(false), 3000)
  }

  if (showCodeEntry) {
    return (
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center">
            <EnvelopeSimple
              size={32}
              weight="light"
              className="text-amber-400"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-stone-100">
            Enter verification code
          </h3>
          <p className="text-sm text-stone-400">
            Enter the 6-digit code sent to {email}
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
            disabled={isVerifying}
          />

          <Button
            onClick={handleVerifyCode}
            className="w-full"
            size="lg"
            isLoading={isVerifying}
            disabled={isVerifying || code.length !== 6}
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
          onClick={() => setShowCodeEntry(false)}
          className="text-sm text-stone-500 hover:text-stone-400 transition-colors"
        >
          Back to email screen
        </button>
      </div>
    )
  }

  return (
    <div className="text-center space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center">
          <EnvelopeSimple
            size={32}
            weight="light"
            className="text-amber-400"
          />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-stone-100">
          Check your email
        </h3>
        <p className="text-sm text-stone-400">
          We sent a verification link to{' '}
          <span className="font-medium text-stone-100">{email}</span>
        </p>
      </div>

      {/* Open Email Button */}
      <Button onClick={handleOpenEmailApp} className="w-full" size="lg">
        Open Email App
      </Button>

      {/* Success Message */}
      {resendMessage && (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg">
          Check your email!
        </p>
      )}

      {/* Resend */}
      <p className="text-sm text-stone-400">
        Didn&apos;t receive the email?{' '}
        <button
          type="button"
          onClick={handleResend}
          className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
        >
          Resend
        </button>
      </p>

      {/* Manual Code Entry Link */}
      <button
        type="button"
        onClick={() => setShowCodeEntry(true)}
        className="text-sm text-stone-500 hover:text-stone-400 transition-colors"
      >
        Or enter verification code manually
      </button>
    </div>
  )
}
