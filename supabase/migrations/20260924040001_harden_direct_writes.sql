-- Close the direct-write paths the site's buttons never use (security audit 2026-09-23,
-- findings 4, 9 and 12).
--
-- WHY
-- The public anon key ships in every browser, so any signed-in user can call PostgREST
-- directly and write whatever the grants and policies allow, not what the buttons send.
-- The audit found:
--   * claims: an insert could arrive already 'booked', already relayed, or with a past
--     expires_at that the active-claim limit does not count. The update guard was a denylist,
--     so a consumer could still rewrite expires_at, business_response or created_at on their
--     own claim.
--   * conversations: the INSERT policy let a user open a thread with ANY user id, and the
--     UPDATE policy (no WITH CHECK, table-level grant) let a participant rewrite the other
--     party or the claim a thread belongs to.
--   * messages: sender_type was never checked, so a consumer could post as 'business'.
--   * listing_requests: anon INSERT WITH CHECK (true) skipped the site's 5-per-10-minutes
--     limit and could pre-set status and admin_notes.
--   * default GRANT ALL leftovers on app-owned tables (DELETE, INSERT, UPDATE with no policy
--     behind them). RLS was the only line.
--   * nothing stopped two different people being approved as owner of one business.
--
-- WHAT
--   1. claims: one guard trigger, trg_claims_guard_writes, for INSERT and UPDATE. Replaces
--      trg_guard_claim_consumer_columns (and its function, last revised by
--      20260924020001_admin_lead_workflow.sql), which it supersedes.
--      INSERT (non-admin): forces status 'pending', created_at now(), expires_at now()+7 days,
--        nulls every business/relay/admin column, and requires consumer_id = auth.uid().
--        Deal visibility and business_id = the deal's business are enforced by
--        trg_claims_keep_revealed_details (20260924010001), which this does not duplicate.
--      UPDATE: an allowlist per role, so a column added later is locked until someone adds
--        it here.
--          consumer (own claim): status -> 'cancelled', or -> 'expired' once the claim is a
--            pending one past expires_at.
--          approved owner of the claim's business: status -> contacted/booked/completed/
--            cancelled, business_response, responded_at.
--          admin: status (any), expires_at, relayed_at/by, relay_method, relay_note,
--            relay_outcome, admin_closed_at, admin_close_reason.
--          updated_at is always allowed (the updated_at triggers set it). Everything else,
--          including consumer_id, deal_id, business_id, notes and created_at, raises 42501.
--      SECURITY INVOKER on purpose, not DEFINER. The rule is "police direct client writes",
--      and only an invoker trigger can tell those apart: under PostgREST current_user is
--      'authenticated', but inside a postgres-owned SECURITY DEFINER function or trigger
--      (approve_business_claim, get_or_create_claim_conversation, the snapshot trigger, the
--      pipeline, service_role) it is the owner, and those paths authorize themselves. A
--      DEFINER trigger always sees 'postgres' and would have to either trust or block all of
--      them. It calls public.is_admin() (not private.is_admin(): authenticated has no USAGE
--      on schema private) and reads business_profiles through the caller's own-row policy.
--   2. conversations: drop the INSERT policy and grant, so the only way to open a thread is
--      get_or_create_claim_conversation(), which already requires a party to the claim and
--      picks the business's approved owner itself. UPDATE is limited to the columns the app
--      writes (status, last_message_at, updated_at). DELETE revoked (no policy ever allowed it).
--   3. messages: the INSERT policy now also requires sender_type to match the sender's side
--      of the conversation. UPDATE is limited to read_at; DELETE revoked.
--   4. listing_requests: BEFORE INSERT trigger (SECURITY DEFINER, it has to count rows anon
--      cannot read) forces status 'new' / admin_notes null / timestamps, and caps inserts at 5
--      per contact_email and 200 overall per rolling 24 hours. Raises SQLSTATE PT429, which
--      PostgREST returns as HTTP 429; submitListingRequestAction already shows its own
--      "couldn't record your request" copy on any insert error.
--   5. Grants on app-owned tables, keeping exactly what each policy exercises:
--        claims          -DELETE
--        notifications   -INSERT -DELETE, UPDATE only (is_read)   (create_notification is DEFINER)
--        profiles        -INSERT -DELETE                          (UPDATE is already column-scoped)
--        saved_deals     -UPDATE   (the app upserts with ignoreDuplicates = ON CONFLICT DO NOTHING)
--        content_categories, content_locations  -DELETE   (admin write policies cover INSERT/UPDATE only)
--      Pipeline-owned tables (promo_offer_terms, v_promotion_content_guardrail_violations,
--      master_business_info, promo_social_staging) are NOT touched here; they are listed for the
--      data team in the implementation report.
--   6. business_profiles: partial unique index, one approved owner per business_id. Checked
--      live 2026-09-24: 0 businesses have two approved owners, so this builds cleanly.
--      approve_business_claim will fail with 23505 on a second approval instead of silently
--      creating two owners.
--
-- VERIFY AFTER APPLYING (each block is its own transaction and ROLLS BACK; run as postgres).
-- Identities are the three sanctioned test accounts from CLAUDE.md.
--
--   -- (i) exploit: a consumer inserts a claim that is already booked and relayed, with a past
--   --     expiry. Expect ONE row: pending | null | null | null | t | null.
--   --     (If it fails 23514 'active claim limit reached', the consumer holds 3 active claims;
--   --     cancel one inside the transaction first.)
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+user@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   insert into public.claims (consumer_id, deal_id, business_id, status, relayed_at, relayed_by,
--                              relay_method, expires_at, business_response)
--   select auth.uid(), o.id, o.business_id, 'booked', now(), 'me', 'phone', now() - interval '1 day', 'yes'
--     from public.promo_offer_master o
--     left join public.clinic_promotions p on p.promotion_id = o.promotion_id
--    where o.is_active and (p.campaign_end_date is null or p.campaign_end_date >= current_date)
--      and not exists (select 1 from public.claims c where c.deal_id = o.id)
--    limit 1
--   returning status, relayed_at, relayed_by, relay_method,
--             expires_at > now() + interval '6 days' as fresh_expiry, business_response;
--   rollback;
--
--   -- (i) exploit: a consumer extends their own claim's expiry. Expect ERROR 42501
--   --     'not allowed to change claim field(s): expires_at'.
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+user@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   update public.claims set expires_at = now() + interval '1 year' where consumer_id = auth.uid();
--   rollback;
--
--   -- (ii) legit: the consumer cancels their own claim. Expect rows with status 'cancelled'
--   --      (zero rows only if they have no claim at all).
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+user@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   update public.claims set status = 'cancelled', updated_at = now()
--    where id = (select id from public.claims where consumer_id = auth.uid() limit 1)
--   returning status;
--   rollback;
--
--   -- (ii) legit + (i) exploit: the business-765 owner marks a lead contacted (expect a row),
--   --      then tries to relay it (expect ERROR 42501 naming relayed_at).
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   update public.claims set status = 'contacted', updated_at = now()
--    where id = (select id from public.claims where business_id = 765 limit 1) returning status;
--   update public.claims set relayed_at = now() where business_id = 765;
--   rollback;
--
--   -- (ii) legit: the admin records a relay (expect a row). Then (i): the admin rewrites the
--   --      consumer (expect ERROR 42501 naming consumer_id).
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+admin@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   update public.claims set relayed_at = now(), relayed_by = auth.uid()::text, relay_method = 'phone',
--          relay_note = 'drill', relay_outcome = 'other'
--    where id = (select id from public.claims limit 1) returning relayed_at is not null;
--   update public.claims set consumer_id = auth.uid() where id = (select id from public.claims limit 1);
--   rollback;
--
--   -- (i) exploit: the consumer opens a conversation with an arbitrary user. Expect ERROR 42501
--   --     'permission denied for table conversations'.
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+user@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   insert into public.conversations (claim_id, consumer_id, business_owner_id)
--   values (gen_random_uuid(), auth.uid(), auth.uid());
--   rollback;
--
--   -- (ii) legit: the owner opens (or gets) the thread for a business-765 claim through the RPC.
--   --      Expect one conversations row.
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select id, status from public.get_or_create_claim_conversation(
--     (select id from public.claims where business_id = 765 limit 1));
--   rollback;
--
--   -- (i) exploit: a participant reassigns the other party. Expect ERROR 42501
--   --     'permission denied for table conversations'.
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   update public.conversations set consumer_id = auth.uid() where business_owner_id = auth.uid();
--   rollback;
--
--   -- (i) exploit: the owner posts as 'consumer' (expect ERROR 42501 new row violates row-level
--   --     security policy), then (ii) legit: posts as 'business' (expect a row).
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   savepoint s;
--   insert into public.messages (conversation_id, sender_id, sender_type, content)
--   select id, auth.uid(), 'consumer', 'drill' from public.conversations where business_owner_id = auth.uid() limit 1;
--   rollback to savepoint s;
--   insert into public.messages (conversation_id, sender_id, sender_type, content)
--   select id, auth.uid(), 'business', 'drill' from public.conversations where business_owner_id = auth.uid() limit 1
--   returning sender_type;
--   update public.messages set read_at = now() where sender_type = 'business' returning read_at is not null;
--   rollback;
--
--   -- (i) exploit: anon floods listing_requests. Expect ERROR PT429 on the 6th row.
--   begin;
--   set local role anon;
--   insert into public.listing_requests (request_type, business_name, contact_name, contact_email, details)
--   select 'other', 'Drill', 'Drill', 'cap-drill@example.invalid', 'drill row ' || g from generate_series(1, 6) g;
--   rollback;
--
--   -- (ii) legit: one anon request that tries to pre-set workflow columns. Expect: new | null.
--   begin;
--   set local role anon;
--   insert into public.listing_requests (request_type, business_name, contact_name, contact_email,
--                                        details, status, admin_notes)
--   values ('other', 'Drill', 'Drill', 'one-drill@example.invalid', 'a single drill row', 'actioned', 'x');
--   reset role;
--   select status, admin_notes from public.listing_requests where contact_email = 'one-drill@example.invalid';
--   rollback;
--
--   -- (i) exploit: a second approved owner for business 765. Expect ERROR 23505 on
--   --     business_profiles_one_approved_owner.
--   begin;
--   insert into public.business_profiles (id, business_id, claim_status)
--   values ((select id from auth.users where email = 'haris+admin@brandrap.com'), 765, 'approved')
--   on conflict (id) do update set business_id = 765, claim_status = 'approved';
--   rollback;
--
--   -- Grants. Expect every column false.
--   select has_table_privilege('authenticated', 'public.claims', 'DELETE') as claims_delete,
--          has_table_privilege('authenticated', 'public.conversations', 'INSERT') as conv_insert,
--          has_column_privilege('authenticated', 'public.conversations', 'consumer_id', 'UPDATE') as conv_party_update,
--          has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE') as msg_content_update,
--          has_table_privilege('authenticated', 'public.notifications', 'INSERT') as notif_insert,
--          has_table_privilege('authenticated', 'public.profiles', 'DELETE') as profiles_delete,
--          has_table_privilege('authenticated', 'public.saved_deals', 'UPDATE') as saved_update;
--
-- Also re-test in the app after applying: claim a deal as haris+user (/deals/...), cancel it if
-- the UI offers that, owner "Mark contacted" on /business/dashboard/leads, admin relay and
-- "close without relaying" on /admin/dashboard/leads, send a message each way on
-- /dashboard/messages and /business/dashboard/messages, submit /business/listing-request once.
--
-- ROLLBACK (exact reverse, in this order):
--   drop index if exists public.business_profiles_one_approved_owner;
--
--   grant delete on public.content_categories, public.content_locations to authenticated;
--   grant update on public.saved_deals to authenticated;
--   grant insert, delete on public.profiles to authenticated;
--   revoke update (is_read) on public.notifications from authenticated;
--   grant insert, update, delete on public.notifications to authenticated;
--   grant delete on public.claims to authenticated;
--
--   drop trigger if exists trg_listing_requests_guard_insert on public.listing_requests;
--   drop function if exists public.listing_requests_guard_insert();
--
--   revoke update (read_at) on public.messages from authenticated;
--   grant update, delete on public.messages to authenticated;
--   drop policy if exists "Participants can send messages" on public.messages;
--   create policy "Participants can send messages" on public.messages for insert to authenticated
--     with check (((sender_id = (select auth.uid())) and (exists (select 1 from public.conversations c
--       where ((c.id = messages.conversation_id) and (((select auth.uid()) = c.consumer_id)
--         or ((select auth.uid()) = c.business_owner_id))))) and (not (exists (select 1
--       from public.profiles p where ((p.id = (select auth.uid())) and (p.status = 'suspended'::text)))))));
--
--   revoke update (status, last_message_at, updated_at) on public.conversations from authenticated;
--   grant insert, update, delete on public.conversations to authenticated;
--   create policy "Claim parties can open a conversation" on public.conversations for insert
--     to authenticated
--     with check (((auth.uid() = consumer_id) or (auth.uid() = business_owner_id) or private.is_admin()));
--
--   drop trigger if exists trg_claims_guard_writes on public.claims;
--   drop function if exists public.claims_guard_writes();
--   -- then restore the previous update guard: re-run the `create or replace function
--   -- public.guard_claim_consumer_columns()` block from
--   -- 20260924020001_admin_lead_workflow.sql verbatim, followed by:
--   create trigger trg_guard_claim_consumer_columns before update on public.claims
--     for each row execute function public.guard_claim_consumer_columns();


-- ---------------------------------------------------------------------------
-- 1. claims
-- ---------------------------------------------------------------------------

create or replace function public.claims_guard_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid;
  v_changed text[];
  v_allowed text[] := array['updated_at'];
  v_status_ok boolean;
begin
  -- Only direct client writes are policed; see the header for why this is not DEFINER.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_uid := auth.uid();

  if tg_op = 'INSERT' then
    if public.is_admin() then
      return new;
    end if;
    if new.consumer_id is distinct from v_uid then
      raise exception 'a claim can only be made for yourself' using errcode = '42501';
    end if;
    -- Everything the consumer does not own starts empty. jsonb_populate_record ignores keys
    -- that are not columns, so this can name columns other migrations add or drop.
    new := jsonb_populate_record(new, jsonb_build_object(
      'status', 'pending',
      'created_at', now(),
      'expires_at', now() + interval '7 days',
      'business_response', null,
      'responded_at', null,
      'booked_date', null,
      'booked_time', null,
      'relayed_at', null,
      'relayed_by', null,
      'relay_method', null,
      'relay_note', null,
      'relay_outcome', null,
      'admin_closed_at', null,
      'admin_close_reason', null
    ));
    return new;
  end if;

  select coalesce(array_agg(n.key), '{}')
    into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  v_status_ok := new.status is not distinct from old.status;

  if v_uid is not null and v_uid = old.consumer_id then
    v_allowed := v_allowed || 'status'::text;
    v_status_ok := v_status_ok
      or new.status = 'cancelled'
      or (new.status = 'expired' and old.status = 'pending' and old.expires_at < now());
  end if;

  if exists (
    select 1
      from public.business_profiles bp
     where bp.id = v_uid
       and bp.business_id = old.business_id
       and bp.claim_status = 'approved'
  ) then
    v_allowed := v_allowed || array['status', 'business_response', 'responded_at'];
    v_status_ok := v_status_ok
      or new.status in ('contacted', 'booked', 'completed', 'cancelled');
  end if;

  if public.is_admin() then
    v_allowed := v_allowed || array[
      'status', 'expires_at', 'relayed_at', 'relayed_by', 'relay_method',
      'relay_note', 'relay_outcome', 'admin_closed_at', 'admin_close_reason'
    ];
    v_status_ok := true;
  end if;

  if not v_changed <@ v_allowed then
    raise exception 'not allowed to change claim field(s): %',
      array_to_string(
        array(select unnest(v_changed) except select unnest(v_allowed)), ', ')
      using errcode = '42501';
  end if;

  if not v_status_ok then
    raise exception 'not allowed to set a claim to %', new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.claims_guard_writes() is
  'Direct-client guard for claims: normalises consumer inserts, allowlists updates per role. See 20260924040001.';

revoke all on function public.claims_guard_writes() from public, anon, authenticated;

drop trigger if exists trg_guard_claim_consumer_columns on public.claims;
drop function if exists public.guard_claim_consumer_columns();

drop trigger if exists trg_claims_guard_writes on public.claims;
create trigger trg_claims_guard_writes
  before insert or update on public.claims
  for each row execute function public.claims_guard_writes();

revoke delete on public.claims from authenticated;


-- ---------------------------------------------------------------------------
-- 2. conversations: created only by get_or_create_claim_conversation()
-- ---------------------------------------------------------------------------

drop policy if exists "Claim parties can open a conversation" on public.conversations;

revoke insert, update, delete on public.conversations from authenticated;
grant update (status, last_message_at, updated_at) on public.conversations to authenticated;


-- ---------------------------------------------------------------------------
-- 3. messages: sender_type must match the sender's side
-- ---------------------------------------------------------------------------

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
       where c.id = messages.conversation_id
         and (
           (messages.sender_type = 'consumer' and c.consumer_id = (select auth.uid()))
           or (messages.sender_type = 'business' and c.business_owner_id = (select auth.uid()))
         )
    )
    and not exists (
      select 1
        from public.profiles p
       where p.id = (select auth.uid())
         and p.status = 'suspended'
    )
  );

revoke update, delete on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;


-- ---------------------------------------------------------------------------
-- 4. listing_requests: workflow columns and a daily cap
-- ---------------------------------------------------------------------------

create or replace function public.listing_requests_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(new.contact_email));
begin
  new.status := 'new';
  new.admin_notes := null;
  new.created_at := now();
  new.updated_at := now();

  -- ponytail: one global lock serialises the counts below. Fine at a handful of requests a
  -- day; key the lock on v_email if this table ever sees real volume.
  perform pg_advisory_xact_lock(hashtext('listing_requests_guard_insert'));

  if (select count(*)
        from public.listing_requests
       where created_at > now() - interval '1 day') >= 200 then
    raise exception 'too many listing requests today, please try again tomorrow'
      using errcode = 'PT429', hint = 'rate_limited';
  end if;

  if (select count(*)
        from public.listing_requests
       where lower(btrim(contact_email)) = v_email
         and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many listing requests from this email address today'
      using errcode = 'PT429', hint = 'rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.listing_requests_guard_insert() from public, anon, authenticated;

drop trigger if exists trg_listing_requests_guard_insert on public.listing_requests;
create trigger trg_listing_requests_guard_insert
  before insert on public.listing_requests
  for each row execute function public.listing_requests_guard_insert();


-- ---------------------------------------------------------------------------
-- 5. Grants nothing exercises
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

revoke insert, delete on public.profiles from authenticated;

revoke update on public.saved_deals from authenticated;

revoke delete on public.content_categories, public.content_locations from authenticated;


-- ---------------------------------------------------------------------------
-- 6. One approved owner per business
-- ---------------------------------------------------------------------------

create unique index if not exists business_profiles_one_approved_owner
  on public.business_profiles (business_id)
  where claim_status = 'approved';
