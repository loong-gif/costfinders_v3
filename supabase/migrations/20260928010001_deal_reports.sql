-- deal_reports: "Report a problem" on a deal page, and "Did the clinic honor this price?" after
-- a claim. Spec: .planning/DEAL-BROWSE-AND-TRUST.md section 4 (owner-approved 2026-09-28).
--
-- WHY
-- A shopper who finds a wrong price, an ended deal or a clinic that would not honor it had no way
-- to say so, and nothing recorded whether a claimed price was honored. Deals are read out of
-- clinic copy with inconsistent units, brands and packages, so the people who act on a deal are
-- the best check on our reading of it.
--
-- WHAT
--   1. public.deal_reports. offer_id follows listing_requests (bigint, ON DELETE SET NULL): a
--      report outlives the offer the pipeline deletes. claim_id CASCADEs with the claim, which
--      itself cascades with the consumer's account (delete_own_account deletes auth.users), so a
--      deleted account takes its answers with it. Two sources:
--        deal_page  reasons wrong_price | ended | not_honored | terms_differ | other
--        claim      reasons honored | different_price | not_honored, one row per claim
--                   (UNIQUE claim_id), changeable by the claim's consumer.
--   2. trg_deal_reports_guard_writes (SECURITY INVOKER, same shape as claims_guard_writes):
--        INSERT  forces status 'open', clears the admin columns, stamps the times; a claim row's
--                offer_id and reporter_id come from the claim and the caller, never the client.
--        UPDATE  an allowlist per role: the claim's consumer may change reason and note (which
--                reopens the row: the admin's verdict was on the old answer); an admin may change
--                status and admin_note, and the database stamps resolved_at / resolved_by.
--                Anything else is 42501.
--      INVOKER on purpose: it must know the caller (current_user) and read the claim through the
--      caller's own-claims policy. It calls public.is_admin() only on UPDATE, which anon cannot
--      reach (anon holds no UPDATE and no EXECUTE on is_admin()).
--   3. trg_deal_reports_cap_inserts (SECURITY DEFINER, it counts rows anon cannot read): at most
--      300 deal-page reports per rolling 24 hours, SQLSTATE PT429 (HTTP 429). The anon key ships
--      in every browser, so the server action's per-IP limit is not the only way in; the audit
--      found exactly this gap on listing_requests (20260924040001). ponytail: one global lock
--      and one global cap; a flood can crowd out real reports for a day, the same trade
--      listing_requests makes.
--   4. RLS ships with the table. anon may INSERT a deal-page report with no reporter; a signed-in
--      user may INSERT one with no reporter or their own uid; a consumer may INSERT, SELECT and
--      UPDATE the claim row of their own claim; admins SELECT and UPDATE everything. No DELETE.
--   5. Grants: Supabase's default GRANT ALL (TRUNCATE included, which RLS never sees) is revoked,
--      then anon gets INSERT and authenticated SELECT, INSERT, UPDATE.
--
-- An anon INSERT cannot be read back (no SELECT, by design: a report can carry a signed-in
-- reporter's id). That is safe to rely on: a refused INSERT raises 42501 rather than resolving
-- with zero rows, which is the silent failure the UPDATE path has.
--
-- VERIFY (each block rolls back; run as postgres; ids are the CLAUDE.md test accounts)
--   select has_table_privilege('anon', 'public.deal_reports', 'SELECT'),        -- f
--          has_table_privilege('anon', 'public.deal_reports', 'TRUNCATE'),      -- f
--          has_table_privilege('authenticated', 'public.deal_reports', 'TRUNCATE'), -- f
--          has_table_privilege('authenticated', 'public.deal_reports', 'DELETE'); -- f
--   begin; set local role anon;
--   insert into public.deal_reports (offer_id, source, reason)
--   values ((select id from public.public_offers limit 1), 'deal_page', 'ended');  -- INSERT 0 1
--   rollback;
--   begin; set local role anon;
--   insert into public.deal_reports (offer_id, source, reason, reporter_id)
--   values ((select id from public.public_offers limit 1), 'deal_page', 'ended',
--           '64567837-3b5e-4eca-85cf-d933f4fcffee');                             -- 42501
--   rollback;
--
-- ROLLBACK:
--   drop table if exists public.deal_reports;
--   drop function if exists public.deal_reports_guard_writes();
--   drop function if exists public.deal_reports_cap_inserts();

create table public.deal_reports (
  id          uuid primary key default gen_random_uuid(),
  offer_id    bigint references public.promo_offer_master (id) on delete set null,
  reporter_id uuid references auth.users (id) on delete set null,
  claim_id    uuid unique references public.claims (id) on delete cascade,
  source      text not null check (source in ('deal_page', 'claim')),
  reason      text not null,
  note        text check (char_length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note  text check (char_length(admin_note) <= 2000),
  created_at  timestamptz not null default now(),
  -- Not in the spec's column list: a claim answer is changeable, and without this the admin
  -- cannot tell when it changed.
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  constraint deal_reports_claim_rows_name_a_claim
    check ((source = 'claim') = (claim_id is not null)),
  constraint deal_reports_reason_fits_source check (
    (source = 'deal_page'
      and reason in ('wrong_price', 'ended', 'not_honored', 'terms_differ', 'other'))
    or (source = 'claim' and reason in ('honored', 'different_price', 'not_honored'))
  )
);

comment on table public.deal_reports is
  'Problem reports from deal pages and "did the clinic honor it" answers on claims. See 20260928010001.';

create index deal_reports_status_created_idx on public.deal_reports (status, created_at desc);
create index deal_reports_offer_idx on public.deal_reports (offer_id);


-- ---------------------------------------------------------------------------
-- Guard: normalise inserts, allowlist updates per role
-- ---------------------------------------------------------------------------

create or replace function public.deal_reports_guard_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_changed text[];
  v_allowed text[] := array['updated_at'];
begin
  -- Only direct client writes are policed; postgres and service_role authorize themselves.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'open';
    new.admin_note := null;
    new.resolved_at := null;
    new.resolved_by := null;
    new.created_at := now();
    new.updated_at := now();
    if new.source = 'claim' then
      -- The claim names the deal. Read through the caller's own-claims policy, so another
      -- consumer's claim yields NULL here and fails the INSERT policy regardless.
      new.reporter_id := v_uid;
      new.offer_id := (select c.deal_id from public.claims c where c.id = new.claim_id);
    end if;
    return new;
  end if;

  select coalesce(array_agg(n.key), '{}')
    into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if old.source = 'claim' and v_uid is not null and old.reporter_id = v_uid then
    v_allowed := v_allowed || array['reason', 'note'];
  end if;
  if public.is_admin() then
    v_allowed := v_allowed || array['status', 'admin_note'];
  end if;

  if not v_changed <@ v_allowed then
    raise exception 'not allowed to change deal report field(s): %',
      array_to_string(
        array(select unnest(v_changed) except select unnest(v_allowed)), ', ')
      using errcode = '42501';
  end if;

  new.updated_at := now();

  -- A changed answer reopens the row: the admin's verdict was on the old one.
  if 'reason' = any (v_changed) or 'note' = any (v_changed) then
    new.status := 'open';
  end if;

  -- The resolution stamps are the database's, never the caller's.
  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.resolved_at := null;
      new.resolved_by := null;
    else
      new.resolved_at := now();
      new.resolved_by := v_uid;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.deal_reports_guard_writes() is
  'Direct-client guard for deal_reports: normalises inserts, allowlists updates per role. See 20260928010001.';

revoke all on function public.deal_reports_guard_writes() from public, anon, authenticated;

create trigger trg_deal_reports_guard_writes
  before insert or update on public.deal_reports
  for each row execute function public.deal_reports_guard_writes();


-- ---------------------------------------------------------------------------
-- Cap: deal-page reports per rolling 24 hours
-- ---------------------------------------------------------------------------

create or replace function public.deal_reports_cap_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Claim answers are one per claim (UNIQUE claim_id) and need a session; only the open door
  -- is capped.
  if new.source <> 'deal_page' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('deal_reports_cap_inserts'));

  if (select count(*)
        from public.deal_reports
       where source = 'deal_page'
         and created_at > now() - interval '1 day') >= 300 then
    raise exception 'too many problem reports today, please try again tomorrow'
      using errcode = 'PT429', hint = 'rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.deal_reports_cap_inserts() from public, anon, authenticated;

create trigger trg_deal_reports_cap_inserts
  before insert on public.deal_reports
  for each row execute function public.deal_reports_cap_inserts();


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.deal_reports enable row level security;

-- Separate anon and authenticated policies: the claim policy reads public.claims, which anon
-- must not be made to evaluate.
create policy "Anyone can report a problem with a deal"
  on public.deal_reports for insert to anon
  with check (
    source = 'deal_page'
    and claim_id is null
    and reporter_id is null
    and offer_id is not null
  );

create policy "Signed-in users can report a problem with a deal"
  on public.deal_reports for insert to authenticated
  with check (
    source = 'deal_page'
    and claim_id is null
    and offer_id is not null
    and (reporter_id is null or reporter_id = (select auth.uid()))
  );

create policy "Consumers can answer for their own claim"
  on public.deal_reports for insert to authenticated
  with check (
    source = 'claim'
    and reporter_id = (select auth.uid())
    and exists (
      select 1
        from public.claims c
       where c.id = deal_reports.claim_id
         and c.consumer_id = (select auth.uid())
    )
  );

create policy "Consumers can read their own claim answers"
  on public.deal_reports for select to authenticated
  using (source = 'claim' and reporter_id = (select auth.uid()));

create policy "Consumers can change their own claim answers"
  on public.deal_reports for update to authenticated
  using (source = 'claim' and reporter_id = (select auth.uid()))
  with check (source = 'claim' and reporter_id = (select auth.uid()));

create policy "Admins can read deal reports"
  on public.deal_reports for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can update deal reports"
  on public.deal_reports for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));


-- ---------------------------------------------------------------------------
-- Grants: exactly what the policies exercise
-- ---------------------------------------------------------------------------

revoke all on table public.deal_reports from public, anon, authenticated;
grant insert on table public.deal_reports to anon;
grant select, insert, update on table public.deal_reports to authenticated;

notify pgrst, 'reload schema';
