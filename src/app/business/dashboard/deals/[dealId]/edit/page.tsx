'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DealForm } from '@/components/features/dealManagement/dealForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getDealByIdForBusinessAction } from '@/lib/actions/deal-management'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { OfferView } from '@/types/supabase'

export default function EditDealPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.dealId as string
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  const [deal, setDeal] = useState<OfferView | null | undefined>(undefined)
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
        <p className="text-text-secondary">
          No business linked to your account.
        </p>
      </div>
    )
  }

  // Loading state
  if (deal === undefined) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <svg
            aria-hidden="true"
            className="animate-spin h-8 w-8 text-accent"
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
          <p className="text-text-secondary">Loading deal...</p>
        </div>
      </div>
    )
  }

  // Deal not found or access denied
  if (deal === null) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-text-primary mb-2">
            {loadError === 'Deal not found.'
              ? 'Deal not found'
              : "Couldn't load this deal"}
          </h2>
          <p className="text-text-secondary mb-6">
            {loadError ??
              'The deal you are looking for does not exist or has been deleted.'}
          </p>
          <Button onClick={() => router.push('/business/dashboard/deals')}>
            Back to deals
          </Button>
        </div>
      </Card>
    )
  }

  return <DealForm businessId={businessId} deal={deal} />
}
