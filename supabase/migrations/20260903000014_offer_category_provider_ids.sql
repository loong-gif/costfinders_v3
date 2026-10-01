-- The treatments browse grid had no provider figure to show, so
-- treatmentsPageContent.tsx rendered `Math.ceil(count / 2)` -- a fabricated statistic on a
-- live page. It claimed "198 providers" for Fillers; the real number is 58.
--
-- Returning ids rather than a count. The obvious change is to add
-- `count(distinct business_id)`, but the browse grid rolls several service_category values
-- into one bucket (Facial, Laser, Microneedling, Chemical Peel ... all render as
-- "Facials & Lasers"), and per-category counts cannot be summed: a medspa offering both a
-- Facial and a Laser deal is one provider, not two. Summing would replace one invented
-- number with another. The bucket map lives in TypeScript (src/lib/data/categories.ts), so
-- SQL hands back the id set per category and the caller unions them.
--
-- Cheap despite looking otherwise: 334 distinct (service_category, business_id) pairs exist
-- across the whole table, spread over 25 rows. The alternative -- selecting every priced
-- offer's business_id to count distinct values in JS -- is 1400+ rows for the same answer.
--
-- business_id is nullable and array_agg(distinct ...) keeps NULLs, so it is filtered
-- explicitly. Four offers (service_category = 'Massage') have no linked business; that
-- category legitimately reports zero providers rather than one phantom.
--
-- The deal-count semantics are unchanged from the existing function: same price filter,
-- same NULL-category exclusion, same descending order.
--
-- STABLE + explicit search_path, matching get_business_cities and get_city_deal_counts.
-- Not SECURITY DEFINER for the same reason those are not: promo_offer_master's SELECT
-- policy is already open, so a definer would grant nothing and only widen blast radius.

-- Return type changes (a column is added), and Postgres will not replace a set-returning
-- function's signature in place.
drop function if exists public.get_offer_category_counts();

create function public.get_offer_category_counts()
returns table(service_category text, count bigint, provider_ids bigint[])
language sql
stable
set search_path = public
as $$
  select o.service_category,
         count(*) as count,
         coalesce(
           array_agg(distinct o.business_id) filter (where o.business_id is not null),
           '{}'::bigint[]
         ) as provider_ids
    from promo_offer_master o
   where (o.discount_price > 0 or o.regular_price > 0)
     and o.service_category is not null
   group by o.service_category
   order by 2 desc;
$$;

-- The treatments browse grid is public, and this is the same data the anon key already
-- reads through the JS fallback path in getOfferCategories.
grant execute on function public.get_offer_category_counts() to anon, authenticated;

notify pgrst, 'reload schema';
