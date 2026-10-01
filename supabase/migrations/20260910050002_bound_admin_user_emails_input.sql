-- Bound the input to public.admin_user_emails(uuid[]).
--
-- WHY
-- 20260910050001 shipped the accessor with no limit on the array. `private.is_admin()` is a
-- real gate, but an unbounded id list turns a per-screen lookup into a whole-directory export:
-- one call carrying every id in the system returns every address in the system. The function is
-- meant to identify the rows an admin already has on screen, so the size of what is on screen
-- is the honest bound. 200 covers the widest caller today by a wide margin — the leads screen
-- reads at most 50 relayed rows plus the pending queue, and the ids are de-duplicated before
-- the call — and src/lib/actions/admin-leads.ts chunks its lookups at this same size, so a
-- larger queue costs extra round trips rather than failing.
--
-- Raises rather than truncating. A silently short result would render as "no email on file"
-- for the rows past the cap, which is the class of confident-but-false empty state this
-- remediation keeps closing.
--
-- PRIOR DEFINITION (20260910050001), verbatim, so this file alone is enough to revert:
--
--   create or replace function public.admin_user_emails(p_user_ids uuid[])
--   returns table (user_id uuid, email text)
--   language plpgsql
--   stable
--   security definer
--   set search_path = ''
--   as $$
--   begin
--     if not private.is_admin() then
--       raise exception 'admin access required'
--         using errcode = '42501';
--     end if;
--
--     return query
--       select u.id, u.email::text
--       from auth.users u
--       where u.id = any(p_user_ids);
--   end;
--   $$;
--
-- Grants and the comment are unchanged by this migration; `create or replace` preserves both.

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

  -- A lookup for the rows on screen, not an export of the user directory.
  if coalesce(array_length(p_user_ids, 1), 0) > 200 then
    raise exception 'admin_user_emails accepts at most 200 ids per call, got %',
      array_length(p_user_ids, 1)
      using errcode = '22023';
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    where u.id = any(p_user_ids);
end;
$$;
