'use client'

import { Lock, MapPin, ShieldCheck, Star } from '@phosphor-icons/react'
import { BlurredImage } from '@/components/patterns/blurredImage'
import { SaveButton } from '@/components/patterns/saveButton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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
      className={`overflow-hidden bg-[#f2ebe2] border-[#d4c4b0] rounded-[10px] hover:border-[#c4b09a] shadow-md ${isGrid ? '' : 'flex'}`}
    >
      {/* Image Section */}
      <div
        className={`
          relative bg-[#faf5ee]
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
          <span className="absolute bottom-3 left-3 z-10 text-xs text-[#92400e] bg-[#faf5ee]/80 px-2 py-1 rounded">
            Sponsored
          </span>
        )}
      </div>

      {/* Content Section */}
      <div className={`p-4 flex flex-col ${isGrid ? '' : 'flex-1'}`}>
        {/* Title */}
        <h3 className="font-semibold text-[#451a03] line-clamp-2">
          {deal.title}
        </h3>

        {/* Description - List variant only */}
        {!isGrid && (
          <p className="mt-1 text-sm text-[#78350f] line-clamp-2">
            {deal.description}
          </p>
        )}

        {/* Pricing */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-amber-800">
            ${deal.dealPrice}
          </span>
          <span className="text-sm text-[#92400e] line-through">
            ${deal.originalPrice}
          </span>
        </div>

        {/* Unit Info */}
        <p className="mt-1 text-xs text-[#92400e]">{deal.unit}</p>

        {/* Location & Rating */}
        <div className="mt-3 flex items-center gap-4 text-sm text-[#78350f]">
          <span className="flex items-center gap-1">
            <MapPin size={16} weight="light" className="text-[#92400e]" />
            {deal.locationArea}
          </span>
          <span className="flex items-center gap-1">
            <Star size={16} weight="fill" className="text-amber-800" />
            {deal.businessRating.toFixed(1)}
            <span className="text-[#92400e]">({deal.businessReviewCount})</span>
          </span>
        </div>

        {/* Business Hidden Section */}
        <div className="mt-3 pt-3 border-t border-[#d4c4b0] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#92400e]">
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
