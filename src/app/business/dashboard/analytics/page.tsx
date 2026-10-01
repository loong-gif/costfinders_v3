'use client'

import {
  ArrowClockwise,
  ChartLine,
  Info,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getClaimsForBusinessAction } from '@/lib/actions/business-claims'
import { getDealsForBusinessAction } from '@/lib/actions/deal-management'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { isPubliclyVisible } from '@/lib/data/offers'

// ponytail: only counts we can actually read from the database are shown here.
// Views, conversion rate and revenue need event tracking that doesn't exist
// yet — they're called out as unavailable rather than filled with sample data.
interface Counts {
  deals: number
  leads: number
  booked: number
  completed: number
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <Card variant="glass" padding="lg">
      <p className="text-3xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </Card>
  )
}

function StatSkeleton() {
  return (
    <Card variant="glass" padding="lg">
      <div className="h-8 w-14 rounded-md bg-bg-surface animate-pulse" />
      <div className="h-4 w-28 rounded-md bg-bg-surface animate-pulse mt-3" />
    </Card>
  )
}

export default function AnalyticsPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId
  const [counts, setCounts] = useState<Counts | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    setError(null)

    const id = Number(businessId)
    const [dealsRes, claimsRes] = await Promise.all([
      getDealsForBusinessAction(id),
      getClaimsForBusinessAction(id),
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

    const claims = claimsRes.claims ?? []
    setCounts({
      // Only what the public site shows. "Deals published" used to count every row, off-site
      // ones included: 47 for business 765 when 28 were on the site.
      deals: (dealsRes.deals ?? []).filter(isPubliclyVisible).length,
      leads: claims.length,
      booked: claims.filter((c) => c.status === 'booked').length,
      completed: claims.filter((c) => c.status === 'completed').length,
    })
    setIsLoading(false)
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  // The dashboard layout renders its own screen for an account with no approved business, so
  // this only covers the render before the owner loads.
  if (!businessId) return null

  return (
    <div className="space-y-6">
      <p className="text-text-secondary -mt-2">
        What your deals and leads add up to so far
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
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
              Couldn&apos;t load your analytics
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
      ) : counts ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile value={counts.deals} label="Deals on the site" />
            <StatTile value={counts.leads} label="Leads received" />
            <StatTile value={counts.booked} label="Bookings" />
            <StatTile value={counts.completed} label="Completed" />
          </div>

          {counts.leads === 0 && (
            <Card variant="glass" padding="lg">
              <div className="text-center py-8">
                <ChartLine
                  size={48}
                  weight="light"
                  className="mx-auto text-text-muted mb-4"
                />
                <h2 className="text-lg font-medium text-text-primary mb-2">
                  No activity to report yet
                </h2>
                <p className="text-text-secondary text-sm max-w-sm mx-auto mb-5">
                  {counts.deals === 0
                    ? 'None of your deals are on the site right now. These numbers fill in when customers claim a listed deal.'
                    : 'These numbers fill in as customers claim your listed deals.'}
                </p>
                <Link
                  href="/business/dashboard/deals"
                  className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
                >
                  See your deals
                </Link>
              </div>
            </Card>
          )}
        </>
      ) : null}

      {/* Honest about what we can't measure yet */}
      <Card variant="glass" padding="lg">
        <div className="flex gap-3">
          <Info
            size={20}
            weight="light"
            className="text-text-muted flex-shrink-0 mt-0.5"
          />
          <div>
            <h2 className="font-display font-semibold text-text-primary tracking-tight">
              Views and conversion aren&apos;t tracked yet
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Page views, conversion rate, and revenue reporting need visit
              tracking that isn&apos;t live on CostFinders yet. Rather than show
              you estimates, we&apos;re leaving them out until the numbers are
              real.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
