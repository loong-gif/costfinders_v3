'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getDealById } from '@/lib/mock-data/deals'
import { DealForm } from '@/components/features/dealManagement/dealForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Deal } from '@/types/deal'

export default function EditDealPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.dealId as string
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  const [deal, setDeal] = useState<Deal | null | undefined>(undefined)

  useEffect(() => {
    if (dealId) {
      const foundDeal = getDealById(dealId)
      setDeal(foundDeal || null)
    }
  }, [dealId])

  // Loading state
  if (deal === undefined) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-amber-800" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[#78350f]">Loading deal...</p>
        </div>
      </div>
    )
  }

  // Deal not found
  if (deal === null) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-[#451a03] mb-2">
            Deal Not Found
          </h2>
          <p className="text-[#78350f] mb-6">
            The deal you are looking for does not exist or has been deleted.
          </p>
          <Button onClick={() => router.push('/business/dashboard/deals')}>
            Back to Deals
          </Button>
        </div>
      </Card>
    )
  }

  // Check if deal belongs to this business
  if (deal.businessId !== businessId) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-[#451a03] mb-2">
            Access Denied
          </h2>
          <p className="text-[#78350f] mb-6">
            You do not have permission to edit this deal.
          </p>
          <Button onClick={() => router.push('/business/dashboard/deals')}>
            Back to Deals
          </Button>
        </div>
      </Card>
    )
  }

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  return <DealForm businessId={businessId} existingDeal={deal} mode="edit" />
}
