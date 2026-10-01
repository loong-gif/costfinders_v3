'use client'

import { DealList } from '@/components/features/dealManagement/dealList'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

export default function DealsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  // The dashboard layout renders its own screen for an account with no approved business, so
  // this only covers the render before the owner loads.
  if (!businessId) return null

  return <DealList businessId={businessId} />
}
