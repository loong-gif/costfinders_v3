import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

/**
 * The claim-your-listing flow is hidden until business onboarding exists (owner decision,
 * 2026-09-23). A finished claim never reached the admin review queue, so nobody would have
 * approved it or sent the promised email. Old links land here and get the honest answer.
 *
 * The id is ignored on purpose: nothing is looked up, so a bad id no longer serves a
 * "not found" body with a 200.
 */
export const metadata: Metadata = {
  title: 'Business Accounts',
  robots: { index: false },
}

export default function ClaimBusinessPage() {
  return (
    <main className="min-h-screen bg-bg-primary pt-20 pb-12 px-4 sm:px-6">
      <div className="max-w-md mx-auto">
        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Business accounts are not open yet
          </h1>
          <p className="mt-3 text-text-secondary">
            If this is your clinic, request a listing change and we&apos;ll
            contact you.
          </p>
          <Link
            href="/business/listing-request?type=add"
            className="mt-6 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Request a listing change
          </Link>
        </Card>
      </div>
    </main>
  )
}
