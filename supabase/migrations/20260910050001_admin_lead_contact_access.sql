-- Give an admin a way to read a user's email address.
--
-- WHY
-- /admin/dashboard/leads is the only path by which a lead reaches a business, and it could not
-- contact either party. `profiles` has no email column (information_schema: id, first_name,
-- last_name, avatar_url, phone, phone_verified_at, verification_status, location_city,
-- location_state, alerts_email, alerts_sms, favorite_categories, status, created_at,
-- updated_at, last_login_at, unsubscribe_token, deletion_requested_at) — the address lives
-- only in `auth.users`, which PostgREST does not expose and RLS on `public` cannot reach.
--
-- This is not theoretical. The one live claim (399dfccf, deal 8556, business 765) belongs to
-- consumer 64567837, whose profiles row has first_name NULL, last_name NULL and phone NULL.
-- Email is the ONLY handle that exists for that person. Without this function the screen
-- renders "64567837" and a Mark relayed button, and an admin marks work relayed that they had
-- no means to perform.
--
-- The same gap makes /admin/dashboard/users unable to look a consumer up by address (3 of 8
-- profiles have no name at all), so this is deliberately a general accessor rather than a
-- leads-shaped one.
--
-- SHAPE
-- Takes an array of ids and returns only the rows asked for, so the caller batches one round
-- trip per screen instead of one per row. It is NOT an enumerator: it cannot list users, and
-- an id the caller does not already hold returns nothing.
--
-- AUTHORIZATION
-- SECURITY DEFINER, because auth.users is unreadable to `authenticated` by design. The guard
-- is private.is_admin() — membership of admin_profiles, the single authority every other guard
-- in this project resolves to — and it RAISES rather than returning zero rows, because a
-- silent empty result is exactly how an authorization failure gets rendered as "no data" (the
-- failure mode 20260910040001 was written to close on public.claims).
--
-- Never granted to `anon`. `authenticated` may execute it, but the raise inside means a
-- non-admin signed-in caller gets 42501, not a list of addresses.
--
-- REVERT
-- This migration creates a new object; nothing is replaced, so there is no prior definition to
-- quote. To revert from the repo alone:
--     drop function if exists public.admin_user_emails(uuid[]);

create or replace function public.admin_user_emails(p_user_ids uuid[])
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admin access required'
      using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    where u.id = any(p_user_ids);
end;
$$;

comment on function public.admin_user_emails(uuid[]) is
  'Resolve auth.users.email for a caller-supplied set of user ids. Admin only: raises 42501 '
  'unless private.is_admin(). Takes ids rather than returning a list, so it identifies users '
  'the caller already holds and cannot be used to enumerate accounts. Exists because '
  'public.profiles carries no email column and /admin/dashboard/leads cannot relay a lead '
  'without one.';

-- anon must never reach an address.
revoke execute on function public.admin_user_emails(uuid[]) from anon, public;
grant execute on function public.admin_user_emails(uuid[]) to authenticated, service_role;
