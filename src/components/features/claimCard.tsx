'use client'

import {
  Calendar,
  ChatCircle,
  CheckCircle,
  Clock,
  MapPin,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { ClaimStatusBadge } from '@/components/patterns/claimStatusBadge'
import { Card } from '@/components/ui/card'
import { getAnonymousDealById, getBusinessById } from '@/lib/mock-data'
import type { Claim } from '@/types/claim'

interface ClaimCardProps {
  claim: Claim
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const deal = getAnonymousDealById(claim.dealId)
  const business = getBusinessById(claim.businessId)

  // Handle edge case: deal was deleted
  if (!deal) {
    return (
      <Card variant="glass" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#78350f] text-sm">Deal no longer available</p>
            <p className="text-[#92400e] text-xs mt-1">
              Claimed {formatRelativeTime(claim.createdAt)}
            </p>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>
      </Card>
    )
  }

  return (
    <Card
      variant="glass"
      padding="lg"
      className="hover:border-[#c4b09a] transition-colors"
    >
      <div className="space-y-4">
        {/* Header: Deal title + Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/deals/${deal.id}`}
              className="text-lg font-semibold text-[#451a03] hover:text-amber-800 transition-colors line-clamp-2"
            >
              {deal.title}
            </Link>
            {business && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin
                  size={14}
                  weight="fill"
                  className="text-[#92400e] shrink-0"
                />
                <span className="text-sm text-[#78350f]">{business.name}</span>
              </div>
            )}
          </div>
          <ClaimStatusBadge status={claim.status} size="md" />
        </div>

        {/* Preferred Date/Time */}
        {(claim.preferredDate || claim.preferredTime) && (
          <div className="flex items-center gap-4 text-sm">
            {claim.preferredDate && (
              <div className="flex items-center gap-1.5 text-[#78350f]">
                <Calendar
                  size={16}
                  weight="regular"
                  className="text-[#92400e]"
                />
                <span>Requested: {formatDate(claim.preferredDate)}</span>
              </div>
            )}
            {claim.preferredTime && (
              <div className="flex items-center gap-1.5 text-[#78350f]">
                <Clock size={16} weight="regular" className="text-[#92400e]" />
                <span>{claim.preferredTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Booked Date/Time (if booked or completed) */}
        {claim.bookedDate &&
          (claim.status === 'booked' || claim.status === 'completed') && (
            <div className="flex items-center gap-2 p-3 bg-emerald-600/10 rounded-xl">
              <CheckCircle
                size={18}
                weight="fill"
                className="text-emerald-600 shrink-0"
              />
              <div className="text-sm">
                <span className="text-emerald-600 font-medium">
                  {claim.status === 'completed' ? 'Completed' : 'Booked'}:{' '}
                  {formatDate(claim.bookedDate)}
                </span>
                {claim.bookedTime && (
                  <span className="text-emerald-600/80">
                    {' '}
                    at {claim.bookedTime}
                  </span>
                )}
              </div>
            </div>
          )}

        {/* Business Response */}
        {claim.businessResponse && (
          <div className="p-3 bg-[#faf5ee] rounded-xl">
            <div className="flex items-start gap-2">
              <ChatCircle
                size={16}
                weight="fill"
                className="text-[#92400e] mt-0.5 shrink-0"
              />
              <div>
                <p className="text-xs text-[#92400e] mb-1">Business Response</p>
                <p className="text-sm text-[#78350f]">
                  {claim.businessResponse}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer: Created date */}
        <div className="pt-2 border-t border-[#d4c4b0]">
          <p className="text-xs text-[#92400e]">
            Claimed {formatRelativeTime(claim.createdAt)}
          </p>
        </div>
      </div>
    </Card>
  )
}
