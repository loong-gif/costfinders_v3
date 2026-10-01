-- Re-grant EXECUTE on public.is_admin() to `authenticated`. Second time; see the note at the
-- bottom about why a third is likely without the governance fix.
--
-- WHAT BROKE
-- Ledger entry `20260911121709 costfinder_p0_p1_completion_repairs` (applied out-of-band via
-- the management API as `postgres`, no file in this repo) ran:
--     REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
-- leaving pg_proc.proacl = {postgres, service_role} while private.is_admin() kept its grant
-- to `authenticated`.
--
-- The app calls the public wrapper over PostgREST — src/proxy.ts, src/lib/auth/guards.ts,
-- src/lib/actions/admin-auth.ts — and PostgREST resolves only the exposed `public` schema.
-- With the grant gone, a real admin's JWT got 403/42501 from /rest/v1/rpc/is_admin,
-- src/proxy.ts read the non-true result as "not an admin", and /admin/dashboard 307'd to `/`
-- for every admin. Verified 2026-09-16: proacl was {postgres=X/postgres,service_role=X/postgres}.
--
-- RLS is unaffected — policies call private.is_admin() directly, which still has its grant.
-- This restores exactly what 20260910030001 granted and nothing more: `anon` and PUBLIC stay
-- revoked, so an anonymous caller still cannot probe admin status.
--
-- The revoke was a reasonable-looking hardening step in isolation. It is wrong only because
-- this wrapper exists specifically to be called over PostgREST by a signed-in admin, which is
-- not visible from the database side. That is a governance problem, not a SQL one: whoever
-- holds the pipeline's credentials needs to know this function is app-required before the
-- next hardening pass (tier B3 of .planning/LAUNCH-PLAN.md).

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated, service_role;
