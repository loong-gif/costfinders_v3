'use client'

import { useAuth } from '@/lib/context/authContext'
import { getBusinessForDeal } from '@/lib/mock-data'
import { ClaimCTA } from '@/components/features/claimCTA'
import { BusinessInfo } from '@/components/features/businessInfo'
import type { Deal } from '@/types/deal'

interface DealSidebarProps {
  deal: Deal
}

export function DealSidebar({ deal }: DealSidebarProps) {
  const { state } = useAuth()
  const { isAuthenticated, user, isLoading } = state

  // Determine if user is verified (any verification level)
  const isVerified =
    user?.verificationStatus === 'email_verified' ||
    user?.verificationStatus === 'phone_verified' ||
    user?.verificationStatus === 'fully_verified'

  // Show skeleton during loading
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#f2ebe2] border border-[#d4c4b0] shadow-md p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-[#faf5ee] rounded w-3/4" />
          <div className="h-4 bg-[#faf5ee] rounded w-1/2" />
          <div className="h-10 bg-[#faf5ee] rounded w-full mt-4" />
        </div>
      </div>
    )
  }

  // Show BusinessInfo for authenticated + verified users
  if (isAuthenticated && isVerified) {
    const business = getBusinessForDeal(deal.id)

    if (business) {
      return <BusinessInfo business={business} deal={deal} />
    }
  }

  // Default: show auth wall for anonymous or unverified users
  return (
    <ClaimCTA
      dealId={deal.id}
      businessId={deal.businessId}
      dealTitle={deal.title}
    />
  )
}
