'use client'

import { Storefront } from '@phosphor-icons/react'
import Link from 'next/link'
import { AuthenticatedDashboardLayout } from '@/components/layout/authenticatedDashboardLayout'
import { BusinessDashboardSidebar } from '@/components/layout/businessDashboardSidebar'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'

/**
 * The dashboard opens only for an approved owner with a linked business.
 *
 * Every other state — no business linked, claim not submitted, under review, rejected — used to
 * get its own screen, each pointing into the claim-your-listing flow. That flow never reached
 * the admin review queue, and business accounts are not open at launch (owner decision,
 * 2026-09-23), so all of them now get one honest screen and a way to ask.
 */
export default function BusinessDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { state } = useBusinessAuth()
  const owner = state.owner
  const ready = !state.isLoading && state.isAuthenticated
  const approved =
    Boolean(owner?.businessId) && owner?.claimStatus === 'approved'

  if (ready && !approved) {
    return (
      <main className="min-h-screen bg-bg-base flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-bg-surface border border-border-accent">
            <Storefront
              size={40}
              weight="light"
              className="text-text-secondary"
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2 tracking-tight">
              Business accounts are not open yet
            </h1>
            <p className="text-text-secondary">
              If this is your clinic, request a listing change and we&apos;ll
              contact you.
            </p>
          </div>
          <Link
            href="/business/listing-request?type=add"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Request a listing change
          </Link>
          {owner?.email && (
            <p className="text-xs text-text-muted">
              Signed in as {owner.email}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <AuthenticatedDashboardLayout
      sidebar={<BusinessDashboardSidebar />}
      isLoading={state.isLoading}
      isAuthenticated={state.isAuthenticated && approved}
      // No ?signin=required: this redirect runs when the context flips to signed out, and the
      // usual cause is the owner pressing Sign out. src/proxy.ts still adds the parameter for a
      // signed-out visit to a dashboard URL, which is the case the dialog is for.
      redirectPath="/business"
    >
      {children}
    </AuthenticatedDashboardLayout>
  )
}
