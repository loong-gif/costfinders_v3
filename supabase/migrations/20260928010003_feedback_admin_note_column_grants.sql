-- feedback_admin_note_column_grants: the admin note on a report or correction is for admins only.
--
-- WHY
-- The admin queue's note box says "Only admins see this." It was not true at the database. RLS
-- filters rows, not columns, and 20260928010001/02 granted authenticated a table-wide SELECT:
--   - "Owners can read their business confirmations" let the clinic's owner read admin_note and
--     resolved_by (the admin's auth uid) on every correction they sent;
--   - "Consumers can read their own claim answers" let the customer read the admin's note on
--     their own "did the clinic honor it" answer.
-- Both read it with the anon key and their own session JWT, which their browser already holds.
-- Reproduced live on 2026-09-28 in a rolled-back DO block before this file.
--
-- WHAT
--   1. Table-level SELECT on both tables is replaced by column-level SELECT on every column but
--      admin_note and resolved_by. A bare column REVOKE does nothing while the table grant stands
--      (CLAUDE.md, "Table-level grants silently defeat column-level REVOKE"), and admins
--      authenticate as `authenticated` too, so this also stops admins reading the two columns
--      directly.
--   2. public.admin_feedback_notes(uuid[]) gives admins the notes back: SECURITY DEFINER, and
--      every row is gated on private.is_admin(), so anyone else gets an empty set.
-- Unchanged: table-level INSERT and UPDATE, so the admin's update of status/admin_note, the
-- consumer's upsert and the owner's insert still work (each returns only granted columns).
-- Triggers read OLD/NEW and the postgres-owned public_offer_confirmations view runs as its owner,
-- so neither is subject to column privileges. latest_offer_confirmations() reads only granted
-- columns.
--
-- Consequence: a non-admin select('*') on either table is now 42501 instead of silently
-- including the note.
--
-- VERIFY (as postgres)
--   select table_name, column_name from information_schema.column_privileges
--    where grantee = 'authenticated' and privilege_type = 'SELECT'
--      and table_name in ('deal_reports', 'offer_confirmations')
--      and column_name in ('admin_note', 'resolved_by');                          -- 0 rows
--   begin; set local role authenticated;
--   set local request.jwt.claims = '{"sub":"64567837-3b5e-4eca-85cf-d933f4fcffee"}';
--   select admin_note from public.deal_reports;                                    -- 42501
--   rollback;
--
-- ROLLBACK:
--   drop function if exists public.admin_feedback_notes(uuid[]);
--   revoke select on table public.deal_reports from authenticated;
--   revoke select on table public.offer_confirmations from authenticated;
--   grant select on table public.deal_reports to authenticated;
--   grant select on table public.offer_confirmations to authenticated;

revoke select on table public.deal_reports from authenticated;
grant select (id, offer_id, reporter_id, claim_id, source, reason, note, status, created_at,
              updated_at, resolved_at)
  on public.deal_reports to authenticated;

revoke select on table public.offer_confirmations from authenticated;
grant select (id, offer_id, business_id, owner_id, kind, note, snapshot, status, created_at,
              resolved_at)
  on public.offer_confirmations to authenticated;

create or replace function public.admin_feedback_notes(p_ids uuid[])
returns table (id uuid, admin_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.admin_note
    from public.deal_reports d
   where d.id = any (p_ids)
     and (select private.is_admin())
  union all
  select c.id, c.admin_note
    from public.offer_confirmations c
   where c.id = any (p_ids)
     and (select private.is_admin())
$$;

comment on function public.admin_feedback_notes(uuid[]) is
  'Admin notes on deal_reports and offer_confirmations rows, for admins only (empty for anyone else). The columns themselves are not granted to authenticated. See 20260928010003.';

revoke all on function public.admin_feedback_notes(uuid[]) from public, anon;
grant execute on function public.admin_feedback_notes(uuid[]) to authenticated;

notify pgrst, 'reload schema';
