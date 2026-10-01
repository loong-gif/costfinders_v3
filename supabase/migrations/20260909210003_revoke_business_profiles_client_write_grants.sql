-- 20260909210003_revoke_business_profiles_client_write_grants.sql
--
-- Take INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER on public.business_profiles away
-- from the two client roles. `authenticated` keeps SELECT and UPDATE; `anon` keeps nothing.
--
-- WHY
-- ---
-- public.business_profiles is the business-owner authority on this project. Existence of a
-- row with id = auth.uid() IS "this session may use the business dashboard" (src/proxy.ts,
-- src/lib/auth/guards.ts requireBusinessOwner()), and `business_id` + `claim_status =
-- 'approved'` is what the deal-write policies on promo_offer_master and the deal-image
-- storage policies (20260909210002) resolve through.
--
-- Grants as found on 2026-09-10 (information_schema.role_table_grants):
--   anon           DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
--   authenticated  DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- RLS carries only four policies, all TO authenticated: SELECT and UPDATE for the owner
-- (auth.uid() = id) and SELECT and UPDATE for is_admin(). There is no INSERT policy and no
-- DELETE policy — so RLS was the only thing refusing those two, and it refuses them
-- silently. TRUNCATE is worse: TRUNCATE is not row-level at all, so RLS never sees it.
-- The publishable anon key ships in the client bundle, which means the grant list above says
-- the anon key may empty the table that holds every business owner.
--
-- Attacked live before this migration, in a transaction deliberately aborted so the rows
-- came back (business_profiles held one row at the time — the fixture for 20260909210002):
--
--   set local role anon; truncate table public.business_profiles;
--     -> 0A000 cannot truncate a table referenced in a foreign key constraint
--        (the privilege check PASSED; only the FK to business_claims stopped it)
--   set local role anon; truncate table public.business_profiles cascade;
--     -> succeeded, table left holding 0 rows, then rolled back
--
-- That is the whole finding: one statement from the key in every visitor's browser and every
-- business owner loses their dashboard, their deal-write access and their image folder.
--
-- WHAT STILL NEEDS A GRANT, AND WHY THE REST DOES NOT
-- ---------------------------------------------------
-- Rows are NOT created by a client. public.handle_new_business_user() — SECURITY DEFINER,
-- search_path pinned, owned by postgres — inserts them from the on_business_user_created
-- trigger on auth.users when raw_user_meta_data->>'role' = 'business'. A SECURITY DEFINER
-- function runs with the owner's privileges, so revoking INSERT from the client roles does
-- not touch signup. Verified below by actually signing a new business account up.
--
-- Every one of the 17 call sites in src/ is a SELECT or an UPDATE (grep `.from('business_
-- profiles')`): reads in src/proxy.ts, src/lib/auth/guards.ts, pricingHubHeader.tsx,
-- business-auth.ts, business-claims.ts, business-data.ts, deal-images.ts, deal-management.ts,
-- messaging.ts, admin-*.ts; updates only in business-profile.ts:119 (owner edits their own
-- profile), business-profile.ts:161 and admin-actions.ts:263 (admin). Nothing inserts and
-- nothing deletes. approve_business_claim() and reject_business_claim() are both SECURITY
-- DEFINER and unaffected.
--
-- TRAPS AVOIDED (.planning/HANDOFF.md, and migration 20260909190011)
-- ------------------------------------------------------------------
-- 1. Admins authenticate as `authenticated`, not as a role of their own. A blanket revoke
--    that dropped SELECT or UPDATE would break the admin claim-approval screens as well as
--    every owner. Both are re-granted below; RLS stays the row filter and
--    trg_guard_business_profiles_privileged stays the column filter (it already refuses a
--    non-admin who tries to write claim_status, verification_status, business_id or tier*).
-- 2. Table-level grants silently defeat column-level REVOKE. `anon` and `authenticated` each
--    held column-level INSERT/REFERENCES/SELECT (+UPDATE) on all 12 columns underneath the
--    table grant. REVOKE ALL at TABLE level drops those too; a column-only revoke would have
--    left them. Verify with information_schema.column_privileges, not role_table_grants alone.
-- 3. `anon` loses SELECT as well. No unauthenticated path reads this table: every call site
--    is behind getUser() or a session cookie. /api/health does probe it, and already treats
--    42501 as proof the table exists (src/app/api/health/route.ts DENIED_CODES) — it was
--    getting an empty result before, since no RLS policy grants anon anything anyway.
--
-- REVERSIBILITY
-- -------------
-- To restore the previous state exactly:
--   GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
--     ON public.business_profiles TO anon;
--   GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     ON public.business_profiles TO authenticated;
-- Grants only — no DDL, no data touched.

REVOKE ALL ON public.business_profiles FROM anon, authenticated;

-- Owners read and edit their own row; admins read and edit any. RLS narrows the rows,
-- trg_guard_business_profiles_privileged narrows the columns, and rows are created only by
-- handle_new_business_user() (SECURITY DEFINER) at signup.
GRANT SELECT, UPDATE ON public.business_profiles TO authenticated;

COMMENT ON TABLE public.business_profiles IS
  'Business-owner authority: a row with id = auth.uid() IS business-dashboard access, and '
  'business_id + claim_status = ''approved'' is what the deal-write and deal-image policies '
  'resolve through. Rows are inserted only by handle_new_business_user() (SECURITY DEFINER) '
  'on auth.users insert. anon holds nothing; authenticated holds SELECT and UPDATE only — '
  'see migration 20260909210003.';
