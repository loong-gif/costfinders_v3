'use client'

import { MagnifyingGlass, Tag } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type AdminDeal,
  type DealEditValues,
  DealModerationCard,
} from '@/components/features/dealModeration/dealModerationCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  setDealListingAction,
  updateDealDetailsAction,
} from '@/lib/actions/admin-deal-moderation'

/**
 * The tabs follow the only publication state the database still has.
 *
 * They used to be the four `moderation_status` values. That column was dropped on 2026-09-15
 * (`drop_promo_offer_moderation_columns`), so every tab but "All" would now count zero and
 * the three verdict actions behind them would fail with 42703. See dealModerationCard.tsx.
 */
type FilterTab = 'all' | 'review' | 'live' | 'off' | 'check'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All deals' },
  { value: 'review', label: 'Awaiting first review' },
  { value: 'live', label: 'On the site' },
  { value: 'off', label: 'Off the site' },
  // interpretOffer's `check` tier: a price defect, or a discount lead the wording doesn't state.
  // The site ranks none of them (18 of 947 visible offers on 2026-09-28). The editor is where
  // each one gets fixed.
  { value: 'check', label: 'Confirm when booking' },
]

interface Feedback {
  tone: 'success' | 'warning' | 'error'
  text: string
}

const FEEDBACK_STYLE: Record<Feedback['tone'], string> = {
  success: 'bg-success-bg border border-success/20 text-success',
  warning: 'bg-warning/10 border border-warning/20 text-warning',
  error: 'bg-error-bg border border-error/20 text-error',
}

/**
 * How many cards to render at once.
 *
 * ponytail: a DOM bound, not a data bound. The page deliberately loads every offer — a
 * take-down has to be able to reach any live one — and dropping the consumer pricing filter
 * from the admin read took that from 701 rows to 1125. Mounting 1125 cards in a single pass
 * is the part that hurts, and it is also the part a "Show more" fixes for free. Server-side
 * paging is the real answer if this table reaches a few thousand rows.
 */
const CARDS_PER_PAGE = 60

interface DealModerationClientProps {
  initialDeals: AdminDeal[]
}

export function DealModerationClient({
  initialDeals,
}: DealModerationClientProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [deals, setDeals] = useState(initialDeals)
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [visibleCount, setVisibleCount] = useState(CARDS_PER_PAGE)

  // Every action here calls revalidatePath('/admin/dashboard/deals'), so Next sends the page's
  // fresh server props back with the action result. Adopt them: after an edit the card must
  // show the price the database now holds, which only the server-side adapter can print.
  useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  // Errors and warnings carry something to act on, so they stay longer than a success.
  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), next.tone === 'success' ? 4000 : 12000)
  }, [])

  // Filter deals based on active tab and search
  const filteredDeals = useMemo(() => {
    let filtered = deals

    // Filter by listing state
    if (activeFilter === 'review') {
      filtered = filtered.filter((deal) => deal.awaitingFirstReview)
    } else if (activeFilter === 'check') {
      filtered = filtered.filter((deal) => deal.interpretation.tier === 'check')
    } else if (activeFilter !== 'all') {
      const wantActive = activeFilter === 'live'
      filtered = filtered.filter((deal) => deal.isActive === wantActive)
    }

    // Filter by search query: title, description, or the clinic's name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.description.toLowerCase().includes(query) ||
          (deal.businessName ?? '').toLowerCase().includes(query),
      )
    }

    // Sort by createdAt descending (newest first). Copied first: with no tab and no search,
    // `filtered` IS the `deals` state array, and sort() reorders in place.
    return [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [deals, activeFilter, searchQuery])

  const visibleDeals = filteredDeals.slice(0, visibleCount)

  // Count deals by listing state for tab badges
  const statusCounts = useMemo(() => {
    const live = deals.filter((d) => d.isActive).length
    return {
      all: deals.length,
      review: deals.filter((d) => d.awaitingFirstReview).length,
      live,
      off: deals.length - live,
      check: deals.filter((d) => d.interpretation.tier === 'check').length,
    }
  }, [deals])

  const handleSetListing = useCallback(
    async (dealId: string, isActive: boolean) => {
      const deal = deals.find((d) => d.id === dealId)

      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? { ...d, isActive, updatedAt: new Date().toISOString() }
            : d,
        ),
      )

      const result = await setDealListingAction(Number(dealId), isActive)
      if (!result.success) {
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, isActive: !isActive } : d,
          ),
        )
        showFeedback({
          tone: 'error',
          text: isActive
            ? `Couldn't put it on the site. ${result.error}`
            : `Couldn't take it down. ${result.error}`,
        })
        return
      }

      showFeedback({
        tone: 'success',
        text: isActive
          ? `"${deal?.title ?? dealId}" is on the site.`
          : `"${deal?.title ?? dealId}" has been taken down.`,
      })
    },
    [deals, showFeedback],
  )

  /** Resolves to a message for the form when nothing was saved; null when it closes. */
  const handleEdit = useCallback(
    async (dealId: string, values: DealEditValues): Promise<string | null> => {
      const result = await updateDealDetailsAction(Number(dealId), values)
      if (!result.success) return result.error ?? 'Nothing was saved.'
      showFeedback(
        result.warning
          ? { tone: 'warning', text: `Saved. ${result.warning}` }
          : { tone: 'success', text: 'Deal updated.' },
      )
      return null
    },
    [showFeedback],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Deal moderation
          </h1>
          {/* The count moved to the tab badges, which are the same numbers scoped to a
              status. "(N from Supabase)" named the storage engine in admin-facing copy and
              read as the platform total, which it was not. */}
          <p className="text-text-secondary mt-1">
            Publish a deal, take one down, or correct its title and price.
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          role={feedback.tone === 'success' ? 'status' : 'alert'}
          className={`px-4 py-3 rounded-xl text-sm font-medium ${FEEDBACK_STYLE[feedback.tone]}`}
        >
          {feedback.text}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search by deal or clinic name"
            aria-label="Search by deal or clinic name"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setVisibleCount(CARDS_PER_PAGE)
            }}
            className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border-accent"
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
            onClick={() => {
              setActiveFilter(tab.value)
              setVisibleCount(CARDS_PER_PAGE)
            }}
            className="gap-2"
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === tab.value
                  ? 'bg-bg-elevated text-text-primary'
                  : 'bg-bg-surface'
              }`}
            >
              {statusCounts[tab.value]}
            </span>
          </Button>
        ))}
      </div>

      {/* Deal Cards Grid */}
      {filteredDeals.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleDeals.map((deal) => (
              <DealModerationCard
                key={deal.id}
                deal={deal}
                onSetListing={handleSetListing}
                onEdit={handleEdit}
              />
            ))}
          </div>
          {filteredDeals.length > visibleDeals.length && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm text-text-secondary">
                Showing {visibleDeals.length} of {filteredDeals.length} deals
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setVisibleCount((count) => count + CARDS_PER_PAGE)
                }
              >
                Show more
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card variant="glass" padding="lg" className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4">
            <Tag size={32} weight="light" className="text-text-secondary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
            No deals found
          </h3>
          <p className="text-text-secondary">
            {searchQuery
              ? 'Try adjusting your search terms'
              : activeFilter === 'check'
                ? "Every deal's wording adds up."
                : `No deals ${filterTabs.find((t) => t.value === activeFilter)?.label.toLowerCase() ?? ''}`.trim()}
          </p>
        </Card>
      )}
    </div>
  )
}
