-- Fixes GitHub issue #5: RLS enabled with zero policies on admin-facing tables.
--
-- content_categories (6 rows), content_locations (25 rows) and admin_audit_log all had RLS
-- enabled and NO policies. PostgREST returns an empty result set rather than an error in that
-- state, so the admin UI rendered a confident but false empty state ("0 Total Categories") over
-- real data, and audit-log writes failed silently.
--
-- These are admin-only configuration surfaces; the public site does not read them (it uses the
-- static map in src/lib/data/categories.ts). Least privilege: admins only.

-- helper: is the current caller an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where id = auth.uid());
$$;

revoke execute on function public.is_admin() from anon;

-- content_categories -------------------------------------------------------
create policy "Admins can read content categories"
  on public.content_categories for select to authenticated using (public.is_admin());
create policy "Admins can insert content categories"
  on public.content_categories for insert to authenticated with check (public.is_admin());
create policy "Admins can update content categories"
  on public.content_categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- content_locations --------------------------------------------------------
create policy "Admins can read content locations"
  on public.content_locations for select to authenticated using (public.is_admin());
create policy "Admins can insert content locations"
  on public.content_locations for insert to authenticated with check (public.is_admin());
create policy "Admins can update content locations"
  on public.content_locations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- admin_audit_log ----------------------------------------------------------
-- Append-only: admins may read and insert, but never update or delete.
create policy "Admins can read audit log"
  on public.admin_audit_log for select to authenticated using (public.is_admin());
create policy "Admins can append to audit log"
  on public.admin_audit_log for insert to authenticated with check (public.is_admin());

-- Deliberately NOT given policies (remain deny-all, which is correct):
--   monitor_state, promo_email_staging, promo_website_staging, promo_social_staging,
--   social_data_production  -- internal ingestion pipeline, must not be reachable via the API
--   business_reviews, clinic_services, promo_membership_plans
--     -- populated but referenced nowhere in src/; leave denied until a feature needs them,
--        then add a scoped read policy rather than a blanket public one.
