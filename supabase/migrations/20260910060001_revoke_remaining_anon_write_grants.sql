-- Revoke the leftover anon write grants on the twelve tables the earlier passes did not reach.
--
-- WHAT THIS IS
-- Supabase's default GRANT ALL was tightened for the six offer tables
-- (20260909180002), admin_profiles (20260909190011) and business_profiles
-- (20260909210003). A sweep of `information_schema.role_table_grants` shows twelve more
-- still holding anon write privileges, TRUNCATE among them on eleven:
--
--   business_claims        TRUNCATE
--   claims                 DELETE, INSERT, TRUNCATE
--   content_categories     DELETE, INSERT, TRUNCATE, UPDATE
--   content_locations      DELETE, INSERT, TRUNCATE, UPDATE
--   conversations          DELETE, INSERT, TRUNCATE, UPDATE
--   master_business_info   DELETE, INSERT, TRUNCATE, UPDATE
--   messages               DELETE, INSERT, TRUNCATE, UPDATE
--   notifications          DELETE, INSERT, TRUNCATE, UPDATE
--   profiles               DELETE, INSERT, TRUNCATE
--   promo_social_staging   DELETE, INSERT, TRUNCATE, UPDATE
--   saved_deals            DELETE, INSERT, TRUNCATE, UPDATE
--   listing_requests       INSERT   <- deliberately KEPT, see below
--
-- HOW BAD IS IT, HONESTLY
-- Not a live data-loss exploit, and this comment should not imply otherwise. TRUNCATE is
-- not exposed by PostgREST, and the public anon *JWT* cannot open a direct Postgres
-- connection, so the only reachable operations are INSERT/UPDATE/DELETE through PostgREST
-- — and RLS denies those today (`claims` for instance has no DELETE policy at all, and its
-- INSERT policy is TO authenticated).
--
-- It matters because RLS is then the ONLY thing standing between the anon key and these
-- rows, and TRUNCATE is not row-level so RLS would never see it. One permissive policy
-- added later — the kind of thing that has already happened twice in this project's
-- history — turns a grant nobody remembered into data loss. Defence in depth, and
-- consistency with the tables already tightened.
--
-- WHAT IS DELIBERATELY KEPT
-- `listing_requests` keeps anon INSERT. The public "request a listing change" form at
-- /business/listing-request posts as anon by design — that is the whole point of it being
-- reachable without an account. Its RLS policy governs what may be written.
--
-- Reverse: `grant insert, update, delete, truncate on public.<table> to anon;`

revoke insert, update, delete, truncate on public.business_claims from anon;
revoke insert, update, delete, truncate on public.claims from anon;
revoke insert, update, delete, truncate on public.content_categories from anon;
revoke insert, update, delete, truncate on public.content_locations from anon;
revoke insert, update, delete, truncate on public.conversations from anon;
revoke insert, update, delete, truncate on public.master_business_info from anon;
revoke insert, update, delete, truncate on public.messages from anon;
revoke insert, update, delete, truncate on public.notifications from anon;
revoke insert, update, delete, truncate on public.profiles from anon;
revoke insert, update, delete, truncate on public.promo_social_staging from anon;
revoke insert, update, delete, truncate on public.saved_deals from anon;

-- listing_requests: revoke only the destructive verbs, keep the INSERT the public form needs.
revoke update, delete, truncate on public.listing_requests from anon;

-- TRUNCATE is never something a client role needs; authenticated keeps only what its RLS
-- policies actually exercise.
revoke truncate on public.business_claims, public.claims, public.content_categories,
                   public.content_locations, public.conversations, public.listing_requests,
                   public.master_business_info, public.messages, public.notifications,
                   public.profiles, public.promo_social_staging, public.saved_deals
  from authenticated;
