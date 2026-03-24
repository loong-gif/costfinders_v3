'use server'

import { revalidatePath } from 'next/cache'
import { claimConfirmationEmail } from '@/lib/email/templates'
import { getOrCreateConversationAction } from '@/lib/actions/messaging'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import {
  sendClaimNotificationEmail,
  sendEmailAction,
} from '@/lib/actions/notifications'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ClaimStatus } from '@/types/claim'
import { logger } from '@/lib/logger'

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
  message?: string
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
 *
 * Enforces:
 * - Server-side limit of MAX_ACTIVE_CLAIMS active claims per consumer
 * - Duplicate prevention (application-level + DB unique constraint fallback)
 * - Server-side business_id derivation from promo_offer_master (ignores client value)
 * - Best-effort email notification after successful insert
 */
export async function createClaimAction(
  dealId: number,
  _businessId: number,
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

    // --- Derive business_id server-side (don't trust client) ---
    const { data: offer, error: offerError } = await supabase
      .from('promo_offer_master')
      .select('business_id, service_name, source_name')
      .eq('id', dealId)
      .single()

    if (offerError || !offer?.business_id) {
      return {
        success: false,
        error: 'deal_not_found',
        message: 'Deal not found.',
      }
    }

    const businessId = offer.business_id

    // --- Spam prevention: count active (non-expired) claims ---
    const { count, error: countError } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('consumer_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .gte('expires_at', new Date().toISOString())

    if (countError) {
      return { success: false, error: countError.message }
    }

    if ((count ?? 0) >= MAX_ACTIVE_CLAIMS) {
      return {
        success: false,
        error: 'limit_reached',
        message: 'You can have up to 3 active deals claimed at a time.',
      }
    }

    // --- Application-level duplicate check (exclude expired) ---
    const { data: existing, error: existingError } = await supabase
      .from('claims')
      .select('id')
      .eq('consumer_id', user.id)
      .eq('deal_id', dealId)
      .in('status', ACTIVE_STATUSES)
      .gte('expires_at', new Date().toISOString())
      .limit(1)

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    if (existing && existing.length > 0) {
      return {
        success: false,
        error: 'already_claimed',
        message: "You've already claimed this deal.",
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
      // Handle DB-level unique constraint violation (fallback for race conditions)
      if (error.code === '23505') {
        return {
          success: false,
          error: 'already_claimed',
          message: "You've already claimed this deal.",
        }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/account/claims')
    revalidatePath('/deals')

    // --- Best-effort notification (claim succeeds even if email fails) ---
    // Fetch business name/city for the notification
    const { data: business } = await supabase
      .from('master_business_info')
      .select('name, city')
      .eq('business_id', businessId)
      .single()

    sendClaimNotificationEmail({
      consumerName: user.user_metadata?.full_name ?? user.email ?? 'Unknown',
      consumerEmail: user.email ?? '',
      dealTitle: offer.service_name ?? offer.source_name ?? `Deal #${dealId}`,
      businessName: business?.name ?? `Business #${businessId}`,
      businessCity: business?.city ?? '',
      preferredDate,
      preferredTime,
      notes,
    }).catch((err) => {
      // Swallow error — notification is best-effort
      console.error('[createClaimAction] notification failed:', err)
    })

    // --- Best-effort in-app notification for consumer ---
    const dealTitle = offer.service_name ?? `Deal #${dealId}`

    createNotificationAction(
      user.id,
      'claim_created',
      'Claim submitted',
      `Your claim for ${dealTitle} has been submitted.`,
      '/dashboard/claims',
    ).catch(() => {})

    // --- Best-effort confirmation email to consumer ---
    if (user.email) {
      const consumerName =
        user.user_metadata?.full_name ?? user.email
      const { subject, html } = claimConfirmationEmail(
        consumerName,
        dealTitle,
        business?.city ?? '',
      )
      sendEmailAction(user.email, subject, html).catch(() => {})
    }

    // Auto-create conversation for messaging (best-effort)
    getOrCreateConversationAction(data.id).catch(() => {})

    return { success: true, claimId: data.id }
  } catch (error) {
    logger.error('createClaimAction failed', {
      action: 'createClaimAction',
      error: error instanceof Error ? error.message : String(error),
    })
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
  } catch (error) {
    logger.error('getClaimsAction failed', {
      action: 'getClaimsAction',
      error: error instanceof Error ? error.message : String(error),
    })
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
  } catch (error) {
    logger.error('getClaimByIdAction failed', {
      action: 'getClaimByIdAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch the active claim for a specific deal (if any).
 * Useful for showing "Already claimed" state on deal cards.
 *
 * Filters out expired claims (expires_at in the past) so they don't block
 * re-claiming. This serves as an application-level fallback until the
 * pg_cron job is set up to automatically transition expired claims.
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
      .gte('expires_at', new Date().toISOString()) // exclude expired claims
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
  } catch (error) {
    logger.error('getClaimByDealIdAction failed', {
      action: 'getClaimByDealIdAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Business Reveal
// ---------------------------------------------------------------------------

/** Statuses that grant access to business details after claiming. */
const REVEAL_STATUSES: ClaimStatus[] = [
  'pending',
  'contacted',
  'booked',
  'completed',
]

export interface RevealedBusiness {
  business_id: number
  name: string
  address: string | null
  city: string | null
  website_clean: string | null
  website: string | null
  score: number | null
  review_count: number | null
}

interface BusinessRevealResult {
  revealed: boolean
  business?: RevealedBusiness
}

/**
 * Check if the current user has an active claim on a deal. If so, return the
 * associated business details from `master_business_info`.
 *
 * Active claim = status IN (pending, contacted, booked, completed).
 * Being authenticated alone is NOT enough — the user must have claimed the deal.
 */
export async function getBusinessRevealAction(
  dealId: number,
): Promise<BusinessRevealResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { revealed: false }
    }

    // Check for an active claim on this deal (exclude expired)
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('business_id')
      .eq('consumer_id', user.id)
      .eq('deal_id', dealId)
      .in('status', REVEAL_STATUSES)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (claimError || !claim) {
      return { revealed: false }
    }

    // Fetch business details
    const { data: business, error: bizError } = await supabase
      .from('master_business_info')
      .select(
        'business_id, name, address, city, website_clean, website, score, review_count',
      )
      .eq('business_id', claim.business_id)
      .single()

    if (bizError || !business) {
      return { revealed: false }
    }

    return {
      revealed: true,
      business: business as RevealedBusiness,
    }
  } catch (error) {
    logger.error('getBusinessRevealAction failed', {
      action: 'getBusinessRevealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { revealed: false }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
