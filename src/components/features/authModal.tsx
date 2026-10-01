'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EmailVerification } from '@/components/features/emailVerification'
import { SignInForm } from '@/components/features/signInForm'
import { SignUpForm } from '@/components/features/signUpForm'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/lib/context/authContext'

type AuthView = 'signUp' | 'signIn' | 'emailVerification'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'signUp' | 'signIn'
  onSuccess?: () => void
  /** One line above the form saying why they are being asked to sign in. */
  notice?: string
  /**
   * Where an emailed link (confirm email, sign-in link) lands. Defaults to the page the modal
   * was opened on, so someone who signs up from a deal comes back to that deal; from the
   * homepage it is the dashboard, as before.
   */
  returnTo?: string
}

export function AuthModal({
  isOpen,
  onClose,
  initialView = 'signUp',
  onSuccess,
  notice,
  returnTo,
}: AuthModalProps) {
  const { state } = useAuth()
  const pathname = usePathname()
  const next = returnTo ?? (pathname === '/' ? '/dashboard' : pathname)
  const [currentView, setCurrentView] = useState<AuthView>(initialView)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [awaitingSignIn, setAwaitingSignIn] = useState(false)

  // Reset state when modal opens or initialView changes
  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView)
      setPendingEmail(null)
      setAwaitingSignIn(false)
    }
  }, [isOpen, initialView])

  // After sign-in, state.user may not be available until the next render.
  // This effect handles the routing once the user object is hydrated.
  useEffect(() => {
    if (!awaitingSignIn) return
    if (state.isLoading) return

    // User is now hydrated — route based on verification status
    setAwaitingSignIn(false)

    if (state.user?.verificationStatus === 'unverified') {
      setPendingEmail(state.user.email)
      setCurrentView('emailVerification')
    } else {
      onSuccess?.()
      onClose()
    }
  }, [awaitingSignIn, state.isLoading, state.user, onSuccess, onClose])

  const handleSignUpSuccess = (email: string) => {
    // Don't close modal - switch to email verification
    setPendingEmail(email)
    setCurrentView('emailVerification')
  }

  const handleSignInSuccess = () => {
    // Defer routing until state.user is hydrated on next render
    setAwaitingSignIn(true)
  }

  const handleSwitchToSignIn = () => {
    setCurrentView('signIn')
  }

  const handleSwitchToSignUp = () => {
    setCurrentView('signUp')
  }

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'signUp':
        return 'Create an account'
      case 'signIn':
        return 'Welcome back'
      case 'emailVerification':
        return 'Verify your email'
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      mobileVariant="fullscreen"
    >
      <div className="space-y-6">
        {/* Header */}
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary text-center">
          {getHeaderTitle()}
        </h2>

        {notice && currentView !== 'emailVerification' && (
          <p className="text-sm text-text-secondary text-center -mt-3">
            {notice}
          </p>
        )}

        {/* Content */}
        {currentView === 'signUp' && (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={handleSwitchToSignIn}
            returnTo={next}
          />
        )}

        {currentView === 'signIn' && (
          <SignInForm
            onSuccess={handleSignInSuccess}
            onSwitchToSignUp={handleSwitchToSignUp}
            returnTo={next}
          />
        )}

        {currentView === 'emailVerification' && pendingEmail && (
          <EmailVerification email={pendingEmail} returnTo={next} />
        )}
      </div>
    </Modal>
  )
}
