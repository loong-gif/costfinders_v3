import type { GuideContent, GuidePricingStats } from '@/types/guide'

interface NationalComparisonProps {
  content: GuideContent['nationalComparison']
  cityLabel: string
  stats: GuidePricingStats
}

export function NationalComparison({
  content,
  cityLabel,
  stats,
}: NationalComparisonProps) {
  const nationalAvg =
    content.nationalAvgPerUnit ?? content.nationalAvgPerSyringe
  if (!nationalAvg) return null

  // Find the comparable local average from byUnitType
  // For Botox: match "unit"; for Fillers: match "syringe"
  const isPerUnit = content.nationalAvgPerUnit != null
  const targetUnitType = isPerUnit ? 'unit' : 'syringe'
  const matchingUnit = stats.byUnitType.find(
    (u) => u.unitType.toLowerCase() === targetUnitType,
  )
  const localAvg = matchingUnit?.avgPrice ?? stats.avgPrice
  if (!localAvg) return null

  const diff = localAvg - nationalAvg
  const pctDiff = Math.round((Math.abs(diff) / nationalAvg) * 100)
  const isBelow = diff < 0
  const isAbove = diff > 0

  const unitLabel = isPerUnit ? 'per unit' : 'per syringe'

  // Bar widths (scale relative to the larger value)
  const maxVal = Math.max(nationalAvg, localAvg)
  const nationalWidth = Math.round((nationalAvg / maxVal) * 100)
  const localWidth = Math.round((localAvg / maxVal) * 100)

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-[#451a03] mb-3">
        {cityLabel} vs national average
      </h2>
      <p className="text-[#78350f]/80 mb-6">{content.comparisonText}</p>

      <div className="bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-6">
        <div className="space-y-4">
          {/* National average bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[#78350f]/70">
                National average
              </span>
              <span className="text-sm font-semibold text-[#451a03]">
                ${nationalAvg} {unitLabel}
              </span>
            </div>
            <div className="h-3 bg-[#e8ddd0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#78350f]/40 rounded-full transition-all duration-500"
                style={{ width: `${nationalWidth}%` }}
              />
            </div>
          </div>

          {/* Local average bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[#78350f]/70">
                {cityLabel} average
              </span>
              <span className="text-sm font-semibold text-[#451a03]">
                ${localAvg} {unitLabel}
              </span>
            </div>
            <div className="h-3 bg-[#e8ddd0] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-800 rounded-full transition-all duration-500"
                style={{ width: `${localWidth}%` }}
              />
            </div>
          </div>
        </div>

        {(isBelow || isAbove) && (
          <p className="mt-4 text-sm text-center text-[#78350f]/70">
            {isBelow
              ? `${cityLabel} is ${pctDiff}% below the national average`
              : `${cityLabel} is ${pctDiff}% above the national average`}
          </p>
        )}
      </div>
    </section>
  )
}
