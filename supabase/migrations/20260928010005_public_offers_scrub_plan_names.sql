-- public_offers_scrub_plan_names: the clinic's own wording no longer names its membership plan.
--
-- WHY
-- Owner decision, 2026-09-28: a plan's name is the clinic's, so it waits for a claim.
-- 20260928010004 withheld the membership_name column. The offer's own text still printed it: of
-- 444 visible offers with a named plan, 64 public offer_raw_text values still held their plan's
-- name after the identity scrub ("Glo2 Society Membership: 1 Glo2 Facial per month", 9 rows of
-- "Included DiamondGlow treatment in Best Skin of My Life membership", "Smooth + Sculpt Club —
-- $300 off the first Sylfirm X or Xerf treatment."), and the identity scrub left pieces of the
-- plan names that contain the clinic's ("Vault Membership: …", "Premium Up Membership: …").
--
-- WHAT
--   1. private.plan_generic_words(): the words a plan name can be made of and still identify no
--      clinic. Plan words (membership, club, VIP, tier …), tier names (the metals and gems,
--      starter, basic, essential, deluxe, premium, elite, signature …), billing words (monthly,
--      annual …), audience (male, female …), neurotoxin shorthand (tox, injectable …), a few
--      connectors (the, and, of), roman numerals, and every word of every service-name and
--      category enum value (Botox, Hydrafacial, Skin, Hormone …). Numbers are generic too
--      (checked in plan_name_patterns, not listed).
--   2. private.plan_name_patterns(name, generic words): NULL when every word of the name is
--      generic ("Botox Membership", "Deluxe Hydrafacial Membership", "Gold", "Starter $150",
--      "Male Hormone Gold"), and such a row's text is never touched. Otherwise, over the name less
--      a trailing "Membership", regex-escaped, whitespace-tolerant, case-insensitive, whole words:
--        [1] a leading label: "<name>[ Membership]" then ":", "—", "–", "|" or " -";
--        [2] any other mention, with an article before it and a "membership" after it;
--        [3] the name's longest word, lower-cased, a cheap test that skips the regexes.
--      A one-word name ("Glow", "BEAUTY", "Radiate"; "The Works" counts as one) matches [2] only
--      when "membership" follows it, so ordinary prose ("Glow facial $99") keeps its word.
--   3. private.scrub_plan_name(text, patterns): strips [1], turns [2] into "the membership", and
--      capitalises the first letter of a changed text. A label that was the whole text becomes
--      "The membership".
--   4. public.public_offers: CREATE OR REPLACE with the same columns, types and order as
--      20260928010004. offer_raw_text and every promo_offer_items.item_name pass through the plan
--      scrub BEFORE the identity scrub, so a plan named after the clinic comes out whole ("Belle
--      Âme Bank Membership — 15% off all purchases." -> "15% off all purchases.", where the
--      identity scrub alone left "Bank Membership — …"). Everything else is unchanged.
--
-- The helpers live in `private`, which PostgREST does not expose, so the API surface (and the
-- generated types) do not change. anon, authenticated and service_role get EXECUTE because a
-- function in a view is checked against the reader, not the view's owner; the vocabulary is an
-- argument because plpgsql resolves names as the reader, who has no USAGE on `private`. No
-- search_path, for the reason in 20260924050001 § 1: they read no table, and a SET clause costs a
-- save/restore per call.
--
-- Effect on 2026-09-28: 43 of 947 active offers change text, 0 item names. 26 are the
-- distinctive plans among the 64 (Best Skin of My Life 9, TOX & More 6, Skin Goals 4, Monthly
-- Glow 2, Smooth + Sculpt 2, Glo2 Society, B Transformed, B Rejuvenated); 17 are what the
-- identity scrub left of plans named after the clinic (Belle Âme Bank 6, NakedMD Members Club 2,
-- Premium/Signature GLO Up 4, BlueWater 2, Seranova 2, Skinjectables Vault). The other 38 of the
-- 64 carry a generic name and are untouched. Pricing: every visible offer's price, basis, lead,
-- tier, reasons, notes, comparable price, neurotoxin brand and product line was taken through the
-- app's own adapters before and after applying; on every offer in both, only the offer text and
-- subtitle changed. But 938 visible became 934: forShoppers() (src/lib/data/offers.ts) collapses
-- cards a shopper cannot tell apart, and four were apart only by the plan's name. Kept -> gone:
-- 10299 ($160/mo plan) -> 10302 ($199/mo), 10317 ($129) -> 10318 ($199), and 10319/10320 ($249)
-- -> 10340/10341 ($59): at business 2528 the $11-a-unit card now leads to the $249 plan, not the
-- $59 one. forShoppers keeps the lowest id; keeping the cheapest plan is its fix, not this file's.
--
-- Anon read time, whole row serialised as PostgREST does (json_agg over select *), 2026-09-28,
-- five reads each (the first is cold). "Before" is 010004 live; "after" is this file live, and a
-- rolled-back dry run of it beforehand gave the same. The cost is the plpgsql call on the rows
-- whose plan is distinctive (253 of 947); the longest-word test keeps the regexes to the ~45 texts
-- that can match. Without it the corpus read cost ~55 ms more, compiling ~140 regexes a read.
--                          before (010004)   after (this file)
--   corpus (947 rows)      237-265 ms        257-282 ms     warm ~241 -> ~260
--   Newport Beach (156)    31-39 ms          37-41 ms       warm ~31 -> ~37
--   one deal (8107)        0.9-2.6 ms        0.9-3.6 ms     warm ~0.9 either way
--
-- VERIFY
--   -- no distinctive plan's name is left in its own offer's public text or items: 0
--   select count(*) from public.public_offers po
--     join public.promo_offer_master o on o.id = po.id
--     join public.clinic_memberships m on m.plan_id = o.membership_plan_id
--     cross join lateral (select private.plan_name_patterns(m.membership_name,
--                                private.plan_generic_words()) as p) x
--    where x.p is not null
--      and (po.offer_raw_text ~* x.p[2] or po.promo_offer_items::text ~* x.p[2]);
--   select private.scrub_plan_name(
--     'Included Tixel treatment in Best Skin of My Life membership',
--     private.plan_name_patterns('Best Skin of My Life', private.plan_generic_words()));
--                                               -- 'Included Tixel treatment in the membership'
--   select private.plan_name_patterns('Deluxe Hydrafacial Membership',
--                                     private.plan_generic_words());               -- NULL
--
-- ROLLBACK:
--   re-run the `create or replace view public.public_offers` statement from
--   20260928010004_public_offers_withhold_membership_name.sql, then
--   drop function if exists private.scrub_plan_name(text, text[]);
--   drop function if exists private.plan_name_patterns(text, text[]);
--   drop function if exists private.plan_generic_words();

-- ponytail: declared IMMUTABLE although it reads the two service enums, as
-- public.provider_generic_terms() does, so the planner folds it to a constant once per plan. A
-- member the pipeline adds reaches it on the next plan; until then a plan named only after that
-- treatment is scrubbed, never leaked.
create or replace function private.plan_generic_words()
returns text[]
language sql
immutable
parallel safe
return (
  select array_agg(distinct w)
    from (
      select unnest(array[
        -- what a plan is called
        'membership','memberships','member','members','club','clubs','plan','plans','program',
        'programs','programme','package','packages','subscription','tier','tiers','level',
        'levels','vip',
        -- tier names
        'bronze','silver','gold','platinum','diamond','sapphire','crystal','ruby','emerald',
        'titanium','starter','basic','basics','essential','essentials','standard','plus',
        'premium','deluxe','elite','signature',
        -- billing
        'monthly','annual','yearly','month','months','year','years',
        -- audience
        'male','female','men','women',
        -- neurotoxin and injectable shorthand the enums spell out
        'tox','toxin','toxins','neurotoxins','injectable','injectables','fillers','facials',
        -- connectors and roman numerals ("Tier II")
        'the','and','of','a','an','i','ii','iii','iv','v'
      ]) as w
      union all
      select unnest(regexp_split_to_array(lower(e), '[^[:alnum:]]+'))
        from unnest(
          enum_range(null::public.clinic_service_name_enum)::text[]
          || enum_range(null::public.clinic_service_category_enum)::text[]
        ) e
    ) words
   where w <> ''
);

-- plpgsql rather than SQL: its expressions are planned once per connection. The SQL form ran a
-- subquery per call, ~85 us a plan. The vocabulary comes in as an argument, plan_generic_words()
-- folded to a constant where the view calls it: plpgsql resolves names at run time as the reader,
-- and anon has no USAGE on `private`.
create or replace function private.plan_name_patterns(p_name text, p_generic text[])
returns text[]
language plpgsql
immutable
parallel safe
as $fn$
declare
  v_core text := btrim(regexp_replace(btrim(coalesce(p_name, '')), '\s+membership$', '', 'i'));
  v_word text;
  v_key text := '';
  v_distinctive boolean := false;
  v_rx text;
begin
  foreach v_word in array regexp_split_to_array(lower(v_core), '[^[:alnum:]]+') loop
    if v_word <> '' and v_word !~ '^[0-9]+$'
       and not v_word = any (p_generic) then
      v_distinctive := true;
    end if;
    if length(v_word) > length(v_key) then
      v_key := v_word;
    end if;
  end loop;
  if not v_distinctive then
    return null;
  end if;

  v_rx := regexp_replace(
    regexp_replace(v_core, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'),
    '\s+', '\\s+', 'g'
  );
  return array[
    '^\s*(?:the\s+)?' || v_rx || '(?:\s+membership)?(?:\s*[:—–|]|\s+-)\s*',
    '(?<![[:alnum:]])(?:(?:the|our|your|a|an)\s+)?' || v_rx
      || case when regexp_replace(v_core, '^the\s+', '', 'i') ~ '\s'
              then '(?:\s+membership)?'
              else '\s+membership'
         end
      || '(?![[:alnum:]])',
    -- [3] the name's longest word, lower-cased: a text without it cannot match, so the two
    -- regexes above never run on it (compiling them was most of this file's read cost).
    v_key
  ];
end;
$fn$;

create or replace function private.scrub_plan_name(p_text text, p_patterns text[])
returns text
language plpgsql
immutable
parallel safe
as $fn$
declare
  v_out text;
begin
  if p_text is null or p_patterns is null or strpos(lower(p_text), p_patterns[3]) = 0 then
    return p_text;
  end if;
  v_out := coalesce(nullif(regexp_replace(p_text, p_patterns[1], '', 'i'), ''), p_text);
  v_out := regexp_replace(v_out, p_patterns[2], 'the membership', 'gi');
  if v_out = p_text then
    return p_text;
  end if;
  return upper(left(v_out, 1)) || substr(v_out, 2);
end;
$fn$;

revoke all on function private.plan_generic_words() from public;
revoke all on function private.plan_name_patterns(text, text[]) from public;
revoke all on function private.scrub_plan_name(text, text[]) from public;
grant execute on function private.plan_generic_words() to anon, authenticated, service_role;
grant execute on function private.plan_name_patterns(text, text[])
  to anon, authenticated, service_role;
grant execute on function private.scrub_plan_name(text, text[]) to anon, authenticated, service_role;

create or replace view public.public_offers as
select
  o.id,
  public.scrub_identity_terms(
    case when pn.patterns is null then o.offer_raw_text
         else private.scrub_plan_name(o.offer_raw_text, pn.patterns) end,
    t.terms, t.label
  ) as offer_raw_text,
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
-- The plan's name patterns once per row, NULL for no plan or a generic one (see WHAT 2).
cross join lateral (
  select case when m.membership_name is not null
              then private.plan_name_patterns(m.membership_name, private.plan_generic_words())
         end as patterns
  offset 0
) pn
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
      'item_name', public.scrub_identity_terms(
        case when pn.patterns is null then i.item_name
             else private.scrub_plan_name(i.item_name, pn.patterns) end,
        t.terms, t.label
      ),
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
