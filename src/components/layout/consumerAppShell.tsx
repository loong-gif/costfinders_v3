'use client'

import { GlobalHeader } from '@/components/layout/globalHeader'
import { AuthProvider } from '@/lib/context/authContext'
import { ClaimsProvider } from '@/lib/context/claimsContext'

export function ConsumerAppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClaimsProvider>
        <GlobalHeader />
        {children}
      </ClaimsProvider>
    </AuthProvider>
  )
}
