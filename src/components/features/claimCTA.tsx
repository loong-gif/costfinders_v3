'use client'

import { useState } from 'react'
import { CheckCircle, Clock, Lock, Sparkle, UserPlus } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/features/authModal'
import { ClaimDealModal } from '@/components/features/claimDealModal'
import { useAuth } from '@/lib/context/authContext'
import { useClaims } from '@/lib/context/claimsContext'

type AuthView = 'signUp' | 'signIn'

interface ClaimCTAProps {
  dealId: string
  businessId: string
  dealTitle: string
}

export function ClaimCTA({ dealId, businessId, dealTitle }: ClaimCTAProps) {
  const { state: authState } = useAuth()
  const { getClaimByDealId } = useClaims()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<AuthView>('signUp')

  const existingClaim = getClaimByDealId(dealId)
  const isAuthenticated = authState.isAuthenticated
  const isVerified =
    authState.user?.verificationStatus === 'email_verified' ||
    authState.user?.verificationStatus === 'fully_verified' ||
    authState.user?.verificationStatus === 'phone_verified'

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

  // Already claimed state
  if (existingClaim) {
    return (
      <Card variant="glass" padding="lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600/10 flex items-center justify-center">
            <CheckCircle size={32} weight="fill" className="text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#451a03]">
              Already Claimed
            </h3>
            <p className="text-sm text-[#78350f]">
              You&apos;ve already submitted a claim for this deal.
            </p>
          </div>
          <div className="w-full p-3 bg-[#faf5ee] rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} weight="regular" className="text-[#92400e]" />
              <span className="text-[#78350f]">
                Status:{' '}
                <span className="text-[#451a03] capitalize">
                  {existingClaim.status}
                </span>
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={() => (window.location.href = '/dashboard/claims')}
          >
            View My Claims
          </Button>
        </div>
      </Card>
    )
  }

  // Authenticated and verified - can claim
  if (isAuthenticated && isVerified) {
    return (
      <>
        <Card variant="glass" padding="lg">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center">
              <Sparkle size={32} weight="fill" className="text-amber-800" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#451a03]">
                Ready to Claim
              </h3>
              <p className="text-sm text-[#78350f]">
                Submit your claim and the business will contact you to schedule your appointment.
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
        />
      </>
    )
  }

  // Authenticated but not verified - needs verification
  if (isAuthenticated && !isVerified) {
    return (
      <Card variant="glass" padding="lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center">
            <Lock size={32} weight="fill" className="text-amber-800" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#451a03]">
              Verification Required
            </h3>
            <p className="text-sm text-[#78350f]">
              Please verify your email or phone to claim this deal.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => (window.location.href = '/dashboard/settings')}
            type="button"
          >
            Complete Verification
          </Button>
        </div>
      </Card>
    )
  }

  // Not authenticated - show auth wall
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
              className="text-sm text-amber-800 hover:text-amber-300 transition-colors"
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
