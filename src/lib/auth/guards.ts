/**
 * Server-side role guards.
 *
 * Deliberately NOT a `'use server'` module. Every exported async function in a
 * `'use server'` file is a public HTTP endpoint anyone can POST to; these are
 * internal helpers, so they live in a plain module and are imported by the
 * action modules. Same reasoning as src/lib/email/send.ts.
 *
 * Both guards throw on failure. Every caller already wraps its body in
 * try/catch and returns { success: false, error } — the same contract the
 * duplicated per-file verifyAdmin() helpers used.
 */
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Authorize the caller as an admin.
 *
 * The authority is public.is_admin(), a SECURITY DEFINER function that checks
 * for an admin_profiles row with id = auth.uid(). Never user_metadata.role:
 * that field is client-writable — `PUT /auth/v1/user` with
 * `{"data":{"role":"admin"}}` succeeds for any signed-in user and the forged
 * value is then carried in the JWT — so it proves nothing.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) {
    throw new Error('Unauthorized: admin access required')
  }

  return { supabase, user }
}

/**
 * Authorize the caller as a business owner.
 *
 * There is no is_admin() equivalent for businesses. The authority is the
 * existence of a business_profiles row with id = auth.uid(). That row is
 * created only by the handle_new_business_user() trigger on auth.users INSERT,
 * which fires on raw_user_meta_data->>'role' = 'business' AT SIGNUP — so a user
 * who PUTs role='business' onto an existing account never gets one.
 *
 * Deliberately does NOT require claim_status = 'approved'. An owner with a
 * 'none', 'pending' or 'rejected' claim must still reach the dashboard shell,
 * which renders the "connect your business" / "claim under review" / "claim not
 * approved" screens. Requiring approval here would redirect them away and make
 * that entire flow unreachable. Approval is enforced by the dashboard layout
 * and, for writes, by the guard_business_privileged_columns trigger.
 *
 * RLS-safe: business_profiles SELECT is (auth.uid() = id) OR is_admin().
 */
export async function requireBusinessOwner() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    throw new Error('This account is not registered as a business owner.')
  }

  return { supabase, user }
}
