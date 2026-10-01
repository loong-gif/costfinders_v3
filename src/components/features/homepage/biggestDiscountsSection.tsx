import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { OfferCard } from '@/components/features/offerCard'
import { SaveButton } from '@/components/patterns/saveButton'
import type { DiscountHistogram } from '@/lib/data/homepage'
import type { OfferView } from '@/types/supabase'
import { DiscountHistogramCard } from './discountHistogram'

interface BiggestDiscountsSectionProps {
  offers: OfferView[]
  histogram: DiscountHistogram
  /** getClinicConfirmations(): offer id to confirmed-at, for the tiles' "Confirmed by the clinic". */
  confirmed: Map<number, string>
}

/**
 * "Biggest advertised discounts", because that is literally what getFeaturedOffers() ranks
 * by: the percentage between a provider's own regular_price and its discount_price. The
 * section used to be titled "Trending" — nothing measures a trend (viewCount is hardcoded 0).
 *
 * The histogram beside the heading is the context: a grid that leads with "Save 91%" is
 * showing the tail of the distribution, and the card says what the middle looks like.
 */
export function BiggestDiscountsSection({
  offers,
  histogram,
  confirmed,
}: BiggestDiscountsSectionProps) {
  if (offers.length === 0) return null

  return (
    <section className="w-full bg-bg-base py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Biggest advertised discounts
            </h2>
            <p className="mt-1 text-text-secondary">
              Ranked by the discount each provider states against its own
              regular price.
            </p>
          </div>
          <DiscountHistogramCard histogram={histogram} />
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {offers.map((offer, index) => (
            // One column below sm: two 137px columns clamped titles mid-price, "Underarm
            // Session: $1…" for a $19 deal (2026-09-28). Four tiles below `lg`, eight from it.
            // Not wrapped in a <Link>: the tile carries its own stretched anchor, and the save
            // button cannot sit inside an <a>. Each <li> is a 4-row subgrid for OfferCard, so
            // the tiles in a row share their row lines and the prices line up.
            <li
              key={offer.id}
              className={`row-span-4 grid-rows-subgrid ${index >= 4 ? 'hidden lg:grid' : 'grid'}`}
            >
              <OfferCard
                offer={offer}
                href={`/deals/${offer.id}`}
                action={<SaveButton dealId={String(offer.id)} size="sm" />}
                clinicConfirmedAt={confirmed.get(offer.id) ?? null}
              />
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <Link
            href="/deals"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            View all deals
            <ArrowRight
              size={16}
              weight="bold"
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  )
}
