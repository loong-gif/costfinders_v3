'use client'

import {
  Lock,
  MapPin,
  ShieldCheck,
  Sparkle,
  Star,
  Syringe,
} from '@phosphor-icons/react'
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

const categoryIcons: Record<TreatmentCategory, typeof Syringe> = {
  botox: Syringe,
  fillers: Syringe,
  facials: Sparkle,
  laser: Sparkle,
  body: Sparkle,
  skincare: Sparkle,
}

function getEffectiveDiscount(deal: AnonymousDeal): number {
  if (deal.discountPercent > 0) return deal.discountPercent
  if (
    deal.originalPrice > 0 &&
    deal.dealPrice > 0 &&
    deal.originalPrice > deal.dealPrice
  ) {
    return Math.round((1 - deal.dealPrice / deal.originalPrice) * 100)
  }
  return 0
}

export function DealCard({ deal, onClick, variant = 'grid' }: DealCardProps) {
  const isGrid = variant === 'grid'
  const hasImage = Boolean(deal.imageUrl)
  const hasDealPrice = deal.dealPrice > 0
  const hasOriginalPrice = deal.originalPrice > 0
  const effectiveDiscount = getEffectiveDiscount(deal)
  const CategoryIcon = categoryIcons[deal.category]

  return (
    <Card
      variant="glass"
      padding="none"
      hover
      onClick={onClick}
      className={`group relative overflow-hidden bg-[#f2ebe2] border-[#d4c4b0] rounded-[10px] hover:border-[#c4b09a] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(69,26,3,0.12)] transition-all duration-300 ${isGrid ? '' : 'flex'}`}
    >
      {/* Left accent bar — slides in on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-800 origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300 z-10 rounded-l-[10px]" />

      {/* Image Section — compact when no image */}
      <div
        className={`
          relative bg-[#faf5ee]
          ${
            isGrid
              ? hasImage
                ? 'aspect-[4/3]'
                : 'aspect-[3/1]'
              : hasImage
                ? 'w-48 shrink-0 aspect-square'
                : 'w-32 shrink-0'
          }
        `}
      >
        {hasImage ? (
          <BlurredImage
            src={deal.imageUrl}
            alt={deal.title}
            sizes={isGrid ? '(max-width: 768px) 100vw, 33vw' : '192px'}
          />
        ) : (
          /* Compact placeholder with category context */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#faf5ee] to-[#f0e4d4]">
            <div className="w-10 h-10 rounded-full bg-[#f2ebe2] border border-[#d4c4b0] flex items-center justify-center">
              <CategoryIcon
                size={20}
                weight="light"
                className="text-[#78350f]"
              />
            </div>
            <span className="text-[10px] text-[#92400e] font-medium">
              {categoryLabels[deal.category]}
            </span>
            <Lock size={12} weight="light" className="text-[#c4b09a]" />
          </div>
        )}

        {/* Category Badge - Top Left (above blur) */}
        <Badge
          variant="default"
          size="sm"
          className="absolute top-3 left-3 z-10"
        >
          {categoryLabels[deal.category]}
        </Badge>

        {/* Save Button & Discount/Template Badge - Top Right (above blur) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <SaveButton dealId={deal.id} size="sm" />
          {effectiveDiscount > 0 ? (
            <Badge variant="brand" size="sm">
              Save {effectiveDiscount}%
            </Badge>
          ) : deal.templateType === 'BUNDLE' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              Bundle
            </span>
          ) : deal.templateType === 'MEMBERSHIP' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              Members
            </span>
          ) : deal.templateType === 'DISCOUNT' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
              Deal
            </span>
          ) : null}
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
          {hasDealPrice ? (
            deal.unit === 'unit' && deal.dealPrice < 50 ? (
              <span className="text-xl font-bold font-mono text-amber-800 group-hover:text-amber-700 transition-colors duration-300">
                ${deal.dealPrice}
                <span className="text-base font-semibold">/unit</span>
              </span>
            ) : (
              <span className="text-xl font-bold font-mono text-amber-800 group-hover:text-amber-700 transition-colors duration-300">
                ${deal.dealPrice}
              </span>
            )
          ) : (
            <span className="text-base font-semibold text-amber-800">
              Contact for pricing
            </span>
          )}
          {hasOriginalPrice &&
            hasDealPrice &&
            deal.originalPrice > deal.dealPrice && (
              <span className="text-sm text-[#92400e] line-through">
                ${deal.originalPrice}
              </span>
            )}
        </div>

        {/* Unit Info — hidden when already shown inline */}
        {!(deal.unit === 'unit' && deal.dealPrice < 50) && (
          <p className="mt-1 text-xs text-[#92400e]">{deal.unit}</p>
        )}

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
