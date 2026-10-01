'use client'

import { ArrowRight, CaretDown } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { DealList } from '@/components/features/dealCard'
import { PriceRangeBar } from '@/components/patterns/priceRangeBar'
import {
  NO_TREATMENT_ICON,
  TREATMENT_ICONS,
} from '@/components/patterns/treatmentIcons'
import { formatPrice, getTreatmentLabel } from '@/lib/data/adapters'
import {
  cheapestComparable,
  floorBrandText,
  minBrandText,
  priceText,
  type TypicalPrice,
  typicalText,
} from '@/lib/data/typicalPrice'
import { groupByTreatment } from '@/lib/utils/deal-sorting'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'

/** Rows per group before "See all": enough to compare, few enough that every treatment fits. */
const GROUP_ROWS = 4

const groupHeader = 'border-b border-border-default bg-bg-surface px-4 py-2'

function dealsWord(n: number): string {
  return `${n} ${n === 1 ? 'deal' : 'deals'}`
}

/** One treatment's market in one city: its lowest to highest comparable price, coral to typical. */
export function TypicalBar({
  typical,
  className,
}: {
  typical: TypicalPrice
  className?: string
}) {
  const price = (n: number) =>
    `${formatPrice(n)}${typical.perUnit ? '/unit' : ''}`
  // "$3.72/unit (Xeomin)": the range's low end of another brand, printed bare, reads as a Botox
  // price.
  const brand = minBrandText(typical.minBrand)
  return (
    <PriceRangeBar
      min={typical.min}
      max={typical.max}
      median={typical.median}
      minLabel={`${price(typical.min)}${brand}`}
      maxLabel={price(typical.max)}
      medianLabel={`typical ${price(typical.median)}`}
      label={`Advertised ${typical.perUnit ? 'per-unit prices' : 'prices'} run from ${formatPrice(typical.min)}${brand} to ${formatPrice(typical.max)}; typical is ${typicalText(typical)}`}
      className={className}
    />
  )
}

interface DealGroupsProps {
  /** Already filtered and sorted: each group shows its first rows in this order. */
  deals: AnonymousDeal[]
  citySlug: string
  typical?: Partial<Record<TreatmentCategory, TypicalPrice>>
  /** Unfiltered deals per treatment — what "See all N" opens, the treatment page's count. */
  totals: Partial<Record<TreatmentCategory, number>>
}

/**
 * The city page's "All deals" view: one frame per treatment with its typical price (neurotoxins)
 * or its lowest price (the rest) and cheapest rows, then the offers that name no treatment. 156
 * deals in one flat list was the scroll problem; a group per treatment fits a city on a screen
 * or two and says where to go next.
 */
export function DealGroups({
  deals,
  citySlug,
  typical = {},
  totals,
}: DealGroupsProps) {
  return (
    <div className="space-y-6">
      {groupByTreatment(deals).map(({ treatment, deals: group }) =>
        treatment ? (
          <TreatmentGroup
            key={treatment}
            treatment={treatment}
            deals={group}
            citySlug={citySlug}
            typical={typical[treatment] ?? null}
            total={totals[treatment] ?? group.length}
          />
        ) : (
          <OtherOffers key="other" deals={group} />
        ),
      )}
    </div>
  )
}

function TreatmentGroup({
  treatment,
  deals,
  citySlug,
  typical,
  total,
}: {
  treatment: TreatmentCategory
  deals: AnonymousDeal[]
  citySlug: string
  typical: TypicalPrice | null
  total: number
}) {
  const Icon = TREATMENT_ICONS[treatment]
  const label = getTreatmentLabel(treatment)
  const headingId = `deal-group-${treatment}`
  const from = typical ? null : cheapestComparable(deals)
  return (
    <section aria-labelledby={headingId}>
      <DealList
        deals={deals.slice(0, GROUP_ROWS)}
        showCity={false}
        typical={typical}
        header={
          <div className={groupHeader}>
            <div className="flex min-h-[44px] flex-wrap items-center gap-x-3">
              <Icon
                size={20}
                weight="regular"
                aria-hidden="true"
                className="shrink-0 text-text-primary"
              />
              <h2
                id={headingId}
                className="font-display text-lg font-bold tracking-tight text-text-primary"
              >
                {label}
              </h2>
              <p className="text-sm text-text-secondary">
                {dealsWord(deals.length)}
                {typical && ` · typical ${typicalText(typical)}`}
                {from &&
                  ` · from ${priceText(from)}${floorBrandText(from.brand)}`}
              </p>
              <Link
                href={`/deals/${treatment}/${citySlug}`}
                className="ml-auto inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                See all {total}
                <span className="sr-only"> {label.toLowerCase()} deals</span>
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </Link>
            </div>
            {typical && <TypicalBar typical={typical} className="mb-1" />}
          </div>
        }
      />
    </section>
  )
}

/**
 * Deals with no treatment — a clinic-wide discount, an uncategorised offer. No treatment page
 * exists for them (see dbCategoryToTreatment), so the group opens in place instead of linking.
 */
function OtherOffers({ deals }: { deals: AnonymousDeal[] }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = NO_TREATMENT_ICON
  return (
    <section aria-labelledby="deal-group-other">
      <DealList
        deals={expanded ? deals : deals.slice(0, GROUP_ROWS)}
        showCity={false}
        header={
          <div className={groupHeader}>
            <div className="flex min-h-[44px] flex-wrap items-center gap-x-3">
              <Icon
                size={20}
                weight="regular"
                aria-hidden="true"
                className="shrink-0 text-text-primary"
              />
              <h2
                id="deal-group-other"
                className="font-display text-lg font-bold tracking-tight text-text-primary"
              >
                Other offers
              </h2>
              <p className="text-sm text-text-secondary">
                {dealsWord(deals.length)}
              </p>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Offers that don't name one treatment, such as a discount on any
              service.
            </p>
          </div>
        }
        footer={
          deals.length > GROUP_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-border-default text-sm font-medium text-accent transition-colors hover:bg-bg-surface hover:text-accent-hover"
            >
              {expanded
                ? 'Show fewer'
                : `Show all ${deals.length} other offers`}
              <CaretDown
                size={14}
                weight="bold"
                aria-hidden="true"
                className={expanded ? 'rotate-180' : ''}
              />
            </button>
          )
        }
      />
    </section>
  )
}
