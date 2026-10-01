import { Info } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface GuideMethodologyProps {
  treatmentLabel: string
  cityLabel: string
  providerCount: number
  generatedAt: string
}

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

/**
 * Where the numbers come from, and what this page is not.
 *
 * These are YMYL cosmetic-medical pages carrying price claims. Saying plainly where the
 * figures originate, what they exclude, and that this is not medical advice is both the
 * honest thing to publish and the E-E-A-T signal a price guide is otherwise missing.
 */
export function GuideMethodology({
  treatmentLabel,
  cityLabel,
  providerCount,
  generatedAt,
}: GuideMethodologyProps) {
  return (
    <section
      aria-labelledby="methodology-heading"
      className="mb-10 bg-bg-surface rounded-xl p-6"
    >
      <h2
        className="flex items-center gap-2 font-display text-lg font-bold text-text-primary mb-3"
        id="methodology-heading"
      >
        <Info className="text-text-muted" size={20} weight="fill" />
        How we compiled these costs
      </h2>

      {/*
        "They refresh daily." is gone from the first paragraph: nothing in the repo refreshes
        prices (vercel.json's two crons are a drift check and a nightly rebuild, not an ingest;
        there is no refresh script in package.json; and all 136 monitor_state rows have a NULL
        last_processed_at). The ingest that populates promo_offer_master.updated_at is external,
        unowned and unmonitored, so a freshness promise here would keep asserting itself over
        stale prices if it stopped. See pricingStatsHero.tsx for the same fix and for the
        as-of-date upgrade path.
      */}
      <div className="space-y-3 text-sm text-text-secondary">
        <p>
          The cost figures on this page come from {treatmentLabel.toLowerCase()}{' '}
          offers that {cityLabel} providers published themselves — on their own
          sites, booking pages and public promotions
          {providerCount > 0 &&
            `, currently ${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`}
          . We re-read them from those listings each time this page is rebuilt.
          The written market analysis around them was researched in{' '}
          {monthYear.format(new Date(generatedAt))}.
        </p>
        <p>
          Advertised prices are a starting point, not a quote. They routinely
          exclude consultation fees, the number of units or syringes you
          personally need, touch-up visits, and any conditions attached to a
          promotion. Ask each provider for an itemised total before booking.
        </p>
        <p>
          CostFinders is a price comparison service, not a medical provider.
          Nothing here is medical advice, and no price on this page is an offer
          of treatment. Whether a treatment is appropriate for you is a decision
          for a licensed clinician who has examined you.{' '}
          <Link
            className="text-accent hover:text-accent-hover underline underline-offset-2"
            href="/guides"
          >
            See our other cost guides
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
