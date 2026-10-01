'use client'

import { Lock, UserPlus } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// M8: Dynamic import modals — only loaded when user clicks
const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)
const ClaimDealModal = dynamic(
  () =>
    import('@/components/features/claimDealModal').then(
      (m) => m.ClaimDealModal,
    ),
  { ssr: false },
)

import { Card } from '@/components/ui/card'

type AuthView = 'signUp' | 'signIn'

interface ClaimCTAProps {
  dealId: string
  businessId: string
  dealTitle: string
  isAuthenticated: boolean
  /** The clinic is already shown (a claim on another of its deals); this claims this one too. */
  alreadyRevealed?: boolean
  onClaimSuccess: () => void
}

export function ClaimCTA({
  dealId,
  businessId,
  dealTitle,
  isAuthenticated,
  alreadyRevealed = false,
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
          <div className="space-y-4">
            <div className="space-y-2">
              {alreadyRevealed ? (
                <>
                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    Claim this deal too
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Our team passes each claim on to the clinic, so claim this
                    one if it is the deal you want.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-text-primary">
                    <Lock size={18} weight="bold" className="text-text-muted" />
                    Clinic details hidden
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Claim this deal to see the clinic&apos;s name, address,
                    phone number and website. You then call or book with the
                    clinic directly, and our team also passes your request on.
                  </p>
                </>
              )}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleClaimClick}
              type="button"
            >
              Claim this deal
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
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-text-primary">
              <Lock size={18} weight="bold" className="text-text-muted" />
              Clinic details hidden
            </h3>
            <p className="text-sm text-text-secondary">
              Create a free account, then claim this deal to see the
              clinic&apos;s name, address, phone number and website.
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
              Create a free account
            </Button>
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full min-h-[44px] text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
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
