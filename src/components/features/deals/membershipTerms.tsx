import { formatPrice } from '@/lib/data/adapters'
import type { MembershipTerms } from '@/types/deal'

const PERIOD_WORDS: Record<
  NonNullable<MembershipTerms['billingPeriod']>,
  string
> = {
  monthly: 'a month',
  annual: 'a year',
  quarterly: 'a quarter',
  one_time: 'paid once',
}

/**
 * The fee as the plan states it. On 2026-09-28, 4 of the 455 live member prices had a fee and
 * no billing period, so a bare figure would read as a one-off it may not be.
 */
function fee(price: number, period: MembershipTerms['billingPeriod']): string {
  const amount = formatPrice(price)
  if (!period) return `${amount} (the clinic doesn't say how often)`
  return period === 'one_time'
    ? `${amount}, ${PERIOD_WORDS[period]}`
    : `${amount} ${PERIOD_WORDS[period]}`
}

/**
 * The plan behind a member price (spec §3.3). The deal page is the only place the fee shows:
 * listings say "for members" and stop there (owner decision, 2026-09-28). The plan's name is not
 * here: it identifies the clinic ("Club FX" is one search from DermFx), so it arrives with the
 * clinic's details after a claim (BusinessInfo, via claimed_membership_name()). This page is
 * cached for everyone, so it says so rather than printing it.
 * 24 of the 455 member prices had no published fee on 2026-09-28; those get the sentence the
 * spec gives rather than an empty field.
 */
export function DealMembership({
  membership,
}: {
  membership: MembershipTerms | null
}) {
  const price =
    membership?.price != null && membership.price > 0 ? membership.price : null
  const months = membership?.minimumCommitmentMonths ?? null

  return (
    <section aria-labelledby="membership-heading" className="space-y-3">
      <h2
        id="membership-heading"
        className="font-display text-xl font-bold tracking-tight text-text-primary"
      >
        Membership
      </h2>
      <p className="text-text-secondary">This is a member price.</p>

      {(price != null || months != null) && (
        <dl className="divide-y divide-border-default rounded-xl border border-border-default text-sm">
          {price != null && (
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="text-text-muted">Membership fee</dt>
              <dd className="font-semibold tabular-nums text-text-primary">
                {fee(price, membership?.billingPeriod ?? null)}
              </dd>
            </div>
          )}
          {months != null && (
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="text-text-muted">Minimum commitment</dt>
              <dd className="tabular-nums text-text-primary">
                {/* 13 live monthly plans state 0 months: no minimum, not "0 months". */}
                {months > 0
                  ? `${months} month${months === 1 ? '' : 's'}`
                  : 'None'}
              </dd>
            </div>
          )}
        </dl>
      )}

      {price == null && (
        <p className="text-text-secondary">
          The clinic didn&apos;t publish the membership price. Ask when you
          book.
        </p>
      )}

      {membership && (
        <p className="text-sm text-text-muted">
          The plan&apos;s name comes with the clinic&apos;s details when you
          claim.
        </p>
      )}
    </section>
  )
}
