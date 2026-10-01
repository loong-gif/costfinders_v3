-- All six offer tables grant the full default set to BOTH anon and authenticated:
--
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- on promo_offer_master, promo_offer_items, promo_offer_price_history, clinic_services,
-- clinic_promotions and clinic_memberships. That is Supabase's default GRANT ALL, never
-- tightened. Verified in information_schema.role_table_grants immediately before this file was
-- written.
--
-- The consequence in one sentence: the publishable anon key, which ships in the browser
-- bundle of every page, can TRUNCATE promo_offer_master. RLS is the only thing standing in
-- front of it -- and on the three clinic_* tables RLS was, until 20260909180001, a deny-all
-- that nobody had noticed, so the first person to "fix the empty catalogue" with a permissive
-- FOR ALL policy would have handed those grants straight to the internet. Revoking the grant
-- removes that whole failure mode: no policy anyone writes later can grant a privilege the
-- role does not hold.
--
-- WHAT MUST SURVIVE, AND WHY THIS IS NOT A BLANKET REVOKE.
--
-- Business owners legitimately write promo_offer_master as `authenticated` -- they create,
-- edit and delete their own deals through createDealAction / updateDealAction /
-- deleteDealAction (src/lib/actions/deal-management.ts:236, :342, :389). Three RLS policies
-- exist for exactly that traffic ("Owners can create deals for their business", "Owners can
-- update their own deals", "Owners can delete their own deals") and a fourth, "Admins can
-- update deal moderation", carries the admin queue. A policy is useless without the
-- underlying grant, so INSERT/UPDATE/DELETE stay for `authenticated` on promo_offer_master
-- ONLY. Revoking them there would silently kill the owner dashboard: PostgREST answers a
-- privilege-less write with 401/permission denied, and RLS-shaped failures on this table have
-- already been mistaken for working code once (see 20260903000008).
--
-- Nothing else has a legitimate end-user writer. promo_offer_items, promo_offer_price_history
-- and the three clinic_* tables are written by the ingestion pipeline, which connects as
-- `service_role` -- proven two ways: none of the five has any INSERT/UPDATE/DELETE policy at
-- all (so an end-user write is denied by RLS even with the grant), and grep over src/ and
-- scripts/ finds zero references to any of them. service_role's grants are untouched here, so
-- ingestion is unaffected.
--
-- ONE CORRECTION TO THAT, MEASURED, BECAUSE IT LOOKS LIKE THIS MIGRATION'S FAULT AND IS NOT.
-- promo_offer_price_history has a second, INDIRECT writer: the AFTER UPDATE trigger
-- trg_promo_offer_price_history on promo_offer_master runs
-- record_promo_offer_price_history(), which is SECURITY *INVOKER* (prosecdef = false), so its
-- INSERT executes with the privileges of whoever did the UPDATE -- including a business owner
-- editing their own deal's price as `authenticated`. After this migration such an edit fails
-- with `42501 permission denied for table promo_offer_price_history`.
--
-- That path was ALREADY broken before this migration and this REVOKE is not what broke it.
-- Proven by restoring the grant and retrying as the owner (jwt sub set, role authenticated):
--
--   owner PRICE edit, INSERT grant present  -> 42501 new row violates row-level security
--                                              policy for table "promo_offer_price_history"
--   owner NON-PRICE edit                    -> succeeded
--   direct owner INSERT into audit table    -> 42501 (same RLS denial)
--
-- The audit table has RLS on and exactly one policy, SELECT. With no INSERT policy the
-- trigger's insert is denied at the RLS layer whether or not the grant exists, so the grant
-- was never the thing making owner price edits work -- nothing was. All this REVOKE changes is
-- WHICH of the two denials the caller sees (grant, now, instead of RLS).
--
-- ponytail: NOT fixed here -- it is a pre-existing defect in a different object and outside
-- this migration's remit. The correct fix is one line,
-- `alter function public.record_promo_offer_price_history() security definer`, which is also
-- strictly SAFER than granting INSERT: the trigger builds its row from OLD/NEW so it cannot be
-- used to forge audit entries, and `authenticated` then needs neither the grant nor an INSERT
-- policy. Ship that as its own migration; do not "fix" it by re-granting INSERT here, which
-- would reopen direct writes to the audit log and still leave the RLS denial in place.
--
-- anon needs write on nothing at all. There is no anonymous write path anywhere in the app.
--
-- REFERENCES and TRIGGER go too. Neither is "read": REFERENCES lets a role point a foreign key
-- at the table and TRIGGER lets it attach a trigger. Both are inert today only because anon
-- and authenticated lack CREATE on the schema. They are part of the same never-tightened
-- default and there is no caller for either.

-- promo_offer_master: anon loses everything but SELECT; authenticated keeps the three
-- privileges its owner-write policies depend on.
revoke insert, update, delete, truncate, references, trigger
  on public.promo_offer_master from anon;
revoke truncate, references, trigger
  on public.promo_offer_master from authenticated;

-- The other five: service_role-only writers, so both end-user roles keep SELECT and lose the
-- rest.
revoke insert, update, delete, truncate, references, trigger
  on public.promo_offer_items,
     public.promo_offer_price_history,
     public.clinic_services,
     public.clinic_promotions,
     public.clinic_memberships
  from anon, authenticated;

-- A GRANT/REVOKE is not DDL, so the `pgrst_ddl_watch` event trigger does NOT fire and
-- PostgREST would keep serving the old privilege set from its cached schema. This NOTIFY is
-- load-bearing here in a way it is not in a migration that also runs DDL.
notify pgrst, 'reload schema';
