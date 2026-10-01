'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { logAdminAction } from '@/lib/actions/audit'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { requireAdmin } from '@/lib/auth/guards'
import { sendEmail } from '@/lib/email/send'
import { claimApprovalEmail, claimRejectionEmail } from '@/lib/email/templates'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessClaim {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  business_id: number | null
  business_name: string | null
  business_city: string | null
  claim_status: string
  verification_status: string
  verification_method: string | null
  evidence_document_url: string | null
  created_at: string
}

interface ClaimsResult {
  success: boolean
  error?: string
  claims?: BusinessClaim[]
}

interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Resolve the claim to act on when the caller passed only a profile id.
 *
 * The admin UI can call approve/reject with either. Doing the lookup here keeps the
 * definer functions addressed by claim id, which is what lets them lock a single row.
 */
async function findPendingClaimId(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  profileId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('business_claims')
    .select('id')
    .eq('profile_id', profileId)
    .in('status', ['pending', 'code_sent', 'verified'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logSupabaseError('findPendingClaimId', error, { userId: profileId })
    return null
  }
  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch business claims with optional status filter.
 * Joins master_business_info for business name/city.
 */
export async function getBusinessClaimsAction(
  status?: string,
): Promise<ClaimsResult> {
  try {
    const { supabase } = await requireAdmin()

    let query = supabase
      .from('business_profiles')
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        business_id,
        claim_status,
        verification_status,
        created_at,
        master_business_info (
          name,
          city
        ),
        business_claims (
          verification_method,
          evidence_document_url
        )
      `,
      )
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('claim_status', status)
    }

    const { data, error } = await query

    if (error) {
      logSupabaseError('getBusinessClaimsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load business claims."),
      }
    }

    const claims: BusinessClaim[] = (data ?? []).map(
      (row: Record<string, unknown>) => {
        const bizInfo = row.master_business_info as Record<
          string,
          unknown
        > | null
        // business_claims is an array (one-to-many); take the first/latest entry
        const claimRows = row.business_claims as
          | Record<string, unknown>[]
          | null
        const latestClaim = claimRows?.[0] ?? null
        return {
          id: row.id as string,
          email: row.email as string,
          first_name: row.first_name as string | null,
          last_name: row.last_name as string | null,
          business_id: row.business_id as number | null,
          business_name: (bizInfo?.name as string) ?? null,
          business_city: (bizInfo?.city as string) ?? null,
          claim_status: row.claim_status as string,
          verification_status: row.verification_status as string,
          verification_method:
            (latestClaim?.verification_method as string) ?? null,
          evidence_document_url:
            (latestClaim?.evidence_document_url as string) ?? null,
          created_at: row.created_at as string,
        }
      },
    )

    return { success: true, claims }
  } catch (err) {
    logger.error('getBusinessClaimsAction failed', {
      action: 'getBusinessClaimsAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Approve a business claim — updates the business_claims row and
 * links the business to the owner's profile.
 *
 * @param profileId - The business_profiles.id (user ID) of the claimant
 * @param claimId - Optional business_claims.id for direct row update
 * @param adminNotes - Optional notes from the admin reviewer
 */
export async function approveClaimAction(
  profileId: string,
  claimId?: string,
  adminNotes?: string,
): Promise<ActionResult> {
  try {
    const { supabase, user: adminUser } = await requireAdmin()

    // One transaction, not four sequential writes. The old sequence updated
    // business_profiles first — the write that actually grants privilege — then
    // downgraded a failed business_claims update to logger.warn, so a partial approval
    // could leave the profile saying 'approved' while the claim still said 'pending'.
    // The function re-checks is_admin() itself and locks the claim row: an RPC is a
    // public endpoint, and two admins approving at once must serialise.
    const targetClaimId =
      claimId ?? (await findPendingClaimId(supabase, profileId))

    if (!targetClaimId) {
      return { success: false, error: 'No pending claim found for this owner.' }
    }

    const { error } = await supabase.rpc('approve_business_claim', {
      p_claim_id: targetClaimId,
      p_admin_notes: adminNotes ?? null,
    })

    if (error) {
      logSupabaseError('approveClaimAction', error, { userId: adminUser.id })
      return {
        success: false,
        error:
          error.code === '23505'
            ? 'This business already has an approved owner.'
            : publicErrorMessage(error, "We couldn't approve this claim."),
      }
    }

    revalidatePath('/admin/dashboard/businesses')

    // --- Best-effort notifications for business owner ---
    createNotificationAction(
      profileId,
      'claim_approved',
      'Business claim approved',
      'Your business claim has been approved. You now have full dashboard access.',
      '/business/dashboard',
    ).catch(() => {})

    // Fetch profile email + name for the email notification
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('email, first_name, business_id')
      .eq('id', profileId)
      .single()

    if (profile?.email) {
      const ownerName = profile.first_name ?? 'there'
      // Get business name for the email
      let businessName = 'your business'
      if (profile.business_id) {
        const { data: biz } = await supabase
          .from('master_business_info')
          .select('name')
          .eq('business_id', profile.business_id)
          .single()
        if (biz?.name) businessName = biz.name
      }
      const { subject, html } = claimApprovalEmail(ownerName, businessName)
      // after(), not a floating `.catch(() => {})` — see sendEmail's docblock. The approval
      // is already written; sendEmail logs any failure under this action name.
      const recipient = profile.email
      // business_profiles.id is the owner's auth user id; the opt-out check needs it (the caller is the admin).
      after(() =>
        sendEmail(recipient, subject, html, 'approveClaimAction', {
          recipientUserId: profileId,
        }),
      )
    }

    await logAdminAction('claim_approved', 'claim', String(profileId))
    return { success: true }
  } catch (err) {
    logger.error('approveClaimAction failed', {
      action: 'approveClaimAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Reject a business claim — updates the business_claims row and
 * sets claim_status to 'rejected' on the profile.
 *
 * @param profileId - The business_profiles.id (user ID) of the claimant
 * @param claimId - Optional business_claims.id for direct row update
 * @param adminNotes - Optional notes explaining the rejection
 */
export async function rejectClaimAction(
  profileId: string,
  claimId?: string,
  adminNotes?: string,
): Promise<ActionResult> {
  try {
    const { supabase, user: adminUser } = await requireAdmin()

    // 1. Update business_profiles claim_status
    const { error } = await supabase
      .from('business_profiles')
      .update({
        claim_status: 'rejected',
      })
      .eq('id', profileId)

    if (error) {
      logSupabaseError('rejectClaimAction', error, { userId: adminUser.id })
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't reject this claim."),
      }
    }

    const targetClaimId =
      claimId ?? (await findPendingClaimId(supabase, profileId))

    if (!targetClaimId) {
      return { success: false, error: 'No pending claim found for this owner.' }
    }

    const { error: rejectError } = await supabase.rpc('reject_business_claim', {
      p_claim_id: targetClaimId,
      p_admin_notes: adminNotes ?? null,
    })

    if (rejectError) {
      logSupabaseError('rejectClaimAction', rejectError, {
        userId: adminUser.id,
      })
      return {
        success: false,
        error: publicErrorMessage(
          rejectError,
          "We couldn't reject this claim.",
        ),
      }
    }

    revalidatePath('/admin/dashboard/businesses')

    // --- Best-effort notifications for business owner ---
    createNotificationAction(
      profileId,
      'claim_rejected',
      'Business claim not approved',
      'Unfortunately, your business claim was not approved. Please contact support for more information.',
      '/business',
    ).catch(() => {})

    // Fetch profile email + name for the email notification
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('email, first_name, business_id')
      .eq('id', profileId)
      .single()

    if (profile?.email) {
      const ownerName = profile.first_name ?? 'there'
      let businessName = 'your business'
      if (profile.business_id) {
        const { data: biz } = await supabase
          .from('master_business_info')
          .select('name')
          .eq('business_id', profile.business_id)
          .single()
        if (biz?.name) businessName = biz.name
      }
      const { subject, html } = claimRejectionEmail(ownerName, businessName)
      // See approveClaimAction above for why this is after() rather than a dead .catch().
      const recipient = profile.email
      after(() =>
        sendEmail(recipient, subject, html, 'rejectClaimAction', {
          recipientUserId: profileId,
        }),
      )
    }

    await logAdminAction('claim_rejected', 'claim', String(profileId))
    return { success: true }
  } catch (err) {
    logger.error('rejectClaimAction failed', {
      action: 'rejectClaimAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Listing requests ("add my business", "fix this listing", removals)
// ---------------------------------------------------------------------------

export interface ListingRequest {
  id: string
  business_id: number | null
  offer_id: number | null
  request_type: string
  business_name: string
  contact_name: string
  contact_email: string
  contact_role: string | null
  page_url: string | null
  details: string
  status: string
  created_at: string
  updated_at: string
}

/**
 * The newest listing requests. Read under the existing "Admins can read listing requests"
 * policy (SELECT USING private.is_admin()); anyone may insert one from the public form.
 */
export async function getListingRequestsAction(): Promise<{
  success: boolean
  error?: string
  requests?: ListingRequest[]
}> {
  try {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase
      .from('listing_requests')
      .select(
        'id, business_id, offer_id, request_type, business_name, contact_name, contact_email, contact_role, page_url, details, status, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      logSupabaseError('getListingRequestsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load listing requests."),
      }
    }
    return { success: true, requests: (data ?? []) as ListingRequest[] }
  } catch (err) {
    logger.error('getListingRequestsAction failed', {
      action: 'getListingRequestsAction',
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}

/**
 * Mark a listing request handled.
 *
 * The table already has the vocabulary for this: status CHECK (new, in_review, actioned,
 * declined). "Handled" is `actioned`, and updated_at records when, so no handled_at column is
 * added. updated_at has no trigger on this table, so it is set here.
 */
export async function markListingRequestHandledAction(
  requestId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase
      .from('listing_requests')
      .update({ status: 'actioned', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('id, status')

    if (error) {
      logSupabaseError('markListingRequestHandledAction', error, { requestId })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't update this listing request.",
        ),
      }
    }
    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'That request was not updated. It may have been removed.',
      }
    }

    await logAdminAction(
      'listing_request_handled',
      'listing_request',
      requestId,
    )
    revalidatePath('/admin/dashboard/businesses')
    return { success: true }
  } catch (err) {
    logger.error('markListingRequestHandledAction failed', {
      action: 'markListingRequestHandledAction',
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}

// ---------------------------------------------------------------------------
// Business contact corrections
// ---------------------------------------------------------------------------

export interface BusinessContactInput {
  phone: string
  website: string
  address: string
  city: string
}

export interface BusinessContact {
  business_id: number
  phone: string | null
  phone_source: string | null
  website: string | null
  address: string | null
  city: string | null
}

const CONTACT_MIGRATION_PENDING =
  'Editing contact details needs database migration 20260924020002, which has not been applied yet. Nothing was changed.'

/** US numbers only, stored as E.164 like the pipeline writes them (see src/lib/utils/phone.ts). */
function toE164(input: string): { phone: string | null } | { error: string } {
  const trimmed = input.trim()
  if (!trimmed) return { phone: null }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return { phone: `+1${digits}` }
  if (digits.length === 11 && digits.startsWith('1'))
    return { phone: `+${digits}` }
  return { error: 'Enter a 10-digit US phone number, or leave it empty.' }
}

function toWebsite(
  input: string,
): { website: string | null } | { error: string } {
  const trimmed = input.trim()
  if (!trimmed) return { website: null }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes('.') || withScheme.length > 500)
      throw new Error()
    return { website: withScheme }
  } catch {
    return {
      error: 'Enter a website address like clinic.com, or leave it empty.',
    }
  }
}

/**
 * Correct a business's phone, website, address or city.
 *
 * master_business_info belongs to the ingestion pipeline. Migration 20260924020002 is the agreed
 * exception: admins may update exactly these columns (plus phone_source), and nothing else.
 * phone_source becomes 'admin' whenever the phone changes, so the pipeline can tell a hand
 * correction from its own value. The pipeline may still overwrite an edit on its next import.
 *
 * Only changed fields are written, and the row is selected back. Zero rows back means the
 * UPDATE policy is not there yet (RLS filters silently); 42501 means the column grant is not.
 */
export async function updateBusinessContactAction(
  businessId: number,
  input: BusinessContactInput,
): Promise<{ success: boolean; error?: string; business?: BusinessContact }> {
  try {
    const { supabase } = await requireAdmin()

    if (!Number.isInteger(businessId)) {
      return { success: false, error: 'That is not a business id.' }
    }
    const phone = toE164(String(input?.phone ?? ''))
    if ('error' in phone) return { success: false, error: phone.error }
    const website = toWebsite(String(input.website ?? ''))
    if ('error' in website) return { success: false, error: website.error }
    const address = String(input.address ?? '').trim() || null
    const city = String(input.city ?? '').trim()
    if (!city) {
      return {
        success: false,
        error:
          "City can't be empty: it decides which city page the business is listed on.",
      }
    }
    if ((address?.length ?? 0) > 300 || city.length > 100) {
      return { success: false, error: 'That address or city is too long.' }
    }

    const { data: current, error: readError } = await supabase
      .from('master_business_info')
      .select('phone, website, address, city')
      .eq('business_id', businessId)
      .maybeSingle()
    if (readError) {
      logSupabaseError('updateBusinessContactAction.read', readError, {
        businessId,
      })
      return {
        success: false,
        error: publicErrorMessage(readError, "We couldn't read this business."),
      }
    }
    if (!current)
      return { success: false, error: 'That business could not be found.' }

    const patch: Record<string, string | null> = {}
    if (phone.phone !== current.phone) {
      patch.phone = phone.phone
      patch.phone_source = 'admin'
    }
    if (website.website !== current.website) patch.website = website.website
    if (address !== current.address) patch.address = address
    if (city !== current.city) patch.city = city
    if (Object.keys(patch).length === 0) {
      return { success: false, error: 'Nothing changed, so nothing was saved.' }
    }

    const { data, error } = await supabase
      .from('master_business_info')
      .update(patch)
      .eq('business_id', businessId)
      .select('business_id, phone, phone_source, website, address, city')

    if (error) {
      logSupabaseError('updateBusinessContactAction', error, { businessId })
      if (error.code === '42501')
        return { success: false, error: CONTACT_MIGRATION_PENDING }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't save the business's contact details.",
        ),
      }
    }
    if (!data || data.length === 0) {
      return { success: false, error: CONTACT_MIGRATION_PENDING }
    }

    await logAdminAction(
      'business_contact_edited',
      'business',
      String(businessId),
      {
        fields: Object.keys(patch).join(', '),
      },
    )
    revalidatePath('/admin/dashboard/businesses')
    revalidatePath('/admin/dashboard/leads')
    return { success: true, business: data[0] as BusinessContact }
  } catch (err) {
    logger.error('updateBusinessContactAction failed', {
      action: 'updateBusinessContactAction',
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}
