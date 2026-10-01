-- Record that a business paid.
--
-- No column anywhere in the public schema can express it. Verified: business_profiles has 9
-- columns (id, email, first_name, last_name, business_id, claim_status, verification_status,
-- created_at, updated_at) and a regex for plan|tier|paid|subscription|billing over every column
-- in public finds nothing on the business side. claim_status and verification_status are about
-- who owns a listing, not what they bought.
--
-- The practical consequence today: an out-of-band sale -- an invoice, a payment link, a bank
-- transfer -- has nowhere to land, so nothing can be switched on for the business that paid. Not
-- "the feature is unbuilt": the fact is unrecordable. This migration adds the column that makes
-- a manual sale representable. It deliberately adds nothing else -- no entitlement checks, no
-- pricing table, no Stripe anything.
--
-- ponytail: two tiers, 'free' and 'paid'. That is what an invoice can express. Add a third value
-- to the CHECK when a second paid tier is actually sold, not in anticipation of one -- widening a
-- CHECK is a one-line migration and guessing the vocabulary now would bake in names nobody has
-- agreed.
--
-- tier_source and tier_note are free text on purpose: they record HOW the sale was made
-- ('invoice', 'payment_link', 'comped') and the human detail (invoice number, who authorised
-- it). ponytail: no CHECK on tier_source -- constraining a vocabulary that is currently one
-- person writing notes for themselves buys nothing. Add one when a second system starts writing
-- the column.

alter table public.business_profiles
  add column if not exists tier text not null default 'free',
  add column if not exists tier_source text,
  add column if not exists tier_note text;

alter table public.business_profiles
  drop constraint if exists business_profiles_tier_check;
alter table public.business_profiles
  add constraint business_profiles_tier_check check (tier in ('free','paid'));

-- ADMIN-ONLY, ENFORCED BY TRIGGER RATHER THAN BY GRANT ---------------------------------------
-- tier is a money column: if a business owner can set it, the paywall is decorative. RLS cannot
-- stop this -- "Owners can update own business profile" restricts WHICH ROW an owner may update,
-- never WHICH COLUMN, so an owner can PATCH their own row and set tier = 'paid'. Note that they
-- do not need the app to do it: PostgREST is a public HTTP endpoint and their JWT is enough.
--
-- Two traps rule out the obvious grant-based fix, and both have already cost this project a
-- migration that did nothing:
--
--   * ADMINS AUTHENTICATE AS `authenticated`. There is no separate admin role -- admin-ness is
--     membership in admin_profiles, read through public.is_admin(). So
--     `revoke update (tier) on business_profiles from authenticated` would disable admins too,
--     leaving the column writable by nobody but service_role and making the sale unrecordable
--     from the admin dashboard. This is exactly the "restrict the column" instinct that must not
--     be followed here.
--   * TABLE-LEVEL GRANTS SILENTLY DEFEAT COLUMN-LEVEL REVOKE. business_profiles currently holds
--     a table-wide UPDATE grant to authenticated, which confers the privilege on every column,
--     so even a correct-looking column REVOKE would be a no-op until the table grant is dropped
--     first. A migration on `profiles` already shipped and did nothing for this reason.
--
-- So the gate is a BEFORE UPDATE trigger comparing OLD to NEW and short-circuiting on
-- public.is_admin() -- the pattern guard_business_privileged_columns and
-- guard_claim_consumer_columns already establish. business_profiles ALREADY HAS that trigger
-- (trg_guard_business_profiles_privileged), guarding claim_status, verification_status and
-- business_id. The three new columns join that existing check rather than getting a second
-- trigger of their own: one BEFORE UPDATE trigger per table, one place to read.
--
-- RECOVERABILITY -- the function being replaced, captured verbatim from pg_get_functiondef()
-- before this migration ran. To revert, restore exactly this and drop the three columns:
--
--   CREATE OR REPLACE FUNCTION public.guard_business_privileged_columns()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   begin
--     if public.is_admin() then
--       return new;
--     end if;
--
--     if tg_table_name = 'business_profiles' then
--       if new.claim_status is distinct from old.claim_status
--          or new.verification_status is distinct from old.verification_status
--          or new.business_id is distinct from old.business_id then
--         raise exception 'only an admin may change claim_status, verification_status or business_id'
--           using errcode = '42501';
--       end if;
--     elsif tg_table_name = 'business_claims' then
--       if new.status in ('approved','rejected') and new.status is distinct from old.status then
--         raise exception 'only an admin may approve or reject a claim' using errcode = '42501';
--       end if;
--       if new.reviewed_at is distinct from old.reviewed_at
--          or new.reviewed_by is distinct from old.reviewed_by
--          or new.admin_notes is distinct from old.admin_notes then
--         raise exception 'only an admin may write claim review fields' using errcode = '42501';
--       end if;
--     end if;
--
--     return new;
--   end;
--   $function$
--
-- The business_claims branch below is byte-identical to the above. The only change is the second
-- `if` inside the business_profiles branch. The existing triggers
-- (trg_guard_business_profiles_privileged, trg_guard_business_claims_privileged) both point at
-- this function by name and are NOT recreated -- CREATE OR REPLACE keeps them attached.
create or replace function public.guard_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'business_profiles' then
    if new.claim_status is distinct from old.claim_status
       or new.verification_status is distinct from old.verification_status
       or new.business_id is distinct from old.business_id then
      raise exception 'only an admin may change claim_status, verification_status or business_id'
        using errcode = '42501';
    end if;
    -- tier and its two provenance columns are set only when a sale is recorded, which only an
    -- admin can have done. Raised separately from the block above so the error names the column
    -- the caller actually touched.
    if new.tier is distinct from old.tier
       or new.tier_source is distinct from old.tier_source
       or new.tier_note is distinct from old.tier_note then
      raise exception 'only an admin may change tier, tier_source or tier_note'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'business_claims' then
    if new.status in ('approved','rejected') and new.status is distinct from old.status then
      raise exception 'only an admin may approve or reject a claim' using errcode = '42501';
    end if;
    if new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.admin_notes is distinct from old.admin_notes then
      raise exception 'only an admin may write claim review fields' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- anon, on the other hand, has no admin case to protect and no legitimate write path at all:
-- all four policies on business_profiles are `to authenticated`, so RLS already denies anon --
-- but that grant means RLS is the ONLY thing denying it, and the anon key ships in the browser
-- bundle. Revoking UPDATE removes the privilege the tier column would need to be written with.
-- Same shape as `revoke update on public.claims from anon` in 20260903000003.
--
-- ponytail: UPDATE only. anon's INSERT/DELETE/TRUNCATE on business_profiles are the same
-- never-tightened default and should go too, but that is table hardening beyond the column this
-- migration adds -- 20260909180007 does that class of work for the tables it names.
revoke update on public.business_profiles from anon;

-- New columns on a table PostgREST has already cached; the REVOKE is not DDL and would not
-- reload the cache on its own either.
notify pgrst, 'reload schema';
