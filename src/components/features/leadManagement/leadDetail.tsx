'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  User,
  Envelope,
  Phone,
  ChatCircle,
  CheckCircle,
  XCircle,
  PhoneCall,
  CalendarCheck,
} from '@phosphor-icons/react'
import type { Claim, ClaimStatus } from '@/types/claim'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClaimStatusBadge } from '@/components/patterns/claimStatusBadge'
import {
  getDealByIdDynamic as getDealById,
  updateClaimStatus,
  addBusinessResponse,
} from '@/lib/mock-data'
import { MessageThread } from '@/components/features/messaging/messageThread'

interface LeadDetailProps {
  claim: Claim
  businessId: string
  onClaimUpdate?: (claim: Claim) => void
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
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(dateString)
}

function getCustomerDisplay(consumerId: string): string {
  const num = consumerId.replace(/\D/g, '')
  return `Customer #${num || consumerId.slice(-3)}`
}

// Mock contact info - only revealed after initial contact
function getMockContactInfo(consumerId: string) {
  const num = consumerId.replace(/\D/g, '') || '123'
  return {
    email: `customer${num}@example.com`,
    phone: `(555) ${num.padStart(3, '0')}-${num.padStart(4, '0').slice(0, 4)}`,
  }
}

export function LeadDetail({ claim: initialClaim, businessId, onClaimUpdate }: LeadDetailProps) {
  const [claim, setClaim] = useState(initialClaim)
  const [businessNotes, setBusinessNotes] = useState(claim.businessResponse || '')
  const [isSaving, setIsSaving] = useState(false)

  const deal = getDealById(claim.dealId)

  const handleStatusChange = (newStatus: ClaimStatus) => {
    const updatedClaim = updateClaimStatus(claim.id, newStatus)
    if (updatedClaim) {
      setClaim(updatedClaim)
      onClaimUpdate?.(updatedClaim)
    }
  }

  const handleSaveNotes = () => {
    if (!businessNotes.trim()) return
    setIsSaving(true)

    // Simulate saving delay
    setTimeout(() => {
      const updatedClaim = addBusinessResponse(claim.id, businessNotes)
      if (updatedClaim) {
        setClaim(updatedClaim)
        onClaimUpdate?.(updatedClaim)
      }
      setIsSaving(false)
    }, 300)
  }

  const canShowContactInfo = claim.status !== 'pending'
  const contactInfo = getMockContactInfo(claim.consumerId)

  // Status transition buttons
  const statusActions: { status: ClaimStatus; label: string; icon: React.ReactNode; variant: 'primary' | 'secondary' | 'danger' }[] = []

  switch (claim.status) {
    case 'pending':
      statusActions.push({ status: 'contacted', label: 'Mark Contacted', icon: <PhoneCall size={18} weight="fill" />, variant: 'primary' })
      statusActions.push({ status: 'cancelled', label: 'Cancel', icon: <XCircle size={18} weight="fill" />, variant: 'danger' })
      break
    case 'contacted':
      statusActions.push({ status: 'booked', label: 'Mark Booked', icon: <CalendarCheck size={18} weight="fill" />, variant: 'primary' })
      statusActions.push({ status: 'cancelled', label: 'Cancel', icon: <XCircle size={18} weight="fill" />, variant: 'danger' })
      break
    case 'booked':
      statusActions.push({ status: 'completed', label: 'Mark Completed', icon: <CheckCircle size={18} weight="fill" />, variant: 'primary' })
      statusActions.push({ status: 'cancelled', label: 'Cancel', icon: <XCircle size={18} weight="fill" />, variant: 'danger' })
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
          <h1 className="text-2xl font-bold text-text-primary">Lead Details</h1>
          <p className="text-text-secondary mt-1">
            {getCustomerDisplay(claim.consumerId)}
          </p>
        </div>
        <ClaimStatusBadge status={claim.status} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Info Card */}
          <Card variant="glass" padding="lg">
            <div className="space-y-6">
              {/* Header with created date */}
              <div className="flex items-center justify-between pb-4 border-b border-glass-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <User size={24} weight="fill" className="text-brand-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-lg">
                      {getCustomerDisplay(claim.consumerId)}
                    </p>
                    <p className="text-sm text-text-muted">
                      Requested {formatRelativeTime(claim.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deal Info */}
              {deal && (
                <div className="p-4 bg-bg-tertiary rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} weight="fill" className="text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary">{deal.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="default" size="sm">
                          {deal.category.charAt(0).toUpperCase() + deal.category.slice(1)}
                        </Badge>
                        <span className="text-brand-primary font-semibold">
                          ${deal.dealPrice} <span className="text-text-muted font-normal">{deal.unit}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Request */}
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3">Customer Request</h3>
                <div className="space-y-3">
                  {(claim.preferredDate || claim.preferredTime) && (
                    <div className="flex flex-wrap gap-4">
                      {claim.preferredDate && (
                        <div className="flex items-center gap-2 text-text-primary">
                          <Calendar size={18} weight="regular" className="text-text-muted" />
                          <span>Preferred: {formatDate(claim.preferredDate)}</span>
                        </div>
                      )}
                      {claim.preferredTime && (
                        <div className="flex items-center gap-2 text-text-primary">
                          <Clock size={18} weight="regular" className="text-text-muted" />
                          <span>{claim.preferredTime}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {claim.notes && (
                    <div className="p-3 bg-glass-bg rounded-xl">
                      <p className="text-sm text-text-secondary italic">"{claim.notes}"</p>
                    </div>
                  )}
                  {!claim.preferredDate && !claim.preferredTime && !claim.notes && (
                    <p className="text-text-muted text-sm">No specific preferences provided.</p>
                  )}
                </div>
              </div>

              {/* Status Actions */}
              {statusActions.length > 0 && (
                <div className="pt-4 border-t border-glass-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">Update Status</h3>
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
            <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
              <ChatCircle size={18} weight="fill" className="text-text-muted" />
              Business Notes
            </h3>
            <div className="space-y-4">
              <textarea
                value={businessNotes}
                onChange={(e) => setBusinessNotes(e.target.value)}
                placeholder="Add internal notes about this lead..."
                className="w-full h-32 px-4 py-3 bg-glass-bg border border-glass-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 transition-all"
              />
              <div className="flex items-center justify-between">
                {claim.respondedAt && (
                  <p className="text-xs text-text-muted">
                    Last updated: {formatRelativeTime(claim.respondedAt)}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSaving || !businessNotes.trim() || businessNotes === claim.businessResponse}
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
            <h3 className="text-sm font-medium text-text-secondary mb-4">Contact Information</h3>
            {canShowContactInfo ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Envelope size={20} weight="fill" className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Email</p>
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="text-text-primary hover:text-brand-primary transition-colors"
                    >
                      {contactInfo.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Phone size={20} weight="fill" className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Phone</p>
                    <a
                      href={`tel:${contactInfo.phone}`}
                      className="text-text-primary hover:text-brand-primary transition-colors"
                    >
                      {contactInfo.phone}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-warning-bg mx-auto mb-3 flex items-center justify-center">
                  <User size={24} weight="fill" className="text-warning" />
                </div>
                <p className="text-sm text-text-secondary">
                  Contact info will be revealed after you mark this lead as contacted.
                </p>
              </div>
            )}
          </Card>

          {/* Timeline Card */}
          <Card variant="glass" padding="lg">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Activity</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-brand-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-primary">Lead received</p>
                  <p className="text-xs text-text-muted">{formatRelativeTime(claim.createdAt)}</p>
                </div>
              </div>
              {claim.respondedAt && claim.status !== 'pending' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-info mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-text-primary">Contacted customer</p>
                    <p className="text-xs text-text-muted">{formatRelativeTime(claim.respondedAt)}</p>
                  </div>
                </div>
              )}
              {claim.bookedDate && (claim.status === 'booked' || claim.status === 'completed') && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-text-primary">
                      {claim.status === 'completed' ? 'Appointment completed' : 'Appointment booked'}
                    </p>
                    <p className="text-xs text-text-muted">{formatDate(claim.bookedDate)}</p>
                  </div>
                </div>
              )}
              {claim.status === 'cancelled' && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-error mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-text-primary">Lead cancelled</p>
                    <p className="text-xs text-text-muted">{formatRelativeTime(claim.updatedAt)}</p>
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
