'use client'

import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
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
  type ConsumerContact,
  getConsumerContactForLeadAction,
  updateClaimStatusForBusinessAction,
} from '@/lib/actions/business-claims'
import type { ClaimRow } from '@/lib/actions/claims'
import { getOrCreateConversationAction } from '@/lib/actions/messaging'
import { dealPricing, offerToAnonymousDeal } from '@/lib/data/adapters'
import { getOfferById, isPubliclyVisible } from '@/lib/data/offers'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import type { ClaimStatus } from '@/types/claim'
import type { OfferView } from '@/types/supabase'

/** Snapshot columns written at claim time; absent until that migration is applied. */
type LeadClaim = ClaimRow & {
  deal_title?: string | null
  price_label?: string | null
}

/** A date-only column ('YYYY-MM-DD'). Never through new Date(), which shows it a day early. */
const LONG_DAY: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

interface LeadDetailProps {
  claim: LeadClaim
  businessId: string
  /**
   * The owner's auth uid. Distinct from businessId, which is the bigint primary key of
   * master_business_info — MessageThread stamps this onto optimistic messages and compares it
   * against messages.sender_id, so passing the business id there made the owner's own message
   * render twice and fired a redundant read receipt per message.
   */
  ownerId: string
  onClaimUpdate?: (claim: LeadClaim) => void
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
  ownerId,
  onClaimUpdate,
}: LeadDetailProps) {
  const [claim, setClaim] = useState<LeadClaim>(initialClaim)
  const [deal, setDeal] = useState<OfferView | null>(null)
  const [isDealLoading, setIsDealLoading] = useState(true)
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  )

  // Load conversation for this claim
  const loadConversation = useCallback(async () => {
    try {
      const result = await getOrCreateConversationAction(initialClaim.id)
      if (result.success && result.conversation) {
        setConversationId(result.conversation.id)
      } else {
        console.error('[LeadDetail] no conversation for claim:', result.error)
      }
    } catch (err) {
      console.error('[LeadDetail] conversation lookup threw:', err)
    }
  }, [initialClaim.id])

  useEffect(() => {
    loadConversation()
  }, [loadConversation])

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

  const [contact, setContact] = useState<ConsumerContact | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)

  // Not for a lead that has ended: a customer who cancelled, or whose claim expired, has not
  // asked to be contacted (claim_consumer_contact's own status check is a separate change).
  const leadEnded = claim.status === 'cancelled' || claim.status === 'expired'
  const canShowContactInfo = claim.status !== 'pending' && !leadEnded

  // The consumer's details are not on the claim row: the phone lives on `profiles` (which an
  // owner cannot read) and the email is not in the `public` schema at all. They are fetched
  // through a per-claim accessor that authorises the caller server-side, so this screen can
  // keep its promise instead of rendering the old "Available after consumer profile
  // integration" placeholder. Fetched only once the lead is out of `pending`, matching the
  // reveal rule the copy states.
  useEffect(() => {
    if (!canShowContactInfo) return
    let cancelled = false
    getConsumerContactForLeadAction(claim.id).then((result) => {
      if (cancelled) return
      if (result.success && result.contact) {
        setContact(result.contact)
        setContactError(null)
      } else {
        setContactError(
          result.error ?? 'Could not load the customer’s details.',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [canShowContactInfo, claim.id])

  // Derive deal display values
  // source_name has no successor in the normalized schema; service_name already falls back
  // to offer_raw_text, so the `Deal #n` case is now genuinely "the deal is gone".
  // The deal as it is now; else the title snapshotted when the customer claimed. "Deal #8556"
  // told the owner nothing about a deal the pipeline had since removed.
  const dealTitle = deal?.service_name ?? claim.deal_title ?? null
  const dealListed = deal ? isPubliclyVisible(deal) : false
  const dealCategory = deal?.service_category ?? null
  // The deal's current price, as the site prints it — not what the consumer saw when they
  // claimed: claims store no price, and getOfferById reads the offer as it is now. This printed
  // `$${discount_price}` then
  // `unit_type` — the service's unit vocabulary, not what the price buys — so a 40-unit package
  // read "$299 unit" and a $79 lip flip "$79 unit". 'none' ("Contact for pricing") is dropped:
  // it tells the owner nothing about their own deal.
  const pricing = deal ? dealPricing(offerToAnonymousDeal(deal)) : null
  // What the customer saw when they claimed, when the claim carries it; the live price otherwise.
  const priceText =
    claim.price_label ??
    (pricing && pricing.kind !== 'none'
      ? [pricing.lead, pricing.basis].filter(Boolean).join(' ')
      : null)

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
        {/* Both the <a> and the <button> it wraps are focusable, so both
            need the name. */}
        <Link href="/business/dashboard/leads" aria-label="Back to leads">
          <Button variant="ghost" size="sm" aria-label="Back to leads">
            <ArrowLeft size={20} weight="light" aria-hidden="true" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Lead Details
          </h1>
          <p className="text-text-secondary mt-1">
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
              <div className="flex items-center justify-between pb-4 border-b border-border-default">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center">
                    <User
                      size={24}
                      weight="fill"
                      className="text-text-secondary"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-lg">
                      {getCustomerDisplay(claim.consumer_id)}
                    </p>
                    <p className="text-sm text-text-muted">
                      Requested {formatRelativeTime(claim.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deal Info */}
              {isDealLoading ? (
                <div className="p-4 bg-bg-elevated rounded-xl flex items-center gap-3">
                  <SpinnerGap
                    size={20}
                    weight="light"
                    className="text-text-muted animate-spin"
                  />
                  <span className="text-sm text-text-secondary">
                    Loading deal info...
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-bg-elevated rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center flex-shrink-0">
                      <Tag
                        size={20}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary">
                        {dealTitle ?? 'This deal is no longer listed'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {dealCategory && (
                          <Badge variant="default" size="sm">
                            {dealCategory.charAt(0).toUpperCase() +
                              dealCategory.slice(1)}
                          </Badge>
                        )}
                        {priceText && (
                          <span className="font-display font-semibold tabular-nums text-text-primary">
                            {priceText}
                          </span>
                        )}
                      </div>
                      {dealTitle && !dealListed && (
                        <p className="text-sm text-text-muted mt-1">
                          This deal is no longer listed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Request */}
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Customer Request
                </h3>
                <div className="space-y-3">
                  {(claim.preferred_date || claim.preferred_time) && (
                    <div className="flex flex-wrap gap-4">
                      {claim.preferred_date && (
                        <div className="flex items-center gap-2 text-text-primary">
                          <Calendar
                            size={18}
                            weight="regular"
                            className="text-text-muted"
                          />
                          <span>
                            Preferred:{' '}
                            {formatDateOnly(claim.preferred_date, LONG_DAY)}
                          </span>
                        </div>
                      )}
                      {claim.preferred_time && (
                        <div className="flex items-center gap-2 text-text-primary">
                          <Clock
                            size={18}
                            weight="regular"
                            className="text-text-muted"
                          />
                          <span>{claim.preferred_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {claim.notes && (
                    <div className="p-3 bg-bg-surface rounded-xl">
                      <p className="text-sm text-text-secondary italic">
                        "{claim.notes}"
                      </p>
                    </div>
                  )}
                  {!claim.preferred_date &&
                    !claim.preferred_time &&
                    !claim.notes && (
                      <p className="text-text-muted text-sm">
                        No specific preferences provided.
                      </p>
                    )}
                </div>
              </div>

              {/* Status Actions */}
              {statusActions.length > 0 && (
                <div className="pt-4 border-t border-border-default">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
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

          {/* The thread opens with the claim, not with the first status change: the consumer
              can message the moment they claim, and a lead the owner cannot answer until they
              have clicked "Mark Contacted" is a lead that goes cold. */}
          {conversationId && (
            <MessageThread
              conversationId={conversationId}
              currentUserId={ownerId}
              currentUserType="business"
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info Card */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-text-secondary mb-4">
              Contact Information
            </h3>
            {canShowContactInfo ? (
              <div className="space-y-4">
                {contactError ? (
                  <p className="text-sm text-error-text" role="alert">
                    {contactError}
                  </p>
                ) : null}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success-bg flex items-center justify-center">
                    <Envelope
                      size={20}
                      weight="fill"
                      className="text-success"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Email</p>
                    {contact?.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-text-primary text-sm underline break-all"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <p className="text-text-secondary text-sm">
                        {contact ? 'Not provided' : 'Loading…'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center">
                    <Phone size={20} weight="fill" className="text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Phone</p>
                    {contact?.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-text-primary text-sm underline"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <p className="text-text-secondary text-sm">
                        {/* Honest: a phone is optional on the consumer's profile, and most
                            have not set one. Email is the handle that always exists. */}
                        {contact ? 'Not provided — use email' : 'Loading…'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-warning-bg mx-auto mb-3 flex items-center justify-center">
                  <User size={24} weight="fill" className="text-warning" />
                </div>
                <p className="text-sm text-text-secondary">
                  {leadEnded
                    ? `Contact details are hidden because this lead was ${claim.status}.`
                    : 'Contact info will be revealed after you mark this lead as contacted.'}
                </p>
              </div>
            )}
          </Card>

          {/* Timeline Card */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-text-secondary mb-4">
              Activity
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-primary">Lead received</p>
                  <p className="text-xs text-text-muted">
                    {formatRelativeTime(claim.created_at)}
                  </p>
                </div>
              </div>
              {claim.responded_at && claim.status !== 'pending' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-info mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-text-primary">
                      Contacted customer
                    </p>
                    <p className="text-xs text-text-muted">
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
                      <p className="text-sm text-text-primary">
                        {claim.status === 'completed'
                          ? 'Appointment completed'
                          : 'Appointment booked'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDateOnly(claim.booked_date, LONG_DAY)}
                      </p>
                    </div>
                  </div>
                )}
              {claim.status === 'cancelled' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-error mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-text-primary">Lead cancelled</p>
                    <p className="text-xs text-text-muted">
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
