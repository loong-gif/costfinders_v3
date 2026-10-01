-- repair_split_blankets_and_unstated_prices: data-only repair of 14 pipeline rows (data contract
-- §5.2 and §5.3), done on our side on 2026-09-30 at the owner's request. No schema change.
--
-- A. Business 1720 stored each clinic-wide member discount three times, each copy titled after a
--    different filler: plan 363 "10% off all products and services" (7853, 7856, 10082) and plan
--    515 "15% off all products and services" (7958, 10086, 10380). Keep the lowest id per plan,
--    deactivate the other two, and clear the kept row's item title so the site titles it with the
--    clinic's wording.
--
-- B. Eight visible offers stored a price the offer text never states (the site hid it and labelled
--    the deal "Confirm when booking"). Each now stores what the clinic states:
--      1386  "…20% off from regular price…"            20% off (the $13 regular was not stated)
--      7758  "$50 OFF Each Filler Treatment (starts at $550+)"   $50 off
--      9545  "$50 OFF Each Syringe of Biostimulator (starts at $900+)"   $50 off
--      9659  "$50 OFF Each Syringe of Filler (starting at $700)"   $50 off
--      10056 "$75 OFF Each Filler Treatment (starts at $550+)"   $75 off
--      9216  "30% off second syringe at $700/syringe"   30% off, regularly $700 per syringe
--      10031 "buy 120 units and receive 30 additional free units"   20% (the site labels it Our math)
--      8788  the 5% comes from membership plan 242's benefits ("5% off chemical peels, microneedling
--            and PRF"); that wording becomes the offer text. The "$350" appears in no source we
--            could find, so it goes.
--    Two steps, because fn_auto_fix_offer_prices() nulls a discount_percent/amount it considers
--    derived from the old prices when the prices change: step 1 drops the derived regular price
--    (the trigger clears the derived fields), step 2 writes the stated values.
--    Every update is guarded on the row's current values, so a row the pipeline has changed since
--    2026-09-30 is left alone.
--
-- ROLLBACK (values as of 2026-09-30):
--   update promo_offer_master set is_active = true where id in (7856, 10082, 10086, 10380);
--   update promo_offer_items set item_name = 'Dermal Filler' where offer_id = 7853;
--   update promo_offer_items set item_name = 'Sculptra' where offer_id = 7958;
--   -- then per row, regular first, then price: (price_model, discount_price, regular_price)
--   -- 1386 per_unit 10.40 13 · 7758 from 500 550 · 9545 from 850 900 · 9659 from 650 700 ·
--   -- 10056 from 475 null (amount 75) · 9216 per_unit 490 700 · 10031 total 540 675 ·
--   -- 8788 total 332.50 350, offer_raw_text 'Chemical Peels (regularly $350)'.

-- A. Business 1720
update public.promo_offer_master
   set is_active = false
 where id in (7856, 10082, 10086, 10380) and business_id = 1720 and is_active;

update public.promo_offer_items
   set item_name = null
 where offer_id in (7853, 7958) and service_id is null;

-- B. Step 1: drop the computed regular price while the computed discount_price is still there.
update public.promo_offer_master
   set regular_price = null
 where (id, discount_price) in (
   (1386, 10.40), (7758, 500), (9545, 850), (9659, 650),
   (10056, 475), (9216, 490), (10031, 540), (8788, 332.50));

-- B. Step 2: the stated values.
update public.promo_offer_master
   set discount_price = null, price_model = 'total', discount_percent = 20, discount_amount = null
 where id = 1386 and discount_price = 10.40;

update public.promo_offer_master
   set discount_price = null, price_model = 'total', discount_amount = 50, discount_percent = null
 where (id, discount_price) in ((7758, 500), (9545, 850), (9659, 650));

update public.promo_offer_master
   set discount_price = null, price_model = 'total', discount_amount = 75, discount_percent = null
 where id = 10056 and discount_price = 475;

update public.promo_offer_master
   set discount_price = null, regular_price = 700, discount_percent = 30, discount_amount = null
 where id = 9216 and discount_price = 490;

update public.promo_offer_master
   set discount_price = null, price_model = 'total', discount_percent = 20, discount_amount = null
 where id = 10031 and discount_price = 540;

update public.promo_offer_master
   set discount_price = null, discount_percent = 5, discount_amount = null,
       offer_raw_text = '5% off chemical peels, microneedling and PRF'
 where id = 8788 and discount_price = 332.50;
