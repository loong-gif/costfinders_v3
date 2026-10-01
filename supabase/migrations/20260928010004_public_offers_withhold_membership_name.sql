-- public_offers_withhold_membership_name: a membership plan's name is the clinic's, so it waits
-- for a claim like the rest of the clinic's identity.
--
-- WHY
-- Owner decision, 2026-09-28. 20260924050001/050003 withheld a plan name only when it carried the
-- clinic's own name ("NakedMD Members Club"). Every other name went out before a claim: the
-- deal page's Membership block printed "Club FX" on /deals/8107, and "Club FX" is one web search
-- from DermFx (business 3310). A plan name is a clinic's own coinage, so it identifies the clinic
-- whether or not it repeats the clinic's name. The 2026-09-24 principle is identity hidden before a
-- claim in the UI AND at the database API, and anon read `membership_name` straight off this view
-- (flat, and inside the `clinic_memberships` jsonb): 365 of 947 rows on 2026-09-28.
--
-- WHAT
--   1. public.public_offers: CREATE OR REPLACE VIEW with the same columns, types and order as
--      20260924050003; `membership_name` is NULL both as the flat column and inside
--      `clinic_memberships`. Everything else is unchanged. The fee, billing period and minimum
--      commitment stay (owner decision: the fee on the deal page is fine).
--   2. public.claimed_membership_name(p_offer_id bigint): the offer's plan name, returned only
--      when the caller has a claim, of any status and age, on this deal or on another deal of the
--      same business (the rule getBusinessRevealAction applies to the clinic's details); NULL
--      otherwise. SECURITY DEFINER because a consumer has no read on promo_offer_master or
--      clinic_memberships. Execute is authenticated only. claims.business_id cannot be forged:
--      trg_claims_keep_revealed_details sets it from the deal on insert.
--
-- Anon read time, warm, whole row serialised as PostgREST does (json_agg over select *), 2026-09-28.
-- "After" is this view created in a rolled-back DO block and read as anon; one scrub call a row
-- goes away with the name:
--                        before (050003)   after (this file)
--   corpus (947 rows)    244-264 ms        211-225 ms
--   Newport Beach        34-36 ms          30-32 ms
--   one deal (8107)      1-3 ms            1-2 ms
--
-- VERIFY
--   select count(*) filter (where membership_name is not null
--                             or clinic_memberships->>'membership_name' is not null)
--     from public.public_offers;                                                   -- 0
--   begin; set local role anon;
--   select public.claimed_membership_name(8107);                                    -- 42501
--   rollback;
--
-- ROLLBACK:
--   drop function if exists public.claimed_membership_name(bigint);
--   then re-run the `create or replace view public.public_offers` statement from
--   20260924050003_public_offers_withhold_unread_text.sql.

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
    -- Withheld before a claim: the plan's name is the clinic's own. claimed_membership_name()
    -- returns it to a customer who has claimed.
    null::text as membership_name
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

create or replace function public.claimed_membership_name(p_offer_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(m.membership_name), '')
    from public.promo_offer_master o
    join public.clinic_memberships m on m.plan_id = o.membership_plan_id
   where o.id = p_offer_id
     and exists (
       select 1
         from public.claims c
        where c.consumer_id = (select auth.uid())
          and (c.deal_id = o.id or c.business_id = o.business_id)
     )
$$;

comment on function public.claimed_membership_name(bigint) is
  'The offer''s membership plan name, only for a caller with a claim (any status) on this deal or another deal of the same business; NULL otherwise. public_offers withholds it. See 20260928010004.';

revoke all on function public.claimed_membership_name(bigint) from public, anon;
grant execute on function public.claimed_membership_name(bigint) to authenticated;

notify pgrst, 'reload schema';
