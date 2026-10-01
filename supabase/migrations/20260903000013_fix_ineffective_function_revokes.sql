-- Closes two gaps found while verifying the #21-#28 batch. Neither is in a filed issue.
--
-- 1. NOTIFICATION INJECTION IS STILL OPEN. 20260903000007 moved notification writes behind
--    public.create_notification() specifically to stop anyone dropping a message with a
--    click-through link into another user's feed -- its own comment says
--
--      -- A user may only be notified by the system on their own behalf, or by an admin.
--
--    but the function only ever checked `auth.uid() is null`. The intent was written down;
--    the check was not. Reproduced live on 2026-09-03: a signed-in consumer POSTed to
--    /rest/v1/rpc/create_notification targeting the ADMIN's user id with
--    link = https://evil.example/harvest and got HTTP 204. The phishing channel the
--    migration was written to close was never actually closed.
--
--    Every legitimate caller already satisfies the intended rule: src/lib/actions/claims.ts
--    notifies `user.id` (the caller themselves) and the other four call sites are admin
--    flows (admin-actions, admin-deal-moderation).
--
-- 2. THE REVOKES IN MIGRATIONS 3 AND 7 DID NOT TAKE EFFECT. Both did
--
--      revoke execute on function ... from anon;
--
--    A function is created with EXECUTE granted to PUBLIC, and PUBLIC is not the same
--    principal as `anon` -- revoking from the role leaves the PUBLIC grant untouched, and
--    anon inherits it. Confirmed in pg_proc.proacl, where both functions still carry the
--    leading `=X/postgres` that denotes PUBLIC:
--
--      admin_set_user_status  {=X/postgres,postgres=X/postgres,authenticated=X/postgres,...}
--      create_notification    {=X/postgres,postgres=X/postgres,authenticated=X/postgres,...}
--
--    This is the same shape of mistake as revoking a column privilege while a table-wide
--    grant is still in place (20260903000005) -- revoking at the wrong grain, and the
--    catalog being the only way to notice.
--
--    Not exploitable on its own: both functions raise 42501 for an anonymous caller on
--    their own internal checks, which is why this is a defence-in-depth repair rather than
--    a second live hole. Verified anon gets 'not authenticated' / 'not authorized' today.

-- 1. the missing authorization ----------------------------------------------
create or replace function public.create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  notification_link text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The rule migration 7 described but did not enforce. Without it any signed-in user can
  -- write an arbitrary title, body and link into any other user's notification feed.
  if target_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'not authorized to notify another user' using errcode = '42501';
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (target_user_id, notification_type, notification_title,
          notification_body, notification_link);
end;
$$;

-- 2. revoke at the right grain ----------------------------------------------
-- FROM PUBLIC, not just FROM anon. `public` is the implicit grantee every function is
-- created with; anon and authenticated both inherit it.
revoke execute on function public.create_notification(uuid, text, text, text, text) from public;
revoke execute on function public.create_notification(uuid, text, text, text, text) from anon;
grant execute on function public.create_notification(uuid, text, text, text, text) to authenticated;

revoke execute on function public.admin_set_user_status(uuid, text) from public;
revoke execute on function public.admin_set_user_status(uuid, text) from anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
