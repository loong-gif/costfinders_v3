-- Reinstate the deal-moderation gate that 20260903000008_business_deal_write_policies.sql
-- shipped and an UNTRACKED migration silently reverted.
--
-- The revert was partial, which is worse than either whole outcome. Current live state,
-- verified against pg_attribute / pg_constraint / pg_indexes / pg_trigger / pg_proc:
--
--   promo_offer_master.moderation_status                GONE  (column_name ilike '%moderation%'
--   promo_offer_master.moderation_notes                 GONE   over all of public -> 0 rows)
--   promo_offer_master_moderation_status_check          GONE
--   idx_promo_offer_master_moderation_status            GONE
--   trg_guard_deal_moderation_status                    GONE
--   public.guard_deal_moderation_status()               PRESENT -- orphaned dead code, body
--                                                       still reads new.moderation_status
--   policy "Owners can create deals for their business" PRESENT but ALTERED: its WITH CHECK no
--                                                       longer carries the two clauses
--                                                       migration 8 wrote at its lines 100-101
--   policy "Admins can update deal moderation"          PRESENT (no column reference, survived)
--
-- Two live defects follow from that state:
--
-- 1. NO MODERATION GATE AT ALL. An approved owner INSERTs a deal and it is immediately public
--    and unreviewed. The gate is not weakened, it is absent -- and it is absent in a way no
--    test would catch, because the surviving function and the surviving admin policy make the
--    function list and pg_policies still LOOK like moderation exists.
-- 2. ALL THREE ADMIN MODERATION ACTIONS ERROR. approveDealAction, rejectDealAction and
--    requestDealChangesAction (src/lib/actions/admin-deal-moderation.ts:68, :139, :217) write
--    moderation_status / moderation_notes; PostgREST rejects the payload with PGRST204
--    "column does not exist" before RLS is ever consulted. createDealAction hardcodes
--    `moderation_status: 'pending_review'` (src/lib/actions/deal-management.ts:201) and fails
--    the same way -- so owners cannot create a deal either.
--
-- Leaving the orphaned function in place is the one option that is definitely wrong: it raises
-- 42703 the instant anyone reattaches it. This migration reattaches it, which means the columns
-- must come back in the same migration -- they are not separable.

-- 1. the columns -------------------------------------------------------------
-- BACKFILL TO 'approved', not the 'pending_review' default. All 1000 rows currently in the
-- table are pipeline-ingested scrapes, not owner submissions -- they were never reviewed
-- because there was never anything to review, and they are already rendered on public pages.
-- Letting them take the column default would move the entire public site behind a moderation
-- queue nobody has staffed: every offer page, every city guide, every treatment bucket, empty.
-- Only rows created after this migration start life pending.
--
-- Guarded on the column not yet existing so a re-run cannot flip a genuinely pending deal to
-- approved. Same shape as migration 8, deliberately -- this is that migration's item 1 restored,
-- not a redesign of it.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name  = 'promo_offer_master'
       and column_name = 'moderation_status'
  ) then
    alter table public.promo_offer_master
      add column moderation_status text not null default 'pending_review';
    update public.promo_offer_master set moderation_status = 'approved';
  end if;
end $$;

-- Written by rejectDealAction and requestDealChangesAction; without it a rejected deal can
-- never tell the owner why.
alter table public.promo_offer_master
  add column if not exists moderation_notes text;

-- The four values are the ones src/types/deal.ts (ModerationStatus) already defines. Without the
-- constraint the column is free text and a typo in an action strands a deal in a state no UI can
-- reach.
alter table public.promo_offer_master
  drop constraint if exists promo_offer_master_moderation_status_check;
alter table public.promo_offer_master
  add constraint promo_offer_master_moderation_status_check
  check (moderation_status in ('pending_review','approved','rejected','changes_requested'));

-- Serves the admin queue's "oldest pending first" read.
create index if not exists idx_promo_offer_master_moderation_status
  on public.promo_offer_master (moderation_status, created_at desc);

-- 2. the guard trigger -------------------------------------------------------
-- RLS restricts WHICH ROW an owner may update, never WHICH COLUMN, so the surviving ownership
-- UPDATE policy would happily let an owner set moderation_status = 'approved' on their own deal
-- and self-publish past the admin queue. Column-level REVOKE cannot express this: admins
-- authenticate as the same `authenticated` role, so revoking the column from `authenticated`
-- would disable the admin queue along with the owners. Hence a BEFORE UPDATE trigger comparing
-- OLD to NEW and short-circuiting on public.is_admin() -- the same pattern as
-- guard_business_privileged_columns and guard_claim_consumer_columns.
--
-- The function survived the revert unchanged. It is restated here verbatim rather than left
-- implicit so this file alone is sufficient to rebuild the gate, and so a future reader is not
-- left wondering whether the surviving copy matches what the trigger expects.
create or replace function public.guard_deal_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The ingestion pipeline connects as service_role, which bypasses RLS but NOT triggers, and
  -- has no admin_profiles row so is_admin() is false for it. auth.uid() is null on any
  -- non-end-user connection; anon can never reach this trigger because both UPDATE policies are
  -- `to authenticated`, so letting a null uid through does not widen anything.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_notes is distinct from old.moderation_notes then
    raise exception 'only an admin may change a deal''s moderation status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_deal_moderation_status on public.promo_offer_master;
create trigger trg_guard_deal_moderation_status
  before update on public.promo_offer_master
  for each row execute function public.guard_deal_moderation_status();

-- 3. the INSERT policy's altered-away WITH CHECK clauses ---------------------
-- RECOVERABILITY -- the policy definition being replaced, captured verbatim from pg_policy
-- before this migration ran:
--
--   create policy "Owners can create deals for their business"
--     on public.promo_offer_master for insert to authenticated
--     with check (
--       EXISTS ( SELECT 1
--          FROM business_profiles bp
--         WHERE ((bp.id = auth.uid())
--            AND (bp.business_id = promo_offer_master.business_id)
--            AND (bp.claim_status = 'approved'::text)))
--     );
--
-- The ownership half is unchanged below. What is being added back is the moderation half: the
-- `moderation_status: 'pending_review'` in createDealAction is a client-side convention, not a
-- constraint, and a Server Action is a public HTTP endpoint with PostgREST as a second wide-open
-- door -- an owner can POST straight to /rest/v1/promo_offer_master with their own JWT carrying
-- moderation_status = 'approved' and never touch the action. INSERT needs no trigger for this:
-- WITH CHECK sees the whole NEW row. The trigger above only covers UPDATE, which is why both
-- halves are required and why restoring the trigger without these clauses would leave
-- self-publishing wide open on the INSERT path.
drop policy if exists "Owners can create deals for their business" on public.promo_offer_master;
create policy "Owners can create deals for their business"
  on public.promo_offer_master for insert to authenticated
  with check (
    exists (
      select 1 from public.business_profiles bp
       where bp.id = auth.uid()
         and bp.business_id = promo_offer_master.business_id
         and bp.claim_status = 'approved'
    )
    and moderation_status = 'pending_review'
    and moderation_notes is null
  );

-- FOLLOW-UP, deliberately NOT done here -- unchanged from migration 8's own closing note.
-- moderation_status still does not gate public visibility: the SELECT policy stays USING (true).
-- Narrowing it cannot be done in isolation, because /admin/dashboard/deals reads the moderation
-- queue through the ANON client, so an approved-only SELECT policy would hide from the queue
-- exactly the deals it exists to review. Moving that page onto an authenticated server client is
-- the prerequisite and is a separate change.

-- New columns on a table PostgREST has already cached.
notify pgrst, 'reload schema';
