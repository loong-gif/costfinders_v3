'use client'

import {
  ArrowCounterClockwise,
  CaretDown,
  MagnifyingGlass,
  MapPin,
} from '@phosphor-icons/react'
import Link from 'next/link'
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { DealList, ProviderNamesNote } from '@/components/features/dealCard'
import { DealGroups, TypicalBar } from '@/components/features/deals/dealGroups'
import {
  cheapestComparable,
  floorBrandText,
  priceText,
  type TypicalPrice,
  typicalText,
} from '@/lib/data/typicalPrice'
import type { AnonymousDeal } from '@/types/deal'

interface DealsGridProps {
  deals: AnonymousDeal[]
  /** Deal count before filtering, so the list can say "12 of 221". */
  totalCount?: number
  /** Pass only while filters are active — renders the recovery action. */
  onClearFilters?: () => void
  /**
   * A single treatment: its typical price in this city, drawn once above the rows. Without one
   * (every treatment but neurotoxins, or below the floor) the rows get a plain "Prices from $X".
   */
  typical?: TypicalPrice | null
  /** The city "All deals" view: rows grouped by treatment instead of one flat list. */
  groups?: Omit<ComponentProps<typeof DealGroups>, 'deals'>
}

/** Rows a long list shows before "Show all". The two nth-child classes below hold it too. */
const COLLAPSED_ROWS = 30

/**
 * A long server-rendered DealList cut to its first 30 rows, with a button that opens the rest in
 * place. "Every neurotoxins deal" printed all 337 rows, a 28,400px page (2026-09-28). The rest
 * are hidden, not left unrendered, so every deal stays in the HTML for crawlers and no deal data
 * is sent to the browser a second time as props.
 */
export function CollapsedDealList({
  count,
  children,
}: {
  /** Rows in the list. */
  count: number
  /** The DealList. */
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // The first row the button revealed, so a keyboard user carries on from where they were
  // instead of from the top of the list. Focusing it scrolls it into view.
  useEffect(() => {
    if (!expanded) return
    ref.current
      ?.querySelectorAll('ul > li')
      [COLLAPSED_ROWS]?.querySelector<HTMLElement>('a')
      ?.focus()
  }, [expanded])

  if (count <= COLLAPSED_ROWS) return <>{children}</>
  return (
    <div ref={ref}>
      <div
        // The 30th row loses divide-y's rule, which doubled the frame's own bottom border.
        className={
          expanded
            ? undefined
            : '[&_ul>li:nth-child(30)]:border-b-0 [&_ul>li:nth-child(n+31)]:hidden'
        }
      >
        {children}
      </div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border-default text-sm font-medium text-accent transition-colors hover:bg-bg-surface hover:text-accent-hover"
        >
          Show all {count} deals
          <CaretDown size={14} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * A city's deals — grouped by treatment on /deals/{city}, one flat list on
 * /deals/{treatment}/{city} — with the live count and the one line about hidden names. Both
 * pages name their city, so rows leave it out. (Named for the grid of tiles it used to be.)
 */
export function DealsGrid({
  deals,
  totalCount,
  onClearFilters,
  typical = null,
  groups,
}: DealsGridProps) {
  const isFiltered = totalCount !== undefined && totalCount > deals.length
  const from = typical || groups ? null : cheapestComparable(deals)

  // Empty state — always offers a way out. Two causes, two recoveries:
  // filters hid everything, or this area has nothing listed yet.
  if (deals.length === 0) {
    const filtersHidEverything = Boolean(onClearFilters)

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center mb-4">
          <MagnifyingGlass
            size={32}
            weight="light"
            className="text-text-muted"
          />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2 text-center">
          {filtersHidEverything
            ? 'No deals match your filters'
            : 'No deals here yet'}
        </h3>
        <p className="text-text-secondary text-center max-w-md">
          {filtersHidEverything
            ? totalCount
              ? `${totalCount} ${totalCount === 1 ? 'deal is' : 'deals are'} available here. Widen your price range or clear your filters to see them.`
              : 'Widen your price range or clear your filters to see more deals.'
            : "We don't have deals in this area yet. Try another city to see what's available."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              Clear filters
            </button>
          )}
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-full border border-text-primary text-sm font-semibold text-text-primary hover:bg-bg-surface transition-colors"
          >
            <MapPin size={16} weight="light" />
            Browse another city
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        {/* The count changes as a result of a filter or sort the user just
            applied, with no page reload to announce it. */}
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-text-secondary"
        >
          {isFiltered
            ? `Showing ${deals.length} of ${totalCount} deals`
            : `${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`}
        </p>
        <ProviderNamesNote />
      </div>

      {groups ? (
        <DealGroups deals={deals} {...groups} />
      ) : (
        <DealList
          deals={deals}
          showCity={false}
          typical={typical}
          header={
            typical ? (
              <div className="border-b border-border-default bg-bg-surface px-4 pt-3 pb-2">
                <p className="text-sm text-text-secondary">
                  Typical price:{' '}
                  <span className="font-semibold text-text-primary tabular-nums">
                    {typicalText(typical)}
                  </span>
                  , the median of {typical.pricedDealCount} advertised prices
                  from {typical.providerCount} providers.{' '}
                  <Link
                    href="/how-it-works#typical-prices"
                    className="font-medium text-accent underline-offset-2 hover:text-accent-hover hover:underline"
                  >
                    How we work it out
                  </Link>
                </p>
                <TypicalBar typical={typical} className="mt-2 mb-1" />
              </div>
            ) : (
              from && (
                <p className="border-b border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary">
                  Prices from{' '}
                  <span className="font-semibold text-text-primary tabular-nums">
                    {priceText(from)}
                  </span>
                  {floorBrandText(from.brand)}
                </p>
              )
            )
          }
        />
      )}
    </div>
  )
}
