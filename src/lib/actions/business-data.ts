'use server'

import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessRow {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  website: string | null
  review_count: number | null
  score: number | null
  category: string | null
  facebook_url: string | null
  instagram_url: string | null
  phone: string | null
  created_at: string | null
  updated_at: string | null
}

interface SingleBusinessResult {
  success: boolean
  error?: string
  business?: BusinessRow
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get a single business by ID.
 */
export async function getBusinessByIdAction(
  businessId: number,
): Promise<SingleBusinessResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('master_business_info')
      .select('*')
      .eq('business_id', businessId)
      .single()

    if (error) {
      logSupabaseError('getBusinessByIdAction', error, { businessId })
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Business not found.' }
      }
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load this business."),
      }
    }

    return { success: true, business: data as BusinessRow }
  } catch (error) {
    logger.error('getBusinessByIdAction failed', {
      action: 'getBusinessByIdAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * WHAT USED TO BE HERE
 *
 * createBusinessAction and importGooglePlaceAction, which inserted into
 * `master_business_info` as the signed-in user. That table's only INSERT policy is
 * `WITH CHECK (private.is_admin())`, so both were a hard 42501 for every non-admin — masked
 * as "check your details and try again" on /business/create and "We couldn't add {name}" in
 * the search modal. The Google path spent a paid Places lookup before failing, and the error
 * invited the user to spend another one.
 *
 * Deleted rather than repaired: every exported async function in a 'use server' module is a
 * public HTTP endpoint whether or not a client imports it, and repairing these means granting
 * ordinary users INSERT on the business directory the ingestion pipeline owns. A business that
 * is not in our directory now goes to /business/listing-request, which writes to a table built
 * for that and notifies a human.
 *
 * searchBusinessesAction and updateBusinessAction went the same way on 2026-09-24. Search only
 * fed the claim-your-listing modal, hidden until business onboarding exists. The update matched
 * zero rows on every call (master_business_info has no UPDATE policy) and the profile page that
 * called it is now read-only, with corrections going through the listing request form.
 */
