import {
  ArrowLeft,
  Clock,
  Info,
  MapPin,
  Star,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { DealHeroImage } from '@/components/features/dealHeroImage'
import { DealSidebar } from '@/components/features/dealSidebar'
import { PricingBreakdown } from '@/components/features/pricingBreakdown'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AnonymousDeal, Deal, TreatmentCategory } from '@/types/deal'

const categoryLabels: Record<TreatmentCategory, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

interface DealDetailPageProps {
  deal: AnonymousDeal
  fullDeal: Deal
}

export function DealDetailPage({ deal, fullDeal }: DealDetailPageProps) {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 text-sm text-[#78350f] hover:text-[#451a03] transition-colors mb-6"
        >
          <ArrowLeft size={16} weight="bold" />
          Back to deals
        </Link>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <div className="relative aspect-video bg-[#faf5ee] rounded-2xl overflow-hidden">
              {/* Blurred Image — lock overlay hidden when deal is claimed */}
              <DealHeroImage
                dealId={fullDeal.id}
                src={deal.imageUrl}
                alt={deal.title}
              />

              {/* Badges (above blur) */}
              <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
                <Badge variant="default" size="md">
                  {categoryLabels[deal.category]}
                </Badge>
                {deal.isFeatured && (
                  <Badge variant="brand" size="md">
                    Featured
                  </Badge>
                )}
              </div>

              {/* Sponsored Indicator (above blur) */}
              {deal.isSponsored && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="text-xs text-[#92400e] bg-[#e8ddd0]/80 px-2 py-1 rounded">
                    Sponsored
                  </span>
                </div>
              )}
            </div>

            {/* Title & Meta */}
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#451a03]">
                {deal.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[#78350f]">
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} weight="fill" className="text-[#92400e]" />
                  <span>{deal.locationArea}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={16} weight="fill" className="text-amber-800" />
                  <span>
                    {deal.businessRating.toFixed(1)} ({deal.businessReviewCount}{' '}
                    reviews)
                  </span>
                </div>
                {deal.claimCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock
                      size={16}
                      weight="regular"
                      className="text-[#92400e]"
                    />
                    <span>{deal.claimCount} claimed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <Card
              variant="glass"
              padding="lg"
              className="bg-[#f2ebe2] border-[#d4c4b0] shadow-md"
            >
              <h2 className="text-lg font-semibold text-[#451a03] mb-3">
                About This Deal
              </h2>
              <p className="text-[#78350f] whitespace-pre-line">
                {deal.description}
              </p>
            </Card>

            {/* Terms */}
            <Card
              variant="glass"
              padding="lg"
              className="bg-[#f2ebe2] border-[#d4c4b0] shadow-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <Info size={20} weight="regular" className="text-[#92400e]" />
                <h2 className="text-lg font-semibold text-[#451a03]">
                  Terms & Conditions
                </h2>
              </div>
              <p className="text-sm text-[#78350f] whitespace-pre-line">
                {deal.termsAndConditions}
              </p>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Pricing Breakdown */}
            <PricingBreakdown deal={deal} />

            {/* Business Info / Auth Wall */}
            <DealSidebar deal={fullDeal} />

            {/* Verified Badge */}
            {deal.businessTier === 'paid' && (
              <Card
                variant="glass"
                padding="md"
                className="bg-[#f2ebe2] border-[#d4c4b0] shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center">
                    <Star size={20} weight="fill" className="text-amber-800" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#451a03]">
                      Verified Business
                    </p>
                    <p className="text-xs text-[#92400e]">Premium partner</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
