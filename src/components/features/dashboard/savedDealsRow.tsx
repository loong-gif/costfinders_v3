'use client'

import { ArrowRight, Heart, MapPin } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/context/authContext'
import { getDealById } from '@/lib/data/unified'
import type { AnonymousDeal } from '@/types/deal'

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
        savedDeals.slice(0, 6).map((id) => getDealById(id)),
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

  if (isLoading || savedDeals.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#451a03]">Saved deals</h2>
        <Link
          href="/dashboard/favorites"
          className="text-sm text-amber-800 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors"
        >
          View all {savedDeals.length}
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {deals.map((deal) => (
          <MiniDealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </section>
  )
}

function MiniDealCard({ deal }: { deal: AnonymousDeal }) {
  const hasDealPrice = deal.dealPrice > 0

  return (
    <Link href={`/deals/${deal.id}`} className="shrink-0 w-56">
      <Card
        variant="glass"
        padding="none"
        className="overflow-hidden hover:border-[#c4b09a] hover:-translate-y-0.5 transition-all duration-200"
      >
        {/* Compact header with heart + category */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#92400e] bg-amber-800/8 px-2 py-0.5 rounded-full">
            {deal.category}
          </span>
          <Heart size={16} weight="fill" className="text-amber-800" />
        </div>

        {/* Content */}
        <div className="px-3 pb-3 space-y-1.5">
          <p className="text-sm font-medium text-[#451a03] line-clamp-2 leading-snug">
            {deal.title}
          </p>

          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            {hasDealPrice ? (
              <span className="text-lg font-bold font-mono text-amber-800">
                ${deal.dealPrice}
              </span>
            ) : (
              <span className="text-sm font-medium text-amber-800">
                Contact for pricing
              </span>
            )}
            {deal.originalPrice > 0 &&
              hasDealPrice &&
              deal.originalPrice > deal.dealPrice && (
                <span className="text-xs text-[#92400e] line-through">
                  ${deal.originalPrice}
                </span>
              )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-[#78350f]">
            <MapPin size={12} weight="light" className="text-[#92400e]" />
            <span className="truncate">{deal.locationArea}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
