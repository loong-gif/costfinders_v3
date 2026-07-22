'use client'

import { Lock } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-bg-base)]">
        <div className="max-w-md mx-auto">
          <Card variant="glass" padding="lg">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-savings-bg)] flex items-center justify-center mx-auto mb-4">
                <Lock
                  size={24}
                  weight="fill"
                  className="text-[var(--color-savings)]"
                />
              </div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                Password updated
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Redirecting to your dashboard...
              </p>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-bg-base)]">
      <div className="max-w-md mx-auto">
        <Card variant="glass" padding="lg">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center mx-auto mb-4">
              <Lock
                size={24}
                weight="fill"
                className="text-[var(--color-accent)]"
              />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              Set new password
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Choose a strong password for your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

            {error && (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full"
            >
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
