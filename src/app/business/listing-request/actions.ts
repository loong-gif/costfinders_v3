'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { sendOpsNotice } from '@/lib/email/opsInbox'
import { logger, logSupabaseError } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Records a listing add, removal, correction or disputed-price request.
 *
 * 419 businesses are published on indexable provider pages without ever opting in, and
 * until now nothing in the product could receive a request to be removed or corrected —
 * no column marked a listing suppressed, no admin action hid one, and the provider page
 * carried no affordance at all. A correction demand arrived as a letter.
 *
 * This is a public endpoint by design (a business owner has no account), so validation
 * and the rate limit here ARE the trust boundary — there is no session to lean on.
 */

// 'add' needs migration 20260924030001, which widens the table's CHECK to accept it.
const REQUEST_TYPES = [
  'add',
  'removal',
  'correction',
  'price_dispute',
  'other',
] as const

export type ListingRequestType = (typeof REQUEST_TYPES)[number]

export interface ListingRequestInput {
  requestType: string
  businessName: string
  /** master_business_info.business_id, when the request came from a known listing. */
  businessId?: number
  contactName: string
  contactEmail: string
  contactRole?: string
  pageUrl?: string
  details: string
}

export interface ListingRequestResult {
  success: boolean
  error?: string
}

/** Field caps. Generous for a human, small enough that the table cannot be used as storage. */
const MAX = {
  businessName: 200,
  contactName: 120,
  contactEmail: 254,
  contactRole: 120,
  pageUrl: 500,
  details: 4000,
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: string | undefined, max: number): string {
  // Same stripHtml intent as src/lib/actions/profile.ts: this text is read back by an
  // admin screen, so it must not carry markup.
  return (value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
}

export async function submitListingRequestAction(
  input: ListingRequestInput,
): Promise<ListingRequestResult> {
  try {
    const h = await headers()
    // ponytail: duplicated from rate-limit.ts's private callerIp(). Exporting it there is
    // the cleanup; that file belongs to another change in flight.
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip')?.trim() ||
      'unknown'

    const limit = rateLimit(`listing-request:${ip}`, 5, 10 * 60_000)
    if (!limit.allowed) {
      return {
        success: false,
        error: "You've sent several requests already. Please try again later.",
      }
    }

    const requestType = REQUEST_TYPES.includes(
      input.requestType as ListingRequestType,
    )
      ? (input.requestType as ListingRequestType)
      : null

    const businessName = clean(input.businessName, MAX.businessName)
    const contactName = clean(input.contactName, MAX.contactName)
    const contactEmail = clean(input.contactEmail, MAX.contactEmail)
    const details = clean(input.details, MAX.details)

    if (!requestType) {
      return { success: false, error: 'Please choose what you need.' }
    }
    if (!businessName) {
      return { success: false, error: 'Please enter your business name.' }
    }
    if (!contactName) {
      return { success: false, error: 'Please enter your name.' }
    }
    if (!EMAIL_RE.test(contactEmail)) {
      return { success: false, error: 'Please enter a valid email address.' }
    }
    if (details.length < 10) {
      return {
        success: false,
        error: 'Please tell us a little more so we can act on this.',
      }
    }

    // A client-supplied reference, so only a plausible id is kept. A forged one that is not a
    // real business fails the foreign key and only loses the forger's own request.
    const businessId =
      Number.isSafeInteger(input.businessId) && (input.businessId ?? 0) > 0
        ? input.businessId
        : null

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.from('listing_requests').insert({
      request_type: requestType,
      business_id: businessId,
      business_name: businessName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_role: clean(input.contactRole, MAX.contactRole) || null,
      page_url: clean(input.pageUrl, MAX.pageUrl) || null,
      details,
    })

    if (error) {
      logSupabaseError('submitListingRequestAction', error)
      return {
        success: false,
        error: "We couldn't record your request. Please try again.",
      }
    }

    // The table is the durable record, but no admin screen reads it yet, so without this
    // the request sits where nobody looks. Best-effort: a failed notice must not lose a
    // request that is already saved.
    // after(), not a floating promise with a `.catch()` that can never fire — see sendEmail's
    // docblock. Runs after the response, so it cannot affect what the submitter is told.
    after(() =>
      notifyOps({
        requestType,
        businessName: businessId
          ? `${businessName} (business_id ${businessId})`
          : businessName,
        contactName,
        contactEmail,
        pageUrl: clean(input.pageUrl, MAX.pageUrl),
        details,
      }),
    )

    return { success: true }
  } catch (error) {
    logger.error('submitListingRequestAction failed', {
      action: 'submitListingRequestAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function notifyOps(fields: {
  requestType: string
  businessName: string
  contactName: string
  contactEmail: string
  pageUrl: string
  details: string
}): Promise<void> {
  const result = await sendOpsNotice(
    `Listing request (${fields.requestType}): ${fields.businessName}`,
    'A business submitted a listing request. It is saved in public.listing_requests.',
    [
      ['Type', fields.requestType],
      ['Business', fields.businessName],
      ['Contact', `${fields.contactName} <${fields.contactEmail}>`],
      ['Page', fields.pageUrl || '(not given)'],
      ['Details', fields.details],
    ],
    'submitListingRequestAction',
  )

  // A second log line on purpose: sendEmail reports the provider's reason but cannot know
  // that the request itself is already recorded, which is what says whether anything is lost.
  if (!result.success) {
    logger.error('Listing request saved but the ops notice did not send', {
      action: 'submitListingRequestAction',
      error: result.error,
    })
  }
}
