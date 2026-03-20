'use client'

import { useState, useMemo, useCallback } from 'react'
import { MagnifyingGlass, Funnel, Tag } from '@phosphor-icons/react'
import type { ModerationStatus } from '@/types/deal'
import { getAllDeals, updateDealModeration } from '@/lib/mock-data/deals'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DealModerationCard } from '@/components/features/dealModeration/dealModerationCard'

type FilterTab = 'all' | ModerationStatus

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Deals' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'changes_requested', label: 'Changes Requested' },
]

export default function DealModerationPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('pending_review')
  const [deals, setDeals] = useState(() => getAllDeals())
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
      filtered = filtered.filter((deal) => deal.moderationStatus === activeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.description.toLowerCase().includes(query)
      )
    }

    // Sort by createdAt descending (newest first)
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [deals, activeFilter, searchQuery])

  // Count deals by status for tab badges
  const statusCounts = useMemo(() => {
    return {
      all: deals.length,
      pending_review: deals.filter((d) => d.moderationStatus === 'pending_review').length,
      approved: deals.filter((d) => d.moderationStatus === 'approved').length,
      rejected: deals.filter((d) => d.moderationStatus === 'rejected').length,
      changes_requested: deals.filter((d) => d.moderationStatus === 'changes_requested').length,
    }
  }, [deals])

  const handleApprove = useCallback(
    (dealId: string) => {
      const updated = updateDealModeration(dealId, 'approved')
      if (updated) {
        setDeals(getAllDeals())
        showFeedback(`Deal "${updated.title}" has been approved`)
      }
    },
    [showFeedback]
  )

  const handleReject = useCallback(
    (dealId: string) => {
      const updated = updateDealModeration(dealId, 'rejected')
      if (updated) {
        setDeals(getAllDeals())
        showFeedback(`Deal "${updated.title}" has been rejected`)
      }
    },
    [showFeedback]
  )

  const handleRequestChanges = useCallback(
    (dealId: string, notes: string) => {
      const updated = updateDealModeration(dealId, 'changes_requested', notes)
      if (updated) {
        setDeals(getAllDeals())
        showFeedback(`Changes requested for "${updated.title}"`)
      }
    },
    [showFeedback]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deal Moderation</h1>
          <p className="text-text-secondary mt-1">
            Review and moderate submitted deals
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-success/10 border border-success/20 text-success-text px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-glass-bg border border-glass-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
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
                activeFilter === tab.value
                  ? 'bg-white/20'
                  : 'bg-glass-bg'
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
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
            <Tag size={32} weight="light" className="text-brand-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No deals found
          </h3>
          <p className="text-text-secondary">
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
