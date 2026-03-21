'use server'

import { revalidatePath } from 'next/cache'
import {
  claimApprovalEmail,
  claimRejectionEmail,
} from '@/lib/email/templates'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { sendEmailAction } from '@/lib/actions/notifications'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
        created_at: row.created_at as string,
      }
    })

    return { success: true, claims }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Approve a business claim — sets claim_status to 'approved' and
 * verification_status to 'verified'.
 */
export async function approveClaimAction(
  profileId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

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

    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Reject a business claim — sets claim_status to 'rejected'.
 */
export async function rejectClaimAction(
  profileId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('business_profiles')
      .update({
        claim_status: 'rejected',
      })
      .eq('id', profileId)

    if (error) {
      return { success: false, error: error.message }
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

    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}
