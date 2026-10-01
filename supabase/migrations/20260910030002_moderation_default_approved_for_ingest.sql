-- Move the moderation default from 'pending_review' to 'approved', and let the RLS policy —
-- not the column default — be the thing that forces owner submissions into the queue.
--
-- WHY THIS IS A LANDMINE TODAY
-- `20260909180005_reinstate_deal_moderation.sql` restored `moderation_status` with a
-- 'pending_review' default, and the app's public visibility predicate (isPubliclyVisible in
-- src/lib/data/offers.ts) requires 'approved'. That combination is correct for a deal a business
-- owner types into the dashboard. It is wrong for the ingest pipeline, which inserts scraped
-- offers as `service_role` and therefore bypasses RLS entirely.
--
-- Right now all 1,125 offers read 'approved' only because the out-of-repo pipeline happens to
-- set it: it added 125 rows after our backfill and they came out approved. That is luck held in
-- a process this repo does not control. The moment an ingest run inserts without naming the
-- column, those offers take the default, fail the public predicate, and vanish from the site —
-- with no error, no empty state, and nobody watching, because there is exactly one admin and the
-- moderation queue has no monitor. Silent inventory loss is the single failure mode this whole
-- remediation has been chasing.
--
-- WHY FLIPPING THE DEFAULT IS SAFE
-- An owner still cannot self-publish. The INSERT policy "Owners can create deals for their
-- business" carries `WITH CHECK (moderation_status = 'pending_review' AND moderation_notes IS
-- NULL)`, so an authenticated owner's insert is REJECTED unless it names 'pending_review'
-- explicitly — the default is never what they get. Verified by attack in
-- `20260909180005`: an owner INSERT with 'approved' returns 42501.
--
-- So after this migration:
--   * pipeline (service_role, no RLS)  -> default 'approved'        -> visible, as intended
--   * business owner (authenticated)   -> policy forces 'pending_review' -> queued, as intended
--   * admin                            -> may set any valid value via the moderation actions
--
-- The guarantee moves from "an external process remembers to set a column" into the schema,
-- which is the whole point of the drift work.

alter table public.promo_offer_master
  alter column moderation_status set default 'approved';

comment on column public.promo_offer_master.moderation_status is
  'Moderation state. Defaults to ''approved'' because the ingest pipeline writes as service_role '
  'and must not need to know about this column to stay visible. Owner-submitted deals are forced '
  'to ''pending_review'' by the "Owners can create deals for their business" INSERT policy, not '
  'by this default. Public visibility additionally requires it (see isPubliclyVisible).';
