'use client'

import { Lock, MapPin, ShieldCheck, Star } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BlurredImage } from '@/components/patterns/blurredImage'
import { SaveButton } from '@/components/patterns/saveButton'
import type { AnonymousDeal, TreatmentCategory } from '@/types/deal'

interface DealCardProps {
  deal: AnonymousDeal
  onClick?: () => void
  variant?: 'grid' | 'list'
}

const categoryLabels: Record<TreatmentCategory, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

export function DealCard({ deal, onClick, variant = 'grid' }: DealCardProps) {
  const isGrid = variant === 'grid'

  return (
    <Card
      variant="glass"
      padding="none"
      hover
      onClick={onClick}
      className={`overflow-hidden bg-stone-900 border-stone-800 rounded-[10px] hover:border-stone-700 shadow-md ${isGrid ? '' : 'flex'}`}
    >
      {/* Image Section */}
      <div
        className={`
          relative bg-stone-800
          ${isGrid ? 'aspect-[4/3]' : 'w-48 shrink-0 aspect-square'}
        `}
      >
        {/* Blurred Image with Lock Overlay */}
        <BlurredImage
          src={deal.imageUrl}
          alt={deal.title}
          sizes={isGrid ? '(max-width: 768px) 100vw, 33vw' : '192px'}
        />

        {/* Category Badge - Top Left (above blur) */}
        <Badge
          variant="default"
          size="sm"
          className="absolute top-3 left-3 z-10"
        >
          {categoryLabels[deal.category]}
        </Badge>

        {/* Save Button & Discount Badge - Top Right (above blur) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <SaveButton dealId={deal.id} size="sm" />
          <Badge variant="brand" size="sm">
            {deal.discountPercent}% OFF
          </Badge>
        </div>

        {/* Sponsored Indicator - Bottom Left (above blur) */}
        {deal.isSponsored && (
          <span className="absolute bottom-3 left-3 z-10 text-xs text-stone-500 bg-stone-800/80 px-2 py-1 rounded">
            Sponsored
          </span>
        )}
      </div>

      {/* Content Section */}
      <div className={`p-4 flex flex-col ${isGrid ? '' : 'flex-1'}`}>
        {/* Title */}
        <h3 className="font-semibold text-stone-100 line-clamp-2">
          {deal.title}
        </h3>

        {/* Description - List variant only */}
        {!isGrid && (
          <p className="mt-1 text-sm text-stone-400 line-clamp-2">
            {deal.description}
          </p>
        )}

        {/* Pricing */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-amber-400">
            ${deal.dealPrice}
          </span>
          <span className="text-sm text-stone-500 line-through">
            ${deal.originalPrice}
          </span>
        </div>

        {/* Unit Info */}
        <p className="mt-1 text-xs text-stone-500">{deal.unit}</p>

        {/* Location & Rating */}
        <div className="mt-3 flex items-center gap-4 text-sm text-stone-400">
          <span className="flex items-center gap-1">
            <MapPin size={16} weight="light" className="text-stone-500" />
            {deal.locationArea}
          </span>
          <span className="flex items-center gap-1">
            <Star size={16} weight="fill" className="text-amber-400" />
            {deal.businessRating.toFixed(1)}
            <span className="text-stone-500">
              ({deal.businessReviewCount})
            </span>
          </span>
        </div>

        {/* Business Hidden Section */}
        <div className="mt-3 pt-3 border-t border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-500">
            <Lock size={16} weight="light" />
            <span className="text-sm">Business details hidden</span>
          </div>

          {/* Verified Badge for Paid Tier */}
          {deal.businessTier === 'paid' && (
            <Badge
              variant="brand"
              size="sm"
              className="flex items-center gap-1"
            >
              <ShieldCheck size={12} weight="fill" />
              Verified
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
