-- Retire the two accounts whose passwords were committed to this repository
-- (admin@costfinder.local, an admin; testuser@costfinders.com, a consumer).
--
-- Non-destructive on purpose: the auth.users rows stay, so nothing cascades and
-- nothing that referenced them breaks. The leaked credentials become inert instead:
--   * admin privilege removed (membership in admin_profiles IS the privilege),
--   * every session and refresh token revoked (a password change alone leaves
--     existing sessions valid),
--   * the password replaced with a random value nobody knows.
-- Looked up by email, never by id, so this is safe to re-run.
-- Applied 2026-09-24 via the Supabase MCP as `retire_leaked_admin_account`.
--
-- ROLLBACK: none for the passwords (they were leaked; do not restore them).
-- Re-granting admin is a deliberate `insert into public.admin_profiles`.
do $$
declare
  v_id uuid;
  v_email text;
begin
  foreach v_email in array array['admin@costfinder.local', 'testuser@costfinders.com'] loop
    select id into v_id from auth.users where email = v_email;
    if v_id is null then
      continue;
    end if;
    delete from public.admin_profiles where id = v_id;
    delete from auth.refresh_tokens where user_id = v_id::text;
    delete from auth.sessions where user_id = v_id;
    update auth.users
       set encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
           updated_at = now()
     where id = v_id;
  end loop;
end $$;
