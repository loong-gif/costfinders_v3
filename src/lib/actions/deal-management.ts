'use server'

import { revalidatePath } from 'next/cache'
import {
  buildLiveOfferInsertPayload,
  buildLiveOfferUpdatePayload,
  enrichOffer,
  enrichOffers,
  OFFER_EMBED,
} from '@/lib/data/offer-query'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Offer } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealInput {
  service_name: string
  service_category?: string
  original_price?: number
  discount_price?: number
  discount_percent?: number
  unit_type?: string
  offer_raw_text?: string
  template_type?: string
  start_date?: string
  end_date?: string
  min_unit?: string
}

interface DealResult {
  success: boolean
  error?: string
  deal?: Offer
}

interface DealsResult {
  success: boolean
  error?: string
  deals?: Offer[]
}

interface DeleteResult {
  success: boolean
  error?: string
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

    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(`*, ${OFFER_EMBED}`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, deals: enrichOffers((data ?? []) as Offer[]) }
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
      .select(`*, ${OFFER_EMBED}`)
      .eq('id', dealId)
      .eq('business_id', businessId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Deal not found.' }
      }
      return { success: false, error: error.message }
    }

    return { success: true, deal: enrichOffer(data as Offer) }
  } catch (error) {
    logger.error('getDealByIdForBusinessAction failed', {
      action: 'getDealByIdForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Create a new deal for a business.
 */
export async function createDealAction(
  businessId: number,
  data: DealInput,
): Promise<DealResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const ownership = await verifyBusinessOwnership(supabase, businessId)
    if (!ownership.authorized) {
      return { success: false, error: ownership.error }
    }

    if (!data.service_name?.trim()) {
      return { success: false, error: 'Service name is required.' }
    }

    const insertPayload = buildLiveOfferInsertPayload(
      businessId,
      {
        ...data,
        service_name: stripHtml(data.service_name.trim()),
        offer_raw_text: data.offer_raw_text
          ? stripHtml(data.offer_raw_text.trim())
          : data.offer_raw_text,
      },
      { pendingReview: true },
    )

    const { data: deal, error } = await supabase
      .from('promo_offer_master')
      .insert(insertPayload)
      .select(`*, ${OFFER_EMBED}`)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')

    return { success: true, deal: enrichOffer(deal as Offer) }
  } catch (error) {
    logger.error('createDealAction failed', {
      action: 'createDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

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

    if (existError || !existing) {
      return {
        success: false,
        error: 'Deal not found or not owned by this business.',
      }
    }

    const payload = buildLiveOfferUpdatePayload({
      ...data,
      service_name: data.service_name
        ? stripHtml(data.service_name.trim())
        : data.service_name,
      offer_raw_text: data.offer_raw_text
        ? stripHtml(data.offer_raw_text.trim())
        : data.offer_raw_text,
    })

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { data: deal, error } = await supabase
      .from('promo_offer_master')
      .update(payload)
      .eq('id', dealId)
      .eq('business_id', businessId)
      .select(`*, ${OFFER_EMBED}`)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')

    return { success: true, deal: enrichOffer(deal as Offer) }
  } catch (error) {
    logger.error('updateDealAction failed', {
      action: 'updateDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Delete a deal with ownership verification.
 */
export async function deleteDealAction(
  dealId: number,
  businessId: number,
): Promise<DeleteResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const ownership = await verifyBusinessOwnership(supabase, businessId)
    if (!ownership.authorized) {
      return { success: false, error: ownership.error }
    }

    const { error } = await supabase
      .from('promo_offer_master')
      .delete()
      .eq('id', dealId)
      .eq('business_id', businessId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')

    return { success: true }
  } catch (error) {
    logger.error('deleteDealAction failed', {
      action: 'deleteDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
