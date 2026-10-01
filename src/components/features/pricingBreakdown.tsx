import { TIER_ICONS } from '@/components/patterns/treatmentIcons'
import { Card } from '@/components/ui/card'
import { dealPricing } from '@/lib/data/adapters'
import { TIER_LABELS } from '@/lib/data/interpretation'
import type { AnonymousDeal } from '@/types/deal'

interface PricingBreakdownProps {
  deal: AnonymousDeal
}

/**
 * A validity date carries no time and no zone — `clinic_promotions.campaign_end_date` is a
 * Postgres `date`. `new Date('2026-12-31')` parses that as UTC midnight, so
 * toLocaleDateString() in any zone behind UTC printed "12/30/2026": the deal appeared to
 * expire a day early. Format the parts directly instead. Absent for most offers (68/1000
 * resolve a start date, 104 an end date), so null is the ordinary answer.
 */
function formatValidityDate(dateStr: string): string | null {
  if (!dateStr) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return `${Number(m)}/${Number(d)}/${y}`
  }
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString()
}

export function PricingBreakdown({ deal }: PricingBreakdownProps) {
  // Same decision as the card that led the user here — one implementation, in adapters.ts.
  // This page had its own copy of it, which is how the two drifted apart.
  const pricing = dealPricing(deal)
  const tier = deal.interpretation.tier
  const TierIcon = TIER_ICONS[tier]

  const validFromFormatted = formatValidityDate(deal.validFrom)
  const validUntilFormatted = formatValidityDate(deal.validUntil)

  return (
    <Card variant="glass" padding="lg">
      {/* Main Pricing */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-x-3 flex-wrap">
          {/* Display + 4xl is for a money figure. 'free' leads with words now ("Free with
              membership") and styles like the other word leads. Ink, like every card. */}
          <span
            className={
              pricing.kind === 'price'
                ? 'text-4xl font-display font-bold tabular-nums text-text-primary'
                : 'text-xl sm:text-2xl font-display font-semibold text-text-primary'
            }
          >
            {pricing.strikeThrough && (
              <span className="sr-only">Deal price </span>
            )}
            {pricing.lead}
          </span>
          {/* What the figure buys: "per unit", "for 40 units". Null for a flat price and for
              every word lead. This printed the service's unit_type, which made "40 Units Botox
              $299" read "$299 unit" — the screenshot that started the price-basis fix. */}
          {pricing.basis && (
            <span className="text-text-muted">{pricing.basis}</span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* The badge is our subtraction, so it exists only with both prices behind it. */}
          {pricing.savings && (
            <span className="rounded-full bg-savings-bg px-2.5 py-1 text-sm font-semibold text-savings">
              Save {pricing.savings.percent}%
            </span>
          )}
          {/* <s>, not a styled <span>: line-through is CSS and is not exposed to assistive
              tech, so this announced as two bare prices in a row with nothing saying which one
              you pay. Same fix as dealCard.tsx. */}
          {pricing.strikeThrough && (
            <s className="text-text-muted tabular-nums">
              <span className="sr-only">Regular price </span>
              {pricing.strikeThrough}
            </s>
          )}
          {pricing.savings && (
            <span className="text-savings font-medium">
              Save {pricing.savings.amount}
            </span>
          )}
          {pricing.note && (
            <span className="text-text-secondary">{pricing.note}</span>
          )}
        </div>

        {/* A package divided out: "$7.48 per unit" under "$299 for 40 units". Last, so it never
            sits between the price and the regular price that is struck through against it. */}
        {pricing.unitPrice && (
          <p className="text-sm text-text-secondary">{pricing.unitPrice}</p>
        )}

        {/* The tier beside the price it qualifies. On a phone How we read this deal sits below
            the claim button, and "Confirm when booking" matters before a claim, not after. */}
        <a
          href="#how-we-read"
          className={`inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium ${
            tier === 'check'
              ? 'text-warning'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <TierIcon size={16} weight="bold" className="shrink-0" />
          {TIER_LABELS[tier].label}
          <span className="sr-only">: how we read this deal</span>
        </a>
      </div>

      {/* Validity */}
      {(validFromFormatted || validUntilFormatted) && (
        <div className="border-t border-border-default pt-4 mt-4">
          <p className="text-sm text-text-muted">
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
