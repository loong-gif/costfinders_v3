'use client'

import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { AnalyticsDashboard } from '@/components/features/analytics/analyticsDashboard'

export default function AnalyticsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-400">No business linked to your account.</p>
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
