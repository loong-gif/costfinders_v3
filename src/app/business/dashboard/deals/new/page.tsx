'use client'

import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { DealForm } from '@/components/features/dealManagement/dealForm'

export default function NewDealPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  return <DealForm businessId={businessId} mode="create" />
}
