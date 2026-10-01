-- Restore a PostgREST-reachable `public.is_admin()` accessor.
--
-- WHAT BROKE
-- An out-of-band migration applied by the ingest pipeline on 2026-09-10 at 02:05 UTC
-- (`20260910020524 costfinder_p0_security_and_fingerprint_repairs`, no file in this repo)
-- moved `public.is_admin()` into the `private` schema and rewrote all 21 RLS policies to call
-- `private.is_admin()`.
--
-- That half was CORRECT and is deliberately left alone: a SECURITY DEFINER privilege oracle
-- should not sit in the schema PostgREST exposes. All 21 policies now reference
-- `private.is_admin()` and evaluate fine.
--
-- What it did not account for is that the application calls the helper over PostgREST:
--     src/proxy.ts:94                        supabase.rpc('is_admin')
--     src/lib/auth/guards.ts:35              supabase.rpc('is_admin')
--     src/lib/actions/admin-auth.ts:92       supabase.rpc('is_admin')
--     src/lib/actions/admin-deal-moderation.ts:42
-- PostgREST only resolves functions in the exposed (`public`) schema, so every one of those
-- calls started failing PGRST202. `src/proxy.ts` treats a non-true result as "not an admin" and
-- redirects to `/`, which means NO admin could reach /admin/dashboard at all. Verified live:
-- signed in as a real `admin_profiles` member, /admin/dashboard bounced to the homepage.
--
-- THE FIX
-- A thin wrapper in `public` that delegates to the private implementation. This restores the
-- four call sites without undoing the hardening — the logic and the table read stay in
-- `private`, and this wrapper only answers "is the CALLER an admin?" about `auth.uid()`. It
-- discloses nothing about anyone else and cannot be used to enumerate.
--
-- Grants mirror the original `20260903000001_rls_policies_for_admin_tables.sql`: execute for
-- `authenticated`, never for `anon`.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select private.is_admin();
$$;

comment on function public.is_admin() is
  'PostgREST-reachable accessor for private.is_admin(). Answers only whether the CALLING user '
  'is in admin_profiles. The implementation and the table read live in private on purpose; '
  'this exists because src/proxy.ts and requireAdmin() call it via supabase.rpc(). '
  'RLS policies should keep calling private.is_admin() directly.';

-- anon must never be able to probe admin status.
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated, service_role;
