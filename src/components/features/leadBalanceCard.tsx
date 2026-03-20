'use client'

import { Users, Warning, Plus, ChartBar } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BusinessCredits, CreditUsageHistory } from '@/lib/mock-data/leadPricing'

interface LeadBalanceCardProps {
  credits: BusinessCredits
  usageHistory?: CreditUsageHistory[]
  onBuyMore?: () => void
}

export function LeadBalanceCard({
  credits,
  usageHistory,
  onBuyMore,
}: LeadBalanceCardProps) {
  const usagePercent = credits.totalPurchased > 0
    ? Math.round((credits.used / credits.totalPurchased) * 100)
    : 0
  const isLowBalance = credits.available < 5

  // Calculate this month and last month usage from history
  const thisMonthUsage = usageHistory?.[usageHistory.length - 1]?.used ?? 0
  const lastMonthUsage = usageHistory?.[usageHistory.length - 2]?.used ?? 0

  return (
    <Card variant="glass" padding="lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
            <Users size={24} weight="fill" className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-100">Your lead balance</h3>
            <p className="text-sm text-stone-400">Prepaid leads available</p>
          </div>
        </div>
        {isLowBalance && (
          <Badge variant="warning" size="sm">
            Low balance
          </Badge>
        )}
      </div>

      {/* Lead Balance */}
      <div className="bg-stone-900 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-stone-400">Available leads</span>
          <span className="text-3xl font-bold text-stone-100">{credits.available}</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-stone-800 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${100 - usagePercent}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-stone-500">
          <span>{credits.used} used</span>
          <span>{credits.totalPurchased} total purchased</span>
        </div>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Warning size={20} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-stone-100">Running low on leads</p>
              <p className="text-xs text-stone-400 mt-1">
                You have only {credits.available} leads left. Buy more to keep receiving inquiries without interruption.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Summary */}
      {usageHistory && usageHistory.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-stone-900 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ChartBar size={14} weight="fill" className="text-stone-500" />
              <span className="text-xs text-stone-500">This month</span>
            </div>
            <p className="text-lg font-semibold text-stone-100">{thisMonthUsage} leads</p>
          </div>
          <div className="bg-stone-900 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ChartBar size={14} weight="light" className="text-stone-500" />
              <span className="text-xs text-stone-500">Last month</span>
            </div>
            <p className="text-lg font-semibold text-stone-100">{lastMonthUsage} leads</p>
          </div>
        </div>
      )}

      {/* Buy More Button */}
      {onBuyMore && (
        <button
          type="button"
          onClick={onBuyMore}
          className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-xl text-sm font-semibold text-stone-100 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={18} weight="bold" />
          Buy more leads
        </button>
      )}
    </Card>
  )
}
