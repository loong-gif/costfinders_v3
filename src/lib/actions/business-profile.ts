'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
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

interface BusinessProfileUpdatePayload {
  first_name?: string
  last_name?: string
  phone?: string
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
      if (error.code === 'PGRST116') {
        return { success: true, profile: undefined }
      }
      return { success: false, error: error.message }
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
 * Update the business owner's profile fields.
 * Only allows a controlled set of fields. Strips HTML and trims whitespace.
 */
export async function updateBusinessProfileAction(
  updates: BusinessProfileUpdatePayload,
): Promise<BusinessProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const sanitized: Record<string, string> = {}
    const allowedFields: (keyof BusinessProfileUpdatePayload)[] = [
      'first_name',
      'last_name',
      'phone',
    ]

    for (const field of allowedFields) {
      const value = updates[field]
      if (value !== undefined) {
        sanitized[field] = stripHtml(value.trim())
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { data, error } = await supabase
      .from('business_profiles')
      .update(sanitized)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard')

    return { success: true, profile: data as BusinessProfile }
  } catch (error) {
    logger.error('updateBusinessProfileAction failed', {
      action: 'updateBusinessProfileAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Link a business to the current owner's profile.
 * Sets claim_status to 'pending' — admin approval required before 'approved'.
 */
export async function linkBusinessAction(
  businessId: number,
): Promise<BusinessProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify the business exists
    const { data: business, error: bizError } = await supabase
      .from('master_business_info')
      .select('business_id')
      .eq('business_id', businessId)
      .single()

    if (bizError || !business) {
      return { success: false, error: 'Business not found.' }
    }

    const { data, error } = await supabase
      .from('business_profiles')
      .update({
        business_id: businessId,
        claim_status: 'pending' as BusinessClaimStatus,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard')

    return { success: true, profile: data as BusinessProfile }
  } catch (error) {
    logger.error('linkBusinessAction failed', {
      action: 'linkBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Update the business owner's claim status.
 */
export async function updateClaimStatusAction(
  status: BusinessClaimStatus,
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
      .update({ claim_status: status })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard')

    return { success: true, profile: data as BusinessProfile }
  } catch (error) {
    logger.error('updateClaimStatusAction failed', {
      action: 'updateClaimStatusAction',
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
      return { success: false, error: error.message }
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
