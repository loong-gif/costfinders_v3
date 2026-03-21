'use client'

import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  ChatCircle,
  CheckCircle,
  Clock,
  Envelope,
  Phone,
  PhoneCall,
  SpinnerGap,
  Tag,
  User,
  XCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { MessageThread } from '@/components/features/messaging/messageThread'
import { ClaimStatusBadge } from '@/components/patterns/claimStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  addBusinessResponseAction,
  updateClaimStatusForBusinessAction,
} from '@/lib/actions/business-claims'
import type { ClaimRow } from '@/lib/actions/claims'
import { getOfferById } from '@/lib/data/offers'
import type { ClaimStatus } from '@/types/claim'
import type { OfferWithBusiness } from '@/types/supabase'

interface LeadDetailProps {
  claim: ClaimRow
  businessId: string
  onClaimUpdate?: (claim: ClaimRow) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(dateString)
}

function getCustomerDisplay(consumerId: string): string {
  return `Customer #${consumerId.slice(-4).toUpperCase()}`
}

export function LeadDetail({
  claim: initialClaim,
  businessId,
  onClaimUpdate,
}: LeadDetailProps) {
  const [claim, setClaim] = useState(initialClaim)
  const [businessNotes, setBusinessNotes] = useState(
    claim.business_response || '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [deal, setDeal] = useState<OfferWithBusiness | null>(null)
  const [isDealLoading, setIsDealLoading] = useState(true)

  // Load deal info
  const loadDeal = useCallback(async () => {
    setIsDealLoading(true)
    try {
      const offer = await getOfferById(claim.deal_id)
      setDeal(offer)
    } catch {
      // Deal info is non-critical, just leave null
    }
    setIsDealLoading(false)
  }, [claim.deal_id])

  useEffect(() => {
    loadDeal()
  }, [loadDeal])

  const handleStatusChange = async (newStatus: ClaimStatus) => {
    const result = await updateClaimStatusForBusinessAction(
      claim.id,
      Number(businessId),
      newStatus,
    )
    if (result.success && result.claim) {
      setClaim(result.claim)
      onClaimUpdate?.(result.claim)
    }
  }

  const handleSaveNotes = async () => {
    if (!businessNotes.trim()) return
    setIsSaving(true)

    const result = await addBusinessResponseAction(
      claim.id,
      Number(businessId),
      businessNotes,
    )
    if (result.success && result.claim) {
      setClaim(result.claim)
      onClaimUpdate?.(result.claim)
    }
    setIsSaving(false)
  }

  const canShowContactInfo = claim.status !== 'pending'

  // Derive deal display values
  const dealTitle =
    deal?.service_name ?? deal?.source_name ?? `Deal #${claim.deal_id}`
  const dealCategory = deal?.service_category ?? null
  const dealPrice = deal?.discount_price ?? null
  const dealUnit = deal?.unit_type ?? null

  // Status transition buttons
  const statusActions: {
    status: ClaimStatus
    label: string
    icon: React.ReactNode
    variant: 'primary' | 'secondary' | 'danger'
  }[] = []

  switch (claim.status) {
    case 'pending':
      statusActions.push({
        status: 'contacted',
        label: 'Mark Contacted',
        icon: <PhoneCall size={18} weight="fill" />,
        variant: 'primary',
      })
      statusActions.push({
        status: 'cancelled',
        label: 'Cancel',
        icon: <XCircle size={18} weight="fill" />,
        variant: 'danger',
      })
      break
    case 'contacted':
      statusActions.push({
        status: 'booked',
        label: 'Mark Booked',
        icon: <CalendarCheck size={18} weight="fill" />,
        variant: 'primary',
      })
      statusActions.push({
        status: 'cancelled',
        label: 'Cancel',
        icon: <XCircle size={18} weight="fill" />,
        variant: 'danger',
      })
      break
    case 'booked':
      statusActions.push({
        status: 'completed',
        label: 'Mark Completed',
        icon: <CheckCircle size={18} weight="fill" />,
        variant: 'primary',
      })
      statusActions.push({
        status: 'cancelled',
        label: 'Cancel',
        icon: <XCircle size={18} weight="fill" />,
        variant: 'danger',
      })
      break
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/business/dashboard/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={20} weight="light" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#451a03]">Lead Details</h1>
          <p className="text-[#78350f] mt-1">
            {getCustomerDisplay(claim.consumer_id)}
          </p>
        </div>
        <ClaimStatusBadge status={claim.status as ClaimStatus} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Info Card */}
          <Card variant="glass" padding="lg">
            <div className="space-y-6">
              {/* Header with created date */}
              <div className="flex items-center justify-between pb-4 border-b border-[#d4c4b0]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-800/8 flex items-center justify-center">
                    <User size={24} weight="fill" className="text-amber-800" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#451a03] text-lg">
                      {getCustomerDisplay(claim.consumer_id)}
                    </p>
                    <p className="text-sm text-[#92400e]">
                      Requested {formatRelativeTime(claim.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deal Info */}
              {isDealLoading ? (
                <div className="p-4 bg-[#faf5ee] rounded-xl flex items-center gap-3">
                  <SpinnerGap
                    size={20}
                    weight="light"
                    className="text-[#92400e] animate-spin"
                  />
                  <span className="text-sm text-[#78350f]">
                    Loading deal info...
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-[#faf5ee] rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} weight="fill" className="text-amber-800" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#451a03]">{dealTitle}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {dealCategory && (
                          <Badge variant="default" size="sm">
                            {dealCategory.charAt(0).toUpperCase() +
                              dealCategory.slice(1)}
                          </Badge>
                        )}
                        {dealPrice != null && (
                          <span className="text-amber-800 font-semibold">
                            ${dealPrice}{' '}
                            {dealUnit && (
                              <span className="text-[#92400e] font-normal">
                                {dealUnit}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Request */}
              <div>
                <h3 className="text-sm font-medium text-[#78350f] mb-3">
                  Customer Request
                </h3>
                <div className="space-y-3">
                  {(claim.preferred_date || claim.preferred_time) && (
                    <div className="flex flex-wrap gap-4">
                      {claim.preferred_date && (
                        <div className="flex items-center gap-2 text-[#451a03]">
                          <Calendar
                            size={18}
                            weight="regular"
                            className="text-[#92400e]"
                          />
                          <span>
                            Preferred: {formatDate(claim.preferred_date)}
                          </span>
                        </div>
                      )}
                      {claim.preferred_time && (
                        <div className="flex items-center gap-2 text-[#451a03]">
                          <Clock
                            size={18}
                            weight="regular"
                            className="text-[#92400e]"
                          />
                          <span>{claim.preferred_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {claim.notes && (
                    <div className="p-3 bg-[#f2ebe2] rounded-xl">
                      <p className="text-sm text-[#78350f] italic">
                        "{claim.notes}"
                      </p>
                    </div>
                  )}
                  {!claim.preferred_date &&
                    !claim.preferred_time &&
                    !claim.notes && (
                      <p className="text-[#92400e] text-sm">
                        No specific preferences provided.
                      </p>
                    )}
                </div>
              </div>

              {/* Status Actions */}
              {statusActions.length > 0 && (
                <div className="pt-4 border-t border-[#d4c4b0]">
                  <h3 className="text-sm font-medium text-[#78350f] mb-3">
                    Update Status
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {statusActions.map((action) => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        onClick={() => handleStatusChange(action.status)}
                      >
                        {action.icon}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Business Notes */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-[#78350f] mb-3 flex items-center gap-2">
              <ChatCircle size={18} weight="fill" className="text-[#92400e]" />
              Business Notes
            </h3>
            <div className="space-y-4">
              <textarea
                value={businessNotes}
                onChange={(e) => setBusinessNotes(e.target.value)}
                placeholder="Add internal notes about this lead..."
                className="w-full h-32 px-4 py-3 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] placeholder:text-[#92400e] resize-none focus:outline-none focus:border-amber-800/40 focus:ring-2 focus:ring-amber-800/15 transition-all"
              />
              <div className="flex items-center justify-between">
                {claim.responded_at && (
                  <p className="text-xs text-[#92400e]">
                    Last updated: {formatRelativeTime(claim.responded_at)}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={
                    isSaving ||
                    !businessNotes.trim() ||
                    businessNotes === claim.business_response
                  }
                  className="ml-auto"
                >
                  {isSaving ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Messaging - only show if not pending */}
          {claim.status !== 'pending' && (
            <MessageThread
              claimId={claim.id}
              currentUserId={businessId}
              currentUserType="business"
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info Card */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-[#78350f] mb-4">
              Contact Information
            </h3>
            {canShowContactInfo ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Envelope
                      size={20}
                      weight="fill"
                      className="text-green-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#92400e]">Email</p>
                    <p className="text-[#451a03] text-sm">
                      Available after consumer profile integration
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Phone size={20} weight="fill" className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-[#92400e]">Phone</p>
                    <p className="text-[#451a03] text-sm">
                      Available after consumer profile integration
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-warning-bg mx-auto mb-3 flex items-center justify-center">
                  <User size={24} weight="fill" className="text-warning" />
                </div>
                <p className="text-sm text-[#78350f]">
                  Contact info will be revealed after you mark this lead as
                  contacted.
                </p>
              </div>
            )}
          </Card>

          {/* Timeline Card */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-[#78350f] mb-4">
              Activity
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-800 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[#451a03]">Lead received</p>
                  <p className="text-xs text-[#92400e]">
                    {formatRelativeTime(claim.created_at)}
                  </p>
                </div>
              </div>
              {claim.responded_at && claim.status !== 'pending' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-info mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-[#451a03]">Contacted customer</p>
                    <p className="text-xs text-[#92400e]">
                      {formatRelativeTime(claim.responded_at)}
                    </p>
                  </div>
                </div>
              )}
              {claim.booked_date &&
                (claim.status === 'booked' || claim.status === 'completed') && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-[#451a03]">
                        {claim.status === 'completed'
                          ? 'Appointment completed'
                          : 'Appointment booked'}
                      </p>
                      <p className="text-xs text-[#92400e]">
                        {formatDate(claim.booked_date)}
                      </p>
                    </div>
                  </div>
                )}
              {claim.status === 'cancelled' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-error mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-[#451a03]">Lead cancelled</p>
                    <p className="text-xs text-[#92400e]">
                      {formatRelativeTime(claim.updated_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
