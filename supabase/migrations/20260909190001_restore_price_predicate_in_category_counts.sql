-- get_offer_category_counts() and every deal listing disagreed by 38%.
--
-- 20260909180003 rebuilt this function for the normalized schema and, while doing so,
-- deliberately dropped the old `(discount_price > 0 or regular_price > 0)` predicate on the
-- grounds that it was "a proxy for renderable" now superseded by is_active + expiry. That
-- reasoning is wrong about one thing: the price filter is not a proxy, it is a PRODUCT RULE,
-- and it is still applied — unchanged — by the listing that these counts label:
--
--   src/lib/data/offers.ts, _getOffersWithBusinesses():
--     // Rule 1: Hide deals with no pricing data
--     .or('discount_price.gt.0,regular_price.gt.0')
--
-- So the cards counted one corpus and the pages listed another. Measured 2026-09-09:
--
--   bucket                RPC said   page listed
--   Botox & Neurotoxins   333        220
--   Fillers               170        108
--   Facials & Lasers      71         27
--   Other Services        12         6
--   TOTAL                 586        361
--
-- Two buckets were worse than merely inflated: `Peel` (8 offers) and `Surgery` (1) have ZERO
-- priced offers between them, so they contributed browse cards over deals that can never
-- render, at the direct expense of buckets that have real inventory. The homepage
-- contradicted itself on a single screen — src/app/page.tsx sums this RPC for its hero
-- headline while getCityDealCounts(), on the same page, aggregates the actual listing corpus.
--
-- The RPC is aligned to the listing and NOT the reverse. "Hide deals with no pricing data" is
-- a product decision — a card advertising a deal whose price is unknown wastes the click — so
-- the count has to respect it. Dropping the rule from the listing instead would publish 225
-- priced-as-nothing deals to fix a number.
--
-- coalesce() rather than the bare `> 0` the listing uses: PostgREST's `.or()` evaluates
-- `null > 0` to NULL, which fails the filter, so bare SQL comparison and coalesce agree on
-- every row. coalesce is written out because it is the half a reader gets wrong.
--
-- Everything else — the lowest-offer_item_id category rule, provider_ids as an ARRAY of
-- distinct business ids rather than a count, the LEFT join to clinic_promotions, NULL
-- campaign_end_date meaning VISIBLE, not reading clinic_promotions.is_active, STABLE and
-- invoker-rights — is carried over verbatim from 20260909180003. Read that file's header for
-- why each one is load-bearing; this migration changes exactly one line of the `where`.
--
-- Verified after applying: every category's count equals the listing's own count for that
-- category (post-flattenOffer, with isPubliclyVisible applied), all 14 categories, and the
-- four browse buckets sum to 220 / 108 / 27 / 6.
--
-- ── PRIOR DEFINITION, verbatim, so this is reversible from the repo alone ──────────────────
-- Restore by re-running the body below (it is byte-identical to the one applied as ledger
-- 20260910000453, tracked at 20260909180003_repair_get_offer_category_counts.sql:73-99):
--
--   drop function if exists public.get_offer_category_counts();
--   create function public.get_offer_category_counts()
--   returns table(service_category text, count bigint, provider_ids bigint[])
--   language sql
--   stable
--   set search_path = public
--   as $$
--     with canonical as (
--       select distinct on (i.offer_id)
--              i.offer_id,
--              s.service_category
--         from promo_offer_items i
--         join clinic_services s on s.service_id = i.service_id
--        where s.service_category is not null
--        order by i.offer_id, i.offer_item_id
--     )
--     select c.service_category,
--            count(*) as count,
--            coalesce(
--              array_agg(distinct m.business_id) filter (where m.business_id is not null),
--              '{}'::bigint[]
--            ) as provider_ids
--       from promo_offer_master m
--       join canonical c on c.offer_id = m.id
--       left join clinic_promotions p on p.promotion_id = m.promotion_id
--      where m.is_active
--        and (p.campaign_end_date is null or p.campaign_end_date >= current_date)
--      group by c.service_category
--      order by 2 desc;
--   $$;
--   grant execute on function public.get_offer_category_counts() to anon, authenticated;
-- ──────────────────────────────────────────────────────────────────────────────────────────

-- Same reason 20260909180003 dropped rather than replaced: Postgres will not reliably replace
-- a set-returning function in place, and the grant is reissued below.
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
     -- THE ONE CHANGED LINE. Mirrors offers.ts Rule 1: hide deals with no pricing data.
     and (coalesce(m.discount_price, 0) > 0 or coalesce(m.regular_price, 0) > 0)
   group by c.service_category
   order by 2 desc;
$$;

-- Same audience as before: the treatments browse grid is public.
grant execute on function public.get_offer_category_counts() to anon, authenticated;

-- ponytail: the count and the listing now apply the same rule in two places, in two
-- languages, and nothing but this comment holds them together. Upgrade path when a third
-- surface needs it: express visibility once as a SQL view (or a generated `is_renderable`
-- column) and have both read it. Not worth it for two callers.

notify pgrst, 'reload schema';
