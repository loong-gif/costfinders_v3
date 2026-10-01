'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  ACTIVE_CLAIM_STATUSES,
  ConsumerClaimBadge,
  claimTitle,
} from '@/components/features/claimCard'
import { ClinicDetails } from '@/components/features/clinicDetails'
import { Card, CardContent } from '@/components/ui/card'
import { useClaims } from '@/lib/context/claimsContext'

/**
 * The customer's open claims with the clinic to call. Titles and clinics arrive with the claims
 * (getClaimsAction), so a delisted deal no longer leaves a loading bar that never resolves.
 */
export function ActiveClaimsSection() {
  const { state: claimsState } = useClaims()

  const activeClaims = useMemo(
    () =>
      claimsState.claims
        .filter((c) => ACTIVE_CLAIM_STATUSES.includes(c.status))
        .slice(0, 3),
    [claimsState.claims],
  )

  if (claimsState.isLoading || activeClaims.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          Active claims
        </h2>
        <Link
          href="/dashboard/claims"
          className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition-colors"
        >
          View all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="grid gap-3">
        {activeClaims.map((claim) => (
          <Card key={claim.id} variant="glass" padding="md">
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {claimTitle(claim)}
                    </p>
                    {claim.priceLabel && (
                      <p className="text-xs text-text-muted mt-0.5">
                        CostFinders price: {claim.priceLabel}
                      </p>
                    )}
                  </div>
                  <ConsumerClaimBadge status={claim.status} />
                </div>
                {claim.clinic && (
                  <ClinicDetails clinic={claim.clinic} actions={false} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
