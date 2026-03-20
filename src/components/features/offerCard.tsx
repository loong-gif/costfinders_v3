import { Star, Syringe, MapPin } from '@phosphor-icons/react/dist/ssr'
import type { OfferWithBusiness } from '@/types/supabase'
import { getCategoryLabel } from '@/lib/data/categories'

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
    <div className="group bg-stone-900 border border-stone-800 rounded-[10px] hover:border-stone-700 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-200 cursor-pointer overflow-hidden">
      {/* Top section: category + savings */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="inline-flex items-center gap-1.5 bg-amber-400/15 text-amber-400 rounded-full px-3 py-1 text-xs font-medium">
          <Syringe size={12} weight="bold" />
          {getCategoryLabel(offer.service_category)}
        </span>
        {savingsPercent && savingsPercent > 0 && (
          <span className="bg-emerald-400/15 text-emerald-400 rounded-full px-3 py-1 text-xs font-semibold">
            Save {savingsPercent}%
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="px-5 pb-5">
        <h3 className="text-stone-100 font-semibold text-lg mb-1 group-hover:text-amber-400 transition-colors">
          {offer.service_name || 'Treatment'}
        </h3>

        {business && (
          <div className="flex items-center gap-3 text-sm text-stone-400 mb-4">
            <span className="truncate">{business.name}</span>
            {business.score && (
              <span className="flex items-center gap-1 shrink-0">
                <Star size={14} weight="fill" className="text-amber-400" />
                {business.score}
              </span>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-baseline gap-3 mb-4">
          {offer.discount_price != null && (
            <span className="text-amber-400 font-bold text-2xl font-mono">
              ${offer.discount_price.toLocaleString()}
            </span>
          )}
          {hasSavings && (
            <span className="text-stone-500 line-through text-base font-mono">
              ${offer.original_price!.toLocaleString()}
            </span>
          )}
          {offer.unit_type && offer.unit_type !== 'package' && (
            <span className="text-stone-500 text-sm">
              /{offer.unit_type}
            </span>
          )}
        </div>

        {/* Location + template type */}
        <div className="flex items-center justify-between text-xs text-stone-500">
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
