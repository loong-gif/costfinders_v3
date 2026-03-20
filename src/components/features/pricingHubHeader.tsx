'use client'

import { Crown, CheckCircle, ArrowRight } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BusinessTier } from '@/lib/mock-data/leadPricing'

interface PricingHubHeaderProps {
  currentTier: BusinessTier
  onUpgrade?: () => void
}

export function PricingHubHeader({
  currentTier,
  onUpgrade,
}: PricingHubHeaderProps) {
  const isPaidTier = currentTier === 'paid'

  return (
    <Card variant="glass" padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            isPaidTier ? 'bg-amber-800/15' : 'bg-[#f2ebe2]'
          }`}>
            <Crown
              size={28}
              weight={isPaidTier ? 'fill' : 'light'}
              className={isPaidTier ? 'text-amber-800' : 'text-[#78350f]'}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#451a03]">
                {isPaidTier ? 'Professional plan' : 'Free plan'}
              </h2>
              <Badge variant={isPaidTier ? 'brand' : 'default'} size="sm">
                {isPaidTier ? 'Active' : 'Current'}
              </Badge>
            </div>
            <p className="text-sm text-[#78350f] mt-0.5">
              {isPaidTier
                ? 'You pay the lowest rate: $3 per lead'
                : 'You pay $5 per lead. Upgrade to pay just $3.'}
            </p>
          </div>
        </div>

        {isPaidTier ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={20} weight="fill" />
            <span className="text-sm font-medium">Fully activated</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-800 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Upgrade to Professional
            <ArrowRight size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Quick summary for paid users */}
      {isPaidTier && (
        <div className="mt-4 pt-4 border-t border-[#d4c4b0]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-[#92400e]">Monthly fee</p>
              <p className="text-sm font-semibold text-[#451a03]">$99</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Per lead cost</p>
              <p className="text-sm font-semibold text-emerald-600">$3.00</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Savings per lead</p>
              <p className="text-sm font-semibold text-emerald-600">40%</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Deal limit</p>
              <p className="text-sm font-semibold text-[#451a03]">Unlimited</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick summary for free users */}
      {!isPaidTier && (
        <div className="mt-4 pt-4 border-t border-[#d4c4b0]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-[#92400e]">Monthly fee</p>
              <p className="text-sm font-semibold text-[#451a03]">$0</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Per lead cost</p>
              <p className="text-sm font-semibold text-[#451a03]">$5.00</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Could save</p>
              <p className="text-sm font-semibold text-amber-800">$2/lead</p>
            </div>
            <div>
              <p className="text-xs text-[#92400e]">Deal limit</p>
              <p className="text-sm font-semibold text-[#451a03]">3 active</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
