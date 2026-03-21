'use client'

import {
  Buildings,
  CircleNotch,
  Globe,
  MagnifyingGlass,
  MapPin,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { BusinessSearchResult } from '@/lib/actions/business-data'
import {
  importGooglePlaceAction,
  searchBusinessesAction,
} from '@/lib/actions/business-data'
import type { GooglePlaceResult } from '@/lib/actions/google-places'
import { searchGooglePlacesAction } from '@/lib/actions/google-places'

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

  // DB results
  const [dbResults, setDbResults] = useState<BusinessSearchResult[]>([])
  const [isSearchingDb, setIsSearchingDb] = useState(false)

  // Google results
  const [googleResults, setGoogleResults] = useState<GooglePlaceResult[]>([])
  const [isSearchingGoogle, setIsSearchingGoogle] = useState(false)
  const [isImporting, setIsImporting] = useState<string | null>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset on modal close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setDebouncedQuery('')
      setDbResults([])
      setGoogleResults([])
    }
  }, [isOpen])

  // Search our DB
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setDbResults([])
      return
    }

    let cancelled = false
    setIsSearchingDb(true)

    searchBusinessesAction(debouncedQuery).then((result) => {
      if (cancelled) return
      setIsSearchingDb(false)
      setDbResults(result.success && result.businesses ? result.businesses : [])
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Search Google Places
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setGoogleResults([])
      return
    }

    let cancelled = false
    setIsSearchingGoogle(true)

    searchGooglePlacesAction(debouncedQuery).then((result) => {
      if (cancelled) return
      setIsSearchingGoogle(false)
      setGoogleResults(result.success && result.places ? result.places : [])
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Filter Google results to exclude businesses already in our DB
  const dbPlaceIds = new Set(
    dbResults
      .map((b) => b.business_id)
      .filter(Boolean),
  )
  const filteredGoogleResults = googleResults.filter(
    (g) => !dbResults.some((db) => db.name === g.name && db.city === g.city),
  )

  const handleSelectDb = useCallback(
    (business: BusinessSearchResult) => {
      onSelect(business)
      onClose()
    },
    [onSelect, onClose],
  )

  const handleSelectGoogle = useCallback(
    async (place: GooglePlaceResult) => {
      setIsImporting(place.place_id)

      // Import Google place into our DB, then pass to onSelect
      const result = await importGooglePlaceAction({
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        city: place.city,
        website: place.website,
        rating: place.rating,
        review_count: place.review_count,
        category: place.category,
      })

      setIsImporting(null)

      if (result.success && result.businessId) {
        onSelect({
          business_id: result.businessId,
          name: place.name,
          address: place.address,
          city: place.city,
          category: place.category,
          claim_status: 'unclaimed',
        })
        onClose()
      }
    },
    [onSelect, onClose],
  )

  const hasQuery = debouncedQuery.trim() !== ''
  const isSearching = isSearchingDb || isSearchingGoogle
  const noResults =
    hasQuery &&
    !isSearching &&
    dbResults.length === 0 &&
    filteredGoogleResults.length === 0

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
        <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-4">
          {/* Empty state */}
          {!hasQuery && (
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
          )}

          {/* No results */}
          {noResults && (
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
          )}

          {/* DB Results — "In our network" */}
          {hasQuery && (dbResults.length > 0 || isSearchingDb) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} weight="fill" className="text-amber-700" />
                <h3 className="text-sm font-medium text-[#451a03]">
                  In our network
                </h3>
              </div>
              {isSearchingDb ? (
                <div className="flex items-center gap-2 py-4 text-[#78350f]">
                  <CircleNotch size={16} className="animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dbResults.map((business) => {
                    const isClaimable =
                      business.claim_status === 'unclaimed' ||
                      business.claim_status === 'rejected'

                    return (
                      <div
                        key={business.business_id}
                        className="p-3 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] hover:bg-[#faf5ee] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="font-medium text-[#451a03] truncate text-sm">
                                {business.name}
                              </h4>
                              {getClaimBadge(business.claim_status)}
                            </div>
                            {business.address && (
                              <p className="text-xs text-[#78350f]">
                                {business.address}
                              </p>
                            )}
                            {business.city && (
                              <p className="text-xs text-[#92400e]">
                                {business.city}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {isClaimable ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSelectDb(business)}
                              >
                                Claim
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled>
                                Claimed
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
          )}

          {/* Google Results — "Found on Google" */}
          {hasQuery &&
            (filteredGoogleResults.length > 0 || isSearchingGoogle) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={16} weight="fill" className="text-amber-700" />
                  <h3 className="text-sm font-medium text-[#451a03]">
                    Found on Google
                  </h3>
                </div>
                {isSearchingGoogle ? (
                  <div className="flex items-center gap-2 py-4 text-[#78350f]">
                    <CircleNotch size={16} className="animate-spin" />
                    <span className="text-sm">Searching Google...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGoogleResults.map((place) => (
                      <div
                        key={place.place_id}
                        className="p-3 rounded-xl border border-[#d4c4b0]/60 bg-[#f2ebe2]/60 hover:bg-[#faf5ee] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="font-medium text-[#451a03] truncate text-sm">
                                {place.name}
                              </h4>
                              {place.category && (
                                <span className="text-xs text-[#92400e] bg-amber-800/5 px-1.5 py-0.5 rounded">
                                  {place.category}
                                </span>
                              )}
                            </div>
                            {place.address && (
                              <p className="text-xs text-[#78350f] truncate">
                                {place.address}
                              </p>
                            )}
                            {place.rating && (
                              <p className="text-xs text-[#92400e]">
                                {place.rating.toFixed(1)} stars
                                {place.review_count
                                  ? ` (${place.review_count} reviews)`
                                  : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSelectGoogle(place)}
                              disabled={isImporting === place.place_id}
                            >
                              {isImporting === place.place_id
                                ? 'Adding...'
                                : 'Claim'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
