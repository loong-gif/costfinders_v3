'use server'

import { revalidatePath } from 'next/cache'
import {
  dealApprovalEmail,
  dealRejectionEmail,
} from '@/lib/email/templates'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { sendEmailAction } from '@/lib/actions/notifications'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ModerationStatus } from '@/types/deal'
import { logger } from '@/lib/logger'
import { logAdminAction } from '@/lib/actions/audit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModerationDeal {
  id: number
  business_id: number | null
  service_name: string | null
  service_category: string | null
  offer_raw_text: string | null
  original_price: number | null
  discount_price: number | null
  discount_percent: number | null
  unit_type: string | null
  template_type: string | null
  start_date: string | null
  end_date: string | null
  eligibility: string | null
  moderation_status: ModerationStatus
  created_at: string | null
  business_name: string | null
}

interface ModerationResult {
  success: boolean
  error?: string
}

interface ModerationDealsResult {
  success: boolean
  error?: string
  deals?: ModerationDeal[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false as const, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { authorized: false as const, error: 'Admin profile not found.' }
  }

  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { authorized: false as const, error: 'Insufficient permissions.' }
  }

  return { authorized: true as const, userId: user.id }
}

const DEAL_SELECT = `
  id,
  business_id,
  service_name,
  service_category,
  offer_raw_text,
  original_price,
  discount_price,
  discount_percent,
  unit_type,
  template_type,
  start_date,
  end_date,
  eligibility,
  moderation_status,
  created_at,
  master_business_info(name)
`

function mapDealRow(row: Record<string, unknown>): ModerationDeal {
  const biz = row.master_business_info as { name: string | null } | null
  return {
    id: row.id as number,
    business_id: row.business_id as number | null,
    service_name: row.service_name as string | null,
    service_category: row.service_category as string | null,
    offer_raw_text: row.offer_raw_text as string | null,
    original_price: row.original_price as number | null,
    discount_price: row.discount_price as number | null,
    discount_percent: row.discount_percent as number | null,
    unit_type: row.unit_type as string | null,
    template_type: row.template_type as string | null,
    start_date: row.start_date as string | null,
    end_date: row.end_date as string | null,
    eligibility: row.eligibility as string | null,
    moderation_status: (row.moderation_status as ModerationStatus) ?? 'approved',
    created_at: row.created_at as string | null,
    business_name: biz?.name ?? null,
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get deals with pending_review moderation status.
 */
export async function getPendingDealsAction(): Promise<ModerationDealsResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const admin = await verifyAdmin(supabase)
    if (!admin.authorized) {
      return { success: false, error: admin.error }
    }

    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(DEAL_SELECT)
      .eq('moderation_status', 'pending_review')
      .order('created_at', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      deals: (data ?? []).map((row) =>
        mapDealRow(row as unknown as Record<string, unknown>),
      ),
    }
  } catch (error) {
    logger.error('getPendingDealsAction failed', {
      action: 'getPendingDealsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get all deals with optional moderation_status filter.
 */
export async function getAllDealsForModerationAction(
  status?: ModerationStatus,
): Promise<ModerationDealsResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const admin = await verifyAdmin(supabase)
    if (!admin.authorized) {
      return { success: false, error: admin.error }
    }

    let query = supabase
      .from('promo_offer_master')
      .select(DEAL_SELECT)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('moderation_status', status)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      deals: (data ?? []).map((row) =>
        mapDealRow(row as unknown as Record<string, unknown>),
      ),
    }
  } catch (error) {
    logger.error('getAllDealsForModerationAction failed', {
      action: 'getAllDealsForModerationAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Approve a deal — sets moderation_status to 'approved'.
 */
export async function approveDealAction(
  dealId: number,
): Promise<ModerationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const admin = await verifyAdmin(supabase)
    if (!admin.authorized) {
      return { success: false, error: admin.error }
    }

    const { error } = await supabase
      .from('promo_offer_master')
      .update({ moderation_status: 'approved' })
      .eq('id', dealId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard/deals')

    // --- Best-effort notifications for business owner ---
    const { data: deal } = await supabase
      .from('promo_offer_master')
      .select('business_id, service_name')
      .eq('id', dealId)
      .single()

    if (deal?.business_id) {
      const { data: owner } = await supabase
        .from('business_profiles')
        .select('id, email, first_name')
        .eq('business_id', deal.business_id)
        .single()

      if (owner) {
        const dealTitle = deal.service_name ?? `Deal #${dealId}`

        createNotificationAction(
          owner.id,
          'deal_approved',
          'Deal approved',
          `Your deal "${dealTitle}" is now live.`,
          '/business/dashboard/deals',
        ).catch(() => {})

        if (owner.email) {
          const ownerName = owner.first_name ?? 'there'
          const { subject, html } = dealApprovalEmail(ownerName, dealTitle)
          sendEmailAction(owner.email, subject, html).catch(() => {})
        }
      }
    }

    logAdminAction('deal_approved', 'deal', String(dealId))
    return { success: true }
  } catch (error) {
    logger.error('approveDealAction failed', {
      action: 'approveDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Reject a deal — sets moderation_status to 'rejected'.
 */
export async function rejectDealAction(
  dealId: number,
  notes?: string,
): Promise<ModerationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const admin = await verifyAdmin(supabase)
    if (!admin.authorized) {
      return { success: false, error: admin.error }
    }

    const { error } = await supabase
      .from('promo_offer_master')
      .update({
        moderation_status: 'rejected',
        moderation_notes: notes || null,
      })
      .eq('id', dealId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard/deals')

    // --- Best-effort notifications for business owner ---
    const { data: deal } = await supabase
      .from('promo_offer_master')
      .select('business_id, service_name')
      .eq('id', dealId)
      .single()

    if (deal?.business_id) {
      const { data: owner } = await supabase
        .from('business_profiles')
        .select('id, email, first_name')
        .eq('business_id', deal.business_id)
        .single()

      if (owner) {
        const dealTitle = deal.service_name ?? `Deal #${dealId}`

        createNotificationAction(
          owner.id,
          'deal_rejected',
          'Deal needs changes',
          `Your deal "${dealTitle}" needs changes before it can go live.`,
          '/business/dashboard/deals',
        ).catch(() => {})

        if (owner.email) {
          const ownerName = owner.first_name ?? 'there'
          const { subject, html } = dealRejectionEmail(
            ownerName,
            dealTitle,
            notes,
          )
          sendEmailAction(owner.email, subject, html).catch(() => {})
        }
      }
    }

    logAdminAction('deal_rejected', 'deal', String(dealId), { notes })
    return { success: true }
  } catch (error) {
    logger.error('rejectDealAction failed', {
      action: 'rejectDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Request changes on a deal — sets moderation_status to 'changes_requested'.
 */
export async function requestDealChangesAction(
  dealId: number,
  notes: string,
): Promise<ModerationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const admin = await verifyAdmin(supabase)
    if (!admin.authorized) {
      return { success: false, error: admin.error }
    }

    const { error } = await supabase
      .from('promo_offer_master')
      .update({
        moderation_status: 'changes_requested',
        moderation_notes: notes || null,
      })
      .eq('id', dealId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard/deals')
    logAdminAction('deal_changes_requested', 'deal', String(dealId), { notes })
    return { success: true }
  } catch (error) {
    logger.error('requestDealChangesAction failed', {
      action: 'requestDealChangesAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
