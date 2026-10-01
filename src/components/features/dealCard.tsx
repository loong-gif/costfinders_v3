import { Lock } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { OfferRow } from '@/components/features/offerRow'
import { SaveButton } from '@/components/patterns/saveButton'
import { dealToLean } from '@/lib/data/adapters'
import type { TypicalPrice } from '@/lib/data/typicalPrice'
import type { AnonymousDeal } from '@/types/deal'

interface DealCardProps {
  deal: AnonymousDeal
  /** Off on a page that already names the one city every row is in. */
  showCity?: boolean
  /** This treatment's typical price in this city — see OfferRow. */
  typical?: TypicalPrice | null
}

/**
 * The browse lists' deal row: OfferRow, flush inside a DealList, plus a save button. Not a
 * second row design — it only adds the button and the link.
 *
 * Always a link to the deal's own page. An `href` that defaulted to nothing once shipped the
 * treatment hubs, all provider pages and the neighborhood pages as grids of cards that could
 * not be clicked. Do NOT wrap a DealCard in a <Link>: it renders its own stretched anchor, and
 * the save button inside it cannot live inside an <a>.
 */
export function DealCard({ deal, showCity = true, typical }: DealCardProps) {
  return (
    <OfferRow
      offer={dealToLean(deal)}
      href={`/deals/${deal.id}`}
      action={<SaveButton dealId={deal.id} size="sm" />}
      showCity={showCity}
      typical={typical}
      flush
    />
  )
}

interface DealListProps extends Omit<DealCardProps, 'deal'> {
  deals: AnonymousDeal[]
  /** Inside the frame, above the rows: a group's heading and range bar. */
  header?: ReactNode
  /** Inside the frame, below the rows: a "show all" control. */
  footer?: ReactNode
}

/**
 * Every browse list: one frame, rows divided by rules. Rows, not a grid of tiles: a tile was
 * 641px tall and a screen held about three, so Newport Beach's 156 deals were 35,000px of scroll.
 */
export function DealList({
  deals,
  showCity,
  typical,
  header,
  footer,
}: DealListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-elevated">
      {header}
      <ul className="divide-y divide-border-default">
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard deal={deal} showCity={showCity} typical={typical} />
          </li>
        ))}
      </ul>
      {footer}
    </div>
  )
}

/**
 * Said once above a list, in place of a "Provider name hidden until you claim" strip under every
 * row: the same sentence 156 times is noise, and each strip made a card taller.
 */
export function ProviderNamesNote({ className = '' }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-1.5 text-sm text-text-secondary ${className}`}
    >
      <Lock size={14} weight="bold" className="mt-0.5 shrink-0" />
      <span>
        Provider names are revealed when you claim a deal.{' '}
        <Link
          href="/how-it-works#why-names-are-hidden"
          className="font-medium text-accent underline-offset-2 hover:text-accent-hover hover:underline"
        >
          How CostFinders works
        </Link>
      </span>
    </p>
  )
}
