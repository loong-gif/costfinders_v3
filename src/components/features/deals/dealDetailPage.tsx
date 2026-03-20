import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Info,
  MapPin,
  Star,
} from '@phosphor-icons/react/dist/ssr'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BlurredImage } from '@/components/patterns/blurredImage'
import { PricingBreakdown } from '@/components/features/pricingBreakdown'
import { DealSidebar } from '@/components/features/dealSidebar'
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
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft size={16} weight="bold" />
          Back to deals
        </Link>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <div className="relative aspect-video bg-bg-tertiary rounded-2xl overflow-hidden">
              {/* Blurred Image with Lock Overlay */}
              <BlurredImage
                src={deal.imageUrl}
                alt={deal.title}
                sizes="(max-width: 1024px) 100vw, 66vw"
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
                  <span className="text-xs text-text-muted bg-bg-primary/80 backdrop-blur-sm px-2 py-1 rounded">
                    Sponsored
                  </span>
                </div>
              )}
            </div>

            {/* Title & Meta */}
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
                {deal.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} weight="fill" className="text-text-muted" />
                  <span>{deal.locationArea}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={16} weight="fill" className="text-amber-400" />
                  <span>
                    {deal.businessRating.toFixed(1)} ({deal.businessReviewCount}{' '}
                    reviews)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} weight="regular" className="text-text-muted" />
                  <span>{deal.claimCount} claimed</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <Card variant="glass" padding="lg">
              <h2 className="text-lg font-semibold text-text-primary mb-3">
                About This Deal
              </h2>
              <p className="text-text-secondary whitespace-pre-line">
                {deal.description}
              </p>
            </Card>

            {/* Terms */}
            <Card variant="glass" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <Info size={20} weight="regular" className="text-text-muted" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Terms & Conditions
                </h2>
              </div>
              <p className="text-sm text-text-secondary whitespace-pre-line">
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
              <Card variant="glass" padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                    <Star size={20} weight="fill" className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Verified Business
                    </p>
                    <p className="text-xs text-text-muted">Premium partner</p>
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
