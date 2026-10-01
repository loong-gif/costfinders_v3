-- Owner-submitted deals start off the site, and only an admin can put one on it.
--
-- WHY THIS EXISTS
-- Until 2026-09-15 the review gate was `promo_offer_master.moderation_status`: the INSERT
-- policy's WITH CHECK forced an owner's row to 'pending_review', a BEFORE UPDATE trigger
-- (trg_guard_deal_moderation_status) stopped the owner changing it, and both the app's
-- isPubliclyVisible() and the public SELECT policy required 'approved'.
--
-- The ingestion pipeline then applied `drop_promo_offer_moderation_columns` out-of-band. It
-- dropped moderation_status and moderation_notes, dropped the guard trigger with them, and
-- rewrote the public SELECT policy to `USING (is_active = true)`. Nothing replaced the gate.
-- Since `is_active` DEFAULTS TO TRUE, an owner-submitted deal went live the instant it was
-- inserted, with no admin ever seeing it.
--
-- `is_active` is now the only publication switch the schema has, so review happens by holding
-- a deal inactive. This migration makes that a property of the database rather than of the
-- Server Action that happens to set it.
--
-- WHY A TRIGGER AND NOT A POLICY
-- Owners legitimately hold UPDATE on this table (they edit price and description), and
-- `authenticated` is the same role an ADMIN authenticates as — so REVOKE would disable admins
-- too, and a WITH CHECK on the UPDATE policy cannot see the OLD row. A BEFORE trigger
-- comparing OLD/NEW and short-circuiting on is_admin() is the pattern this project already
-- uses for exactly this shape (see guard_business_privileged_columns).
--
-- WHY IT DOES NOT BREAK THE PIPELINE
-- It short-circuits on `current_user`. The pipeline applies its migrations as `postgres` and
-- its API writes as `service_role`; both return early, so the dozens of activate/deactivate
-- migrations it runs are untouched. SECURITY INVOKER is deliberate — a SECURITY DEFINER
-- function would report the function's owner as current_user and the check would never fire.

create or replace function public.guard_offer_publication()
returns trigger
language plpgsql
-- SECURITY INVOKER (the default): current_user must be the caller's role, not this function's
-- owner. Search path pinned; `private` is needed for is_admin().
set search_path = public, private, pg_temp
as $$
begin
  -- Only ordinary signed-in users are constrained. postgres / service_role / anon are not.
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- Admins authenticate as `authenticated` too; membership of admin_profiles IS the privilege.
  if private.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Silently, not by raising: the owner did nothing wrong, and createDealAction already
    -- sends false. This catches the forged POST straight at the Server Action.
    new.is_active := false;
    return new;
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception
      'Only an administrator can change whether a deal is on the site (deal %)', old.id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_offer_publication() is
  'Holds owner-submitted deals off the site until an admin publishes them. Replaces the '
  'moderation_status gate the pipeline dropped on 2026-09-15.';

drop trigger if exists trg_guard_offer_publication on public.promo_offer_master;

-- BEFORE, so the INSERT arm can rewrite NEW.is_active before RLS evaluates WITH CHECK and
-- before the pipeline's own activation guards run.
create trigger trg_guard_offer_publication
  before insert or update of is_active on public.promo_offer_master
  for each row
  execute function public.guard_offer_publication();

-- The SELECT policy's name has been a lie since the moderation columns were dropped: it reads
-- "approved" but tests is_active alone. Renamed rather than re-implemented — `is_active = true`
-- IS the correct predicate now, and a policy whose name misdescribes it is how the next reader
-- concludes there is a review gate when there is not.
alter policy "Public can read active approved offers"
  on public.promo_offer_master
  rename to "Public can read deals that are on the site";
