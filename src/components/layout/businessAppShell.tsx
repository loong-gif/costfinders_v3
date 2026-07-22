'use client'

import { BusinessAuthProvider } from '@/lib/context/businessAuthContext'

export function BusinessAppShell({ children }: { children: React.ReactNode }) {
  return <BusinessAuthProvider>{children}</BusinessAuthProvider>
}
