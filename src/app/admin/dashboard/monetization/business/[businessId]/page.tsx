'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  Storefront,
  Tag,
  CurrencyDollar,
  Users,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BusinessBillingOverride } from '@/components/features/admin/businessBillingOverride'
import { getBusinessById } from '@/lib/mock-data/businesses'
import { getDealsForBusiness } from '@/lib/mock-data/deals'
import type { BusinessTier } from '@/types/business'

interface PageProps {
  params: Promise<{ businessId: string }>
}

function getTierBadge(tier: BusinessTier) {
  switch (tier) {
    case 'paid':
      return <Badge variant="brand">Paid</Badge>
    case 'free':
      return <Badge variant="info">Free</Badge>
    case 'unclaimed':
    default:
      return <Badge variant="default">Unclaimed</Badge>
  }
}

export default function BusinessBillingPage({ params }: PageProps) {
  const { businessId } = use(params)
  const business = getBusinessById(businessId)

  if (!business) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-400/10 flex items-center justify-center mb-4">
            <Storefront size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-[#451a03] mb-2">
            Business Not Found
          </h2>
          <p className="text-[#78350f] mb-6">
            The business you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/admin/dashboard/businesses">
            <Button>View All Businesses</Button>
          </Link>
        </Card>
    )
  }

  // Mock stats
  const deals = getDealsForBusiness(business.id)
  const mockCredits = business.tier === 'paid' ? 45 : business.tier === 'free' ? 12 : 0
  const mockLeadsReceived = Math.floor(Math.random() * 50) + 10

  return (
    <div className="space-y-6">
      {/* Business Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-800/8 flex items-center justify-center">
            <Storefront size={28} weight="fill" className="text-amber-800" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#451a03]">{business.name}</h1>
              {getTierBadge(business.tier)}
            </div>
            <p className="text-[#78350f]">
              {business.address}, {business.city}, {business.state}
            </p>
          </div>
        </div>

        <Link href={`/admin/dashboard/businesses`}>
          <Button variant="secondary" size="sm">
            View Business Profile
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="glass" padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <Tag size={20} weight="fill" className="text-amber-800" />
            </div>
            <div>
              <p className="text-sm text-[#78350f]">Active Deals</p>
              <p className="text-xl font-bold text-[#451a03]">{deals.length}</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center">
              <CurrencyDollar size={20} weight="fill" className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-[#78350f]">Credits Available</p>
              <p className="text-xl font-bold text-[#451a03]">{mockCredits}</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users size={20} weight="fill" className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-[#78350f]">Leads Received</p>
              <p className="text-xl font-bold text-[#451a03]">{mockLeadsReceived}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Billing Override Component */}
      <BusinessBillingOverride business={business} />
    </div>
  )
}
