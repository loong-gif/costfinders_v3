'use client'

import {
  ArrowClockwise,
  ArrowRight,
  Hourglass,
  MagnifyingGlass,
  Megaphone,
  SealCheck,
  Storefront,
  Tag,
  Users,
  Warning,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type BusinessClaim,
  getBusinessClaimsAction,
} from '@/lib/actions/admin-actions'
import { getLeadCountsAction } from '@/lib/actions/admin-leads'
import { getConsumerCountAction } from '@/lib/actions/admin-user-actions'
import { useAdminAuth } from '@/lib/context/adminAuthContext'

interface MetricCardProps {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  /** `null` means the number could not be read — never render it as 0. */
  value: number | null
  label: string
  isLoading?: boolean
  highlight?: boolean
}

function MetricCard({
  icon: Icon,
  value,
  label,
  isLoading,
  highlight,
}: MetricCardProps) {
  const isUnavailable = !isLoading && value === null

  return (
    <Card variant="glass" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="w-12 h-12 rounded-xl bg-bg-surface flex items-center justify-center">
          <Icon size={24} weight="fill" className="text-text-secondary" />
        </div>
        {highlight && (
          <Badge variant="warning" size="sm">
            Action needed
          </Badge>
        )}
        {isUnavailable && (
          <Badge variant="default" size="sm">
            Unavailable
          </Badge>
        )}
      </div>
      <div>
        {isLoading ? (
          <div className="h-9 w-16 rounded-lg bg-bg-surface animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-text-primary">
            {value === null ? '—' : value.toLocaleString('en-US')}
          </p>
        )}
        <p className="text-sm text-text-secondary mt-1">{label}</p>
        {isUnavailable && (
          <p className="text-xs text-text-muted mt-1">
            Couldn&apos;t read this count. Reload to try again.
          </p>
        )}
      </div>
    </Card>
  )
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  return 'Just now'
}

function claimantName(claim: BusinessClaim): string {
  const name = `${claim.first_name ?? ''} ${claim.last_name ?? ''}`.trim()
  return name || claim.email
}

interface AdminDashboardClientProps {
  /** `null` when the count query failed — the card says so rather than showing 0. */
  totalBusinesses: number | null
  totalOffers: number | null
}

export function AdminDashboardClient({
  totalBusinesses,
  totalOffers,
}: AdminDashboardClientProps) {
  const { state } = useAdminAuth()
  const admin = state.admin

  const [totalConsumers, setTotalConsumers] = useState<number | null>(null)
  const [pendingClaims, setPendingClaims] = useState<BusinessClaim[] | null>(
    null,
  )
  const [leadCounts, setLeadCounts] = useState<{
    waiting: number
    expiringSoon: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    setIsLoading(true)
    setQueueError(null)

    const [consumersResult, claimsResult, leadsResult] = await Promise.all([
      getConsumerCountAction(),
      getBusinessClaimsAction('pending'),
      getLeadCountsAction(),
    ])

    setTotalConsumers(
      consumersResult.success ? (consumersResult.count ?? 0) : null,
    )
    setLeadCounts(
      leadsResult.success
        ? {
            waiting: leadsResult.waiting ?? 0,
            expiringSoon: leadsResult.expiringSoon ?? 0,
          }
        : null,
    )

    if (claimsResult.success && claimsResult.claims) {
      setPendingClaims(claimsResult.claims)
    } else {
      setPendingClaims(null)
      setQueueError(claimsResult.error ?? 'Something went wrong.')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  // One fetch drives both the count and the list, so the stat card and the queue
  // below it can never disagree.
  const pendingClaimCount = pendingClaims?.length ?? null

  // "Live offers": the count runs on the anon client, whose policy only shows is_active rows,
  // so it matches the Deals screen's "On the site" tab rather than the table total.
  const metrics = [
    { icon: Tag, value: totalOffers, label: 'Live offers' },
    { icon: Storefront, value: totalBusinesses, label: 'Total businesses' },
    {
      icon: Users,
      value: totalConsumers,
      label: 'Total consumers',
      isLoading,
    },
    {
      icon: SealCheck,
      value: pendingClaimCount,
      // Business owners asking to manage a listing — not customer claims, which are leads.
      label: 'Ownership requests',
      isLoading,
      highlight: (pendingClaimCount ?? 0) > 0,
    },
  ]

  const quickActions = [
    {
      icon: MagnifyingGlass,
      title: 'Review deals',
      description: 'Moderate offer listings',
      href: '/admin/dashboard/deals',
    },
    {
      icon: Users,
      title: 'Manage users',
      description: 'Consumer accounts',
      href: '/admin/dashboard/users',
    },
    {
      icon: Storefront,
      title: 'Manage businesses',
      description: 'Profiles & ownership claims',
      href: '/admin/dashboard/businesses',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          Welcome back, {admin?.firstName || 'Admin'}
        </h1>
        <p className="text-text-secondary mt-1">
          Here&apos;s an overview of the platform activity
        </p>
      </div>

      {/* Leads first: getting a customer's claim to the clinic inside its seven days is the
          admin's day-one job, and this is where they notice a new one. Same rule as the
          Leads screen's pending queue (getLeadCountsAction), so the two cannot disagree. */}
      <Link href="/admin/dashboard/leads" className="block">
        <Card
          variant="glass"
          padding="lg"
          hover
          className={`flex flex-wrap items-center gap-4 ${
            (leadCounts?.waiting ?? 0) > 0 ? 'ring-1 ring-border-accent' : ''
          }`}
        >
          <div className="w-12 h-12 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center">
            <Megaphone size={24} weight="fill" className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="h-9 w-16 rounded-lg bg-bg-surface animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-text-primary">
                {leadCounts === null ? '—' : leadCounts.waiting}
              </p>
            )}
            <p className="text-sm text-text-secondary mt-1">
              Leads waiting to be passed to a clinic
            </p>
            {!isLoading && leadCounts === null && (
              <p className="text-xs text-text-muted mt-1">
                Couldn&apos;t read this count. Open Leads to see the queue.
              </p>
            )}
          </div>
          {!isLoading && leadCounts && leadCounts.expiringSoon > 0 && (
            <Badge variant="warning" size="md" className="gap-1">
              <Hourglass size={14} />
              {leadCounts.expiringSoon} expire
              {leadCounts.expiringSoon === 1 ? 's' : ''} within 48 hours
            </Badge>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            Open leads <ArrowRight size={16} />
          </span>
        </Card>
      </Link>

      {/* Platform Overview Metrics */}
      <div>
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4 tracking-tight">
          Platform overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              icon={metric.icon}
              value={metric.value}
              label={metric.label}
              isLoading={metric.isLoading}
              highlight={metric.highlight}
            />
          ))}
        </div>
      </div>

      {/* Claim Review Queue */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
            Listing ownership requests
          </h2>
          <Link href="/admin/dashboard/businesses">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        {isLoading && (
          <Card variant="glass" padding="none">
            <div className="divide-y divide-border-default">
              {['a', 'b', 'c'].map((key) => (
                <div key={key} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-bg-surface animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 max-w-full rounded bg-bg-surface animate-pulse" />
                    <div className="h-3 w-24 max-w-full rounded bg-bg-surface animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isLoading && queueError && (
          <Card variant="glass" padding="lg" className="text-center">
            <Warning
              size={40}
              weight="light"
              className="text-text-secondary mx-auto mb-3"
            />
            <p className="font-medium text-text-primary">
              Couldn&apos;t load ownership requests
            </p>
            <p className="text-sm text-text-secondary mt-1 mb-4">
              {queueError} Nothing has been lost — try loading it again.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMetrics}
              className="gap-1.5"
            >
              <ArrowClockwise size={16} />
              Try again
            </Button>
          </Card>
        )}

        {!(isLoading || queueError) && pendingClaims?.length === 0 && (
          <Card variant="glass" padding="lg" className="text-center">
            <SealCheck
              size={40}
              weight="light"
              className="text-text-secondary mx-auto mb-3"
            />
            <p className="font-medium text-text-primary">
              No ownership requests
            </p>
            <p className="text-sm text-text-secondary mt-1 mb-4 max-w-md mx-auto">
              When a business owner claims their listing, their request lands
              here for you to approve or reject.
            </p>
            <Link href="/admin/dashboard/businesses">
              <Button variant="secondary" size="sm">
                Browse businesses
              </Button>
            </Link>
          </Card>
        )}

        {!(isLoading || queueError) && (pendingClaims?.length ?? 0) > 0 && (
          <Card variant="glass" padding="none">
            <div className="divide-y divide-border-default">
              {pendingClaims?.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-bg-elevated transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center">
                      <Storefront
                        size={20}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {claim.business_name ?? 'Business not yet linked'}
                      </p>
                      <p className="text-sm text-text-secondary truncate">
                        {claimantName(claim)}
                        {claim.business_city ? ` — ${claim.business_city}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto">
                    <span className="text-sm text-text-muted whitespace-nowrap">
                      {formatRelativeTime(claim.created_at)}
                    </span>
                    <Link href="/admin/dashboard/businesses">
                      <Button variant="secondary" size="sm">
                        Review
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4 tracking-tight">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card variant="glass" padding="md" hover className="group h-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center transition-colors">
                    <action.icon
                      size={20}
                      weight="fill"
                      className="text-accent"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">
                      {action.title}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
