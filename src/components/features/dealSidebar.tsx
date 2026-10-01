'use client'

import { Lock } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { BusinessInfo } from '@/components/features/businessInfo'
import { ClaimCTA } from '@/components/features/claimCTA'
import { getBusinessRevealAction } from '@/lib/actions/claims'
import { useAuth } from '@/lib/context/authContext'
import { useClaims } from '@/lib/context/claimsContext'
import type { ClaimClinic } from '@/types/claim'
import type { Deal } from '@/types/deal'

interface DealSidebarProps {
  deal: Deal
}

export function DealSidebar({ deal }: DealSidebarProps) {
  const { state } = useAuth()
  const { isAuthenticated, isLoading: authLoading } = state
  const { refreshClaims } = useClaims()

  const [revealState, setRevealState] = useState<{
    loading: boolean
    clinic: ClaimClinic | null
    claimedThisDeal: boolean
    membershipPlan: string | null
  }>({
    loading: false,
    clinic: null,
    claimedThisDeal: false,
    membershipPlan: null,
  })

  const fetchRevealStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setRevealState({
        loading: false,
        clinic: null,
        claimedThisDeal: false,
        membershipPlan: null,
      })
      return
    }

    setRevealState((prev) => ({ ...prev, loading: true }))

    const result = await getBusinessRevealAction(Number(deal.id))

    setRevealState({
      loading: false,
      clinic: result.revealed ? (result.clinic ?? null) : null,
      claimedThisDeal: result.claimedThisDeal ?? false,
      membershipPlan: result.revealed ? (result.membershipPlan ?? null) : null,
    })
  }, [isAuthenticated, deal.id])

  useEffect(() => {
    if (authLoading) return
    fetchRevealStatus()
  }, [authLoading, fetchRevealStatus])

  const onClaimSuccess = () => {
    fetchRevealStatus()
    refreshClaims()
  }

  // Show skeleton during auth loading or reveal check
  if (authLoading || revealState.loading) {
    return (
      <div className="rounded-xl bg-bg-elevated border border-border-default p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-bg-surface rounded w-3/4" />
          <div className="h-4 bg-bg-surface rounded w-1/2" />
          <div className="h-11 bg-bg-surface rounded-full w-full mt-4" />
        </div>
      </div>
    )
  }

  // Any claim by this visitor on this deal or on another deal from the same clinic reveals it,
  // whatever the claim's status or age.
  if (revealState.clinic) {
    return (
      <>
        <BusinessInfo
          clinic={revealState.clinic}
          claimedThisDeal={revealState.claimedThisDeal}
          membershipPlan={revealState.membershipPlan}
        />
        {!revealState.claimedThisDeal && (
          <ClaimCTA
            dealId={deal.id}
            businessId={deal.businessId}
            dealTitle={deal.title}
            isAuthenticated
            alreadyRevealed
            onClaimSuccess={onClaimSuccess}
          />
        )}
      </>
    )
  }

  // No claim (or not authenticated) — show CTA
  return (
    <ClaimCTA
      dealId={deal.id}
      businessId={deal.businessId}
      dealTitle={deal.title}
      isAuthenticated={isAuthenticated}
      onClaimSuccess={onClaimSuccess}
    />
  )
}

/**
 * The deal page's "how this works" note. Server-rendered for everyone; it goes away once this
 * visitor has claimed this deal or another from the same clinic (either reveals the clinic, see
 * getBusinessRevealAction), because "shown once you claim" is no longer true for them.
 */
export function DealTradeNote({
  dealId,
  businessId,
  className = '',
}: {
  dealId: string
  businessId: string
  /** Placement from the page's grid (DealDetailPage). */
  className?: string
}) {
  const { state } = useClaims()
  if (
    state.claims.some((c) => c.dealId === dealId || c.businessId === businessId)
  ) {
    return null
  }

  return (
    <p
      className={`flex items-start gap-2.5 text-sm text-text-secondary bg-bg-surface rounded-xl px-4 py-3 ${className}`}
    >
      <Lock
        size={16}
        weight="bold"
        className="mt-0.5 shrink-0 text-text-muted"
      />
      <span>
        Price and terms are public here. The clinic&apos;s name, address, phone
        number and Google rating are shown once you claim this deal with a free
        account, so you compare on price first and share your details only when
        you&apos;re ready.
      </span>
    </p>
  )
}
