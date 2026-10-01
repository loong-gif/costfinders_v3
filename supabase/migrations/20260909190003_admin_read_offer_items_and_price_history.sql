-- The admin moderation queue badged all 214 delisted deals "Body" and titled them with a
-- paragraph of raw scrape text.
--
-- promo_offer_items' only SELECT policy gates on the parent offer being live:
--
--   anon_read_active_offer_items  SELECT  to anon, authenticated
--   using (exists (select 1 from promo_offer_master offer
--                   where offer.id = promo_offer_items.offer_id and offer.is_active = true))
--
-- The moderation queue exists precisely to look at offers that are NOT live — it calls
-- getOffersWithBusinessIdentity(), which by design skips the is_active filter. Every delisted
-- offer therefore came back with an EMPTY item array, and RLS returns empty results rather than
-- errors, so nothing failed loudly. Downstream:
--
--   flattenOffer()            → service_name: null, service_category: null
--   … service_name ?? offer_raw_text  → the whole scraped paragraph becomes the card title
--   dbCategoryToTreatment(null)       → 'body', for all 214 rows
--
-- A moderator reviewing 214 identical-looking "Body" cards cannot moderate. Two halves to the
-- fix; this file is the database half. The application half is in the same change:
-- getOffersWithBusinessIdentity() now takes the AUTHENTICATED server client
-- (src/lib/supabase-server.ts) instead of the anon singleton, because a policy that tests
-- is_admin() can only pass for a request that actually carries the admin's session. Consumer
-- paths stay on the anon client — nothing here widens what a signed-out visitor can read.
--
-- promo_offer_price_history carries the identical gap (its policy is the same is_active
-- subquery under a different name), so it gets the same treatment. Nothing reads it in the app
-- today; it is included because the next surface that does will be an admin one — price history
-- is only interesting on an offer whose price changed, which is exactly the offer a moderator or
-- a support agent is looking at, and half a fix leaves the same silent-empty trap armed.
--
-- These are PERMISSIVE policies, so they OR with the existing anon ones: nothing is taken away
-- from anonymous readers of live offers, an extra path is opened for admins. `to authenticated`
-- keeps the check off the anon role's query plans entirely — an anonymous request can never
-- satisfy is_admin() (auth.uid() is null), so evaluating it for anon would be pure cost.
--
-- public.is_admin() is the existing helper (SECURITY DEFINER, STABLE, search_path pinned,
-- `select exists (select 1 from admin_profiles where id = auth.uid())`). Membership in
-- admin_profiles IS the privilege — there is one admin role on this project. It is reused rather
-- than inlining the subquery so a policy can never read the privilege from a client-writable
-- source such as user_metadata.
--
-- ── PRIOR STATE, so this is reversible from the repo alone ─────────────────────────────────
-- Both tables previously had exactly one policy each and no admin path. To revert:
--
--   drop policy if exists admin_read_all_offer_items on public.promo_offer_items;
--   drop policy if exists admin_read_all_price_history on public.promo_offer_price_history;
--
-- The pre-existing policies this migration does not touch, captured verbatim:
--
--   promo_offer_items:
--     anon_read_active_offer_items  SELECT  {anon,authenticated}
--       using (EXISTS ( SELECT 1 FROM promo_offer_master offer
--               WHERE ((offer.id = promo_offer_items.offer_id) AND (offer.is_active = true))))
--
--   promo_offer_price_history:
--     promo_offer_price_history_active_select  SELECT  {anon,authenticated}
--       using (EXISTS ( SELECT 1 FROM promo_offer_master o
--               WHERE ((o.id = promo_offer_price_history.offer_id) AND (o.is_active = true))))
-- ──────────────────────────────────────────────────────────────────────────────────────────

drop policy if exists admin_read_all_offer_items on public.promo_offer_items;
create policy admin_read_all_offer_items
  on public.promo_offer_items
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists admin_read_all_price_history on public.promo_offer_price_history;
create policy admin_read_all_price_history
  on public.promo_offer_price_history
  for select
  to authenticated
  using (public.is_admin());

-- Read-only, deliberately. Nothing an admin does in the moderation queue writes to either
-- table: item rows are the scraper's output and price-history rows are the trigger's
-- (20260909190002). Neither table gets an admin INSERT/UPDATE/DELETE policy until a surface
-- actually needs one.

notify pgrst, 'reload schema';
