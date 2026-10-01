/**
 * Consumer email lookup for admin screens.
 *
 * Deliberately NOT a `'use server'` module, for the reason src/lib/auth/guards.ts gives: every
 * exported async function in one is a public HTTP endpoint. This is a helper the admin actions
 * call after requireAdmin(), so it lives in a plain module next to them.
 *
 * `profiles` has no email column. The address lives in auth.users, which PostgREST does not
 * expose; admin_user_emails() (migration 20260910050001) is a SECURITY DEFINER accessor that
 * raises 42501 for anyone who is not an admin, and 22023 above 200 ids per call
 * (20260910050002). Chunking here means a long list costs extra round trips instead of an error.
 */
import type { requireAdmin } from '@/lib/auth/guards'
import { logSupabaseError, type SupabaseLikeError } from '@/lib/logger'

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

const EMAIL_LOOKUP_BATCH = 200

/**
 * user id → email for the given ids. A failure is returned, never swallowed: falling back to an
 * empty map would render "No email on file" for someone who has one.
 */
export async function fetchUserEmails(
  supabase: AdminClient,
  userIds: string[],
): Promise<{ emails?: Map<string, string>; error?: SupabaseLikeError }> {
  const emails = new Map<string, string>()
  const ids = [...new Set(userIds)]

  for (let i = 0; i < ids.length; i += EMAIL_LOOKUP_BATCH) {
    const batch = ids.slice(i, i + EMAIL_LOOKUP_BATCH)
    const { data, error } = await supabase.rpc('admin_user_emails', {
      p_user_ids: batch,
    })
    if (error) {
      // Logged here because this is the only frame that knows which batch failed.
      logSupabaseError('fetchUserEmails', error, {
        batchStart: i,
        batchSize: batch.length,
        totalIds: ids.length,
      })
      return { error }
    }
    for (const row of (data ?? []) as {
      user_id: string
      email: string | null
    }[]) {
      if (row.email) emails.set(row.user_id, row.email)
    }
  }

  return { emails }
}
