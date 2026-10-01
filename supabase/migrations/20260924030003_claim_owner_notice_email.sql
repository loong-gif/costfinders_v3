-- The address to email when a lead on a business with an owner is passed on to that owner.
--
-- WHY
-- A new lead reached the owner of business 765 only if they happened to log in: the claim notice
-- goes to the ops inbox and nothing went to the owner. The app now emails the owner
-- (src/lib/email/ownerNotifications.ts), but the owner's address lives in auth.users, and
-- business_profiles' only non-admin SELECT policy is auth.uid() = id. The app holds no
-- service-role key by design, so a scoped SECURITY DEFINER accessor is the path, as with
-- claim_consumer_contact.
--
-- THE RULE
-- Returns the approved owner's auth email for ONE claim, and only to an admin (private.is_admin(),
-- the rule the RLS policies use) or to the service_role. Every other caller — a consumer, an
-- owner, anon — gets NULL, never an error, so a best-effort sender can call it unconditionally.
-- A claim on a business with no approved owner (418 of 419 today) also returns NULL. Owner
-- choice mirrors get_or_create_claim_conversation (earliest approved business_profiles row).
--
-- A consumer must never learn an owner's login address, so the send cannot run in the consumer's
-- own request. It runs when an admin marks the lead relayed, in the admin's session. Sending the
-- moment a consumer claims or messages needs a server-side sending identity (a service-role key
-- on the server, or a database-side sender) — an owner step; until then those calls get NULL
-- and send nothing.
--
-- Grants: EXECUTE for authenticated (so the call never errors for anyone signed in) and
-- service_role; revoked from public and anon.
--
-- ROLLBACK:
--   drop function if exists public.claim_owner_notice_email(uuid);

create or replace function public.claim_owner_notice_email(p_claim_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.claims c
  join public.business_profiles bp
    on bp.business_id = c.business_id
   and bp.claim_status = 'approved'
  join auth.users u on u.id = bp.id
  where c.id = p_claim_id
    and (
      private.is_admin()
      or coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
    )
  order by bp.created_at
  limit 1
$$;

revoke all on function public.claim_owner_notice_email(uuid) from public, anon;
grant execute on function public.claim_owner_notice_email(uuid) to authenticated, service_role;
