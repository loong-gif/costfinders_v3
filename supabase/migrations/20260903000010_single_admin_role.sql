-- Collapses admin_profiles.role to a single value.
--
-- Found while fixing #23. The codebase carried TWO contradictory definitions of "admin":
--
--   public.is_admin()                     -> true for ANY admin_profiles row
--   admin-deal-moderation.ts verifyAdmin  -> role in ('admin','super_admin')
--
-- Every RLS policy on this project calls is_admin(), so the database already treated
-- membership in admin_profiles as the whole of admin. The application-layer tier check was
-- the odd one out, and the two disagreed for the only admin account that exists:
-- admin@costfinder.local has role='support' (the column default), so RLS let it do
-- everything while /admin/dashboard/deals answered "Insufficient permissions."
--
-- The owner's decision is one admin role. So membership IS the privilege, and the column
-- becomes a single-valued label rather than a tier. It is kept rather than dropped because
-- /admin/dashboard/settings renders it, and constrained rather than left free text so a
-- future insert cannot quietly reintroduce a second tier that nothing enforces.
--
-- 'support' and 'super_admin' never meant anything at the database layer -- there is no
-- policy anywhere that distinguishes them -- so normalising them to 'admin' grants no
-- privilege that is_admin() was not already granting.
--
-- Worse than merely inconsistent: the pre-existing constraint was
--   CHECK (role = ANY (ARRAY['super_admin','moderator','support']))
-- so 'admin' was never a LEGAL value for the column, while the application checked
-- `role !== 'admin' && role !== 'super_admin'`. That check could therefore only ever admit
-- 'super_admin', which no account has -- deal moderation was unreachable for every account
-- that could exist. The constraint has to be dropped BEFORE the update, or the update
-- itself trips the old one.

alter table public.admin_profiles
  drop constraint if exists admin_profiles_role_check;

update public.admin_profiles set role = 'admin' where role <> 'admin';

alter table public.admin_profiles alter column role set default 'admin';

alter table public.admin_profiles
  add constraint admin_profiles_role_check check (role = 'admin');

-- NOTE: admin_profiles.permissions (text[], default '{}') is likewise not read by any
-- policy or any server-side gate; it is displayed on the settings page and nothing else.
-- Left alone deliberately -- removing it is a UI change, not a security one.

notify pgrst, 'reload schema';
