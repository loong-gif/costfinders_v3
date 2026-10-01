'use server'

import { revalidatePath } from 'next/cache'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type {
  BusinessClaimStatus,
  BusinessVerificationStatus,
} from '@/types/businessOwner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  business_id: number | null
  verification_status: BusinessVerificationStatus
  claim_status: BusinessClaimStatus
  created_at: string
  updated_at: string
}

interface BusinessProfileResult {
  success: boolean
  error?: string
  profile?: BusinessProfile
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch the authenticated business owner's profile row.
 */
export async function getBusinessProfileAction(): Promise<BusinessProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      logSupabaseError('getBusinessProfileAction', error, { userId: user.id })
      if (error.code === 'PGRST116') {
        return { success: true, profile: undefined }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load your business profile.",
        ),
      }
    }

    return { success: true, profile: data as BusinessProfile }
  } catch (error) {
    logger.error('getBusinessProfileAction failed', {
      action: 'getBusinessProfileAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Update the business owner's verification status.
 */
export async function updateVerificationStatusAction(
  status: BusinessVerificationStatus,
): Promise<BusinessProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('business_profiles')
      .update({ verification_status: status })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      logSupabaseError('updateVerificationStatusAction', error, {
        userId: user.id,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't update your verification status.",
        ),
      }
    }

    revalidatePath('/business/dashboard')

    return { success: true, profile: data as BusinessProfile }
  } catch (error) {
    logger.error('updateVerificationStatusAction failed', {
      action: 'updateVerificationStatusAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
