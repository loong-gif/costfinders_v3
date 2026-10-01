-- 20260910040002_claim_conversation_rpc.sql
--
-- public.get_or_create_claim_conversation(uuid) — resolve the two parties to a claim and
-- return (creating if needed) their conversation. Returns NULL when the business has no
-- owner account, which is the honest answer for 418 of the 419 businesses.
--
-- WHY A FUNCTION AND NOT APPLICATION CODE
-- ---------------------------------------
-- `conversations` requires both consumer_id and business_owner_id, and neither participant can
-- read the other's side:
--
--   * the consumer cannot read business_profiles — its only non-admin SELECT policy is
--     `auth.uid() = id`, so a consumer resolving the owner of business N gets zero rows;
--   * the owner could not read claims at all until 20260910040001.
--
-- So getOrCreateConversationAction (src/lib/actions/messaging.ts) could never resolve the
-- counterparty: it bailed with 'Business owner profile not found for this claim.' on every
-- call, and src/lib/actions/claims.ts:269 invoked it as `.catch(() => {})`. Result:
-- `select count(*) from conversations` was 0, with one claim and one approved owner in the
-- database and no error anywhere. The messages page then opened a dead placeholder.
--
-- The app holds no service_role key (`grep -rn SERVICE_ROLE src/` finds only comments), and
-- widening the business_profiles SELECT policy so consumers could find an owner would expose
-- that owner's email, phone, claim_status and tier — RLS is row-level, not column-level. A
-- SECURITY DEFINER function is the narrow instrument: it reads exactly the two ids it needs,
-- refuses anyone who is not a party, and returns nothing else.
--
-- WHAT IT DELIBERATELY DOES NOT DO
-- --------------------------------
-- It does not fabricate a conversation for a business with no owner account. Only 1 of 419
-- businesses has one, and `conversations.business_owner_id` is a FK to auth.users — there is
-- no row to point at, and inventing a placeholder would make the consumer's Messages screen
-- promise a reply nobody can send. NULL is the answer; the UI says so in words.
--
-- CONCURRENCY
-- -----------
-- `on conflict (claim_id) do nothing` leans on the existing conversations_claim_id_key UNIQUE
-- constraint, so two simultaneous callers (the consumer claiming, the owner opening the lead)
-- produce one row and both get it back. That replaces the 23505-retry branch the action used
-- to carry.
--
-- REVERSIBILITY
-- -------------
--   drop function if exists public.get_or_create_claim_conversation(uuid);
-- New object only — nothing is replaced and no data is touched.

create or replace function public.get_or_create_claim_conversation(p_claim_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_consumer_id uuid;
  v_business_id bigint;
  v_owner_id uuid;
  v_conversation public.conversations;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select c.consumer_id, c.business_id
    into v_consumer_id, v_business_id
  from public.claims c
  where c.id = p_claim_id;

  if not found then
    raise exception 'claim not found' using errcode = '42501';
  end if;

  -- business_id is not unique on business_profiles; order so repeated calls agree.
  select bp.id
    into v_owner_id
  from public.business_profiles bp
  where bp.business_id = v_business_id
    and bp.claim_status = 'approved'
  order by bp.created_at
  limit 1;

  -- The whole authorization check. SECURITY DEFINER bypasses RLS, so this is the only thing
  -- standing between an arbitrary signed-in user and someone else's conversation.
  if v_uid <> v_consumer_id and (v_owner_id is null or v_uid <> v_owner_id) then
    raise exception 'not a party to this claim' using errcode = '42501';
  end if;

  if v_owner_id is null then
    return null;
  end if;

  insert into public.conversations (claim_id, consumer_id, business_owner_id)
  values (p_claim_id, v_consumer_id, v_owner_id)
  on conflict (claim_id) do nothing
  returning * into v_conversation;

  if v_conversation.id is null then
    select * into v_conversation
    from public.conversations
    where claim_id = p_claim_id;
  end if;

  return v_conversation;
end;
$$;

-- Revoke FROM PUBLIC, not just FROM anon: a function is created with EXECUTE granted to
-- PUBLIC and anon inherits it, which is the mistake 20260903000013 was written to repair.
revoke execute on function public.get_or_create_claim_conversation(uuid) from public;
revoke execute on function public.get_or_create_claim_conversation(uuid) from anon;
grant execute on function public.get_or_create_claim_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
