'use server'

import { revalidatePath } from 'next/cache'
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
    return { authorized: false as const, error: 'You do not own this business.' }
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
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, deals: (data ?? []) as Offer[] }
  } catch {
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
      .select('*')
      .eq('id', dealId)
      .eq('business_id', businessId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Deal not found.' }
      }
      return { success: false, error: error.message }
    }

    return { success: true, deal: data as Offer }
  } catch {
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

    const insertPayload: Record<string, unknown> = {
      business_id: businessId,
      service_name: stripHtml(data.service_name.trim()),
      moderation_status: 'pending_review',
    }

    if (data.service_category) {
      insertPayload.service_category = stripHtml(data.service_category.trim())
    }
    if (data.original_price != null) {
      insertPayload.original_price = data.original_price
    }
    if (data.discount_price != null) {
      insertPayload.discount_price = data.discount_price
    }
    if (data.discount_percent != null) {
      insertPayload.discount_percent = data.discount_percent
    }
    if (data.unit_type) {
      insertPayload.unit_type = stripHtml(data.unit_type.trim())
    }
    if (data.offer_raw_text) {
      insertPayload.offer_raw_text = stripHtml(data.offer_raw_text.trim())
    }
    if (data.template_type) {
      insertPayload.template_type = data.template_type
    }
    if (data.start_date) {
      insertPayload.start_date = data.start_date
    }
    if (data.end_date) {
      insertPayload.end_date = data.end_date
    }
    if (data.min_unit) {
      insertPayload.min_unit = data.min_unit
    }

    const { data: deal, error } = await supabase
      .from('promo_offer_master')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')

    return { success: true, deal: deal as Offer }
  } catch {
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
      return { success: false, error: 'Deal not found or not owned by this business.' }
    }

    const payload: Record<string, unknown> = {}

    if (data.service_name !== undefined) {
      payload.service_name = stripHtml(data.service_name.trim())
    }
    if (data.service_category !== undefined) {
      payload.service_category = data.service_category
        ? stripHtml(data.service_category.trim())
        : null
    }
    if (data.original_price !== undefined) {
      payload.original_price = data.original_price
    }
    if (data.discount_price !== undefined) {
      payload.discount_price = data.discount_price
    }
    if (data.discount_percent !== undefined) {
      payload.discount_percent = data.discount_percent
    }
    if (data.unit_type !== undefined) {
      payload.unit_type = data.unit_type ? stripHtml(data.unit_type.trim()) : null
    }
    if (data.offer_raw_text !== undefined) {
      payload.offer_raw_text = data.offer_raw_text
        ? stripHtml(data.offer_raw_text.trim())
        : null
    }
    if (data.template_type !== undefined) {
      payload.template_type = data.template_type
    }
    if (data.start_date !== undefined) {
      payload.start_date = data.start_date
    }
    if (data.end_date !== undefined) {
      payload.end_date = data.end_date
    }
    if (data.min_unit !== undefined) {
      payload.min_unit = data.min_unit
    }

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { data: deal, error } = await supabase
      .from('promo_offer_master')
      .update(payload)
      .eq('id', dealId)
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')

    return { success: true, deal: deal as Offer }
  } catch {
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
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
