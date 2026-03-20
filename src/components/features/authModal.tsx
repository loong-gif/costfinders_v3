'use client'

import { useEffect, useState } from 'react'
import { EmailVerification } from '@/components/features/emailVerification'
import { PhoneVerification } from '@/components/features/phoneVerification'
import { SignInForm } from '@/components/features/signInForm'
import { SignUpForm } from '@/components/features/signUpForm'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/lib/context/authContext'

type AuthView = 'signUp' | 'signIn' | 'emailVerification' | 'phoneVerification'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'signUp' | 'signIn'
  onSuccess?: () => void
}

export function AuthModal({
  isOpen,
  onClose,
  initialView = 'signUp',
  onSuccess,
}: AuthModalProps) {
  const { state } = useAuth()
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
    } else if (state.user?.verificationStatus === 'email_verified') {
      setCurrentView('phoneVerification')
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

  const handleEmailVerificationComplete = () => {
    // Don't close modal - switch to phone verification
    setCurrentView('phoneVerification')
  }

  const handlePhoneVerificationComplete = () => {
    onSuccess?.()
    onClose()
  }

  const handlePhoneVerificationSkip = () => {
    // User can verify phone later
    onSuccess?.()
    onClose()
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
        return 'Create Account'
      case 'signIn':
        return 'Welcome Back'
      case 'emailVerification':
        return 'Verify Email'
      case 'phoneVerification':
        return 'Verify Phone'
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
        <h2 className="text-xl font-semibold text-[#451a03] text-center">
          {getHeaderTitle()}
        </h2>

        {/* Content */}
        {currentView === 'signUp' && (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={handleSwitchToSignIn}
          />
        )}

        {currentView === 'signIn' && (
          <SignInForm
            onSuccess={handleSignInSuccess}
            onSwitchToSignUp={handleSwitchToSignUp}
          />
        )}

        {currentView === 'emailVerification' && pendingEmail && (
          <EmailVerification
            email={pendingEmail}
            onVerified={handleEmailVerificationComplete}
          />
        )}

        {currentView === 'phoneVerification' && (
          <PhoneVerification
            onVerified={handlePhoneVerificationComplete}
            onSkip={handlePhoneVerificationSkip}
          />
        )}
      </div>
    </Modal>
  )
}
