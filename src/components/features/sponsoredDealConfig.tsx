'use client'

import { useState } from 'react'
import {
  Rocket,
  TrendUp,
  Eye,
  Star,
  Info,
  CheckCircle,
  Tag,
} from '@phosphor-icons/react'
import type { Deal } from '@/types/deal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getBoostOptions,
  calculateEstimatedReach,
  type BoostOption,
} from '@/lib/mock-data/sponsorship'

interface SponsoredDealConfigProps {
  deal: Deal
  onBoostSelect: (boostOptionId: string) => void
  onCancel?: () => void
}

export function SponsoredDealConfig({
  deal,
  onBoostSelect,
  onCancel,
}: SponsoredDealConfigProps) {
  const [selectedBoostId, setSelectedBoostId] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const boostOptions = getBoostOptions()
  const selectedBoost = boostOptions.find((opt) => opt.id === selectedBoostId)

  const estimatedReach = selectedBoost
    ? calculateEstimatedReach(
        deal.viewCount,
        selectedBoost.impressionMultiplier,
        selectedBoost.duration
      )
    : 0

  const handleStartBoost = () => {
    if (selectedBoostId) {
      onBoostSelect(selectedBoostId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Deal Preview Card */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          Deal Preview
        </h3>
        <Card variant="glass" padding="md" className="relative">
          <div className="flex items-start gap-4">
            {/* Deal Icon */}
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <Tag size={24} weight="fill" className="text-brand-primary" />
            </div>

            {/* Deal Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-text-primary truncate">
                  {deal.title}
                </h4>
                <Badge variant="brand" size="sm" className="flex-shrink-0">
                  Sponsored
                </Badge>
              </div>
              <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                {deal.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-brand-primary font-medium">
                  ${deal.dealPrice} {deal.unit}
                </span>
                <span className="flex items-center gap-1 text-text-tertiary">
                  <Eye size={14} weight="fill" />
                  {deal.viewCount.toLocaleString()} views
                </span>
              </div>
            </div>
          </div>

          {/* Sponsored indicator preview */}
          <div className="absolute -top-2 -right-2">
            <div className="bg-brand-primary text-white text-xs px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
              <Rocket size={12} weight="fill" />
              Boosted
            </div>
          </div>
        </Card>
      </div>

      {/* Boost Options */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-secondary">
            Select Boost Package
          </h3>
          <div className="relative">
            <button
              type="button"
              className="text-text-tertiary hover:text-text-secondary transition-colors"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label="Learn about sponsored placements"
            >
              <Info size={18} weight="light" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-bg-secondary border border-glass-border rounded-xl shadow-elevated text-xs text-text-secondary z-10">
                <p className="font-medium text-text-primary mb-1">
                  Sponsored Placements
                </p>
                <p>
                  Boost your deal to appear higher in search results and
                  category listings. Sponsored deals get more visibility and
                  attract more customers.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {boostOptions.map((option) => (
            <BoostOptionCard
              key={option.id}
              option={option}
              isSelected={selectedBoostId === option.id}
              onSelect={() => setSelectedBoostId(option.id)}
              currentViews={deal.viewCount}
            />
          ))}
        </div>
      </div>

      {/* Estimated Reach Calculator */}
      {selectedBoost && (
        <Card variant="glass" padding="md" className="bg-brand-primary/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
              <TrendUp size={20} weight="fill" className="text-brand-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                Estimated Reach
              </p>
              <p className="text-xs text-text-tertiary">
                Based on your current performance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {estimatedReach.toLocaleString()}
              </p>
              <p className="text-xs text-text-tertiary">Est. Impressions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">
                {selectedBoost.impressionMultiplier}x
              </p>
              <p className="text-xs text-text-tertiary">Visibility Boost</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {selectedBoost.duration}
              </p>
              <p className="text-xs text-text-tertiary">Days Active</p>
            </div>
          </div>
        </Card>
      )}

      {/* Budget Summary */}
      {selectedBoost && (
        <Card variant="outline" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Cost</p>
              <p className="text-2xl font-bold text-text-primary">
                ${selectedBoost.price}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">Package</p>
              <p className="font-medium text-text-primary">
                {selectedBoost.name}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!selectedBoostId}
          onClick={handleStartBoost}
        >
          <Rocket size={18} weight="fill" />
          Start Boost
        </Button>
      </div>
    </div>
  )
}

// Boost Option Card Component
interface BoostOptionCardProps {
  option: BoostOption
  isSelected: boolean
  onSelect: () => void
  currentViews: number
}

function BoostOptionCard({
  option,
  isSelected,
  onSelect,
  currentViews,
}: BoostOptionCardProps) {
  const estimatedReach = calculateEstimatedReach(
    currentViews,
    option.impressionMultiplier,
    option.duration
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left p-4 rounded-xl border transition-all
        ${
          isSelected
            ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
            : 'border-glass-border bg-glass-bg hover:border-glass-border-hover'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-text-primary">{option.name}</h4>
            {option.hasFeaturedBadge && (
              <Badge variant="brand" size="sm">
                <Star size={10} weight="fill" className="mr-1" />
                Featured
              </Badge>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {option.description}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <TrendUp size={12} weight="fill" className="text-green-400" />
              {option.impressionMultiplier}x impressions
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} weight="fill" />~{estimatedReach.toLocaleString()}{' '}
              reach
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-xl font-bold text-text-primary">${option.price}</p>
          <p className="text-xs text-text-tertiary">{option.duration} days</p>
          {isSelected && (
            <CheckCircle
              size={20}
              weight="fill"
              className="text-brand-primary"
            />
          )}
        </div>
      </div>
    </button>
  )
}
