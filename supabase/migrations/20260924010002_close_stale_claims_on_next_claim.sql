-- Close a consumer's stale pending claims when they make their next claim.
--
-- Why: claims.expires_at defaults to now() + 7 days, but nothing ever wrote status = 'expired'
-- (there is no pg_cron). The partial unique index claims_active_unique only excludes
-- 'cancelled' and 'expired', so a week-old 'pending' claim kept the (consumer_id, deal_id) slot
-- forever: a re-claim raised 23505 and the app said "You've already claimed this deal", while
-- the old reveal had already hidden the clinic. Customer journey audit 2026-09-24, finding 4.2.
--
-- What:
--   * enforce_active_claim_limit() (BEFORE INSERT, already holds a per-consumer advisory lock)
--     first marks that consumer's claims with status = 'pending' AND expires_at < now() as
--     'expired'. The limit count then runs on the same rows as before. 'expired' is already a
--     member of the claim_status enum, so no type change is needed.
--   * guard_claim_consumer_columns() must allow that transition, because it blocks every
--     consumer status change except 'cancelled' and it runs on the UPDATE above with the
--     consumer's JWT. New clause: pending -> expired, only once expires_at has passed, only on
--     the caller's own claim (or with no JWT at all). The rest of the function is the live
--     source verbatim as of 2026-09-24.
--
-- Only 'pending' is closed. 'contacted' and 'booked' mean an owner acted on the claim, so they
-- stay as they are.
--
-- ROLLBACK (restores both functions exactly as they were before this migration):
--   create or replace function public.enforce_active_claim_limit()
--    returns trigger language plpgsql security definer set search_path to 'public'
--   as $function$
--   declare
--     v_active int;
--     v_max constant int := 3;
--   begin
--     perform pg_advisory_xact_lock(hashtext('claims:' || new.consumer_id::text));
--     select count(*) into v_active
--       from public.claims
--      where consumer_id = new.consumer_id
--        and status not in ('cancelled', 'expired', 'completed')
--        and expires_at >= now();
--     if v_active >= v_max then
--       raise exception 'active claim limit reached'
--         using errcode = '23514', hint = 'limit_reached';
--     end if;
--     return new;
--   end;
--   $function$;
--
--   create or replace function public.guard_claim_consumer_columns()
--    returns trigger language plpgsql security definer set search_path to 'public'
--   as $function$
--   declare
--     caller_is_owner boolean;
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
--     select exists (
--       select 1 from public.business_profiles bp
--        where bp.id = auth.uid() and bp.business_id = old.business_id
--          and bp.claim_status = 'approved'
--     ) into caller_is_owner;
--     if caller_is_owner then
--       if new.preferred_date is distinct from old.preferred_date
--          or new.preferred_time is distinct from old.preferred_time
--          or new.notes is distinct from old.notes
--          or new.booked_date is distinct from old.booked_date
--          or new.booked_time is distinct from old.booked_time
--          or new.expires_at is distinct from old.expires_at
--          or new.created_at is distinct from old.created_at then
--         raise exception 'a business may not edit the consumer''s side of a claim'
--           using errcode = '42501';
--       end if;
--       if new.status is distinct from old.status
--          and new.status not in ('contacted', 'booked', 'completed', 'cancelled') then
--         raise exception 'a business may not set that claim status' using errcode = '42501';
--       end if;
--       return new;
--     end if;
--     if new.status is distinct from old.status and new.status <> 'cancelled' then
--       raise exception 'a consumer may only cancel a claim' using errcode = '42501';
--     end if;
--     return new;
--   end;
--   $function$;
--   (Rows already moved to 'expired' stay 'expired'; that is the state they should have had.)

create or replace function public.enforce_active_claim_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_active int;
  v_max constant int := 3;
begin
  perform pg_advisory_xact_lock(hashtext('claims:' || new.consumer_id::text));

  -- Close this consumer's stale pending claims first, so they stop holding a slot in
  -- claims_active_unique and stop reading as active. Nothing else ever sets 'expired'.
  -- In its own block: three migrations redefine the claims update guard today (this one,
  -- 20260924020001, 20260924040001). If a guard without the pending -> expired rule is live,
  -- the refusal skips the tidy-up instead of failing the customer's new claim.
  begin
    update public.claims
       set status = 'expired'
     where consumer_id = new.consumer_id
       and status = 'pending'
       and expires_at < now();
  exception when insufficient_privilege then
    raise warning 'stale claims not closed for %: %', new.consumer_id, sqlerrm;
  end;

  select count(*) into v_active
    from public.claims
   where consumer_id = new.consumer_id
     and status not in ('cancelled', 'expired', 'completed')
     and expires_at >= now();

  if v_active >= v_max then
    raise exception 'active claim limit reached'
      using errcode = '23514',
            hint = 'limit_reached';
  end if;

  return new;
end;
$function$;

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
     or new.relay_method is distinct from old.relay_method then
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
