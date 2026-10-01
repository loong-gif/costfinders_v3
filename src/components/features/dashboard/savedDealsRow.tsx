'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DealList } from '@/components/features/dealCard'
import { useAuth } from '@/lib/context/authContext'
import { getDealById } from '@/lib/data/unified'
import type { AnonymousDeal } from '@/types/deal'

/**
 * The dashboard's newest saved deals, as the same rows as everywhere else. They were bespoke
 * mini cards that printed the raw category slug ("botox") and none of a row's price context.
 * Three, not the six that side-scrolled: a summary above "Deals for you", with the full list a
 * click away.
 */
const SHOWN = 3

export function SavedDealsRow() {
  const { savedDeals } = useAuth()
  const [deals, setDeals] = useState<AnonymousDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (savedDeals.length === 0) {
      setDeals([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchDeals() {
      const results = await Promise.all(
        savedDeals.slice(0, SHOWN).map((id) => getDealById(id)),
      )
      if (cancelled) return
      setDeals(results.filter((d): d is AnonymousDeal => d !== null))
      setIsLoading(false)
    }

    fetchDeals()
    return () => {
      cancelled = true
    }
  }, [savedDeals])

  // Bail while loading, with nothing saved, or when every saved deal has since
  // been removed — otherwise the header renders above an empty list.
  if (isLoading || deals.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          Saved deals
        </h2>
        <Link
          href="/dashboard/favorites"
          className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition-colors"
        >
          View all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <DealList deals={deals} />
    </section>
  )
}
