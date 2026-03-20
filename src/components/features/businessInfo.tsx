'use client'

import { useState } from 'react'
import {
  MapPin,
  Phone,
  Globe,
  Star,
  CheckCircle,
  Clock,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClaimDealModal } from '@/components/features/claimDealModal'
import { useClaims } from '@/lib/context/claimsContext'
import type { Business } from '@/types/business'
import type { Deal } from '@/types/deal'

interface BusinessInfoProps {
  business: Business
  deal: Deal
}

export function BusinessInfo({ business, deal }: BusinessInfoProps) {
  const { getClaimByDealId } = useClaims()
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)

  const existingClaim = getClaimByDealId(deal.id)

  const handleClaimClick = () => {
    setIsClaimModalOpen(true)
  }

  const handleClaimClose = () => {
    setIsClaimModalOpen(false)
  }

  return (
    <>
      <Card variant="glass" padding="lg">
        <div className="space-y-4">
        {/* Business Name & Verified Badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold text-stone-100">
            {business.name}
          </h3>
          {business.tier === 'paid' && (
            <div className="flex items-center gap-1 text-amber-400 shrink-0">
              <CheckCircle size={18} weight="fill" />
              <span className="text-xs font-medium">Verified</span>
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <Star size={16} weight="fill" className="text-amber-400" />
          <span className="text-sm text-stone-400">
            {business.rating.toFixed(1)} ({business.reviewCount} reviews)
          </span>
        </div>

        {/* Contact Info */}
        <div className="space-y-3 pt-2 border-t border-stone-800">
          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPin size={18} className="text-stone-500 mt-0.5 shrink-0" />
            <span className="text-sm text-stone-400">
              {business.address}
              <br />
              {business.city}, {business.state} {business.zipCode}
            </span>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-stone-500 shrink-0" />
            <a
              href={`tel:${business.phone.replace(/\D/g, '')}`}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              {business.phone}
            </a>
          </div>

          {/* Website */}
          {business.website && (
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-stone-500 shrink-0" />
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors truncate"
              >
                {business.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {/* Claim Button or Already Claimed State */}
        {existingClaim ? (
          <div className="mt-2 space-y-3">
            <div className="p-3 bg-emerald-400/10 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} weight="fill" className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Deal Claimed
                </span>
              </div>
            </div>
            <div className="p-3 bg-stone-800 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} weight="regular" className="text-stone-500" />
                <span className="text-stone-400">
                  Status:{' '}
                  <span className="text-stone-100 capitalize">
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
        ) : (
          <Button
            size="lg"
            className="w-full mt-2"
            onClick={handleClaimClick}
            type="button"
          >
            Claim This Deal
          </Button>
        )}
        </div>
      </Card>

      <ClaimDealModal
        isOpen={isClaimModalOpen}
        onClose={handleClaimClose}
        dealId={deal.id}
        businessId={business.id}
        dealTitle={deal.title}
      />
    </>
  )
}
