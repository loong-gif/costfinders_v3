-- clinic_services, clinic_promotions and clinic_memberships have RLS ENABLED with ZERO
-- policies. RLS with no policy is not an error state -- it is a deny-all that returns an
-- EMPTY RESULT. Measured as `anon` before this migration:
--
--   clinic_services      0 rows visible of  701
--   clinic_promotions    0 rows visible of  245
--   clinic_memberships   0 rows visible of  261
--
-- The cause is the `ensure_rls` event trigger (`rls_auto_enable()`), which runs
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY after every CREATE TABLE in public and adds no
-- policies. The 2026-09-05 normalization created these three tables, so they inherited the
-- wall and never got a door.
--
-- WHY THIS IS A HARD PREREQUISITE, NOT A FOLLOW-UP. The columns the app lost from
-- promo_offer_master -- service_category, promotion_title, campaign_end_date, membership_name,
-- membership_price, source_url -- now live ONLY in these three tables. A PostgREST embed such
-- as
--
--   select=*,promo_offer_items(*,clinic_services(service_category))
--
-- over the publishable key returns rows whose nested array is EMPTY AND RETURNS NO ERROR. The
-- page renders confidently and wrongly. Nothing in the app rewrite can detect that; only a
-- policy fixes it.
--
-- FOR SELECT ONLY, DELIBERATELY. anon currently holds INSERT/UPDATE/DELETE/TRUNCATE on these
-- tables (default Supabase GRANT ALL, never tightened -- 20260909180002 revokes them). Until
-- that revoke lands, RLS is the ONLY gate on anon writes here, so a `FOR ALL USING (true)`
-- policy -- the shape someone reaching for the quick fix would write -- would hand anon full
-- write and TRUNCATE on the catalogue. FOR SELECT grants exactly the read the public offer
-- listing already implies and nothing else.
--
-- USING (true) rather than gating on the parent offer's is_active, unlike the sibling policies
-- on promo_offer_items and promo_offer_price_history. These three are scraped public catalogue
-- data -- a clinic's service list, campaign titles and membership tiers, all already published
-- on the clinic's own website -- and they are joined FROM offers, so the offer-side predicate
-- already decides what is reachable. Gating them again would only make the category facet lose
-- rows for no privacy gain.
--
-- Policy names follow the sibling convention on this schema (`anon_read_active_offer_items`).

create policy "anon_read_clinic_services"
  on public.clinic_services for select to anon, authenticated
  using (true);

create policy "anon_read_clinic_promotions"
  on public.clinic_promotions for select to anon, authenticated
  using (true);

create policy "anon_read_clinic_memberships"
  on public.clinic_memberships for select to anon, authenticated
  using (true);
