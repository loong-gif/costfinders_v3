'use client'

import { useCallback, useEffect, useState } from 'react'
import { BusinessInfo } from '@/components/features/businessInfo'
import { ClaimCTA } from '@/components/features/claimCTA'
import type { RevealedBusiness } from '@/lib/actions/claims'
import { getBusinessRevealAction } from '@/lib/actions/claims'
import { useAuth } from '@/lib/context/authContext'
import { useClaims } from '@/lib/context/claimsContext'
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
    revealed: boolean
    business: RevealedBusiness | null
  }>({ loading: false, revealed: false, business: null })

  const fetchRevealStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setRevealState({ loading: false, revealed: false, business: null })
      return
    }

    setRevealState((prev) => ({ ...prev, loading: true }))

    const result = await getBusinessRevealAction(Number(deal.id))

    setRevealState({
      loading: false,
      revealed: result.revealed,
      business: result.business ?? null,
    })
  }, [isAuthenticated, deal.id])

  useEffect(() => {
    if (authLoading) return
    fetchRevealStatus()
  }, [authLoading, fetchRevealStatus])

  // Show skeleton during auth loading or reveal check
  if (authLoading || revealState.loading) {
    return (
      <div className="rounded-2xl bg-[#f2ebe2] border border-[#d4c4b0] shadow-md p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-[#faf5ee] rounded w-3/4" />
          <div className="h-4 bg-[#faf5ee] rounded w-1/2" />
          <div className="h-10 bg-[#faf5ee] rounded w-full mt-4" />
        </div>
      </div>
    )
  }

  // User has an active claim — show revealed business details
  if (revealState.revealed && revealState.business) {
    return <BusinessInfo business={revealState.business} deal={deal} />
  }

  // No active claim (or not authenticated) — show CTA
  return (
    <ClaimCTA
      dealId={deal.id}
      businessId={deal.businessId}
      dealTitle={deal.title}
      isAuthenticated={isAuthenticated}
      onClaimSuccess={() => { fetchRevealStatus(); refreshClaims() }}
    />
  )
}
