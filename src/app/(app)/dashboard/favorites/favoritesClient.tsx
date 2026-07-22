'use client'

import { Heart, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { DealCard } from '@/components/features/dealCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import type { AnonymousDeal } from '@/types/deal'

interface FavoritesClientProps {
  initialDeals: AnonymousDeal[]
}

export function FavoritesClient({ initialDeals }: FavoritesClientProps) {
  const router = useRouter()
  const { savedDeals } = useAuth()

  const deals = useMemo(() => {
    if (savedDeals.length === 0) return []
    const byId = new Map(initialDeals.map((deal) => [deal.id, deal]))
    return savedDeals
      .map((id) => byId.get(id))
      .filter((deal): deal is AnonymousDeal => deal !== undefined)
  }, [initialDeals, savedDeals])

  return (
    <div className="space-y-6">
      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-[#faf5ee] flex items-center justify-center mb-6">
            <Heart size={40} weight="light" className="text-[#92400e]" />
          </div>
          <h2 className="text-xl font-semibold text-[#451a03] mb-2">
            No saved deals yet
          </h2>
          <p className="text-[#78350f] mb-6 max-w-md">
            Browse deals and tap the heart icon to save them for later. Your
            favorites will appear here.
          </p>
          <Button onClick={() => router.push('/deals')}>
            <MagnifyingGlass size={20} weight="light" className="mr-2" />
            Browse Deals
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#92400e] mb-4">
            {deals.length} saved deal{deals.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <Link key={deal.id} href={`/deals/${deal.id}`}>
                <DealCard deal={deal} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
