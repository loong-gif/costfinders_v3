-- Two new service categories, and the service names needed to link the inventory that has none.
--
-- This migration ONLY adds enum values. The rows that use them are in
-- 20260916020004_link_unlinked_offer_items.sql, and they have to be a separate migration:
-- Postgres permits `ALTER TYPE … ADD VALUE` inside a transaction, but the new value cannot be
-- USED until that transaction commits. One file doing both fails with
-- "unsafe use of new value of enum type".
--
-- WHY ANY NEW CATEGORY AT ALL
-- 345 of 814 publicly visible offers resolve no `service_category` (measured 2026-09-16). They are
-- not mis-mapped — 511 `promo_offer_items` rows have `service_id IS NULL`, so they are linked to no
-- `clinic_services` row at all, and `flattenOffer()` resolves the category through that join. Those
-- 345 render badged "Body" via `dbCategoryToTreatment`'s `?? 'body'` default and appear on no
-- treatment page. Roughly 100 of them are things the shipped seven members genuinely cannot express.
--
-- THE OWNER'S CONSTRAINT, VERBATIM: "dynamically create new categories, but the system needs to be
-- sure that its not creating duplicate categories that accomplish the same goal i.e. 'Skincare
-- Products' and 'Skincare' should not be 2 separate categories". Two members were designed against
-- that bar by three independent proposals and three judges; each has to survive a dedup argument.
--
--   Regenerative Injectable → treatment bucket 'skincare'
--     PRF, PRP, Exosome, EZ Gel, CollaGEL, PDRN. NOT a synonym of Microneedling: microneedling is
--     the delivery device and is sold with no biologic at all (21 plain "Microneedling" services
--     exist), while PRP hair restoration involves no needling pen — folding them would print a
--     "Microneedling" badge on an injection. NOT a synonym of Dermal Filler: filler adds exogenous
--     HA volume priced per syringe; these induce the patient's own collagen and are priced per draw.
--     It also gives 'skincare' a second feeder — today the /deals/skincare route and the six
--     skincare-cost-* guides hang off Microneedling alone.
--
--   Body Contouring → treatment bucket 'body'
--     Kybella, CoolSculpting, EmSculpt NEO, Cooltone, CryoSkin, fat lipolysis. NOT a synonym of
--     Wellness, the other member in that bucket: Wellness is systemic (IV, hormone pellets,
--     peptides); Body Contouring is a device or injection applied to a named body area. Sharing a
--     treatment bucket is not duplication — 'Laser & Light' and 'Laser Hair Removal' already share
--     'laser'. Deliberately NOT split into Cryolipolysis / Muscle Toning / Fat Dissolving: freezing
--     fat and contracting muscle are different mechanisms but one shopper, one page and one guide,
--     and that split is exactly the duplicate the owner's rule forbids. Brand names live at
--     service_name level.
--
-- 'body' is currently fed only by Wellness, which has ZERO services, so /treatments/body could only
-- ever be empty while this inventory sat uncategorised.
--
-- BOTH maps in src/lib/data/adapters.ts are keyed on the enum type, so adding a member here makes
-- `npm run build` FAIL until DB_TO_TREATMENT and CATEGORY_MAP gain an entry. That is the designed
-- behaviour, not an accident — a new member that nothing maps would otherwise fall silently into
-- `?? 'body'`, which is how a whole bucket emptied with no error twice before.
--
-- SERVICE NAMES: `clinic_services.service_name` is ALSO a NOT NULL enum (clinic_service_name_enum,
-- 46 members), which is not documented anywhere and is the constraint most likely to be tripped
-- over: a service row can only be inserted with a name the enum already permits. Each addition
-- below is the target of at least one real unlinked item. Brands that are variants of one service
-- are NOT added — "VI Peel", "Quick Peel" and "Perfect Derma Peel" all target `Chemical Peel`.
--
-- NOT ADDED, ON PURPOSE: there is no member for retail products, gift cards, referral programmes or
-- blanket "10% off all services" discounts. `service_name` being a NOT NULL enum is what keeps them
-- out structurally — a service row for "Skincare Products" cannot be inserted, so
-- `promo_offer_items.service_id` stays NULL by construction rather than by anyone's discipline, and
-- those offers reach no treatment page. That is the owner's decision implemented as a constraint
-- rather than a convention.

alter type public.clinic_service_category_enum add value if not exists 'Regenerative Injectable';
alter type public.clinic_service_category_enum add value if not exists 'Body Contouring';

alter type public.clinic_service_name_enum add value if not exists 'Sculptra';
alter type public.clinic_service_name_enum add value if not exists 'Chemical Peel';
alter type public.clinic_service_name_enum add value if not exists 'Thread Lift';
alter type public.clinic_service_name_enum add value if not exists 'Tattoo Removal';
alter type public.clinic_service_name_enum add value if not exists 'Skin Tightening';
alter type public.clinic_service_name_enum add value if not exists 'Regenerative Injectable';
alter type public.clinic_service_name_enum add value if not exists 'PRP';
alter type public.clinic_service_name_enum add value if not exists 'PRF';
alter type public.clinic_service_name_enum add value if not exists 'Exosome Therapy';
alter type public.clinic_service_name_enum add value if not exists 'Body Contouring';
alter type public.clinic_service_name_enum add value if not exists 'CoolSculpting';
alter type public.clinic_service_name_enum add value if not exists 'Kybella';
alter type public.clinic_service_name_enum add value if not exists 'Wellness';
alter type public.clinic_service_name_enum add value if not exists 'Massage';

-- ROLLBACK: Postgres cannot DROP an enum value. Reversing this means recreating both types without
-- the added members, which requires dropping and recreating every dependent column — so treat these
-- additions as one-way and check them before applying. `if not exists` makes re-running harmless.
