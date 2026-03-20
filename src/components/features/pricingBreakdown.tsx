import { Calculator } from '@phosphor-icons/react/dist/ssr'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AnonymousDeal } from '@/types/deal'

interface PricingBreakdownProps {
  deal: AnonymousDeal
}

function formatSavings(originalPrice: number, dealPrice: number): string {
  const raw = originalPrice - dealPrice
  return (Math.round(raw * 100) / 100).toFixed(2).replace(/\.00$/, '')
}

function getEffectiveDiscount(deal: AnonymousDeal): number {
  if (deal.discountPercent > 0) return deal.discountPercent
  if (deal.originalPrice > 0 && deal.dealPrice > 0 && deal.originalPrice > deal.dealPrice) {
    return Math.round((1 - deal.dealPrice / deal.originalPrice) * 100)
  }
  return 0
}

function formatValidityDate(dateStr: string): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString()
}

export function PricingBreakdown({ deal }: PricingBreakdownProps) {
  const hasDealPrice = deal.dealPrice > 0
  const hasOriginalPrice = deal.originalPrice > 0
  const hasSavings = hasOriginalPrice && hasDealPrice && deal.originalPrice > deal.dealPrice
  const savings = hasSavings ? formatSavings(deal.originalPrice, deal.dealPrice) : null
  const effectiveDiscount = getEffectiveDiscount(deal)
  const hasUnitRange = deal.minUnits || deal.maxUnits
  const exampleUnits = deal.minUnits ?? 20
  const exampleTotal = hasDealPrice ? deal.dealPrice * exampleUnits : 0
  const exampleSavings = hasSavings ? (deal.originalPrice - deal.dealPrice) * exampleUnits : 0

  const validFromFormatted = formatValidityDate(deal.validFrom)
  const validUntilFormatted = formatValidityDate(deal.validUntil)

  return (
    <Card variant="glass" padding="lg">
      {/* Main Pricing */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          {hasDealPrice ? (
            <span className="text-3xl sm:text-4xl font-bold text-amber-800 font-mono">
              ${deal.dealPrice}
            </span>
          ) : (
            <span className="text-xl sm:text-2xl font-semibold text-amber-800">
              Contact for pricing
            </span>
          )}
          <span className="text-[#78350f]">{deal.unit}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {effectiveDiscount > 0 && (
            <Badge variant="brand" size="md">
              {effectiveDiscount}% OFF
            </Badge>
          )}
          {hasSavings && (
            <>
              <span className="text-[#92400e] line-through">
                ${deal.originalPrice}
              </span>
              <span className="text-emerald-600">Save ${savings}</span>
            </>
          )}
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
      {hasUnitRange && hasDealPrice && (
        <div className="border-t border-[#d4c4b0] pt-4 mt-4 space-y-2">
          <p className="text-sm font-medium text-[#78350f]">
            Example: {exampleUnits} units
          </p>
          <div className="space-y-1">
            {hasOriginalPrice && (
              <div className="flex justify-between text-sm">
                <span className="text-[#92400e]">Regular price</span>
                <span className="text-[#92400e] line-through">
                  ${(Math.round(deal.originalPrice * exampleUnits * 100) / 100).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#78350f]">Deal price</span>
              <span className="text-[#451a03] font-medium">
                ${(Math.round(exampleTotal * 100) / 100).toLocaleString()}
              </span>
            </div>
            {hasSavings && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-600">You save</span>
                <span className="text-emerald-600 font-medium">
                  ${(Math.round(exampleSavings * 100) / 100).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validity */}
      {(validFromFormatted || validUntilFormatted) && (
        <div className="border-t border-[#d4c4b0] pt-4 mt-4">
          <p className="text-sm text-[#92400e]">
            {validFromFormatted && validUntilFormatted
              ? `Valid: ${validFromFormatted} — ${validUntilFormatted}`
              : validFromFormatted
                ? `Valid from: ${validFromFormatted} — Ongoing`
                : `Valid until: ${validUntilFormatted}`}
          </p>
        </div>
      )}
    </Card>
  )
}
