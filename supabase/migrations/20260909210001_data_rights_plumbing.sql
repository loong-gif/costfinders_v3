-- ---------------------------------------------------------------------------
-- Data-rights and email-compliance plumbing
-- ---------------------------------------------------------------------------
-- Backs four surfaces that had no storage behind them:
--
--   1. /unsubscribe — every transactional email footer has linked
--      `${SITE_URL}/unsubscribe` since the templates shipped, and that route
--      404'd. Opting out has to work without a session (a mailbox provider's
--      one-click POST carries no cookies), and an anonymous caller cannot
--      update someone else's `profiles` row under RLS. A per-profile random
--      token plus one SECURITY DEFINER function is the whole mechanism.
--
--   2. Email suppression — `profiles.alerts_email` has been written by the
--      settings screen and read by no sender. `sendEmail()` only knows the
--      recipient's address, and the address lives in `auth.users`, which the
--      app's anon/authenticated roles cannot read. Hence a lookup function.
--
--   3. Account deletion — "Delete account" was a mailto with nothing behind
--      it. A hard delete of the auth user needs a service-role key this
--      deployment does not have, so this does the part that IS possible
--      without one: delete the user's own rows and anonymise their profile,
--      and stamp `deletion_requested_at` so an operator can finish the job.
--
--   4. Listing removal / price-correction requests — 419 businesses are
--      published without opting in and no table could record a request to be
--      removed or corrected.
--
-- REVERSAL (no down-migrations on this project; run by hand if needed):
--   drop function if exists public.unsubscribe_by_token(uuid);
--   drop function if exists public.email_prefs_for_address(text);
--   drop function if exists public.request_account_deletion();
--   drop table if exists public.listing_requests;
--   drop index if exists public.profiles_unsubscribe_token_key;
--   alter table public.profiles drop column if exists unsubscribe_token;
--   alter table public.profiles drop column if exists deletion_requested_at;
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Profile columns
-- ---------------------------------------------------------------------------

-- 128 bits of randomness, so the unsubscribe link in an email is a bearer
-- token in its own right and needs no signature scheme or shared secret.
alter table public.profiles
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsubscribe_token_key
  on public.profiles (unsubscribe_token);

comment on column public.profiles.unsubscribe_token is
  'Bearer token for one-click email opt-out. Readable by the owner (table-level SELECT + own-row RLS); deliberately absent from the column-scoped UPDATE grant, so a user cannot rotate or forge it.';

-- Set when the user asks for deletion. NOT the same as `status`, which is the
-- admin suspension flag and is not self-updatable.
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is
  'Set by request_account_deletion(). The profile is already anonymised at this point; the stamp is the operator queue for removing the auth.users row, which needs a service-role key the app does not hold.';


-- ---------------------------------------------------------------------------
-- 2. One-click opt-out
-- ---------------------------------------------------------------------------

create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_matched integer;
begin
  if p_token is null then
    return false;
  end if;

  update public.profiles
     set alerts_email = false,
         updated_at = now()
   where unsubscribe_token = p_token
     and alerts_email is true;

  get diagnostics v_matched = row_count;

  if v_matched > 0 then
    return true;
  end if;

  -- Idempotent on purpose: Gmail and Yahoo retry one-click POSTs, and a
  -- second click on an already-opted-out token must not report failure.
  return exists (
    select 1 from public.profiles where unsubscribe_token = p_token
  );
end;
$$;

comment on function public.unsubscribe_by_token(uuid) is
  'Sets profiles.alerts_email = false for the profile holding this token. Callable anonymously by design — an opt-out link in an email has no session. Only ever turns mail OFF, so a guessed token (1 in 2^122) could not be used to enable anything.';

revoke all on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Suppression lookup for outbound mail
-- ---------------------------------------------------------------------------

create or replace function public.email_prefs_for_address(p_email text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'alerts_email', p.alerts_email,
           'unsubscribe_token', p.unsubscribe_token
         )
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(p_email))
   limit 1;
$$;

comment on function public.email_prefs_for_address(text) is
  'Returns {alerts_email, unsubscribe_token} for a recipient address, or NULL when no account has it. Reads auth.users, which anon/authenticated cannot, hence SECURITY DEFINER. Restricted to `authenticated` because it is a (narrow) account-existence oracle: every one of the app''s six send sites runs inside a signed-in request, so anon has no need for it.';

revoke all on function public.email_prefs_for_address(text) from public, anon;
grant execute on function public.email_prefs_for_address(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Account deletion
-- ---------------------------------------------------------------------------

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_saved integer := 0;
  v_notifications integer := 0;
begin
  if v_uid is null then
    -- 42501 so PostgREST answers 403 rather than 500.
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Wholly the user's own data, no counterparty: delete outright.
  delete from public.saved_deals where consumer_id = v_uid;
  get diagnostics v_saved = row_count;

  delete from public.notifications where user_id = v_uid;
  get diagnostics v_notifications = row_count;

  -- Retained deliberately, and the UI says so:
  --   claims   — a business's record of a lead it may have already acted on.
  --   messages — the other party's half of a conversation.
  -- Anonymising the profile is what de-identifies both; the retention window
  -- itself is the [RETENTION PERIOD] the privacy policy is still waiting on.
  update public.profiles
     set first_name           = null,
         last_name            = null,
         phone                = null,
         phone_verified_at    = null,
         avatar_url           = null,
         location_city        = null,
         location_state       = null,
         favorite_categories  = '{}'::text[],
         alerts_email         = false,
         alerts_sms           = false,
         deletion_requested_at = coalesce(deletion_requested_at, now()),
         updated_at           = now()
   where id = v_uid;

  return jsonb_build_object(
    'saved_deals_deleted', v_saved,
    'notifications_deleted', v_notifications,
    'claims_retained', (select count(*) from public.claims where consumer_id = v_uid),
    'messages_retained', (select count(*) from public.messages where sender_id = v_uid)
  );
end;
$$;

comment on function public.request_account_deletion() is
  'Deletes the caller''s saved_deals and notifications and anonymises their profile. Identity comes from auth.uid() only — never from an argument — because every Server Action is a public HTTP endpoint. Does NOT remove the auth.users row: that needs a service-role key this deployment does not have, which is what deletion_requested_at records.';

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Listing removal / correction requests
-- ---------------------------------------------------------------------------

create table if not exists public.listing_requests (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable: a requester may not know which row is theirs, and the business
  -- row can be deleted by the ingest while the request is still open.
  business_id   bigint references public.master_business_info (business_id) on delete set null,
  offer_id      bigint references public.promo_offer_master (id) on delete set null,
  request_type  text not null check (request_type in ('removal', 'correction', 'price_dispute', 'other')),
  business_name text not null,
  contact_name  text not null,
  contact_email text not null,
  contact_role  text,
  page_url      text,
  details       text not null,
  status        text not null default 'new' check (status in ('new', 'in_review', 'actioned', 'declined')),
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.listing_requests is
  'Removal, correction and disputed-price requests from businesses that never opted in to being listed. Insert-only for the public; readable and updatable by admins.';

create index if not exists listing_requests_status_created_idx
  on public.listing_requests (status, created_at desc);

alter table public.listing_requests enable row level security;

-- RLS ships with the table: enabled with no policies returns empty results,
-- not errors, which renders as a confident but false empty state.
drop policy if exists "Anyone can submit a listing request" on public.listing_requests;
create policy "Anyone can submit a listing request"
  on public.listing_requests for insert to anon, authenticated
  with check (true);

drop policy if exists "Admins can read listing requests" on public.listing_requests;
create policy "Admins can read listing requests"
  on public.listing_requests for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update listing requests" on public.listing_requests;
create policy "Admins can update listing requests"
  on public.listing_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Write-only for the public: no SELECT for anon, so a submitted request
-- (which carries a contact name and email) cannot be read back out.
revoke all on table public.listing_requests from anon, authenticated;
grant insert on table public.listing_requests to anon, authenticated;
grant select, update on table public.listing_requests to authenticated;
