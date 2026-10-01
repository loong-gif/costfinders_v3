'use client'

import {
  CheckCircle,
  Circle,
  ClipboardText,
  Heart,
  MagnifyingGlass,
  UserCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { ActiveClaimsSection } from '@/components/features/dashboard/activeClaimsSection'
import { DealsForYouSection } from '@/components/features/dashboard/dealsForYouSection'
import { SavedDealsRow } from '@/components/features/dashboard/savedDealsRow'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'

type SetupUser = {
  firstName?: string
  lastName?: string
  phone?: string
  locationCity?: string
} | null

/**
 * Each step names the concrete thing to add and what the user gets for it, so
 * the prompt is actionable rather than a bare completion percentage.
 */
function getSetupSteps(user: SetupUser) {
  return [
    {
      key: 'name',
      label: 'Add your name, which we pass to the clinic when you claim',
      done: Boolean(user?.firstName && user?.lastName),
    },
    {
      key: 'phone',
      label: 'Add a phone number, which we pass to the clinic when you claim',
      done: Boolean(user?.phone),
    },
    {
      key: 'city',
      label: 'Set your city to see deals near you',
      done: Boolean(user?.locationCity),
    },
  ]
}

function ProfileSetupCard({ user }: { user: SetupUser }) {
  const steps = getSetupSteps(user)
  const doneCount = steps.filter((s) => s.done).length

  if (doneCount === steps.length) return null

  return (
    <section className="rounded-2xl border border-border-default bg-bg-elevated p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-text-primary tracking-tight">
            Finish setting up your account
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {doneCount} of {steps.length} done. The claim form asks for your
            name and phone, so adding them here saves a step.
          </p>
        </div>
        <Link href="/dashboard/settings" className="shrink-0">
          <Button variant="secondary" size="md">
            <UserCircle size={18} weight="bold" />
            Complete profile
          </Button>
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2 text-sm">
            {step.done ? (
              <CheckCircle
                size={18}
                weight="fill"
                className="text-success shrink-0 mt-px"
              />
            ) : (
              <Circle
                size={18}
                weight="regular"
                className="text-text-muted shrink-0 mt-px"
              />
            )}
            <span
              className={
                step.done
                  ? 'text-text-muted line-through'
                  : 'text-text-secondary'
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function DashboardPage() {
  const { state } = useAuth()
  const user = state.user

  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : 'Welcome back'
  const isFullyVerified = user?.verificationStatus === 'fully_verified'

  return (
    <div className="space-y-8">
      {/* Section 1: Welcome bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          {greeting}
        </h1>
        {isFullyVerified && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success-bg text-success text-xs font-medium">
            <CheckCircle size={14} weight="fill" />
            Verified
          </span>
        )}
      </div>

      {/* Section 2: Actionable profile setup (replaces the bare progress bar) */}
      <ProfileSetupCard user={user} />

      {/* Section 3: Active claims progress */}
      <ActiveClaimsSection />

      {/* Section 4: Saved deals quick access */}
      <SavedDealsRow />

      {/* Section 5: Deals near you */}
      <DealsForYouSection />

      {/* Section 6: Quick actions */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/deals">
            <Button variant="primary" size="md">
              <MagnifyingGlass size={18} weight="bold" />
              Browse deals
            </Button>
          </Link>
          <Link href="/dashboard/claims">
            <Button variant="secondary" size="md">
              <ClipboardText size={18} weight="bold" />
              View claims
            </Button>
          </Link>
          <Link href="/dashboard/favorites">
            <Button variant="secondary" size="md">
              <Heart size={18} weight="bold" />
              Saved deals
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
