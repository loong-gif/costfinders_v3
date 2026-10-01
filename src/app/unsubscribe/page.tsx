import {
  CheckCircle,
  EnvelopeSimple,
  Warning,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Email opt-out landing page.
 *
 * Every transactional email footer has linked here since the templates shipped, and this
 * route did not exist — recipients who clicked Unsubscribe got a 404, while
 * src/app/privacy/page.tsx told them the link works.
 *
 * The page never writes anything on GET. A mailbox scanner, a link prefetch or a
 * corporate URL-rewriter fetching this page must not silently opt someone out, so the
 * write lives behind the POST in ./confirm/route.ts.
 */

export const metadata: Metadata = {
  title: 'Unsubscribe',
  // Not a page we want in the index, and it carries a token in the URL.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string; state?: string }>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const { token: rawToken, state } = await searchParams
  const linkToken = rawToken && UUID_RE.test(rawToken) ? rawToken : undefined

  // No token in the link (an older email, or a hand-typed URL): if they are signed in we
  // can still act, using their own token rather than anything supplied by the caller.
  let ownToken: string | undefined
  let signedIn = false
  if (!linkToken) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      signedIn = true
      const { data } = await supabase
        .from('profiles')
        .select('unsubscribe_token')
        .eq('id', user.id)
        .single()
      ownToken = (data as { unsubscribe_token?: string } | null)
        ?.unsubscribe_token
    }
  }

  const token = linkToken ?? ownToken

  return (
    <main className="min-h-screen bg-bg-primary pt-20 pb-20 md:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card padding="none" className="p-6 sm:p-8">
          {state === 'done' ? (
            <>
              <div className="w-11 h-11 rounded-xl bg-savings-bg flex items-center justify-center mb-4">
                <CheckCircle
                  size={22}
                  weight="duotone"
                  className="text-savings"
                />
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-2">
                You're unsubscribed
              </h1>
              <p className="text-sm text-text-secondary mb-4">
                We've turned off email notifications for your account. You won't
                get claim updates by email.
              </p>
              <p className="text-sm text-text-secondary mb-6">
                We'll still send the confirmation for a claim you make, because
                it carries the clinic's contact details, and email about account
                security or anything you ask us for, such as a password reset.
                You can turn notifications back on any time in your settings.
              </p>
              <Link
                href="/dashboard/settings"
                className="text-sm font-medium text-accent underline hover:text-accent-hover"
              >
                Go to notification settings
              </Link>
            </>
          ) : state === 'invalid' ? (
            <>
              <div className="w-11 h-11 rounded-xl bg-warning-bg flex items-center justify-center mb-4">
                <Warning size={22} weight="duotone" className="text-warning" />
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-2">
                That link didn't work
              </h1>
              <p className="text-sm text-text-secondary mb-6">
                The unsubscribe link may have been broken by your email client.
                Sign in and turn off email notifications in your settings
                instead &mdash; that has exactly the same effect.
              </p>
              <Link
                href="/dashboard/settings"
                className="text-sm font-medium text-accent underline hover:text-accent-hover"
              >
                Sign in and open settings
              </Link>
            </>
          ) : token ? (
            <>
              <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center mb-4">
                <EnvelopeSimple
                  size={22}
                  weight="duotone"
                  className="text-accent"
                />
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-2">
                Turn off email notifications
              </h1>
              <p className="text-sm text-text-secondary mb-6">
                We'll stop sending claim updates to this address. Claim
                confirmations, account security emails and anything you request
                directly still come through.
              </p>
              {/* A plain form post — no JavaScript needed, so it works from any
                  mail client's in-app browser. */}
              <form action="/unsubscribe/confirm" method="post">
                <input type="hidden" name="token" value={token} />
                <Button type="submit" size="lg" className="w-full">
                  Unsubscribe
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center mb-4">
                <EnvelopeSimple
                  size={22}
                  weight="duotone"
                  className="text-accent"
                />
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-2">
                Manage email notifications
              </h1>
              <p className="text-sm text-text-secondary mb-6">
                {signedIn
                  ? "We couldn't find your notification settings. Open your settings to turn email off."
                  : "This link doesn't say which account it's for, so we can't turn email off from here. Sign in and switch off email notifications in your settings. It takes effect straight away."}
              </p>
              <Link
                href="/dashboard/settings"
                className="text-sm font-medium text-accent underline hover:text-accent-hover"
              >
                {signedIn ? 'Open settings' : 'Sign in and open settings'}
              </Link>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
