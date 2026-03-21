'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DashboardHeader } from '@/components/layout/dashboardHeader'
import { PageHeader } from '@/components/patterns/pageHeader'

export interface AuthenticatedDashboardLayoutProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  isLoading: boolean
  isAuthenticated: boolean
  redirectPath: string // where to redirect if not authenticated
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

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-amber-800"
            viewBox="0 0 24 24"
          >
            <title>Loading</title>
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[#78350f]">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render dashboard until authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <DashboardHeader />
      {sidebar}
      {/* Main content with left padding for sidebar on desktop */}
      <main className="md:pl-16 pt-20 pb-20 md:pb-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto py-6">
          <PageHeader />
          {children}
        </div>
      </main>
    </div>
  )
}
