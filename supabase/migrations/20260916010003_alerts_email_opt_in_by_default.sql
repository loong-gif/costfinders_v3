-- Accounts are born able to receive the email the product promises them.
--
-- WHAT BROKE
-- `profiles.alerts_email` defaults to FALSE and `handle_new_user()` never sets it, so every
-- account ever created is opted out — 8 of 8 on 2026-09-16. `src/lib/email/send.ts` reads that
-- flag for any subject outside the essential allowlist in `src/lib/email/optOut.ts`, and
-- returns `{success: true, suppressed: true}` when it is false. No caller reads `suppressed`.
--
-- Four of the six send paths are outside that allowlist: claim confirmations, business-claim
-- approve, business-claim reject, and deal-moderation notices. All four have been silently
-- dropped for 100% of accounts, while the UI promises the opposite in four places
-- (claimBusinessFlow.tsx:451,692, business/create/page.tsx:472,
-- business/dashboard/layout.tsx:157 all say some form of "we'll email you the result").
--
-- WHY FLIPPING EXISTING ROWS IS NOT OVERRIDING ANYONE'S CHOICE
-- `false` here has never been a user decision. The column default was false from creation, the
-- settings screen wrote the flag but nothing READ it until the suppression gate shipped, and
-- `/unsubscribe/confirm` (the only other writer) has never had a working link to arrive from
-- because every function route on production was 500ing. All 8 rows are at the default value,
-- and 7 of the 8 are internal @brandrap.com / @costfinders.com test accounts.
--
-- SCOPE: TRANSACTIONAL ONLY
-- The settings toggle reads "Receive deal alerts and claim updates via email", so this one bit
-- covers both. It is being defaulted on for the CLAIM-UPDATE half — mail a person gets because
-- of something they just did. Do NOT read this migration as consent to send marketing or
-- unsolicited deal alerts to that same flag; if a broadcast is ever built it needs its own
-- opt-in column, because a user cannot decline one half of a single boolean.
--
-- handle_new_user() is deliberately NOT changed: it omits alerts_email from its INSERT, so the
-- column default below is the one place the rule lives. Setting it in both would be two places
-- to change and one to forget.

alter table public.profiles alter column alerts_email set default true;

update public.profiles set alerts_email = true where alerts_email = false;

comment on column public.profiles.alerts_email is
  'Opted in by default: this gates claim confirmations and moderation decisions, which are '
  'transactional. Marketing broadcasts need their own opt-in column, not this one.';
