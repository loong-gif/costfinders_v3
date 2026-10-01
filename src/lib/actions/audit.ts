'use server'

import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Append one row to admin_audit_log. Never throws into the caller: the admin's write has already
 * landed, and a lost log line must not turn it into a reported failure.
 *
 * The insert result is read, not assumed. supabase-js resolves `{ error }` rather than throwing,
 * so the old bare `await insert(...)` inside try/catch dropped every refused insert (RLS, a bad
 * column) without a trace. A refused insert is now a warning naming the action that lost its row.
 *
 * Callers must `await` this. A floating promise can be cut off when the serverless invocation
 * returns, so an un-awaited call could lose the row with nothing logged either way.
 */
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logger.warn('Audit log skipped: no signed-in user', {
        action: 'logAdminAction',
        auditAction: action,
      })
      return
    }

    const { error } = await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    })

    if (error) {
      logger.warn('Audit log insert refused', {
        action: 'logAdminAction',
        auditAction: action,
        code: error.code,
        error: error.message,
      })
    }
  } catch (error) {
    logger.warn('Audit log failed', {
      action: 'logAdminAction',
      auditAction: action,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
