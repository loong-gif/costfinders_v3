import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { logSupabaseError } from '@/lib/logger'
import {
  buildCanonicalUrl,
  OG_IMAGE,
  SITE_CONFIG,
  truncate,
} from '@/lib/seo/metadata'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ListingRequestForm } from './requestForm'

/**
 * Add, removal, correction and disputed-price requests for a business.
 *
 * Since business accounts are not open (2026-09-23) this is also where a clinic asks to be added:
 * every "list your medspa" entry point lands here with ?type=add. The owner dashboard's
 * "Request a correction" arrives as ?type=correct&business=<business_id>.
 *
 * The 419 businesses on this site were collected from public listings; none of them
 * opted in, and until now there was no route to ask for a removal or a correction. The
 * provider page carried no affordance, no admin action could hide a listing, and the only
 * published contact was an address buried in the terms.
 */

export const metadata: Metadata = {
  title: 'Request a Listing Change',
  description: truncate(
    'Ask us to add your medspa to CostFinders, correct or remove your listing, or fix a price we show for you.',
  ),
  alternates: { canonical: buildCanonicalUrl('/business/listing-request') },
  openGraph: {
    title: 'Request a Listing Change',
    description:
      'Ask us to add your medspa, correct or remove your listing, or fix a price we show.',
    url: buildCanonicalUrl('/business/listing-request'),
    siteName: SITE_CONFIG.name,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
}

interface ListingRequestPageProps {
  searchParams: Promise<{ type?: string; business?: string; url?: string }>
}

export default async function ListingRequestPage({
  searchParams,
}: ListingRequestPageProps) {
  const { type, business, url } = await searchParams

  // ?business= is a business_id from our own links (the owner dashboard's "Request a
  // correction"); resolve it to the name the form shows. Read with the visitor's session: only
  // the business's approved owner, an admin or someone who claimed it may read its name (RLS,
  // 20260924050001). Anyone else gets no prefill, so the URL is not a business_id -> name lookup.
  // A lookup failure only loses the prefill, never the form.
  const businessId =
    business && /^\d+$/.test(business) ? Number(business) : null
  let listed: { name: string | null } | null = null
  if (businessId) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('master_business_info')
      .select('name')
      .eq('business_id', businessId)
      .maybeSingle()
    // 42501 is the expected answer for a visitor who may not read this business (signed out,
    // or signed in without a claim on it); it is not an error worth an alert.
    if (error && error.code !== '42501') {
      logSupabaseError('ListingRequestPage', error, { businessId })
    }
    listed = data
  }

  return (
    <main className="min-h-screen bg-bg-primary pt-20 pb-20 md:pb-16 px-4 sm:px-6 lg:px-8">
      {/* py-8 as on /how-it-works and the legal pages, the other pages without a breadcrumb:
          without it the H1 sat 16px under the fixed header (device matrix, 2026-09-28). */}
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
          Request a listing change
        </h1>

        {/* States the provenance plainly. A business owner arriving here angry is owed the
            explanation before the form, not after it. */}
        <p className="mt-3 text-text-secondary">
          CostFinders builds its listings from publicly available business
          information and advertised prices. We didn't ask you first. If you
          want your business added, removed or corrected, or a price fixed, this
          form is the way to reach us.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          A person reviews every request and we'll email you what we did. We
          don't publish a turnaround time because we haven't committed to one.
        </p>

        <Card padding="none" className="mt-8 p-6 sm:p-8">
          <ListingRequestForm
            defaultType={type === 'correct' ? 'correction' : type}
            defaultBusinessName={listed?.name ?? undefined}
            businessId={listed && businessId ? businessId : undefined}
            defaultPageUrl={url}
          />
        </Card>
      </div>
    </main>
  )
}
