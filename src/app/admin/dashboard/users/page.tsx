'use client'

import { useState, useMemo, useCallback } from 'react'
import { MagnifyingGlass, Users, CheckCircle, Clock, Prohibit } from '@phosphor-icons/react'
import type { ConsumerStatus, VerificationStatus } from '@/types/consumer'
import {
  getAllConsumers,
  updateConsumerStatus,
} from '@/lib/mock-data/consumers'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConsumerTable } from '@/components/features/admin/consumerTable'

type FilterTab = 'all' | 'verified' | 'unverified' | 'suspended'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
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
          highlight ? 'bg-warning/10' : 'bg-brand-primary/10'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-warning-text' : 'text-brand-primary'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </Card>
  )
}

function isVerified(status: VerificationStatus): boolean {
  return status === 'fully_verified' || status === 'email_verified' || status === 'phone_verified'
}

export default function UsersManagementPage() {
  const [consumers, setConsumers] = useState(() => getAllConsumers())
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

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
          (c) => isVerified(c.verificationStatus) && c.status === 'active'
        )
        break
      case 'unverified':
        filtered = filtered.filter(
          (c) => c.verificationStatus === 'unverified' && c.status === 'active'
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
          c.email.toLowerCase().includes(query) ||
          (c.firstName && c.firstName.toLowerCase().includes(query)) ||
          (c.lastName && c.lastName.toLowerCase().includes(query))
      )
    }

    // Sort by createdAt descending (newest first)
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [consumers, activeFilter, searchQuery])

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: consumers.length,
      verified: consumers.filter(
        (c) => isVerified(c.verificationStatus) && c.status === 'active'
      ).length,
      unverified: consumers.filter(
        (c) => c.verificationStatus === 'unverified' && c.status === 'active'
      ).length,
      suspended: consumers.filter((c) => c.status === 'suspended').length,
    }
  }, [consumers])

  // Calculate stats
  const stats = useMemo(() => {
    const total = consumers.length
    const verified = consumers.filter((c) => isVerified(c.verificationStatus)).length
    // Mock "new this week" - in real app would filter by date
    const newThisWeek = consumers.filter((c) => {
      const createdDate = new Date(c.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return createdDate >= weekAgo
    }).length

    return { total, verified, newThisWeek }
  }, [consumers])

  const handleStatusChange = useCallback(
    (consumerId: string, status: ConsumerStatus) => {
      const updated = updateConsumerStatus(consumerId, status)
      if (updated) {
        setConsumers(getAllConsumers())
        const name =
          updated.firstName || updated.lastName
            ? `${updated.firstName || ''} ${updated.lastName || ''}`.trim()
            : updated.email
        showFeedback(
          status === 'suspended'
            ? `${name} has been suspended`
            : `${name} has been activated`
        )
      }
    },
    [showFeedback]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
        <p className="text-text-secondary mt-1">Manage consumer accounts</p>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-success/10 border border-success/20 text-success-text px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={Users} value={stats.total} label="Total Users" />
        <MetricCard icon={CheckCircle} value={stats.verified} label="Verified Users" />
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
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-glass-bg border border-glass-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
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
                activeFilter === tab.value ? 'bg-white/20' : 'bg-glass-bg'
              }`}
            >
              {tabCounts[tab.value]}
            </span>
          </Button>
        ))}
      </div>

      {/* Consumer Table */}
      <ConsumerTable consumers={filteredConsumers} onStatusChange={handleStatusChange} />

      {/* Pagination placeholder */}
      <div className="text-sm text-text-tertiary text-center">
        Showing {filteredConsumers.length} of {consumers.length} users
      </div>
    </div>
  )
}
