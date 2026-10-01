'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getOrCreateConversationAction } from '@/lib/actions/messaging'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { updateProfileAction } from '@/lib/actions/profile'
import { dealPricing, offerToAnonymousDeal } from '@/lib/data/adapters'
import {
  getOfferById,
  isPubliclyVisible,
  PUBLIC_OFFERS,
  resolveOfferTitle,
} from '@/lib/data/offers'
import { sendClaimNotificationEmail } from '@/lib/email/claimNotification'
import { notifyOwnerOfNewClaim } from '@/lib/email/ownerNotifications'
import { sendEmail } from '@/lib/email/send'
import { claimConfirmationEmail } from '@/lib/email/templates'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ClaimClinic, ClaimStatus } from '@/types/claim'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * `claims.business_response` is deliberately absent. It was labelled "Business Notes" to the
 * owner and rendered to the consumer as "Business Response" — one column, two contradictory
 * promises. Owner→consumer communication goes through `conversations`/`messages`. The column
 * still exists (pipeline-owned, never written by the app); do not re-add a reader.
 */
export interface ClaimRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: ClaimStatus
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  responded_at: string | null
  booked_date: string | null
  booked_time: string | null
  expires_at: string
  created_at: string
  updated_at: string
  /**
   * What the claim revealed, frozen at insert by trg_claims_keep_revealed_details
   * (supabase/migrations/20260924010001). Absent until that migration is applied; every reader
   * falls back to the live tables.
   */
  deal_title?: string | null
  price_label?: string | null
  business_snapshot?: ClaimClinic | null
  /** Computed by getClaimsAction, not a column: is the deal still on the site? */
  deal_visible?: boolean
}

/** Name and phone the customer confirms on the claim form. Both go to the clinic. */
export interface ClaimContact {
  firstName: string
  lastName: string
  phone: string
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of active (non-terminal) claims a consumer can hold at once. */
const MAX_ACTIVE_CLAIMS = 3

/** Claim statuses that count as "active" for the spam-prevention limit. */
const ACTIVE_STATUSES: ClaimStatus[] = ['pending', 'contacted', 'booked']

const CLINIC_COLUMNS =
  'business_id, name, address, city, phone, website, score, review_count, google_place_id'

const DEAL_UNAVAILABLE: ClaimResult = {
  success: false,
  error: 'deal_unavailable',
  message: 'This deal is no longer available to claim.',
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a new claim on a deal.
 *
 * Enforces:
 * - The deal is on the site right now (is_active AND campaign not ended). Pages refresh hourly,
 *   so an ended promotion used to stay claimable for up to an hour.
 * - A name and a phone number: they are what our team passes to the clinic. Saved to the
 *   profile when they changed.
 * - Server-side limit of MAX_ACTIVE_CLAIMS active claims per consumer
 * - Duplicate prevention (application-level + DB unique constraint fallback)
 * - Server-side business_id derivation from the offer (public_offers; ignores client value)
 * - Best-effort emails after a successful insert: the ops lead notice and the customer's copy
 *   of the clinic's details (essential, so an email opt-out does not swallow it)
 */
export async function createClaimAction(
  dealId: number,
  _businessId: number,
  preferredDate?: string,
  preferredTime?: string,
  notes?: string,
  contact?: ClaimContact,
): Promise<ClaimResult> {
  try {
    if (!Number.isInteger(dealId)) return DEAL_UNAVAILABLE

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // --- The deal, read through the canonical rules (anon client: public rows only) ---
    // Visibility is isPubliclyVisible(), the same gate the deal page uses, so a promotion that
    // ended this morning cannot be claimed off a page cached an hour ago. The DB trigger
    // (20260924010001) repeats the check for a direct PostgREST insert.
    const offer = await getOfferById(dealId)
    if (!offer || offer.business_id == null || !isPubliclyVisible(offer)) {
      return DEAL_UNAVAILABLE
    }

    const businessId = offer.business_id
    const deal = offerToAnonymousDeal(offer)
    const dealTitle = deal.title
    const priceLabel = dealPricing(deal).text

    // --- Who is claiming. The form sends these; fall back to the profile. ---
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      logSupabaseError('createClaimAction', profileError, { userId: user.id })
    }

    const firstName = clean(contact?.firstName ?? profile?.first_name, 60)
    const lastName = clean(contact?.lastName ?? profile?.last_name, 60)
    const phone = clean(contact?.phone ?? profile?.phone, 30)
    if (!firstName || phone.replace(/\D/g, '').length < 10) {
      return {
        success: false,
        error: 'contact_required',
        message:
          'Add your name and a phone number so our team can pass your request to the clinic.',
      }
    }

    const safeDate =
      preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
        ? preferredDate
        : undefined
    const safeTime = preferredTime
      ? stripHtml(preferredTime.trim()).slice(0, 40)
      : undefined
    const safeNotes = notes
      ? stripHtml(notes.trim()).slice(0, 1000) || undefined
      : undefined

    // --- Spam prevention: count active (non-expired) claims ---
    const { count, error: countError } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('consumer_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .gte('expires_at', new Date().toISOString())

    if (countError) {
      logSupabaseError('createClaimAction', countError, {
        userId: user.id,
        dealId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          countError,
          "We couldn't check your active claims. Please try again.",
        ),
      }
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
      logSupabaseError('createClaimAction', existingError, {
        userId: user.id,
        dealId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          existingError,
          "We couldn't check your existing claims. Please try again.",
        ),
      }
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
      price_label: priceLabel,
    }
    if (safeDate) insertPayload.preferred_date = safeDate
    if (safeTime) insertPayload.preferred_time = safeTime
    if (safeNotes) insertPayload.notes = safeNotes

    const insert = () =>
      supabase.from('claims').insert(insertPayload).select('*').single()
    let result = await insert()
    // ponytail: until 20260924010001 is applied `price_label` does not exist and PostgREST
    // rejects the whole insert with PGRST204. Retry without it; delete this once applied.
    if (result.error?.code === 'PGRST204') {
      delete insertPayload.price_label
      result = await insert()
    }
    const { data, error } = result

    if (error) {
      logSupabaseError('createClaimAction', error, {
        userId: user.id,
        dealId,
        businessId,
      })
      // Handle DB-level unique constraint violation (fallback for race conditions).
      // claims_active_unique on (consumer_id, deal_id) WHERE status not in
      // (cancelled, expired) is what makes the check above race-safe — verified: five
      // concurrent identical inserts produce one row and four 23505s.
      if (error.code === '23505') {
        return {
          success: false,
          error: 'already_claimed',
          message: "You've already claimed this deal.",
        }
      }
      // trg_enforce_active_claim_limit. The count above is advisory only — `claims` is
      // directly writable through PostgREST, so the limit has to be enforced in the
      // database or it is not enforced at all.
      if (error.code === '23514' && error.hint === 'limit_reached') {
        return {
          success: false,
          error: 'limit_reached',
          message: 'You can have up to 3 active deals claimed at a time.',
        }
      }
      // trg_claims_keep_revealed_details: the deal went off the site between our read and
      // the insert.
      if (error.code === '23514' && error.hint === 'deal_unavailable') {
        return DEAL_UNAVAILABLE
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't save your claim. Please try again.",
        ),
      }
    }

    const claim = data as ClaimRow

    // --- Save the name and phone the customer confirmed, if they changed ---
    // Awaited, not after(): the claim form re-reads the profile when this returns.
    // updateProfileAction selects the row back; a mismatch means the write did not land.
    if (
      firstName !== (profile?.first_name ?? '') ||
      lastName !== (profile?.last_name ?? '') ||
      phone !== (profile?.phone ?? '')
    ) {
      const saved = await updateProfileAction({
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      if (
        !saved.success ||
        saved.profile?.first_name !== firstName ||
        saved.profile?.phone !== phone
      ) {
        logger.error('Claim contact details were not saved to the profile', {
          action: 'createClaimAction',
          userId: user.id,
          claimId: claim.id,
          error: saved.error,
        })
      }
    }

    revalidatePath('/dashboard/claims')
    revalidatePath('/deals')

    // The clinic as the claim froze it; the live row until the migration is applied.
    const clinic =
      claim.business_snapshot ??
      (await readClinics(supabase, [businessId])).get(businessId) ??
      null

    // after(), not `.catch(() => {})` — see sendEmail's docblock for why that form could
    // both hide a failure and skip the send. The claim row is written; this runs once the
    // action has returned, and sendEmail logs any failure under this action name.
    after(() =>
      sendClaimNotificationEmail({
        customerName: [firstName, lastName].filter(Boolean).join(' '),
        customerEmail: user.email ?? '',
        customerPhone: phone,
        dealTitle,
        priceLabel,
        clinic,
        preferredDate: safeDate,
        preferredTime: safeTime,
        notes: safeNotes,
        relayBy: claim.expires_at,
      }),
    )

    // Owner accounts are rare (1 of 419 clinics); the function decides whether there is anyone
    // to tell. It catches and logs its own failures, and after() runs it once the claim has
    // already returned, so it cannot affect the claim.
    after(() => notifyOwnerOfNewClaim(claim.id))

    createNotificationAction(
      user.id,
      'claim_created',
      'Claim submitted',
      `You claimed ${dealTitle}. The clinic's details are on your claims page.`,
      '/dashboard/claims',
    ).catch(() => {})

    // --- The customer's copy of the clinic's details ---
    // Essential: it carries the phone number the claim was for, so an email opt-out must not
    // swallow it (the opt-out covers alerts, not receipts).
    if (user.email) {
      const recipient = user.email
      const { subject, html } = claimConfirmationEmail({
        firstName,
        dealTitle,
        priceLabel,
        clinic,
      })
      after(() =>
        sendEmail(recipient, subject, html, 'createClaimAction', {
          essential: true,
        }),
      )
    }

    // Auto-create the message thread (best-effort — the claim is already saved).
    // Best-effort is not the same as invisible: this used to be `.catch(() => {})`, which is
    // how `conversations` reached production holding 0 rows with nobody noticing. Most
    // businesses have no owner account and genuinely cannot have a thread, so that case is a
    // warn, not an error.
    try {
      const conversation = await getOrCreateConversationAction(claim.id)
      if (!conversation.success) {
        logger.warn('No conversation created for claim', {
          action: 'createClaimAction',
          claimId: claim.id,
          businessId,
          error: conversation.error,
        })
      }
    } catch (err) {
      logger.error('Conversation creation threw for claim', {
        action: 'createClaimAction',
        claimId: claim.id,
        businessId,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return { success: true, claimId: claim.id }
  } catch (error) {
    logger.error('createClaimAction failed', {
      action: 'createClaimAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch all claims for the current user, newest first, each with what it revealed.
 *
 * Every claim keeps its clinic, whatever its status and however old: the snapshot the claim
 * froze, or (until 20260924010001 is applied) the live directory row. `deal_visible` says
 * whether the deal is still on the site, so the page can say it was taken down instead of
 * linking to a 404.
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
      logSupabaseError('getClaimsAction', error, { userId: user.id })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your claims. Please try again.",
        ),
      }
    }

    const rows = (data ?? []) as ClaimRow[]
    if (rows.length === 0) return { success: true, claims: [] }

    // Deals still on the site, through the public catalogue like any visitor (a customer has no
    // read on promo_offer_master). The view holds active offers only, so zero rows for an id
    // means taken down; the campaign end date is the rest of isPubliclyVisible().
    const dealIds = [...new Set(rows.map((r) => r.deal_id))]
    const { data: offers, error: offersError } = await supabase
      .from(PUBLIC_OFFERS)
      .select(
        'id, is_active, campaign_end_date, offer_raw_text, promo_offer_items',
      )
      .in('id', dealIds)
    if (offersError) {
      logSupabaseError('getClaimsAction', offersError, { userId: user.id })
    }
    const offerById = new Map((offers ?? []).map((o) => [o.id as number, o]))

    const missing = rows
      .filter((r) => !r.business_snapshot)
      .map((r) => r.business_id)
    const live = missing.length
      ? await readClinics(supabase, missing)
      : new Map<number, ClaimClinic>()

    const claims = rows.map((r) => {
      const offer = offerById.get(r.deal_id)
      return {
        ...r,
        deal_title: r.deal_title ?? (offer ? resolveOfferTitle(offer) : null),
        business_snapshot:
          r.business_snapshot ?? live.get(r.business_id) ?? null,
        // Unknown (undefined) when the lookup failed — never claim a takedown we did not see.
        deal_visible: offersError
          ? undefined
          : Boolean(
              offer &&
                isPubliclyVisible({
                  is_active: offer.is_active,
                  end_date: offer.campaign_end_date,
                }),
            ),
      }
    })

    return { success: true, claims }
  } catch (error) {
    logger.error('getClaimsAction failed', {
      action: 'getClaimsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Cancel one of the caller's own active claims.
 *
 * A public endpoint like every server action: the claim id is untrusted, so the update is
 * scoped to `consumer_id = caller`, and RLS ("Consumers can cancel own claims") and
 * guard_claim_consumer_columns (consumer may only move status to 'cancelled') hold the line
 * underneath. The row is selected back — an RLS-filtered UPDATE resolves with zero rows and
 * no error, which is not a cancellation.
 */
export async function cancelClaimAction(claimId: string): Promise<ClaimResult> {
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
      .update({ status: 'cancelled' })
      .eq('id', claimId)
      .eq('consumer_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .select('id, status')

    if (error) {
      logSupabaseError('cancelClaimAction', error, { userId: user.id, claimId })
      return {
        success: false,
        error: 'cancel_failed',
        message: 'We could not cancel this claim. Please try again.',
      }
    }

    if (!data || data.length !== 1 || data[0].status !== 'cancelled') {
      return {
        success: false,
        error: 'not_cancellable',
        message: 'This claim is already closed.',
      }
    }

    revalidatePath('/dashboard/claims')
    return { success: true, claimId }
  } catch (error) {
    logger.error('cancelClaimAction failed', {
      action: 'cancelClaimAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Business Reveal
// ---------------------------------------------------------------------------

interface BusinessRevealResult {
  revealed: boolean
  clinic?: ClaimClinic
  /** False when the reveal comes from a claim on another deal from the same clinic. */
  claimedThisDeal?: boolean
  /**
   * The deal's membership plan name, for a member price only. Withheld before a claim because it
   * identifies the clinic (public_offers nulls it, 20260928010004).
   */
  membershipPlan?: string | null
}

/**
 * What a consumer gets back for claiming a deal: the clinic's name, address, phone and website,
 * and on a member price the plan's name (claimed_membership_name(), which applies the same rule).
 *
 * Revealed when the caller has ANY claim on this deal, or on another deal from the same clinic —
 * whatever its status and however old. A claim used to reveal for 7 days and then hide the
 * details again while still blocking a re-claim; the customer had been given the clinic already,
 * so taking it back protected nothing.
 *
 * Being authenticated alone is NOT enough — the caller must have claimed. `phone` is nullable
 * (the backfill leaves unverifiable numbers NULL); businessInfo.tsx renders its absence honestly.
 */
export async function getBusinessRevealAction(
  dealId: number,
): Promise<BusinessRevealResult> {
  try {
    if (!Number.isInteger(dealId)) return { revealed: false }

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { revealed: false }
    }

    // The deal's clinic, so a claim on a sibling deal counts too. Through the public catalogue:
    // a customer has no read on promo_offer_master.
    const { data: offer, error: offerError } = await supabase
      .from(PUBLIC_OFFERS)
      .select('business_id, is_membership_required')
      .eq('id', dealId)
      .maybeSingle()
    if (offerError) {
      logSupabaseError('getBusinessRevealAction', offerError, { dealId })
    }
    const businessId = Number(offer?.business_id)

    const { data: claims, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('consumer_id', user.id)
      .or(
        Number.isInteger(businessId)
          ? `deal_id.eq.${dealId},business_id.eq.${businessId}`
          : `deal_id.eq.${dealId}`,
      )
      .order('created_at', { ascending: false })
      .limit(20)

    if (claimError) {
      logSupabaseError('getBusinessRevealAction', claimError, {
        userId: user.id,
        dealId,
      })
      return { revealed: false }
    }

    const rows = (claims ?? []) as ClaimRow[]
    const own = rows.find((c) => c.deal_id === dealId)
    const claim = own ?? rows[0]
    if (!claim) return { revealed: false }

    const clinic =
      claim.business_snapshot ??
      (await readClinics(supabase, [claim.business_id])).get(claim.business_id)
    if (!clinic) return { revealed: false }

    // The database re-checks the claim (any status, this deal or a sibling) and answers NULL
    // without one, so this cannot hand the name to anyone the reveal above would not.
    let membershipPlan: string | null = null
    if (offer?.is_membership_required) {
      const { data: plan, error: planError } = await supabase.rpc(
        'claimed_membership_name',
        { p_offer_id: dealId },
      )
      if (planError) {
        logSupabaseError('getBusinessRevealAction', planError, {
          userId: user.id,
          dealId,
        })
      }
      membershipPlan = typeof plan === 'string' ? plan : null
    }

    return {
      revealed: true,
      clinic,
      claimedThisDeal: Boolean(own),
      membershipPlan,
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

/**
 * The live directory rows for these clinics, in the snapshot's shape. The fallback for claims
 * made before 20260924010001 is applied; afterwards the snapshot is always present.
 */
async function readClinics(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessIds: number[],
): Promise<Map<number, ClaimClinic>> {
  const { data, error } = await supabase
    .from('master_business_info')
    .select(CLINIC_COLUMNS)
    .in('business_id', [...new Set(businessIds)])

  if (error) {
    logSupabaseError('readClinics', error, { businessIds })
    return new Map()
  }

  return new Map(
    (data ?? []).map((b) => [
      b.business_id as number,
      {
        name: b.name,
        address: b.address,
        city: b.city,
        phone: b.phone,
        website: b.website,
        rating: b.score,
        review_count: b.review_count,
        google_place_id: b.google_place_id,
      },
    ]),
  )
}

function clean(value: string | null | undefined, max: number): string {
  return stripHtml((value ?? '').trim()).slice(0, max)
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
