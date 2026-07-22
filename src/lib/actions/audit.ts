'use server'

import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function logAdminAction(
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return // silently skip if not authenticated

    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    })
  } catch (error) {
    // Audit logging should never break the main action
    logger.warn('Audit log failed', {
      action: 'logAdminAction',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
