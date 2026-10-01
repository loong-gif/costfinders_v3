import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BiggestDiscountsSection } from '@/components/features/homepage/biggestDiscountsSection'
import { BusinessCtaSection } from '@/components/features/homepage/businessCtaSection'
import { CityPriceChart } from '@/components/features/homepage/cityPriceChart'
import { GuidesRow } from '@/components/features/homepage/guidesRow'
import {
  HeroSection,
  treatmentCityPairs,
} from '@/components/features/homepage/heroSection'
import { PriceBasisDiagram } from '@/components/features/homepage/priceBasisDiagram'
import { PriceRangeStrip } from '@/components/features/homepage/priceRangeStrip'
import { PriceStripPlot } from '@/components/features/homepage/priceStripPlot'
import { ValuePropsSection } from '@/components/features/homepage/valuePropsSection'
import { SignInRequiredPrompt } from '@/components/features/signInRequiredPrompt'
import { offerToLean } from '@/lib/data/adapters'
import {
  cityMediansByTreatment,
  discountHistogram,
  finePrintFacts,
  getFeaturedGuides,
  getHomepageCounts,
  lowestBotoxUnitOffers,
  pairStats,
  priceDistributions,
  TREATMENTS,
  treatmentPriceRanges,
} from '@/lib/data/homepage'
import {
  getClinicConfirmations,
  getFeaturedOffers,
  getOffersWithBusinesses,
} from '@/lib/data/offers'
import {
  getCityDealCounts,
  getTreatmentLabel,
  getUnifiedCities,
} from '@/lib/data/unified'
import { buildCanonicalUrl } from '@/lib/seo/metadata'
import type { LeanOffer } from '@/types/deal'

export const revalidate = 3600 // ISR: regenerate every hour

// The site's highest-authority URL shipped with no canonical at all, so every
// ?utm_/?fbclid variant of the homepage was a separate indexable duplicate. Title,
// description and og:image already come from the root layout.
export const metadata: Metadata = {
  alternates: { canonical: buildCanonicalUrl('/') },
  // og:url alongside it, so the homepage is not the one public page declaring a canonical
  // without the social equivalent. Title, description and og:image come from the root layout.
  openGraph: { url: buildCanonicalUrl('/') },
}

export default async function Home() {
  // One corpus read (React-cached, no filter) feeds every figure on the page; the helpers
  // below are pure functions over it, so seven data-led sections cost the same queries as one.
  // Nothing here is a literal count — see CLAUDE.md, "Row counts move under you".
  const [
    offers,
    featuredOffers,
    guides,
    counts,
    cityDealCounts,
    unifiedCities,
    confirmed,
  ] = await Promise.all([
    getOffersWithBusinesses(),
    // Two full rows of the 4-column desktop grid; phones and tablets show the first 4.
    getFeaturedOffers(8),
    getFeaturedGuides(6),
    getHomepageCounts(),
    getCityDealCounts(),
    getUnifiedCities(),
    getClinicConfirmations(),
  ])

  // toDeals() stamps "Confirmed by the clinic" on every list; these rows are built straight from
  // OfferViews, so they are stamped here from the same cached read, or a confirmed deal would
  // read "Our math" on the homepage and "Confirmed by the clinic" on its city page.
  const confirm = (lean: LeanOffer): LeanOffer => ({
    ...lean,
    clinicConfirmed: confirmed.has(lean.id),
  })
  const pairs = treatmentCityPairs(offers)
  const stats = pairStats(offers).map((pair) => ({
    ...pair,
    lowest: pair.lowest.map(confirm),
  }))
  const ranges = treatmentPriceRanges(offers)
  const distributions = priceDistributions(offers)
  const byTreatment = cityMediansByTreatment(offers, 8)
  const histogram = discountHistogram(offers)
  const facts = finePrintFacts(offers)
  // Real anonymous cards for the "how it works" and provider sections: the cheapest Botox
  // offers with a city, one per provider.
  const examples = lowestBotoxUnitOffers(offers, 3)
    .map(offerToLean)
    .map(confirm)

  // The search only offers treatments and cities that have at least one visible offer
  // together, so it cannot land on an empty page.
  const treatmentsWithOffers = new Set(pairs.map((p) => p.split(':')[0]))
  const treatments = TREATMENTS.filter((t) => treatmentsWithOffers.has(t)).map(
    (t) => ({ slug: t, label: getTreatmentLabel(t) }),
  )
  const cities = unifiedCities.map((c) => ({ slug: c.slug, label: c.name }))
  const defaultTreatment = treatments[0]?.slug ?? 'botox'
  // Default city: the one with the most deals that carries the default treatment.
  const defaultCity =
    cityDealCounts.find((c) => pairs.includes(`${defaultTreatment}:${c.slug}`))
      ?.slug ??
    cities[0]?.slug ??
    ''

  return (
    <main className="min-h-screen pt-16">
      <HeroSection
        counts={counts}
        treatments={treatments}
        cities={cities}
        pairs={pairs}
        pairStats={stats}
        defaultTreatment={defaultTreatment}
        defaultCity={defaultCity}
      />
      <PriceRangeStrip ranges={ranges} />
      <PriceStripPlot distributions={distributions} />
      <CityPriceChart byTreatment={byTreatment} cities={cityDealCounts} />
      <PriceBasisDiagram facts={facts} />
      <ValuePropsSection examples={examples} />
      <GuidesRow guides={guides} />
      <BiggestDiscountsSection
        offers={featuredOffers}
        histogram={histogram}
        confirmed={confirmed}
      />
      <BusinessCtaSection />
      {/* Reads ?signin=required client-side. Suspense keeps the page static (ISR). */}
      <Suspense fallback={null}>
        <SignInRequiredPrompt />
      </Suspense>
    </main>
  )
}
