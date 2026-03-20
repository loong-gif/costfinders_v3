'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ClaimStatus } from '@/types/claim'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaimRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: ClaimStatus
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  business_response: string | null
  responded_at: string | null
  booked_date: string | null
  booked_time: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

interface ClaimResult {
  success: boolean
  error?: string
  claimId?: string
}

interface ClaimsListResult {
  success: boolean
  error?: string
  claims?: ClaimRow[]
}

interface SingleClaimResult {
  success: boolean
  error?: string
  claim?: ClaimRow
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of active (non-terminal) claims a consumer can hold at once. */
const MAX_ACTIVE_CLAIMS = 3

/** Claim statuses that count as "active" for the spam-prevention limit. */
const ACTIVE_STATUSES: ClaimStatus[] = ['pending', 'contacted', 'booked']

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a new claim on a deal.
 * Enforces a server-side limit of MAX_ACTIVE_CLAIMS active claims per consumer.
 */
export async function createClaimAction(
  dealId: number,
  businessId: number,
  preferredDate?: string,
  preferredTime?: string,
  notes?: string,
): Promise<ClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // --- Spam prevention: count active claims ---
    const { count, error: countError } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('consumer_id', user.id)
      .in('status', ACTIVE_STATUSES)

    if (countError) {
      return { success: false, error: countError.message }
    }

    if ((count ?? 0) >= MAX_ACTIVE_CLAIMS) {
      return {
        success: false,
        error: `You already have ${MAX_ACTIVE_CLAIMS} active claims. Please wait for existing claims to be resolved before creating new ones.`,
      }
    }

    // --- Check for duplicate claim on the same deal ---
    const { data: existing, error: existingError } = await supabase
      .from('claims')
      .select('id')
      .eq('consumer_id', user.id)
      .eq('deal_id', dealId)
      .in('status', ACTIVE_STATUSES)
      .limit(1)

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    if (existing && existing.length > 0) {
      return {
        success: false,
        error: 'You already have an active claim for this deal.',
      }
    }

    // --- Insert claim ---
    const insertPayload: Record<string, unknown> = {
      consumer_id: user.id,
      deal_id: dealId,
      business_id: businessId,
    }

    if (preferredDate) {
      insertPayload.preferred_date = preferredDate
    }
    if (preferredTime) {
      insertPayload.preferred_time = stripHtml(preferredTime.trim())
    }
    if (notes) {
      insertPayload.notes = stripHtml(notes.trim()).slice(0, 1000)
    }

    const { data, error } = await supabase
      .from('claims')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/account/claims')
    revalidatePath('/deals')

    return { success: true, claimId: data.id }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch all claims for the current user, newest first.
 */
export async function getClaimsAction(): Promise<ClaimsListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('consumer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, claims: (data ?? []) as ClaimRow[] }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch a single claim by ID.
 * RLS ensures the row belongs to the current user.
 */
export async function getClaimByIdAction(
  claimId: string,
): Promise<SingleClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .eq('consumer_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Claim not found.' }
      }
      return { success: false, error: error.message }
    }

    return { success: true, claim: data as ClaimRow }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch the active claim for a specific deal (if any).
 * Useful for showing "Already claimed" state on deal cards.
 */
export async function getClaimByDealIdAction(
  dealId: number,
): Promise<SingleClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('consumer_id', user.id)
      .eq('deal_id', dealId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: true, claim: undefined }
    }

    return { success: true, claim: data as ClaimRow }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
