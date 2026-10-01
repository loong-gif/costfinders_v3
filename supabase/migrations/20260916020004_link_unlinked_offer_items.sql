-- Link the unlinked offer items whose title survives the link, and nothing else.
--
-- WHAT THIS RECOVERS
-- 345 of 814 publicly visible offers resolve no service_category, because 511 promo_offer_items
-- rows have service_id IS NULL and flattenOffer() resolves the category through that join. This
-- links 218 of those items across 47 distinct item names, giving **139 visible offers** a correct
-- category for the first time. They stop being badged "Body" and start appearing on the treatment
-- page they belong to.
--
-- THE TAXONOMY IS A FUNCTION, NOT A COLUMN — the single most important thing to know here.
-- `clinic_services.service_category` is a GENERATED STORED column:
--
--     service_category  GENERATED ALWAYS AS (clinic_service_category_for_name(service_name)) STORED
--
-- So a service's category cannot be inserted, updated or chosen per row — it is a pure function of
-- `service_name`, and `public.clinic_service_category_for_name()` is the one place the entire
-- service-to-category taxonomy lives. Adding a `clinic_service_name_enum` member WITHOUT adding a
-- branch to that function makes the CASE fall through to NULL, and the column is NOT NULL, so the
-- first insert of that name fails outright. The function is therefore extended below BEFORE any row
-- is written, and the pair map carries no category, because there is nothing to carry.
--
-- THE TRIGGER THAT SHAPES THIS MIGRATION — read this before extending it
-- promo_offer_items carries 8 triggers. One of them decides what this file is allowed to do:
--
--     sync_promo_offer_item_name()  -- BEFORE INSERT OR UPDATE
--       if new.service_id is null then return new; end if;
--       select service_name::text into v_service_name from clinic_services where service_id = new.service_id;
--       if found then new.item_name := v_service_name; end if;
--
-- Setting service_id OVERWRITES item_name with the linked service's name. And item_name is the deal
-- card title — src/lib/data/offers.ts resolves Title as the item_name of the lowest offer_item_id.
-- So linking is inherently lossy: the title becomes the service's generic name.
--
-- This also corrects a belief recorded in offers.ts, that item_name is "a lossless, strictly wider
-- copy" of service_name with "0 divergences across 1087 rows". There are zero divergences BECAUSE
-- OF THIS TRIGGER, not as a property of the data. Linked items are forced equal to their service
-- name; only UNLINKED items keep the richer scraped text. That is precisely why the uncategorised
-- offers are the ones with the more specific titles.
--
-- SO THIS MIGRATION LINKS ONLY WHERE THE TITLE IS PRESERVED OR IMPROVED. Every pair below satisfies
-- item_name = service_name (Sculptra, Kybella, CO2 Laser, IV Therapy, …) or item_name is a prefix of
-- a strictly more specific service name (BBL → BBL Photofacial, SkinPen → SkinPen Microneedling,
-- Dermaplane → Dermaplaning). No shopper loses information.
--
-- DELIBERATELY NOT LINKED: 115 further item names / 145 items whose title would be replaced by an
-- unrelated word — "NightLase Snoring Treatment" → "Wellness", "EmSculpt NEO" → "Body Contouring",
-- "Gummy Smile" → "Neurotoxin", "Facial Balancing" → "Dermal Filler", "VI Peel" → "Chemical Peel".
-- Categorising those costs 145 public deal titles, which is a product decision and a pipeline-owner
-- conversation (.planning/SCHEMA-GOVERNANCE-ASK.md), not something to slip into a migration. The
-- durable fix is to make sync_promo_offer_item_name() populate item_name only when it IS NULL, so it
-- is a default rather than an override — but that trigger is pipeline-owned.
--
-- THE OTHER SEVEN TRIGGERS WERE CHECKED AGAINST THE REAL ROWS, NOT ASSUMED:
--   deactivate_offer_with_unresolved_item  deactivates an offer when
--     round(unit_price * delivered_units, 2) <> round(discount_price, 2). Of the 424 unlinked items
--     on visible offers, 155 are ones it evaluates and **0** would fail, so 0 offers deactivate.
--     Re-run that count before adding pairs; one mismatch silently removes a live deal.
--   validate_non_package_offer_prices  returns immediately for clinic_services, and enforces the
--     same invariant on items — which 0 rows violate.
--   normalize_promo_offer_item_unit_price / sync_non_package_offer_prices  derive unit_price from
--     the offer's discount_price, which this migration does not touch, so both recompute the value
--     already stored.
--   sync_offer_regular_price_from_service  returns early when the new service has a NULL
--     regular_price, which is how every service below is inserted.
--   fn_recompute_offer_fingerprint_from_items  rewrites offer_fingerprint and updated_at. Expected:
--     the fingerprint is pipeline dedup metadata, and a moved updated_at is correct here.

-- Extend the taxonomy function with the new names. Additions only: every existing branch is
-- reproduced exactly, because CREATE OR REPLACE rewrites the whole body and a dropped branch would
-- silently re-categorise every service already using it.
create or replace function public.clinic_service_category_for_name(p_service clinic_service_name_enum)
returns clinic_service_category_enum
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select (
    case p_service
      when 'Botox' then 'Neurotoxin'
      when 'Dysport' then 'Neurotoxin'
      when 'Xeomin' then 'Neurotoxin'
      when 'Jeuveau' then 'Neurotoxin'
      when 'Daxxify' then 'Neurotoxin'
      when 'Letybo' then 'Neurotoxin'
      when 'Myobloc' then 'Neurotoxin'
      when 'Neurotoxin' then 'Neurotoxin'

      when 'Dermal Filler' then 'Dermal Filler'
      when 'Juvéderm' then 'Dermal Filler'
      when 'Restylane' then 'Dermal Filler'
      when 'Radiesse' then 'Dermal Filler'
      when 'Belotero' then 'Dermal Filler'
      when 'RHA Filler' then 'Dermal Filler'
      when 'Skinvive' then 'Dermal Filler'
      when 'Filler Dissolving' then 'Dermal Filler'
      -- Sculptra is a poly-L-lactic acid biostimulator, not an HA volumiser. Filed under Dermal
      -- Filler anyway: it is sold from the injector menu, priced per vial beside the HAs, and the
      -- six consumer treatment buckets have no home for a biostimulator. The accuracy cost is real
      -- and is accepted deliberately rather than by accident. 42 items, the largest single group.
      when 'Sculptra' then 'Dermal Filler'
      when 'Thread Lift' then 'Dermal Filler'

      when 'Morpheus8' then 'Microneedling'
      when 'RF Microneedling' then 'Microneedling'
      when 'SkinPen Microneedling' then 'Microneedling'
      when 'Sylfirm X' then 'Microneedling'
      when 'Microchanneling' then 'Microneedling'
      when 'Microneedling' then 'Microneedling'

      when 'Hydrafacial' then 'Facial'
      when 'DiamondGlow' then 'Facial'
      when 'Dermaplaning' then 'Facial'
      when 'Glo2 Facial' then 'Facial'
      when 'Facial' then 'Facial'
      -- One member for all peels. "VI Peel", "Quick Peel" and "Perfect Derma Peel" are brands of the
      -- same service; separate members would multiply the enum for no routing difference.
      when 'Chemical Peel' then 'Facial'

      when 'IPL Photofacial' then 'Laser & Light'
      when 'BBL Photofacial' then 'Laser & Light'
      when 'LED Light Therapy' then 'Laser & Light'
      when 'CO2 Laser' then 'Laser & Light'
      when 'CoolPeel' then 'Laser & Light'
      when 'Halo Laser' then 'Laser & Light'
      when 'Moxi Laser' then 'Laser & Light'
      when 'Picoway' then 'Laser & Light'
      when 'Vbeam' then 'Laser & Light'
      when 'ClearSilk' then 'Laser & Light'
      when 'Laser Genesis' then 'Laser & Light'
      when 'Laser Treatment' then 'Laser & Light'
      when 'Tattoo Removal' then 'Laser & Light'
      -- HIFU, TriLift, Venus and PicoWay tightening collapse to one member: same outcome, same page,
      -- same guide. Distinct from 'Laser Treatment' (resurfacing) because the shopper differs.
      when 'Skin Tightening' then 'Laser & Light'

      when 'Laser Hair Removal' then 'Laser Hair Removal'

      when 'NAD Therapy' then 'Wellness'
      when 'IV Therapy' then 'Wellness'
      when 'Vitamin Injection' then 'Wellness'
      when 'Weight Loss' then 'Wellness'
      when 'Hormone Therapy' then 'Wellness'
      when 'Peptide Therapy' then 'Wellness'
      when 'Wellness' then 'Wellness'
      when 'Massage' then 'Wellness'

      -- New category. PRF/PRP/exosomes induce the patient's own collagen and are priced per draw;
      -- not Microneedling (that is the device, sold with no biologic at all) and not Dermal Filler
      -- (that adds exogenous HA volume, priced per syringe).
      when 'Regenerative Injectable' then 'Regenerative Injectable'
      when 'PRP' then 'Regenerative Injectable'
      when 'PRF' then 'Regenerative Injectable'
      when 'Exosome Therapy' then 'Regenerative Injectable'

      -- New category. A device or injection applied to a named body area; not Wellness, which is
      -- systemic. Deliberately NOT split into cryolipolysis / muscle toning / fat dissolving:
      -- different mechanisms, but one shopper, one page and one guide.
      when 'Body Contouring' then 'Body Contouring'
      when 'CoolSculpting' then 'Body Contouring'
      when 'Kybella' then 'Body Contouring'
    end
  )::public.clinic_service_category_enum;
$function$;

-- The 47 title-preserving pairs. A temp table rather than a repeated CTE so the list appears once
-- and both statements below provably use the same one. No category column: it is generated.
create temp table pair_map(
  item_name text primary key,
  service_name text not null
) on commit drop;

insert into pair_map(item_name, service_name) values
    ('BBL', 'BBL Photofacial'),
    ('Belotero', 'Belotero'),
    ('Body Contouring', 'Body Contouring'),
    ('Botox', 'Botox'),
    ('CO2 Laser', 'CO2 Laser'),
    ('Chemical Peel', 'Chemical Peel'),
    ('CoolPeel', 'CoolPeel'),
    ('CoolSculpting', 'CoolSculpting'),
    ('Dermal Filler', 'Dermal Filler'),
    ('Dermaplane', 'Dermaplaning'),
    ('Dermaplaning', 'Dermaplaning'),
    ('DiamondGlow', 'DiamondGlow'),
    ('Exosome', 'Exosome Therapy'),
    ('Facial', 'Facial'),
    ('Glo2Facial', 'Glo2 Facial'),
    ('HALO', 'Halo Laser'),
    ('Halo', 'Halo Laser'),
    ('IPL Photofacial', 'IPL Photofacial'),
    ('IV Therapy', 'IV Therapy'),
    ('Ipl Photofacial', 'IPL Photofacial'),
    ('Kybella', 'Kybella'),
    ('LED Light Therapy', 'LED Light Therapy'),
    ('Laser Genesis', 'Laser Genesis'),
    ('Laser Treatment', 'Laser Treatment'),
    ('MOXI', 'Moxi Laser'),
    ('Massage', 'Massage'),
    ('Micro-channeling', 'Microchanneling'),
    ('Moxi', 'Moxi Laser'),
    ('PRF', 'PRF'),
    ('PRP', 'PRP'),
    ('Pico', 'Picoway'),
    ('Prf', 'PRF'),
    ('RF Microneedling', 'RF Microneedling'),
    ('RHA Filler', 'RHA Filler'),
    ('SYLFIRM X', 'Sylfirm X'),
    ('Sculptra', 'Sculptra'),
    ('Skin Tightening', 'Skin Tightening'),
    ('SkinPen', 'SkinPen Microneedling'),
    ('SkinPen Microneedling', 'SkinPen Microneedling'),
    ('Skinpen Microneedling', 'SkinPen Microneedling'),
    ('Sylfirm X', 'Sylfirm X'),
    ('Tattoo Removal', 'Tattoo Removal'),
    ('Thread Lift', 'Thread Lift'),
    ('VBeam', 'Vbeam'),
    ('Vitamin Injection', 'Vitamin Injection'),
    ('Vitamin Injections', 'Vitamin Injection'),
    ('Wellness', 'Wellness');

-- One service row per (business, service_name) that needs one and does not have one.
-- service_category is omitted because it is generated; regular_price is omitted on purpose, because
-- a non-NULL value fires sync_offer_regular_price_from_service and rewrites
-- promo_offer_master.regular_price from the service catalogue.
insert into public.clinic_services (business_id, service_name)
select distinct
       m.business_id,
       pm.service_name::public.clinic_service_name_enum
  from public.promo_offer_items i
  join public.promo_offer_master m on m.id = i.offer_id
  join pair_map pm on pm.item_name = i.item_name
 where i.service_id is null
   and m.business_id is not null
   and not exists (
     select 1 from public.clinic_services cs
      where cs.business_id = m.business_id
        and cs.service_name = pm.service_name::public.clinic_service_name_enum
   );

-- Link each unlinked item to its business's service row.
-- min(service_id) because clinic_services has NO unique constraint on (business_id, service_name)
-- -- only a PK on service_id and an index on business_id -- so a business can hold two rows with the
-- same name. Aggregating makes the choice deterministic rather than whichever row the planner
-- happened to join.
with resolved as (
  select i.offer_item_id, min(cs.service_id) as service_id
    from public.promo_offer_items i
    join public.promo_offer_master m on m.id = i.offer_id
    join pair_map pm on pm.item_name = i.item_name
    join public.clinic_services cs
      on cs.business_id = m.business_id
     and cs.service_name = pm.service_name::public.clinic_service_name_enum
   where i.service_id is null
   group by i.offer_item_id
)
update public.promo_offer_items i
   set service_id = r.service_id
  from resolved r
 where r.offer_item_id = i.offer_item_id;

-- VERIFY after applying (expect uncategorised visible offers to fall 345 -> ~206):
--   with vis as (
--     select o.id from promo_offer_master o
--     left join clinic_promotions p on p.promotion_id = o.promotion_id
--     where o.is_active and (p.campaign_end_date is null or p.campaign_end_date >= current_date))
--   select count(*) from vis v where not exists (
--     select 1 from promo_offer_items i join clinic_services cs on cs.service_id = i.service_id
--      where i.offer_id = v.id and cs.service_category is not null);
--
-- ROLLBACK: null out the links, then delete the service rows left with no items.
--   update public.promo_offer_items set service_id = null where service_id in (
--     select service_id from public.clinic_services
--      where created_at >= '2026-09-16' and regular_price is null);
--   delete from public.clinic_services cs
--    where cs.created_at >= '2026-09-16' and cs.regular_price is null
--      and not exists (select 1 from public.promo_offer_items i where i.service_id = cs.service_id);
-- The function above reverts by re-running its previous definition, recorded in this file's git
-- history. NOTE the rollback does NOT restore item_name: sync_promo_offer_item_name() overwrote it
-- on the way in and nothing records the previous value. For the pairs in this file the two strings
-- are equal or the stored one is strictly more specific, so there is nothing to restore -- which is
-- exactly why the lossy pairs are excluded.
