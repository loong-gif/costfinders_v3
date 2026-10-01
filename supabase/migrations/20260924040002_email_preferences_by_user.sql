-- Make "unsubscribe" work without an account-existence oracle (security audit 2026-09-23,
-- finding 6).
--
-- WHY
-- sendEmail() checks the recipient's opt-out before every non-essential email and puts a
-- one-click unsubscribe token in the footer. It asked email_prefs_for_address(p_email), which
-- takes an ADDRESS. 20260909210001_data_rights_plumbing.sql granted that to authenticated,
-- which lets any signed-in user test whether an address has an account and read the token that
-- unsubscribes it. The live database had since dropped the grant (EXECUTE is postgres and
-- service_role only), so every lookup failed, sendEmail failed open, opted-out people kept
-- getting mail, and no email carried a working one-click link.
--
-- WHAT
--   * email_preferences_for_user(p_user_id uuid) -> (email_opt_out, unsubscribe_token).
--     Keyed by user id, not address. Callable by anon and authenticated: the send runs in
--     whatever session triggered it (a consumer's request mails the business owner, an admin's
--     mails an owner), and a random v4 uuid cannot be enumerated.
--     Known ceiling: a user id is not secret from a counterparty. An approved owner sees their
--     leads' consumer ids and a consumer sees their thread's owner id, so either could read the
--     other's opt-out flag and token, and the token can only turn email OFF. Those are the only
--     people who hold the id, so a per-caller check here would admit exactly the same set.
--   * DROPS email_prefs_for_address(text). This supersedes its grant in
--     20260909210001_data_rights_plumbing.sql (not edited; that file is history). Nothing in
--     the app calls it after src/lib/email/optOut.ts moved to the function above.
--   * unsubscribe_by_token(uuid) is unchanged. It is what /unsubscribe/confirm calls, keyed by
--     the token, only ever sets alerts_email = false, and returns true/false for a token, so
--     it cannot enumerate users. Its grant is restated so this file is the whole picture.
--
-- VERIFY AFTER APPLYING (each block rolls back; run as postgres)
--
--   -- (i) the address oracle is gone. Expect ERROR 42883 function ... does not exist.
--   begin; set local role authenticated;
--   select public.email_prefs_for_address('haris+user@brandrap.com');
--   rollback;
--
--   -- (ii) legit: the lookup by id, from an anonymous session. Expect one row: f | <uuid>
--   --      (t if that account has turned notifications off).
--   begin;
--   select set_config('app.drill_uid', (select id::text from auth.users where email = 'haris+user@brandrap.com'), true);
--   set local role anon;
--   select * from public.email_preferences_for_user(current_setting('app.drill_uid')::uuid);
--   rollback;
--
--   -- (i) an unknown id reveals nothing. Expect zero rows.
--   begin; set local role anon;
--   select * from public.email_preferences_for_user(gen_random_uuid());
--   rollback;
--
--   -- (i) a guessed token neither works nor tells you anything. Expect f.
--   -- (ii) the real token opts the account out. Expect t, then alerts_email f.
--   begin;
--   select set_config('app.drill_token', (select p.unsubscribe_token::text from public.profiles p
--     join auth.users u on u.id = p.id where u.email = 'haris+user@brandrap.com'), true);
--   set local role anon;
--   select public.unsubscribe_by_token(gen_random_uuid());
--   select public.unsubscribe_by_token(current_setting('app.drill_token')::uuid);
--   reset role;
--   select p.alerts_email from public.profiles p join auth.users u on u.id = p.id
--    where u.email = 'haris+user@brandrap.com';
--   rollback;
--
-- In the app after applying: sign in as haris+user, claim a deal, and check the receipt's
-- footer link carries ?token=; open it, press Unsubscribe, and confirm /dashboard/settings
-- shows email notifications off. Then turn them back on.
--
-- ROLLBACK (exact reverse):
--   create or replace function public.email_prefs_for_address(p_email text)
--   returns jsonb language sql security definer set search_path = public, pg_temp
--   as $f$
--     select jsonb_build_object('alerts_email', p.alerts_email, 'unsubscribe_token', p.unsubscribe_token)
--       from auth.users u join public.profiles p on p.id = u.id
--      where lower(u.email) = lower(btrim(p_email))
--      limit 1;
--   $f$;
--   revoke all on function public.email_prefs_for_address(text) from public, anon, authenticated;
--   drop function if exists public.email_preferences_for_user(uuid);
--   -- (and revert src/lib/email/optOut.ts, which calls the new function)

create or replace function public.email_preferences_for_user(p_user_id uuid)
returns table (email_opt_out boolean, unsubscribe_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select not p.alerts_email, p.unsubscribe_token
    from public.profiles p
   where p.id = p_user_id
$$;

comment on function public.email_preferences_for_user(uuid) is
  'Opt-out flag and one-click unsubscribe token for one account, for sendEmail(). Keyed by user id so it is not an address oracle. See 20260924040002.';

revoke all on function public.email_preferences_for_user(uuid) from public;
grant execute on function public.email_preferences_for_user(uuid) to anon, authenticated;

drop function if exists public.email_prefs_for_address(text);

revoke all on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
