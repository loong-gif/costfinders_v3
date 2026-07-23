import { Crown } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import {
  formatBillingPeriod,
  formatCommitmentMonths,
  getFreshnessLabel,
  getPublicMemberships,
  isMarketplaceFreshnessError,
  summarizeMembershipBenefits,
} from '@/lib/data/marketplace'

export const dynamic = 'force-dynamic'

function MembershipUnavailable() {
  return (
    <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
      Membership data will appear after the migration is applied.
    </p>
  )
}

export default async function MembershipsPage() {
  let memberships: Awaited<ReturnType<typeof getPublicMemberships>>
  try {
    memberships = await getPublicMemberships()
  } catch (error) {
    if (isMarketplaceFreshnessError(error)) {
      return (
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#451a03]">Memberships</h1>
          <MembershipUnavailable />
        </main>
      )
    }
    throw error
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3">
        <Crown
          size={32}
          weight="fill"
          className="mt-1 shrink-0 text-[#92400e]"
          aria-hidden
        />
        <div>
          <h1 className="text-3xl font-bold text-[#451a03]">Memberships</h1>
          <p className="mt-2 max-w-3xl text-[#78350f]">
            Verified membership plans from local medspa providers. Compare
            monthly fees, commitment terms, and included perks before you
            subscribe.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((plan) => {
          const benefits = plan.benefits ?? []
          const { visible, extraCount } = summarizeMembershipBenefits(benefits)
          const commitment = formatCommitmentMonths(
            plan.minimum_commitment_months,
          )

          return (
            <article
              key={plan.plan_id}
              className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5 transition-colors hover:bg-[#faf5ee]"
            >
              <p className="text-sm text-[#92400e]">
                {plan.master_business_info?.name ?? 'Local provider'} ·{' '}
                {plan.master_business_info?.city ?? 'Location unavailable'}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#451a03]">
                {plan.membership_name}
              </h2>
              <p className="mt-3 font-mono text-2xl font-bold text-[#92400e]">
                ${Number(plan.membership_price).toLocaleString()}
                <span className="text-base font-normal text-[#78350f]">
                  {' '}
                  {formatBillingPeriod(plan.billing_period)}
                </span>
              </p>
              {commitment && (
                <p className="mt-2 text-sm text-[#78350f]">{commitment}</p>
              )}
              {visible.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm text-[#78350f]">
                  {visible.map((benefit) => (
                    <li key={benefit} className="flex gap-2">
                      <span className="text-[#92400e]" aria-hidden>
                        ·
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                  {extraCount > 0 && (
                    <li className="text-xs text-[#92400e]">
                      +{extraCount} more perks
                    </li>
                  )}
                </ul>
              )}
              <p className="mt-3 text-xs text-[#78350f]">
                {getFreshnessLabel(plan.updated_at)}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link
                  className="text-[#92400e] underline"
                  href={`/businesses/${plan.business_id}`}
                >
                  Business
                </Link>
                {plan.source_url && (
                  <a
                    className="text-[#92400e] underline"
                    href={plan.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View membership source
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {memberships.length === 0 && (
        <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
          No verified membership plans are available yet.
        </p>
      )}
    </main>
  )
}
