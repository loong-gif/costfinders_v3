'use server'

import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/actions/audit'
import type { Profile } from '@/lib/actions/profile'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsumersResult {
  success: boolean
  error?: string
  consumers?: Profile[]
}

interface CountResult {
  success: boolean
  error?: string
  count?: number
}

interface ActionResult {
  success: boolean
  error?: string
}

interface ConsumerFilters {
  status?: string
  verificationStatus?: string
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
 * Fetch all consumer profiles with optional filters.
 */
export async function getConsumersAction(
  filters?: ConsumerFilters,
): Promise<ConsumersResult> {
  try {
    const { supabase } = await verifyAdmin()

    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.verificationStatus) {
      query = query.eq('verification_status', filters.verificationStatus)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, consumers: (data ?? []) as Profile[] }
  } catch (err) {
    logger.error('getConsumersAction failed', {
      action: 'getConsumersAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Update a consumer's account status (active / suspended).
 */
export async function updateConsumerStatusAction(
  userId: string,
  status: 'active' | 'suspended',
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard/users')
    logAdminAction('user_status_updated', 'user', userId, { status })
    return { success: true }
  } catch (err) {
    logger.error('updateConsumerStatusAction failed', {
      action: 'updateConsumerStatusAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Get total consumer count from profiles table.
 */
export async function getConsumerCountAction(): Promise<CountResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, count: count ?? 0 }
  } catch (err) {
    logger.error('getConsumerCountAction failed', {
      action: 'getConsumerCountAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

/**
 * Get count of pending business claims from business_profiles table.
 */
export async function getPendingClaimsCountAction(): Promise<CountResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { count, error } = await supabase
      .from('business_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('claim_status', 'pending')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, count: count ?? 0 }
  } catch (err) {
    logger.error('getPendingClaimsCountAction failed', {
      action: 'getPendingClaimsCountAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}
