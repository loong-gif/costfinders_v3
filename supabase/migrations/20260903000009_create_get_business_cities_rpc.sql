-- Creates the get_business_cities RPC that src/lib/data/businesses.ts has been calling
-- since it was written.
--
-- Found by the logging added for issue #28. The call sits behind a comment reading
-- "Fallback: if the RPC doesn't exist, query manually", and the author was right to be
-- cautious -- but the RPC never existed (absent from pg_proc; PGRST202 over REST), so the
-- fallback was not a rare edge case, it was the only path. Every call selected all 957
-- city values and counted them in JavaScript.
--
-- It was invisible because the `if (error)` branch logged nothing: supabase-js resolves
-- rather than throws, so the catch block never ran. With #28's logSupabaseError in place a
-- single production build emitted 316 PGRST202 lines -- the same defect, now audible. That
-- volume is also why this is worth fixing rather than just logging: any alerting wired to
-- logger.error would fire 316 times per build on one known bug.
--
-- Semantics match the JavaScript fallback exactly, so the returned data does not change:
--   * skip NULL cities            (the fallback's `if (!row.city) continue`)
--   * count rows per city         (`counts.set(city, n + 1)`)
--   * order by count descending   (`.sort((a, b) => b.count - a.count)`)
-- The fallback additionally skips the empty string only by way of `!row.city` being truthy
-- for '', so `trim(city) <> ''` is added to match; get_city_deal_counts already does this.
--
-- STABLE + explicit search_path, matching get_city_deal_counts. Not SECURITY DEFINER: this
-- reads master_business_info, whose SELECT policy is already `USING (true)` for everyone,
-- so a definer would grant nothing extra and would only widen the blast radius.
create or replace function public.get_business_cities()
returns table(city text, count bigint)
language sql
stable
set search_path = public
as $$
  select b.city, count(*) as count
    from master_business_info b
   where b.city is not null
     and trim(b.city) <> ''
   group by b.city
   order by count(*) desc;
$$;

-- The consumer directory is public, and this is the same data the anon-key fallback was
-- already reading a moment ago.
grant execute on function public.get_business_cities() to anon, authenticated;

notify pgrst, 'reload schema';
