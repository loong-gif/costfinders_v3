'use client'

import { LeadList } from '@/components/features/leadManagement/leadList'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

export default function LeadsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  return <LeadList businessId={businessId} />
}
