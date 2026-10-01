-- Make the homepage's category counts agree with the pages they link to.
--
-- WHAT WAS WRONG
-- `get_offer_category_counts()` feeds `getOfferCategories()` → `getUnifiedCategories()`, which is
-- what the homepage category chips and /treatments are built from. Its WHERE clause carried a
-- hand-copied duplicate of the consumer-browse pricing rule, with a comment saying so:
--
--     -- THE ONE CHANGED LINE. Mirrors offers.ts Rule 1: hide deals with no pricing data.
--     and (coalesce(m.discount_price, 0) > 0 or coalesce(m.regular_price, 0) > 0)
--
-- On 2026-09-16 that rule changed in `src/lib/data/offers.ts`: a stated discount is pricing data,
-- so the predicate gained `discount_percent > 0 OR discount_amount > 0`. Without this migration the
-- rule exists in two languages and they disagree, which is visible on the site in one click:
--
--     homepage chip "Fillers 72"  →  /treatments/fillers lists 123
--     homepage chip "Botox & Neurotoxins 201"  →  /treatments/neurotoxins lists 252
--     homepage chip "Facials & Lasers 64"  →  /treatments/facials-lasers lists 94
--
-- Measured before → after, per category: Neurotoxin 201→252, Dermal Filler 72→123, Facial 27→40,
-- Microneedling 11→27, Laser Hair Removal 25→26, Laser & Light 1→1. The "after" column is exactly
-- what each treatment page already lists, because the page counts rows the TypeScript predicate
-- returns.
--
-- WHY THE DUPLICATION IS NOT REMOVED HERE
-- The honest fix is one predicate, not two. It cannot be a view without either giving up the
-- SQL-side aggregation this function exists for (14 rows instead of 1000+) or moving the rule into
-- a place the pipeline also owns. So the duplicate stays and is marked: if you change the rule in
-- `offers.ts`, you are changing it here too, and `get_city_deal_counts()` carries a THIRD copy.
-- That third one is deliberately not touched — `getCityDealCounts()` in `src/lib/data/unified.ts`
-- stopped calling it because it ignores `is_active` and campaign expiry entirely, so correcting its
-- pricing clause would make a function that is wrong in a bigger way look maintained.
--
-- ONLY THE WHERE CLAUSE CHANGES. The canonical-category CTE (lowest `offer_item_id` wins) is
-- untouched and still mirrors `flattenOffer()`. /api/health canaries this RPC.

create or replace function public.get_offer_category_counts()
returns table(service_category text, count bigint, provider_ids bigint[])
language sql
stable
set search_path to 'public'
as $function$
  with canonical as (
    select distinct on (i.offer_id)
           i.offer_id,
           s.service_category
      from promo_offer_items i
      join clinic_services s on s.service_id = i.service_id
     where s.service_category is not null
     order by i.offer_id, i.offer_item_id
  )
  select c.service_category,
         count(*) as count,
         coalesce(
           array_agg(distinct m.business_id) filter (where m.business_id is not null),
           '{}'::bigint[]
         ) as provider_ids
    from promo_offer_master m
    join canonical c on c.offer_id = m.id
    left join clinic_promotions p on p.promotion_id = m.promotion_id
   where m.is_active
     and (p.campaign_end_date is null or p.campaign_end_date >= current_date)
     -- Mirrors the consumer-browse predicate in src/lib/data/offers.ts. A stated discount IS
     -- pricing data: 161 visible offers advertise a percentage and 144 a dollar amount with no
     -- base price, and 0 visible offers have neither a price nor a discount. Keep the last two
     -- terms in step with that file.
     and (coalesce(m.discount_price, 0) > 0
          or coalesce(m.regular_price, 0) > 0
          or coalesce(m.discount_percent, 0) > 0
          or coalesce(m.discount_amount, 0) > 0)
   group by c.service_category
   order by 2 desc;
$function$;

-- ROLLBACK: re-run this file with the last two `or coalesce(...)` terms deleted. That restores the
-- pre-2026-09-16 counts, and re-opens the contradiction with the treatment pages.
