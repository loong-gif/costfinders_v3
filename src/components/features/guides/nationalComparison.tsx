import type { GuideContent } from '@/types/guide'

interface NationalComparisonProps {
  content: GuideContent['nationalComparison']
  cityLabel: string
}

/**
 * Plots the researched local rate against the researched national rate.
 *
 * Both numbers come from the guide's JSON on purpose. This chart used to derive the local
 * side from live offers by averaging every row whose unit_type read "unit" — but that column
 * mixes true per-unit rates ($8/unit) with package totals filed under the same unit ($139 for
 * 20 units), so Tucson's $8/unit market rendered as $173/unit and the chart announced
 * "Tucson is 1053% above the national average" immediately below prose stating "roughly 47%
 * below". Live offer data still drives every other figure on the page, where it is comparable.
 */
export function NationalComparison({
  content,
  cityLabel,
}: NationalComparisonProps) {
  const basis = resolveBasis(content)

  return (
    <section aria-labelledby="national-comparison-heading" className="mb-10">
      <h2
        className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3"
        id="national-comparison-heading"
      >
        {cityLabel} vs national average
      </h2>
      <p className="text-text-secondary mb-6">{content.comparisonText}</p>

      {basis && (
        <ComparisonChart
          cityLabel={cityLabel}
          localAvg={basis.localAvg}
          nationalAvg={basis.nationalAvg}
          unitLabel={basis.unitLabel}
        />
      )}
    </section>
  )
}

/**
 * The one national/local pair the guide filled in. Neurotoxins are quoted per unit,
 * fillers per syringe, everything else per session; a guide that supplies only one side
 * of a pair renders prose without a chart rather than an invented comparison.
 */
function resolveBasis(content: GuideContent['nationalComparison']) {
  const pairs = [
    {
      nationalAvg: content.nationalAvgPerUnit,
      localAvg: content.localAvgPerUnit,
      unitLabel: 'per unit',
    },
    {
      nationalAvg: content.nationalAvgPerSyringe,
      localAvg: content.localAvgPerSyringe,
      unitLabel: 'per syringe',
    },
    {
      nationalAvg: content.nationalAvgPerSession,
      localAvg: content.localAvgPerSession,
      unitLabel: 'per session',
    },
  ]
  const match = pairs.find((p) => p.nationalAvg != null && p.localAvg != null)
  if (!match?.nationalAvg || !match.localAvg) return null
  return {
    nationalAvg: match.nationalAvg,
    localAvg: match.localAvg,
    unitLabel: match.unitLabel,
  }
}

function ComparisonChart({
  cityLabel,
  localAvg,
  nationalAvg,
  unitLabel,
}: {
  cityLabel: string
  localAvg: number
  nationalAvg: number
  unitLabel: string
}) {
  const diff = localAvg - nationalAvg
  const pctDiff = Math.round((Math.abs(diff) / nationalAvg) * 100)
  const maxVal = Math.max(nationalAvg, localAvg)

  return (
    <div className="bg-bg-elevated border border-border-default rounded-xl p-6">
      <div className="space-y-4">
        <Bar
          label="National average"
          tone="bg-text-muted"
          value={nationalAvg}
          unitLabel={unitLabel}
          widthPct={Math.round((nationalAvg / maxVal) * 100)}
        />
        <Bar
          label={`${cityLabel} average`}
          tone="bg-accent-graphic"
          value={localAvg}
          unitLabel={unitLabel}
          widthPct={Math.round((localAvg / maxVal) * 100)}
        />
      </div>

      {pctDiff > 0 && (
        <p className="mt-4 text-sm text-center text-text-muted">
          {cityLabel} is {pctDiff}% {diff < 0 ? 'below' : 'above'} the national
          average
        </p>
      )}
    </div>
  )
}

function Bar({
  label,
  tone,
  unitLabel,
  value,
  widthPct,
}: {
  label: string
  tone: string
  unitLabel: string
  value: number
  widthPct: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-text-muted">{label}</span>
        <span className="text-sm font-semibold text-text-primary">
          ${value} {unitLabel}
        </span>
      </div>
      <div className="h-3 bg-bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full ${tone} rounded-full transition-all duration-500`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}
