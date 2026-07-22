'use client'

import { MagnifyingGlass, Tag } from '@phosphor-icons/react'
import { useCallback, useMemo, useState } from 'react'
import { DealModerationCard } from '@/components/features/dealModeration/dealModerationCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  approveDealAction,
  rejectDealAction,
  requestDealChangesAction,
} from '@/lib/actions/admin-deal-moderation'
import type { Deal, ModerationStatus } from '@/types/deal'

type FilterTab = 'all' | ModerationStatus

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Deals' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'changes_requested', label: 'Changes Requested' },
]

interface DealModerationClientProps {
  initialDeals: Deal[]
}

export function DealModerationClient({
  initialDeals,
}: DealModerationClientProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [deals, setDeals] = useState(initialDeals)
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Show feedback briefly then clear
  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  // Filter deals based on active tab and search
  const filteredDeals = useMemo(() => {
    let filtered = deals

    // Filter by moderation status
    if (activeFilter !== 'all') {
      filtered = filtered.filter(
        (deal) => deal.moderationStatus === activeFilter,
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.description.toLowerCase().includes(query),
      )
    }

    // Sort by createdAt descending (newest first)
    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [deals, activeFilter, searchQuery])

  // Count deals by status for tab badges
  const statusCounts = useMemo(() => {
    return {
      all: deals.length,
      pending_review: deals.filter(
        (d) => d.moderationStatus === 'pending_review',
      ).length,
      approved: deals.filter((d) => d.moderationStatus === 'approved').length,
      rejected: deals.filter((d) => d.moderationStatus === 'rejected').length,
      changes_requested: deals.filter(
        (d) => d.moderationStatus === 'changes_requested',
      ).length,
    }
  }, [deals])

  const handleApprove = useCallback(
    async (dealId: string) => {
      const deal = deals.find((d) => d.id === dealId)

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                moderationStatus: 'approved' as const,
                isActive: true,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      )

      const result = await approveDealAction(Number(dealId))
      if (!result.success) {
        // Revert on failure
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  moderationStatus: deal?.moderationStatus ?? 'pending_review',
                }
              : d,
          ),
        )
        showFeedback(`Failed to approve: ${result.error}`)
        return
      }

      showFeedback(`Deal "${deal?.title ?? dealId}" has been approved`)
    },
    [deals, showFeedback],
  )

  const handleReject = useCallback(
    async (dealId: string) => {
      const deal = deals.find((d) => d.id === dealId)

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                moderationStatus: 'rejected' as const,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      )

      const result = await rejectDealAction(Number(dealId))
      if (!result.success) {
        // Revert on failure
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  moderationStatus: deal?.moderationStatus ?? 'pending_review',
                }
              : d,
          ),
        )
        showFeedback(`Failed to reject: ${result.error}`)
        return
      }

      showFeedback(`Deal "${deal?.title ?? dealId}" has been rejected`)
    },
    [deals, showFeedback],
  )

  const handleRequestChanges = useCallback(
    async (dealId: string, notes: string) => {
      const deal = deals.find((d) => d.id === dealId)

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                moderationStatus: 'changes_requested' as const,
                moderationNotes: notes,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      )

      const result = await requestDealChangesAction(Number(dealId), notes)
      if (!result.success) {
        // Revert on failure
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  moderationStatus: deal?.moderationStatus ?? 'pending_review',
                }
              : d,
          ),
        )
        showFeedback(`Failed to request changes: ${result.error}`)
        return
      }

      showFeedback(`Changes requested for "${deal?.title ?? dealId}"`)
    },
    [deals, showFeedback],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#451a03]">Deal Moderation</h1>
          <p className="text-[#78350f] mt-1">
            Review and moderate deals ({deals.length} from Supabase)
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-600/10 border border-success/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
          />
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
          />
        </div>
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
              {statusCounts[tab.value]}
            </span>
          </Button>
        ))}
      </div>

      {/* Deal Cards Grid */}
      {filteredDeals.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDeals.map((deal) => (
            <DealModerationCard
              key={deal.id}
              deal={deal}
              onApprove={handleApprove}
              onReject={handleReject}
              onRequestChanges={handleRequestChanges}
            />
          ))}
        </div>
      ) : (
        <Card variant="glass" padding="lg" className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-4">
            <Tag size={32} weight="light" className="text-amber-800" />
          </div>
          <h3 className="text-lg font-semibold text-[#451a03] mb-2">
            No deals found
          </h3>
          <p className="text-[#78350f]">
            {searchQuery
              ? 'Try adjusting your search terms'
              : activeFilter === 'pending_review'
                ? 'No deals pending review'
                : `No ${filterTabs.find((t) => t.value === activeFilter)?.label.toLowerCase() || 'deals'}`}
          </p>
        </Card>
      )}
    </div>
  )
}
