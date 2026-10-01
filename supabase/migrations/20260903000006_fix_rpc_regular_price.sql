-- Fixes the remaining half of GitHub issue #1 (the original_price column drift).
--
-- The TypeScript was corrected in f027d1f, but these two SQL function bodies still
-- referenced o.original_price, so both RPCs returned 42703 and the data layer fell back
-- to client-side aggregation — downloading every offer row to count them. The app looked
-- fine, which is why this survived: the fallback masked it. The rebuilt /api/health
-- endpoint calls both RPCs directly and caught it.
--
-- Also pins search_path, which the database linter flagged on both functions.

create or replace function public.get_city_deal_counts()
returns table(city text, deal_count bigint, provider_count bigint)
language sql
stable
set search_path = public
as $function$
  select
    b.city,
    count(o.id) as deal_count,
    count(distinct o.business_id) as provider_count
  from promo_offer_master o
  join master_business_info b on o.business_id = b.business_id
  where (o.discount_price > 0 or o.regular_price > 0)
    and b.city is not null
    and trim(b.city) <> ''
  group by b.city
  order by deal_count desc;
$function$;

create or replace function public.get_offer_category_counts()
returns table(service_category text, count bigint)
language sql
stable
set search_path = public
as $function$
  select
    service_category,
    count(*) as count
  from promo_offer_master
  where (discount_price > 0 or regular_price > 0)
    and service_category is not null
  group by service_category
  order by count desc;
$function$;
