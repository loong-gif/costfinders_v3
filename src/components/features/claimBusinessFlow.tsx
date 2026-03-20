'use client'

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  EnvelopeSimple,
  MapPin,
  Phone,
  Shield,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { Business } from '@/types/business'

type ClaimStep = 'confirm' | 'auth' | 'verify' | 'success'
type AuthView = 'signUp' | 'signIn'
type VerifyMethod = 'email' | 'phone' | null

interface ClaimBusinessFlowProps {
  business: Business
  onComplete?: () => void
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  firstName?: string
}

export function ClaimBusinessFlow({
  business,
  onComplete,
}: ClaimBusinessFlowProps) {
  const router = useRouter()
  const {
    state,
    signUp,
    signIn,
    updateClaimStatus,
    linkBusiness,
    updateVerificationStatus,
  } = useBusinessAuth()

  // Flow state
  const [currentStep, setCurrentStep] = useState<ClaimStep>('confirm')
  const [authView, setAuthView] = useState<AuthView>('signUp')
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>(null)

  // Auth form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Verification state
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Handle step 1: Confirm business
  const handleConfirmBusiness = () => {
    setCurrentStep('auth')
  }

  // Validate auth form
  const validateAuthForm = (): boolean => {
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
    } else if (authView === 'signUp' && password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    // Confirm password (only for sign up)
    if (authView === 'signUp') {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle step 2: Auth
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateAuthForm()) return

    setIsSubmitting(true)

    try {
      if (authView === 'signUp') {
        await signUp(email, password, firstName || undefined, lastName || undefined)
      } else {
        await signIn(email, password)
      }
      setCurrentStep('verify')
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle step 3: Verify ownership
  const handleVerifySubmit = async () => {
    setVerifyError(null)

    // Validate 6-digit code
    if (!/^\d{6}$/.test(verificationCode)) {
      setVerifyError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock verification: accept any 6-digit code
    updateVerificationStatus('verified')
    updateClaimStatus('pending')
    linkBusiness(business.id)

    setIsVerifying(false)
    setCurrentStep('success')
  }

  // Handle success completion
  const handleGoToDashboard = () => {
    onComplete?.()
    router.push('/business/dashboard')
  }

  // Render step 1: Business confirmation
  if (currentStep === 'confirm') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center">
              <Buildings size={32} weight="light" className="text-brand-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            Is this your business?
          </h2>
          <p className="text-text-secondary">
            Confirm the details below to claim this profile
          </p>
        </div>

        {/* Business details card */}
        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary">
              {business.name}
            </h3>
            {business.description && (
              <p className="text-sm text-text-secondary line-clamp-2">
                {business.description}
              </p>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <MapPin size={18} weight="light" className="text-text-tertiary mt-0.5" />
              <div className="text-text-secondary">
                <p>{business.address}</p>
                <p>
                  {business.city}, {business.state} {business.zipCode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone size={18} weight="light" className="text-text-tertiary" />
              <span className="text-text-secondary">{business.phone}</span>
            </div>

            <div className="flex items-center gap-3">
              <EnvelopeSimple size={18} weight="light" className="text-text-tertiary" />
              <span className="text-text-secondary">{business.email}</span>
            </div>
          </div>
        </Card>

        {/* Continue button */}
        <Button onClick={handleConfirmBusiness} className="w-full" size="lg">
          Yes, this is my business
          <ArrowRight size={20} weight="light" className="ml-2" />
        </Button>

        <p className="text-center text-sm text-text-tertiary">
          Not your business?{' '}
          <button
            type="button"
            onClick={() => router.back()}
            className="text-brand-primary hover:text-brand-secondary transition-colors"
          >
            Go back
          </button>
        </p>
      </div>
    )
  }

  // Render step 2: Authentication
  if (currentStep === 'auth') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">
            {authView === 'signUp' ? 'Create your account' : 'Sign in to continue'}
          </h2>
          <p className="text-text-secondary">
            {authView === 'signUp'
              ? 'Create a business owner account to claim your profile'
              : 'Sign in to your business owner account'}
          </p>
        </div>

        {/* Auth form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authView === 'signUp' && (
            <div className="grid grid-cols-2 gap-4">
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
          )}

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
            placeholder={authView === 'signUp' ? 'Min. 8 characters' : 'Enter your password'}
            error={errors.password}
            disabled={isSubmitting}
            required
          />

          {authView === 'signUp' && (
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
          )}

          {state.error && (
            <p className="text-sm text-error-text bg-error/10 px-3 py-2 rounded-lg">
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
            {authView === 'signUp' ? 'Create account' : 'Sign in'}
            <ArrowRight size={20} weight="light" className="ml-2" />
          </Button>
        </form>

        {/* Switch auth view */}
        <p className="text-center text-sm text-text-secondary">
          {authView === 'signUp' ? (
            <>
              Already have a business account?{' '}
              <button
                type="button"
                onClick={() => setAuthView('signIn')}
                className="text-brand-primary hover:text-brand-secondary transition-colors font-medium"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthView('signUp')}
                className="text-brand-primary hover:text-brand-secondary transition-colors font-medium"
              >
                Create one
              </button>
            </>
          )}
        </p>
      </div>
    )
  }

  // Render step 3: Verification
  if (currentStep === 'verify') {
    // Show verification method selection if not chosen
    if (!verifyMethod) {
      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center">
                <Shield size={32} weight="light" className="text-brand-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">
              Verify your ownership
            </h2>
            <p className="text-text-secondary">
              We need to verify you own {business.name}
            </p>
          </div>

          {/* Verification options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setVerifyMethod('email')}
              className="w-full p-4 rounded-xl bg-surface-secondary/50 border border-border-primary hover:border-brand-primary transition-colors text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                  <EnvelopeSimple size={24} weight="light" className="text-brand-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Verify via email</p>
                  <p className="text-sm text-text-secondary">
                    I have access to {business.email}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVerifyMethod('phone')}
              className="w-full p-4 rounded-xl bg-surface-secondary/50 border border-border-primary hover:border-brand-primary transition-colors text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                  <Phone size={24} weight="light" className="text-brand-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Verify via phone</p>
                  <p className="text-sm text-text-secondary">
                    Call {business.phone} for verification code
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )
    }

    // Show code entry
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center">
              {verifyMethod === 'email' ? (
                <EnvelopeSimple size={32} weight="light" className="text-brand-primary" />
              ) : (
                <Phone size={32} weight="light" className="text-brand-primary" />
              )}
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            Enter verification code
          </h2>
          <p className="text-text-secondary">
            {verifyMethod === 'email'
              ? `We sent a code to ${business.email}`
              : `We called ${business.phone} with your code`}
          </p>
        </div>

        {/* Code input */}
        <div className="space-y-4">
          <Input
            type="text"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6)
              setVerificationCode(value)
              setVerifyError(null)
            }}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg tracking-widest"
            error={verifyError || undefined}
            disabled={isVerifying}
          />

          <Button
            onClick={handleVerifySubmit}
            className="w-full"
            size="lg"
            isLoading={isVerifying}
            disabled={isVerifying || verificationCode.length !== 6}
          >
            Verify & Submit Claim
          </Button>
        </div>

        {/* Back link */}
        <button
          type="button"
          onClick={() => setVerifyMethod(null)}
          className="w-full text-center text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Choose a different verification method
        </button>
      </div>
    )
  }

  // Render step 4: Success
  return (
    <div className="space-y-6 text-center">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle size={48} weight="fill" className="text-success-text" />
        </div>
      </div>

      {/* Success message */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">
          Claim submitted!
        </h2>
        <p className="text-text-secondary">
          Your claim for <span className="font-medium text-text-primary">{business.name}</span> is being reviewed.
        </p>
      </div>

      {/* Info card */}
      <Card className="p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield size={20} weight="light" className="text-brand-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">What happens next?</p>
            <p className="text-sm text-text-secondary">
              We&apos;ll verify your ownership and notify you within 24-48 hours.
              Once approved, you&apos;ll have full access to manage your business profile.
            </p>
          </div>
        </div>
      </Card>

      {/* CTA */}
      <Button onClick={handleGoToDashboard} className="w-full" size="lg">
        Go to Business Dashboard
        <ArrowRight size={20} weight="light" className="ml-2" />
      </Button>
    </div>
  )
}
