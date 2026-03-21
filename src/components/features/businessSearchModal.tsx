'use client'

import {
  Buildings,
  CircleNotch,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { BusinessSearchResult } from '@/lib/actions/business-data'
import { searchBusinessesAction } from '@/lib/actions/business-data'

interface BusinessSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (business: BusinessSearchResult) => void
  onCreateNew: () => void
}

function getClaimBadge(claimStatus: BusinessSearchResult['claim_status']) {
  switch (claimStatus) {
    case 'unclaimed':
      return (
        <Badge variant="default" size="sm">
          Unclaimed
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="warning" size="sm">
          Pending
        </Badge>
      )
    case 'approved':
      return (
        <Badge variant="info" size="sm">
          Claimed
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="default" size="sm">
          Unclaimed
        </Badge>
      )
  }
}

export function BusinessSearchModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
}: BusinessSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<BusinessSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setDebouncedQuery('')
      setResults([])
    }
  }, [isOpen])

  // Fetch results from Supabase
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)

    searchBusinessesAction(debouncedQuery).then((result) => {
      if (cancelled) return
      setIsSearching(false)
      if (result.success && result.businesses) {
        setResults(result.businesses)
      } else {
        setResults([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const handleSelect = useCallback(
    (business: BusinessSearchResult) => {
      onSelect(business)
      onClose()
    },
    [onSelect, onClose],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Find Your Business"
      size="lg"
      mobileVariant="fullscreen"
    >
      <div className="space-y-6">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass
            size={20}
            weight="light"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e] pointer-events-none"
          />
          <Input
            type="text"
            placeholder="Search by business name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
          {debouncedQuery.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MagnifyingGlass
                size={48}
                weight="light"
                className="text-[#92400e] mb-4"
              />
              <p className="text-[#78350f]">
                Start typing to search for your business
              </p>
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CircleNotch
                size={32}
                weight="light"
                className="text-[#92400e] mb-4 animate-spin"
              />
              <p className="text-[#78350f]">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Buildings
                size={48}
                weight="light"
                className="text-[#92400e] mb-4"
              />
              <p className="text-[#78350f] mb-4">
                No businesses found matching &ldquo;{debouncedQuery}&rdquo;
              </p>
              <Button variant="primary" onClick={onCreateNew}>
                Create a New Listing
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((business) => {
                const isClaimable =
                  business.claim_status === 'unclaimed' ||
                  business.claim_status === 'rejected'

                return (
                  <div
                    key={business.business_id}
                    className="p-4 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] hover:bg-[#faf5ee] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-[#451a03] truncate">
                            {business.name}
                          </h3>
                          {getClaimBadge(business.claim_status)}
                        </div>
                        {business.address && (
                          <p className="text-sm text-[#78350f]">
                            {business.address}
                          </p>
                        )}
                        {business.city && (
                          <p className="text-sm text-[#92400e]">
                            {business.city}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {isClaimable ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSelect(business)}
                          >
                            Claim This Business
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            Already Claimed
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#d4c4b0]">
          <p className="text-sm text-[#92400e] text-center">
            Don&apos;t see your business?{' '}
            <button
              type="button"
              onClick={onCreateNew}
              className="text-amber-800 hover:underline cursor-pointer"
            >
              Create a new listing
            </button>
          </p>
        </div>
      </div>
    </Modal>
  )
}
