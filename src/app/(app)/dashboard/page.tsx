'use client'

import {
  CheckCircle,
  ClipboardText,
  MagnifyingGlass,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { ActiveClaimsSection } from '@/components/features/dashboard/activeClaimsSection'
import { DealsForYouSection } from '@/components/features/dashboard/dealsForYouSection'
import { SavedDealsRow } from '@/components/features/dashboard/savedDealsRow'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'

function VerificationBadge({ status }: { status: string | undefined }) {
  switch (status) {
    case 'fully_verified':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/10 text-emerald-600 text-xs font-medium">
          <CheckCircle size={14} weight="fill" />
          Verified
        </div>
      )
    case 'email_verified':
    case 'phone_verified':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-800/8 text-amber-800 text-xs font-medium">
          <WarningCircle size={14} weight="fill" />
          Partially verified
        </div>
      )
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-400/10 text-red-600 text-xs font-medium">
          <WarningCircle size={14} weight="fill" />
          Unverified
        </div>
      )
  }
}

function getProfileCompletion(
  user: {
    firstName?: string
    lastName?: string
    phone?: string
    locationCity?: string
  } | null,
): number {
  if (!user) return 0
  const fields = [user.firstName, user.lastName, user.phone, user.locationCity]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}

export default function DashboardPage() {
  const { state } = useAuth()
  const user = state.user

  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : 'Welcome back'
  const profileCompletion = getProfileCompletion(user)
  const isProfileComplete = profileCompletion === 100
  const isFullyVerified = user?.verificationStatus === 'fully_verified'

  return (
    <div className="space-y-8">
      {/* Section 1: Welcome bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#451a03]">{greeting}</h1>
          <VerificationBadge status={user?.verificationStatus} />
        </div>

        {!isProfileComplete && (
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-2 text-sm text-[#78350f] hover:text-[#451a03] transition-colors">
              <div className="w-24 h-2 rounded-full bg-[#f2ebe2] overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-800 transition-all"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
              <span>{profileCompletion}% complete</span>
            </div>
          </Link>
        )}
      </div>

      {/* Section 2: Active claims progress */}
      <ActiveClaimsSection />

      {/* Section 3: Saved deals quick access */}
      <SavedDealsRow />

      {/* Section 4: Deals near you */}
      <DealsForYouSection />

      {/* Section 5: Quick actions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#451a03]">Quick actions</h2>
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
          {!isFullyVerified && (
            <Link href="/dashboard/settings">
              <Button variant="secondary" size="md">
                <UserCircle size={18} weight="bold" />
                Complete profile
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
