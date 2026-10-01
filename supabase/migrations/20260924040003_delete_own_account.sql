-- Real account deletion, and no contact details for dead leads (security audit 2026-09-23,
-- finding 7).
--
-- WHY
-- "Delete account" ran request_account_deletion(), which blanked the profile's name and phone
-- but could not touch auth.users: that needs auth.admin.deleteUser and a service-role key this
-- deployment does not hold. The login survived, could still sign in by magic link, and its
-- email stayed readable to a clinic owner through claim_consumer_contact on any old lead,
-- including leads the customer had cancelled.
--
-- WHAT
--   * delete_own_account(): SECURITY DEFINER, identity from auth.uid() only (no argument to
--     substitute), EXECUTE for authenticated only. Refuses admins (42501): deleting the last
--     admin from a settings screen would lock everyone out of /admin. Clears saved deals,
--     revokes refresh tokens, and deletes the caller's auth.users row. The rest goes by
--     ON DELETE CASCADE:
--       auth.users -> profiles (CASCADE, already) -> claims (CASCADE, already) and
--                     saved_deals (CASCADE, already); claims -> conversations (CASCADE,
--                     already) -> messages (CASCADE, already)
--       auth.users -> notifications, business_profiles, admin_profiles, auth.sessions,
--                     auth.identities (CASCADE, already)
--     Three foreign keys were NO ACTION and would have made the delete fail. This sets them to
--     ON DELETE CASCADE:
--       conversations.consumer_id       -> auth.users
--       conversations.business_owner_id -> auth.users  (an owner deleting their account takes
--                                           their threads with them, including the consumer's
--                                           side; there is one owner account today)
--       messages.sender_id              -> auth.users
--     So a deleted customer's claims, threads and messages are deleted, not retained. Settings
--     copy that says claims "stay on file" is wrong after this; flagged to the orchestrator.
--   * DROPS request_account_deletion(): the app now calls delete_own_account(), and two
--     deletion paths with different promises is how the old one's copy drifted.
--   * claim_consumer_contact(): an approved owner still gets the customer's email, phone and
--     name for a live lead, but now gets NO ROW when the claim is cancelled, expired, or a
--     pending claim past expires_at, or when the profile carries deletion_requested_at (the
--     accounts the old anonymise-only path left behind; 0 today). A hard-deleted account has
--     no auth.users row, so its claims are gone and it returns nothing either. The 42501 for a
--     non-owner is unchanged.
--
-- VERIFY AFTER APPLYING (each block rolls back; run as postgres)
--
--   -- (ii) legit: a consumer deletes their account. Expect a jsonb row, then 0 | 0 | 0.
--   --      INSIDE A TRANSACTION THAT ROLLS BACK: this is the real test account.
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+user@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select public.delete_own_account();
--   reset role;
--   select (select count(*) from auth.users where email = 'haris+user@brandrap.com') as login,
--          (select count(*) from public.claims c where not exists
--             (select 1 from auth.users u where u.id = c.consumer_id)) as orphan_claims,
--          (select count(*) from auth.sessions s where not exists
--             (select 1 from auth.users u where u.id = s.user_id)) as orphan_sessions;
--   rollback;
--
--   -- (i) exploit: an admin deletes themselves (expect ERROR 42501), and anon calls it
--   --     (expect ERROR 42501 permission denied for function).
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+admin@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select public.delete_own_account();
--   rollback;
--   begin; set local role anon; select public.delete_own_account(); rollback;
--
--   -- (ii) legit: the business-765 owner reads the contact for a live lead (expect one row),
--   -- (i) then the same lead once cancelled (expect zero rows).
--   begin;
--   select set_config('app.drill_claim', (select id::text from public.claims where business_id = 765
--     and status not in ('cancelled', 'expired') and expires_at > now() limit 1), true);
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from public.claim_consumer_contact(current_setting('app.drill_claim')::uuid);
--   reset role;
--   update public.claims set status = 'cancelled' where id = current_setting('app.drill_claim')::uuid;
--   set local role authenticated;
--   select count(*) from public.claim_consumer_contact(current_setting('app.drill_claim')::uuid);
--   rollback;
--   -- (If the first count is 0, business 765 has no live lead right now: make one with the
--   --  claim drill in 20260924040001 inside the same transaction.)
--
-- In the app after applying: create a throwaway consumer account, claim a deal, delete the
-- account from /dashboard/settings, then confirm the magic link for that address no longer
-- signs in and the lead is gone from /admin/dashboard/leads.
--
-- ROLLBACK (exact reverse):
--   create or replace function public.claim_consumer_contact(p_claim_id uuid)
--    returns table(consumer_email text, consumer_phone text, consumer_name text)
--    language plpgsql stable security definer set search_path to ''
--   as $f$
--   begin
--     if not exists (
--       select 1 from public.claims c join public.business_profiles bp on bp.business_id = c.business_id
--        where c.id = p_claim_id and bp.id = (select auth.uid()) and bp.claim_status = 'approved'
--     ) then
--       raise exception 'not the approved owner of this claim' using errcode = '42501';
--     end if;
--     return query
--     select u.email::text, p.phone,
--            nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
--       from public.claims c
--       join auth.users u on u.id = c.consumer_id
--       left join public.profiles p on p.id = c.consumer_id
--      where c.id = p_claim_id;
--   end;
--   $f$;
--
--   -- request_account_deletion(): re-run section 4 of
--   -- 20260909210001_data_rights_plumbing.sql verbatim (create function, comment, revoke, grant).
--
--   drop function if exists public.delete_own_account();
--
--   alter table public.messages drop constraint messages_sender_id_fkey,
--     add constraint messages_sender_id_fkey foreign key (sender_id) references auth.users(id);
--   alter table public.conversations drop constraint conversations_business_owner_id_fkey,
--     add constraint conversations_business_owner_id_fkey foreign key (business_owner_id) references auth.users(id);
--   alter table public.conversations drop constraint conversations_consumer_id_fkey,
--     add constraint conversations_consumer_id_fkey foreign key (consumer_id) references auth.users(id);
--   -- (and revert requestAccountDeletionAction in src/lib/actions/profile.ts)


-- ---------------------------------------------------------------------------
-- 1. Foreign keys that would block deleting a user
-- ---------------------------------------------------------------------------

alter table public.conversations
  drop constraint conversations_consumer_id_fkey,
  add constraint conversations_consumer_id_fkey
    foreign key (consumer_id) references auth.users (id) on delete cascade;

alter table public.conversations
  drop constraint conversations_business_owner_id_fkey,
  add constraint conversations_business_owner_id_fkey
    foreign key (business_owner_id) references auth.users (id) on delete cascade;

alter table public.messages
  drop constraint messages_sender_id_fkey,
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references auth.users (id) on delete cascade;


-- ---------------------------------------------------------------------------
-- 2. delete_own_account()
-- ---------------------------------------------------------------------------

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_saved integer;
  v_notifications integer;
  v_claims integer;
  v_messages integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.admin_profiles where id = v_uid) then
    raise exception 'an admin account cannot be deleted from account settings'
      using errcode = '42501';
  end if;

  select count(*) into v_saved from public.saved_deals where consumer_id = v_uid;
  select count(*) into v_notifications from public.notifications where user_id = v_uid;
  select count(*) into v_claims from public.claims where consumer_id = v_uid;
  select count(*) into v_messages from public.messages where sender_id = v_uid;

  -- refresh_tokens carries user_id as text with no foreign key, so nothing cascades to it.
  delete from auth.refresh_tokens where user_id = v_uid::text;
  delete from auth.users where id = v_uid;

  if found is not true then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'saved_deals_deleted', v_saved,
    'notifications_deleted', v_notifications,
    'claims_deleted', v_claims,
    'messages_deleted', v_messages
  );
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the caller''s auth.users row; profile, claims, saved deals, notifications, threads and messages follow by ON DELETE CASCADE. auth.uid() only. Refuses admins. See 20260924040003.';

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

drop function if exists public.request_account_deletion();


-- ---------------------------------------------------------------------------
-- 3. claim_consumer_contact(): nothing for dead leads or forgotten accounts
-- ---------------------------------------------------------------------------

create or replace function public.claim_consumer_contact(p_claim_id uuid)
returns table(consumer_email text, consumer_phone text, consumer_name text)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1
      from public.claims c
      join public.business_profiles bp on bp.business_id = c.business_id
     where c.id = p_claim_id
       and bp.id = (select auth.uid())
       and bp.claim_status = 'approved'
  ) then
    raise exception 'not the approved owner of this claim'
      using errcode = '42501';
  end if;

  return query
  select u.email::text,
         p.phone,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
    from public.claims c
    join auth.users u on u.id = c.consumer_id
    left join public.profiles p on p.id = c.consumer_id
   where c.id = p_claim_id
     and c.status not in ('cancelled', 'expired')
     and not (c.status = 'pending' and c.expires_at < now())
     and p.deletion_requested_at is null;
end;
$$;
