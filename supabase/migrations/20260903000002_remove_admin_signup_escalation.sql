-- Fixes GitHub issue #3: anyone could mint a super_admin through public signup.
--
-- handle_new_admin_user() is SECURITY DEFINER and branched on
-- raw_user_meta_data->>'role', which the client sets freely at signUp(). Passing
-- {role:'admin', admin_role:'super_admin'} therefore created an admin_profiles row with
-- full permissions. src/proxy.ts then gated /admin/dashboard on that same client-writable
-- field, so the escalation was end-to-end.
--
-- Admin accounts must be provisioned deliberately, never self-served. Dropping the trigger
-- and the function removes the path entirely; the existing admin keeps working because
-- authorization now reads public.admin_profiles (see public.is_admin()).

drop trigger if exists on_admin_user_created on auth.users;
drop function if exists public.handle_new_admin_user();

-- To provision an admin from now on: create the auth user, then insert the admin_profiles
-- row explicitly, e.g.
--   insert into public.admin_profiles (id, email, first_name, last_name, role, permissions)
--   values ('<auth.users.id>', '<email>', '<first>', '<last>', 'super_admin',
--           array['manage_users','manage_businesses','manage_deals','manage_content',
--                 'manage_admins','view_analytics','manage_settings']);
