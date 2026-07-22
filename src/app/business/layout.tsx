import type { ReactNode } from 'react'
import { BusinessAppShell } from '@/components/layout/businessAppShell'
import { isSupabaseConfigured } from '@/lib/supabase-config'

interface BusinessLayoutProps {
  children: ReactNode
}

export default function BusinessLayout({ children }: BusinessLayoutProps) {
  if (!isSupabaseConfigured) {
    return children
  }

  return <BusinessAppShell>{children}</BusinessAppShell>
}
