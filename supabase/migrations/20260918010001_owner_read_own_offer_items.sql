-- Business owners can read the line items of their own deals, including deals off the site.
--
-- WHY THIS EXISTS
-- promo_offer_items had two SELECT policies: `anon_read_active_offer_items` (any caller, only
-- while the parent offer is_active) and `admin_read_all_offer_items`. Owners had a read policy on
-- promo_offer_master ("Owners can read their business offers") but none here, so every deal of
-- theirs that is off the site reached /business/dashboard/deals with an EMPTY item list.
--
-- The items are where the offer graph keeps what a price buys (delivered_units) and which service
-- it is (→ clinic_services.service_category / unit_type). With none, flattenOffer() resolves no
-- category, no unit and item_count 0, so offerPriceBasis() correctly declines to state a basis:
-- the owner saw "$1,049" and a blank category for "100 units Botox for Underarms $1049", while
-- the admin screen showed "$1,049 for 100 units" for the same row. On 2026-09-18 all 49 of
-- business 765's deals were off the site, so the owner saw no item for any of them (0 of 49).
--
-- THE RULE
-- Exactly the owner rule promo_offer_master already uses — an approved business_profiles row for
-- the offer's business — reached through the offer. The subquery reads promo_offer_master and
-- business_profiles under the caller's own RLS, so an owner can reach only the offers they could
-- already read; this adds no row an owner could not already see the parent of.
--
-- Grants: `anon` and `authenticated` hold SELECT only on this table (checked in
-- information_schema.role_table_grants), so a SELECT policy is the whole change. No write path
-- is opened.
--
-- Rollback: drop policy "Owners can read their business offer items" on public.promo_offer_items;
-- (restores the empty item lists on owners' off-site deals, nothing else).

create policy "Owners can read their business offer items"
  on public.promo_offer_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.promo_offer_master offer
      join public.business_profiles bp on bp.business_id = offer.business_id
      where offer.id = promo_offer_items.offer_id
        and bp.id = (select auth.uid())
        and bp.claim_status = 'approved'
    )
  );
