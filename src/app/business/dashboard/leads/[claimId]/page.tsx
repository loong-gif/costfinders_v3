'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { LeadDetail } from '@/components/features/leadManagement/leadDetail'
import { getClaimByIdDynamic, getClaimsForBusiness } from '@/lib/mock-data'

interface LeadDetailPageProps {
  params: Promise<{ claimId: string }>
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { claimId } = use(params)
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-400">No business linked to your account.</p>
      </div>
    )
  }

  // Get the claim and verify it belongs to this business
  const claim = getClaimByIdDynamic(claimId)

  if (!claim) {
    notFound()
  }

  // Verify this claim belongs to a deal owned by this business
  const businessClaims = getClaimsForBusiness(businessId)
  const isOwner = businessClaims.some((c) => c.id === claim.id)

  if (!isOwner) {
    notFound()
  }

  return <LeadDetail claim={claim} businessId={businessId} />
}
