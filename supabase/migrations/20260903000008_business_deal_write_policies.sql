-- Fixes GitHub issue #22: a business owner can neither create nor delete a deal, and the
-- delete path reports success while nothing is removed.
--
-- Two independent defects stack here, and fixing only the one the issue names leaves the
-- feature just as dead.
--
-- 1. THE MODERATION COLUMNS DO NOT EXIST. createDealAction hardcodes
--    `moderation_status: 'pending_review'` (src/lib/actions/deal-management.ts:190), and the
--    admin queue reads/writes moderation_status and moderation_notes. None of
--    moderation_status, moderation_notes, template_type or eligibility exists anywhere in the
--    public schema -- verified against information_schema.columns. PostgREST rejects the
--    payload with PGRST204 BEFORE RLS is ever consulted, so the failure the issue attributes
--    to RLS is a schema-drift failure that RLS would have caused next. Confirmed live: an
--    INSERT carrying moderation_status returns PGRST204 even for an admin.
--
--    Note the remote migration history records `20260324085221 add_moderation_notes_column`,
--    yet the column is absent -- the same recorded-but-never-applied pattern the README
--    already flags for `create_business_profiles` and `create_business_claims_table`.
--    src/types/supabase.ts declares both columns, which is how this passed a clean typecheck;
--    that file is hand-maintained (see CLAUDE.md) and is not evidence of anything.
--
--    promo_offer_master.status is NOT a substitute: it is the lifecycle field
--    ('active' 1670 rows / 'ended' 261 rows), not a moderation verdict.
--
-- 2. NO INSERT AND NO DELETE POLICY. pg_policies on promo_offer_master held exactly two rows:
--    "Enable read access for all users" (SELECT, true) and "Admins can update deal
--    moderation". RLS denies SILENTLY -- a DELETE matching no policy removes zero rows and
--    PostgREST answers 204 with no error -- which is why deleteDealAction reported success.
--    Reproduced live: DELETE returned 204, `Prefer: return=representation` returned [], and
--    the row was still present afterwards.
--
--    updateDealAction is affected identically and the issue does not mention it: an owner
--    edit matches no policy, PostgREST returns [], and the trailing .single() turns that into
--    a misleading PGRST116 "no rows returned" rather than a permission error.
--
-- Table-level grants are already ALL to anon and authenticated (verified in
-- information_schema.role_table_grants), so RLS is the only gate here; adding the policies is
-- what turns those grants into a permission.

-- 1. the moderation columns --------------------------------------------------
-- The 1931 rows already in the table came from the ingestion pipeline and are already
-- rendered on public pages. Backfill them to 'approved' so this migration is invisible to
-- consumers; only rows created after it start life pending. Guarded on the column not yet
-- existing so a re-run cannot flip a genuinely pending deal to approved.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name  = 'promo_offer_master'
       and column_name = 'moderation_status'
  ) then
    alter table public.promo_offer_master
      add column moderation_status text not null default 'pending_review';
    update public.promo_offer_master set moderation_status = 'approved';
  end if;
end $$;

-- Written by rejectDealAction and requestDealChangesAction; without it both stay broken
-- after this migration and a rejected deal can never tell the owner why.
alter table public.promo_offer_master
  add column if not exists moderation_notes text;

-- The four values are the ones src/types/deal.ts (ModerationStatus) already defines. Without
-- the constraint the column is free text and a typo in an action silently strands a deal in a
-- state no UI can reach.
alter table public.promo_offer_master
  drop constraint if exists promo_offer_master_moderation_status_check;
alter table public.promo_offer_master
  add constraint promo_offer_master_moderation_status_check
  check (moderation_status in ('pending_review','approved','rejected','changes_requested'));

create index if not exists idx_promo_offer_master_moderation_status
  on public.promo_offer_master (moderation_status, created_at desc);

-- 2. owner write policies ---------------------------------------------------
-- The owner link is business_profiles.id = auth.uid() AND
-- business_profiles.business_id = promo_offer_master.business_id.
--
-- claim_status = 'approved' is required IN THE POLICY, not only in the action.
-- verifyBusinessOwnership (deal-management.ts:80) already checks it, but a Server Action is a
-- public HTTP endpoint and PostgREST is a second, wide-open door: an owner with a merely
-- 'pending' claim can POST straight to /rest/v1/promo_offer_master with their own JWT and
-- never touch the action. The action check is defence in depth; this is the gate.

drop policy if exists "Owners can create deals for their business" on public.promo_offer_master;
create policy "Owners can create deals for their business"
  on public.promo_offer_master for insert to authenticated
  with check (
    exists (
      select 1 from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.business_id = promo_offer_master.business_id
         and bp.claim_status = 'approved'
    )
    -- The `moderation_status: 'pending_review'` in createDealAction is a client-side
    -- convention, not a constraint. Pin it here so a deal cannot be born approved, and keep
    -- the admin-only notes field empty. INSERT needs no trigger for this: WITH CHECK sees the
    -- whole NEW row.
    and moderation_status = 'pending_review'
    and moderation_notes is null
  );

drop policy if exists "Owners can update their own deals" on public.promo_offer_master;
create policy "Owners can update their own deals"
  on public.promo_offer_master for update to authenticated
  using (
    exists (
      select 1 from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.business_id = promo_offer_master.business_id
         and bp.claim_status = 'approved'
    )
  )
  -- WITH CHECK repeated deliberately (same reasoning as migration 7 item 4): a policy with
  -- only USING constrains which row is read, not what the row becomes, so without this an
  -- owner could rewrite business_id and hand their deal to another listing.
  with check (
    exists (
      select 1 from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.business_id = promo_offer_master.business_id
         and bp.claim_status = 'approved'
    )
  );

drop policy if exists "Owners can delete their own deals" on public.promo_offer_master;
create policy "Owners can delete their own deals"
  on public.promo_offer_master for delete to authenticated
  using (
    exists (
      select 1 from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.business_id = promo_offer_master.business_id
         and bp.claim_status = 'approved'
    )
  );

-- 3. the moderation verdict is admin-only on UPDATE -------------------------
-- RLS restricts WHICH ROW an owner may update, never WHICH COLUMN, so the ownership policy
-- above would happily let an owner set moderation_status = 'approved' on their own deal and
-- self-publish past the admin queue. Column-level REVOKE cannot express this: admins
-- authenticate as the same `authenticated` role. Same shape as
-- guard_business_privileged_columns (migration 4) and guard_claim_consumer_columns
-- (migration 7): short-circuit on public.is_admin(), then compare OLD to NEW.
create or replace function public.guard_deal_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The ingestion pipeline connects as service_role, which bypasses RLS but NOT triggers, and
  -- has no admin_profiles row so is_admin() is false for it. auth.uid() is null on any
  -- non-end-user connection; anon can never reach this trigger because both UPDATE policies
  -- are `to authenticated`, so letting a null uid through does not widen anything.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_notes is distinct from old.moderation_notes then
    raise exception 'only an admin may change a deal''s moderation status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_deal_moderation_status on public.promo_offer_master;
create trigger trg_guard_deal_moderation_status
  before update on public.promo_offer_master
  for each row execute function public.guard_deal_moderation_status();

-- 4. the admin UPDATE policy, brought to the migration-7 convention ---------
-- Recreated under the SAME NAME, not dropped: admin moderation must keep working. Three
-- changes, each already established by 20260903000007_tighten_permissive_rls.sql:
--   * role `public` -> `authenticated`. `public` includes anon, and anon can never be an
--     admin, so the wider role bought nothing.
--   * add WITH CHECK. It was NULL, so the policy fell back to USING and constrained the row
--     read but not the row written.
--   * public.is_admin() instead of an inline `exists (select 1 from admin_profiles ...)`.
--     is_admin() is SECURITY DEFINER; the inline subquery is subject to admin_profiles' own
--     RLS and can evaluate false for the very admin it is meant to admit.
drop policy if exists "Admins can update deal moderation" on public.promo_offer_master;
create policy "Admins can update deal moderation"
  on public.promo_offer_master for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- FOLLOW-UP (deliberately NOT done here): moderation_status does not yet gate public
-- visibility. The SELECT policy stays `USING (true)` and none of the eight read sites in
-- src/lib/data/offers.ts filter on it, so a deal an approved owner creates is publicly
-- listed while still 'pending_review'. Narrowing SELECT cannot be done in isolation:
-- /admin/dashboard/deals reads through getOffersWithBusinessIdentity on the ANON client
-- (src/lib/supabase.ts), so an approved-only SELECT policy would hide from the moderation
-- queue exactly the deals it exists to review. Moving that page onto an authenticated
-- server client is the prerequisite, and it is a separate change.

-- New columns on a table PostgREST has already cached.
notify pgrst, 'reload schema';
