-- 20260909190011_revoke_admin_table_write_grants.sql
--
-- Remove the write grants that make admin_profiles one policy away from privilege escalation,
-- and make admin_audit_log actually append-only.
--
-- WHY
-- ---
-- Membership in public.admin_profiles IS the admin privilege: public.is_admin() is
--   select exists (select 1 from public.admin_profiles where id = auth.uid())
-- and every gate on the project resolves through it (src/lib/auth/guards.ts requireAdmin(),
-- src/proxy.ts, and every admin RLS policy on every table).
--
-- Both `anon` and `authenticated` held INSERT/UPDATE/DELETE on that table, covering every
-- column including `role` and `permissions` (information_schema.column_privileges, 2026-09-09).
-- The only thing refusing the write was the absence of an RLS policy. Verified against
-- production with a real non-admin token before this migration:
--
--   POST /rest/v1/admin_profiles {"id":"<own uid>","role":"admin"}
--     -> 403 42501 "new row violates row-level security policy for table admin_profiles"
--   PATCH /rest/v1/admin_profiles?id=eq.<admin uid> {"role":"admin"}
--     -> 200 []          <- SILENT no-op, not a refusal
--
-- So the table was protected by exactly one thing, and the second probe shows the failure mode
-- is quiet. One permissive policy copied in from another table, or one
-- `alter table ... disable row level security` during a repair (this database has had several),
-- and any signed-in user inserts themselves as an admin. Defence in depth belongs at the grant
-- layer, which survives policy edits.
--
-- admin_audit_log had the same shape: `anon` and `authenticated` held UPDATE and DELETE on the
-- audit trail. Its policies are already correct (INSERT and SELECT, both WITH is_admin()), so
-- again only RLS stood between a signed-in user and rewriting or deleting audit history. An
-- audit log that admins can edit is not an audit log.
--
-- No application path needs any of these grants:
--   admin_profiles   - read only, at src/lib/actions/admin-profile.ts:47. Admin rows are
--                      provisioned out of band. is_admin() is SECURITY DEFINER owned by
--                      postgres, so it is unaffected by role grants.
--   admin_audit_log  - INSERT at src/lib/actions/audit.ts:20, SELECT at
--                      src/app/admin/dashboard/data/page.tsx:234. Nothing updates or deletes.
-- The only SQL object touching either table is is_admin() (SECURITY DEFINER, search_path
-- pinned). The only trigger is trg_admin_profiles_updated_at, which fires as part of the
-- statement's own privileges and needs no grant of its own.
--
-- TRAPS AVOIDED (.planning/HANDOFF.md)
-- ------------------------------------
-- 1. Admins authenticate as `authenticated`, so a blanket revoke that removed SELECT would
--    disable the admin console. SELECT is therefore re-granted to `authenticated` below; RLS
--    ("Admins can read own profile", "Admins can read audit log") remains the row filter.
-- 2. Table-level grants silently defeat column-level REVOKE. This migration revokes at TABLE
--    level, which in Postgres also drops the corresponding column-level privileges, so no
--    column grant can survive underneath. Verify with information_schema.column_privileges,
--    not with information_schema.role_table_grants alone.
-- 3. `anon` loses everything. Nothing unauthenticated has any business here, and the health
--    endpoint (src/app/api/health/route.ts) does not probe either table.
--
-- REVERSIBILITY
-- -------------
-- To restore the previous state exactly:
--   GRANT ALL ON public.admin_profiles  TO anon, authenticated;
--   GRANT ALL ON public.admin_audit_log TO anon, authenticated;
-- Nothing is dropped and no data is touched, so the rollback is a pure grant change.

-- admin_profiles: readable by signed-in users (RLS narrows that to their own row), writable
-- by no one but service_role and the table owner.
REVOKE ALL ON public.admin_profiles FROM anon, authenticated;
GRANT SELECT ON public.admin_profiles TO authenticated;

-- admin_audit_log: append-and-read for signed-in users (RLS narrows both to admins), with no
-- way to amend or erase an entry.
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;

COMMENT ON TABLE public.admin_profiles IS
  'Admin roster. Membership IS the admin privilege (see public.is_admin()). Rows are '
  'provisioned out of band: anon and authenticated hold SELECT only, by design — see '
  'migration 20260909190011.';

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only admin action trail. anon and authenticated hold SELECT and INSERT only; UPDATE '
  'and DELETE are not granted to any client role — see migration 20260909190011.';
