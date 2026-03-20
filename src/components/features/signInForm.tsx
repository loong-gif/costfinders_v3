'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/authContext'

interface SignInFormProps {
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
  onForgotPassword?: () => void
}

interface FormErrors {
  email?: string
  password?: string
}

export function SignInForm({
  onSuccess,
  onSwitchToSignUp,
  onForgotPassword,
}: SignInFormProps) {
  const { signIn, state } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)

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

    try {
      await signIn(email, password)
      onSuccess?.()
    } catch {
      // Error is handled by context and displayed via state.error
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = () => {
    setForgotPasswordSent(true)
    onForgotPassword?.()
    // Auto-hide message after 3 seconds
    setTimeout(() => setForgotPasswordSent(false), 3000)
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
          className="text-sm text-amber-800 hover:text-amber-300 transition-colors"
        >
          Forgot password?
        </button>
      </div>

      {/* Forgot Password Toast */}
      {forgotPasswordSent && (
        <p className="text-sm text-emerald-600 bg-emerald-600/10 px-3 py-2 rounded-lg">
          Check your email for password reset instructions.
        </p>
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
        Sign in
      </Button>

      {onSwitchToSignUp && (
        <p className="text-center text-sm text-[#78350f]">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-amber-800 hover:text-amber-300 transition-colors font-medium"
          >
            Sign up
          </button>
        </p>
      )}
    </form>
  )
}
