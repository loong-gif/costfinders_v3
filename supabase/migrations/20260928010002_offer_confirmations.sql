-- offer_confirmations: a clinic's owner confirms a deal reads correctly, or asks for a
-- correction; public_offer_confirmations: the "Confirmed by the clinic" badge, and nothing else.
-- Spec: .planning/DEAL-BROWSE-AND-TRUST.md section 4 (owner-approved 2026-09-28).
--
-- WHY
-- Every price on the site is our reading of the clinic's own copy. The one party who knows
-- whether that reading is right is the clinic, and it had no way to say so. A confirmation is
-- only true of the deal as it stood when it was given: the pipeline rewrites prices and text
-- weekly (updated_at was rewritten for 761 of 947 offers on 2026-09-19), so the badge must
-- disappear the moment the deal changes, without anyone remembering to take it down.
--
-- WHAT
--   1. public.offer_confirmation_snapshot(...): the six things a confirmation vouches for, as
--      jsonb: discount_price, regular_price, discount_percent, discount_amount, price_model and
--      md5(offer_raw_text). One definition, used by the insert trigger, the public view and
--      latest_offer_confirmations(), so "still matches" cannot mean two things. jsonb compares
--      numerics by value (100.00 = 100). EXECUTE stays with anon: a function inside a view is
--      checked against the view's reader, not its owner, and this one is pure arithmetic.
--   2. public.offer_confirmations. offer_id / business_id follow listing_requests (ON DELETE SET
--      NULL). kind confirmed | correction; a correction needs a note (<= 2000). status and
--      admin_note are the admin's (admin_note is not in the spec's column list; the admin queue
--      the spec describes records one). owner_id is who sent it.
--   3. trg_offer_confirmations_guard_writes (SECURITY INVOKER):
--        INSERT  reads the offer through the caller's own policies and OVERWRITES snapshot,
--                business_id and owner_id from it and from auth.uid(), and forces status 'open'
--                with the admin columns empty. A client cannot supply a snapshot: whatever it
--                sends is replaced. An offer the caller cannot read raises 42501.
--        UPDATE  status and admin_note only; resolved_at / resolved_by are stamped here.
--   4. RLS: an approved owner of the business may INSERT for that business's offers and SELECT
--      that business's rows; admins SELECT and UPDATE. No DELETE, and no owner UPDATE: a
--      confirmation is a record of what was said, so a changed mind is a new row.
--   5. public.public_offer_confirmations (offer_id, confirmed_at). Per offer, the latest row
--      that an admin has not dismissed; shown only if it is a 'confirmed' row, from the offer's
--      current business, on an active offer, whose snapshot equals the offer now. So a later
--      correction, a price or wording change, a take-down or a dismissal all hide the badge.
--      Owned by postgres like public_offers (the Supabase advisor lists it as a Security
--      Definer View; that is the design, it reads offer_confirmations past RLS). It exposes an
--      offer id and a timestamp. Offer ids and business_id are already public in public_offers,
--      so it links nothing new to a clinic.
--   6. public.latest_offer_confirmations(): the same "latest row per offer" with is_current, for
--      the owner's dashboard ("Changed since you confirmed"). SECURITY INVOKER, so RLS limits it
--      to the caller's business (all rows for an admin); EXECUTE revoked from anon.
--
-- VERIFY (as postgres; each block rolls back)
--   select has_table_privilege('anon', 'public.offer_confirmations', 'SELECT'),         -- f
--          has_table_privilege('authenticated', 'public.offer_confirmations', 'TRUNCATE'), -- f
--          has_table_privilege('anon', 'public.public_offer_confirmations', 'SELECT');   -- t
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from auth.users where email = 'haris+biz@brandrap.com'), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   insert into public.offer_confirmations (offer_id, kind, snapshot)
--   values ((select id from public.promo_offer_master where business_id = 765 and is_active limit 1),
--           'confirmed', '{"forged": true}') returning snapshot ? 'forged';            -- f
--   select count(*) from public.public_offer_confirmations;                              -- 1
--   rollback;
--
-- ROLLBACK:
--   drop view if exists public.public_offer_confirmations;
--   drop function if exists public.latest_offer_confirmations();
--   drop table if exists public.offer_confirmations;
--   drop function if exists public.offer_confirmations_guard_writes();
--   drop function if exists public.offer_confirmation_snapshot(numeric, numeric, numeric, numeric, text, text);

-- ---------------------------------------------------------------------------
-- 1. What a confirmation vouches for
-- ---------------------------------------------------------------------------

create or replace function public.offer_confirmation_snapshot(
  p_discount_price numeric,
  p_regular_price numeric,
  p_discount_percent numeric,
  p_discount_amount numeric,
  p_price_model text,
  p_offer_raw_text text
)
returns jsonb
language sql
immutable
parallel safe
return jsonb_build_object(
  'discount_price', p_discount_price,
  'regular_price', p_regular_price,
  'discount_percent', p_discount_percent,
  'discount_amount', p_discount_amount,
  'price_model', p_price_model,
  'offer_raw_text_md5', md5(coalesce(p_offer_raw_text, ''))
);

revoke all on function public.offer_confirmation_snapshot(numeric, numeric, numeric, numeric, text, text)
  from public;
grant execute on function public.offer_confirmation_snapshot(numeric, numeric, numeric, numeric, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. The table
-- ---------------------------------------------------------------------------

create table public.offer_confirmations (
  id          uuid primary key default gen_random_uuid(),
  offer_id    bigint references public.promo_offer_master (id) on delete set null,
  business_id bigint references public.master_business_info (business_id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('confirmed', 'correction')),
  note        text check (char_length(note) <= 2000),
  snapshot    jsonb not null,
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note  text check (char_length(admin_note) <= 2000),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  -- coalesce: a CHECK that evaluates to NULL passes, so `btrim(note) <> ''` alone would let a
  -- correction through with no note at all.
  constraint offer_confirmations_correction_has_note
    check (kind = 'confirmed' or char_length(btrim(coalesce(note, ''))) > 0)
);

comment on table public.offer_confirmations is
  'A business owner confirming a deal reads correctly, or asking for a correction, with the deal''s values at that moment. See 20260928010002.';

create index offer_confirmations_offer_created_idx
  on public.offer_confirmations (offer_id, created_at desc);
create index offer_confirmations_business_idx on public.offer_confirmations (business_id);


-- ---------------------------------------------------------------------------
-- 3. Guard: the snapshot is the database's, not the client's
-- ---------------------------------------------------------------------------

create or replace function public.offer_confirmations_guard_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_id bigint;
  v_snapshot jsonb;
  v_changed text[];
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Through the caller's own policies: an owner reads their business's offers (on the site or
    -- not), and nobody else's.
    select o.business_id,
           public.offer_confirmation_snapshot(o.discount_price, o.regular_price,
             o.discount_percent, o.discount_amount, o.price_model, o.offer_raw_text)
      into v_business_id, v_snapshot
      from public.promo_offer_master o
     where o.id = new.offer_id;
    if not found then
      raise exception 'only the business''s owner can confirm or correct this deal'
        using errcode = '42501';
    end if;
    new.business_id := v_business_id;
    new.snapshot := v_snapshot;
    new.owner_id := auth.uid();
    new.status := 'open';
    new.admin_note := null;
    new.resolved_at := null;
    new.resolved_by := null;
    new.created_at := now();
    return new;
  end if;

  select coalesce(array_agg(n.key), '{}')
    into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  -- Only admins reach an UPDATE (the one UPDATE policy); what was said stays as it was said.
  if not v_changed <@ array['status', 'admin_note'] then
    raise exception 'not allowed to change offer confirmation field(s): %',
      array_to_string(
        array(select unnest(v_changed) except select unnest(array['status', 'admin_note'])), ', ')
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.resolved_at := null;
      new.resolved_by := null;
    else
      new.resolved_at := now();
      new.resolved_by := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

comment on function public.offer_confirmations_guard_writes() is
  'Direct-client guard for offer_confirmations: the snapshot, business and owner come from the database on insert; admins change status and admin_note only. See 20260928010002.';

revoke all on function public.offer_confirmations_guard_writes() from public, anon, authenticated;

create trigger trg_offer_confirmations_guard_writes
  before insert or update on public.offer_confirmations
  for each row execute function public.offer_confirmations_guard_writes();


-- ---------------------------------------------------------------------------
-- 4. RLS and grants
-- ---------------------------------------------------------------------------

alter table public.offer_confirmations enable row level security;

-- The offer clause repeats what the trigger derives, so the policy still holds on its own if the
-- trigger is ever dropped.
create policy "Owners can confirm or correct their business deals"
  on public.offer_confirmations for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
        from public.business_profiles bp
       where bp.id = (select auth.uid())
         and bp.business_id = offer_confirmations.business_id
         and bp.claim_status = 'approved'
    )
    and exists (
      select 1
        from public.promo_offer_master o
       where o.id = offer_confirmations.offer_id
         and o.business_id = offer_confirmations.business_id
    )
  );

create policy "Owners can read their business confirmations"
  on public.offer_confirmations for select to authenticated
  using (
    exists (
      select 1
        from public.business_profiles bp
       where bp.id = (select auth.uid())
         and bp.business_id = offer_confirmations.business_id
         and bp.claim_status = 'approved'
    )
  );

create policy "Admins can read offer confirmations"
  on public.offer_confirmations for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can update offer confirmations"
  on public.offer_confirmations for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on table public.offer_confirmations from public, anon, authenticated;
grant select, insert, update on table public.offer_confirmations to authenticated;


-- ---------------------------------------------------------------------------
-- 5. The public badge
-- ---------------------------------------------------------------------------

create or replace view public.public_offer_confirmations as
select l.offer_id, l.created_at as confirmed_at
  from (
    select distinct on (c.offer_id)
           c.offer_id, c.business_id, c.kind, c.snapshot, c.created_at
      from public.offer_confirmations c
     where c.offer_id is not null
       and c.status <> 'dismissed'
     order by c.offer_id, c.created_at desc, c.id desc
  ) l
  join public.promo_offer_master o on o.id = l.offer_id
 where l.kind = 'confirmed'
   and o.is_active
   and o.business_id = l.business_id
   and l.snapshot = public.offer_confirmation_snapshot(o.discount_price, o.regular_price,
         o.discount_percent, o.discount_amount, o.price_model, o.offer_raw_text);

comment on view public.public_offer_confirmations is
  'Active offers whose owner''s latest word is a confirmation that still matches the deal. offer_id and confirmed_at only. See 20260928010002.';

alter view public.public_offer_confirmations owner to postgres;
revoke all on public.public_offer_confirmations from public, anon, authenticated;
grant select on public.public_offer_confirmations to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. The owner's view of their own latest word per deal
-- ---------------------------------------------------------------------------

create or replace function public.latest_offer_confirmations()
returns table (
  offer_id bigint,
  business_id bigint,
  kind text,
  status text,
  note text,
  created_at timestamptz,
  is_current boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (c.offer_id)
         c.offer_id, c.business_id, c.kind, c.status, c.note, c.created_at,
         c.snapshot = public.offer_confirmation_snapshot(o.discount_price, o.regular_price,
           o.discount_percent, o.discount_amount, o.price_model, o.offer_raw_text)
    from public.offer_confirmations c
    join public.promo_offer_master o on o.id = c.offer_id
   order by c.offer_id, c.created_at desc, c.id desc
$$;

comment on function public.latest_offer_confirmations() is
  'Per offer the caller may read, the latest confirmation or correction and whether the deal still matches it. RLS-scoped (SECURITY INVOKER). See 20260928010002.';

revoke all on function public.latest_offer_confirmations() from public, anon;
grant execute on function public.latest_offer_confirmations() to authenticated;

notify pgrst, 'reload schema';
