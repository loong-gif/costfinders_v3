'use client'

import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { DealList } from '@/components/features/dealManagement/dealList'

export default function DealsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  return <DealList businessId={businessId} />
}
