'use client'

import { Heart, MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DealList, ProviderNamesNote } from '@/components/features/dealCard'
import { DealListSkeleton } from '@/components/features/dealCardSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import { getDealById } from '@/lib/data/unified'
import type { AnonymousDeal } from '@/types/deal'

export default function FavoritesPage() {
  const router = useRouter()
  const { savedDeals } = useAuth()
  const [deals, setDeals] = useState<AnonymousDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch deal details whenever savedDeals changes
  useEffect(() => {
    let cancelled = false

    async function fetchDeals() {
      setIsLoading(true)

      if (savedDeals.length === 0) {
        setDeals([])
        setIsLoading(false)
        return
      }

      const results = await Promise.all(savedDeals.map((id) => getDealById(id)))

      if (cancelled) return

      const validDeals = results.filter(
        (deal): deal is AnonymousDeal => deal !== null,
      )
      setDeals(validDeals)
      setIsLoading(false)
    }

    fetchDeals()

    return () => {
      cancelled = true
    }
  }, [savedDeals])

  // Saved deals that no longer resolve (expired or removed) are dropped from
  // the grid — say so rather than silently showing a smaller list.
  const missingCount = savedDeals.length - deals.length

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* No title placeholder — PageHeader already renders the real title. */}
        <div className="h-5 w-28 bg-bg-surface rounded animate-pulse" />
        <DealListSkeleton rows={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Content */}
      {deals.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center mb-6">
            <Heart size={40} weight="light" className="text-text-muted" />
          </div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2 tracking-tight">
            No saved deals yet
          </h2>
          <p className="text-text-secondary mb-6 max-w-md">
            Tap the heart on any deal to save it here, so you can compare prices
            side by side before you claim one.
          </p>
          <Button onClick={() => router.push('/deals')}>
            <MagnifyingGlass size={20} weight="light" className="mr-2" />
            Browse deals
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm text-text-muted">
              {deals.length} saved deal{deals.length !== 1 ? 's' : ''}
              {missingCount > 0 &&
                ` · ${missingCount} no longer available and hidden`}
            </p>
            <ProviderNamesNote />
          </div>
          <DealList deals={deals} />
        </div>
      )}
    </div>
  )
}
