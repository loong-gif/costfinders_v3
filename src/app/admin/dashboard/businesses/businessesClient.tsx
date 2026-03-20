'use client'

import {
  CheckCircle,
  CurrencyDollar,
  MagnifyingGlass,
  Storefront,
  Tag,
} from '@phosphor-icons/react'
import { useCallback, useMemo, useState } from 'react'
import { BusinessTable } from '@/components/features/admin/businessTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Business, BusinessStatus, BusinessTier } from '@/types/business'

type FilterTab = 'all' | 'unclaimed' | 'free' | 'paid' | 'suspended'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Businesses' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
  { value: 'suspended', label: 'Suspended' },
]

interface MetricCardProps {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  value: string | number
  label: string
  highlight?: boolean
}

function MetricCard({ icon: Icon, value, label, highlight }: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-amber-800/8' : 'bg-amber-800/8'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-amber-800' : 'text-amber-800'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#451a03]">{value}</p>
        <p className="text-sm text-[#78350f]">{label}</p>
      </div>
    </Card>
  )
}

interface BusinessesManagementClientProps {
  initialBusinesses: Business[]
}

export function BusinessesManagementClient({
  initialBusinesses,
}: BusinessesManagementClientProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses)
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
          (b) => b.tier === 'unclaimed' && b.status !== 'suspended',
        )
        break
      case 'free':
        filtered = filtered.filter(
          (b) => b.tier === 'free' && b.status !== 'suspended',
        )
        break
      case 'paid':
        filtered = filtered.filter(
          (b) => b.tier === 'paid' && b.status !== 'suspended',
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
          b.city.toLowerCase().includes(query),
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
        (b) => b.tier === 'unclaimed' && b.status !== 'suspended',
      ).length,
      free: businesses.filter(
        (b) => b.tier === 'free' && b.status !== 'suspended',
      ).length,
      paid: businesses.filter(
        (b) => b.tier === 'paid' && b.status !== 'suspended',
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

    return {
      total,
      claimedPercent,
      paidCount,
    }
  }, [businesses])

  const handleStatusChange = useCallback(
    (businessId: string, status: BusinessStatus) => {
      // Client-side optimistic update (no Supabase write yet)
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? { ...b, status, updatedAt: new Date().toISOString() }
            : b,
        ),
      )
      showFeedback(
        status === 'suspended'
          ? 'Business has been suspended'
          : 'Business has been activated',
      )
    },
    [showFeedback],
  )

  const handleTierChange = useCallback(
    (businessId: string, tier: BusinessTier) => {
      // Client-side optimistic update (no Supabase write yet)
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? { ...b, tier, updatedAt: new Date().toISOString() }
            : b,
        ),
      )
      const tierLabel =
        tier === 'paid' ? 'Paid' : tier === 'free' ? 'Free' : 'Unclaimed'
      showFeedback(`Tier changed to ${tierLabel}`)
    },
    [showFeedback],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">
          Business Management
        </h1>
        <p className="text-[#78350f] mt-1">
          Manage business profiles ({businesses.length} from Supabase)
        </p>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-600/10 border border-success/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={Storefront}
          value={stats.total}
          label="Total Businesses"
        />
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

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
        />
        <input
          type="text"
          placeholder="Search by name or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
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
                activeFilter === tab.value ? 'bg-[#faf5ee]' : 'bg-[#f2ebe2]'
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
      <div className="text-sm text-[#92400e] text-center">
        Showing {filteredBusinesses.length} of {businesses.length} businesses
      </div>
    </div>
  )
}
