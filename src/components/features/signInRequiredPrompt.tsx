'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { safeNextPath } from '@/lib/siteUrl'

const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)

/**
 * Opens the sign-in modal when the URL says `?signin=required`.
 *
 * src/proxy.ts sends a signed-out visitor who opens /dashboard/... here with
 * `?signin=required&next=<path>`, and /auth/complete's "Request a new link" sends
 * `?signin=required`. Nothing read either, so people landed on the homepage and nothing
 * happened. After a password sign-in this navigates to `next`; an emailed sign-in link carries
 * `next` through /auth/callback instead.
 */
export function SignInRequiredPrompt() {
  const params = useSearchParams()
  const router = useRouter()
  const signedIn = useRef(false)

  if (params.get('signin') !== 'required') return null

  const rawNext = params.get('next')
  const next = rawNext ? safeNextPath(rawNext) : undefined

  return (
    <AuthModal
      isOpen
      initialView="signIn"
      notice={
        next ? 'Sign in to open that page.' : 'Please sign in to continue.'
      }
      returnTo={next}
      // AuthModal calls onSuccess, then onClose. Closing without signing in just drops the
      // query string so a refresh doesn't reopen the modal.
      onSuccess={() => {
        signedIn.current = true
      }}
      onClose={() =>
        router.replace(signedIn.current && next ? next : '/', {
          scroll: false,
        })
      }
    />
  )
}
