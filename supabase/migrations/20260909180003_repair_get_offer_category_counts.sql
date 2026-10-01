-- get_offer_category_counts() is 100% broken and has been since the 2026-09-05 normalization
-- dropped promo_offer_master.service_category:
--
--   SELECT * FROM public.get_offer_category_counts() LIMIT 1;
--   -- ERROR: 42703: column o.service_category does not exist
--   -- CONTEXT: SQL function "get_offer_category_counts" during startup
--
-- LANGUAGE sql means the body is parsed at function startup, so it fails on EVERY call before
-- reading a single row -- there is no partially-working path. EXECUTE is granted to anon, so
-- every anonymous visitor of the treatments browse grid gets that 42703.
--
-- The definition being replaced is tracked at
-- supabase/migrations/20260903000014_offer_category_provider_ids.sql:33-47 and read
-- `from promo_offer_master o ... where o.service_category is not null group by
-- o.service_category`. The column now lives on clinic_services, two joins away.
--
-- SIGNATURE IS PRESERVED EXACTLY: table(service_category text, count bigint,
-- provider_ids bigint[]). provider_ids must stay an ARRAY OF DISTINCT business ids and must not
-- become count(distinct business_id), for the reason migration 14 documented and which the
-- taxonomy rewrite makes stronger, not weaker: the browse grid rolls several service_category
-- values into one bucket (Filler + Biostimulator + Injectable all render as "Fillers"; Laser +
-- Device + Laser Hair Removal as "Lasers"), and per-category provider counts cannot be summed
-- -- a medspa with both a Filler and a Biostimulator deal is one provider, not two. The bucket
-- map lives in TypeScript (src/lib/data/categories.ts), so SQL hands back the id set and the
-- caller unions them. Summing counts would replace one fabricated statistic with another,
-- which is the exact defect migration 14 existed to fix.
--
-- CATEGORY RULE -- the canonical resolution, not an invention of this file. An offer's category
-- is the service_category of its LOWEST offer_item_id that resolves a non-null category:
--   * 85.3% of offers carry exactly one item, and of the 849 offers resolving any category 796
--     (93.8%) resolve exactly one, so one category per offer is a sound model.
--   * There is NO primary/headline/rank column on promo_offer_items -- offer_item_id ascending
--     is the only deterministic order available, and it is the order the items were extracted
--     from the source text, so the lowest id is the headline treatment. `check` and `reason` are
--     a QA-validation pair (check is NULL on 85% of rows) and must NOT be repurposed as a
--     headline marker.
--   * The `service_category is not null` filter inside the CTE is not cosmetic: plain
--     "first item" yields 847 categorized offers, skipping to the first item that actually
--     resolves a category yields 849.
-- 151 offers resolve no category at all. They are absent from this result set, exactly as the
-- old NULL-category exclusion left them absent -- an uncategorized offer has no bucket to be
-- counted in.
--
-- VISIBILITY PREDICATE replaces the old `(discount_price > 0 or regular_price > 0)` price
-- filter. That filter was a proxy for "renderable"; the real public gate is now expressible, so
-- use it: is_active AND not date-expired. Three things this must not get wrong --
--   1. The clinic_promotions join is LEFT. 373 of 1000 offers have no promotion_id; an INNER
--      join silently drops 240 live offers -- a 35% inventory loss that looks like a working
--      page.
--   2. campaign_end_date IS NULL means VISIBLE. 896 offers can resolve no expiry at all, so
--      treating NULL as expired would empty the grid.
--   3. clinic_promotions.is_active is NOT read. It is a cached restatement of the date
--      (every offer under an inactive promotion is also date-expired) and, measured across all
--      1000 rows, promo_offer_master.is_active is never more permissive than it -- so it adds
--      no signal, and reading it would risk an active campaign resurrecting an offer a clinic
--      deliberately delisted.
--
-- STABLE + `set search_path = public`, and deliberately NOT security definer -- both carried
-- over from migration 14 for its stated reason: promo_offer_master's SELECT policy is already
-- open, so a definer would grant nothing and only widen blast radius. Note this function now
-- reads clinic_services and clinic_promotions, whose SELECT policies 20260909180001 creates;
-- as an invoker-rights function it sees exactly what its caller sees, which is why that
-- migration has to land first.
--
-- business_id is nullable and array_agg(distinct ...) keeps NULLs, so it is filtered
-- explicitly: a category whose offers have no linked business reports zero providers rather
-- than one phantom.

-- Postgres will not replace a set-returning function in place even when the signature is
-- unchanged in shape, and dropping is the honest thing to do to a body that cannot parse.
drop function if exists public.get_offer_category_counts();

create function public.get_offer_category_counts()
returns table(service_category text, count bigint, provider_ids bigint[])
language sql
stable
set search_path = public
as $$
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
   group by c.service_category
   order by 2 desc;
$$;

-- Same audience as before: the treatments browse grid is public.
grant execute on function public.get_offer_category_counts() to anon, authenticated;

-- ponytail: there is no index on clinic_services.service_category, so this is three seq scans
-- over 701 / 1242 / 1000 rows. Fine today. Add
-- `create index on clinic_services (service_category)` when the catalogue outgrows a few
-- thousand services, not before.

notify pgrst, 'reload schema';
