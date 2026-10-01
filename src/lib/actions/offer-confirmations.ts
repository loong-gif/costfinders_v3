'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import {
  cleanNote,
  type FeedbackStatus,
  isOfferId,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'
import { sendOpsNotice } from '@/lib/email/opsInbox'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { rateLimit, retryAfterPhrase } from '@/lib/rate-limit'
import { getSiteOrigin } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * A clinic's owner confirms a deal reads correctly, or asks for a correction.
 * public.offer_confirmations (supabase/migrations/20260928010002_offer_confirmations.sql) takes
 * the deal's prices and text as they are at that moment, in a trigger; the client never sends
 * them. The public "Confirmed by the clinic" badge is the view public_offer_confirmations, which
 * drops the moment the deal changes, a correction follows, or an admin dismisses it.
 */

export type OfferConfirmationKind = 'confirmed' | 'correction'

/** The owner's latest word on one deal. */
export interface OfferConfirmationState {
  offerId: number
  kind: OfferConfirmationKind
  status: FeedbackStatus
  note: string | null
  createdAt: string
  /**
   * The deal's prices or wording have changed since this was sent. On a confirmation that is
   * "Changed since you confirmed" (and the public badge is already gone); on a correction it
   * usually means an admin applied it.
   */
  stale: boolean
}

export interface OfferConfirmationResult {
  success: boolean
  error?: string
  confirmation?: OfferConfirmationState
}

interface LatestRow {
  offer_id: number
  business_id: number | null
  kind: OfferConfirmationKind
  status: FeedbackStatus
  note: string | null
  created_at: string
  is_current: boolean
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * The caller as an approved owner, and the one business they own. Read through their own-row
 * policy on business_profiles, never from user_metadata, and never from a client-supplied id.
 */
async function approvedOwner(
  supabase: ServerClient,
): Promise<{ userId: string; businessId: number } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session has expired. Please sign in again.' }

  const { data: profile, error } = await supabase
    .from('business_profiles')
    .select('business_id, claim_status')
    .eq('id', user.id)
    .maybeSingle()
  if (error) {
    logSupabaseError('offerConfirmations.approvedOwner', error, {
      userId: user.id,
    })
    return {
      error: publicErrorMessage(error, "We couldn't check your account."),
    }
  }
  if (!profile?.business_id || profile.claim_status !== 'approved') {
    return {
      error: 'Only the approved owner of this business can confirm its deals.',
    }
  }
  return { userId: user.id, businessId: profile.business_id as number }
}

function unexpected(
  action: string,
  error: unknown,
): { success: false; error: string } {
  logger.error(`${action} failed`, {
    action,
    error: error instanceof Error ? error.message : String(error),
  })
  return { success: false, error: 'Something went wrong. Please try again.' }
}

/**
 * Insert one confirmation or correction and select it back through the owner's read policy.
 * Shared by the two write actions so their checks cannot drift apart.
 */
async function record(
  offerId: unknown,
  kind: OfferConfirmationKind,
  note: string | null,
  action: string,
): Promise<OfferConfirmationResult> {
  if (!isOfferId(offerId)) {
    return {
      success: false,
      error:
        "We couldn't tell which deal this is. Refresh the page and try again.",
    }
  }

  const supabase = await createSupabaseServerClient()
  const owner = await approvedOwner(supabase)
  if ('error' in owner) return { success: false, error: owner.error }

  // Generous for an owner working down a list of deals; it bounds a script, not a person.
  const limit = rateLimit(`offer-confirmation:${owner.userId}`, 60, 10 * 60_000)
  if (!limit.allowed) {
    return {
      success: false,
      error: `That's a lot of changes at once. ${retryAfterPhrase(limit.retryAfterSeconds)}`,
    }
  }

  // Checked here for a clear message; the trigger and the INSERT policy refuse it anyway.
  const { data: offer, error: offerError } = await supabase
    .from('promo_offer_master')
    .select('id')
    .eq('id', offerId)
    .eq('business_id', owner.businessId)
    .maybeSingle()
  if (offerError) {
    logSupabaseError(`${action}.offer`, offerError, { offerId })
    return {
      success: false,
      error: publicErrorMessage(offerError, "We couldn't find that deal."),
    }
  }
  if (!offer) {
    return {
      success: false,
      error: "That deal isn't one of your business's deals.",
    }
  }

  const { data, error } = await supabase
    .from('offer_confirmations')
    .insert({ offer_id: offerId, kind, note })
    .select('offer_id, kind, status, note, created_at')
    .maybeSingle()
  if (error) {
    logSupabaseError(action, error, { offerId, businessId: owner.businessId })
    return {
      success: false,
      error: publicErrorMessage(
        error,
        "We couldn't save that. Please try again.",
      ),
    }
  }
  if (!data) {
    logger.error('Offer confirmation insert returned no row', {
      action,
      offerId,
    })
    return { success: false, error: "We couldn't save that. Please try again." }
  }

  // The badge on the deal page follows at once; listing pages pick it up on their hourly rebuild.
  revalidatePath(`/deals/${offerId}`)
  revalidatePath('/business/dashboard/deals')

  const row = data as Omit<LatestRow, 'business_id' | 'is_current'>
  return {
    success: true,
    confirmation: {
      offerId: row.offer_id,
      kind: row.kind,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      stale: false,
    },
  }
}

/** "Confirm it's correct": the owner vouches for the deal as it reads right now. */
export async function confirmOfferAction(
  offerId: number,
): Promise<OfferConfirmationResult> {
  try {
    return await record(offerId, 'confirmed', null, 'confirmOfferAction')
  } catch (error) {
    return unexpected('confirmOfferAction', error)
  }
}

/**
 * "Suggest a correction": the owner says what is wrong. Hides any confirmed badge on the deal
 * until they confirm again, and tells the ops inbox, since an admin applies it by hand in the
 * deal editor.
 */
export async function requestOfferCorrectionAction(
  offerId: number,
  note: string,
): Promise<OfferConfirmationResult> {
  try {
    const text = cleanNote(note, NOTE_MAX.correction)
    // Any words at all, like the table's CHECK: "$89" is a whole correction.
    if (!text) {
      return { success: false, error: 'Please tell us what needs to change.' }
    }
    const result = await record(
      offerId,
      'correction',
      text,
      'requestOfferCorrectionAction',
    )
    if (result.success) {
      after(() => notifyOpsOfCorrection(offerId, text))
    }
    return result
  } catch (error) {
    return unexpected('requestOfferCorrectionAction', error)
  }
}

/**
 * The owner's latest confirmation or correction per deal, with `stale` when the deal has changed
 * since. Deals with neither are absent. `businessId` must be the caller's own approved business,
 * the same contract as getDealsForBusinessAction.
 */
export async function getOfferConfirmationsForBusinessAction(
  businessId: number,
): Promise<{
  success: boolean
  error?: string
  confirmations?: OfferConfirmationState[]
}> {
  try {
    const supabase = await createSupabaseServerClient()
    const owner = await approvedOwner(supabase)
    if ('error' in owner) return { success: false, error: owner.error }
    if (owner.businessId !== businessId) {
      return { success: false, error: 'You do not own this business.' }
    }

    // latest_offer_confirmations() is SECURITY INVOKER: RLS already limits it to this business.
    const { data, error } = await supabase
      .rpc('latest_offer_confirmations')
      .eq('business_id', businessId)
    if (error) {
      logSupabaseError('getOfferConfirmationsForBusinessAction', error, {
        businessId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your confirmations.",
        ),
      }
    }

    return {
      success: true,
      confirmations: ((data ?? []) as LatestRow[]).map((row) => ({
        offerId: row.offer_id,
        kind: row.kind,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        stale: !row.is_current,
      })),
    }
  } catch (error) {
    return unexpected('getOfferConfirmationsForBusinessAction', error)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function notifyOpsOfCorrection(
  offerId: number,
  note: string,
): Promise<void> {
  const result = await sendOpsNotice(
    `Deal correction requested (deal ${offerId})`,
    'A business owner asked for a correction to one of their deals. Apply it in the admin deal editor; it is saved in public.offer_confirmations.',
    [
      ['Deal', `${getSiteOrigin()}/deals/${offerId}`],
      ['Editor', `${getSiteOrigin()}/admin/dashboard/deals`],
      ['Correction', note],
    ],
    'requestOfferCorrectionAction',
  )
  if (!result.success) {
    logger.error('Correction saved but the ops notice did not send', {
      action: 'requestOfferCorrectionAction',
      error: result.error,
    })
  }
}
