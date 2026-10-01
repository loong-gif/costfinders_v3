import { ArrowLeft, MapPin } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { DealSidebar, DealTradeNote } from '@/components/features/dealSidebar'
import { HowWeReadThisDeal } from '@/components/features/deals/howWeReadThisDeal'
import { DealMembership } from '@/components/features/deals/membershipTerms'
import { PriceInContext } from '@/components/features/deals/priceInContext'
import { PricingBreakdown } from '@/components/features/pricingBreakdown'
import { treatmentIcon } from '@/components/patterns/treatmentIcons'
import { dealToLean, getTreatmentLabel, productLine } from '@/lib/data/adapters'
import type { TypicalPrice } from '@/lib/data/typicalPrice'
import { cityToSlug } from '@/lib/data/unified'
import type { AnonymousDeal, Deal, MembershipTerms } from '@/types/deal'

interface DealDetailPageProps {
  deal: AnonymousDeal
  fullDeal: Deal
  /**
   * This deal's treatment's typical price in its city; null outside TYPICAL_TREATMENTS
   * (neurotoxins only) or below the floor.
   */
  typical?: TypicalPrice | null
  /** The plan behind a member price; null when none is needed or none is published. */
  membership?: MembershipTerms | null
}

export function DealDetailPage({
  deal,
  fullDeal,
  typical = null,
  membership = null,
}: DealDetailPageProps) {
  // Back to the list the visitor most likely came from, not the city index
  const citySlug = deal.locationArea ? cityToSlug(deal.locationArea) : ''
  const backHref = citySlug ? `/deals/${citySlug}` : '/deals'
  const backLabel = deal.locationArea
    ? `All ${deal.locationArea} deals`
    : 'All deals'
  // Place and rating read exactly as on the card that led here.
  const lean = dealToLean(deal)
  const CategoryIcon = treatmentIcon(deal.category)
  // The row's own headline and product line, so the page a shopper lands on leads with what the
  // row showed them: "Neurotoxin" x21 said nothing, and sat under "Neurotoxins". The product is
  // added only where it says more than the treatment ("Neurotoxins · Dysport"); an offer with no
  // treatment keeps its product name here once its words take the h1.
  const label = deal.category ? getTreatmentLabel(deal.category) : null
  const kind = productLine(lean)
  const iconLine = [label, kind && kind !== label ? kind : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 min-h-[44px] mb-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          {backLabel}
        </Link>

        {/* Two Column Layout. On mobile the order is title → price and claim → trade note →
            the long copy, so the CTA is not buried under the context sections. The first two
            rows hug the title and the note now that no photo fills them; the third takes
            whatever height the price column needs, so a short title never opens a gap above
            Price in context. No row gap on desktop: the margins below space the left column
            alone, so a claimed visitor's empty note row adds nothing. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-0">
          {/* Left Column, top */}
          <div className="lg:col-span-2 lg:row-start-1 space-y-4">
            {/* The treatment's icon where the stock photo was (owner decision, 2026-09-28):
                we hold no clinic photos, and 15 stills across 156 cards told nobody anything. */}
            {iconLine && (
              <p className="flex items-center gap-2.5 text-sm font-medium text-text-secondary">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-text-primary"
                >
                  <CategoryIcon size={20} weight="light" />
                </span>
                {iconLine}
              </p>
            )}

            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              {lean.subtitle ?? lean.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <MapPin size={14} weight="bold" className="shrink-0" />
                {lean.cityLabel
                  ? `Provider in ${lean.cityLabel}`
                  : 'Local provider'}
              </span>
              {/* No Google rating before a claim: matched against the public provider
                  directory it named the clinic (see offerToAnonymousDeal). The reveal shows it. */}
            </div>
          </div>

          {/* Right Column — beside the content on desktop, directly under the
              title on mobile */}
          <div className="space-y-4 lg:col-start-3 lg:row-start-1 lg:row-span-3">
            <PricingBreakdown deal={deal} />
            <DealSidebar deal={fullDeal} />
          </div>

          {/* Explain the trade before the visitor hits the locked panel: under the title on
              desktop, after the claim card on mobile, where its eight lines at 320px pushed
              the price below a 568px screen (2026-09-28). A client component so it
              disappears once this visitor has claimed. */}
          <DealTradeNote
            dealId={deal.id}
            businessId={fullDeal.businessId}
            className="lg:col-span-2 lg:row-start-2 lg:mt-4"
          />

          {/* Left Column, below the title on desktop. No "About this deal" or "Terms &
              conditions" any more: How we read this deal quotes the offer's own words and lists
              its conditions, and Membership prices the plan, so either would say it twice.
              The rule sits on the later section with 32px either side: divide-y drew it on the
              earlier one, flush under Price in context and under an open Report form. */}
          <div className="lg:col-span-2 lg:row-start-3 lg:mt-8 [&>*+*]:mt-8 [&>*+*]:border-t [&>*+*]:border-border-default [&>*+*]:pt-8">
            {typical && <PriceInContext deal={deal} typical={typical} />}
            <HowWeReadThisDeal deal={deal} />
            {deal.requiresMembership && (
              <DealMembership membership={membership} />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
