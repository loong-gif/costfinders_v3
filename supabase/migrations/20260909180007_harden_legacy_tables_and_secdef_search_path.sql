-- Two leftovers from the same never-tightened defaults, unrelated to the offer-schema
-- normalization but sharing its blast radius.
--
-- (a) FOUR LEGACY TABLES GRANT anon FULL WRITE WHILE HAVING ZERO RLS POLICIES ---------------
--
--   table                    RLS  policies  anon grants
--   business_reviews         on   0         DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--   monitor_state            on   0         (same)
--   promo_email_staging      on   0         (same)
--   social_data_production   on   0         (same)
--
-- Zero policies makes them unreadable, which is why nobody noticed the grants. It does NOT make
-- them unwritable in any durable sense -- the day someone adds a policy to make one readable,
-- the write grants are live, and the anon key ships in the browser bundle of every page. This is
-- the same trap 20260909180001/2 had to defuse on the clinic_* tables, caught before rather than
-- after. grep over src/ and scripts/ finds no reference to any of the four, so no application
-- path loses anything.
--
-- business_reviews IS DELIBERATELY LEFT UNREADABLE. It holds 1252 scraped Google reviews
-- carrying reviewers' names, profile URLs and photo URLs -- third parties' personal data, not
-- the clinic's own catalogue. The other three are internal: scraper cursor state, an email ingest
-- staging table, and a social-metrics table. None of the four gets a SELECT policy here. Write
-- grants only are revoked; the read wall stays exactly where it is. Adding a public read policy
-- to business_reviews would publish personal data under the cover of "fixing an empty table",
-- and is not a decision a hardening migration gets to make.
--
-- SELECT stays granted on all four. It is inert against zero policies, and revoking it would be
-- a second, invisible gate that the next person to legitimately open one of these tables would
-- have to discover the hard way.

revoke insert, update, delete, truncate, references, trigger
  on public.business_reviews,
     public.monitor_state,
     public.promo_email_staging,
     public.social_data_production
  from anon, authenticated;

-- (b) TWO SECURITY DEFINER FUNCTIONS WITH AN UNPINNED search_path -----------------------------
--
-- SECURITY DEFINER + unpinned search_path is the exploitable pair: the body runs with the
-- definer's privileges (postgres, here) while resolving unqualified names through the CALLER's
-- search_path, so a caller who can create an object earlier in that path can have the definer
-- execute it. Both functions below are proconfig NULL and SECURITY DEFINER.
--
-- Both already schema-qualify the tables they write (public.business_profiles,
-- public.conversations), so pinning search_path changes no behaviour today -- it removes the
-- ability of a future edit, or of an operator resolution nobody audited, to be redirected.
-- `= public` matches the convention every other pinned function on this schema uses.
--
--   handle_new_business_user()          AFTER INSERT on auth.users -> inserts business_profiles
--   update_conversation_last_message()  AFTER INSERT on messages   -> updates conversations
--
-- ALTER FUNCTION ... SET is used rather than CREATE OR REPLACE so the bodies are not restated
-- and cannot be accidentally altered; the attached triggers are unaffected either way.
alter function public.handle_new_business_user() set search_path = public;
alter function public.update_conversation_last_message() set search_path = public;

-- ponytail: the other five unpinned functions (get_business_category_counts,
-- get_business_count_for_city, fn_compute_offer_fingerprint, set_updated_at,
-- update_updated_at_column / set_business_profile_updated_at) are NOT touched. They are all
-- invoker-rights, so an unpinned search_path is a correctness nit rather than a privilege
-- escalation. Pin them in a pass of their own if the advisor noise is worth a migration.

-- REVOKE is not DDL, so the pgrst_ddl_watch event trigger does not fire.
notify pgrst, 'reload schema';
