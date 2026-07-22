'use client'

import nextDynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getDealByIdForBusinessAction } from '@/lib/actions/deal-management'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { Offer } from '@/types/supabase'

const DealForm = nextDynamic(
  () =>
    import('@/components/features/dealManagement/dealForm').then(
      (m) => m.DealForm,
    ),
  {
    loading: () => (
      <div className="h-96 animate-pulse rounded-2xl bg-[#faf5ee]" />
    ),
  },
)

export default function EditDealPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.dealId as string
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  const [deal, setDeal] = useState<Offer | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDeal() {
      if (!dealId || !businessId) return

      const result = await getDealByIdForBusinessAction(
        Number(dealId),
        Number(businessId),
      )

      if (result.success && result.deal) {
        setDeal(result.deal)
      } else {
        setLoadError(result.error ?? null)
        setDeal(null)
      }
    }

    loadDeal()
  }, [dealId, businessId])

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  // Loading state
  if (deal === undefined) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-amber-800"
            viewBox="0 0 24 24"
          >
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

  // Deal not found or access denied
  if (deal === null) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-[#451a03] mb-2">
            {loadError === 'Deal not found.'
              ? 'Deal Not Found'
              : 'Cannot Load Deal'}
          </h2>
          <p className="text-[#78350f] mb-6">
            {loadError ??
              'The deal you are looking for does not exist or has been deleted.'}
          </p>
          <Button onClick={() => router.push('/business/dashboard/deals')}>
            Back to Deals
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <DealForm
      businessId={businessId}
      existingDeal={deal}
      existingDealId={deal.id}
      mode="edit"
    />
  )
}
