'use client'

import { ClipboardText, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_CLAIM_STATUSES,
  ClaimCard,
} from '@/components/features/claimCard'
import { ClaimHonorQuestion } from '@/components/features/dashboard/claimHonorQuestion'
import { Button } from '@/components/ui/button'
import {
  type ClaimFeedback,
  getMyClaimFeedbackAction,
} from '@/lib/actions/deal-feedback'
import { useClaims } from '@/lib/context/claimsContext'
import type { Claim } from '@/types/claim'

type FilterTab = 'all' | 'active' | 'closed'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

function filterClaimsByTab(claims: Claim[], tab: FilterTab): Claim[] {
  switch (tab) {
    case 'active':
      return claims.filter((c) => ACTIVE_CLAIM_STATUSES.includes(c.status))
    case 'closed':
      return claims.filter((c) => !ACTIVE_CLAIM_STATUSES.includes(c.status))
    default:
      return claims
  }
}

function countClaimsByTab(claims: Claim[], tab: FilterTab): number {
  return filterClaimsByTab(claims, tab).length
}

/**
 * Each empty state says what lands here and why, not just that it's empty. No clinic has an
 * account at launch, so nothing here waits on a clinic to respond.
 */
const emptyStateCopy: Record<FilterTab, { title: string; body: string }> = {
  all: {
    title: 'No claims yet',
    body: "Claim a deal and it shows up here with the clinic's name, address and phone number, so you can call or book with them directly.",
  },
  active: {
    title: 'No active claims',
    body: "Claims you haven't cancelled or closed show up here. You can hold up to 3 at a time.",
  },
  closed: {
    title: 'No closed claims',
    body: "Claims you cancel, and claims that have closed, show up here. The clinic's details stay with them.",
  },
}

export default function ClaimsPage() {
  const { state: claimsState } = useClaims()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Titles, clinics and whether each deal is still listed come with the claims
  // (getClaimsAction), so there is nothing to look up per card.
  const allClaims = claimsState.claims

  // The customer's answers to "Did the clinic honor this price?", by claim id. The question waits
  // for them, so it never offers a blank choice over an answer already given.
  const [feedback, setFeedback] = useState<Map<string, ClaimFeedback>>(
    new Map(),
  )
  const [feedbackLoaded, setFeedbackLoaded] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const hasClaims = allClaims.length > 0

  useEffect(() => {
    if (!hasClaims) return
    let cancelled = false
    // A failed request still settles, so the questions show (unanswered) rather than never.
    getMyClaimFeedbackAction()
      .catch(() => ({ success: false as const, error: undefined }))
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setFeedback(
            new Map((result.feedback ?? []).map((f) => [f.claimId, f])),
          )
        } else {
          setFeedbackError(result.error ?? "We couldn't load your answers.")
        }
        setFeedbackLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [hasClaims])

  const saveFeedback = useCallback((next: ClaimFeedback) => {
    setFeedback((prev) => new Map(prev).set(next.claimId, next))
  }, [])

  const filteredClaims = useMemo(
    () => filterClaimsByTab(allClaims, activeTab),
    [allClaims, activeTab],
  )

  // Loading state
  if (claimsState.isLoading) {
    return (
      <div className="space-y-6">
        {/* Tab row + card stack — matches the resolved layout, and the page
            title already comes from PageHeader so no title placeholder here. */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-11 w-24 bg-bg-elevated rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-bg-elevated rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs — hidden with zero claims, where every count reads 0 */}
      {allClaims.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => {
            const count = countClaimsByTab(allClaims, tab.value)
            const isActive = activeTab === tab.value

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`
                  px-4 min-h-[44px] rounded-xl text-sm font-medium transition-all
                  ${
                    isActive
                      ? 'bg-text-primary text-white'
                      : 'bg-bg-surface border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                  }
                `}
              >
                {tab.label}
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/20' : 'bg-bg-elevated'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Claims list or empty state */}
      {feedbackError && (
        <p
          role="alert"
          className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3"
        >
          {feedbackError} You can still answer below.
        </p>
      )}

      {filteredClaims.length > 0 ? (
        <div className="grid gap-4">
          {filteredClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              footer={
                feedbackLoaded && (
                  <ClaimHonorQuestion
                    claimId={claim.id}
                    saved={feedback.get(claim.id)}
                    onSaved={saveFeedback}
                  />
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center mb-6">
            <ClipboardText
              size={40}
              weight="light"
              className="text-text-muted"
            />
          </div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2 tracking-tight">
            {emptyStateCopy[activeTab].title}
          </h2>
          <p className="text-text-secondary mb-6 max-w-sm">
            {emptyStateCopy[activeTab].body}
          </p>
          {activeTab === 'all' ? (
            <Link href="/deals">
              <Button>
                <MagnifyingGlass size={18} weight="bold" />
                Browse deals
              </Button>
            </Link>
          ) : (
            <Button variant="secondary" onClick={() => setActiveTab('all')}>
              View all claims
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
