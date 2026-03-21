'use client'

import { SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { use, useCallback, useEffect, useState } from 'react'
import { LeadDetail } from '@/components/features/leadManagement/leadDetail'
import { Card } from '@/components/ui/card'
import { getClaimByIdForBusinessAction } from '@/lib/actions/business-claims'
import type { ClaimRow } from '@/lib/actions/claims'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

interface LeadDetailPageProps {
  params: Promise<{ claimId: string }>
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { claimId } = use(params)
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  const [claim, setClaim] = useState<ClaimRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClaim = useCallback(async () => {
    if (!businessId) return

    setIsLoading(true)
    setError(null)

    const result = await getClaimByIdForBusinessAction(
      claimId,
      Number(businessId),
    )

    if (!result.success) {
      setError(result.error ?? 'Failed to load lead')
      setIsLoading(false)
      return
    }

    if (!result.claim) {
      setError('Lead not found')
      setIsLoading(false)
      return
    }

    setClaim(result.claim)
    setIsLoading(false)
  }, [claimId, businessId])

  useEffect(() => {
    loadClaim()
  }, [loadClaim])

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <SpinnerGap
            size={48}
            weight="light"
            className="mx-auto text-[#92400e] mb-4 animate-spin"
          />
          <p className="text-[#78350f]">Loading lead details...</p>
        </div>
      </Card>
    )
  }

  if (error || !claim) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <WarningCircle
            size={48}
            weight="light"
            className="mx-auto text-amber-800 mb-4"
          />
          <h3 className="text-lg font-medium text-[#451a03] mb-2">
            {error === 'Claim not found.' || error === 'Lead not found'
              ? 'Lead not found'
              : 'Unable to load lead'}
          </h3>
          <p className="text-[#78350f] max-w-sm mx-auto">
            {error ?? 'The lead could not be found.'}
          </p>
        </div>
      </Card>
    )
  }

  return <LeadDetail claim={claim} businessId={businessId} />
}
