-- Re-sync promo_offer_master_id_seq with the table's actual max(id).
--
-- WHAT BROKE
-- `createDealAction` (src/lib/actions/deal-management.ts) inserts without an `id` and lets the
-- column default take the sequence. On 2026-09-16 the sequence's last_value was 10022 while
-- max(id) was 10048 — 26 behind — so the next 26 owner-submitted deals would each have failed
-- with `23505 duplicate key value violates unique constraint "promo_offer_master_pkey"`,
-- surfaced to the owner as a generic "try again".
--
-- Found by attacking the new publication guard: the INSERT arm of the test could not run at
-- all because the insert never got as far as the trigger.
--
-- WHY IT DRIFTED
-- The ingestion pipeline inserts rows with EXPLICIT ids (its migrations are full of
-- `insert into promo_offer_master (id, …) values (…)`). An explicit id does not advance the
-- sequence, so every batch it lands pushes max(id) further past last_value. This will drift
-- again. The durable fix belongs on the pipeline side — either let the sequence assign ids, or
-- `setval` after each explicit-id batch — and is part of the B3 governance conversation in
-- .planning/LAUNCH-PLAN.md. Until then this file is a repair, not a guarantee.
--
-- `setval(..., max(id))` with the default `is_called = true` means the NEXT nextval() returns
-- max(id) + 1. coalesce covers an empty table.

select setval(
  pg_get_serial_sequence('public.promo_offer_master', 'id'),
  coalesce((select max(id) from public.promo_offer_master), 1)
);
