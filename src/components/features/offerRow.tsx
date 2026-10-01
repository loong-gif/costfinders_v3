import type { Icon } from '@phosphor-icons/react'
import { MapPin } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  CONFIRMED_ICON,
  TIER_ICONS,
  treatmentIcon,
} from '@/components/patterns/treatmentIcons'
import { productLine } from '@/lib/data/adapters'
import { TIER_LABELS } from '@/lib/data/interpretation'
import {
  type TypicalPrice,
  vsTypical,
  vsTypicalLabel,
} from '@/lib/data/typicalPrice'
import type { LeanOffer } from '@/types/deal'

interface OfferRowProps {
  offer: LeanOffer
  /** Extra classes on the outer card, e.g. a stronger shadow for the top of a stack. */
  className?: string
  /**
   * Makes the whole row a link (a stretched anchor, so `action` can still be a button — a
   * <button> inside an <a> is invalid). Omit when a parent already wraps the row in a Link.
   */
  href?: string
  /** A control after the price block, e.g. SaveButton. Sits above the stretched link. */
  action?: ReactNode
  /** "Provider in {city}". Off where the page already names the one city every row is in. */
  showCity?: boolean
  /**
   * This treatment's typical price in the offer's own city, for "32% below typical". Pass it only
   * on a one-city page: a typical price from another city compares prices nobody can choose between.
   */
  typical?: TypicalPrice | null
  /** No frame of its own: a row inside a list that draws the dividers (DealList). */
  flush?: boolean
}

/**
 * The label under the headline saying how sure we are of the price, or null for "As advertised".
 * OfferTile prints the same one, so a row and a tile can never disagree on it.
 */
export function trustLabel(
  offer: LeanOffer,
): { text: string; Icon: Icon; tone: string } | null {
  if (offer.clinicConfirmed) {
    return {
      text: 'Confirmed by the clinic',
      Icon: CONFIRMED_ICON,
      tone: 'text-success',
    }
  }
  if (offer.interpretationTier === 'as-advertised') return null
  return {
    text: TIER_LABELS[offer.interpretationTier].label,
    Icon: TIER_ICONS[offer.interpretationTier],
    tone: 'text-text-muted',
  }
}

/**
 * The deal row: treatment icon, the offer's own words, price block on the right. No photo — we
 * hold none of the clinic's, and the stock still was ~60% of a 641px card. No rating: a
 * clinic's Google rating named it through the public directory (see offerToAnonymousDeal).
 */
export function OfferRow({
  offer,
  className = '',
  href,
  action,
  showCity = true,
  typical,
  flush = false,
}: OfferRowProps) {
  // The offer's words lead: 931 of 947 titles were a bare product or category name on
  // 2026-09-23, so "Neurotoxin" x21 said nothing about which deal. The product moves underneath.
  const headline = offer.subtitle ?? offer.title
  const kind = productLine(offer)
  const trust = trustLabel(offer)
  const vs = vsTypical(
    offer.comparable,
    typical?.treatment === offer.treatment ? typical : null,
  )
  const TreatmentIcon = treatmentIcon(offer.treatment)

  return (
    <div
      // Below sm the price block wraps onto its own line under the text (see it below): beside
      // it, "per unit for members" left the title 63px, "Provider in Newport Beach" took four
      // lines and the subtitle read "696 m…".
      className={`relative flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 transition-colors sm:flex-nowrap sm:gap-x-4 sm:px-4 ${
        flush
          ? 'hover:bg-bg-surface'
          : 'rounded-xl border border-border-default bg-bg-elevated shadow-sm hover:border-border-hover hover:shadow-md'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-text-primary sm:h-9 sm:w-9"
      >
        <TreatmentIcon size={18} weight="regular" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-text-primary sm:text-base">
          {headline}
        </h3>
        {/* Wraps, never truncates: a narrow row cut "Provider in Tucson" to "Provider" at
            390px, and the homepage's How it works card to "Provider in T…". */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
          {kind && <span>{kind}</span>}
          {offer.requiresMembership && (
            <span className="rounded-full border border-border-default px-1.5 text-xs font-medium text-text-primary">
              Members
            </span>
          )}
          {showCity && (
            <span className="flex items-center gap-1">
              <MapPin size={12} weight="bold" className="shrink-0" />
              {offer.cityLabel
                ? `Provider in ${offer.cityLabel}`
                : 'Local provider'}
            </span>
          )}
          {trust && (
            <span className={`flex items-center gap-1 ${trust.tone}`}>
              <trust.Icon size={12} weight="bold" className="shrink-0" />
              {trust.text}
            </span>
          )}
        </div>
      </div>

      {/* Phone: one line under the text, indented past the icon (32px + 12px gap), after
          `action` so a save button stays on the first line. sm and up: the right-hand column. */}
      <div className="order-last flex basis-full flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-11 sm:order-none sm:shrink-0 sm:basis-auto sm:flex-col sm:items-end sm:pl-0 sm:text-right">
        <div
          className={
            offer.leadIsPrice
              ? 'font-display text-lg font-bold tabular-nums text-text-primary sm:text-xl'
              : 'font-display text-base font-semibold text-text-primary'
          }
        >
          {offer.strikeThrough && <span className="sr-only">Deal price </span>}
          {offer.lead}
        </div>
        {/* Capped so it wraps: on one line "per Botox-equivalent unit for members" took ~40%
            of a 712px row and pushed the headline onto three lines (2026-09-28). */}
        {(offer.basis || offer.strikeThrough) && (
          <div className="text-xs text-text-muted sm:max-w-48">
            {offer.basis}
            {/* <s>, not a styled <span>: line-through is not exposed to assistive tech, which
                heard two bare prices with nothing saying which you pay. */}
            {offer.strikeThrough && (
              <s className={`tabular-nums ${offer.basis ? 'ml-1' : ''}`}>
                <span className="sr-only">Regular price </span>
                {offer.strikeThrough}
              </s>
            )}
          </div>
        )}
        {(offer.savingsPercent !== null || vs) && (
          <div className="flex flex-wrap items-center gap-x-2 sm:mt-0.5 sm:justify-end">
            {offer.savingsPercent !== null && (
              <span className="inline-flex rounded-full bg-savings-bg px-2 py-0.5 text-xs font-semibold text-savings">
                Save {offer.savingsPercent}%
              </span>
            )}
            {vs && (
              <span
                className={`text-xs tabular-nums ${vs.direction === 'below' ? 'font-medium text-savings' : 'text-text-secondary'}`}
              >
                {vsTypicalLabel(vs)}
              </span>
            )}
          </div>
        )}
      </div>

      {action && <div className="relative z-20 shrink-0">{action}</div>}
      {href && (
        <Link
          href={href}
          aria-label={`View deal: ${headline}`}
          // Inset ring: a list frame clips anything drawn outside its first and last rows.
          className={`absolute inset-0 z-10 focus-visible:-outline-offset-2 ${flush ? '' : 'rounded-xl'}`}
        />
      )}
    </div>
  )
}
