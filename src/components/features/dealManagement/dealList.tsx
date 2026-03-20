'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  MagnifyingGlass,
  Plus,
  PencilSimple,
  Pause,
  Play,
  Trash,
  Eye,
  Users,
  Tag,
  Rocket,
} from '@phosphor-icons/react'
import type { Deal, TreatmentCategory } from '@/types/deal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { SponsoredDealConfig } from '@/components/features/sponsoredDealConfig'
import { getDealsForBusiness, toggleDealStatus, deleteDeal } from '@/lib/mock-data/deals'
import {
  getActiveBoosts,
  isDealEligibleForSponsorship,
  createBoost,
  getActiveBoostForDeal,
} from '@/lib/mock-data/sponsorship'

type FilterTab = 'all' | 'active' | 'paused'

const categoryLabels: Record<TreatmentCategory, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

interface DealListProps {
  businessId: string
}

export function DealList({ businessId }: DealListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null)
  const [boostModalOpen, setBoostModalOpen] = useState(false)
  const [dealToBoost, setDealToBoost] = useState<Deal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get deals for this business
  const allDeals = useMemo(() => {
    return getDealsForBusiness(businessId)
  }, [businessId, refreshKey])

  // Filter deals based on tab and search
  const filteredDeals = useMemo(() => {
    let filtered = allDeals

    // Filter by status
    if (activeTab === 'active') {
      filtered = filtered.filter((deal) => deal.isActive)
    } else if (activeTab === 'paused') {
      filtered = filtered.filter((deal) => !deal.isActive)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.category.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [allDeals, activeTab, searchQuery])

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allDeals.length,
      active: allDeals.filter((d) => d.isActive).length,
      paused: allDeals.filter((d) => !d.isActive).length,
    }
  }, [allDeals])

  // Count sponsored deals
  const sponsoredCount = useMemo(() => {
    return getActiveBoosts(businessId).length
  }, [businessId, refreshKey])

  const handleToggleStatus = (deal: Deal) => {
    toggleDealStatus(deal.id)
    setRefreshKey((k) => k + 1)
  }

  const handleDeleteClick = (deal: Deal) => {
    setDealToDelete(deal)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = () => {
    if (dealToDelete) {
      deleteDeal(dealToDelete.id)
      setRefreshKey((k) => k + 1)
      setDeleteModalOpen(false)
      setDealToDelete(null)
    }
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
      setRefreshKey((k) => k + 1)
    }
  }

  const formatPrice = (price: number, unit: string) => {
    return `$${price.toFixed(price % 1 === 0 ? 0 : 2)} ${unit}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deals</h1>
          <p className="text-text-secondary mt-1">
            Manage your special offers and promotions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/business/dashboard/deals/sponsored">
            <Button variant="secondary">
              <Rocket size={18} weight="fill" className="text-brand-primary" />
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
            {(['all', 'active', 'paused'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${
                    activeTab === tab
                      ? 'bg-brand-primary text-white'
                      : 'bg-glass-bg text-text-secondary hover:text-text-primary hover:bg-glass-bg-hover'
                  }
                `}
                type="button"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 sm:max-w-xs">
            <div className="relative">
              <MagnifyingGlass
                size={20}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
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
            <Tag size={48} weight="light" className="mx-auto text-text-tertiary mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {searchQuery ? 'No deals found' : 'No deals yet'}
            </h3>
            <p className="text-text-secondary mb-6">
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
                <tr className="border-b border-glass-border">
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Deal
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Price
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Performance
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-glass-bg/50 transition-colors"
                  >
                    {/* Deal Title */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                          <Tag size={20} weight="fill" className="text-brand-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {deal.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {deal.isFeatured && (
                              <Badge variant="brand" size="sm">
                                Featured
                              </Badge>
                            )}
                            {getActiveBoostForDeal(deal.id) && (
                              <Badge variant="info" size="sm">
                                <Rocket size={10} weight="fill" className="mr-0.5" />
                                Boosted
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      <Badge variant="default" size="sm">
                        {categoryLabels[deal.category]}
                      </Badge>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-brand-primary">
                          {formatPrice(deal.dealPrice, deal.unit)}
                        </p>
                        <p className="text-sm text-text-tertiary line-through">
                          {formatPrice(deal.originalPrice, deal.unit)}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <Badge
                        variant={deal.isActive ? 'success' : 'warning'}
                        size="sm"
                      >
                        {deal.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </td>

                    {/* Performance */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Users size={16} weight="fill" />
                          <span>{deal.claimCount}</span>
                        </div>
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Eye size={16} weight="fill" />
                          <span>{deal.viewCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Boost Action - only for eligible deals */}
                        {isDealEligibleForSponsorship(deal) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBoostClick(deal)}
                            title="Boost this deal"
                            className="text-brand-primary hover:text-brand-secondary hover:bg-brand-primary/10"
                          >
                            <Rocket size={18} weight="light" />
                          </Button>
                        )}
                        <Link href={`/business/dashboard/deals/${deal.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <PencilSimple size={18} weight="light" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(deal)}
                          title={deal.isActive ? 'Pause deal' : 'Activate deal'}
                        >
                          {deal.isActive ? (
                            <Pause size={18} weight="light" />
                          ) : (
                            <Play size={18} weight="light" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(deal)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
          <div className="md:hidden divide-y divide-glass-border">
            {filteredDeals.map((deal) => (
              <div key={deal.id} className="p-4">
                {/* Header: Title + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} weight="fill" className="text-brand-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{deal.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="default" size="sm">
                          {categoryLabels[deal.category]}
                        </Badge>
                        {deal.isFeatured && (
                          <Badge variant="brand" size="sm">
                            Featured
                          </Badge>
                        )}
                        {getActiveBoostForDeal(deal.id) && (
                          <Badge variant="info" size="sm">
                            <Rocket size={10} weight="fill" className="mr-0.5" />
                            Boosted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={deal.isActive ? 'success' : 'warning'} size="sm" className="flex-shrink-0">
                    {deal.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>

                {/* Middle: Price + Performance */}
                <div className="flex items-center justify-between mb-3 py-3 border-t border-b border-glass-border">
                  <div>
                    <p className="font-medium text-brand-primary">
                      {formatPrice(deal.dealPrice, deal.unit)}
                    </p>
                    <p className="text-sm text-text-tertiary line-through">
                      {formatPrice(deal.originalPrice, deal.unit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-text-secondary">
                      <Users size={16} weight="fill" />
                      <span>{deal.claimCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-text-secondary">
                      <Eye size={16} weight="fill" />
                      <span>{deal.viewCount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Actions */}
                <div className="flex items-center justify-end gap-2">
                  {isDealEligibleForSponsorship(deal) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBoostClick(deal)}
                      title="Boost this deal"
                      className="text-brand-primary hover:text-brand-secondary hover:bg-brand-primary/10"
                    >
                      <Rocket size={18} weight="light" />
                    </Button>
                  )}
                  <Link href={`/business/dashboard/deals/${deal.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <PencilSimple size={18} weight="light" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(deal)}
                    title={deal.isActive ? 'Pause deal' : 'Activate deal'}
                  >
                    {deal.isActive ? (
                      <Pause size={18} weight="light" />
                    ) : (
                      <Play size={18} weight="light" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(deal)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
          <p className="text-text-secondary">
            Are you sure you want to delete{' '}
            <span className="font-medium text-text-primary">
              {dealToDelete?.title}
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
            <Button variant="danger" onClick={handleConfirmDelete}>
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
