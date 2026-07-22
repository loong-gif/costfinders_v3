'use client'

import nextDynamic from 'next/dynamic'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

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
