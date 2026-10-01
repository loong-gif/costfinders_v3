-- public_offers: withhold the two scrubbed texts nothing reads, to keep the catalogue read fast.
--
-- WHY
-- 20260924050001 scrubs every text in the view. EXPLAIN ANALYZE as anon on 2026-09-24, with the
-- whole row serialised as PostgREST does:
--   the corpus page (/, /deals, /treatments/*, sitemap)   393-409 ms
--   the same without the conditions scrub                  342 ms
--   ... and without the promotion_title scrub               245 ms
--   no scrub at all (the floor)                              69 ms
-- This file, applied in a rolled-back transaction and read as anon, warm: corpus 244-261 ms,
-- Newport Beach 35-37 ms, homepage featured 94-96 ms, one deal 3 ms.
-- The rest of the corpus cost is provider_identity_terms() once per row (~144 ms). If more
-- headroom is ever needed, cache the terms per business in a table kept by a trigger on
-- master_business_info (name, website, city); not done, the pages above are ISR.
-- `conditions` (1,348 strings) and `promotion_title` (~600) are read by nothing in the app
-- (src/ has no reader of either off an offer; finePrintFacts() counts the boolean flags). A
-- field nobody reads is safer withheld than scrubbed: scrubbed, it is still the clinic's own
-- verbatim words, searchable on the web.
--
-- WHAT
-- CREATE OR REPLACE VIEW with the same columns, types and order; `conditions` is NULL::text[],
-- `promotion_title` (flat and inside clinic_promotions) is NULL. Everything else is unchanged.
--
-- VERIFY
--   select count(*) filter (where conditions is not null or promotion_title is not null
--                             or clinic_promotions->>'promotion_title' is not null)
--     from public.public_offers;                                   -- 0
--   explain analyze select * from public.public_offers
--    where is_active order by id limit 1000;                       -- ~250 ms
--
-- ROLLBACK: re-run the `create or replace view public.public_offers` statement from
-- 20260924050001_public_catalogue_views.sql.

create or replace view public.public_offers as
select
  o.id,
  public.scrub_identity_terms(o.offer_raw_text, t.terms, t.label) as offer_raw_text,
  o.discount_percent,
  o.discount_amount,
  o.regular_price,
  o.discount_price,
  o.is_membership_required,
  o.created_at,
  o.business_id,
  -- Kept for the row shape, withheld: each joins to a clinic table.
  null::bigint as membership_plan_id,
  null::text as offer_fingerprint,
  null::bigint as promotion_id,
  o.is_active,
  o.is_new_customer_required,
  o.price_model,
  o.updated_at,
  -- Withheld: nothing in the app reads it, and scrubbing its 1,348 strings cost ~60 ms a read.
  null::text[] as conditions,
  o.is_package,
  b.city as business_city,
  public.address_state_code(b.address) as business_state,
  p.campaign_start_date,
  p.campaign_end_date,
  x.promotion_title,
  x.membership_name,
  m.membership_price,
  m.billing_period,
  m.minimum_commitment_months,
  coalesce(items.list, '[]'::jsonb) as promo_offer_items,
  case when p.promotion_id is not null then jsonb_build_object(
    'promotion_title', x.promotion_title,
    'campaign_start_date', p.campaign_start_date,
    'campaign_end_date', p.campaign_end_date,
    'source_url', null
  ) end as clinic_promotions,
  case when m.plan_id is not null then jsonb_build_object(
    'membership_name', x.membership_name,
    'membership_price', m.membership_price,
    'billing_period', m.billing_period,
    'minimum_commitment_months', m.minimum_commitment_months
  ) end as clinic_memberships,
  case when b.business_id is not null then jsonb_build_object(
    'business_id', b.business_id,
    'city', b.city,
    'name', null,
    'website', null,
    'address', null,
    'score', null,
    'review_count', null,
    'category', null
  ) end as master_business_info
from public.promo_offer_master o
left join public.master_business_info b on b.business_id = o.business_id
left join public.clinic_promotions p on p.promotion_id = o.promotion_id
left join public.clinic_memberships m on m.plan_id = o.membership_plan_id
-- The clinic's identity terms and site label once per row, not once per scrubbed field. OFFSET 0
-- keeps the planner from pulling the calls up into every expression that reads them.
cross join lateral (
  select
    public.provider_identity_terms(b.name, b.website, b.city) as terms,
    public.provider_site_label(b.website) as label
  offset 0
) t
cross join lateral (
  select
    -- Withheld: nothing in the app reads it, and scrubbing ~600 titles cost ~100 ms a read.
    null::text as promotion_title,
    case
      when public.scrub_identity_terms(m.membership_name, t.terms, t.label)
           = m.membership_name
      then m.membership_name
    end as membership_name
) x
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'offer_item_id', i.offer_item_id,
      'item_name', public.scrub_identity_terms(i.item_name, t.terms, t.label),
      'delivered_units', i.delivered_units,
      'unit_price', i.unit_price,
      'clinic_services', case when s.service_id is not null then jsonb_build_object(
        'service_category', s.service_category,
        'unit_type', s.unit_type,
        'service_area', s.service_area,
        'source_url', null
      ) end
    )
    order by i.offer_item_id
  ) as list
  from public.promo_offer_items i
  left join public.clinic_services s on s.service_id = i.service_id
  where i.offer_id = o.id
) items on true
where o.is_active;

notify pgrst, 'reload schema';
