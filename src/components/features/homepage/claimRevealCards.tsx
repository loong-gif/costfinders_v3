import {
  Check,
  Lock,
  MagnifyingGlass,
  MapPin,
} from '@phosphor-icons/react/dist/ssr'
import { OfferRow } from '@/components/features/offerRow'
import type { LeanOffer } from '@/types/deal'

/** An offer row with its provider still locked — the pre-claim state, as the homepage's claim
 *  illustration shows it (valuePropsSection, beside RevealedCard). Browse lists and the business
 *  landing page show the bare OfferRow, with one ProviderNamesNote-style line above; here the
 *  strip is the point. */
export function AnonymousCard({ offer }: { offer: LeanOffer }) {
  return (
    <div>
      <OfferRow offer={offer} />
      <div className="-mt-2 flex items-center gap-1.5 rounded-b-xl border border-t-0 border-border-default bg-bg-surface px-3 pt-4 pb-2 text-xs text-text-secondary">
        <Lock size={12} weight="bold" className="shrink-0" />
        Provider name hidden until you claim
      </div>
    </div>
  )
}

/** The same offer row after a claim — provider details revealed. Never invent a name; the
 *  label itself is the reveal. */
export function RevealedCard({ offer }: { offer: LeanOffer }) {
  return (
    <div>
      <OfferRow offer={offer} />
      <div className="-mt-2 rounded-b-xl border-2 border-t-0 border-accent bg-bg-elevated px-3 pt-4 pb-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-savings-bg px-2 py-0.5 text-xs font-semibold text-savings">
          <Check size={12} weight="bold" />
          Claimed
        </span>
        <p className="mt-1.5 text-sm font-semibold text-text-primary">
          Provider name, address, phone and website revealed
        </p>
      </div>
    </div>
  )
}

/** Decorative miniature of the search pill — not interactive, the real control is HeroSearch. */
export function MiniSearch() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center rounded-full border border-border-default bg-bg-elevated p-1.5 text-sm shadow-sm"
    >
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-text-primary">
        <MagnifyingGlass size={14} weight="bold" className="text-text-muted" />
        Botox
      </span>
      <span className="h-5 w-px bg-border-default" />
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-text-primary">
        <MapPin size={14} weight="bold" className="text-text-muted" />
        Tucson
      </span>
      <span className="ml-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
        Search
      </span>
    </div>
  )
}
