-- Fixes GitHub issue #4: users could un-suspend and self-verify themselves.
--
-- RLS restricts WHICH ROW a user may update, not WHICH COLUMNS. The policy
-- "Users can update own profile" (using auth.uid() = id) combined with a table-wide
-- UPDATE grant let any authenticated user PATCH their own profiles row and set
-- status='active' after being suspended, or verification_status='verified' /
-- phone_verified_at=now() to skip verification.
--
-- The consumer profile action (src/lib/actions/profile.ts) already writes through a
-- field allowlist (first_name, last_name, phone, location_city, location_state,
-- alerts_email, alerts_sms), so removing these columns from the grant breaks nothing
-- a consumer legitimately does.
--
-- verification_status continues to be maintained by the sync_verification_status
-- trigger, which is SECURITY DEFINER and therefore unaffected by these grants.

revoke update (status, verification_status, phone_verified_at)
  on public.profiles from anon, authenticated;

-- anon must never write claims at all.
revoke update on public.claims from anon;

-- Admin suspension needs a privileged path now that the direct column grant is gone.
create or replace function public.admin_set_user_status(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if new_status not in ('active', 'suspended') then
    raise exception 'invalid status: %', new_status using errcode = '22023';
  end if;

  update public.profiles
     set status = new_status,
         updated_at = now()
   where id = target_user_id;
end;
$$;

revoke execute on function public.admin_set_user_status(uuid, text) from anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- FOLLOW-UP (not addressed here, needs product input): the policy
-- "Consumers can update own claims" still lets a consumer set claims.status directly,
-- so a user could mark their own claim 'booked'. Deciding which transitions a consumer
-- may perform is a product question, not a mechanical one.
