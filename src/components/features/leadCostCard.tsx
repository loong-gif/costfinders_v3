'use client'

import { CurrencyDollar, ArrowUp } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TierPricing, BusinessTier } from '@/lib/mock-data/leadPricing'
import { calculateTierSavings } from '@/lib/mock-data/leadPricing'

interface LeadCostCardProps {
  currentTier: BusinessTier
  currentPricing: TierPricing
  paidPricing: TierPricing
  onUpgrade?: () => void
}

export function LeadCostCard({
  currentTier,
  currentPricing,
  paidPricing,
  onUpgrade,
}: LeadCostCardProps) {
  const isOnFreeTier = currentTier === 'free'
  const savings = calculateTierSavings()

  return (
    <Card variant="glass" padding="lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
            <CurrencyDollar size={24} weight="fill" className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-100">What you pay per lead</h3>
            <p className="text-sm text-stone-400">
              Every time a consumer claims your deal
            </p>
          </div>
        </div>
        {!isOnFreeTier && (
          <Badge variant="success" size="sm">
            Best rate
          </Badge>
        )}
      </div>

      {/* Current Per-Lead Cost */}
      <div className="bg-stone-900 rounded-xl p-5 mb-4 text-center">
        <p className="text-4xl font-bold text-stone-100">
          ${currentPricing.pricePerLead.toFixed(2)}
        </p>
        <p className="text-sm text-stone-400 mt-1">per lead</p>
      </div>

      {/* Savings Comparison (only for free tier) */}
      {isOnFreeTier && (
        <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center flex-shrink-0">
              <ArrowUp size={20} weight="bold" className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-100 mb-1">
                Save {savings.percent}% with Professional
              </p>
              <p className="text-xs text-stone-400 mb-3">
                Pay ${paidPricing.pricePerLead.toFixed(2)} per lead instead of ${currentPricing.pricePerLead.toFixed(2)}
              </p>

              {/* Comparison */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-stone-900 rounded-lg p-2 text-center">
                  <p className="text-xs text-stone-500">Free plan</p>
                  <p className="text-sm font-semibold text-stone-100">
                    ${currentPricing.pricePerLead.toFixed(2)}/lead
                  </p>
                </div>
                <div className="bg-emerald-400/10 rounded-lg p-2 text-center">
                  <p className="text-xs text-emerald-400">Professional</p>
                  <p className="text-sm font-semibold text-emerald-400">
                    ${paidPricing.pricePerLead.toFixed(2)}/lead
                  </p>
                </div>
              </div>

              {onUpgrade && (
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Upgrade to save {savings.percent}%
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Professional tier message */}
      {!isOnFreeTier && (
        <div className="text-center">
          <p className="text-sm text-emerald-400 font-medium">
            You&apos;re saving 40% on every lead
          </p>
        </div>
      )}
    </Card>
  )
}
