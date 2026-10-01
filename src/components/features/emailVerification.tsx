'use client'

import { EnvelopeSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface EmailVerificationProps {
  email: string
  /** Where the confirmation link lands. See AuthModal. */
  returnTo?: string
}

/**
 * "Check your email" after sign-up. Link only: the confirmation email carries no code, so the
 * "enter verification code manually" option that used to live here left people stuck. If the
 * Supabase "Confirm signup" template ever adds {{ .Token }}, verifyOtp({ type: 'signup' }) can
 * come back — see git history.
 */
export function EmailVerification({
  email,
  returnTo = '/dashboard',
}: EmailVerificationProps) {
  const [error, setError] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState(false)

  const handleResend = async () => {
    setError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
        },
      })

      if (resendError) {
        setError(resendError.message)
        return
      }

      setResendMessage(true)
      setTimeout(() => setResendMessage(false), 3000)
    } catch {
      setError('Failed to resend the email. Please try again.')
    }
  }

  const handleOpenEmailApp = () => {
    window.open('mailto:', '_blank')
  }

  return (
    <div className="text-center space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center">
          <EnvelopeSimple
            size={28}
            weight="light"
            className="text-text-secondary"
          />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-text-primary">
          Check your email
        </h3>
        <p className="text-sm text-text-secondary">
          We sent a confirmation link to{' '}
          <span className="font-medium text-text-primary">{email}</span>. Open
          it to finish creating your account.
        </p>
      </div>

      {/* Open Email Button */}
      <Button onClick={handleOpenEmailApp} className="w-full" size="lg">
        Open email app
      </Button>

      {/* Success Message */}
      {resendMessage && (
        <output className="block text-sm text-success bg-success-bg px-3 py-2 rounded-lg">
          Check your email!
        </output>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
        >
          {error}
        </p>
      )}

      {/* Resend */}
      <p className="text-sm text-text-secondary">
        Didn&apos;t receive the email?{' '}
        <button
          type="button"
          onClick={handleResend}
          className="text-accent hover:text-accent-hover transition-colors font-medium"
        >
          Resend
        </button>
      </p>
    </div>
  )
}
