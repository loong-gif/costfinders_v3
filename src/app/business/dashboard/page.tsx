'use client'

import {
  ArrowClockwise,
  CaretRight,
  ChatCircle,
  Tag,
  Users,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getClaimsForBusinessAction } from '@/lib/actions/business-claims'
import { getBusinessByIdAction } from '@/lib/actions/business-data'
import { getDealsForBusinessAction } from '@/lib/actions/deal-management'
import { getConversationsAction } from '@/lib/actions/messaging'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { isPubliclyVisible } from '@/lib/data/offers'

interface Summary {
  businessName: string | null
  liveDeals: number
  totalDeals: number
  newLeads: number
  totalLeads: number
  unreadMessages: number
}

function MetricCard({
  icon: Icon,
  value,
  label,
  hint,
  href,
}: {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  value: number
  label: string
  hint: string
  href: string
}) {
  return (
    <Link href={href} className="block rounded-2xl">
      <Card
        variant="glass"
        padding="lg"
        hover
        className="flex flex-col gap-4 h-full"
      >
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-bg-surface flex items-center justify-center">
            <Icon size={24} weight="fill" className="text-text-secondary" />
          </div>
          <CaretRight size={18} weight="light" className="text-text-muted" />
        </div>
        <div>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          <p className="text-sm text-text-secondary mt-1">{label}</p>
          <p className="text-xs text-text-muted mt-2">{hint}</p>
        </div>
      </Card>
    </Link>
  )
}

function MetricSkeleton() {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col gap-4">
      <div className="w-12 h-12 rounded-xl bg-bg-surface animate-pulse" />
      <div className="space-y-2">
        <div className="h-8 w-16 rounded-md bg-bg-surface animate-pulse" />
        <div className="h-4 w-28 rounded-md bg-bg-surface animate-pulse" />
        <div className="h-3 w-40 rounded-md bg-bg-surface animate-pulse" />
      </div>
    </Card>
  )
}

export default function BusinessDashboardPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    setError(null)

    const id = Number(businessId)
    const [businessRes, dealsRes, claimsRes, conversationsRes] =
      await Promise.all([
        getBusinessByIdAction(id),
        getDealsForBusinessAction(id),
        getClaimsForBusinessAction(id),
        getConversationsAction('business'),
      ])

    if (!(dealsRes.success && claimsRes.success)) {
      setError(
        dealsRes.error ??
          claimsRes.error ??
          'Something went wrong. Please try again.',
      )
      setIsLoading(false)
      return
    }

    const deals = dealsRes.deals ?? []
    const claims = claimsRes.claims ?? []
    const conversations = conversationsRes.conversations ?? []

    setSummary({
      businessName: businessRes.business?.name ?? null,
      // The public site's own rule (is_active and not past its end date). This used to be a
      // local copy that read end_date as a UTC instant, so a deal dropped a day early.
      liveDeals: deals.filter(isPubliclyVisible).length,
      totalDeals: deals.length,
      newLeads: claims.filter((claim) => claim.status === 'pending').length,
      totalLeads: claims.length,
      unreadMessages: conversations.filter((c) => c.unread_count > 0).length,
    })
    setIsLoading(false)
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  const heading = summary?.businessName
    ? `Welcome back, ${summary.businessName}`
    : 'Welcome back'

  return (
    <div className="space-y-8">
      {/* Header */}
      {/* No "Create a deal": an owner-created deal could never go live (see deal-management.ts). */}
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-text-primary break-words tracking-tight">
          {heading}
        </h1>
        <p className="text-text-secondary mt-1">
          Your deals, leads, and messages at a glance
        </p>
      </div>

      {/* Metrics */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      ) : error ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-10">
            <WarningCircle
              size={48}
              weight="light"
              className="mx-auto text-text-secondary mb-4"
            />
            <h2 className="text-lg font-medium text-text-primary mb-2">
              Couldn&apos;t load your dashboard
            </h2>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-5">
              {error}
            </p>
            <Button variant="secondary" onClick={load} className="mx-auto">
              <ArrowClockwise size={16} weight="light" />
              Try again
            </Button>
          </div>
        </Card>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            icon={Tag}
            value={summary.liveDeals}
            label="Deals on the site"
            hint={
              summary.totalDeals === 0
                ? 'None of your offers are listed yet'
                : `${summary.totalDeals} deal${summary.totalDeals === 1 ? '' : 's'} in total, including ones off the site`
            }
            href="/business/dashboard/deals"
          />
          <MetricCard
            icon={Users}
            value={summary.newLeads}
            label="Leads awaiting a reply"
            hint={
              summary.totalLeads > 0
                ? `${summary.totalLeads} lead${summary.totalLeads === 1 ? '' : 's'} received so far`
                : summary.liveDeals === 0
                  ? 'Leads arrive once a deal is on the site'
                  : 'No one has claimed a deal yet'
            }
            href="/business/dashboard/leads"
          />
          <MetricCard
            icon={ChatCircle}
            value={summary.unreadMessages}
            label="Unread conversations"
            hint={
              summary.unreadMessages === 0
                ? 'Nothing waiting on you right now'
                : 'Aim to reply within 24 hours'
            }
            href="/business/dashboard/messages"
          />
        </div>
      ) : null}
    </div>
  )
}
