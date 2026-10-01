-- 20260909210002_scope_deal_image_storage_policies.sql
--
-- Bind write access to the `deal-images` bucket to the folder the caller actually owns.
-- Closes a proven IDOR: today any signed-in consumer can overwrite or delete any
-- business's deal images by talking to the storage API directly.
--
-- WHY
-- ---
-- The two write policies on storage.objects were predicated on nothing but the bucket:
--
--   "Auth users can upload deal images"  FOR INSERT TO authenticated
--                                        WITH CHECK (bucket_id = 'deal-images')
--   "Auth users can delete deal images"  FOR DELETE TO authenticated
--                                        USING      (bucket_id = 'deal-images')
--
-- So "may write to this bucket" and "may write to THIS BUSINESS's images" were the same
-- permission. src/lib/actions/deal-images.ts re-derives the owning business from
-- business_profiles keyed on auth.uid() and builds the path from the row, so the Server
-- Action is sound — but the action is not the only door. Anyone with the publishable anon
-- key (it ships in the client bundle) and any confirmed account can POST straight at
-- /storage/v1/object/... and skip it. Verified against production, 2026-09-10, with a real
-- consumer token for testuser@costfinders.com — an account with NO business_profiles row
-- at all:
--
--   POST   /storage/v1/object/deal-images/2059/h1probe.png
--     -> 200 {"Key":"deal-images/2059/h1probe.png","Id":"c50a3907-..."}
--   DELETE /storage/v1/object/deal-images/2059/h1probe.png
--     -> 200 {"message":"Successfully deleted"}
--
-- The bucket is public-read (storage.buckets.public = true), so the write side is the whole
-- of the access control, and a bucket-only predicate is not access control. Latent rather
-- than live today only because storage.objects holds 0 rows and no approved owner exists;
-- the day the first owner uploads a photo, any account can replace it.
--
-- WHAT THIS ADDS THAT WAS MISSING ENTIRELY
-- ----------------------------------------
-- There was no UPDATE policy. Supabase Storage's upsert path (`upsert: true`, or a PUT over
-- an existing key) is an UPDATE on storage.objects, so overwriting one's own image was
-- already refused before this migration and would stay refused after it. The new UPDATE
-- policy carries the predicate on both USING and WITH CHECK: USING so a caller can only
-- touch an object already inside their own folder, WITH CHECK so they cannot rename one out
-- of their folder into someone else's.
--
-- THE PREDICATE
-- -------------
--   (storage.foldername(name))[1] = (select bp.business_id::text
--                                      from public.business_profiles bp
--                                     where bp.id = auth.uid()
--                                       and bp.claim_status = 'approved')
--
-- The first path segment is the business id, which is exactly the layout the action writes
-- (`${businessId}/${dealId}-...`). `claim_status = 'approved'` matches the authority every
-- other owner-write gate on this project uses (the three "Owners can ... their own deals"
-- policies on promo_offer_master, and src/lib/auth/guards.ts). A scalar subquery that finds
-- no row yields NULL, and `text = NULL` is NULL, not true — so an account with no
-- business_profiles row, or an unapproved one, is refused rather than silently allowed.
-- The subquery runs as `authenticated`, which retains SELECT on business_profiles, and RLS
-- there ("Owners can read own business profile", auth.uid() = id) permits exactly this row.
--
-- "Public read access" (FOR SELECT, role PUBLIC, USING (bucket_id = 'deal-images')) is
-- deliberately left alone: the bucket is public by design and read is not the hole.
--
-- REVERSIBILITY
-- -------------
-- To restore the previous state exactly:
--   DROP POLICY "Auth users can upload deal images" ON storage.objects;
--   DROP POLICY "Auth users can update deal images" ON storage.objects;
--   DROP POLICY "Auth users can delete deal images" ON storage.objects;
--   CREATE POLICY "Auth users can upload deal images" ON storage.objects
--     FOR INSERT TO authenticated WITH CHECK (bucket_id = 'deal-images'::text);
--   CREATE POLICY "Auth users can delete deal images" ON storage.objects
--     FOR DELETE TO authenticated USING (bucket_id = 'deal-images'::text);
-- (that is the verbatim prior definition of both, from pg_policy on 2026-09-10; there was
-- no UPDATE policy to restore, so the rollback drops it). No data is touched.

DROP POLICY IF EXISTS "Auth users can upload deal images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete deal images" ON storage.objects;

CREATE POLICY "Auth users can upload deal images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deal-images'
    AND (storage.foldername(name))[1] = (
      select bp.business_id::text
        from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.claim_status = 'approved'
    )
  );

-- New: upsert-over-existing is an UPDATE, and nothing granted it before.
CREATE POLICY "Auth users can update deal images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'deal-images'
    AND (storage.foldername(name))[1] = (
      select bp.business_id::text
        from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.claim_status = 'approved'
    )
  )
  WITH CHECK (
    bucket_id = 'deal-images'
    AND (storage.foldername(name))[1] = (
      select bp.business_id::text
        from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.claim_status = 'approved'
    )
  );

CREATE POLICY "Auth users can delete deal images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'deal-images'
    AND (storage.foldername(name))[1] = (
      select bp.business_id::text
        from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.claim_status = 'approved'
    )
  );
