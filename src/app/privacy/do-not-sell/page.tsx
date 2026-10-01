import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactEmail } from '@/app/legal/legalShell'
import { Card } from '@/components/ui/card'
import { buildCanonicalUrl, OG_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata'
import { DoNotSellForm } from './requestForm'

/**
 * The CCPA opt-out link the footer carries. No business pays CostFinders today, so nothing is
 * sold; the page says so and records the request for the day that changes.
 */

const TITLE = 'Do Not Sell or Share My Personal Information'

export const metadata: Metadata = {
  title: TITLE,
  description:
    'Ask CostFinders not to sell or share your personal information, as California law allows.',
  alternates: { canonical: buildCanonicalUrl('/privacy/do-not-sell') },
  openGraph: {
    images: [OG_IMAGE],
    title: TITLE,
    url: buildCanonicalUrl('/privacy/do-not-sell'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

export default function DoNotSellPage() {
  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
          {TITLE}
        </h1>
        <div className="mt-4 space-y-3 text-text-secondary leading-relaxed">
          <p>
            CostFinders does not sell your personal information, and no business
            pays us. We pass your name and contact details to a provider only
            when you claim one of its deals, and we do not share personal
            information for advertising.
          </p>
          <p>
            CostFinders may be compensated by businesses for referrals in the
            future. If that starts, passing your details to a provider could
            count as a sale under California law. You can opt out now, and your
            request will apply then.
          </p>
          <p>
            Opting out means we will not pass your details to a provider, so we
            cannot relay a claim for you. If you claim a deal anyway, we treat
            that as your instruction to pass your details to that provider for
            that claim.
          </p>
        </div>

        <Card padding="none" className="mt-8 p-6 sm:p-8">
          <DoNotSellForm />
        </Card>

        <p className="mt-6 text-sm text-text-secondary">
          An authorized agent can email us at <ContactEmail /> with your signed
          permission. Your other rights are in our{' '}
          <Link
            href="/privacy#california"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
