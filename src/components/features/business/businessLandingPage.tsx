'use client'

import {
  ArrowRight,
  EnvelopeSimple,
  Storefront,
  Tag,
  UserCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { OfferRow } from '@/components/features/offerRow'
import { MagicLinkButton } from '@/components/patterns/magicLinkButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { HomepageCounts } from '@/lib/data/homepage'
import type { LeanOffer } from '@/types/deal'

/**
 * The page says what is true at launch and nothing more (2026-09-23).
 *
 * Gone: "Find my business" and the claim search (a finished claim never reached admin review,
 * and business accounts are not open), "trusted provider" (no badge exists), "qualified leads"
 * and "ready-to-book clients" (nothing qualifies a lead), "set your own pricing and packages"
 * (an owner-created deal can never go live), and the "After you claim your profile" card, which
 * showed what a CUSTOMER sees after claiming a deal, not anything an owner's claim changes.
 */
const howItWorks = [
  {
    icon: Tag,
    title: 'Your advertised offers are already listed',
    description:
      'We collect advertised prices from medspa websites and public business listings. Customers see the offer and the price, and your clinic’s name stays hidden until they claim it.',
  },
  {
    icon: EnvelopeSimple,
    title: 'A customer claims one of your deals',
    description:
      'When a customer claims one, our team passes their name and contact details to you by phone or through your website.',
  },
  {
    icon: Storefront,
    title: 'Business accounts are coming',
    description:
      'Business accounts with a lead inbox are coming. Until then, request a listing change to add your clinic or correct what we show.',
  },
]

const LISTING_REQUEST = '/business/listing-request'

interface BusinessLandingPageProps {
  counts: HomepageCounts
  /** A real offer as consumers see it, provider hidden. Null on an empty corpus. */
  example: LeanOffer | null
}

export function BusinessLandingPage({
  counts,
  example,
}: BusinessLandingPageProps) {
  const { state: authState, signIn, sendMagicLink } = useBusinessAuth()

  // Sign-in for the existing owner
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signInError, setSignInError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // A signed-out visit to /business/dashboard/* lands here with ?signin=required (src/proxy.ts
  // and the dashboard layout). It used to land with no prompt at all. Read from location, not
  // useSearchParams, so this ISR page needs no Suspense boundary.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('signin')) {
      setIsSignInOpen(true)
    }
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInError(null)
    setIsSigningIn(true)
    try {
      await signIn(email, password)
      setIsSignInOpen(false)
      setPassword('')
    } catch (error) {
      setSignInError(
        error instanceof Error
          ? error.message
          : 'Email or password is incorrect',
      )
    } finally {
      setIsSigningIn(false)
    }
  }

  const owner = authState.owner
  const isApprovedOwner =
    Boolean(owner?.businessId) && owner?.claimStatus === 'approved'

  return (
    <main className="pt-16">
      <section className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                For medspa owners
              </p>
              {/* MASTER.md's 0.95 hero leading from sm up. At 320 the headline runs three lines
                  and "may" hung its y into "listed"; 1.05 clears it. text-balance stops "here"
                  sitting alone at 1024-1194 (device matrix, 2026-09-28). */}
              <h1 className="mt-3 font-display text-5xl sm:text-6xl font-bold leading-[1.05] sm:leading-[0.95] tracking-[-0.03em] text-balance text-text-primary">
                Your offers may already be listed here
              </h1>
              <p className="mt-6 max-w-xl text-lg text-text-secondary">
                CostFinders shows advertised medspa prices so people can compare
                them before they book. If something about your listing is wrong
                or missing, tell us.
              </p>

              <div className="mt-8">
                <Link
                  href={LISTING_REQUEST}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-accent text-base font-semibold text-white hover:bg-accent-hover transition-colors"
                >
                  Request a listing change
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </Link>
              </div>

              {/* The existing owner's way in */}
              {!authState.isLoading && (
                <div className="mt-8 max-w-md">
                  {authState.isAuthenticated ? (
                    <div className="flex items-start gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
                      <UserCircle
                        size={20}
                        weight="light"
                        className="text-text-muted mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          Signed in as {owner?.email ?? 'your business account'}
                        </p>
                        {isApprovedOwner ? (
                          <Link
                            href="/business/dashboard"
                            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
                          >
                            Go to your dashboard
                            <ArrowRight size={14} weight="bold" />
                          </Link>
                        ) : (
                          <p className="text-sm text-text-secondary">
                            Business accounts are not open yet. Request a
                            listing change and we&apos;ll contact you.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Already have a business account?{' '}
                      <button
                        type="button"
                        onClick={() => setIsSignInOpen(true)}
                        className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover transition-colors cursor-pointer"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            {example && (
              <div className="rounded-2xl bg-bg-surface p-5 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  How a deal looks to customers
                </p>
                {/* The row a shopper sees in a list, as it is: no per-deal "name hidden" strip,
                    which browse replaced with one line above the whole list. */}
                <div className="mt-3">
                  <OfferRow offer={example} />
                </div>
                <p className="mt-4 text-sm text-text-secondary">
                  A real offer from the site. The provider&apos;s name, address
                  and contact details stay hidden until a signed-in customer
                  claims the deal.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Counts — derived on the server from the same corpus as the homepage. */}
      <section className="w-full border-y border-border-default py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                value: counts.deals.toLocaleString('en-US'),
                label: 'Advertised deals',
              },
              {
                value: counts.providers.toLocaleString('en-US'),
                label: 'Providers with prices listed',
              },
              { value: counts.cities.toLocaleString('en-US'), label: 'Cities' },
              { value: 'Free', label: 'For listed businesses' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <dt className="text-sm text-text-secondary">{stat.label}</dt>
                <dd className="order-first font-display text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            How it works today
          </h2>

          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {howItWorks.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-border-default bg-bg-elevated p-6"
              >
                <step.icon
                  size={24}
                  weight="bold"
                  className="text-text-muted"
                />
                <h3 className="mt-4 font-display font-semibold text-lg text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom band — the site's one ink band */}
      <section className="w-full bg-bg-inverted py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-on-dark">
            Want your clinic added or corrected?
          </h2>
          <p className="mt-3 text-lg text-text-on-dark-muted max-w-lg">
            A person reviews every listing request.
          </p>
          <Link
            href={LISTING_REQUEST}
            className="mt-8 inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-bg-base text-base font-semibold text-text-primary hover:bg-bg-surface transition-colors"
          >
            Request a listing change
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Modal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        title="Sign in to your business account"
        size="sm"
      >
        <form onSubmit={handleSignIn} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isSigningIn}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isSigningIn}
            required
          />

          {signInError && (
            <p
              role="alert"
              className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
            >
              {signInError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSigningIn}
            disabled={isSigningIn}
          >
            Sign in
          </Button>
        </form>

        {/* Passwordless path. The link only establishes a session — dashboard
            access is still the business_profiles row, checked by src/proxy.ts. */}
        <div className="mt-6 pt-6 border-t border-border-default">
          <MagicLinkButton
            email={email}
            sendAction={sendMagicLink}
            disabled={isSigningIn}
          />
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          No business account? They are not open yet.{' '}
          <Link
            href={`${LISTING_REQUEST}?type=add`}
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Request a listing change
          </Link>
        </p>
      </Modal>
    </main>
  )
}
