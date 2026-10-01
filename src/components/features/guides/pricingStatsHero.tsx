import {
  CurrencyDollar,
  Storefront,
  Tag,
  TrendDown,
} from '@phosphor-icons/react/dist/ssr'
import { RangeBar } from '@/components/features/homepage/priceRangeStrip'
import { formatPrice } from '@/lib/data/adapters'
import { floorBrandText, minBrandText } from '@/lib/data/typicalPrice'
import { treatmentCost } from '@/lib/utils/treatment-grammar'
import type { GuidePricingStats } from '@/types/guide'

interface PricingStatsHeroProps {
  treatmentLabel: string
  cityLabel: string
  stateCode: string
  stats: GuidePricingStats
  /** ISO date the researched prose was written. NOT the date the prices are from. */
  generatedAt: string
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

/** A guide that is not per unit: whole dollars on a $3,499 package, cents below $10. */
function price(value: number): string {
  return value < 10 ? usdPrecise.format(value) : usd.format(value)
}

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

export function PricingStatsHero({
  treatmentLabel,
  cityLabel,
  stateCode,
  stats,
  generatedAt,
}: PricingStatsHeroProps) {
  const hasLiveDeals = stats.dealCount > 0
  // A Botox guide's figures are all per unit (see computeGuidePricingStats); a bare "$7.48"
  // beside "Typical price" reads as the cost of a treatment.
  const unit = stats.perUnit ? 'per unit' : undefined
  // Per-unit figures keep their cents at any size: $10.50/unit is not "$11".
  const fmt = stats.perUnit ? formatPrice : price
  // One row of exactly as many cards as there are from md, so a withheld median leaves no
  // empty slot (2026-09-28). Below md each price card takes a row of its own: at 320px a
  // half-width card orphaned "Starting / at" and wrapped its suffix under a 32px line.
  const cardCount =
    2 + Number(stats.floorPrice != null) + Number(stats.medianPrice != null)
  const priceCard = 'col-span-2 md:col-span-1'

  return (
    <section className="mb-10">
      <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-3">
        {treatmentLabel} Cost in {cityLabel}, {stateCode}
      </h1>
      <p className="text-text-secondary text-lg mb-6">
        What {treatmentLabel.toLowerCase()} {treatmentCost(treatmentLabel)} in{' '}
        {cityLabel}: how local providers structure the cost, what moves it, and
        where the savings actually are.
      </p>

      {hasLiveDeals && (
        <>
          <div className={`grid grid-cols-2 gap-3 ${MD_COLS[cardCount]}`}>
            {stats.floorPrice != null && (
              <StatCard
                className={priceCard}
                icon={<TrendDown size={20} weight="fill" />}
                label="Starting at"
                // The floor, any brand — the deals page's "from" — so a Dysport unit (a third of a
                // Botox unit) is named, as the deals page names it: on a line of its own, since
                // inline it read "$4 per unit · lowest is" / "Dysport".
                note={
                  floorBrandText(stats.floorBrand).replace(/^\s*·\s*/, '') ||
                  undefined
                }
                suffix={unit}
                value={fmt(stats.floorPrice)}
              />
            )}
            {stats.medianPrice != null && (
              <StatCard
                className={priceCard}
                icon={<CurrencyDollar size={20} weight="fill" />}
                // "Typical" is the deals pages' word for the neurotoxin median alone; elsewhere a
                // median pools unlike services, so it says what it is (publishedGuideStats()).
                label={stats.perUnit ? 'Typical price' : 'Median price'}
                suffix={unit}
                value={fmt(stats.medianPrice)}
              />
            )}
            <StatCard
              icon={<Tag size={20} weight="fill" />}
              label="Live deals"
              value={String(stats.dealCount)}
            />
            <StatCard
              icon={<Storefront size={20} weight="fill" />}
              label="Providers"
              value={String(stats.providerCount)}
            />
          </div>

          {stats.maxPrice != null && stats.minPrice != null && (
            <div className="mt-5">
              {stats.medianPrice != null && (
                <RangeBar
                  min={stats.minPrice}
                  max={stats.maxPrice}
                  median={stats.medianPrice}
                  className="mb-3"
                />
              )}
              {/* The pooled range, as the deals page bar draws it: per unit it leaves out Dysport
                  and starting prices, so it can start above "Starting at". */}
              <p className="text-sm text-text-secondary">
                Advertised prices run {fmt(stats.minPrice)}
                {minBrandText(stats.minBrand)} to {fmt(stats.maxPrice)}
                {stats.perUnit
                  ? ' per unit, counting each package at what one unit works out to and leaving out Dysport and starting prices.'
                  : ', from a single treatment to multi-session packages.'}
                {stats.medianPrice != null &&
                  ` The marker is the median, ${fmt(stats.medianPrice)}.`}
              </p>
            </div>
          )}
        </>
      )}

      {/*
        Two dates, because there are genuinely two. The prices above are re-read from the
        provider database on every regeneration; the written analysis around them was
        researched once. Stamping the live figures with the authoring date read as
        "Last updated March 2026" beside prices pulled that morning.

        This line used to say "Prices refreshed daily from verified provider listings", which
        was two claims the repo cannot back. Nothing here refreshes prices on a schedule:
        vercel.json's two crons are a drift check and a nightly rebuild, not an ingest,
        package.json has no refresh script, and monitor_state's 136 rows all have a NULL last_processed_at. The
        ingest that does populate updated_at is external, unowned and unmonitored — so if it
        stops, this sentence would keep promising freshness over rotting prices. And nothing is
        "verified": business_profiles holds 0 rows. Provenance is what we can actually stand
        behind, so provenance is what it states.

        ponytail: it states no as-of DATE, because this component only receives GuidePricingStats
        and that type carries no timestamp. The real date is available —
        promo_offer_master.updated_at is populated on all 1,000 rows — so the upgrade is to add
        `pricesAsOf` to GuidePricingStats in src/types/guide.ts, set it from max(updated_at) in
        src/lib/data/guide-stats.ts, and render it here.
      */}
      <p className="mt-3 text-xs text-text-muted">
        {hasLiveDeals
          ? 'These are prices providers advertised publicly on their own sites and booking pages, as listed when this page was last built. '
          : 'No provider in this market is advertising a price for this treatment right now. '}
        Market analysis researched {monthYear.format(new Date(generatedAt))}.
      </p>
    </section>
  )
}

/** md column count per number of cards. Literal class names, for Tailwind's scanner. */
const MD_COLS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  note,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  /** What the value is a price of — "per unit". Kept whole beside the value. */
  suffix?: string
  /** A small line under the value — "lowest is Dysport". */
  note?: string
  className?: string
}) {
  return (
    <div
      className={`bg-bg-elevated border border-border-default rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center gap-2 text-text-muted mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      {/* Flex, not inline text: a suffix that wraps gets its own 20px line, not a gap-filled
          line of the value's 32px. */}
      <p className="flex flex-wrap items-baseline gap-x-1.5 font-display text-2xl font-bold tabular-nums text-text-primary">
        {value}
        {suffix && (
          <span className="whitespace-nowrap text-sm font-medium text-text-muted">
            {suffix}
          </span>
        )}
      </p>
      {note && <p className="mt-0.5 text-sm text-text-muted">{note}</p>}
    </div>
  )
}
