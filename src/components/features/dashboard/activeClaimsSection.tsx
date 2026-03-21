'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ClaimStatusBadge } from '@/components/patterns/claimStatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { useClaims } from '@/lib/context/claimsContext'
import { getDealById } from '@/lib/data/unified'
import type { Claim, ClaimStatus } from '@/types/claim'

const activeStatuses: ClaimStatus[] = ['pending', 'contacted', 'booked']

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

const statusHints: Record<string, string> = {
  pending: 'Waiting for business response',
  contacted: 'Business has reached out',
  booked: 'Appointment confirmed',
}

export function ActiveClaimsSection() {
  const { state: claimsState } = useClaims()
  const [dealTitles, setDealTitles] = useState<Record<string, string>>({})

  const activeClaims = useMemo(
    () =>
      claimsState.claims
        .filter((c) => activeStatuses.includes(c.status))
        .slice(0, 3),
    [claimsState.claims],
  )

  useEffect(() => {
    if (activeClaims.length === 0) return
    let cancelled = false

    const fetchTitles = async () => {
      const titles: Record<string, string> = {}
      await Promise.all(
        activeClaims.map(async (claim) => {
          const deal = await getDealById(claim.dealId)
          if (deal && !cancelled) {
            titles[claim.dealId] = deal.title
          }
        }),
      )
      if (!cancelled) {
        setDealTitles((prev) => ({ ...prev, ...titles }))
      }
    }

    fetchTitles()
    return () => {
      cancelled = true
    }
  }, [activeClaims])

  if (claimsState.isLoading || activeClaims.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#451a03]">Active claims</h2>
        <Link
          href="/dashboard/claims"
          className="text-sm text-amber-800 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors"
        >
          View all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="grid gap-3">
        {activeClaims.map((claim) => (
          <ClaimProgressCard
            key={claim.id}
            claim={claim}
            dealTitle={dealTitles[claim.dealId]}
          />
        ))}
      </div>
    </section>
  )
}

function ClaimProgressCard({
  claim,
  dealTitle,
}: {
  claim: Claim
  dealTitle?: string
}) {
  const title = dealTitle ?? `Deal #${claim.dealId.slice(0, 8)}`

  return (
    <Link href="/dashboard/claims">
      <Card
        variant="glass"
        padding="md"
        className="hover:border-[#c4b09a] transition-colors"
      >
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#451a03] truncate">
                {title}
              </p>
              <p className="text-xs text-[#92400e] mt-0.5">
                {statusHints[claim.status] ?? claim.status} &middot;{' '}
                {formatRelativeTime(claim.createdAt)}
              </p>
            </div>
            <ClaimStatusBadge status={claim.status} size="sm" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
