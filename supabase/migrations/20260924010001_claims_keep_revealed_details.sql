-- Keep what a claim revealed, on the claim itself.
--
-- Why: the clinic's name, address, phone and website were only ever read live from
-- master_business_info, and only on the deal page, which 404s as soon as the pipeline switches
-- the offer off. Both real claims in production lost their details that way within four days
-- (deals 8556 and 1339, audit 2026-09-24). A customer who claimed a deal must keep what they
-- were given, whatever later happens to the listing.
--
-- What:
--   * claims.deal_title        the offer's title at claim time (same rule as resolveOfferTitle():
--                              item_name of the lowest offer_item_id, else offer_raw_text)
--   * claims.price_label       dealPricing().text at claim time. Written by createClaimAction,
--                              NOT by this trigger: the price rule lives in TypeScript
--                              (src/lib/data/adapters.ts) and CLAUDE.md forbids a second copy.
--                              Only the claimant can influence it (their own row), and only on
--                              insert; it is frozen afterwards like the others.
--   * claims.business_snapshot {name, address, city, phone, website, rating, review_count,
--                              google_place_id} from master_business_info.
--
-- The trigger is SECURITY DEFINER so the values come from the source tables, not from anything
-- the client sent or can read (promo_offer_items is RLS-gated to active offers). On INSERT it
-- also:
--   * derives business_id from the deal, so a raw PostgREST insert cannot pair a deal with some
--     other clinic;
--   * refuses a deal that is not visible (is_active, and campaign_end_date not past), the same
--     predicate as isPubliclyVisible() in src/lib/data/offers.ts. The app checks first and says
--     so nicely; this is the version a direct insert cannot skip. Mapped in claims.ts on hint
--     'deal_unavailable'.
-- On UPDATE the three columns are frozen for every signed-in caller. "Consumers can cancel own
-- claims" lets a consumer update any column the guard does not name, so without this they could
-- rewrite their own snapshot. A session with no JWT (a migration, the pipeline) may still fix them.
--
-- Includes a backfill for existing claims (deals may be inactive; definer context reads them).
-- The backfill fires the updated_at triggers, so those rows get a new updated_at.
--
-- ROLLBACK:
--   drop trigger if exists trg_claims_keep_revealed_details on public.claims;
--   drop function if exists public.claims_keep_revealed_details();
--   alter table public.claims
--     drop column if exists business_snapshot,
--     drop column if exists price_label,
--     drop column if exists deal_title;

alter table public.claims
  add column if not exists deal_title text,
  add column if not exists price_label text,
  add column if not exists business_snapshot jsonb;

comment on column public.claims.deal_title is
  'Offer title at claim time. Set by trg_claims_keep_revealed_details; frozen after insert.';
comment on column public.claims.price_label is
  'dealPricing().text at claim time, written by createClaimAction; frozen after insert.';
comment on column public.claims.business_snapshot is
  'Clinic details revealed by the claim, copied from master_business_info at insert; frozen after.';

-- Backfill first, before the trigger exists, so nothing below can freeze it.
update public.claims c
   set deal_title = coalesce(
         c.deal_title,
         (select coalesce(
                   (select i.item_name
                      from public.promo_offer_items i
                     where i.offer_id = o.id
                     order by i.offer_item_id
                     limit 1),
                   o.offer_raw_text)
            from public.promo_offer_master o
           where o.id = c.deal_id)),
       business_snapshot = coalesce(
         c.business_snapshot,
         (select jsonb_build_object(
                   'name', b.name,
                   'address', b.address,
                   'city', b.city,
                   'phone', b.phone,
                   'website', b.website,
                   'rating', b.score,
                   'review_count', b.review_count,
                   'google_place_id', b.google_place_id)
            from public.master_business_info b
           where b.business_id = c.business_id))
 where c.deal_title is null
    or c.business_snapshot is null;

create or replace function public.claims_keep_revealed_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer record;
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null then
      new.deal_title := old.deal_title;
      new.price_label := old.price_label;
      new.business_snapshot := old.business_snapshot;
    end if;
    return new;
  end if;

  select o.business_id,
         o.is_active,
         p.campaign_end_date,
         coalesce(
           (select i.item_name
              from public.promo_offer_items i
             where i.offer_id = o.id
             order by i.offer_item_id
             limit 1),
           o.offer_raw_text) as title
    into v_offer
    from public.promo_offer_master o
    left join public.clinic_promotions p on p.promotion_id = o.promotion_id
   where o.id = new.deal_id;

  if not found
     or v_offer.is_active is not true
     or (v_offer.campaign_end_date is not null and v_offer.campaign_end_date < current_date) then
    raise exception 'this deal is not available to claim'
      using errcode = '23514',
            hint = 'deal_unavailable';
  end if;

  new.business_id := v_offer.business_id;
  new.deal_title := v_offer.title;
  new.price_label := left(nullif(btrim(new.price_label), ''), 120);
  new.business_snapshot := (
    select jsonb_build_object(
             'name', b.name,
             'address', b.address,
             'city', b.city,
             'phone', b.phone,
             'website', b.website,
             'rating', b.score,
             'review_count', b.review_count,
             'google_place_id', b.google_place_id)
      from public.master_business_info b
     where b.business_id = v_offer.business_id);

  return new;
end;
$$;

alter function public.claims_keep_revealed_details() owner to postgres;
revoke all on function public.claims_keep_revealed_details() from public, anon, authenticated;

drop trigger if exists trg_claims_keep_revealed_details on public.claims;
create trigger trg_claims_keep_revealed_details
  before insert or update on public.claims
  for each row execute function public.claims_keep_revealed_details();
