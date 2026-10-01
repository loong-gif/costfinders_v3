-- Fixes GitHub issue #2: business_profiles and business_claims did not exist.
--
-- These are the two most-referenced tables in src/ (18 and 17 references), yet neither
-- was ever created. Two earlier migrations claim to have made them
-- (20260321004937_create_business_profiles, 20260324093308_create_business_claims) but
-- the tables are absent from pg_class, so those migrations did not do what their names say.
--
-- Consequence: the on_business_user_created trigger inserts into public.business_profiles,
-- the insert fails, and the auth.users insert rolls back — so med spa owner signup returned
-- "Database error saving new user" and NO business owner could register at all. Every
-- business dashboard route, the admin claims queue, and messaging depend on these tables.
--
-- Column set is derived from actual code usage, not invented. Columns that appear in
-- queries as `master_business_info (...)` or `business_claims (...)` are PostgREST embedded
-- joins and are deliberately NOT columns here.

-- business_profiles --------------------------------------------------------
-- One row per business-owner auth user. Created by the on_business_user_created trigger.
create table if not exists public.business_profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  first_name          text not null default '',
  last_name           text not null default '',
  -- set once a claim is approved; links the owner to their listing
  business_id         bigint references public.master_business_info (business_id) on delete set null,
  claim_status        text not null default 'none'
                        check (claim_status in ('none','unclaimed','pending','approved','rejected')),
  verification_status text not null default 'unverified'
                        check (verification_status in ('unverified','email_verified','verified','fully_verified')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_business_profiles_business_id
  on public.business_profiles (business_id);
create index if not exists idx_business_profiles_claim_status
  on public.business_profiles (claim_status);

-- business_claims ----------------------------------------------------------
-- One row per attempt by an owner to claim a listing, including verification state.
create table if not exists public.business_claims (
  id                           uuid primary key default gen_random_uuid(),
  profile_id                   uuid not null references public.business_profiles (id) on delete cascade,
  business_id                  bigint not null references public.master_business_info (business_id) on delete cascade,
  status                       text not null default 'pending'
                                 check (status in ('pending','code_sent','verified','approved','rejected')),
  verification_method          text check (verification_method in ('email','phone','document')),
  verification_code            text,
  verification_code_expires_at timestamptz,
  verification_attempts        integer not null default 0,
  evidence_document_url        text,
  admin_notes                  text,
  reviewed_at                  timestamptz,
  reviewed_by                  uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create index if not exists idx_business_claims_profile_id on public.business_claims (profile_id);
create index if not exists idx_business_claims_business_id on public.business_claims (business_id);
create index if not exists idx_business_claims_status on public.business_claims (status);

-- one business can only be successfully claimed once
create unique index if not exists uq_business_claims_approved_business
  on public.business_claims (business_id) where status = 'approved';

-- updated_at triggers ------------------------------------------------------
create trigger trg_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.update_updated_at_column();

create trigger trg_business_claims_updated_at
  before update on public.business_claims
  for each row execute function public.update_updated_at_column();

-- RLS ----------------------------------------------------------------------
-- Policies ship with the table (see CLAUDE.md): RLS on with no policies returns empty
-- results rather than errors, which renders as a false empty state in the UI.
alter table public.business_profiles enable row level security;
alter table public.business_claims  enable row level security;

-- owners see and maintain only their own profile row
create policy "Owners can read own business profile"
  on public.business_profiles for select to authenticated using (auth.uid() = id);
create policy "Owners can update own business profile"
  on public.business_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- admins see and moderate all of them
create policy "Admins can read all business profiles"
  on public.business_profiles for select to authenticated using (public.is_admin());
create policy "Admins can update business profiles"
  on public.business_profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- owners manage their own claims
create policy "Owners can read own claims"
  on public.business_claims for select to authenticated using (auth.uid() = profile_id);
create policy "Owners can create own claims"
  on public.business_claims for insert to authenticated with check (auth.uid() = profile_id);
create policy "Owners can update own claims"
  on public.business_claims for update to authenticated
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "Admins can read all claims"
  on public.business_claims for select to authenticated using (public.is_admin());
create policy "Admins can moderate claims"
  on public.business_claims for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- An owner must never be able to approve their own claim. Column-level REVOKE cannot do
-- this: admins authenticate as the same `authenticated` role, so revoking from that role
-- would disable admin moderation too. Guard with a trigger that compares OLD to NEW and
-- lets only an admin change the approval-bearing columns.
create or replace function public.guard_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'business_profiles' then
    if new.claim_status is distinct from old.claim_status
       or new.verification_status is distinct from old.verification_status
       or new.business_id is distinct from old.business_id then
      raise exception 'only an admin may change claim_status, verification_status or business_id'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'business_claims' then
    -- an owner may advance their own claim to code_sent/verified during verification,
    -- but may never approve or reject it, nor write the review fields
    if new.status in ('approved','rejected') and new.status is distinct from old.status then
      raise exception 'only an admin may approve or reject a claim' using errcode = '42501';
    end if;
    if new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.admin_notes is distinct from old.admin_notes then
      raise exception 'only an admin may write claim review fields' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_guard_business_profiles_privileged
  before update on public.business_profiles
  for each row execute function public.guard_business_privileged_columns();

create trigger trg_guard_business_claims_privileged
  before update on public.business_claims
  for each row execute function public.guard_business_privileged_columns();
