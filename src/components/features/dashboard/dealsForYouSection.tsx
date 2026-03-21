'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DealCard } from '@/components/features/dealCard'
import { useAuth } from '@/lib/context/authContext'
import { getActiveDeals, getDealsByCity } from '@/lib/data/unified'
import type { AnonymousDeal } from '@/types/deal'

export function DealsForYouSection() {
  const { state } = useAuth()
  const [deals, setDeals] = useState<AnonymousDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const userCity = state.user?.locationCity

  useEffect(() => {
    let cancelled = false

    async function fetchDeals() {
      let results: AnonymousDeal[] = []

      // Try location-based deals first
      if (userCity) {
        results = await getDealsByCity(userCity)
      }

      // Fall back to active deals if no location-specific results
      if (results.length === 0) {
        results = await getActiveDeals(4)
      }

      if (cancelled) return
      setDeals(results.slice(0, 4))
      setIsLoading(false)
    }

    fetchDeals()
    return () => {
      cancelled = true
    }
  }, [userCity])

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#451a03]">
          Deals {userCity ? `in ${userCity}` : 'for you'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-[4/5] bg-[#faf5ee] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </section>
    )
  }

  if (deals.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#451a03]">
          Deals {userCity ? `in ${userCity}` : 'for you'}
        </h2>
        <Link
          href="/deals"
          className="text-sm text-amber-800 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors"
        >
          See all deals
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deals.map((deal) => (
          <Link key={deal.id} href={`/deals/${deal.id}`}>
            <DealCard deal={deal} />
          </Link>
        ))}
      </div>
    </section>
  )
}
