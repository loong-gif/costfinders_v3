'use server'

import { revalidatePath } from 'next/cache'
import {
  claimApprovalEmail,
  claimRejectionEmail,
} from '@/lib/email/templates'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { sendEmailAction } from '@/lib/actions/notifications'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { logAdminAction } from '@/lib/actions/audit'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const role = user.user_metadata?.role as string | undefined
  if (role !== 'admin') {
    throw new Error('Unauthorized: admin access required')
  }

  return { supabase, user }
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
    const { supabase } = await verifyAdmin()

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
      return { success: false, error: error.message }
    }

    const claims: BusinessClaim[] = (data ?? []).map((row: Record<string, unknown>) => {
      const bizInfo = row.master_business_info as Record<string, unknown> | null
      // business_claims is an array (one-to-many); take the first/latest entry
      const claimRows = row.business_claims as Record<string, unknown>[] | null
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
        verification_method: (latestClaim?.verification_method as string) ?? null,
        evidence_document_url: (latestClaim?.evidence_document_url as string) ?? null,
        created_at: row.created_at as string,
      }
    })

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
    const { supabase, user: adminUser } = await verifyAdmin()

    // 1. Update business_profiles claim_status + verification_status
    const { error } = await supabase
      .from('business_profiles')
      .update({
        claim_status: 'approved',
        verification_status: 'verified',
      })
      .eq('id', profileId)

    if (error) {
      return { success: false, error: error.message }
    }

    // 2. Update business_claims row if claimId provided, or find by profile_id
    const claimQuery = claimId
      ? supabase
          .from('business_claims')
          .update({
            status: 'approved',
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', claimId)
      : supabase
          .from('business_claims')
          .update({
            status: 'approved',
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', profileId)
          .eq('status', 'pending')

    const { error: claimUpdateError } = await claimQuery

    if (claimUpdateError) {
      // Log but don't fail — the primary profile update already succeeded
      logger.warn('Failed to update business_claims row on approval', {
        action: 'approveClaimAction',
        error: claimUpdateError.message,
      })
    }

    // 3. Link business_id from business_claims to business_profiles if not already set
    const { data: claimRow } = await supabase
      .from('business_claims')
      .select('business_id')
      .eq('profile_id', profileId)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (claimRow?.business_id) {
      await supabase
        .from('business_profiles')
        .update({ business_id: claimRow.business_id })
        .eq('id', profileId)
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
      sendEmailAction(profile.email, subject, html).catch(() => {})
    }

    logAdminAction('claim_approved', 'claim', String(profileId))
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
    const { supabase, user: adminUser } = await verifyAdmin()

    // 1. Update business_profiles claim_status
    const { error } = await supabase
      .from('business_profiles')
      .update({
        claim_status: 'rejected',
      })
      .eq('id', profileId)

    if (error) {
      return { success: false, error: error.message }
    }

    // 2. Update business_claims row
    const claimQuery = claimId
      ? supabase
          .from('business_claims')
          .update({
            status: 'rejected',
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', claimId)
      : supabase
          .from('business_claims')
          .update({
            status: 'rejected',
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', profileId)
          .eq('status', 'pending')

    const { error: claimUpdateError } = await claimQuery

    if (claimUpdateError) {
      logger.warn('Failed to update business_claims row on rejection', {
        action: 'rejectClaimAction',
        error: claimUpdateError.message,
      })
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
      sendEmailAction(profile.email, subject, html).catch(() => {})
    }

    logAdminAction('claim_rejected', 'claim', String(profileId))
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
