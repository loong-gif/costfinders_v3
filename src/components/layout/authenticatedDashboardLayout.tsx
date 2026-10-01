'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DashboardHeader } from '@/components/layout/dashboardHeader'
import { PageHeader } from '@/components/patterns/pageHeader'
import { Skeleton } from '@/components/ui/skeleton'

export interface AuthenticatedDashboardLayoutProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  isLoading: boolean
  isAuthenticated: boolean
  redirectPath: string // where to redirect if not authenticated
}

/** Content padding shared by the real shell and its skeleton. The bottom value
 *  clears the mobile bottom nav *plus* the home indicator on notched phones.
 *  From md the left value is the 64px icon rail plus that breakpoint's gutter. It is
 *  restated after each `px-*`, because Tailwind emits `lg:px-8` after `md:pl-16` and the
 *  old single `md:pl-16` lost to it: content sat 32px under the rail from 1024px up. */
const mainPadding =
  'pt-20 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 px-4 sm:px-6 md:pl-22 lg:px-8 lg:pl-24'

/**
 * Placeholder that occupies the same grid as the loaded dashboard — fixed
 * header, icon rail, centred content column — so nothing shifts when the real
 * content arrives.
 */
function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-40 h-16 bg-bg-base/95 border-b border-border-default" />
      <div className="hidden md:block fixed left-0 top-16 bottom-0 w-16 bg-bg-base border-r border-border-default" />
      <main className={mainPadding}>
        <div
          className="max-w-6xl mx-auto py-6 space-y-4"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading your dashboard</span>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </main>
    </div>
  )
}

export function AuthenticatedDashboardLayout({
  children,
  sidebar,
  isLoading,
  isAuthenticated,
  redirectPath,
}: AuthenticatedDashboardLayoutProps) {
  const router = useRouter()

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectPath)
    }
  }, [isLoading, isAuthenticated, redirectPath, router])

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  // src/proxy.ts already turns signed-out visitors away, so reaching here means
  // the session expired or this account isn't set up for this dashboard. The
  // redirect above is running either way — say what happened and leave a real
  // link, because a blank screen here would be a dead end if it ever stalls.
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-text-primary">
            We couldn&apos;t open this dashboard
          </h1>
          <p className="text-text-secondary">
            Your session may have expired, or this account doesn&apos;t have
            access yet. Taking you back now.
          </p>
          <Link
            href={redirectPath}
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Continue
          </Link>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <DashboardHeader />
      {sidebar}
      {/* Main content with left padding for sidebar on desktop */}
      <main className={mainPadding}>
        <div className="max-w-6xl mx-auto py-6">
          <PageHeader />
          {children}
        </div>
      </main>
    </div>
  )
}
