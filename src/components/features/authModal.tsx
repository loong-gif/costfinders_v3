'use client'

import { useEffect, useState } from 'react'
import { SignInForm } from '@/components/features/signInForm'
import { SignUpForm } from '@/components/features/signUpForm'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/lib/context/authContext'

type AuthView = 'signUp' | 'signIn'

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
  const [awaitingAuth, setAwaitingAuth] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView)
      setAwaitingAuth(false)
    }
  }, [isOpen, initialView])

  useEffect(() => {
    if (!awaitingAuth) return
    if (state.isLoading) return

    setAwaitingAuth(false)

    if (state.error) return

    if (state.user) {
      onSuccess?.()
      onClose()
    }
  }, [
    awaitingAuth,
    state.isLoading,
    state.user,
    state.error,
    onSuccess,
    onClose,
  ])

  const handleAuthSuccess = () => {
    setAwaitingAuth(true)
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
        <h2 className="text-xl font-semibold text-[#451a03] text-center">
          {getHeaderTitle()}
        </h2>

        {currentView === 'signUp' && (
          <SignUpForm
            onSuccess={handleAuthSuccess}
            onSwitchToSignIn={handleSwitchToSignIn}
          />
        )}

        {currentView === 'signIn' && (
          <SignInForm
            onSuccess={handleAuthSuccess}
            onSwitchToSignUp={handleSwitchToSignUp}
          />
        )}
      </div>
    </Modal>
  )
}
