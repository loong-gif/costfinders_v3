-- Admin lead workflow: record what happened when an admin relays a claim, and let an admin
-- close a claim without relaying it.
--
-- WHY
-- At launch every customer claim goes to the admin, who passes it to the clinic by hand (phone,
-- website form, social). `claims` could record only relayed_at / relayed_by / relay_method, so
-- the admin could not write down "left a voicemail" or "the clinic declined", and the only way
-- to clear a cancelled or dead claim out of the queue was to mark it relayed, which is a false
-- record. Four nullable columns:
--   relay_outcome      what happened when the admin reached out (checked vocabulary below)
--   relay_note         free text: who at the clinic was reached, what they said
--   admin_closed_at    set when the admin closes a claim without relaying it
--   admin_close_reason why it was closed (the app requires one)
--
-- GRANTS AND RLS: NO CHANGE NEEDED FOR THE ADMIN
-- Checked live on 2026-09-24: `authenticated` holds table-level UPDATE on claims, which covers
-- columns added later, and policy "Admins can update claims" is FOR UPDATE USING / WITH CHECK
-- private.is_admin() with no column list.
--
-- THE TRIGGER CHANGE
-- Consumers ("Consumers can cancel own claims") and approved owners ("Owners can respond to their
-- business claims") also hold row-level UPDATE on claims. Without the change below a consumer
-- could set admin_closed_at on their own claim and drop it out of the admin's queue.
-- guard_claim_consumer_columns() already refuses non-admin writes to the relayed_* columns; the
-- four new columns join that list. The body is otherwise the version in
-- 20260924010002_close_stale_claims_on_next_claim.sql, which applies before this file and adds
-- the "pending past its deadline may become expired" branch; that branch is kept verbatim.
--
-- ORDERING: 20260924040001_harden_direct_writes.sql applies after this file, drops this guard
-- and replaces it with an allowlist trigger (claims_guard_writes) whose admin list already
-- includes these four columns. Until that file is applied, this version is the one enforcing.
--
-- Read by src/lib/actions/admin-leads.ts, which falls back to the old column list until this
-- migration is applied: relays still record (without outcome and note), and only "Close without
-- relaying" and "Reopen" refuse, saying the migration is missing.

alter table public.claims
  add column if not exists relay_note text,
  add column if not exists relay_outcome text,
  add column if not exists admin_closed_at timestamptz,
  add column if not exists admin_close_reason text;

alter table public.claims
  drop constraint if exists claims_relay_outcome_check;
alter table public.claims
  add constraint claims_relay_outcome_check check (
    relay_outcome is null
    or relay_outcome in (
      'reached_clinic',
      'left_voicemail',
      'no_answer',
      'clinic_declined',
      'other'
    )
  );

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

  if new.consumer_id is distinct from old.consumer_id
     or new.deal_id is distinct from old.deal_id
     or new.business_id is distinct from old.business_id
     or new.relayed_at is distinct from old.relayed_at
     or new.relayed_by is distinct from old.relayed_by
     or new.relay_method is distinct from old.relay_method
     or new.relay_note is distinct from old.relay_note
     or new.relay_outcome is distinct from old.relay_outcome
     or new.admin_closed_at is distinct from old.admin_closed_at
     or new.admin_close_reason is distinct from old.admin_close_reason then
    raise exception 'these claim fields are not user-editable' using errcode = '42501';
  end if;

  -- A pending claim past its expires_at may be closed as 'expired' on its own consumer's
  -- behalf. enforce_active_claim_limit does this on the consumer's next claim.
  if old.status = 'pending'
     and new.status = 'expired'
     and old.expires_at < now()
     and (auth.uid() is null or old.consumer_id = auth.uid()) then
    return new;
  end if;

  select exists (
    select 1
    from public.business_profiles bp
    where bp.id = auth.uid()
      and bp.business_id = old.business_id
      and bp.claim_status = 'approved'
  ) into caller_is_owner;

  if caller_is_owner then
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
    if new.status is distinct from old.status
       and new.status not in ('contacted', 'booked', 'completed', 'cancelled') then
      raise exception 'a business may not set that claim status' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'a consumer may only cancel a claim' using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ROLLBACK:
-- Restore the previous guard body FIRST (the new one references the columns being dropped).
-- This is the 20260924010002 version; if 20260924040001 has been applied, the guard function no
-- longer exists and this step is skipped (roll that file back first).
--
-- create or replace function public.guard_claim_consumer_columns()
--  returns trigger language plpgsql security definer set search_path to 'public'
-- as $function$
-- declare
--   caller_is_owner boolean;
-- begin
--   if private.is_admin() then
--     return new;
--   end if;
--   if new.consumer_id is distinct from old.consumer_id
--      or new.deal_id is distinct from old.deal_id
--      or new.business_id is distinct from old.business_id
--      or new.relayed_at is distinct from old.relayed_at
--      or new.relayed_by is distinct from old.relayed_by
--      or new.relay_method is distinct from old.relay_method then
--     raise exception 'these claim fields are not user-editable' using errcode = '42501';
--   end if;
--   if old.status = 'pending' and new.status = 'expired' and old.expires_at < now()
--      and (auth.uid() is null or old.consumer_id = auth.uid()) then
--     return new;
--   end if;
--   select exists (
--     select 1 from public.business_profiles bp
--     where bp.id = auth.uid() and bp.business_id = old.business_id and bp.claim_status = 'approved'
--   ) into caller_is_owner;
--   if caller_is_owner then
--     if new.preferred_date is distinct from old.preferred_date
--        or new.preferred_time is distinct from old.preferred_time
--        or new.notes is distinct from old.notes
--        or new.booked_date is distinct from old.booked_date
--        or new.booked_time is distinct from old.booked_time
--        or new.expires_at is distinct from old.expires_at
--        or new.created_at is distinct from old.created_at then
--       raise exception 'a business may not edit the consumer''s side of a claim' using errcode = '42501';
--     end if;
--     if new.status is distinct from old.status
--        and new.status not in ('contacted', 'booked', 'completed', 'cancelled') then
--       raise exception 'a business may not set that claim status' using errcode = '42501';
--     end if;
--     return new;
--   end if;
--   if new.status is distinct from old.status and new.status <> 'cancelled' then
--     raise exception 'a consumer may only cancel a claim' using errcode = '42501';
--   end if;
--   return new;
-- end;
-- $function$;
--
-- alter table public.claims drop constraint if exists claims_relay_outcome_check;
-- alter table public.claims
--   drop column if exists relay_note,
--   drop column if exists relay_outcome,
--   drop column if exists admin_closed_at,
--   drop column if exists admin_close_reason;
