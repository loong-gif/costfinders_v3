'use client'

import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Info,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { ClinicDetails } from '@/components/features/clinicDetails'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { cancelClaimAction } from '@/lib/actions/claims'
import { useClaims } from '@/lib/context/claimsContext'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import type { Claim, ClaimStatus } from '@/types/claim'

/** Claims still open; everything else is closed. */
export const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = [
  'pending',
  'contacted',
  'booked',
]

/**
 * Status words for the customer. At launch no clinic has an account, so a claim's real event is
 * the details being unlocked; only an owner can move it past 'pending'. The business screens keep
 * their own words (patterns/claimStatusBadge).
 */
const consumerStatus: Record<
  ClaimStatus,
  { label: string; variant: 'success' | 'info' | 'default' }
> = {
  pending: { label: 'Details unlocked', variant: 'info' },
  contacted: { label: 'Marked as contacted by the clinic', variant: 'info' },
  booked: { label: 'Booked', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
  expired: { label: 'Closed (details kept)', variant: 'default' },
}

export function ConsumerClaimBadge({
  status,
  size = 'sm',
}: {
  status: ClaimStatus
  size?: 'sm' | 'md'
}) {
  const { label, variant } = consumerStatus[status]
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  )
}

/** Never "Deal #1339": the id means nothing to the customer. */
export function claimTitle(claim: Claim): string {
  if (claim.dealTitle) return claim.dealTitle
  return claim.clinic ? `A deal at ${claim.clinic.name}` : 'A deal you claimed'
}

const timeLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

export function ClaimCard({
  claim,
  footer,
}: {
  claim: Claim
  /** Inside the card, above the claimed date: the "did the clinic honor it" question. */
  footer?: ReactNode
}) {
  const { refreshClaims } = useClaims()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const title = claimTitle(claim)
  const isActive = ACTIVE_CLAIM_STATUSES.includes(claim.status)
  // Link only to a deal we know is still listed; a taken-down deal's page is a 404.
  const linkable = claim.dealVisible === true

  const cancel = async () => {
    setCancelling(true)
    setCancelError('')
    const result = await cancelClaimAction(claim.id)
    setCancelling(false)
    if (!result.success) {
      setCancelError(result.message ?? 'We could not cancel this claim.')
      return
    }
    setConfirmOpen(false)
    await refreshClaims()
  }

  return (
    <>
      <Card variant="glass" padding="lg">
        <div className="space-y-4">
          {/* Header: Deal title + Status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {linkable ? (
                <Link
                  href={`/deals/${claim.dealId}`}
                  className="text-lg font-semibold text-text-primary hover:text-accent transition-colors line-clamp-2 inline-flex items-center gap-1.5"
                >
                  {title}
                  <ArrowRight size={16} weight="bold" className="shrink-0" />
                </Link>
              ) : (
                <p className="text-lg font-semibold text-text-primary line-clamp-2">
                  {title}
                </p>
              )}
              {claim.priceLabel && (
                <p className="text-sm text-text-secondary mt-1">
                  CostFinders price: {claim.priceLabel}
                </p>
              )}
            </div>
            <ConsumerClaimBadge status={claim.status} size="md" />
          </div>

          {claim.dealVisible === false && (
            <p className="flex items-start gap-2 rounded-xl bg-bg-surface px-3 py-2 text-sm text-text-secondary">
              <Info size={16} className="mt-0.5 shrink-0 text-text-muted" />
              This deal has since been taken down. Confirm the price with the
              clinic.
            </p>
          )}

          {claim.clinic && (
            <div className="pt-2 border-t border-border-default">
              <ClinicDetails clinic={claim.clinic} />
            </div>
          )}

          {/* What the customer asked for; we pass it on when we relay */}
          {(claim.preferredDate || claim.preferredTime) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              {claim.preferredDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-text-muted" />
                  Preferred date: {formatDateOnly(claim.preferredDate)}
                </span>
              )}
              {claim.preferredTime && (
                <span className="flex items-center gap-1.5">
                  <Clock size={16} className="text-text-muted" />
                  {timeLabels[claim.preferredTime] ?? claim.preferredTime}
                </span>
              )}
            </div>
          )}

          {/* Booked Date/Time (if booked or completed) */}
          {claim.bookedDate &&
            (claim.status === 'booked' || claim.status === 'completed') && (
              <div className="flex items-center gap-2 p-3 bg-success-bg rounded-xl">
                <CheckCircle
                  size={18}
                  weight="fill"
                  className="text-success shrink-0"
                />
                <div className="text-sm">
                  <span className="text-success font-medium">
                    {claim.status === 'completed' ? 'Completed' : 'Booked'}:{' '}
                    {formatDateOnly(claim.bookedDate)}
                  </span>
                  {claim.bookedTime && (
                    // Full opacity: at 80% this measured 3.92:1 and failed AA. The label above is
                    // already font-medium and this is not, so the weight carries the hierarchy the
                    // modifier was reaching for — and --color-emerald-600 (#065f46) is dark enough
                    // that 80% of it is a real legibility loss, not a subtle one.
                    <span className="text-success"> at {claim.bookedTime}</span>
                  )}
                </div>
              </div>
            )}

          {footer}

          {/* Footer: claimed date + cancel */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-default">
            <p className="text-xs text-text-muted">
              {/* created_at is an instant, so the visitor's own zone, not formatDateOnly */}
              Claimed{' '}
              {new Date(claim.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Cancel claim
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this claim?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Cancelling closes this claim and frees one of your 3 active claims.
            The clinic&apos;s details stay on this page.
          </p>
          {cancelError && (
            <p
              role="alert"
              className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
            >
              {cancelError}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Keep claim
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              isLoading={cancelling}
              onClick={cancel}
            >
              Cancel claim
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
