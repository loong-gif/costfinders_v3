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
  User,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BusinessTable } from '@/components/features/admin/businessTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  approveClaimAction,
  type BusinessClaim,
  getBusinessClaimsAction,
  rejectClaimAction,
} from '@/lib/actions/admin-actions'
import type { Business, BusinessStatus, BusinessTier } from '@/types/business'

type TopTab = 'businesses' | 'claims'
type FilterTab = 'all' | 'unclaimed' | 'free' | 'paid' | 'suspended'

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All Businesses' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
  { value: 'suspended', label: 'Suspended' },
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
          highlight ? 'bg-amber-800/8' : 'bg-amber-800/8'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-amber-800' : 'text-amber-800'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#451a03]">{value}</p>
        <p className="text-sm text-[#78350f]">{label}</p>
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <Card
        variant="glass"
        padding="lg"
        className="relative z-10 w-full max-w-md space-y-4"
      >
        <h3 className="text-lg font-semibold text-[#451a03]">
          {action === 'approve' ? 'Approve Claim' : 'Reject Claim'}
        </h3>

        <div className="text-sm text-[#78350f] space-y-1">
          <p>
            <span className="font-medium text-[#451a03]">
              {claim.first_name ?? ''} {claim.last_name ?? ''}
            </span>{' '}
            — {claim.email}
          </p>
          <p>
            Business:{' '}
            <span className="font-medium text-[#451a03]">
              {claim.business_name ?? 'Unknown'}
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="admin-notes"
            className="block text-sm font-medium text-[#78350f]"
          >
            Admin Notes (optional)
          </label>
          <textarea
            id="admin-notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder={
              action === 'approve'
                ? 'Add any notes about this approval...'
                : 'Provide a reason for rejection...'
            }
            rows={3}
            className="w-full px-4 py-2.5 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] placeholder:text-[#92400e] text-sm focus:outline-none focus:border-amber-800/40 focus:ring-1 focus:ring-amber-800/15 resize-none"
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
  claimCount,
  onClaimCountChange,
}: {
  onFeedback: (message: string) => void
  claimCount: number
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
          modalAction === 'approve'
            ? 'Claim approved successfully'
            : 'Claim rejected',
        )
      } else {
        onFeedback(`Failed to ${modalAction}: ${result.error}`)
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
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-4 animate-pulse">
          <ClockCountdown size={24} weight="light" className="text-amber-800" />
        </div>
        <p className="text-[#78350f]">Loading pending claims...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <p className="text-red-600 text-sm">{error}</p>
      </Card>
    )
  }

  if (claims.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-4">
          <CheckCircle size={32} weight="light" className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-[#451a03] mb-2">
          No pending claims
        </h3>
        <p className="text-[#78350f]">
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
              <tr className="border-b border-[#d4c4b0]">
                <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                  Owner
                </th>
                <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                  Business
                </th>
                <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                  City
                </th>
                <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                  Method
                </th>
                <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                  Submitted
                </th>
                <th className="text-right text-sm font-medium text-[#78350f] px-6 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4c4b0]">
              {claims.map((claim) => {
                const isProcessing = processingIds.has(claim.id)
                return (
                  <tr
                    key={claim.id}
                    className="hover:bg-[#faf5ee] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-800/8 flex items-center justify-center">
                          <User
                            size={16}
                            weight="fill"
                            className="text-amber-800"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#451a03]">
                            {claim.first_name ?? ''} {claim.last_name ?? ''}
                          </p>
                          <p className="text-xs text-[#92400e]">
                            {claim.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[#451a03]">
                        {claim.business_name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[#78350f]">
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
                            className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-700 transition-colors"
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
                        className="text-sm text-[#78350f]"
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
        <div className="lg:hidden divide-y divide-[#d4c4b0]">
          {claims.map((claim) => {
            const isProcessing = processingIds.has(claim.id)
            return (
              <div key={claim.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center">
                      <User
                        size={20}
                        weight="fill"
                        className="text-amber-800"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-[#451a03]">
                        {claim.first_name ?? ''} {claim.last_name ?? ''}
                      </p>
                      <p className="text-xs text-[#92400e]">{claim.email}</p>
                    </div>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[#92400e]">Business: </span>
                    <span className="text-[#451a03]">
                      {claim.business_name ?? 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#92400e]">City: </span>
                    <span className="text-[#451a03]">
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
                      className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-700 transition-colors"
                    >
                      <FileText size={14} weight="light" />
                      View Document
                    </a>
                  )}
                </div>

                <div
                  className="text-sm text-[#92400e]"
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
// Main Component
// ---------------------------------------------------------------------------

interface BusinessesManagementClientProps {
  initialBusinesses: Business[]
}

export function BusinessesManagementClient({
  initialBusinesses,
}: BusinessesManagementClientProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('businesses')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [pendingClaimCount, setPendingClaimCount] = useState(0)

  // Show feedback briefly then clear
  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  // Filter businesses based on active tab and search
  const filteredBusinesses = useMemo(() => {
    let filtered = businesses

    // Filter by tab
    switch (activeFilter) {
      case 'unclaimed':
        filtered = filtered.filter(
          (b) => b.tier === 'unclaimed' && b.status !== 'suspended',
        )
        break
      case 'free':
        filtered = filtered.filter(
          (b) => b.tier === 'free' && b.status !== 'suspended',
        )
        break
      case 'paid':
        filtered = filtered.filter(
          (b) => b.tier === 'paid' && b.status !== 'suspended',
        )
        break
      case 'suspended':
        filtered = filtered.filter((b) => b.status === 'suspended')
        break
      // 'all' shows everything
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

    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [businesses, activeFilter, searchQuery])

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: businesses.length,
      unclaimed: businesses.filter(
        (b) => b.tier === 'unclaimed' && b.status !== 'suspended',
      ).length,
      free: businesses.filter(
        (b) => b.tier === 'free' && b.status !== 'suspended',
      ).length,
      paid: businesses.filter(
        (b) => b.tier === 'paid' && b.status !== 'suspended',
      ).length,
      suspended: businesses.filter((b) => b.status === 'suspended').length,
    }
  }, [businesses])

  // Calculate stats
  const stats = useMemo(() => {
    const total = businesses.length
    const claimed = businesses.filter((b) => b.claimedAt).length
    const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0
    const paidCount = businesses.filter((b) => b.tier === 'paid').length

    return {
      total,
      claimedPercent,
      paidCount,
    }
  }, [businesses])

  const handleStatusChange = useCallback(
    (businessId: string, status: BusinessStatus) => {
      // Client-side optimistic update (no Supabase write yet)
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? { ...b, status, updatedAt: new Date().toISOString() }
            : b,
        ),
      )
      showFeedback(
        status === 'suspended'
          ? 'Business has been suspended'
          : 'Business has been activated',
      )
    },
    [showFeedback],
  )

  const handleTierChange = useCallback(
    (businessId: string, tier: BusinessTier) => {
      // Client-side optimistic update (no Supabase write yet)
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? { ...b, tier, updatedAt: new Date().toISOString() }
            : b,
        ),
      )
      const tierLabel =
        tier === 'paid' ? 'Paid' : tier === 'free' ? 'Free' : 'Unclaimed'
      showFeedback(`Tier changed to ${tierLabel}`)
    },
    [showFeedback],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">
          Business Management
        </h1>
        <p className="text-[#78350f] mt-1">
          Manage business profiles ({businesses.length} from Supabase)
        </p>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-600/10 border border-success/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Top-level Tabs: Businesses / Pending Claims */}
      <div className="flex gap-2 border-b border-[#d4c4b0] pb-0">
        <button
          type="button"
          onClick={() => setActiveTopTab('businesses')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTopTab === 'businesses'
              ? 'border-amber-800 text-[#451a03]'
              : 'border-transparent text-[#78350f] hover:text-[#451a03]'
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
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTopTab === 'claims'
              ? 'border-amber-800 text-[#451a03]'
              : 'border-transparent text-[#78350f] hover:text-[#451a03]'
          }`}
        >
          <span className="flex items-center gap-2">
            <ClockCountdown
              size={18}
              weight={activeTopTab === 'claims' ? 'fill' : 'light'}
            />
            Pending Claims
            {pendingClaimCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-800 text-white">
                {pendingClaimCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Claims Tab Content */}
      {activeTopTab === 'claims' && (
        <PendingClaimsSection
          onFeedback={showFeedback}
          claimCount={pendingClaimCount}
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
            />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-amber-800/40"
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
                    activeFilter === tab.value ? 'bg-[#faf5ee]' : 'bg-[#f2ebe2]'
                  }`}
                >
                  {tabCounts[tab.value]}
                </span>
              </Button>
            ))}
          </div>

          {/* Business Table */}
          <BusinessTable
            businesses={filteredBusinesses}
            onStatusChange={handleStatusChange}
            onTierChange={handleTierChange}
          />

          {/* Pagination placeholder */}
          <div className="text-sm text-[#92400e] text-center">
            Showing {filteredBusinesses.length} of {businesses.length}{' '}
            businesses
          </div>
        </>
      )}
    </div>
  )
}
