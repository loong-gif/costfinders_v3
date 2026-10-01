-- Closes the RLS gaps the audit found but the first pass did not reach.
-- Every policy below was verified live against pg_policies before changing.

-- 1. notifications INSERT was `WITH CHECK (true)` for role `public`, i.e. including
--    anon. Anyone, signed in or not, could write a notification into any user's feed —
--    with a click-through link, so it is a phishing delivery channel. Notifications are
--    raised by server-side flows, so no client needs INSERT at all.
drop policy if exists "Authenticated users can insert notifications" on public.notifications;

create or replace function public.create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  notification_link text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A user may only be notified by the system on their own behalf, or by an admin.
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (target_user_id, notification_type, notification_title,
          notification_body, notification_link);
end;
$$;
revoke execute on function public.create_notification(uuid, text, text, text, text) from anon;
grant execute on function public.create_notification(uuid, text, text, text, text) to authenticated;

-- 2. master_business_info INSERT was `WITH CHECK (true)` for authenticated. Any signed-up
--    consumer could inject arbitrary rows into the 957-business public directory, which
--    generates live public provider pages and sitemap entries. The directory is populated
--    by the ingestion pipeline, not by users.
drop policy if exists "Enable insert for authenticated users only" on public.master_business_info;

create policy "Admins can insert businesses"
  on public.master_business_info for insert to authenticated
  with check (public.is_admin());

-- 3. conversations INSERT was `WITH CHECK (true)` for role `public`. Anyone could force a
--    private thread with any other user. A conversation is only legitimate between the
--    two parties to a claim.
drop policy if exists "Authenticated can insert conversations" on public.conversations;

create policy "Claim parties can open a conversation"
  on public.conversations for insert to authenticated
  with check (
    auth.uid() = consumer_id
    or auth.uid() = business_owner_id
    or public.is_admin()
  );

-- 4. UPDATE policies with no WITH CHECK fall back to the USING expression, which
--    constrains row ownership but not the columns being written. A consumer could
--    therefore keep their own claim row while rewriting status, business_id and the
--    relay fields — marking their own claim 'booked', or reassigning it to another
--    business. Pin the immutable columns and restrict the statuses a consumer may set.
drop policy if exists "Consumers can update own claims" on public.claims;

create policy "Consumers can cancel own claims"
  on public.claims for update to authenticated
  using (auth.uid() = consumer_id)
  with check (auth.uid() = consumer_id);

create or replace function public.guard_claim_consumer_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Business owners advance a claim through their own server actions; consumers may only
  -- cancel. Everything that decides money or routing is immutable to the consumer.
  if new.consumer_id is distinct from old.consumer_id
     or new.deal_id is distinct from old.deal_id
     or new.business_id is distinct from old.business_id
     or new.relayed_at is distinct from old.relayed_at
     or new.relayed_by is distinct from old.relayed_by
     or new.relay_method is distinct from old.relay_method then
    raise exception 'these claim fields are not user-editable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'a consumer may only cancel a claim' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_guard_claim_consumer_columns
  before update on public.claims
  for each row execute function public.guard_claim_consumer_columns();

-- 5. Admins had no UPDATE policy on claims, so the lead-relay dashboard reported success
--    while writing nothing (RLS silently dropped the update).
create policy "Admins can update claims"
  on public.claims for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 6. messages "Participants can mark messages read" had no WITH CHECK, so a recipient
--    could rewrite the other party's message text under cover of marking it read.
drop policy if exists "Participants can mark messages read" on public.messages;

create policy "Participants can mark messages read"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.consumer_id = auth.uid() or c.business_owner_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.consumer_id = auth.uid() or c.business_owner_id = auth.uid())
    )
  );

create or replace function public.guard_message_immutable_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- read_at is the only field a recipient may change.
  if new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.sender_type is distinct from old.sender_type
     or new.conversation_id is distinct from old.conversation_id then
    raise exception 'message content is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_guard_message_immutable_content
  before update on public.messages
  for each row execute function public.guard_message_immutable_content();
