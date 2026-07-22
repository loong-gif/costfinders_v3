'use client'

import nextDynamic from 'next/dynamic'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

const AnalyticsDashboard = nextDynamic(
  () =>
    import('@/components/features/analytics/analyticsDashboard').then(
      (m) => m.AnalyticsDashboard,
    ),
  {
    loading: () => (
      <div className="h-96 animate-pulse rounded-2xl bg-[#faf5ee]" />
    ),
  },
)

export default function AnalyticsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard */}
      <AnalyticsDashboard />
    </div>
  )
}
