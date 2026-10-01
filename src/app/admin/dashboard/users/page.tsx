'use client'

import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Prohibit,
  Users,
  Warning,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConsumerTable } from '@/components/features/admin/consumerTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import {
  type AdminConsumer,
  getConsumersAction,
  updateConsumerStatusAction,
} from '@/lib/actions/admin-user-actions'

type FilterTab = 'all' | 'verified' | 'unverified' | 'suspended'

interface Feedback {
  tone: 'success' | 'error'
  text: string
}

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All users' },
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
  value: number
  label: string
  isLoading?: boolean
  highlight?: boolean
}

function MetricCard({
  icon: Icon,
  value,
  label,
  isLoading,
  highlight,
}: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div
        className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-accent-muted' : 'bg-accent-muted'
        }`}
      >
        <Icon size={24} weight="fill" className="text-text-secondary" />
      </div>
      <div>
        {isLoading ? (
          <div className="h-7 w-12 rounded-lg bg-bg-surface animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-text-primary">
            {value.toLocaleString('en-US')}
          </p>
        )}
        <p className="text-sm text-text-secondary">{label}</p>
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

function consumerLabel(
  consumer: AdminConsumer | undefined,
  fallbackId: string,
) {
  const name = consumer
    ? `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim()
    : ''
  return name || consumer?.email || `User ${fallbackId.slice(0, 8)}`
}

interface PendingStatusChange {
  consumer: AdminConsumer
  status: 'active' | 'suspended'
}

export default function UsersManagementPage() {
  const [consumers, setConsumers] = useState<AdminConsumer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingChange, setPendingChange] =
    useState<PendingStatusChange | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Load consumers from Supabase
  const loadConsumers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await getConsumersAction()
    if (result.success && result.consumers) {
      setConsumers(result.consumers)
    } else {
      // A failed read used to fall through to an empty list, which rendered as
      // "No users found" — an admin cannot tell a real empty table from an outage.
      setConsumers([])
      setLoadError(result.error ?? 'Something went wrong.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadConsumers()
  }, [loadConsumers])

  // Show feedback briefly then clear
  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), 5000)
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
          c.email?.toLowerCase().includes(query) ||
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
        (c) => c.verification_status === 'unverified' && c.status === 'active',
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

  // The table only asks; nothing is written until the admin confirms in the dialog.
  const requestStatusChange = useCallback(
    (consumerId: string, status: 'active' | 'suspended') => {
      const consumer = consumers.find((c) => c.id === consumerId)
      if (consumer) setPendingChange({ consumer, status })
    },
    [consumers],
  )

  const confirmStatusChange = useCallback(async () => {
    if (!pendingChange) return
    const { consumer, status } = pendingChange
    const consumerId = consumer.id
    const name = consumerLabel(consumer, consumerId)

    setIsSaving(true)
    const result = await updateConsumerStatusAction(consumerId, status)
    setIsSaving(false)
    setPendingChange(null)
    if (result.success) {
      await loadConsumers()
      showFeedback({
        tone: 'success',
        text:
          status === 'suspended'
            ? `${name} is now suspended`
            : `${name} is active again`,
      })
    } else {
      showFeedback({
        tone: 'error',
        text: `Couldn't update ${name}. ${result.error ?? 'Please try again.'}`,
      })
    }
  }, [pendingChange, loadConsumers, showFeedback])

  const isFiltered = activeFilter !== 'all' || searchQuery.trim() !== ''

  const clearFilters = () => {
    setActiveFilter('all')
    setSearchQuery('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          User management
        </h1>
        <p className="text-text-secondary mt-1">
          Review consumer accounts, and suspend or reinstate them
        </p>
      </div>

      <Modal
        isOpen={pendingChange !== null}
        onClose={() => (isSaving ? undefined : setPendingChange(null))}
        title={
          pendingChange?.status === 'suspended'
            ? 'Suspend this user?'
            : 'Reinstate this user?'
        }
        size="sm"
      >
        {pendingChange && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {consumerLabel(
                  pendingChange.consumer,
                  pendingChange.consumer.id,
                )}
              </span>
              {pendingChange.consumer.email
                ? ` (${pendingChange.consumer.email})`
                : ''}
              {pendingChange.status === 'suspended'
                ? " won't be able to claim deals until you reinstate them. They can still sign in, and their existing claims stay as they are."
                : ' will be able to claim deals again.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingChange(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant={
                  pendingChange.status === 'suspended' ? 'danger' : 'primary'
                }
                size="sm"
                onClick={confirmStatusChange}
                isLoading={isSaving}
                disabled={isSaving}
              >
                {pendingChange.status === 'suspended'
                  ? 'Suspend user'
                  : 'Reinstate user'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
            feedback.tone === 'error'
              ? 'bg-error-bg border border-error/20 text-error'
              : 'bg-success-bg border border-success/20 text-success'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={Users}
          value={stats.total}
          label="Total users"
          isLoading={loading}
        />
        <MetricCard
          icon={CheckCircle}
          value={stats.verified}
          label="Verified users"
          isLoading={loading}
        />
        <MetricCard
          icon={Clock}
          value={stats.newThisWeek}
          label="New this week"
          isLoading={loading}
          highlight={stats.newThisWeek > 0}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          aria-label="Search users by name, email or ID"
          placeholder="Search by name, email or user ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={loading || consumers.length === 0}
          className="w-full min-h-[44px] bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border-accent disabled:opacity-60"
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
            disabled={loading}
            className="gap-2"
          >
            {tab.value === 'suspended' && <Prohibit size={14} />}
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === tab.value
                  ? 'bg-bg-elevated text-text-primary'
                  : 'bg-bg-surface'
              }`}
            >
              {tabCounts[tab.value]}
            </span>
          </Button>
        ))}
      </div>

      {/* Loading skeleton — mirrors the table rows it replaces */}
      {loading && (
        <Card variant="glass" padding="none">
          <div className="divide-y divide-border-default">
            {['a', 'b', 'c', 'd', 'e'].map((key) => (
              <div key={key} className="flex items-center gap-4 p-4">
                <div className="w-8 h-8 rounded-full bg-bg-surface animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 max-w-full rounded bg-bg-surface animate-pulse" />
                  <div className="h-3 w-28 max-w-full rounded bg-bg-surface animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Load failure */}
      {!loading && loadError && (
        <Card variant="glass" padding="lg" className="text-center">
          <Warning
            size={40}
            weight="light"
            className="text-text-secondary mx-auto mb-3"
          />
          <p className="font-medium text-text-primary">
            Couldn&apos;t load user accounts
          </p>
          <p className="text-sm text-text-secondary mt-1 mb-4">
            {loadError} No accounts were changed — try loading them again.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadConsumers}
            className="gap-1.5"
          >
            <ArrowClockwise size={16} />
            Try again
          </Button>
        </Card>
      )}

      {/* Genuinely no accounts yet */}
      {!(loading || loadError) && consumers.length === 0 && (
        <Card variant="glass" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4">
            <Users size={32} weight="light" className="text-text-secondary" />
          </div>
          <p className="text-lg font-semibold text-text-primary mb-2">
            No consumer accounts yet
          </p>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Accounts appear here as people sign up. You&apos;ll be able to check
            their verification status and suspend or reinstate them from this
            page.
          </p>
        </Card>
      )}

      {/* Consumer Table */}
      {!(loading || loadError) && consumers.length > 0 && (
        <>
          <ConsumerTable
            consumers={filteredConsumers}
            onStatusChange={requestStatusChange}
          />

          {filteredConsumers.length === 0 && isFiltered && (
            <div className="text-center">
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear search and filters
              </Button>
            </div>
          )}

          <p className="text-sm text-text-muted text-center">
            Showing {filteredConsumers.length.toLocaleString('en-US')} of{' '}
            {consumers.length.toLocaleString('en-US')} users
          </p>
        </>
      )}
    </div>
  )
}
