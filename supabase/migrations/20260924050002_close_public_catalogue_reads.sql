-- Close the catalogue tables to the public key. Step B of two: apply only after the app that
-- reads public.public_offers / public.public_business_directory is deployed (step A,
-- 20260924050001_public_catalogue_views.sql, created them and the policies this relies on).
--
-- WHY
-- Owner decision: a clinic's identity stays hidden until a customer claims a deal. Until this
-- runs, anyone holding the anon key (it ships in every browser) can read master_business_info
-- and join it to promo_offer_master.business_id, and read clinic_services.source_url,
-- clinic_promotions.promotion_title, clinic_memberships.membership_name and raw offer text.
--
-- WHAT
--   1. anon loses SELECT on the six catalogue tables, and the six public/anon SELECT policies go.
--      authenticated keeps its SELECT grant: admins, approved owners and claimants are governed
--      by the policies step A added (plus the existing owner/admin ones on promo_offer_master and
--      promo_offer_items). A signed-in customer reads the catalogue through the views like
--      anyone else, and master_business_info only for a business they claimed.
--   2. The leftover DELETE / REFERENCES / TRIGGER grants on master_business_info go from anon and
--      authenticated. INSERT stays: "Admins can insert businesses" uses it.
--   3. Two side doors to the same identity, found while closing the front one:
--      * v_promotion_content_guardrail_violations, a pipeline QA view owned by postgres, so it
--        reads clinic_promotions past RLS. anon and authenticated held ALL on it: promotion_id,
--        source_url (the clinic's own page) and the promotion text. Nothing in the app reads it.
--      * promo_social_staging: public read ("Enable read access for all users", USING true) of
--        business_id + post_url (the clinic's social post) + promo text. Nothing in the app
--        reads it. The pipeline writes as postgres/service_role and is unaffected.
--
-- Side effects, all intended:
--   * promo_offer_terms and promo_offer_price_history keep their policies, which look up
--     promo_offer_master as the caller. anon now gets 42501 there (no SELECT on the parent), a
--     signed-in customer gets no rows; owners and admins are unchanged. The app reads neither.
--   * The five count RPCs are SECURITY DEFINER since step A, so they still answer anon.
--
-- VERIFY (as the anon key over REST; each must be 401/42501 or [])
--   GET /rest/v1/master_business_info?select=name&limit=1
--   GET /rest/v1/promo_offer_master?select=id&limit=1
--   GET /rest/v1/promo_offer_items?select=item_name&limit=1
--   GET /rest/v1/clinic_services?select=source_url&limit=1
--   GET /rest/v1/clinic_promotions?select=promotion_title&limit=1
--   GET /rest/v1/clinic_memberships?select=membership_name&limit=1
--   GET /rest/v1/v_promotion_content_guardrail_violations?select=source_url&limit=1
--   GET /rest/v1/promo_social_staging?select=post_url&limit=1
-- and these must still answer:
--   GET /rest/v1/public_offers?select=id&limit=1
--   GET /rest/v1/public_business_directory?select=slug&limit=1
--   POST /rest/v1/rpc/get_city_deal_counts
-- In SQL:
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'anon'
--      and table_name in ('promo_offer_master', 'promo_offer_items', 'clinic_services',
--                         'clinic_promotions', 'clinic_memberships', 'master_business_info',
--                         'v_promotion_content_guardrail_violations', 'promo_social_staging');
--   -- expect no SELECT rows
--
-- ROLLBACK:
--   grant select on public.promo_offer_master, public.promo_offer_items, public.clinic_services,
--     public.clinic_promotions, public.clinic_memberships, public.master_business_info to anon;
--   grant references, trigger on public.master_business_info to anon;
--   grant delete, references, trigger on public.master_business_info to authenticated;
--   create policy "Public can read deals that are on the site" on public.promo_offer_master
--     for select to anon, authenticated using (is_active = true);
--   create policy "anon_read_active_offer_items" on public.promo_offer_items
--     for select to anon, authenticated using (exists (select 1 from public.promo_offer_master
--     offer where offer.id = promo_offer_items.offer_id and offer.is_active = true));
--   create policy "anon_read_clinic_services" on public.clinic_services
--     for select to anon, authenticated using (true);
--   create policy "anon_read_clinic_promotions" on public.clinic_promotions
--     for select to anon, authenticated using (true);
--   create policy "anon_read_clinic_memberships" on public.clinic_memberships
--     for select to anon, authenticated using (true);
--   create policy "Enable read access for all users" on public.master_business_info
--     for select to public using (true);
--   grant all on public.v_promotion_content_guardrail_violations to anon, authenticated;
--   grant select on public.promo_social_staging to anon, authenticated;
--   create policy "Enable read access for all users" on public.promo_social_staging
--     for select to public using (true);

-- 1. The six catalogue tables
revoke select on
  public.promo_offer_master,
  public.promo_offer_items,
  public.clinic_services,
  public.clinic_promotions,
  public.clinic_memberships,
  public.master_business_info
from anon;

drop policy "Public can read deals that are on the site" on public.promo_offer_master;
drop policy "anon_read_active_offer_items" on public.promo_offer_items;
drop policy "anon_read_clinic_services" on public.clinic_services;
drop policy "anon_read_clinic_promotions" on public.clinic_promotions;
drop policy "anon_read_clinic_memberships" on public.clinic_memberships;
drop policy "Enable read access for all users" on public.master_business_info;

-- 2. Leftover default grants on master_business_info
revoke delete, references, trigger on public.master_business_info from anon, authenticated;

-- 3. Side doors
revoke all on public.v_promotion_content_guardrail_violations from anon, authenticated;
revoke select on public.promo_social_staging from anon, authenticated;
drop policy "Enable read access for all users" on public.promo_social_staging;

notify pgrst, 'reload schema';

-- Hygiene (orchestrator, 2026-09-24): PostgREST has no TRUNCATE, so this is not an open path, but
-- the default GRANT ALL left it in place. ROLLBACK: grant truncate on public.promo_offer_terms to anon, authenticated;
revoke truncate on public.promo_offer_terms from anon, authenticated;
