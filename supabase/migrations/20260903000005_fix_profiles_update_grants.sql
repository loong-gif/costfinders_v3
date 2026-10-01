-- Corrects 20260903000003, which did not actually close the hole.
--
-- That migration used column-level REVOKE, but public.profiles also carries a TABLE-LEVEL
-- UPDATE grant to anon and authenticated. In Postgres a table-level grant confers the
-- privilege on every column, so the column-level revoke had no effect and a verified
-- attack still set verification_status='fully_verified' and phone_verified_at.
--
-- The correct form is to revoke the table-level grant and then grant back only the columns
-- a consumer may legitimately write — the same allowlist src/lib/actions/profile.ts already
-- enforces in application code.

-- anon must not write profiles at all.
revoke update on public.profiles from anon;

-- Drop the blanket grant, then re-grant the safe subset.
revoke update on public.profiles from authenticated;
grant update (
  first_name,
  last_name,
  avatar_url,
  phone,
  location_city,
  location_state,
  alerts_email,
  alerts_sms,
  favorite_categories,
  updated_at
) on public.profiles to authenticated;

-- status, verification_status, phone_verified_at, last_login_at, created_at and id are now
-- unwritable by the client. They are maintained by:
--   status              -> public.admin_set_user_status() (SECURITY DEFINER, admin-gated)
--   verification_status -> sync_verification_status trigger (SECURITY DEFINER)
--   phone_verified_at   -> must move to a SECURITY DEFINER function when phone verification
--                          is actually implemented; nothing writes it today
--   last_login_at       -> handle_user_login trigger (SECURITY DEFINER)
