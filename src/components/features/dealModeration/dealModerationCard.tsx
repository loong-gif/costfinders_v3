'use client'

import { useState } from 'react'
import {
  Check,
  X,
  PencilSimple,
  Storefront,
  Tag,
  CalendarBlank,
} from '@phosphor-icons/react'
import type { Deal, ModerationStatus } from '@/types/deal'
import { getBusinessById } from '@/lib/mock-data/businesses'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DealModerationCardProps {
  deal: Deal
  onApprove: (dealId: string) => void
  onReject: (dealId: string) => void
  onRequestChanges: (dealId: string, notes: string) => void
}

const categoryLabels: Record<string, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
}

const statusBadgeVariants: Record<ModerationStatus, 'warning' | 'success' | 'error' | 'info'> = {
  pending_review: 'warning',
  approved: 'success',
  rejected: 'error',
  changes_requested: 'info',
}

const statusLabels: Record<ModerationStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPrice(deal: Deal): string {
  const price = deal.dealPrice.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: deal.dealPrice < 10 ? 2 : 0,
  })
  return `${price} ${deal.unit}`
}

export function DealModerationCard({
  deal,
  onApprove,
  onReject,
  onRequestChanges,
}: DealModerationCardProps) {
  const [showNotesInput, setShowNotesInput] = useState(false)
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const business = getBusinessById(deal.businessId)
  const moderationStatus = deal.moderationStatus || 'pending_review'

  const handleApprove = async () => {
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    onApprove(deal.id)
    setIsProcessing(false)
  }

  const handleReject = async () => {
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    onReject(deal.id)
    setIsProcessing(false)
  }

  const handleRequestChanges = async () => {
    if (!notes.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    onRequestChanges(deal.id, notes)
    setShowNotesInput(false)
    setNotes('')
    setIsProcessing(false)
  }

  const isActionable = moderationStatus === 'pending_review'

  return (
    <Card variant="glass" padding="lg" className="space-y-4">
      {/* Header with status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
            <Tag size={20} weight="fill" className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-100">{deal.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Storefront size={14} className="text-stone-500" />
              <span className="text-sm text-stone-400">
                {business?.name || 'Unknown Business'}
              </span>
            </div>
          </div>
        </div>
        <Badge variant={statusBadgeVariants[moderationStatus]} size="md">
          {statusLabels[moderationStatus]}
        </Badge>
      </div>

      {/* Deal details */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand" size="sm">
            {categoryLabels[deal.category] || deal.category}
          </Badge>
          <Badge variant="success" size="sm">
            {deal.discountPercent}% off
          </Badge>
        </div>

        <p className="text-sm text-stone-400 line-clamp-2">{deal.description}</p>

        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-stone-500">Price: </span>
            <span className="text-stone-100 font-medium">{formatPrice(deal)}</span>
            <span className="text-stone-500 ml-2 line-through">
              ${deal.originalPrice.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-stone-500">
          <div className="flex items-center gap-1">
            <CalendarBlank size={14} />
            <span>Submitted: {formatDate(deal.createdAt)}</span>
          </div>
          <div>
            Valid: {formatDate(deal.validFrom)} - {formatDate(deal.validUntil)}
          </div>
        </div>

        {deal.termsAndConditions && (
          <div className="text-xs text-stone-500 bg-stone-900 rounded-lg p-2">
            <span className="font-medium">Terms: </span>
            {deal.termsAndConditions}
          </div>
        )}
      </div>

      {/* Moderation notes if any */}
      {deal.moderationNotes && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-sm text-amber-400 font-medium">Moderation Notes:</p>
          <p className="text-sm text-stone-400 mt-1">{deal.moderationNotes}</p>
        </div>
      )}

      {/* Request changes notes input */}
      {showNotesInput && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what changes are needed..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNotesInput(false)
                setNotes('')
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRequestChanges}
              disabled={!notes.trim() || isProcessing}
              isLoading={isProcessing}
            >
              Submit Request
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isActionable && !showNotesInput && (
        <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            disabled={isProcessing}
            isLoading={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check size={16} weight="bold" />
            Approve
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowNotesInput(true)}
            disabled={isProcessing}
            className="flex-1"
          >
            <PencilSimple size={16} weight="bold" />
            Request Changes
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleReject}
            disabled={isProcessing}
            isLoading={isProcessing}
            className="flex-1"
          >
            <X size={16} weight="bold" />
            Reject
          </Button>
        </div>
      )}
    </Card>
  )
}
