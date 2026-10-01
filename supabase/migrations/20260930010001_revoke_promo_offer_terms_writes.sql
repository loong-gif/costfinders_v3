-- revoke_promo_offer_terms_writes: only the pipeline writes offer terms, so only the pipeline holds
-- the grant.
--
-- WHY
-- Supabase's default GRANT ALL left anon and authenticated with INSERT, UPDATE, DELETE,
-- REFERENCES and TRIGGER on promo_offer_terms (TRUNCATE went in 20260924050002). RLS was the only
-- thing in the way ("Grants are not RLS", CLAUDE.md). Measured 2026-09-30 as the anon key over
-- REST: POST was refused by the RLS WITH CHECK, and PATCH and DELETE only by the SELECT policy's
-- lookup on promo_offer_master, which anon lost for an unrelated reason in 20260924050002.
--
-- WHAT
-- Nothing in the app reads or writes this table (no reference in src/). The pipeline writes as
-- postgres/service_role and is unaffected. The "Insert/Update/Delete offer terms" policies for
-- admins and approved owners stay, but they are inert without the grant: no app path used them.
-- If an owner terms editor is ever built, grant back exactly the commands it needs.
-- SELECT is unchanged, so admins and owners still read terms through "Read offer terms".
--
-- ROLLBACK: grant insert, update, delete, references, trigger on public.promo_offer_terms to anon, authenticated;
--
-- VERIFY (anon key over REST; each must be 42501 "permission denied for table promo_offer_terms")
--   POST   /rest/v1/promo_offer_terms              {"offer_id":1523}
--   PATCH  /rest/v1/promo_offer_terms?offer_id=eq.-1 {"promo_code":"x"}
--   DELETE /rest/v1/promo_offer_terms?offer_id=eq.-1
-- and as haris+admin and haris+biz, GET /rest/v1/promo_offer_terms?offer_id=eq.1523 returns the row.

revoke insert, update, delete, references, trigger on public.promo_offer_terms from anon, authenticated;

notify pgrst, 'reload schema';
