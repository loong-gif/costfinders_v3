import { offerTreatmentRoute } from '@/lib/data/adapters'
import type { PairStat } from '@/lib/data/homepage'
import { cityToSlug } from '@/lib/data/unified'
import type { OfferView } from '@/types/supabase'
import { HeroPriceCheck } from './heroPriceCheck'
import type { SearchOption } from './heroSearch'

interface HeroSectionProps {
  counts: { deals: number; providers: number; cities: number }
  treatments: SearchOption[]
  cities: SearchOption[]
  pairs: string[]
  pairStats: PairStat[]
  defaultTreatment: string
  defaultCity: string
}

/**
 * Every `${treatment}:${citySlug}` pair with at least one visible offer. This is what the
 * search filters on. getAllTreatmentCityCombos() is NOT this — it is the full cross product
 * (every treatment × every city) that generateStaticParams prebuilds, ~250 of which are empty.
 */
export function treatmentCityPairs(offers: OfferView[]): string[] {
  const pairs = new Set<string>()
  for (const offer of offers) {
    const treatment = offerTreatmentRoute(offer.service_category)
    const city = offer.master_business_info?.city?.trim()
    if (treatment && city) pairs.add(`${treatment}:${cityToSlug(city)}`)
  }
  return [...pairs]
}

export function HeroSection({
  counts,
  treatments,
  cities,
  pairs,
  pairStats,
  defaultTreatment,
  defaultCity,
}: HeroSectionProps) {
  return (
    <section className="w-full bg-bg-base">
      <HeroPriceCheck
        treatments={treatments}
        cities={cities}
        pairs={pairs}
        pairStats={pairStats}
        defaultValue={{ treatment: defaultTreatment, city: defaultCity }}
        counts={counts}
      >
        <h1 className="animate-hero-fade-in font-display text-5xl font-bold leading-[0.95] tracking-[-0.03em] text-text-primary sm:text-6xl lg:text-7xl">
          Medspa prices,
          <br />
          <span className="relative inline-block">
            compared.
            {/* The one coral mark in the hero. Decorative, so it is aria-hidden and drawn in
                --color-accent-graphic, the bright coral reserved for non-text marks on white. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 300 14"
              preserveAspectRatio="none"
              className="absolute -bottom-2 left-0 h-3 w-full text-accent-graphic sm:-bottom-3"
            >
              <path
                d="M3 10 C 60 2, 150 2, 297 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-lg text-text-secondary sm:text-xl animate-hero-fade-in [animation-delay:150ms]">
          See what providers near you actually advertise for Botox, fillers,
          facials and laser, before you book.
        </p>
      </HeroPriceCheck>
    </section>
  )
}
