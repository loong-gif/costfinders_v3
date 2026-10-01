-- service_rename_keeps_scraped_titles: a service update no longer overwrites deal titles.
--
-- WHY
-- trg_sync_promo_offer_item_name_from_service (clinic_services, AFTER UPDATE) set
-- promo_offer_items.item_name = service_name on every linked item whenever ANY column of the
-- service changed. item_name is the deal's title on the site, so a price edit on a service
-- renamed every deal linked to it. Measured 2026-09-30: 931 of 947 visible deals are titled with a
-- bare service name, and on 298 of them the name is not in the clinic's own wording ("Neck Band
-- TOX - $499" titled "Neurotoxin"). The item-side trigger was already changed to fill only an
-- empty title; this is its service-side twin (data contract §5.1).
--
-- WHAT
-- Titles move only when the service is actually renamed, and only titles that still read as the
-- old service name. A scraped title is never overwritten. Existing titles are not restored here:
-- that needs the pipeline's source data. The trigger itself is unchanged.
--
-- ROLLBACK (the previous body):
--   create or replace function public.sync_promo_offer_item_name_from_service()
--    returns trigger language plpgsql set search_path to 'public' as $f$
--   begin
--     update public.promo_offer_items set item_name = new.service_name::text
--      where service_id = new.service_id and item_name is distinct from new.service_name::text;
--     return null;
--   end; $f$;

create or replace function public.sync_promo_offer_item_name_from_service()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.service_name is distinct from old.service_name then
    update public.promo_offer_items
       set item_name = new.service_name::text
     where service_id = new.service_id
       and item_name is not distinct from old.service_name::text;
  end if;
  return null;
end;
$function$;
