'use client'

import { Badge } from '@/components/ui/badge'
import type { ClaimStatus } from '@/types/claim'

interface ClaimStatusBadgeProps {
  status: ClaimStatus
  size?: 'sm' | 'md'
}

const statusConfig: Record<
  ClaimStatus,
  { variant: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }
> = {
  pending: { variant: 'warning', label: 'Pending' },
  contacted: { variant: 'info', label: 'Contacted' },
  booked: { variant: 'success', label: 'Booked' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
  expired: { variant: 'default', label: 'Expired' },
}

export function ClaimStatusBadge({ status, size = 'sm' }: ClaimStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  )
}
