'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { AdminRole } from '@/types/admin'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: AdminRole
  permissions: string[] | null
  created_at: string
  updated_at: string
}

interface AdminProfileResult {
  success: boolean
  error?: string
  profile?: AdminProfile
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch the authenticated admin's profile row.
 */
export async function getAdminProfileAction(): Promise<AdminProfileResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, profile: undefined }
      }
      return { success: false, error: error.message }
    }

    return { success: true, profile: data as AdminProfile }
  } catch (error) {
    logger.error('getAdminProfileAction failed', {
      action: 'getAdminProfileAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
