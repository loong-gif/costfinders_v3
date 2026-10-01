import { MapPin } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { trustLabel } from '@/components/features/offerRow'
import { treatmentIcon } from '@/components/patterns/treatmentIcons'
import {
  dealPricing,
  dealToLean,
  offerToAnonymousDeal,
  productLine,
} from '@/lib/data/adapters'
import type { AnonymousDeal } from '@/types/deal'
import type { OfferView } from '@/types/supabase'

interface OfferCardProps {
  offer: OfferView
  /** Passed through to OfferTile. */
  href?: string
  /** Passed through to OfferTile. */
  action?: ReactNode
  /**
   * From getClinicConfirmations(): an OfferView skips toDeals(), which stamps it on every list,
   * so the caller asks — or a confirmed deal reads "Our math" here and "Confirmed by the
   * clinic" on its city page.
   */
  clinicConfirmedAt?: string | null
}

export function OfferCard({
  offer,
  href,
  action,
  clinicConfirmedAt = null,
}: OfferCardProps) {
  return (
    <OfferTile
      deal={{ ...offerToAnonymousDeal(offer), clinicConfirmedAt }}
      href={href}
      action={action}
    />
  )
}

interface OfferTileProps {
  deal: AnonymousDeal
  /** Makes the whole tile a link via a stretched anchor, so `action` can stay a button. */
  href?: string
  /** A control in the top-right corner, e.g. SaveButton. */
  action?: ReactNode
}

/**
 * The compact deal tile, for the homepage showcases (spec: .planning/DEAL-BROWSE-AND-TRUST.md §2,
 * "A"). No photo: a stock still was ~60% of the old 641px card and we hold no clinic photos, so
 * a treatment icon stands in. It reads the same lean shape OfferRow prints, so the two can never
 * disagree on headline, price or tier.
 */
function OfferTile({ deal, href, action }: OfferTileProps) {
  const lean = dealToLean(deal)
  // The same price block as every deal surface, through the same adapter the deal page uses.
  const pricing = dealPricing(deal)
  const TreatmentIcon = treatmentIcon(lean.treatment)
  // The offer's own words lead: on 2026-09-28, 923 of 938 live titles were a bare service name
  // ("Neurotoxin", "Dermal Filler"), which the category label already says. The words say which
  // deal.
  const headline = lean.subtitle ?? lean.title
  // What OfferRow prints under its headline, from the same helper: the product ("Botox",
  // "Sculptra") where it says more than the category — Botox and Dysport units differ threefold.
  // Null for a deal that names no single treatment: no badge rather than a wrong one.
  const kind = productLine(lean)
  // OfferRow's own label: "Confirmed by the clinic" replaces the tier.
  const trust = trustLabel(lean)

  // A 4-row subgrid (icon, headline, price, meta) of its <li>, which is one of the grid's in
  // turn (biggestDiscountsSection.tsx): each row is as tall as its tallest tile, so the prices
  // in a row share a line. With a flex column and mt-auto, a tile whose meta wrapped to a
  // second line lifted its price ~40px above its neighbour's (2026-09-28).
  return (
    <div className="group relative row-span-4 grid grid-rows-subgrid gap-3 rounded-xl border border-border-default bg-bg-elevated p-3 transition-all duration-200 hover:border-border-hover hover:shadow-md sm:p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-text-secondary sm:h-9 sm:w-9">
          <TreatmentIcon size={18} weight="light" aria-hidden="true" />
        </span>
        {action && (
          <div className="relative z-20 ml-auto shrink-0">{action}</div>
        )}
      </div>

      {/* The product under the headline, as on a row, and wrapping: beside the icon and the 44px
          heart it had 55px on a phone and ~100px in a 4-up tile at 1024px, and "Laser Hair
          Removal" read "Laser H…". */}
      <div>
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent sm:text-base">
          {headline}
        </h3>
        {kind && (
          <p className="mt-0.5 text-xs text-text-secondary sm:text-sm">
            {kind}
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span
            className={
              pricing.kind === 'price'
                ? 'font-display text-xl font-bold tabular-nums text-text-primary sm:text-2xl'
                : 'font-display text-lg font-semibold text-text-primary'
            }
          >
            {pricing.strikeThrough && (
              <span className="sr-only">Deal price </span>
            )}
            {pricing.lead}
          </span>
          {pricing.basis && (
            <span className="text-xs text-text-muted sm:text-sm">
              {pricing.basis}
            </span>
          )}
          {/* <s>, not a styled <span>: line-through is not exposed to assistive tech, which
              heard two bare prices with nothing saying which you pay. */}
          {pricing.strikeThrough && (
            <s className="text-xs tabular-nums text-text-muted sm:text-sm">
              <span className="sr-only">Regular price </span>
              {pricing.strikeThrough}
            </s>
          )}
          {pricing.savings && (
            <span className="rounded-full bg-savings-bg px-2 py-0.5 text-xs font-semibold text-savings">
              Save {pricing.savings.percent}%
            </span>
          )}
        </div>
        {pricing.unitPrice && (
          <p className="mt-0.5 text-xs text-text-muted">{pricing.unitPrice}</p>
        )}
        {pricing.note && (
          <p className="mt-0.5 text-xs text-text-secondary">{pricing.note}</p>
        )}
      </div>

      {(lean.requiresMembership || trust || lean.cityLabel) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
          {/* The price is a member rate; the fee itself is shown only on the deal page. */}
          {lean.requiresMembership && (
            <span className="rounded-full border border-border-default px-2 py-0.5 font-medium">
              Members
            </span>
          )}
          {trust && (
            <span className={`flex items-center gap-1 ${trust.tone}`}>
              <trust.Icon size={12} weight="bold" aria-hidden="true" />
              {trust.text}
            </span>
          )}
          {/* Tiles only appear in mixed-city showcases, so the place is part of the deal. */}
          {lean.cityLabel && (
            <span className="flex items-center gap-1">
              <MapPin size={12} weight="bold" aria-hidden="true" />
              {lean.cityLabel}
            </span>
          )}
        </div>
      )}

      {href && (
        <Link
          href={href}
          aria-label={`View deal: ${headline}`}
          className="absolute inset-0 z-10 rounded-xl"
        />
      )}
    </div>
  )
}
