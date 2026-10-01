'use client'

import { SpinnerGap, Warning } from '@phosphor-icons/react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { safeNextPath, signInHomeFor } from '@/lib/siteUrl'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

/**
 * Finishes an implicit-flow sign-in, which no server route can do.
 *
 * Supabase's implicit flow returns the session in the URL FRAGMENT
 * (`#access_token=…&refresh_token=…`). A fragment is never transmitted to the server, so
 * /auth/callback cannot see it — it used to find no `?code=`, conclude failure, and bounce to
 * `/?auth_error=true` while a perfectly good session sat unread in the URL. Verified live
 * against a real magic link.
 *
 * The fragment survives the redirect from /auth/callback because this URL carries none of its
 * own, so by the time this component mounts the tokens are still in `window.location.hash`.
 */

const HASH_TOKEN_KEYS = ['access_token', 'refresh_token'] as const

type Phase = 'working' | 'failed'

function AuthCompleteContent() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('working')
  const [signInHome, setSignInHome] = useState('/?signin=required')

  useEffect(() => {
    const next = safeNextPath(searchParams.get('next'))
    setSignInHome(signInHomeFor(next))

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : ''
    const params = new URLSearchParams(hash)

    const accessToken = params.get(HASH_TOKEN_KEYS[0])
    const refreshToken = params.get(HASH_TOKEN_KEYS[1])

    if (!(accessToken && refreshToken)) {
      // Deliberately NOT rendering `error_description` from the fragment. It is
      // attacker-controlled: anyone can send
      // `/auth/complete#error_description=Your+account+is+suspended,+call+555-0100` and that
      // sentence would appear on our own domain under our own heading — a phishing lure we
      // would be hosting. React escapes the markup, so this is not XSS; it is worse in the way
      // that matters, because the text is meant to be believed. It also surfaced raw Supabase
      // internals ("Invalid JWT structure") that MESSAGING-STYLE-GUIDE.md would reject.
      // The console keeps the detail for debugging; the page states the overwhelmingly common
      // cause and offers the one useful action.
      console.warn('auth/complete: no session in fragment', {
        error: params.get('error'),
        errorDescription: params.get('error_description'),
      })
      setPhase('failed')
      return
    }

    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (cancelled) return
        if (error) {
          console.warn('auth/complete: setSession failed', error.message)
          setPhase('failed')
          return
        }
        // A HARD navigation, deliberately, for two reasons. It drops the token fragment from
        // the address bar and history in the same step, and it makes the server re-render with
        // the session cookie the client just wrote — a client-side router.replace() would leave
        // Server Components rendering the signed-out view.
        //
        // Do NOT reintroduce `history.replaceState()` to clear the hash first: it desyncs the
        // App Router, after which router.replace() silently no-ops and this page sits on
        // "Signing you in…" forever with a valid session. Observed exactly that.
        window.location.replace(next)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Without this, a throw (bad env, network) leaves the spinner up permanently.
        console.warn('auth/complete: setSession threw', error)
        setPhase('failed')
      })

    return () => {
      cancelled = true
    }
  }, [searchParams])

  if (phase === 'working') {
    return (
      <output className="flex flex-col items-center gap-3 text-text-secondary">
        <SpinnerGap size={28} className="animate-spin" aria-hidden="true" />
        <span>Signing you in…</span>
      </output>
    )
  }

  return (
    <Card className="max-w-md w-full p-8 text-center">
      <Warning
        size={32}
        weight="light"
        className="text-warning mx-auto mb-4"
        aria-hidden="true"
      />
      <h1 className="font-display text-xl font-bold tracking-tight text-text-primary mb-2">
        We couldn't finish signing you in
      </h1>
      <p className="text-text-secondary mb-6" role="alert">
        That sign-in link has already been used or has expired. Sign-in links
        work once, and only for a short time.
      </p>
      <Link href={signInHome}>
        <Button size="lg">Request a new link</Button>
      </Link>
    </Card>
  )
}

export default function AuthCompletePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* useSearchParams needs a Suspense boundary to keep this route prerenderable. */}
      <Suspense
        fallback={
          <output className="text-text-secondary">Signing you in…</output>
        }
      >
        <AuthCompleteContent />
      </Suspense>
    </main>
  )
}
