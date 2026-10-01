'use server'

import { revalidatePath } from 'next/cache'
import {
  flattenOffer,
  OFFER_GRAPH_JOIN,
  type OfferJoinedRow,
} from '@/lib/data/offers'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { OfferView } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What a business owner can actually persist about a deal.
 *
 * This used to carry service_name, service_category, unit_type, start_date, end_date and
 * min_unit. All six were columns on the denormalized `promo_offer_master` and all six are
 * gone; inserting them raised 42703, so a business could not publish a deal at all.
 *
 * They are NOT re-pointed at the new tables, and that is deliberate rather than lazy. The
 * catalogue columns now live in `clinic_services` / `clinic_promotions`, on which the
 * `authenticated` role holds SELECT only (see
 * supabase/migrations/20260909180002_revoke_offer_table_write_grants.sql). Letting an owner
 * form write `clinic_services` would also let one provider edit the shared service catalogue
 * every other provider's offers resolve their category and unit from.
 *
 * ponytail: the ceiling is therefore one line of free text plus prices. Giving owners a
 * category or an expiry back needs a DB-side path that writes the child rows under
 * service_role — an RPC or an ingestion step — not a widened grant.
 */
export interface DealInput {
  /**
   * The deal in the owner's own words. Lands in `promo_offer_master.offer_raw_text`, which is
   * also what flattenOffer() falls back to for the title when an offer has no items — and an
   * owner-created offer has none.
   */
  offer_raw_text: string
  regular_price?: number
  discount_price?: number
  discount_percent?: number
}

interface DealResult {
  success: boolean
  error?: string
  deal?: OfferView
}

interface DealsResult {
  success: boolean
  error?: string
  deals?: OfferView[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

async function verifyBusinessOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: number,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false as const, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('business_profiles')
    .select('business_id, claim_status')
    .eq('id', user.id)
    .single()

  if (profileError)
    logSupabaseError('verifyBusinessOwnership', profileError, {
      userId: user.id,
      businessId,
    })
  if (profileError || !profile) {
    return { authorized: false as const, error: 'Business profile not found.' }
  }

  if (profile.business_id !== businessId) {
    return {
      authorized: false as const,
      error: 'You do not own this business.',
    }
  }

  if (profile.claim_status !== 'approved') {
    return {
      authorized: false as const,
      error: 'Your business claim is not yet approved.',
    }
  }

  return { authorized: true as const, userId: user.id }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get all deals for a specific business.
 * Requires authentication and business ownership verification.
 */
export async function getDealsForBusinessAction(
  businessId: number,
): Promise<DealsResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const ownership = await verifyBusinessOwnership(supabase, businessId)
    if (!ownership.authorized) {
      return { success: false, error: ownership.error }
    }

    // The same joined select the consumer path uses, so the owner's own deal list shows the
    // resolved title, category and unit for its scraped offers. Deliberately NOT filtered by
    // is_active: this screen exists to show unpublished and delisted deals.
    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(`*, ${OFFER_GRAPH_JOIN}`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) {
      logSupabaseError('getDealsForBusinessAction', error, {
        businessId,
        userId: ownership.userId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your deals. Please try again.",
        ),
      }
    }

    return {
      success: true,
      deals: ((data ?? []) as unknown as OfferJoinedRow[]).map((row) =>
        flattenOffer({ ...row, master_business_info: null }),
      ),
    }
  } catch (error) {
    logger.error('getDealsForBusinessAction failed', {
      action: 'getDealsForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get a single deal by ID with ownership verification.
 */
export async function getDealByIdForBusinessAction(
  dealId: number,
  businessId: number,
): Promise<DealResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const ownership = await verifyBusinessOwnership(supabase, businessId)
    if (!ownership.authorized) {
      return { success: false, error: ownership.error }
    }

    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(`*, ${OFFER_GRAPH_JOIN}`)
      .eq('id', dealId)
      .eq('business_id', businessId)
      .single()

    if (error) {
      logSupabaseError('getDealByIdForBusinessAction', error, {
        dealId,
        businessId,
        userId: ownership.userId,
      })
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Deal not found.' }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load this deal. Please try again.",
        ),
      }
    }

    return {
      success: true,
      deal: flattenOffer({
        ...(data as unknown as OfferJoinedRow),
        master_business_info: null,
      }),
    }
  } catch (error) {
    logger.error('getDealByIdForBusinessAction failed', {
      action: 'getDealByIdForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Owners no longer create or delete deals (2026-09-24).
 *
 * createDealAction saved an off-site row that could never go live: prevent_incomplete_offer_activation
 * keeps any offer without promo_offer_items and a promotion or membership off the site, admins
 * included, and the owner form could supply neither. deleteDealAction removed any offer on the
 * business, pipeline-collected ones included, and cascaded away customers' claims and saved deals;
 * nothing marks which offers an owner created, so it could not be narrowed. Both endpoints are
 * gone, and 20260924030002 drops the owner DELETE policy behind the second.
 */

/**
 * Update an existing deal with ownership verification.
 */
export async function updateDealAction(
  dealId: number,
  businessId: number,
  data: Partial<DealInput>,
): Promise<DealResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const ownership = await verifyBusinessOwnership(supabase, businessId)
    if (!ownership.authorized) {
      return { success: false, error: ownership.error }
    }

    // Verify the deal belongs to this business
    const { data: existing, error: existError } = await supabase
      .from('promo_offer_master')
      .select('id')
      .eq('id', dealId)
      .eq('business_id', businessId)
      .single()

    if (existError)
      logSupabaseError('updateDealAction', existError, {
        dealId,
        businessId,
        userId: ownership.userId,
      })
    if (existError || !existing) {
      return {
        success: false,
        error: 'Deal not found or not owned by this business.',
      }
    }

    // `is_active` is absent on purpose: publication is an admin decision (setDealListingAction),
    // and the INSERT policy's WITH CHECK only constrains inserts. An owner edit must not be
    // able to put a taken-down deal back on the site.
    const payload: Record<string, unknown> = {}

    if (data.offer_raw_text !== undefined) {
      payload.offer_raw_text = data.offer_raw_text
        ? stripHtml(data.offer_raw_text.trim())
        : null
    }
    if (data.regular_price !== undefined) {
      payload.regular_price = data.regular_price
    }
    if (data.discount_price !== undefined) {
      payload.discount_price = data.discount_price
    }
    if (data.discount_percent !== undefined) {
      payload.discount_percent = data.discount_percent
    }

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { data: deal, error } = await supabase
      .from('promo_offer_master')
      .update(payload)
      .eq('id', dealId)
      .eq('business_id', businessId)
      .select(`*, ${OFFER_GRAPH_JOIN}`)
      .single()

    if (error) {
      logSupabaseError('updateDealAction', error, {
        dealId,
        businessId,
        userId: ownership.userId,
      })
      return {
        success: false,
        error:
          error.code === '23514'
            ? "Those prices can't be saved: the deal price can't be above the regular price, and a deal on the site needs a discount."
            : publicErrorMessage(
                error,
                "We couldn't save this deal. Please try again.",
              ),
      }
    }

    revalidatePath('/business/dashboard/deals')

    return {
      success: true,
      deal: flattenOffer({
        ...(deal as unknown as OfferJoinedRow),
        master_business_info: null,
      }),
    }
  } catch (error) {
    logger.error('updateDealAction failed', {
      action: 'updateDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
