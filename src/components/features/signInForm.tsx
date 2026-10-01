'use client'

import { useState } from 'react'
import { MagicLinkButton } from '@/components/patterns/magicLinkButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetPasswordAction, sendMagicLinkAction } from '@/lib/actions/auth'
import { useAuth } from '@/lib/context/authContext'

interface SignInFormProps {
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
  onForgotPassword?: () => void
  /** Where the emailed sign-in link lands. See AuthModal. */
  returnTo?: string
}

interface FormErrors {
  email?: string
  password?: string
}

export function SignInForm({
  onSuccess,
  onSwitchToSignUp,
  onForgotPassword,
  returnTo,
}: SignInFormProps) {
  const { signIn, state } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(
    null,
  )
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setEmailNotConfirmed(false)

    try {
      await signIn(email, password)
      onSuccess?.()
    } catch (err) {
      // Check if the error indicates unconfirmed email
      if (err instanceof Error && err.message.includes('verify your email')) {
        setEmailNotConfirmed(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    setForgotPasswordError(null)

    if (!email.trim()) {
      setForgotPasswordError('Enter your email above first')
      return
    }

    try {
      const result = await resetPasswordAction(email)

      if (result.success) {
        setForgotPasswordSent(true)
        onForgotPassword?.()
        setTimeout(() => setForgotPasswordSent(false), 5000)
      } else {
        setForgotPasswordError(result.error ?? 'Failed to send reset email')
      }
    } catch {
      // Rejected outright (offline, Next refusing the request): without this the click
      // did nothing visible at all.
      setForgotPasswordError('Failed to send reset email. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        error={errors.email}
        disabled={isSubmitting}
        required
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
        error={errors.password}
        disabled={isSubmitting}
        required
      />

      {/* Forgot Password Link */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Forgot password?
        </button>
      </div>

      {/* Forgot Password Toast */}
      {/* <output> rather than <p role="status">: same implicit role, and
          Biome's useSemanticElements rule prefers the native element. */}
      {forgotPasswordSent && (
        <output className="block text-sm text-success bg-success-bg px-3 py-2 rounded-lg">
          Check your email for password reset instructions.
        </output>
      )}

      {forgotPasswordError && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
        >
          {forgotPasswordError}
        </p>
      )}

      {/* Email not confirmed */}
      {emailNotConfirmed && (
        <p
          role="alert"
          className="text-sm text-accent-hover bg-accent-muted px-3 py-2 rounded-lg"
        >
          Please verify your email first. Check your inbox for a confirmation
          link.
        </p>
      )}

      {state.error && !emailNotConfirmed && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
        >
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        Sign in
      </Button>

      {/* Divider */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-default" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg-elevated px-2 text-text-secondary">or</span>
        </div>
      </div>

      {/* Magic Link */}
      <MagicLinkButton
        email={email}
        sendAction={(address) => sendMagicLinkAction(address, returnTo)}
        disabled={isSubmitting}
      />

      {onSwitchToSignUp && (
        <p className="text-center text-sm text-text-secondary">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Sign up
          </button>
        </p>
      )}
    </form>
  )
}
