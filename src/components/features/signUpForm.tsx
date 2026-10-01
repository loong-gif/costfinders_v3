'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/authContext'

interface SignUpFormProps {
  onSuccess?: (email: string) => void
  onSwitchToSignIn?: () => void
  /** Where the confirmation link lands. See AuthModal. */
  returnTo?: string
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  firstName?: string
  ageAttested?: string
}

export function SignUpForm({
  onSuccess,
  onSwitchToSignIn,
  returnTo,
}: SignUpFormProps) {
  const { signUp, state } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // Both legal documents require 18+ (privacy/page.tsx:504, terms/page.tsx:51) and nothing
  // asked. The treatments listed here are aesthetic medical services and claiming a deal
  // relays the claimant's contact details to a clinic, so an unenforced 18+ rule is worse
  // than none: it makes the "not knowingly" qualifier in the policy unsupportable.
  const [ageAttested, setAgeAttested] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!ageAttested) {
      newErrors.ageAttested = 'Please confirm you are 18 or older'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      await signUp(
        email,
        password,
        firstName || undefined,
        lastName || undefined,
        ageAttested,
        returnTo,
      )
      onSuccess?.(email)
    } catch {
      // Error is handled by context and displayed via state.error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          error={errors.firstName}
          disabled={isSubmitting}
        />
        <Input
          label="Last name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          disabled={isSubmitting}
        />
      </div>

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
        placeholder="Min. 8 characters"
        error={errors.password}
        disabled={isSubmitting}
        required
      />

      <Input
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm your password"
        error={errors.confirmPassword}
        disabled={isSubmitting}
        required
      />

      {/* Age gate. Checked in validateForm, again by `disabled` on the submit button, and
          again by signUpAction server-side — it takes `ageAttested` and refuses without it,
          so a direct POST to the action no longer bypasses this. */}
      <div className="flex items-start gap-2.5">
        <input
          id="age-attested"
          type="checkbox"
          checked={ageAttested}
          onChange={(e) => {
            setAgeAttested(e.target.checked)
            if (e.target.checked) {
              setErrors((prev) => ({ ...prev, ageAttested: undefined }))
            }
          }}
          disabled={isSubmitting}
          required
          aria-describedby={
            errors.ageAttested ? 'age-attested-error' : undefined
          }
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-hover text-accent accent-accent focus:outline-none focus:ring-2 focus:ring-border-accent disabled:opacity-50"
        />
        <label
          htmlFor="age-attested"
          className="text-xs text-text-secondary cursor-pointer"
        >
          I am 18 or older. The treatments listed on CostFinders are aesthetic
          medical services.
        </label>
      </div>
      {/* role="alert" on both: these appear after submit, so a screen reader that has moved
          past them gets nothing without a live region. */}
      {errors.ageAttested && (
        <p id="age-attested-error" role="alert" className="text-sm text-error">
          {errors.ageAttested}
        </p>
      )}

      {state.error && (
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
        disabled={isSubmitting || !ageAttested}
      >
        Create account
      </Button>

      {/* Creating an account shares the user's contact details with a business when
          they claim a deal, so the disclosure has to be at the point of consent. */}
      <p className="text-center text-xs text-text-muted">
        By creating an account you agree to our{' '}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >
          Privacy Policy
        </a>
        . When you claim a deal, we share your name and contact details with
        that business.
      </p>

      {onSwitchToSignIn && (
        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  )
}
