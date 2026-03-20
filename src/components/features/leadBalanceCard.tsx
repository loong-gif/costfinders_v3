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
          <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
            <Users size={24} weight="fill" className="text-amber-800" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#451a03]">Your lead balance</h3>
            <p className="text-sm text-[#78350f]">Prepaid leads available</p>
          </div>
        </div>
        {isLowBalance && (
          <Badge variant="warning" size="sm">
            Low balance
          </Badge>
        )}
      </div>

      {/* Lead Balance */}
      <div className="bg-[#f2ebe2] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#78350f]">Available leads</span>
          <span className="text-3xl font-bold text-[#451a03]">{credits.available}</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-[#faf5ee] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-amber-800 rounded-full transition-all duration-300"
            style={{ width: `${100 - usagePercent}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-[#92400e]">
          <span>{credits.used} used</span>
          <span>{credits.totalPurchased} total purchased</span>
        </div>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="bg-amber-800/5 border border-amber-800/15 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Warning size={20} weight="fill" className="text-amber-800 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#451a03]">Running low on leads</p>
              <p className="text-xs text-[#78350f] mt-1">
                You have only {credits.available} leads left. Buy more to keep receiving inquiries without interruption.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Summary */}
      {usageHistory && usageHistory.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#f2ebe2] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ChartBar size={14} weight="fill" className="text-[#92400e]" />
              <span className="text-xs text-[#92400e]">This month</span>
            </div>
            <p className="text-lg font-semibold text-[#451a03]">{thisMonthUsage} leads</p>
          </div>
          <div className="bg-[#f2ebe2] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ChartBar size={14} weight="light" className="text-[#92400e]" />
              <span className="text-xs text-[#92400e]">Last month</span>
            </div>
            <p className="text-lg font-semibold text-[#451a03]">{lastMonthUsage} leads</p>
          </div>
        </div>
      )}

      {/* Buy More Button */}
      {onBuyMore && (
        <button
          type="button"
          onClick={onBuyMore}
          className="w-full py-3 px-4 bg-[#f2ebe2] hover:bg-[#faf5ee] border border-[#d4c4b0] rounded-xl text-sm font-semibold text-[#451a03] transition-all flex items-center justify-center gap-2"
        >
          <Plus size={18} weight="bold" />
          Buy more leads
        </button>
      )}
    </Card>
  )
}
