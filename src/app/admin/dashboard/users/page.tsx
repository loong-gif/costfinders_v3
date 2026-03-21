'use client'

import {
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Prohibit,
  Spinner,
  Users,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConsumerTable } from '@/components/features/admin/consumerTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getConsumersAction,
  updateConsumerStatusAction,
} from '@/lib/actions/admin-user-actions'
import type { Profile } from '@/lib/actions/profile'

type FilterTab = 'all' | 'verified' | 'unverified' | 'suspended'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
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

function isVerified(status: string): boolean {
  return (
    status === 'fully_verified' ||
    status === 'email_verified' ||
    status === 'phone_verified'
  )
}

export default function UsersManagementPage() {
  const [consumers, setConsumers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Load consumers from Supabase
  const loadConsumers = useCallback(async () => {
    const result = await getConsumersAction()
    if (result.success && result.consumers) {
      setConsumers(result.consumers)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadConsumers()
  }, [loadConsumers])

  // Show feedback briefly then clear
  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  // Filter consumers based on active tab and search
  const filteredConsumers = useMemo(() => {
    let filtered = consumers

    // Filter by tab
    switch (activeFilter) {
      case 'verified':
        filtered = filtered.filter(
          (c) => isVerified(c.verification_status) && c.status === 'active',
        )
        break
      case 'unverified':
        filtered = filtered.filter(
          (c) =>
            c.verification_status === 'unverified' && c.status === 'active',
        )
        break
      case 'suspended':
        filtered = filtered.filter((c) => c.status === 'suspended')
        break
      // 'all' shows everything
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(query) ||
          c.last_name?.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query),
      )
    }

    // Already sorted by created_at DESC from the server action
    return filtered
  }, [consumers, activeFilter, searchQuery])

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: consumers.length,
      verified: consumers.filter(
        (c) => isVerified(c.verification_status) && c.status === 'active',
      ).length,
      unverified: consumers.filter(
        (c) =>
          c.verification_status === 'unverified' && c.status === 'active',
      ).length,
      suspended: consumers.filter((c) => c.status === 'suspended').length,
    }
  }, [consumers])

  // Calculate stats
  const stats = useMemo(() => {
    const total = consumers.length
    const verified = consumers.filter((c) =>
      isVerified(c.verification_status),
    ).length
    const newThisWeek = consumers.filter((c) => {
      const createdDate = new Date(c.created_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return createdDate >= weekAgo
    }).length

    return { total, verified, newThisWeek }
  }, [consumers])

  const handleStatusChange = useCallback(
    async (consumerId: string, status: 'active' | 'suspended') => {
      const consumer = consumers.find((c) => c.id === consumerId)
      const result = await updateConsumerStatusAction(consumerId, status)
      if (result.success) {
        // Reload consumers from server
        await loadConsumers()
        const name =
          consumer?.first_name || consumer?.last_name
            ? `${consumer?.first_name || ''} ${consumer?.last_name || ''}`.trim()
            : consumerId.slice(0, 8)
        showFeedback(
          status === 'suspended'
            ? `${name} has been suspended`
            : `${name} has been activated`,
        )
      } else {
        showFeedback(`Error: ${result.error || 'Failed to update status'}`)
      }
    },
    [consumers, loadConsumers, showFeedback],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} className="animate-spin text-amber-800" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">User Management</h1>
        <p className="text-[#78350f] mt-1">Manage consumer accounts</p>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-600/10 border border-success/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={Users} value={stats.total} label="Total Users" />
        <MetricCard
          icon={CheckCircle}
          value={stats.verified}
          label="Verified Users"
        />
        <MetricCard
          icon={Clock}
          value={stats.newThisWeek}
          label="New This Week"
          highlight={stats.newThisWeek > 0}
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
          placeholder="Search by name..."
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
            {tab.value === 'suspended' && <Prohibit size={14} />}
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

      {/* Consumer Table */}
      <ConsumerTable
        consumers={filteredConsumers}
        onStatusChange={handleStatusChange}
      />

      {/* Pagination placeholder */}
      <div className="text-sm text-[#92400e] text-center">
        Showing {filteredConsumers.length} of {consumers.length} users
      </div>
    </div>
  )
}
