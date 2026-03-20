'use client'

import { Buildings, MagnifyingGlass } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { businesses } from '@/lib/mock-data/businesses'
import type { Business, BusinessTier } from '@/types/business'

interface BusinessSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (business: Business) => void
  onCreateNew: () => void
}

function getTierBadge(tier: BusinessTier) {
  switch (tier) {
    case 'unclaimed':
      return (
        <Badge variant="default" size="sm">
          Unclaimed
        </Badge>
      )
    case 'free':
      return (
        <Badge variant="info" size="sm">
          Free
        </Badge>
      )
    case 'paid':
      return (
        <Badge variant="brand" size="sm">
          Premium
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
    }
  }, [isOpen])

  // Filter businesses by name (case-insensitive)
  const filteredBusinesses = useMemo(() => {
    if (!debouncedQuery.trim()) return []

    const query = debouncedQuery.toLowerCase()
    return businesses.filter((business) =>
      business.name.toLowerCase().includes(query),
    )
  }, [debouncedQuery])

  const handleSelect = useCallback(
    (business: Business) => {
      onSelect(business)
      onClose()
    },
    [onSelect, onClose],
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Your Business" size="lg">
      <div className="space-y-6">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass
            size={20}
            weight="light"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none"
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
                className="text-stone-500 mb-4"
              />
              <p className="text-stone-400">
                Start typing to search for your business
              </p>
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Buildings
                size={48}
                weight="light"
                className="text-stone-500 mb-4"
              />
              <p className="text-stone-400 mb-4">
                No businesses found matching "{debouncedQuery}"
              </p>
              <Button variant="primary" onClick={onCreateNew}>
                Create a New Listing
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBusinesses.map((business) => {
                const isClaimed = business.tier !== 'unclaimed'

                return (
                  <div
                    key={business.id}
                    className="p-4 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-stone-100 truncate">
                            {business.name}
                          </h3>
                          {getTierBadge(business.tier)}
                        </div>
                        <p className="text-sm text-stone-400">
                          {business.address}
                        </p>
                        <p className="text-sm text-stone-500">
                          {business.city}, {business.state}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {isClaimed ? (
                          <Button variant="ghost" size="sm" disabled>
                            Already Claimed
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSelect(business)}
                          >
                            Claim This Business
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
        <div className="pt-4 border-t border-stone-800">
          <p className="text-sm text-stone-500 text-center">
            Don't see your business?{' '}
            <button
              type="button"
              onClick={onCreateNew}
              className="text-amber-400 hover:underline"
            >
              Create a new listing
            </button>
          </p>
        </div>
      </div>
    </Modal>
  )
}
