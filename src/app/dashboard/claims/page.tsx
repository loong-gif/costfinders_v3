'use client'

import { ClipboardText, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ClaimCard } from '@/components/features/claimCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import { useClaims } from '@/lib/context/claimsContext'
import { getClaimsByConsumer } from '@/lib/mock-data'
import type { Claim, ClaimStatus } from '@/types/claim'

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const activeStatuses: ClaimStatus[] = ['pending', 'contacted', 'booked']
const cancelledStatuses: ClaimStatus[] = ['cancelled', 'expired']

function filterClaimsByTab(claims: Claim[], tab: FilterTab): Claim[] {
  switch (tab) {
    case 'active':
      return claims.filter((c) => activeStatuses.includes(c.status))
    case 'completed':
      return claims.filter((c) => c.status === 'completed')
    case 'cancelled':
      return claims.filter((c) => cancelledStatuses.includes(c.status))
    default:
      return claims
  }
}

function countClaimsByTab(claims: Claim[], tab: FilterTab): number {
  return filterClaimsByTab(claims, tab).length
}

export default function ClaimsPage() {
  const { state: authState } = useAuth()
  const { state: claimsState } = useClaims()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Merge localStorage claims with mock claims, avoiding duplicates
  const allClaims = useMemo(() => {
    const localClaims = claimsState.claims
    const mockClaims = authState.user
      ? getClaimsByConsumer(authState.user.id)
      : []

    // Create a map to dedupe by claim ID
    const claimMap = new Map<string, Claim>()

    // Add mock claims first
    for (const claim of mockClaims) {
      claimMap.set(claim.id, claim)
    }

    // Override/add local claims (newer)
    for (const claim of localClaims) {
      claimMap.set(claim.id, claim)
    }

    // Sort by createdAt descending (newest first)
    return Array.from(claimMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [claimsState.claims, authState.user])

  const filteredClaims = useMemo(
    () => filterClaimsByTab(allClaims, activeTab),
    [allClaims, activeTab],
  )

  // Loading state
  if (claimsState.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-[#faf5ee] rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 w-20 bg-[#faf5ee] rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-[#faf5ee] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
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
                px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-amber-800 text-white'
                    : 'bg-[#f2ebe2] border border-[#d4c4b0] text-[#78350f] hover:text-[#451a03] hover:border-[#c4b09a]'
                }
              `}
            >
              {tab.label}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-white/20' : 'bg-[#faf5ee]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Claims List or Empty State */}
      {filteredClaims.length > 0 ? (
        <div className="grid gap-4">
          {filteredClaims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-[#faf5ee] flex items-center justify-center mb-6">
            <ClipboardText
              size={40}
              weight="light"
              className="text-[#92400e]"
            />
          </div>
          <h2 className="text-xl font-semibold text-[#451a03] mb-2">
            {activeTab === 'all' ? 'No claims yet' : `No ${activeTab} claims`}
          </h2>
          <p className="text-[#78350f] mb-6 max-w-sm">
            {activeTab === 'all'
              ? 'Find a deal you love and claim it to get started.'
              : `You don't have any ${activeTab} claims at the moment.`}
          </p>
          <Link href="/deals">
            <Button>
              <MagnifyingGlass size={18} weight="bold" />
              Browse Deals
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
