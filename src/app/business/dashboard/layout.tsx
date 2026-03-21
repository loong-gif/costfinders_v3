'use client'

import {
  ArrowLeft,
  ClockCountdown,
  Storefront,
  XCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AuthenticatedDashboardLayout } from '@/components/layout/authenticatedDashboardLayout'
import { BusinessDashboardSidebar } from '@/components/layout/businessDashboardSidebar'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

export default function BusinessDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { state } = useBusinessAuth()

  // Redirect if no businessId linked
  useEffect(() => {
    if (!state.isLoading && state.isAuthenticated && !state.owner?.businessId) {
      router.push('/business')
    }
  }, [state.isLoading, state.isAuthenticated, state.owner?.businessId, router])

  const claimStatus = state.owner?.claimStatus

  // Pending approval — show interstitial
  if (
    !state.isLoading &&
    state.isAuthenticated &&
    state.owner?.businessId &&
    claimStatus === 'pending'
  ) {
    return (
      <main className="min-h-screen bg-[#e8ddd0] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-800/8 border border-amber-800/15">
            <ClockCountdown
              size={40}
              weight="light"
              className="text-amber-800"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#451a03] mb-2">
              Claim Under Review
            </h1>
            <p className="text-[#78350f]">
              Your business claim is being reviewed by our team. This usually
              takes 1–2 business days.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-800/5 border border-amber-800/15">
            <div className="flex items-center gap-3">
              <Storefront
                size={24}
                weight="light"
                className="text-amber-800 flex-shrink-0"
              />
              <p className="text-sm text-[#78350f] text-left">
                We&apos;ll notify you by email once your claim is approved and
                your dashboard is ready.
              </p>
            </div>
          </div>
          <Link href="/business">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft size={16} weight="light" />
              Back to Business Home
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  // Rejected — show message with option to retry
  if (
    !state.isLoading &&
    state.isAuthenticated &&
    state.owner?.businessId &&
    claimStatus === 'rejected'
  ) {
    return (
      <main className="min-h-screen bg-[#e8ddd0] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-100 border border-red-200">
            <XCircle size={40} weight="light" className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#451a03] mb-2">
              Claim Not Approved
            </h1>
            <p className="text-[#78350f]">
              Unfortunately, we weren&apos;t able to verify your ownership of
              this business. Please contact support if you believe this is an
              error.
            </p>
          </div>
          <Link href="/business">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft size={16} weight="light" />
              Back to Business Home
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  // Approved or no claim status — render full dashboard
  const effectivelyAuthenticated =
    state.isAuthenticated &&
    !!state.owner?.businessId &&
    claimStatus === 'approved'

  return (
    <AuthenticatedDashboardLayout
      sidebar={<BusinessDashboardSidebar />}
      isLoading={state.isLoading}
      isAuthenticated={effectivelyAuthenticated}
      redirectPath="/business"
    >
      {children}
    </AuthenticatedDashboardLayout>
  )
}
