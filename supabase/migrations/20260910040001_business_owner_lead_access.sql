-- 20260910040001_business_owner_lead_access.sql
--
-- Let an approved business owner read and work the leads on their own business, and teach
-- guard_claim_consumer_columns() that a claim now has two sides.
--
-- WHY
-- ---
-- public.claims had exactly two SELECT policies on 2026-09-10:
--
--   "Admins can read all claims"    EXISTS (select 1 from admin_profiles where id = auth.uid())
--   "Consumers can read own claims" auth.uid() = consumer_id
--
-- and two UPDATE policies with the same two predicates. Nothing matched a business owner, and
-- relrowsecurity is true — so every lead screen queried, got zero rows, and rendered a
-- confident empty state. Verified live as the approved owner of business 765
-- (set_config request.jwt.claims sub=01f64ba2-…, set local role authenticated):
-- `select count(*) from claims` returned 0 while the same session read 53 rows of
-- promo_offer_master for the same business. The session was real; only claims was denied.
--
-- The cascade, all in code: src/lib/actions/business-claims.ts:82-96 returns
-- {success:true, claims: []} because a 0-row RLS denial is not an error, so
-- leadList.tsx renders "No leads yet", business/dashboard/page.tsx counts 0 new leads,
-- analytics zeroes Leads/Bookings/Completed, and every UPDATE in business-claims.ts
-- (`.select().single()`) returns PGRST116 — Mark Contacted and Save Notes were silent no-ops.
-- The lead is the product; none of it reached the person paying for it.
--
-- THE PREDICATE
-- -------------
-- Mirrors the four promo_offer_master owner policies verbatim in shape:
--
--   EXISTS (select 1 from business_profiles bp
--           where bp.id = auth.uid() and bp.business_id = <table>.business_id
--             and bp.claim_status = 'approved')
--
-- Three things make that safe to reuse here. (1) business_profiles has RLS of its own and the
-- subquery runs as the caller, so it can only ever match the caller's OWN profile row — the
-- `bp.id = auth.uid()` term is what the "Owners can read own business profile" policy allows.
-- (2) `claim_status = 'approved'` means a pending or rejected claimant sees nothing.
-- (3) business_id is not client-supplied anywhere: it is read off the row being tested.
--
-- WHY THE UPDATE POLICY NEEDS A TRIGGER CHANGE TOO
-- ------------------------------------------------
-- RLS is row-level. `authenticated` holds a table-level UPDATE grant covering every column of
-- claims, so an UPDATE policy alone would let an owner rewrite the consumer's side of their
-- own lead — preferred_date, preferred_time, notes, booked_date, booked_time, expires_at.
-- Column scoping has to live in the existing BEFORE UPDATE trigger, which until now assumed
-- every non-admin writer was the consumer and refused any status move except 'cancelled'.
-- That refusal would have blocked Mark Contacted / Mark Booked / Mark Completed the moment
-- the UPDATE policy landed, so the two changes belong in one migration.
--
-- PRIOR DEFINITION, VERBATIM (pg_get_functiondef, 2026-09-10) — restore this to revert:
--
--   CREATE OR REPLACE FUNCTION public.guard_claim_consumer_columns()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   begin
--     if private.is_admin() then
--       return new;
--     end if;
--     if new.consumer_id is distinct from old.consumer_id
--        or new.deal_id is distinct from old.deal_id
--        or new.business_id is distinct from old.business_id
--        or new.relayed_at is distinct from old.relayed_at
--        or new.relayed_by is distinct from old.relayed_by
--        or new.relay_method is distinct from old.relay_method then
--       raise exception 'these claim fields are not user-editable' using errcode = '42501';
--     end if;
--     if new.status is distinct from old.status and new.status <> 'cancelled' then
--       raise exception 'a consumer may only cancel a claim' using errcode = '42501';
--     end if;
--     return new;
--   end;
--   $function$
--
-- REVERSIBILITY
-- -------------
--   drop policy "Owners can read their business claims" on public.claims;
--   drop policy "Owners can respond to their business claims" on public.claims;
--   -- then re-run the function body quoted above.
-- No data is touched.

-- 1. the owner can see their own leads --------------------------------------
create policy "Owners can read their business claims"
  on public.claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = (select auth.uid())
        and bp.business_id = claims.business_id
        and bp.claim_status = 'approved'
    )
  );

-- 2. …and move the lead through its statuses --------------------------------
-- WITH CHECK repeats USING so an owner cannot reassign a lead to another business on the way
-- out (business_id is also frozen by the trigger below — belt and braces, because the trigger
-- is the only one of the two that survives a future policy rewrite).
create policy "Owners can respond to their business claims"
  on public.claims
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = (select auth.uid())
        and bp.business_id = claims.business_id
        and bp.claim_status = 'approved'
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = (select auth.uid())
        and bp.business_id = claims.business_id
        and bp.claim_status = 'approved'
    )
  );

-- 3. the column guard, now aware of both sides ------------------------------
create or replace function public.guard_claim_consumer_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_is_owner boolean;
begin
  if private.is_admin() then
    return new;
  end if;

  -- Nobody but an admin re-points a claim at a different person, deal or business, and the
  -- relay columns are the admin lead-relay audit trail (src/lib/actions/admin-leads.ts).
  if new.consumer_id is distinct from old.consumer_id
     or new.deal_id is distinct from old.deal_id
     or new.business_id is distinct from old.business_id
     or new.relayed_at is distinct from old.relayed_at
     or new.relayed_by is distinct from old.relayed_by
     or new.relay_method is distinct from old.relay_method then
    raise exception 'these claim fields are not user-editable' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.business_profiles bp
    where bp.id = auth.uid()
      and bp.business_id = old.business_id
      and bp.claim_status = 'approved'
  ) into caller_is_owner;

  if caller_is_owner then
    -- What the owner types: status, their written response, and its timestamp.
    -- What the consumer typed, and the claim's own clock, are not theirs to edit — an owner
    -- who could move expires_at could keep a lead's contact reveal open indefinitely, and one
    -- who could move booked_date could change an appointment the consumer never agreed to.
    if new.preferred_date is distinct from old.preferred_date
       or new.preferred_time is distinct from old.preferred_time
       or new.notes is distinct from old.notes
       or new.booked_date is distinct from old.booked_date
       or new.booked_time is distinct from old.booked_time
       or new.expires_at is distinct from old.expires_at
       or new.created_at is distinct from old.created_at then
      raise exception 'a business may not edit the consumer''s side of a claim'
        using errcode = '42501';
    end if;
    -- The four moves the lead screen offers (leadDetail.tsx statusActions). 'pending' is the
    -- insert-time state and 'expired' belongs to the clock, so neither is an owner's to set.
    if new.status is distinct from old.status
       and new.status not in ('contacted', 'booked', 'completed', 'cancelled') then
      raise exception 'a business may not set that claim status' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Consumer path — unchanged from the prior definition.
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'a consumer may only cancel a claim' using errcode = '42501';
  end if;

  return new;
end;
$function$;

notify pgrst, 'reload schema';
