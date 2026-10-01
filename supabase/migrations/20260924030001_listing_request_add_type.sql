-- Listing requests gain an "add my business" type.
--
-- WHY
-- Business accounts are not open at launch (owner decision, 2026-09-23): the claim-your-listing
-- flow is hidden and every "list your medspa" entry point now leads to /business/listing-request.
-- That form had four types — removal, correction, price_dispute, other — and no way to ask to be
-- added, so it opened pre-set to "Remove my business from CostFinders" and an owner asking to be
-- listed had to pick "Something else". The app now sends request_type = 'add', which the CHECK
-- below must accept.
--
-- ORDERING
-- Apply BEFORE deploying the app change. Until it is applied, every "Add my business" submission
-- fails the CHECK (23514) and the submitter is told "We couldn't record your request".
--
-- Grants and policies are unchanged: anon/authenticated keep INSERT via "Anyone can submit a
-- listing request" (WITH CHECK true); reads stay admin-only.
--
-- ROLLBACK:
--   update public.listing_requests set request_type = 'other' where request_type = 'add';
--   alter table public.listing_requests drop constraint listing_requests_request_type_check;
--   alter table public.listing_requests add constraint listing_requests_request_type_check
--     check (request_type = any (array['removal', 'correction', 'price_dispute', 'other']));

alter table public.listing_requests
  drop constraint listing_requests_request_type_check;

alter table public.listing_requests
  add constraint listing_requests_request_type_check
  check (request_type = any (array['add', 'removal', 'correction', 'price_dispute', 'other']));
