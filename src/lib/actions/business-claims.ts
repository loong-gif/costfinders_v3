'use server'

import { revalidatePath } from 'next/cache'
import type { ClaimRow } from '@/lib/actions/claims'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ClaimStatus } from '@/types/claim'

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

  if (error)
    logSupabaseError('verifyBusinessOwnership', error, { userId, businessId })
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
      logSupabaseError('getClaimsForBusinessAction', error, {
        userId: user.id,
        businessId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your leads. Please try again.",
        ),
      }
    }

    return { success: true, claims: (data ?? []) as ClaimRow[] }
  } catch (error) {
    logger.error('getClaimsForBusinessAction failed', {
      action: 'getClaimsForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
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
      logSupabaseError('getClaimByIdForBusinessAction', error, {
        userId: user.id,
        businessId,
        claimId,
      })
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Claim not found.' }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load this lead. Please try again.",
        ),
      }
    }

    return { success: true, claim: data as ClaimRow }
  } catch (error) {
    logger.error('getClaimByIdForBusinessAction failed', {
      action: 'getClaimByIdForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
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
      logSupabaseError('updateClaimStatusForBusinessAction', error, {
        userId: user.id,
        businessId,
        claimId,
      })
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Claim not found.' }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't update this lead. Please try again.",
        ),
      }
    }

    revalidatePath('/business/dashboard/leads')

    return { success: true, claim: data as ClaimRow }
  } catch (error) {
    logger.error('updateClaimStatusForBusinessAction failed', {
      action: 'updateClaimStatusForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Consumer contact details for one lead
// ---------------------------------------------------------------------------

export interface ConsumerContact {
  email: string | null
  phone: string | null
  name: string | null
}

interface ConsumerContactResult {
  success: boolean
  error?: string
  contact?: ConsumerContact
}

/**
 * The consumer's contact details for a single lead.
 *
 * The lead detail screen promised "Contact info will be revealed after you mark this lead as
 * contacted" and then rendered the string "Available after consumer profile integration" for
 * both email and phone — a developer placeholder shown to a paying-customer-to-be, after they
 * had already changed the lead's status on the strength of the promise.
 *
 * The data was never reachable from here: the phone is on `profiles`, which an owner cannot
 * read (it is the consumer's own row), and the email is not in the `public` schema at all.
 * `public.claim_consumer_contact()` is a SECURITY DEFINER accessor scoped to ONE claim and to
 * the approved owner of that claim's business — see
 * supabase/migrations/20260910070001_owner_lead_consumer_contact.sql. Authorisation lives in
 * the function, so a forged claimId fails there with 42501 rather than relying on this call
 * site to check.
 */
export async function getConsumerContactForLeadAction(
  claimId: string,
): Promise<ConsumerContactResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase.rpc('claim_consumer_contact', {
      p_claim_id: claimId,
    })

    if (error) {
      logSupabaseError('getConsumerContactForLeadAction', error, { claimId })
      return { success: false, error: 'Could not load the customer’s details.' }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      return { success: false, error: 'Could not load the customer’s details.' }
    }

    return {
      success: true,
      contact: {
        email: row.consumer_email ?? null,
        phone: row.consumer_phone ?? null,
        name: row.consumer_name ?? null,
      },
    }
  } catch (error) {
    logger.error('getConsumerContactForLeadAction failed', {
      action: 'getConsumerContactForLeadAction',
      claimId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
