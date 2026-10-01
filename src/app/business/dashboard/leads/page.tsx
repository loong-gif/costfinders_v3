'use client'

import { LeadList } from '@/components/features/leadManagement/leadList'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

export default function LeadsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  // The dashboard layout renders its own screen for an account with no approved business, so
  // this only covers the render before the owner loads.
  if (!businessId) return null

  return <LeadList businessId={businessId} />
}
