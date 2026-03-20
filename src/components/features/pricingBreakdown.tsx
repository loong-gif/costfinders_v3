import { Calculator } from '@phosphor-icons/react/dist/ssr'
import type { AnonymousDeal } from '@/types/deal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PricingBreakdownProps {
  deal: AnonymousDeal
}

export function PricingBreakdown({ deal }: PricingBreakdownProps) {
  const savings = deal.originalPrice - deal.dealPrice
  const hasUnitRange = deal.minUnits || deal.maxUnits
  const exampleUnits = deal.minUnits ?? 20
  const exampleTotal = deal.dealPrice * exampleUnits
  const exampleSavings = savings * exampleUnits

  return (
    <Card variant="glass" padding="lg">
      {/* Main Pricing */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl sm:text-4xl font-bold text-amber-800 font-mono">
            ${deal.dealPrice}
          </span>
          <span className="text-[#78350f]">{deal.unit}</span>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="brand" size="md">
            {deal.discountPercent}% OFF
          </Badge>
          <span className="text-[#92400e] line-through">
            ${deal.originalPrice}
          </span>
          <span className="text-emerald-600">Save ${savings}</span>
        </div>
      </div>

      {/* Unit Range */}
      {hasUnitRange && (
        <div className="border-t border-[#d4c4b0] pt-4 mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#78350f]">
            <Calculator size={18} weight="regular" />
            <span>Unit Requirements</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {deal.minUnits && (
              <div className="bg-[#faf5ee] rounded-lg p-3">
                <p className="text-xs text-[#92400e]">Minimum</p>
                <p className="text-lg font-semibold text-[#451a03]">
                  {deal.minUnits} units
                </p>
              </div>
            )}
            {deal.maxUnits && (
              <div className="bg-[#faf5ee] rounded-lg p-3">
                <p className="text-xs text-[#92400e]">Maximum</p>
                <p className="text-lg font-semibold text-[#451a03]">
                  {deal.maxUnits} units
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Example Calculation */}
      {hasUnitRange && (
        <div className="border-t border-[#d4c4b0] pt-4 mt-4 space-y-2">
          <p className="text-sm font-medium text-[#78350f]">
            Example: {exampleUnits} units
          </p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[#92400e]">Regular price</span>
              <span className="text-[#92400e] line-through">
                ${(deal.originalPrice * exampleUnits).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#78350f]">Deal price</span>
              <span className="text-[#451a03] font-medium">
                ${exampleTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">You save</span>
              <span className="text-emerald-600 font-medium">
                ${exampleSavings.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Validity */}
      <div className="border-t border-[#d4c4b0] pt-4 mt-4">
        <p className="text-sm text-[#92400e]">
          Valid: {new Date(deal.validFrom).toLocaleDateString()} —{' '}
          {new Date(deal.validUntil).toLocaleDateString()}
        </p>
      </div>
    </Card>
  )
}
