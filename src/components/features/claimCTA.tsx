'use client'

import { Lock, Sparkle, UserPlus } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// M8: Dynamic import modals — only loaded when user clicks
const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)
const ClaimDealModal = dynamic(
  () => import('@/components/features/claimDealModal').then((m) => m.ClaimDealModal),
  { ssr: false },
)
import { Card } from '@/components/ui/card'

type AuthView = 'signUp' | 'signIn'

interface ClaimCTAProps {
  dealId: string
  businessId: string
  dealTitle: string
  isAuthenticated: boolean
  onClaimSuccess: () => void
}

export function ClaimCTA({
  dealId,
  businessId,
  dealTitle,
  isAuthenticated,
  onClaimSuccess,
}: ClaimCTAProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<AuthView>('signUp')

  const handleSignUp = () => {
    setAuthModalView('signUp')
    setIsAuthModalOpen(true)
  }

  const handleSignIn = () => {
    setAuthModalView('signIn')
    setIsAuthModalOpen(true)
  }

  const handleAuthClose = () => {
    setIsAuthModalOpen(false)
  }

  const handleClaimClick = () => {
    setIsClaimModalOpen(true)
  }

  const handleClaimClose = () => {
    setIsClaimModalOpen(false)
  }

  const handleClaimSuccess = () => {
    setIsClaimModalOpen(false)
    onClaimSuccess()
  }

  // Authenticated but no active claim — show "Claim This Deal"
  if (isAuthenticated) {
    return (
      <>
        <Card variant="glass" padding="lg">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center">
              <Sparkle size={32} weight="fill" className="text-amber-800" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#451a03]">
                Business Details Hidden
              </h3>
              <p className="text-sm text-[#78350f]">
                Claim this deal to reveal the business name, location, and
                contact details. The business will contact you to schedule your
                appointment.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleClaimClick}
              type="button"
            >
              Claim This Deal
            </Button>
          </div>
        </Card>

        <ClaimDealModal
          isOpen={isClaimModalOpen}
          onClose={handleClaimClose}
          dealId={dealId}
          businessId={businessId}
          dealTitle={dealTitle}
          onSuccess={handleClaimSuccess}
        />
      </>
    )
  }

  // Not authenticated — show auth wall
  return (
    <>
      <Card variant="glass" padding="lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center">
            <Lock size={32} weight="fill" className="text-amber-800" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#451a03]">
              Business Details Hidden
            </h3>
            <p className="text-sm text-[#78350f]">
              Create a free account to reveal the business name, location, and
              contact details — then claim this deal.
            </p>
          </div>
          <div className="w-full space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleSignUp}
              type="button"
            >
              <UserPlus size={20} weight="bold" />
              Create Free Account
            </Button>
            <button
              type="button"
              onClick={handleSignIn}
              className="text-sm text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
          <p className="text-xs text-[#92400e]">
            Your information is secure and never shared without permission.
          </p>
        </div>
      </Card>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleAuthClose}
        initialView={authModalView}
      />
    </>
  )
}
