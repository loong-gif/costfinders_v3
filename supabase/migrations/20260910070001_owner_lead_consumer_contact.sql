-- Let a business owner read the contact details of a consumer who claimed one of their deals.
--
-- WHAT WAS BROKEN
-- `20260910040001` gave owners SELECT on their own `claims`, which fixed "the owner cannot see
-- the lead". It did not fix "the owner cannot contact the person", and the lead detail screen
-- was promising they could:
--
--   Contact info will be revealed after you mark this lead as contacted.
--
-- Marking it contacted revealed, verbatim, "Available after consumer profile integration" for
-- both email and phone — a developer placeholder on a customer-facing screen, shown only after
-- the owner had already changed the lead's status on the strength of the promise. Verified in
-- the browser against the live claim.
--
-- The consumer's phone lives on `public.profiles`, which owners cannot read (correctly — it is
-- the consumer's own row). Their email is not in `public` at all; it is on `auth.users`.
--
-- THE FIX
-- A narrow accessor, scoped exactly like the claims SELECT policy: the caller must hold an
-- APPROVED `business_profiles` row whose `business_id` matches the claim's. One claim per call,
-- so it cannot be used to enumerate; it returns only the three fields the screen renders.
--
-- Deliberately NOT reusing `admin_user_emails` — that one is admin-only and takes an array of
-- arbitrary user ids. Widening it to owners would have handed every owner a bulk email lookup.
--
-- ponytail: the durable shape is to SNAPSHOT the consumer's contact details onto the claim row
-- at claim time — that snapshot IS the lead the business is being given, and unlike this it
-- survives the consumer later editing or deleting their profile. That is a change to the claim
-- write path and to what "delete my account" means, so it is not being smuggled in here.
--
-- Reverse: `drop function public.claim_consumer_contact(uuid);`

create or replace function public.claim_consumer_contact(p_claim_id uuid)
returns table (consumer_email text, consumer_phone text, consumer_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.claims c
    join public.business_profiles bp on bp.business_id = c.business_id
    where c.id = p_claim_id
      and bp.id = (select auth.uid())
      and bp.claim_status = 'approved'
  ) then
    raise exception 'not the approved owner of this claim'
      using errcode = '42501';
  end if;

  return query
  select u.email::text,
         p.phone,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
  from public.claims c
  join auth.users u on u.id = c.consumer_id
  left join public.profiles p on p.id = c.consumer_id
  where c.id = p_claim_id;
end;
$$;

comment on function public.claim_consumer_contact(uuid) is
  'Contact details for the consumer behind ONE claim, readable only by the approved owner of '
  'that claim''s business. Scoped to a single claim so it cannot enumerate; returns only the '
  'fields the lead detail screen renders.';

revoke execute on function public.claim_consumer_contact(uuid) from anon, public;
grant execute on function public.claim_consumer_contact(uuid) to authenticated, service_role;
