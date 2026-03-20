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
            isPaidTier ? 'bg-amber-400/20' : 'bg-stone-900'
          }`}>
            <Crown
              size={28}
              weight={isPaidTier ? 'fill' : 'light'}
              className={isPaidTier ? 'text-amber-400' : 'text-stone-400'}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-stone-100">
                {isPaidTier ? 'Professional plan' : 'Free plan'}
              </h2>
              <Badge variant={isPaidTier ? 'brand' : 'default'} size="sm">
                {isPaidTier ? 'Active' : 'Current'}
              </Badge>
            </div>
            <p className="text-sm text-stone-400 mt-0.5">
              {isPaidTier
                ? 'You pay the lowest rate: $3 per lead'
                : 'You pay $5 per lead. Upgrade to pay just $3.'}
            </p>
          </div>
        </div>

        {isPaidTier ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={20} weight="fill" />
            <span className="text-sm font-medium">Fully activated</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-400 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Upgrade to Professional
            <ArrowRight size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Quick summary for paid users */}
      {isPaidTier && (
        <div className="mt-4 pt-4 border-t border-stone-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-stone-500">Monthly fee</p>
              <p className="text-sm font-semibold text-stone-100">$99</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Per lead cost</p>
              <p className="text-sm font-semibold text-emerald-400">$3.00</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Savings per lead</p>
              <p className="text-sm font-semibold text-emerald-400">40%</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Deal limit</p>
              <p className="text-sm font-semibold text-stone-100">Unlimited</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick summary for free users */}
      {!isPaidTier && (
        <div className="mt-4 pt-4 border-t border-stone-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-stone-500">Monthly fee</p>
              <p className="text-sm font-semibold text-stone-100">$0</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Per lead cost</p>
              <p className="text-sm font-semibold text-stone-100">$5.00</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Could save</p>
              <p className="text-sm font-semibold text-amber-400">$2/lead</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Deal limit</p>
              <p className="text-sm font-semibold text-stone-100">3 active</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
