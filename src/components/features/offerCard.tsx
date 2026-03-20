import { MapPin, Star, Syringe } from '@phosphor-icons/react/dist/ssr'
import { getCategoryLabel } from '@/lib/data/categories'
import type { OfferWithBusiness } from '@/types/supabase'

interface OfferCardProps {
  offer: OfferWithBusiness
}

export function OfferCard({ offer }: OfferCardProps) {
  const business = offer.master_business_info
  const hasSavings =
    offer.original_price != null &&
    offer.discount_price != null &&
    offer.original_price > offer.discount_price
  const savingsPercent = hasSavings
    ? Math.round(
        ((offer.original_price! - offer.discount_price!) /
          offer.original_price!) *
          100,
      )
    : null

  return (
    <div className="group bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] hover:border-[#c4b09a] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-200 cursor-pointer overflow-hidden">
      {/* Top section: category + savings */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="inline-flex items-center gap-1.5 bg-amber-800/10 text-amber-800 rounded-full px-3 py-1 text-xs font-medium">
          <Syringe size={12} weight="bold" />
          {getCategoryLabel(offer.service_category)}
        </span>
        {savingsPercent && savingsPercent > 0 && (
          <span className="bg-emerald-600/10 text-emerald-600 rounded-full px-3 py-1 text-xs font-semibold">
            Save {savingsPercent}%
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="px-5 pb-5">
        <h3 className="text-[#451a03] font-semibold text-lg mb-1 group-hover:text-amber-800 transition-colors">
          {offer.service_name || 'Treatment'}
        </h3>

        {business && (
          <div className="flex items-center gap-3 text-sm text-[#78350f] mb-4">
            <span className="truncate">{business.name}</span>
            {business.score && (
              <span className="flex items-center gap-1 shrink-0">
                <Star size={14} weight="fill" className="text-amber-800" />
                {business.score}
              </span>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-baseline gap-3 mb-4">
          {offer.discount_price != null && (
            <span className="text-amber-800 font-bold text-2xl font-mono">
              ${offer.discount_price.toLocaleString()}
            </span>
          )}
          {hasSavings && (
            <span className="text-[#92400e] line-through text-base font-mono">
              ${offer.original_price?.toLocaleString()}
            </span>
          )}
          {offer.unit_type && offer.unit_type !== 'package' && (
            <span className="text-[#92400e] text-sm">/{offer.unit_type}</span>
          )}
        </div>

        {/* Location + template type */}
        <div className="flex items-center justify-between text-xs text-[#92400e]">
          {business?.city && (
            <span className="flex items-center gap-1">
              <MapPin size={12} weight="bold" />
              {business.city}
            </span>
          )}
          {offer.template_type && (
            <span className="capitalize">
              {offer.template_type.toLowerCase().replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
