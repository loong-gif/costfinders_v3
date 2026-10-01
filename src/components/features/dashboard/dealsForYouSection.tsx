'use client'

import {
  ArrowRight,
  MagnifyingGlass,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DealList } from '@/components/features/dealCard'
import { DealListSkeleton } from '@/components/features/dealCardSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import { getActiveDeals, getDealsByCity } from '@/lib/data/unified'
import type { AnonymousDeal } from '@/types/deal'

export function DealsForYouSection() {
  const { state } = useAuth()
  const [deals, setDeals] = useState<AnonymousDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  // Whether the results actually came from the user's city — the heading must
  // not claim "Deals in Austin" when we fell back to nationwide results.
  const [isCityMatch, setIsCityMatch] = useState(false)

  const userCity = state.user?.locationCity

  const fetchDeals = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      let results: AnonymousDeal[] = []
      let matchedCity = false

      // Try location-based deals first
      if (userCity) {
        results = await getDealsByCity(userCity)
        matchedCity = results.length > 0
      }

      // Fall back to active deals if no location-specific results
      if (results.length === 0) {
        results = await getActiveDeals(4)
      }

      setIsCityMatch(matchedCity)
      setDeals(results.slice(0, 4))
    } catch {
      setDeals([])
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [userCity])

  useEffect(() => {
    let cancelled = false
    fetchDeals().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [fetchDeals])

  const heading = isCityMatch ? `Deals in ${userCity}` : 'Deals for you'

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          {heading}
        </h2>
        <DealListSkeleton rows={4} />
      </section>
    )
  }

  if (hasError) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          {heading}
        </h2>
        <div className="rounded-2xl border border-border-default bg-bg-elevated p-6 text-center">
          <WarningCircle
            size={28}
            weight="light"
            className="text-text-muted mx-auto mb-2"
          />
          <p className="text-sm text-text-secondary mb-4">
            We couldn&apos;t load deals just now. Check your connection and try
            again.
          </p>
          <Button variant="secondary" size="sm" onClick={fetchDeals}>
            Try again
          </Button>
        </div>
      </section>
    )
  }

  if (deals.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          {heading}
        </h2>
        <div className="rounded-2xl border border-border-default bg-bg-elevated p-6 text-center">
          <p className="text-sm text-text-secondary mb-4">
            {userCity
              ? `No deals in ${userCity} yet. Browse every treatment on offer, or change your city in settings.`
              : 'No deals to show yet. Browse every treatment on offer to find one near you.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/deals">
              <Button variant="primary" size="sm">
                <MagnifyingGlass size={16} weight="bold" />
                Browse all deals
              </Button>
            </Link>
            {userCity && (
              <Link href="/dashboard/settings">
                <Button variant="secondary" size="sm">
                  Change city
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          {heading}
        </h2>
        <Link
          href="/deals"
          className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition-colors shrink-0"
        >
          See all deals
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <DealList deals={deals} />
    </section>
  )
}
