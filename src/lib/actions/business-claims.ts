'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ClaimStatus } from '@/types/claim'
import type { ClaimRow } from '@/lib/actions/claims'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface MutationResult {
  success: boolean
  error?: string
  claim?: ClaimRow
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the authenticated user owns the given business_id via business_profiles.
 * Returns the user ID on success, or null if verification fails.
 */
async function verifyBusinessOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  businessId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('business_id')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return data.business_id === businessId
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch all claims for a specific business, newest first.
 * Verifies the authenticated user owns the business.
 */
export async function getClaimsForBusinessAction(
  businessId: number,
): Promise<ClaimsListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const isOwner = await verifyBusinessOwnership(supabase, user.id, businessId)
    if (!isOwner) {
      return { success: false, error: 'Not authorized for this business' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('business_id', businessId)
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
 * Fetch a single claim by ID with ownership verification.
 */
export async function getClaimByIdForBusinessAction(
  claimId: string,
  businessId: number,
): Promise<SingleClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const isOwner = await verifyBusinessOwnership(supabase, user.id, businessId)
    if (!isOwner) {
      return { success: false, error: 'Not authorized for this business' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .eq('business_id', businessId)
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
 * Update the status of a claim owned by the business.
 */
export async function updateClaimStatusForBusinessAction(
  claimId: string,
  businessId: number,
  status: ClaimStatus,
): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const isOwner = await verifyBusinessOwnership(supabase, user.id, businessId)
    if (!isOwner) {
      return { success: false, error: 'Not authorized for this business' }
    }

    const { data, error } = await supabase
      .from('claims')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId)
      .eq('business_id', businessId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Claim not found.' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/leads')

    return { success: true, claim: data as ClaimRow }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Add or update the business response / internal notes on a claim.
 */
export async function addBusinessResponseAction(
  claimId: string,
  businessId: number,
  response: string,
): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const isOwner = await verifyBusinessOwnership(supabase, user.id, businessId)
    if (!isOwner) {
      return { success: false, error: 'Not authorized for this business' }
    }

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('claims')
      .update({
        business_response: response,
        responded_at: now,
        updated_at: now,
      })
      .eq('id', claimId)
      .eq('business_id', businessId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Claim not found.' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/leads')

    return { success: true, claim: data as ClaimRow }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
