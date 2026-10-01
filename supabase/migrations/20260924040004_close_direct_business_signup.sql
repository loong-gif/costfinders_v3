-- Close the direct business sign-up path while business onboarding is closed.
--
-- WHY
-- Business onboarding is closed at launch and the app no longer offers business sign-up. But
-- the trigger on_business_user_created (AFTER INSERT ON auth.users) still runs
-- public.handle_new_business_user(), which creates a business_profiles row for ANY GoTrue
-- sign-up whose metadata says role: 'business'. That metadata is client-supplied: anyone can
-- POST /auth/v1/signup with the public anon key and {"data": {"role": "business"}}. It does not
-- grant access by itself (claim_status starts 'none' and only an admin RPC approves), but it
-- puts unvetted rows into the owner table the admin screens and owner checks read, through a
-- door the product says is shut. user_metadata must never decide what kind of account exists.
--
-- WHAT
-- handle_new_business_user() becomes a no-op that returns NEW. The trigger stays attached.
-- Chosen over `ALTER TABLE auth.users DISABLE TRIGGER on_business_user_created` because that
-- statement needs ownership of auth.users, and checked live on 2026-09-24: auth.users is owned
-- by supabase_auth_admin, and postgres is neither a superuser nor a member of that role, so the
-- ALTER would fail with "must be owner of table users". Replacing a public function body needs
-- only ownership of the function (postgres), and GoTrue upgrades never touch public functions.
-- handle_new_user() (on_auth_user_created, the consumer profiles row) is untouched, so a
-- business-flagged sign-up still gets an ordinary consumer account.
-- The one existing business_profiles row (business 765's owner) is not touched.
--
-- RE-ENABLE WHEN ONBOARDING OPENS: run the ROLLBACK block below. Before doing that, fix
-- ownership verification first (security audit finding 3: the code goes to the claimant's own
-- email, and issue_business_claim_code returns it in plaintext), or this reopens the same hole.
--
-- VERIFY AFTER APPLYING (rolls back; run as postgres)
--
--   -- (i) the anon-key sign-up with business metadata. Expect: consumer_profile 1 | business_profile 0.
--   begin;
--   insert into auth.users (id, email, raw_user_meta_data)
--   values ('0b0b0b0b-0000-4000-8000-000000000001', 'business-drill@example.invalid',
--           '{"role": "business", "first_name": "Drill"}'::jsonb);
--   select (select count(*) from public.profiles
--            where id = '0b0b0b0b-0000-4000-8000-000000000001') as consumer_profile,
--          (select count(*) from public.business_profiles
--            where id = '0b0b0b0b-0000-4000-8000-000000000001') as business_profile;
--   rollback;
--
--   -- (ii) the trigger is still attached and enabled. Expect: on_business_user_created | O.
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'auth.users'::regclass and tgname = 'on_business_user_created';
--
-- Legit path to re-test in the app: sign up a new consumer from the header's sign-in modal
-- (the Sign up tab) and confirm /dashboard loads with a profile. The existing owner (haris+biz) still signs in to
-- /business/dashboard.
--
-- ROLLBACK (exact reverse, the live body read 2026-09-24):
--   create or replace function public.handle_new_business_user()
--    returns trigger language plpgsql security definer set search_path to 'public'
--   as $function$
--   begin
--     if new.raw_user_meta_data ->> 'role' = 'business' then
--       insert into public.business_profiles (id, email, first_name, last_name)
--       values (
--         new.id,
--         new.email,
--         coalesce(new.raw_user_meta_data ->> 'first_name', ''),
--         coalesce(new.raw_user_meta_data ->> 'last_name', '')
--       );
--     end if;
--     return new;
--   end;
--   $function$;

create or replace function public.handle_new_business_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Business onboarding is closed: see 20260924040004. Kept as a no-op so the trigger on
  -- auth.users (which postgres cannot drop or disable) does nothing.
  return new;
end;
$function$;

comment on function public.handle_new_business_user() is
  'No-op while business onboarding is closed (20260924040004). Its rollback block restores the business_profiles insert.';
