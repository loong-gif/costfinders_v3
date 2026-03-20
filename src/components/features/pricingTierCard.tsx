'use client'

import { Check, Star } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TierType = 'free' | 'paid'

interface PricingTierCardProps {
  tier: TierType
  isCurrentTier?: boolean
  onSelect?: () => void
  highlighted?: boolean
}

const tierDetails: Record<TierType, {
  name: string
  price: string
  period: string
  description: string
  features: string[]
}> = {
  free: {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started with essential features',
    features: [
      'Basic listing visibility',
      'Lead notifications via email',
      'Business profile editing',
      'Customer messaging',
      'Deal creation (up to 3 active)',
    ],
  },
  paid: {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'Maximize your reach and conversions',
    features: [
      'Featured placements in search',
      'Priority lead routing',
      'Analytics dashboard',
      'Newsletter inclusion',
      'Sponsored deal slots (unlimited)',
      'Premium badge on profile',
      'Priority customer support',
    ],
  },
}

export function PricingTierCard({
  tier,
  isCurrentTier = false,
  onSelect,
  highlighted = false,
}: PricingTierCardProps) {
  const details = tierDetails[tier]

  return (
    <Card
      variant="glass"
      padding="none"
      className={`
        relative overflow-hidden transition-all duration-300
        ${highlighted ? 'ring-2 ring-amber-400 shadow-lg' : ''}
        ${isCurrentTier ? 'opacity-90' : ''}
      `}
    >
      {/* Highlighted/Recommended Badge */}
      {highlighted && !isCurrentTier && (
        <div className="absolute top-0 right-0">
          <div className="bg-amber-400 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg flex items-center gap-1">
            <Star size={12} weight="fill" />
            Recommended
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-stone-100">{details.name}</h3>
            {isCurrentTier && (
              <Badge variant="success" size="sm">
                Current Plan
              </Badge>
            )}
          </div>
          <p className="text-sm text-stone-400">{details.description}</p>
        </div>

        {/* Price */}
        <div className="mb-6">
          <span className="text-4xl font-bold text-stone-100">{details.price}</span>
          <span className="text-stone-400">{details.period}</span>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          {details.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check
                size={18}
                weight="bold"
                className={`flex-shrink-0 mt-0.5 ${highlighted ? 'text-amber-400' : 'text-emerald-400'}`}
              />
              <span className="text-sm text-stone-400">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isCurrentTier}
          className={`
            w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200
            ${
              isCurrentTier
                ? 'bg-stone-900 border border-stone-800 text-stone-500 cursor-not-allowed'
                : highlighted
                  ? 'bg-amber-400 hover:bg-amber-500 text-white shadow-lg hover:shadow-xl'
                  : 'bg-stone-800 border border-stone-800 text-stone-100 hover:border-amber-400'
            }
          `}
        >
          {isCurrentTier ? 'Current Plan' : tier === 'paid' ? 'Upgrade Now' : 'Select Plan'}
        </button>
      </div>
    </Card>
  )
}
