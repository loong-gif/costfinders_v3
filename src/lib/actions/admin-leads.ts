'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface LeadRelayResult {
  success: boolean
  error?: string
}

interface LeadRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: string
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  relayed_at: string | null
  relayed_by: string | null
  relay_method: string | null
  created_at: string
  // Joined fields
  consumer_email?: string
  deal_title?: string
  business_name?: string
  business_city?: string
}

/**
 * Fetch all claims that haven't been relayed to a business yet.
 */
export async function getUnrelayedLeadsAction(): Promise<{
  success: boolean
  error?: string
  leads?: LeadRow[]
}> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Not authorized' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .is('relayed_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, leads: (data ?? []) as LeadRow[] }
  } catch (error) {
    logger.error('getUnrelayedLeadsAction failed', {
      action: 'getUnrelayedLeadsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch all relayed leads (history).
 */
export async function getRelayedLeadsAction(): Promise<{
  success: boolean
  error?: string
  leads?: LeadRow[]
}> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Not authorized' }
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .not('relayed_at', 'is', null)
      .order('relayed_at', { ascending: false })
      .limit(50)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, leads: (data ?? []) as LeadRow[] }
  } catch (error) {
    logger.error('getRelayedLeadsAction failed', {
      action: 'getRelayedLeadsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Mark a lead as relayed to the business.
 */
export async function markLeadRelayedAction(
  claimId: string,
  method: 'email' | 'phone' | 'manual',
): Promise<LeadRelayResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Not authorized' }
    }

    const { error } = await supabase
      .from('claims')
      .update({
        relayed_at: new Date().toISOString(),
        relayed_by: user.id,
        relay_method: method,
      })
      .eq('id', claimId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard/leads')
    return { success: true }
  } catch (error) {
    logger.error('markLeadRelayedAction failed', {
      action: 'markLeadRelayedAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
