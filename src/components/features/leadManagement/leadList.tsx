'use client'

import {
  Calendar,
  Clock,
  Coins,
  CurrencyDollar,
  Envelope,
  MagnifyingGlass,
  Tag,
  Users,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ClaimStatusBadge } from '@/components/patterns/claimStatusBadge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getBusinessCredits,
  getClaimsForBusiness,
  getDealByIdDynamic as getDealById,
} from '@/lib/mock-data'
import type { Claim } from '@/types/claim'

type FilterTab = 'all' | 'pending' | 'active' | 'completed' | 'cancelled'

interface LeadListProps {
  businessId: string
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getCustomerDisplay(consumerId: string): string {
  // Extract number from consumer ID for display
  const num = consumerId.replace(/\D/g, '')
  return `Customer #${num || consumerId.slice(-3)}`
}

function getTabFilter(tab: FilterTab): (claim: Claim) => boolean {
  switch (tab) {
    case 'pending':
      return (c) => c.status === 'pending'
    case 'active':
      return (c) => c.status === 'contacted' || c.status === 'booked'
    case 'completed':
      return (c) => c.status === 'completed'
    case 'cancelled':
      return (c) => c.status === 'cancelled' || c.status === 'expired'
    default:
      return () => true
  }
}

export function LeadList({ businessId }: LeadListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Get current credits
  const credits = getBusinessCredits()

  // Get claims for this business
  const allClaims = useMemo(() => {
    return getClaimsForBusiness(businessId).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [businessId])

  // Filter claims based on tab and search
  const filteredClaims = useMemo(() => {
    let filtered = allClaims.filter(getTabFilter(activeTab))

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((claim) => {
        const deal = getDealById(claim.dealId)
        return (
          deal?.title.toLowerCase().includes(query) ||
          getCustomerDisplay(claim.consumerId).toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [allClaims, activeTab, searchQuery])

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allClaims.length,
      pending: allClaims.filter((c) => c.status === 'pending').length,
      active: allClaims.filter(
        (c) => c.status === 'contacted' || c.status === 'booked',
      ).length,
      completed: allClaims.filter((c) => c.status === 'completed').length,
      cancelled: allClaims.filter(
        (c) => c.status === 'cancelled' || c.status === 'expired',
      ).length,
    }
  }, [allClaims])

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#451a03]">Leads</h1>
          <p className="text-[#78350f] mt-1">
            Manage customer inquiries and bookings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Credits Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl">
            <Coins
              size={18}
              weight="fill"
              className={
                credits.available < 5 ? 'text-amber-800' : 'text-amber-800'
              }
            />
            <span className="text-sm font-medium text-[#451a03]">
              {credits.available} Credits
            </span>
          </div>
          {/* View Pricing Link */}
          <Link
            href="/business/dashboard/leads/pricing"
            className="flex items-center gap-2 px-3 py-2 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-sm font-medium text-[#78350f] hover:text-[#451a03] hover:border-[#d4c4b0]-hover transition-colors"
          >
            <CurrencyDollar size={18} weight="light" />
            <span>View Pricing</span>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <Card variant="glass" padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2
                  ${
                    activeTab === tab.id
                      ? 'bg-amber-800 text-white'
                      : 'bg-[#f2ebe2] text-[#78350f] hover:text-[#451a03] hover:bg-[#faf5ee]'
                  }
                `}
                type="button"
              >
                {tab.label}
                <span
                  className={`
                    px-1.5 py-0.5 rounded-md text-xs font-medium
                    ${activeTab === tab.id ? 'bg-[#faf5ee]' : 'bg-[#faf5ee]'}
                  `}
                >
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 sm:max-w-xs sm:ml-auto">
            <div className="relative">
              <MagnifyingGlass
                size={20}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
              />
              <Input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Leads List */}
      {filteredClaims.length === 0 ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <Envelope
              size={48}
              weight="light"
              className="mx-auto text-[#92400e] mb-4"
            />
            <h3 className="text-lg font-medium text-[#451a03] mb-2">
              {searchQuery ? 'No leads found' : 'No leads yet'}
            </h3>
            <p className="text-[#78350f] max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search query'
                : activeTab === 'all'
                  ? 'When customers claim your deals, their inquiries will appear here.'
                  : `No ${activeTab} leads at the moment.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClaims.map((claim) => {
            const deal = getDealById(claim.dealId)

            return (
              <Link
                key={claim.id}
                href={`/business/dashboard/leads/${claim.id}`}
              >
                <Card
                  variant="glass"
                  padding="lg"
                  className="hover:border-[#d4c4b0]-hover transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Customer & Deal Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                          <Users
                            size={20}
                            weight="fill"
                            className="text-amber-800"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#451a03]">
                            {getCustomerDisplay(claim.consumerId)}
                          </p>
                          {deal && (
                            <div className="flex items-center gap-1.5 text-sm text-[#78350f]">
                              <Tag
                                size={14}
                                weight="fill"
                                className="text-[#92400e] flex-shrink-0"
                              />
                              <span className="truncate">{deal.title}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preferred Date/Time */}
                      {(claim.preferredDate || claim.preferredTime) && (
                        <div className="flex items-center gap-4 text-sm text-[#78350f] ml-13">
                          {claim.preferredDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar
                                size={14}
                                weight="regular"
                                className="text-[#92400e]"
                              />
                              <span>
                                Requested: {formatDate(claim.preferredDate)}
                              </span>
                            </div>
                          )}
                          {claim.preferredTime && (
                            <div className="flex items-center gap-1.5">
                              <Clock
                                size={14}
                                weight="regular"
                                className="text-[#92400e]"
                              />
                              <span>{claim.preferredTime}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status & Created Date */}
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                      <ClaimStatusBadge status={claim.status} size="md" />
                      <p className="text-sm text-[#92400e]">
                        {formatRelativeTime(claim.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
