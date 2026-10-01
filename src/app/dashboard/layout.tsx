'use client'

import { useEffect, useState } from 'react'
import { AuthenticatedDashboardLayout } from '@/components/layout/authenticatedDashboardLayout'
import { DashboardSidebar } from '@/components/layout/dashboardSidebar'
import { useAuth } from '@/lib/context/authContext'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { state } = useAuth()
  const userId = state.user?.id

  // Messaging works only with a clinic that has an owner account, which is almost none of
  // them, so the menu item shows only to someone who already has a conversation. One HEAD
  // count, once per sign-in; RLS limits conversations to their participants. The page itself
  // stays reachable by URL with its honest empty state.
  const [hasConversations, setHasConversations] = useState(false)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    createSupabaseBrowserClient()
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('consumer_id', userId)
      .then(({ count, error }) => {
        if (error) console.warn('dashboard: conversation count failed', error)
        if (!cancelled) setHasConversations((count ?? 0) > 0)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <AuthenticatedDashboardLayout
      sidebar={<DashboardSidebar showMessages={hasConversations} />}
      isLoading={state.isLoading}
      isAuthenticated={state.isAuthenticated}
      redirectPath="/"
    >
      {children}
    </AuthenticatedDashboardLayout>
  )
}
