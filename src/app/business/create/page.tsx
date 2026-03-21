'use client'

import {
  ArrowRight,
  CheckCircle,
  Plus,
  Storefront,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CreateBusinessForm } from '@/components/features/createBusinessForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createBusinessAction } from '@/lib/actions/business-data'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

type PageView = 'auth' | 'form' | 'success'
type AuthView = 'signUp' | 'signIn'

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

export default function CreateBusinessPage() {
  const router = useRouter()
  const { state, signUp, signIn, linkBusiness, updateClaimStatus } =
    useBusinessAuth()

  // Page state
  const [pageView, setPageView] = useState<PageView>(
    state.isAuthenticated ? 'form' : 'auth',
  )
  const [createdBusiness, setCreatedBusiness] = useState<{
    name: string
    city: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auth form state
  const [authView, setAuthView] = useState<AuthView>('signUp')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

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

  // Handle auth submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateAuthForm()) return

    setIsSubmitting(true)

    try {
      if (authView === 'signUp') {
        await signUp(
          email,
          password,
          firstName || undefined,
          lastName || undefined,
        )
      } else {
        await signIn(email, password)
      }
      setPageView('form')
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle business form submit
  const handleBusinessSubmit = async (formData: {
    name: string
    description: string
    website: string
    address: string
    city: string
    state: string
    zipCode: string
    locationArea: string
    phone: string
    email: string
  }) => {
    setIsSubmitting(true)

    try {
      const result = await createBusinessAction({
        name: formData.name,
        address: formData.address || undefined,
        city: formData.city || undefined,
        website: formData.website || undefined,
      })

      if (!result.success || !result.businessId) {
        setIsSubmitting(false)
        return
      }

      // Link business to owner profile — claim goes to pending for review
      linkBusiness(String(result.businessId))
      updateClaimStatus('pending')

      setCreatedBusiness({ name: formData.name, city: formData.city })
      setPageView('success')
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle go to dashboard
  const handleGoToDashboard = () => {
    router.push('/business/dashboard')
  }

  // Render auth view
  if (pageView === 'auth') {
    return (
      <main className="min-h-screen bg-[#e8ddd0] pt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-800/8 border border-amber-800/15 mb-6">
              <Plus size={32} weight="light" className="text-amber-800" />
            </div>
            <h1 className="text-2xl font-bold text-[#451a03] mb-2">
              List Your Business
            </h1>
            <p className="text-[#78350f]">
              {authView === 'signUp'
                ? 'Create an account to list your medspa on CostFinders'
                : 'Sign in to your business account'}
            </p>
          </div>

          {/* Auth form */}
          <Card className="p-6">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authView === 'signUp' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
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
                placeholder={
                  authView === 'signUp'
                    ? 'Min. 8 characters'
                    : 'Enter your password'
                }
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
                <p className="text-sm text-red-600 bg-red-400/10 px-3 py-2 rounded-lg">
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
            <p className="text-center text-sm text-[#78350f] mt-6">
              {authView === 'signUp' ? (
                <>
                  Already have a business account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthView('signIn')}
                    className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
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
                    className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
                  >
                    Create one
                  </button>
                </>
              )}
            </p>
          </Card>

          {/* Back link */}
          <p className="text-center text-sm text-[#92400e] mt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="hover:text-[#78350f] transition-colors"
            >
              ← Back to business options
            </button>
          </p>
        </div>
      </main>
    )
  }

  // Render success view
  if (pageView === 'success' && createdBusiness) {
    return (
      <main className="min-h-screen bg-[#e8ddd0] pt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
          <div className="text-center space-y-6">
            {/* Success icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-emerald-400/20 flex items-center justify-center">
                <CheckCircle
                  size={48}
                  weight="fill"
                  className="text-emerald-600"
                />
              </div>
            </div>

            {/* Success message */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[#451a03]">
                Your business has been created!
              </h1>
              <p className="text-[#78350f]">
                <span className="font-medium text-[#451a03]">
                  {createdBusiness.name}
                </span>{' '}
                is now listed on CostFinders
              </p>
            </div>

            {/* Business details card */}
            <Card className="p-6 text-left">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                  <Storefront
                    size={24}
                    weight="light"
                    className="text-amber-800"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-[#451a03]">
                    {createdBusiness.name}
                  </h3>
                  {createdBusiness.city && (
                    <p className="text-sm text-[#78350f]">
                      {createdBusiness.city}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Info note */}
            <div className="p-4 rounded-xl bg-amber-800/5 border border-amber-800/15">
              <p className="text-sm text-[#78350f]">
                Your listing will go live after a brief review. You&apos;ll have
                full access to manage your profile and create deals.
              </p>
            </div>

            {/* CTA */}
            <Button onClick={handleGoToDashboard} className="w-full" size="lg">
              Go to Business Dashboard
              <ArrowRight size={20} weight="light" className="ml-2" />
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // Render form view (authenticated)
  return (
    <main className="min-h-screen bg-[#e8ddd0] pt-20">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-800/8 border border-amber-800/15 mb-6">
            <Plus size={32} weight="light" className="text-amber-800" />
          </div>
          <h1 className="text-2xl font-bold text-[#451a03] mb-2">
            List Your Business
          </h1>
          <p className="text-[#78350f]">
            Fill in the details below to create your medspa listing
          </p>
        </div>

        {/* Form */}
        <CreateBusinessForm
          onSubmit={handleBusinessSubmit}
          isLoading={isSubmitting}
          defaultEmail={state.owner?.email || ''}
        />

        {/* Back link */}
        <p className="text-center text-sm text-[#92400e] mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="hover:text-[#78350f] transition-colors"
          >
            ← Back to business options
          </button>
        </p>
      </div>
    </main>
  )
}
