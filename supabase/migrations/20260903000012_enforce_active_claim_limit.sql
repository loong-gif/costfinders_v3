-- Fixes the second half of GitHub issue #27: the active-claim limit is racy.
--
-- It is worse than racy. MAX_ACTIVE_CLAIMS lives only in src/lib/actions/claims.ts, as a
-- count-then-insert in the Server Action. `claims` is directly writable by the row's owner
-- through PostgREST, so the limit is not a constraint at all — it is a suggestion the
-- application makes to itself. Demonstrated live on 2026-09-03: eight sequential POSTs
-- straight to /rest/v1/claims left one consumer holding 7 active claims against a limit
-- of 3. No concurrency required.
--
-- The issue also states that the duplicate guard has no unique-constraint fallback and that
-- the code comment claiming one is wrong. THAT PART IS REFUTED — `claims_active_unique`
-- exists and works:
--
--   CREATE UNIQUE INDEX claims_active_unique ON public.claims (consumer_id, deal_id)
--     WHERE (status <> ALL (ARRAY['cancelled'::claim_status, 'expired'::claim_status]))
--
-- Five concurrent identical inserts produced exactly 1 row and four 23505s, which
-- claims.ts already catches and turns into "You've already claimed this deal." The index is
-- absent from this repo only because it is one of the 19 untracked remote migrations the
-- README lists. Nothing to fix there.
--
-- WHY A TRIGGER AND NOT A CONSTRAINT. "At most 3 rows matching a predicate" is not
-- expressible as a UNIQUE index or a CHECK — both see one row at a time. It needs a count,
-- and a count under READ COMMITTED is a read-then-write: two concurrent inserts each see 2
-- and both proceed. pg_advisory_xact_lock serialises them per consumer, so the count is
-- taken under a lock held until commit. Contention is per consumer and a consumer claims
-- rarely, so this costs nothing in practice.

create or replace function public.enforce_active_claim_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active int;
  v_max constant int := 3;
begin
  -- Serialise concurrent inserts for THIS consumer only. Transaction-scoped, so it is
  -- released on commit or rollback with no unlock path to forget. hashtext gives the
  -- bigint the advisory lock space wants.
  perform pg_advisory_xact_lock(hashtext('claims:' || new.consumer_id::text));

  -- Must match ACTIVE_STATUSES and the expiry filter in src/lib/actions/claims.ts. The
  -- enum is (pending, contacted, booked, completed, cancelled, expired); a claim stops
  -- occupying a slot once it is cancelled or expired.
  select count(*) into v_active
    from public.claims
   where consumer_id = new.consumer_id
     and status not in ('cancelled', 'expired', 'completed')
     and expires_at >= now();

  if v_active >= v_max then
    -- 23514 (check_violation) rather than a bare raise: claims.ts can map it to the
    -- existing 'limit_reached' message instead of surfacing raw Postgres text.
    raise exception 'active claim limit reached'
      using errcode = '23514',
            hint = 'limit_reached';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_active_claim_limit on public.claims;
create trigger trg_enforce_active_claim_limit
  before insert on public.claims
  for each row execute function public.enforce_active_claim_limit();

-- NOTE: this deliberately does NOT retro-enforce. Any consumer already over the limit keeps
-- their rows; the trigger only blocks new ones. Deleting somebody's existing claims to
-- satisfy a rule that was never enforced would be destroying user data to tidy a number.
