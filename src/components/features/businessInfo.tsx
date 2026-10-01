'use client'

import { CheckCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { ClinicDetails } from '@/components/features/clinicDetails'
import { Card } from '@/components/ui/card'
import type { ClaimClinic } from '@/types/claim'

interface BusinessInfoProps {
  clinic: ClaimClinic
  /** False when the details come from the visitor's claim on another deal from this clinic. */
  claimedThisDeal: boolean
  /** This deal's membership plan, withheld until a claim (it identifies the clinic). */
  membershipPlan?: string | null
}

/**
 * The deal page after a claim. At launch no clinic has an account and nothing reaches a clinic
 * automatically — our team relays each claim by hand — so this never says the clinic will get in
 * touch. It tells the customer to call or book, with the number right there.
 */
export function BusinessInfo({
  clinic,
  claimedThisDeal,
  membershipPlan,
}: BusinessInfoProps) {
  return (
    <Card variant="glass" padding="lg">
      <div className="space-y-4">
        {claimedThisDeal ? (
          <div className="flex items-start gap-2 rounded-xl bg-success-bg p-3">
            <CheckCircle
              size={20}
              weight="fill"
              className="mt-0.5 shrink-0 text-success"
            />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-success">You claimed this deal</p>
              <p className="text-text-secondary">
                Call or book with the clinic directly. Mention the CostFinders
                price when you book. Our team also passes your request on to the
                clinic.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            You claimed another deal from this clinic, so its details are shown
            here too.
          </p>
        )}

        <ClinicDetails clinic={clinic} />

        {membershipPlan && (
          <dl className="rounded-xl border border-border-default px-4 py-3 text-sm">
            <dt className="text-text-muted">Membership plan</dt>
            <dd className="mt-0.5 font-medium text-text-primary">
              {membershipPlan}
            </dd>
          </dl>
        )}

        <Link
          href="/dashboard/claims"
          className="flex min-h-[44px] items-center justify-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
        >
          View my claims
        </Link>
      </div>
    </Card>
  )
}
