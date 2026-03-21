'use client'

import { ShieldCheck } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminAuthProvider, useAdminAuth } from '@/lib/context/adminAuthContext'

function AdminLoginContent() {
  const router = useRouter()
  const { state, signIn } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!state.isLoading && state.isAuthenticated) {
      router.push('/admin/dashboard')
    }
  }, [state.isLoading, state.isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await signIn(email, password)
      router.push('/admin/dashboard')
    } catch {
      // Error is set in context state
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading while checking initial auth state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-amber-800"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[#78350f]">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render form if already authenticated (redirect in progress)
  if (state.isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-800/15 mb-4">
              <ShieldCheck size={32} weight="fill" className="text-amber-800" />
            </div>
            <h1 className="text-2xl font-bold text-[#451a03]">Admin Portal</h1>
            <p className="text-[#78350f] mt-2">
              Sign in to access the admin dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@costfinders.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={state.error || undefined}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={!email || !password || isSubmitting}
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <AdminAuthProvider>
      <AdminLoginContent />
    </AdminAuthProvider>
  )
}
