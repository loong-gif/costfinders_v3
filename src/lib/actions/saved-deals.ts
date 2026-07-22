'use server'

import { revalidatePath } from 'next/cache'
import { getDealById } from '@/lib/data/unified'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { AnonymousDeal } from '@/types/deal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedDeal {
  deal_id: number
  saved_at: string
}

interface SavedDealsResult {
  success: boolean
  error?: string
  deals?: SavedDeal[]
}

interface MutationResult {
  success: boolean
  error?: string
}

interface SavedDealsWithDetailsResult {
  success: boolean
  error?: string
  deals?: AnonymousDeal[]
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get all saved deal IDs for the current user.
 */
export async function getSavedDealsAction(): Promise<SavedDealsResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('saved_deals')
      .select('deal_id, saved_at')
      .eq('consumer_id', user.id)
      .order('saved_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      deals: (data ?? []) as SavedDeal[],
    }
  } catch (error) {
    logger.error('getSavedDealsAction failed', {
      action: 'getSavedDealsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch saved deals with full offer details in one server round-trip.
 */
export async function getSavedDealsWithDetailsAction(): Promise<SavedDealsWithDetailsResult> {
  try {
    const savedResult = await getSavedDealsAction()
    if (!savedResult.success) {
      return { success: false, error: savedResult.error }
    }

    const savedRows = savedResult.deals ?? []
    if (savedRows.length === 0) {
      return { success: true, deals: [] }
    }

    const deals = (
      await Promise.all(
        savedRows.map((row) => getDealById(String(row.deal_id))),
      )
    ).filter((deal): deal is AnonymousDeal => deal !== null)

    return { success: true, deals }
  } catch (error) {
    logger.error('getSavedDealsWithDetailsAction failed', {
      action: 'getSavedDealsWithDetailsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Save a deal for the current user.
 * Idempotent — uses the `saved_deals_unique` constraint to skip duplicates.
 */
export async function saveDealAction(dealId: number): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('saved_deals')
      .upsert(
        { consumer_id: user.id, deal_id: dealId },
        { onConflict: 'consumer_id,deal_id', ignoreDuplicates: true },
      )

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/deals')
    revalidatePath('/account/saved')

    return { success: true }
  } catch (error) {
    logger.error('saveDealAction failed', {
      action: 'saveDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Remove a saved deal for the current user.
 */
export async function unsaveDealAction(
  dealId: number,
): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('saved_deals')
      .delete()
      .eq('consumer_id', user.id)
      .eq('deal_id', dealId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/deals')
    revalidatePath('/account/saved')

    return { success: true }
  } catch (error) {
    logger.error('unsaveDealAction failed', {
      action: 'unsaveDealAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Bulk-migrate saved deals from localStorage after a user signs in.
 * Idempotent — skips any deals that are already saved.
 */
export async function migrateLocalDealsAction(
  dealIds: number[],
): Promise<MutationResult> {
  try {
    if (!dealIds.length) {
      return { success: true }
    }

    // Cap at 100 to prevent abuse
    const MAX_MIGRATION = 100
    if (dealIds.length > MAX_MIGRATION) {
      return {
        success: false,
        error: `Cannot migrate more than ${MAX_MIGRATION} deals at once.`,
      }
    }

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // De-duplicate and build rows
    const uniqueIds = [...new Set(dealIds)]
    const rows = uniqueIds.map((deal_id) => ({
      consumer_id: user.id,
      deal_id,
    }))

    const { error } = await supabase.from('saved_deals').upsert(rows, {
      onConflict: 'consumer_id,deal_id',
      ignoreDuplicates: true,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/deals')
    revalidatePath('/account/saved')

    return { success: true }
  } catch (error) {
    logger.error('migrateLocalDealsAction failed', {
      action: 'migrateLocalDealsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
