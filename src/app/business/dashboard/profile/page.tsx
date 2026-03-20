'use client'

import { BusinessProfileForm } from '@/components/features/businessProfileForm'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

export default function BusinessProfilePage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to this account.</p>
      </div>
    )
  }

  return <BusinessProfileForm businessId={businessId} />
}
