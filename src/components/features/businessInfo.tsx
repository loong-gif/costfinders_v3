'use client'

import {
  CheckCircle,
  Clock,
  Globe,
  MapPin,
  Star,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { RevealedBusiness } from '@/lib/actions/claims'
import { useClaims } from '@/lib/context/claimsContext'
import type { Deal } from '@/types/deal'

interface BusinessInfoProps {
  business: RevealedBusiness
  deal: Deal
}

export function BusinessInfo({ business, deal }: BusinessInfoProps) {
  const { getClaimByDealId } = useClaims()

  const existingClaim = getClaimByDealId(deal.id)

  // Build display values from Supabase shape
  const rating = business.score
  const reviewCount = business.review_count ?? 0
  const websiteUrl = business.website ?? business.website_clean
  const websiteDisplay = business.website_clean ?? business.website

  return (
    <Card variant="glass" padding="lg">
      <div className="space-y-4">
        {/* Business Name */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold text-[#451a03]">
            {business.name}
          </h3>
        </div>

        {/* Rating */}
        {rating != null && (
          <div className="flex items-center gap-1.5">
            <Star size={16} weight="fill" className="text-amber-800" />
            <span className="text-sm text-[#78350f]">
              {rating.toFixed(1)} ({reviewCount} reviews)
            </span>
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-3 pt-2 border-t border-[#d4c4b0]">
          {/* Address */}
          {business.address && (
            <div className="flex items-start gap-2">
              <MapPin
                size={18}
                className="text-[#92400e] mt-0.5 shrink-0"
              />
              <span className="text-sm text-[#78350f]">
                {business.address}
                {business.city && (
                  <>
                    <br />
                    {business.city}
                  </>
                )}
              </span>
            </div>
          )}

          {/* Website */}
          {websiteUrl ? (
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-[#92400e] shrink-0" />
              <a
                href={
                  websiteUrl.startsWith('http')
                    ? websiteUrl
                    : `https://${websiteUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors truncate"
              >
                {websiteDisplay
                  ? websiteDisplay.replace(/^https?:\/\//, '')
                  : websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
          ) : (
            <p className="text-sm text-[#92400e] italic">
              Contact via deal details
            </p>
          )}
        </div>

        {/* Claim Status */}
        {existingClaim && (
          <div className="mt-2 space-y-3">
            <div className="p-3 bg-emerald-600/10 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="text-emerald-600"
                />
                <span className="text-sm font-medium text-emerald-600">
                  Deal Claimed
                </span>
              </div>
            </div>
            <div className="p-3 bg-[#faf5ee] rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <Clock
                  size={16}
                  weight="regular"
                  className="text-[#92400e]"
                />
                <span className="text-[#78350f]">
                  Status:{' '}
                  <span className="text-[#451a03] capitalize">
                    {existingClaim.status}
                  </span>
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => (window.location.href = '/dashboard/claims')}
            >
              View My Claims
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
