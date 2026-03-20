'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Rocket,
  ArrowLeft,
  Clock,
  Eye,
  TrendUp,
  CheckCircle,
  XCircle,
  Calendar,
  CurrencyDollar,
  Lightning,
  Tag,
} from '@phosphor-icons/react'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { SponsoredDealConfig } from '@/components/features/sponsoredDealConfig'
import { getDealsForBusiness } from '@/lib/mock-data/deals'
import {
  getActiveBoosts,
  getBoostHistory,
  getBoostOptionById,
  getDaysRemaining,
  getBoostProgress,
  createBoost,
  cancelBoost,
  isDealEligibleForSponsorship,
  type ActiveBoost,
  type BoostHistory,
} from '@/lib/mock-data/sponsorship'
import type { Deal, TreatmentCategory } from '@/types/deal'

const categoryLabels: Record<TreatmentCategory, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

export default function SponsoredDealsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [boostModalOpen, setBoostModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [boostToCancel, setBoostToCancel] = useState<ActiveBoost | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get data
  const deals = useMemo(() => {
    if (!businessId) return []
    return getDealsForBusiness(businessId)
  }, [businessId, refreshKey])

  const activeBoosts = useMemo(() => {
    if (!businessId) return []
    return getActiveBoosts(businessId)
  }, [businessId, refreshKey])

  const boostHistoryData = useMemo(() => {
    if (!businessId) return []
    return getBoostHistory(businessId)
  }, [businessId])

  // Filter deals eligible for sponsorship
  const eligibleDeals = useMemo(() => {
    return deals.filter((deal) => isDealEligibleForSponsorship(deal))
  }, [deals])

  // Get deal info for active boosts
  const activeBoostsWithDeals = useMemo(() => {
    return activeBoosts.map((boost) => ({
      boost,
      deal: deals.find((d) => d.id === boost.dealId),
      option: getBoostOptionById(boost.boostOptionId),
    }))
  }, [activeBoosts, deals])

  const handleBoostDeal = (deal: Deal) => {
    setSelectedDeal(deal)
    setBoostModalOpen(true)
  }

  const handleBoostSelect = (boostOptionId: string) => {
    if (selectedDeal) {
      createBoost(selectedDeal.id, boostOptionId)
      setBoostModalOpen(false)
      setSelectedDeal(null)
      setRefreshKey((k) => k + 1)
    }
  }

  const handleCancelBoostClick = (boost: ActiveBoost) => {
    setBoostToCancel(boost)
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = () => {
    if (boostToCancel) {
      cancelBoost(boostToCancel.id)
      setCancelModalOpen(false)
      setBoostToCancel(null)
      setRefreshKey((k) => k + 1)
    }
  }

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-400">No business linked to your account.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/business/dashboard/deals"
          className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-100 transition-colors mb-4"
        >
          <ArrowLeft size={16} weight="light" />
          Back to Deals
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <Rocket size={28} weight="fill" className="text-amber-400" />
              Sponsored Deals
            </h1>
            <p className="text-stone-400 mt-1">
              Boost your deals to reach more customers and increase visibility
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Active Boosts */}
      <section>
        <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
          <Lightning size={20} weight="fill" className="text-amber-400" />
          Active Boosts
          {activeBoostsWithDeals.length > 0 && (
            <Badge variant="brand" size="sm">
              {activeBoostsWithDeals.length}
            </Badge>
          )}
        </h2>

        {activeBoostsWithDeals.length === 0 ? (
          <Card variant="glass" padding="lg">
            <div className="text-center py-8">
              <Rocket
                size={48}
                weight="light"
                className="mx-auto text-stone-500 mb-4"
              />
              <h3 className="text-lg font-medium text-stone-100 mb-2">
                No Active Boosts
              </h3>
              <p className="text-stone-400 mb-4">
                Start boosting your deals to increase visibility and attract more
                customers.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeBoostsWithDeals.map(({ boost, deal, option }) => (
              <ActiveBoostCard
                key={boost.id}
                boost={boost}
                deal={deal}
                option={option}
                onCancel={() => handleCancelBoostClick(boost)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Available Deals for Sponsorship */}
      <section>
        <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
          <Tag size={20} weight="fill" className="text-stone-500" />
          Available Deals
          {eligibleDeals.length > 0 && (
            <span className="text-sm font-normal text-stone-400">
              ({eligibleDeals.length} eligible)
            </span>
          )}
        </h2>

        {eligibleDeals.length === 0 ? (
          <Card variant="glass" padding="lg">
            <div className="text-center py-8">
              <Tag
                size={48}
                weight="light"
                className="mx-auto text-stone-500 mb-4"
              />
              <h3 className="text-lg font-medium text-stone-100 mb-2">
                No Eligible Deals
              </h3>
              <p className="text-stone-400">
                All your active deals are already boosted or pending approval.
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="glass" padding="none" className="overflow-hidden">
            <div className="divide-y divide-stone-800">
              {eligibleDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-stone-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} weight="fill" className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-100 truncate">
                        {deal.title}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-stone-400">
                        <Badge variant="default" size="sm">
                          {categoryLabels[deal.category]}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Eye size={14} weight="fill" />
                          {deal.viewCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button size="sm" onClick={() => handleBoostDeal(deal)}>
                    <Rocket size={16} weight="fill" />
                    Boost
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Section 3: Boost History */}
      <section>
        <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
          <Calendar size={20} weight="fill" className="text-stone-500" />
          Boost History
        </h2>

        {boostHistoryData.length === 0 ? (
          <Card variant="glass" padding="lg">
            <div className="text-center py-8">
              <Calendar
                size={48}
                weight="light"
                className="mx-auto text-stone-500 mb-4"
              />
              <h3 className="text-lg font-medium text-stone-100 mb-2">
                No Boost History
              </h3>
              <p className="text-stone-400">
                Your completed boosts will appear here.
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="glass" padding="none" className="overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-800">
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Deal
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Boost Type
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Duration
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Impressions
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Cost
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {boostHistoryData.map((history) => (
                    <BoostHistoryRow key={history.id} history={history} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-stone-800">
              {boostHistoryData.map((history) => {
                const startDate = new Date(history.startDate).toLocaleDateString()
                const endDate = new Date(history.endDate).toLocaleDateString()
                return (
                  <div key={history.id} className="p-4">
                    {/* Header: Deal Title + Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-100 truncate">
                          {history.dealTitle}
                        </p>
                        <Badge variant="default" size="sm" className="mt-1">
                          {history.boostName}
                        </Badge>
                      </div>
                      <Badge
                        variant={history.status === 'completed' ? 'success' : 'warning'}
                        size="sm"
                        className="flex-shrink-0"
                      >
                        {history.status === 'completed' ? (
                          <CheckCircle size={12} weight="fill" className="mr-1" />
                        ) : (
                          <XCircle size={12} weight="fill" className="mr-1" />
                        )}
                        {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Middle: Duration */}
                    <p className="text-sm text-stone-400 mb-3">
                      {startDate} - {endDate}
                    </p>

                    {/* Footer: Impressions + Cost */}
                    <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                      <span className="flex items-center gap-1 text-sm text-stone-400">
                        <Eye size={14} weight="fill" />
                        {history.impressionsDelivered.toLocaleString()} impressions
                      </span>
                      <span className="flex items-center gap-1 text-sm text-stone-100 font-medium">
                        <CurrencyDollar size={14} weight="fill" />
                        {history.totalCost}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </section>

      {/* Boost Configuration Modal */}
      <Modal
        isOpen={boostModalOpen}
        onClose={() => {
          setBoostModalOpen(false)
          setSelectedDeal(null)
        }}
        title="Boost Your Deal"
        size="lg"
      >
        {selectedDeal && (
          <SponsoredDealConfig
            deal={selectedDeal}
            onBoostSelect={handleBoostSelect}
            onCancel={() => {
              setBoostModalOpen(false)
              setSelectedDeal(null)
            }}
          />
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false)
          setBoostToCancel(null)
        }}
        title="End Boost Early"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-stone-400">
            Are you sure you want to end this boost early? This action cannot be
            undone and no refund will be issued.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCancelModalOpen(false)
                setBoostToCancel(null)
              }}
            >
              Keep Boost
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel}>
              End Boost
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Active Boost Card Component
interface ActiveBoostCardProps {
  boost: ActiveBoost
  deal: Deal | undefined
  option: ReturnType<typeof getBoostOptionById>
  onCancel: () => void
}

function ActiveBoostCard({ boost, deal, option, onCancel }: ActiveBoostCardProps) {
  const daysRemaining = getDaysRemaining(boost)
  const progress = getBoostProgress(boost)

  if (!deal || !option) return null

  return (
    <Card variant="glass" padding="md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Deal Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Rocket size={24} weight="fill" className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-stone-100 truncate">
                {deal.title}
              </p>
              <Badge variant="brand" size="sm">
                {option.name}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-stone-400 mt-1">
              <span className="flex items-center gap-1">
                <Clock size={14} weight="fill" />
                {daysRemaining} days left
              </span>
              <span className="flex items-center gap-1">
                <Eye size={14} weight="fill" />
                {boost.impressionsDelivered.toLocaleString()} impressions
              </span>
              <span className="flex items-center gap-1">
                <TrendUp size={14} weight="fill" className="text-green-400" />
                {option.impressionMultiplier}x boost
              </span>
            </div>
          </div>
        </div>

        {/* Progress and Actions */}
        <div className="flex items-center gap-4">
          {/* Progress Bar */}
          <div className="w-32 hidden sm:block">
            <div className="h-2 bg-stone-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-1 text-center">
              {Math.round(progress)}% complete
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={onCancel}>
            <XCircle size={16} weight="light" />
            End Early
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Boost History Row Component
interface BoostHistoryRowProps {
  history: BoostHistory
}

function BoostHistoryRow({ history }: BoostHistoryRowProps) {
  const startDate = new Date(history.startDate).toLocaleDateString()
  const endDate = new Date(history.endDate).toLocaleDateString()

  return (
    <tr className="hover:bg-stone-800/50 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-stone-100">{history.dealTitle}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant="default" size="sm">
          {history.boostName}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-stone-400">
        {startDate} - {endDate}
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1 text-sm text-stone-400">
          <Eye size={14} weight="fill" />
          {history.impressionsDelivered.toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1 text-sm text-stone-100 font-medium">
          <CurrencyDollar size={14} weight="fill" />
          {history.totalCost}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={history.status === 'completed' ? 'success' : 'warning'}
          size="sm"
        >
          {history.status === 'completed' ? (
            <CheckCircle size={12} weight="fill" className="mr-1" />
          ) : (
            <XCircle size={12} weight="fill" className="mr-1" />
          )}
          {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
        </Badge>
      </td>
    </tr>
  )
}
