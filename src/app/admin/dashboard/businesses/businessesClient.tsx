'use client'

import {
  CheckCircle,
  ClockCountdown,
  CurrencyDollar,
  EnvelopeSimple,
  FileArrowUp,
  FileText,
  MagnifyingGlass,
  Prohibit,
  Storefront,
  Tray,
  User,
  Warning,
} from '@phosphor-icons/react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type AdminBusinessRow,
  BusinessTable,
} from '@/components/features/admin/businessTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import {
  approveClaimAction,
  type BusinessClaim,
  getBusinessClaimsAction,
  getListingRequestsAction,
  type ListingRequest,
  markListingRequestHandledAction,
  rejectClaimAction,
  updateBusinessContactAction,
} from '@/lib/actions/admin-actions'
import { getPendingClaimsCountAction } from '@/lib/actions/admin-user-actions'
import { formatPhone } from '@/lib/utils/phone'

type FeedbackTone = 'success' | 'warning' | 'error'

const FEEDBACK_STYLE: Record<FeedbackTone, string> = {
  success: 'bg-success-bg border border-success/20 text-success',
  warning: 'bg-warning/10 border border-warning/20 text-warning',
  error: 'bg-error-bg border border-error/20 text-error',
}

interface Feedback {
  message: string
  tone: FeedbackTone
}

type TopTab = 'businesses' | 'claims' | 'requests'
// The Suspended tab is gone with the fabricated status column: nothing in the
// database records a business status, so that tab could only ever read 0.
type FilterTab = 'all' | 'unclaimed' | 'free' | 'paid'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Businesses' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

interface MetricCardProps {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  value: string | number
  label: string
  highlight?: boolean
}

function MetricCard({ icon: Icon, value, label, highlight }: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-accent-muted' : 'bg-accent-muted'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-accent' : 'text-accent'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function VerificationMethodBadge({
  method,
}: {
  method: string | null | undefined
}) {
  if (method === 'email') {
    return (
      <Badge variant="info" size="sm">
        <EnvelopeSimple size={12} weight="fill" className="mr-1" />
        Email
      </Badge>
    )
  }
  if (method === 'document') {
    return (
      <Badge variant="brand" size="sm">
        <FileArrowUp size={12} weight="fill" className="mr-1" />
        Document
      </Badge>
    )
  }
  return (
    <Badge variant="default" size="sm">
      Unknown
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Approve/Reject Modal
// ---------------------------------------------------------------------------

function ClaimActionModal({
  claim,
  action,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  claim: BusinessClaim
  action: 'approve' | 'reject'
  onConfirm: (notes: string) => void
  onCancel: () => void
  isProcessing: boolean
}) {
  const [adminNotes, setAdminNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — a real button so Enter/Space and focus come for free */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-label="Close modal"
      />

      {/* Modal */}
      <Card
        variant="glass"
        padding="lg"
        className="relative z-10 w-full max-w-md space-y-4"
      >
        <h3 className="font-display text-lg font-semibold text-text-primary">
          {action === 'approve' ? 'Approve Claim' : 'Reject Claim'}
        </h3>

        <div className="text-sm text-text-secondary space-y-1">
          <p>
            <span className="font-medium text-text-primary">
              {claim.first_name ?? ''} {claim.last_name ?? ''}
            </span>{' '}
            — {claim.email}
          </p>
          <p>
            Business:{' '}
            <span className="font-medium text-text-primary">
              {claim.business_name ?? 'Unknown'}
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="admin-notes"
            className="block text-sm font-medium text-text-secondary"
          >
            Admin Notes (optional)
          </label>
          <Textarea
            id="admin-notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder={
              action === 'approve'
                ? 'Add any notes about this approval...'
                : 'Provide a reason for rejection...'
            }
            rows={3}
            className="text-sm resize-none focus:ring-1 focus:ring-border-accent"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant={action === 'approve' ? 'primary' : 'danger'}
            size="sm"
            onClick={() => onConfirm(adminNotes)}
            isLoading={isProcessing}
            disabled={isProcessing}
            className="flex-1"
          >
            {action === 'approve' ? (
              <>
                <CheckCircle size={16} weight="bold" />
                Approve
              </>
            ) : (
              <>
                <Prohibit size={16} weight="bold" />
                Reject
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Claims Section
// ---------------------------------------------------------------------------

function PendingClaimsSection({
  onFeedback,
  onClaimCountChange,
}: {
  onFeedback: (message: string, tone?: FeedbackTone) => void
  onClaimCountChange: (count: number) => void
}) {
  const [claims, setClaims] = useState<BusinessClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Modal state
  const [modalClaim, setModalClaim] = useState<BusinessClaim | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>(
    'approve',
  )

  useEffect(() => {
    async function fetchClaims() {
      setLoading(true)
      setError(null)
      const result = await getBusinessClaimsAction('pending')
      if (result.success && result.claims) {
        setClaims(result.claims)
        onClaimCountChange(result.claims.length)
      } else {
        setError(result.error ?? 'Failed to load claims')
      }
      setLoading(false)
    }
    fetchClaims()
  }, [onClaimCountChange])

  const openModal = useCallback(
    (claim: BusinessClaim, action: 'approve' | 'reject') => {
      setModalClaim(claim)
      setModalAction(action)
    },
    [],
  )

  const closeModal = useCallback(() => {
    setModalClaim(null)
  }, [])

  const handleConfirmAction = useCallback(
    async (adminNotes: string) => {
      if (!modalClaim) return

      const profileId = modalClaim.id
      setProcessingIds((prev) => new Set(prev).add(profileId))

      // Optimistic removal
      setClaims((prev) => prev.filter((c) => c.id !== profileId))
      onClaimCountChange(claims.length - 1)
      closeModal()

      const result =
        modalAction === 'approve'
          ? await approveClaimAction(profileId, undefined, adminNotes)
          : await rejectClaimAction(profileId, undefined, adminNotes)

      if (result.success) {
        onFeedback(
          modalAction === 'approve' ? 'Claim approved.' : 'Claim rejected.',
        )
      } else {
        onFeedback(
          `Couldn't ${modalAction} that claim. ${result.error ?? 'Please try again.'}`,
          'error',
        )
        // Revert on failure — re-fetch
        const refreshed = await getBusinessClaimsAction('pending')
        if (refreshed.success && refreshed.claims) {
          setClaims(refreshed.claims)
          onClaimCountChange(refreshed.claims.length)
        }
      }

      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(profileId)
        return next
      })
    },
    [
      modalClaim,
      modalAction,
      claims.length,
      onFeedback,
      onClaimCountChange,
      closeModal,
    ],
  )

  if (loading) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-12 h-12 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4 animate-pulse">
          <ClockCountdown
            size={24}
            weight="light"
            className="text-text-secondary"
          />
        </div>
        <p className="text-text-secondary">Loading pending claims...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <p className="text-error text-sm">{error}</p>
      </Card>
    )
  }

  if (claims.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4">
          <CheckCircle size={32} weight="light" className="text-success" />
        </div>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
          No pending claims
        </h3>
        <p className="text-text-secondary">
          All business claims have been reviewed.
        </p>
      </Card>
    )
  }

  return (
    <>
      {/* Action Modal */}
      {modalClaim && (
        <ClaimActionModal
          claim={modalClaim}
          action={modalAction}
          onConfirm={handleConfirmAction}
          onCancel={closeModal}
          isProcessing={processingIds.has(modalClaim.id)}
        />
      )}

      <Card variant="glass" padding="none" className="overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                  Owner
                </th>
                <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                  Business
                </th>
                <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                  City
                </th>
                <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                  Method
                </th>
                <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                  Submitted
                </th>
                <th className="text-right text-sm font-medium text-text-secondary px-6 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {claims.map((claim) => {
                const isProcessing = processingIds.has(claim.id)
                return (
                  <tr
                    key={claim.id}
                    className="hover:bg-bg-elevated transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                          <User
                            size={16}
                            weight="fill"
                            className="text-text-secondary"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {claim.first_name ?? ''} {claim.last_name ?? ''}
                          </p>
                          <p className="text-xs text-text-muted">
                            {claim.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-primary">
                        {claim.business_name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">
                        {claim.business_city ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <VerificationMethodBadge
                          method={claim.verification_method}
                        />
                        {claim.evidence_document_url && (
                          <a
                            href={claim.evidence_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                            title="View uploaded document"
                          >
                            <FileText size={14} weight="light" />
                            View
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm text-text-secondary"
                        title={new Date(claim.created_at).toLocaleString()}
                      >
                        {formatTimeAgo(claim.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isProcessing}
                          isLoading={isProcessing}
                          onClick={() => openModal(claim, 'approve')}
                        >
                          <CheckCircle size={16} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => openModal(claim, 'reject')}
                        >
                          <Prohibit size={16} weight="bold" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="lg:hidden divide-y divide-border-default">
          {claims.map((claim) => {
            const isProcessing = processingIds.has(claim.id)
            return (
              <div key={claim.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center">
                      <User
                        size={20}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {claim.first_name ?? ''} {claim.last_name ?? ''}
                      </p>
                      <p className="text-xs text-text-muted">{claim.email}</p>
                    </div>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Business: </span>
                    <span className="text-text-primary">
                      {claim.business_name ?? 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">City: </span>
                    <span className="text-text-primary">
                      {claim.business_city ?? '-'}
                    </span>
                  </div>
                </div>

                {/* Verification method + document link */}
                <div className="flex items-center gap-2 flex-wrap">
                  <VerificationMethodBadge method={claim.verification_method} />
                  {claim.evidence_document_url && (
                    <a
                      href={claim.evidence_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      <FileText size={14} weight="light" />
                      View Document
                    </a>
                  )}
                </div>

                <div
                  className="text-sm text-text-muted"
                  title={new Date(claim.created_at).toLocaleString()}
                >
                  Submitted {formatTimeAgo(claim.created_at)}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessing}
                    isLoading={isProcessing}
                    onClick={() => openModal(claim, 'approve')}
                    className="flex-1"
                  >
                    <CheckCircle size={16} weight="bold" />
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => openModal(claim, 'reject')}
                    className="flex-1"
                  >
                    <Prohibit size={16} weight="bold" />
                    Reject
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Listing requests
// ---------------------------------------------------------------------------

const REQUEST_TYPE_LABEL: Record<string, string> = {
  add: 'Add my business',
  removal: 'Remove listing',
  correction: 'Fix listing details',
  price_dispute: 'Price dispute',
  other: 'Other',
}

const REQUEST_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_review: 'In review',
  actioned: 'Handled',
  declined: 'Declined',
}

/**
 * What clinics send from the public listing-request form. They are also emailed to the ops
 * inbox; this list is the record, and "Mark handled" is how the queue is kept clean.
 */
function ListingRequestsSection({
  onFeedback,
  onOpenCountChange,
}: {
  onFeedback: (message: string, tone?: FeedbackTone) => void
  onOpenCountChange: (count: number) => void
}) {
  const [requests, setRequests] = useState<ListingRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const result = await getListingRequestsAction()
    if (result.success && result.requests) {
      setRequests(result.requests)
      onOpenCountChange(
        result.requests.filter(
          (r) => r.status === 'new' || r.status === 'in_review',
        ).length,
      )
    } else {
      setRequests(null)
      setError(result.error ?? 'Something went wrong.')
    }
  }, [onOpenCountChange])

  useEffect(() => {
    load()
  }, [load])

  const markHandled = async (request: ListingRequest) => {
    setBusyId(request.id)
    const result = await markListingRequestHandledAction(request.id)
    setBusyId(null)
    if (!result.success) {
      onFeedback(
        `Couldn't mark that request handled. ${result.error ?? 'Please try again.'}`,
        'error',
      )
      return
    }
    onFeedback(`Request from ${request.business_name} marked handled.`)
    await load()
  }

  if (error) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <p className="text-error text-sm">
          Couldn&apos;t load listing requests. {error}
        </p>
      </Card>
    )
  }

  if (requests === null) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <p className="text-text-secondary">Loading listing requests...</p>
      </Card>
    )
  }

  if (requests.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <Tray
          size={32}
          weight="light"
          className="text-text-secondary mx-auto mb-3"
        />
        <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
          No listing requests yet
        </h3>
        <p className="text-text-secondary max-w-md mx-auto">
          When a clinic asks to be added, corrected or removed, the request
          lands here and in the ops inbox.
        </p>
      </Card>
    )
  }

  return (
    <Card variant="glass" padding="none" className="overflow-hidden">
      <div className="divide-y divide-border-default">
        {requests.map((request) => {
          const open =
            request.status === 'new' || request.status === 'in_review'
          return (
            <div key={request.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-text-primary">
                  {request.business_name}
                </p>
                <Badge variant="brand" size="sm">
                  {REQUEST_TYPE_LABEL[request.request_type] ??
                    request.request_type}
                </Badge>
                <Badge variant={open ? 'warning' : 'default'} size="sm">
                  {REQUEST_STATUS_LABEL[request.status] ?? request.status}
                </Badge>
                <span
                  className="text-xs text-text-muted ml-auto"
                  title={new Date(request.created_at).toLocaleString()}
                >
                  {formatTimeAgo(request.created_at)}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                {request.contact_name}
                {request.contact_role ? `, ${request.contact_role}` : ''}
                {' — '}
                <a
                  href={`mailto:${request.contact_email}`}
                  className="text-accent hover:text-accent-hover break-all"
                >
                  {request.contact_email}
                </a>
              </p>
              <p className="text-sm text-text-primary whitespace-pre-line break-words bg-bg-elevated rounded-lg px-3 py-2">
                {request.details}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {request.page_url && (
                  <a
                    href={request.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent-hover break-all"
                  >
                    {request.page_url}
                  </a>
                )}
                {open && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ml-auto"
                    onClick={() => markHandled(request)}
                    isLoading={busyId === request.id}
                    disabled={busyId === request.id}
                  >
                    <CheckCircle size={16} />
                    Mark handled
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Contact details editor
// ---------------------------------------------------------------------------

/**
 * Phone, website, address and city: the four fields an admin relaying a lead needs right.
 * Everything else about a business comes from the data pipeline and is not editable here.
 */
function ContactEditForm({
  business,
  onSaved,
  onCancel,
}: {
  business: AdminBusinessRow
  onSaved: (updated: AdminBusinessRow) => void
  onCancel: () => void
}) {
  const [phone, setPhone] = useState(
    business.phone ? formatPhone(business.phone) : '',
  )
  const [website, setWebsite] = useState(business.website ?? '')
  const [address, setAddress] = useState(business.address ?? '')
  const [city, setCity] = useState(business.city)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateBusinessContactAction(Number(business.id), {
      phone,
      website,
      address,
      city,
    })
    setSaving(false)
    if (!(result.success && result.business)) {
      setError(result.error ?? 'Nothing was saved.')
      return
    }
    onSaved({
      ...business,
      phone: result.business.phone,
      website: result.business.website,
      address: result.business.address,
      city: result.business.city ?? '',
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-text-secondary">
        Corrections go straight to the live listing. The data pipeline may
        overwrite them on its next import, so tell the data team about anything
        that matters.
      </p>
      <Input
        label="Phone"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(520) 555-0123"
        hint="US numbers only. Leave empty if the clinic has none."
      />
      <Input
        label="Website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="clinic.com"
      />
      <Input
        label="Street address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={300}
      />
      <Input
        label="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        maxLength={100}
        required
        hint="Decides which city page the business is listed on."
      />
      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg border border-error/20 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={saving} disabled={saving}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface BusinessesManagementClientProps {
  initialBusinesses: AdminBusinessRow[]
}

export function BusinessesManagementClient({
  initialBusinesses,
}: BusinessesManagementClientProps) {
  // Only contact details change here (ContactEditForm); the row is patched from the saved row.
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [editing, setEditing] = useState<AdminBusinessRow | null>(null)
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('businesses')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingClaimCount, setPendingClaimCount] = useState(0)
  const [openRequestCount, setOpenRequestCount] = useState(0)

  // Show feedback briefly then clear. Errors stay long enough to read.
  const showFeedback = useCallback(
    (message: string, tone: FeedbackTone = 'success') => {
      setFeedback({ message, tone })
      setTimeout(() => setFeedback(null), tone === 'success' ? 3000 : 10000)
    },
    [],
  )

  // The tab badges are read on load, not when their tab first opens: a badge that is blank until
  // you click it tells you nothing.
  useEffect(() => {
    getPendingClaimsCountAction().then((result) => {
      if (result.success) setPendingClaimCount(result.count ?? 0)
    })
    getListingRequestsAction().then((result) => {
      if (result.success && result.requests) {
        setOpenRequestCount(
          result.requests.filter(
            (r) => r.status === 'new' || r.status === 'in_review',
          ).length,
        )
      }
    })
  }, [])

  // Filter businesses based on active tab and search
  const filteredBusinesses = useMemo(() => {
    let filtered = businesses

    // Filter by tab ('all' shows everything)
    if (activeFilter !== 'all') {
      filtered = filtered.filter((b) => b.tier === activeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.city.toLowerCase().includes(query),
      )
    }

    // Sort by name. Copied first: with no tab and no search, `filtered` IS the state array.
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [businesses, activeFilter, searchQuery])

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: businesses.length,
      unclaimed: businesses.filter((b) => b.tier === 'unclaimed').length,
      free: businesses.filter((b) => b.tier === 'free').length,
      paid: businesses.filter((b) => b.tier === 'paid').length,
    }
  }, [businesses])

  // Calculate stats. "Claimed Rate" used to count b.claimedAt, which the page never
  // set, so it read 0% over 419 rows. A business is claimed exactly when it has an
  // approved business_profiles row — which is also what gives it a tier.
  const stats = useMemo(() => {
    const total = businesses.length
    const claimed = businesses.filter((b) => b.tier !== 'unclaimed').length
    const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0
    const paidCount = businesses.filter((b) => b.tier === 'paid').length

    return {
      total,
      claimedPercent,
      paidCount,
    }
  }, [businesses])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          Business Management
        </h1>
        <p className="text-text-secondary mt-1">
          Business listings ({businesses.length.toLocaleString('en-US')}{' '}
          listed), ownership requests and listing requests
        </p>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          role={feedback.tone === 'success' ? 'status' : 'alert'}
          className={`px-4 py-3 rounded-xl text-sm font-medium ${FEEDBACK_STYLE[feedback.tone]}`}
        >
          {feedback.message}
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit contact details: ${editing.name}` : ''}
        size="lg"
      >
        {editing && (
          <ContactEditForm
            business={editing}
            onCancel={() => setEditing(null)}
            onSaved={(updated) => {
              setBusinesses((prev) =>
                prev.map((b) => (b.id === updated.id ? updated : b)),
              )
              setEditing(null)
              showFeedback(`Contact details for ${updated.name} saved.`)
            }}
          />
        )}
      </Modal>

      {/* Top-level Tabs: Businesses / Pending Claims */}
      <div className="flex gap-2 border-b border-border-default pb-0 overflow-x-auto overflow-y-hidden">
        <button
          type="button"
          onClick={() => setActiveTopTab('businesses')}
          className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTopTab === 'businesses'
              ? 'border-border-accent text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <Storefront
              size={18}
              weight={activeTopTab === 'businesses' ? 'fill' : 'light'}
            />
            Businesses
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTopTab('claims')}
          className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTopTab === 'claims'
              ? 'border-border-accent text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <ClockCountdown
              size={18}
              weight={activeTopTab === 'claims' ? 'fill' : 'light'}
            />
            Ownership requests
            {pendingClaimCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-accent text-white">
                {pendingClaimCount}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTopTab('requests')}
          className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTopTab === 'requests'
              ? 'border-border-accent text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tray
              size={18}
              weight={activeTopTab === 'requests' ? 'fill' : 'light'}
            />
            Listing requests
            {openRequestCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-accent text-white">
                {openRequestCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {activeTopTab === 'requests' && (
        <ListingRequestsSection
          onFeedback={showFeedback}
          onOpenCountChange={setOpenRequestCount}
        />
      )}

      {/* Claims Tab Content */}
      {activeTopTab === 'claims' && (
        <PendingClaimsSection
          onFeedback={showFeedback}
          onClaimCountChange={setPendingClaimCount}
        />
      )}

      {/* Businesses Tab Content */}
      {activeTopTab === 'businesses' && (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              icon={Storefront}
              value={stats.total}
              label="Total Businesses"
            />
            <MetricCard
              icon={CheckCircle}
              value={`${stats.claimedPercent}%`}
              label="Claimed Rate"
            />
            <MetricCard
              icon={CurrencyDollar}
              value={stats.paidCount}
              label="Paid Tier"
              highlight={stats.paidCount > 0}
            />
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border-accent"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <Button
                key={tab.value}
                variant={activeFilter === tab.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveFilter(tab.value)}
                className="gap-2"
              >
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full ${
                    activeFilter === tab.value
                      ? 'bg-bg-elevated text-text-primary'
                      : 'bg-bg-surface'
                  }`}
                >
                  {tabCounts[tab.value]}
                </span>
              </Button>
            ))}
          </div>

          {/* The old notice here said "Everything else on this page is live" over a
              table whose Tier, Status, Claimed and Deals columns were all invented.
              Those columns are gone or real now, so the notice only has to explain
              the one thing an admin will look for and not find: a way to edit. */}
          <div className="flex items-start gap-3 bg-bg-surface rounded-xl px-4 py-3">
            <Warning
              size={18}
              weight="fill"
              className="text-text-secondary shrink-0 mt-0.5"
            />
            <div className="text-sm">
              <p className="font-medium text-text-primary">
                Only contact details can be edited here
              </p>
              <p className="text-text-secondary">
                Name, category and rating come from the data pipeline. Fix a
                wrong phone, website or address with Edit contact.
              </p>
            </div>
          </div>

          {/* Business Table */}
          <BusinessTable businesses={filteredBusinesses} onEdit={setEditing} />

          {/* Pagination placeholder */}
          <div className="text-sm text-text-muted text-center">
            Showing {filteredBusinesses.length} of {businesses.length}{' '}
            businesses
          </div>
        </>
      )}
    </div>
  )
}
