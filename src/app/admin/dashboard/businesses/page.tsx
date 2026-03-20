'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  MagnifyingGlass,
  Storefront,
  CurrencyDollar,
  Tag,
  CheckCircle,
} from '@phosphor-icons/react'
import type { BusinessStatus, BusinessTier } from '@/types/business'
import {
  getAllBusinesses,
  updateBusinessStatus,
  updateBusinessTier,
} from '@/lib/mock-data/businesses'
import { getDealsForBusiness } from '@/lib/mock-data/deals'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BusinessTable } from '@/components/features/admin/businessTable'

type FilterTab = 'all' | 'unclaimed' | 'free' | 'paid' | 'suspended'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Businesses' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
  { value: 'suspended', label: 'Suspended' },
]

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number; weight?: 'light' | 'fill'; className?: string }>
  value: string | number
  label: string
  highlight?: boolean
}

function MetricCard({ icon: Icon, value, label, highlight }: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-amber-400/10' : 'bg-amber-400/10'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-amber-400' : 'text-amber-400'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-stone-100">{value}</p>
        <p className="text-sm text-stone-400">{label}</p>
      </div>
    </Card>
  )
}

export default function BusinessesManagementPage() {
  const [businesses, setBusinesses] = useState(() => getAllBusinesses())
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Show feedback briefly then clear
  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  // Filter businesses based on active tab and search
  const filteredBusinesses = useMemo(() => {
    let filtered = businesses

    // Filter by tab
    switch (activeFilter) {
      case 'unclaimed':
        filtered = filtered.filter(
          (b) => b.tier === 'unclaimed' && b.status !== 'suspended'
        )
        break
      case 'free':
        filtered = filtered.filter(
          (b) => b.tier === 'free' && b.status !== 'suspended'
        )
        break
      case 'paid':
        filtered = filtered.filter(
          (b) => b.tier === 'paid' && b.status !== 'suspended'
        )
        break
      case 'suspended':
        filtered = filtered.filter((b) => b.status === 'suspended')
        break
      // 'all' shows everything
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.city.toLowerCase().includes(query)
      )
    }

    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [businesses, activeFilter, searchQuery])

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: businesses.length,
      unclaimed: businesses.filter(
        (b) => b.tier === 'unclaimed' && b.status !== 'suspended'
      ).length,
      free: businesses.filter(
        (b) => b.tier === 'free' && b.status !== 'suspended'
      ).length,
      paid: businesses.filter(
        (b) => b.tier === 'paid' && b.status !== 'suspended'
      ).length,
      suspended: businesses.filter((b) => b.status === 'suspended').length,
    }
  }, [businesses])

  // Calculate stats
  const stats = useMemo(() => {
    const total = businesses.length
    const claimed = businesses.filter((b) => b.claimedAt).length
    const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0
    const paidCount = businesses.filter((b) => b.tier === 'paid').length

    // Calculate unclaimed with deals
    const unclaimedWithDeals = businesses.filter((b) => {
      if (b.tier !== 'unclaimed') return false
      const deals = getDealsForBusiness(b.id)
      return deals.length > 0
    })
    const unclaimedDealsTotal = unclaimedWithDeals.reduce((acc, b) => {
      return acc + getDealsForBusiness(b.id).length
    }, 0)

    return { total, claimedPercent, paidCount, unclaimedWithDeals: unclaimedWithDeals.length, unclaimedDealsTotal }
  }, [businesses])

  const handleStatusChange = useCallback(
    (businessId: string, status: BusinessStatus) => {
      const updated = updateBusinessStatus(businessId, status)
      if (updated) {
        setBusinesses(getAllBusinesses())
        showFeedback(
          status === 'suspended'
            ? `${updated.name} has been suspended`
            : `${updated.name} has been activated`
        )
      }
    },
    [showFeedback]
  )

  const handleTierChange = useCallback(
    (businessId: string, tier: BusinessTier) => {
      const updated = updateBusinessTier(businessId, tier)
      if (updated) {
        setBusinesses(getAllBusinesses())
        const tierLabel = tier === 'paid' ? 'Paid' : tier === 'free' ? 'Free' : 'Unclaimed'
        showFeedback(`${updated.name} tier changed to ${tierLabel}`)
      }
    },
    [showFeedback]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Business Management</h1>
        <p className="text-stone-400 mt-1">Manage business profiles</p>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-400/10 border border-success/20 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={Storefront} value={stats.total} label="Total Businesses" />
        <MetricCard
          icon={CheckCircle}
          value={`${stats.claimedPercent}%`}
          label="Claimed Rate"
        />
        <MetricCard
          icon={CurrencyDollar}
          value={stats.paidCount}
          label="Paid Tier"
          highlight={stats.paidCount > 0}
        />
      </div>

      {/* Quick Insight */}
      {stats.unclaimedWithDeals > 0 && (
        <Card variant="glass" padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
              <Tag size={20} weight="fill" className="text-amber-400" />
            </div>
            <p className="text-sm text-stone-400">
              <span className="text-stone-100 font-medium">
                {stats.unclaimedWithDeals} unclaimed businesses
              </span>{' '}
              have {stats.unclaimedDealsTotal} total deals waiting to be claimed
            </p>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
        />
        <input
          type="text"
          placeholder="Search by name or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeFilter === tab.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveFilter(tab.value)}
            className="gap-2"
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === tab.value ? 'bg-stone-800' : 'bg-stone-900'
              }`}
            >
              {tabCounts[tab.value]}
            </span>
          </Button>
        ))}
      </div>

      {/* Business Table */}
      <BusinessTable
        businesses={filteredBusinesses}
        onStatusChange={handleStatusChange}
        onTierChange={handleTierChange}
      />

      {/* Pagination placeholder */}
      <div className="text-sm text-stone-500 text-center">
        Showing {filteredBusinesses.length} of {businesses.length} businesses
      </div>
    </div>
  )
}
