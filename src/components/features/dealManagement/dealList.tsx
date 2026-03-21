'use client'

import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Rocket,
  Tag,
  Trash,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SponsoredDealConfig } from '@/components/features/sponsoredDealConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  deleteDealAction,
  getDealsForBusinessAction,
} from '@/lib/actions/deal-management'
import {
  createBoost,
  getActiveBoosts,
} from '@/lib/mock-data/sponsorship'
import type { Deal } from '@/types/deal'
import type { Offer } from '@/types/supabase'

type FilterTab = 'all'

interface DealListProps {
  businessId: string
}

export function DealList({ businessId }: DealListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [dealToDelete, setDealToDelete] = useState<Offer | null>(null)
  const [boostModalOpen, setBoostModalOpen] = useState(false)
  const [dealToBoost, setDealToBoost] = useState<Deal | null>(null)
  const [allDeals, setAllDeals] = useState<Offer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load deals from Supabase
  const loadDeals = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const result = await getDealsForBusinessAction(Number(businessId))
    if (result.success && result.deals) {
      setAllDeals(result.deals)
    } else {
      setLoadError(result.error ?? 'Failed to load deals.')
    }
    setIsLoading(false)
  }, [businessId])

  useEffect(() => {
    loadDeals()
  }, [loadDeals])

  // Filter deals based on search
  const filteredDeals = useMemo(() => {
    let filtered = allDeals

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          (deal.service_name ?? '').toLowerCase().includes(query) ||
          (deal.service_category ?? '').toLowerCase().includes(query),
      )
    }

    return filtered
  }, [allDeals, searchQuery])

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allDeals.length,
    }
  }, [allDeals])

  // Count sponsored deals (stays mock)
  const sponsoredCount = useMemo(() => {
    return getActiveBoosts(businessId).length
  }, [businessId])

  const handleDeleteClick = (deal: Offer) => {
    setDealToDelete(deal)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!dealToDelete) return
    setIsDeleting(true)
    const result = await deleteDealAction(
      dealToDelete.id,
      Number(businessId),
    )
    if (result.success) {
      setAllDeals((prev) => prev.filter((d) => d.id !== dealToDelete.id))
    }
    setIsDeleting(false)
    setDeleteModalOpen(false)
    setDealToDelete(null)
  }

  const handleBoostClick = (deal: Deal) => {
    setDealToBoost(deal)
    setBoostModalOpen(true)
  }

  const handleBoostSelect = (boostOptionId: string) => {
    if (dealToBoost) {
      createBoost(dealToBoost.id, boostOptionId)
      setBoostModalOpen(false)
      setDealToBoost(null)
    }
  }

  const formatPrice = (price: number | null, unit: string | null) => {
    if (price == null) return '\u2014'
    return `$${price.toFixed(price % 1 === 0 ? 0 : 2)}${unit ? ` ${unit}` : ''}`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-amber-800" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[#78350f]">Loading deals...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-[#451a03] mb-2">
            Failed to load deals
          </h3>
          <p className="text-[#78350f] mb-6">{loadError}</p>
          <Button onClick={loadDeals}>Retry</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#451a03]">Deals</h1>
          <p className="text-[#78350f] mt-1">
            Manage your special offers and promotions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/business/dashboard/deals/sponsored">
            <Button variant="secondary">
              <Rocket size={18} weight="fill" className="text-amber-800" />
              Sponsored
              {sponsoredCount > 0 && (
                <Badge variant="brand" size="sm" className="ml-1">
                  {sponsoredCount}
                </Badge>
              )}
            </Button>
          </Link>
          <Link href="/business/dashboard/deals/new">
            <Button>
              <Plus size={20} weight="bold" />
              Create Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <Card variant="glass" padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['all'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${
                    activeTab === tab
                      ? 'bg-amber-800 text-white'
                      : 'bg-[#f2ebe2] text-[#78350f] hover:text-[#451a03] hover:bg-[#faf5ee]'
                  }
                `}
                type="button"
              >
                All ({tabCounts[tab]})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 sm:max-w-xs">
            <div className="relative">
              <MagnifyingGlass
                size={20}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
              />
              <Input
                type="text"
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Deals Table */}
      {filteredDeals.length === 0 ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <Tag
              size={48}
              weight="light"
              className="mx-auto text-[#92400e] mb-4"
            />
            <h3 className="text-lg font-medium text-[#451a03] mb-2">
              {searchQuery ? 'No deals found' : 'No deals yet'}
            </h3>
            <p className="text-[#78350f] mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first deal to start attracting customers'}
            </p>
            {!searchQuery && (
              <Link href="/business/dashboard/deals/new">
                <Button>
                  <Plus size={20} weight="bold" />
                  Create Your First Deal
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card variant="glass" padding="none" className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#d4c4b0]">
                  <th className="text-left px-6 py-4 text-sm font-medium text-[#78350f]">
                    Deal
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-[#78350f]">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-[#78350f]">
                    Price
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-[#78350f]">
                    Discount
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-[#78350f]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d4c4b0]">
                {filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-[#d4c4b0]/30 transition-colors"
                  >
                    {/* Deal Title */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                          <Tag
                            size={20}
                            weight="fill"
                            className="text-amber-800"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#451a03] truncate">
                            {deal.service_name ?? 'Untitled Deal'}
                          </p>
                          {deal.template_type && (
                            <p className="text-xs text-[#92400e] mt-0.5">
                              {deal.template_type}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      {deal.service_category ? (
                        <Badge variant="default" size="sm">
                          {deal.service_category}
                        </Badge>
                      ) : (
                        <span className="text-sm text-[#92400e]">{'\u2014'}</span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4">
                      <div>
                        {deal.discount_price != null && (
                          <p className="font-medium text-amber-800">
                            {formatPrice(deal.discount_price, deal.unit_type)}
                          </p>
                        )}
                        {deal.original_price != null && (
                          <p className="text-sm text-[#92400e] line-through">
                            {formatPrice(deal.original_price, deal.unit_type)}
                          </p>
                        )}
                        {deal.discount_price == null && deal.original_price == null && (
                          <span className="text-sm text-[#92400e]">{'\u2014'}</span>
                        )}
                      </div>
                    </td>

                    {/* Discount */}
                    <td className="px-6 py-4">
                      {deal.discount_percent != null ? (
                        <Badge variant="brand" size="sm">
                          {Math.round(deal.discount_percent)}% off
                        </Badge>
                      ) : (
                        <span className="text-sm text-[#92400e]">{'\u2014'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/business/dashboard/deals/${deal.id}/edit`}
                        >
                          <Button variant="ghost" size="sm">
                            <PencilSimple size={18} weight="light" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(deal)}
                          className="text-red-600 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash size={18} weight="light" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-[#d4c4b0]">
            {filteredDeals.map((deal) => (
              <div key={deal.id} className="p-4">
                {/* Header: Title + Category */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} weight="fill" className="text-amber-800" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#451a03] truncate">
                        {deal.service_name ?? 'Untitled Deal'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {deal.service_category && (
                          <Badge variant="default" size="sm">
                            {deal.service_category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {deal.discount_percent != null && (
                    <Badge
                      variant="brand"
                      size="sm"
                      className="flex-shrink-0"
                    >
                      {Math.round(deal.discount_percent)}% off
                    </Badge>
                  )}
                </div>

                {/* Middle: Price */}
                <div className="flex items-center justify-between mb-3 py-3 border-t border-b border-[#d4c4b0]">
                  <div>
                    {deal.discount_price != null && (
                      <p className="font-medium text-amber-800">
                        {formatPrice(deal.discount_price, deal.unit_type)}
                      </p>
                    )}
                    {deal.original_price != null && (
                      <p className="text-sm text-[#92400e] line-through">
                        {formatPrice(deal.original_price, deal.unit_type)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: Actions */}
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/business/dashboard/deals/${deal.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <PencilSimple size={18} weight="light" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(deal)}
                    className="text-red-600 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash size={18} weight="light" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setDealToDelete(null)
        }}
        title="Delete Deal"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[#78350f]">
            Are you sure you want to delete{' '}
            <span className="font-medium text-[#451a03]">
              {dealToDelete?.service_name ?? 'this deal'}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false)
                setDealToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Boost Configuration Modal */}
      <Modal
        isOpen={boostModalOpen}
        onClose={() => {
          setBoostModalOpen(false)
          setDealToBoost(null)
        }}
        title="Boost Your Deal"
        size="lg"
      >
        {dealToBoost && (
          <SponsoredDealConfig
            deal={dealToBoost}
            onBoostSelect={handleBoostSelect}
            onCancel={() => {
              setBoostModalOpen(false)
              setDealToBoost(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
