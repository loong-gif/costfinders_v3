-- Give the contact reveal something to reveal: a business phone number.
--
-- WHAT IS BROKEN TODAY
-- `src/lib/data/reveal.ts` is what a consumer unlocks after creating an account and claiming a
-- deal. It selects name, address, city, score, review_count, category, facebook_url and
-- instagram_url. `/terms` tells that consumer "A claim shares your contact details with that
-- business", so their side of the exchange is real; the business's side is a name and a street
-- address. A column search across the whole `public` schema on 2026-09-16 for %phone%, %tel%,
-- %contact% and %email% returned only consumer and owner fields (profiles.phone,
-- business_profiles.email, listing_requests.contact_email). There has never been a business phone
-- number anywhere in this database to show.
--
-- WHY A COLUMN AND NOT A JOIN
-- There is no other carrier. master_business_info is one row per business and phone is one fact
-- per business, so a column is the shape. 419 rows; this is not a table that needs normalising.
--
-- WHO CAN WRITE IT
-- master_business_info has RLS enabled with exactly two policies: "Enable read access for all
-- users" (SELECT, role public, USING true) and "Admins can insert businesses" (INSERT). There is
-- **no UPDATE policy at all**, so although `authenticated` holds a table-level UPDATE grant, RLS
-- denies every client UPDATE. Only postgres and service_role can populate this column. That is
-- deliberate and it is why the backfill in scripts/backfill-business-phone.ts needs a service-role
-- key. Do not add an UPDATE policy to make the backfill easier.
--
-- WHO CAN READ IT
-- The SELECT policy is USING (true) for `public`, so this column is readable by `anon` over
-- PostgREST the moment it has data — exactly like `address` and `website` already are. The
-- "anonymous until committed" gating in this product is enforced in the application's SELECT
-- lists, not by the database. Adding phone does not weaken that posture, but it does add one more
-- field to an already-public row: if the gating is ever meant to be real, it needs column-level
-- SELECT grants or a restricted view, and that is a separate piece of work.
--
-- WHY THE VALUE IS NOT SOURCED FROM THE WEBSITE'S RENDERED PAGE
-- Med-spa sites very commonly swap the displayed number for a call-tracking number in JavaScript,
-- so the number a browser shows is frequently not the clinic's line. The backfill therefore reads
-- the Google Business Profile first (via DataForSEO) and falls back to the raw, unexecuted HTML of
-- the business website — never a JS-rendered DOM. `phone_source` records which one won so a bad
-- batch can be identified and re-run without re-scraping the good ones.
--
-- SCHEMA OWNERSHIP
-- master_business_info is owned by the ingest pipeline, which reshapes this database from outside
-- this repo (CLAUDE.md § "The database moves without the repo"). This column is additive and
-- nullable, so a pipeline upsert that does not mention it will not clear it. It is still an ask
-- that belongs on the governance list in .planning/PRELAUNCH-FIXES.md § 7: if the pipeline starts
-- sourcing phone numbers itself, these two columns are where they belong, and a second parallel
-- column would be the failure mode to avoid.

alter table public.master_business_info
  add column if not exists phone text,
  add column if not exists phone_source text;

comment on column public.master_business_info.phone is
  'Business phone in E.164 (+1XXXXXXXXXX). Populated by scripts/backfill-business-phone.ts, not by '
  'the app — RLS grants no UPDATE policy on this table, so only service_role can write it. '
  'Publicly readable, like every other column here.';

comment on column public.master_business_info.phone_source is
  'Provenance of `phone`: ''google_business_profile'' (authoritative) or ''website_html'' '
  '(raw unexecuted HTML, used only when no GBP match was found). Websites swap displayed numbers '
  'for call-tracking numbers in JavaScript, so this distinction is the difference between the '
  'clinic''s line and a marketing vendor''s. NULL when phone is NULL.';

-- Neither column is in any client UPDATE path, so no grant changes are needed. Verify after
-- applying:
--   select count(*) from information_schema.column_privileges
--    where table_name = 'master_business_info' and column_name in ('phone','phone_source')
--      and grantee = 'anon' and privilege_type = 'UPDATE';   -- expect 0
