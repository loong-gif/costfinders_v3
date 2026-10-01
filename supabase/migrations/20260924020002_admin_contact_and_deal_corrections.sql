-- Admin corrections: a business's contact details, and a deal's title and unit count.
--
-- THE DATA TEAM'S STANDING RULE, AND THIS EXCEPTION
-- The data team's standing rule is "no writes to master_business_info except the service role":
-- the ingestion pipeline owns the directory. This policy is the agreed exception for admin
-- corrections. An admin relaying a customer's claim by phone has to be able to fix a wrong phone
-- number or website on the spot (a live row links its Facebook field to an unrelated page). The
-- exception is exactly five columns (phone, phone_source, website, address, city), for
-- private.is_admin() only. The app writes phone_source = 'admin' whenever an admin changes the
-- phone, so the pipeline can recognise a hand correction and choose not to overwrite it. Nothing
-- here stops the pipeline from overwriting one; that is the data team's call.
--
-- master_business_info
--   `authenticated` held the table-level UPDATE from Supabase's default GRANT ALL, and there was
--   NO UPDATE policy, so every app UPDATE was silently filtered to zero rows. A table-level grant
--   defeats a column-level REVOKE, so the table grant is revoked first and the five columns are
--   granted back. phone_source is plain text with no check constraint (live values:
--   website_html, google_business_profile, null), so 'admin' needs no enum change.
--   Side effect: the owner "edit my business" action (src/lib/actions/business-data.ts) used to
--   get zero rows back and now gets 42501 for name/category. It already reported failure.
--
-- promo_offer_items
--   `authenticated` held SELECT only. UPDATE is granted on two columns, admin rows only:
--     item_name        the deal's title (lowest offer_item_id wins, src/lib/data/offers.ts)
--     delivered_units  the count behind "$299 for 40 units" (offerPriceBasis, src/lib/data/adapters.ts)
--   Triggers that fire on those columns and write promo_offer_master as the caller
--   (fn_recompute_offer_fingerprint_from_items, deactivate_offer_with_unresolved_item, and the
--   SELECT ... FOR UPDATE in normalize_promo_offer_item_unit_price) are covered by the admin's
--   existing UPDATE policy on promo_offer_master. The others are SECURITY DEFINER.
--
-- promo_offer_master: NO CHANGE
--   Policy "Admins can update deal moderation" is FOR UPDATE USING / WITH CHECK
--   private.is_admin() with no column list, and `authenticated` holds table UPDATE, so
--   discount_price, regular_price, price_model and offer_raw_text are already admin-writable.
--   Checked live on 2026-09-24.

revoke update on public.master_business_info from authenticated;
grant update (phone, phone_source, website, address, city)
  on public.master_business_info to authenticated;

drop policy if exists "Admins can correct business contact details"
  on public.master_business_info;
create policy "Admins can correct business contact details"
  on public.master_business_info
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant update (item_name, delivered_units)
  on public.promo_offer_items to authenticated;

drop policy if exists "Admins can correct offer item titles and units"
  on public.promo_offer_items;
create policy "Admins can correct offer item titles and units"
  on public.promo_offer_items
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ROLLBACK:
-- drop policy if exists "Admins can correct offer item titles and units" on public.promo_offer_items;
-- revoke update (item_name, delivered_units) on public.promo_offer_items from authenticated;
-- drop policy if exists "Admins can correct business contact details" on public.master_business_info;
-- revoke update (phone, phone_source, website, address, city) on public.master_business_info from authenticated;
-- grant update on public.master_business_info to authenticated;  -- restores the pre-migration table grant
