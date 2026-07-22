import { ConsumerAppShell } from '@/components/layout/consumerAppShell'
import { isSupabaseConfigured } from '@/lib/supabase-config'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return children
  }

  return <ConsumerAppShell>{children}</ConsumerAppShell>
}
