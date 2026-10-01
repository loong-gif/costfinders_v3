# Migrations

Schema changes ship as tracked SQL files here. Never apply schema changes ad-hoc through the
Supabase MCP tool or dashboard as the source of truth — write the file first, then apply it.

## Baseline gap

19 migrations created before 2026-09-03 exist **only in the remote Supabase migration history**
and have no corresponding files in this repo. They are listed below for reference. Until a
baseline dump is captured (`supabase db dump`), this directory is not sufficient to rebuild the
database from scratch.

**The gap is now 46, not 19** (re-counted against the ledger on 2026-09-09): the 19 below, plus
27 more applied out-of-band between 2026-09-05 and 2026-09-09 that normalized the offer schema
(`align_promo_offer_master_schema` and the `import_*` / `backfill_*` / `costfinder_schema_repair_*`
sets). One of those also silently reverted most of `20260903000008`'s moderation half — see
`20260909180005_reinstate_deal_moderation.sql`. Enumerate them with `list_migrations` before
assuming this list is complete.

```
20260320060700  add_public_read_policy_promo_offer_master
20260320154132  create_profiles_table
20260320154153  create_saved_deals_table
20260320154429  create_claims_table
20260321004937  create_business_profiles          <- never actually created the table
20260321120802  add_business_update_policy
20260321130039  add_google_place_id_column
20260321165905  add_business_claims_rls_and_admin_profiles
20260321173332  admin_dashboard_policies_and_moderation
20260321200644  create_notifications_table
20260322013805  create_messaging_tables
20260322171647  add_performance_rpc_functions
20260324085221  add_moderation_notes_column      <- never added the column
20260324085319  create_admin_audit_log
20260324085406  add_lead_relay_columns
20260324085830  create_content_management_tables
20260324090330  add_suspension_rls_policies
20260324093308  create_business_claims_table      <- never actually created the table
20260610095000  add_promo_offer_master_status
```

Three of these are recorded but never took effect — `create_business_profiles` and
`create_business_claims_table` never created their tables, and `add_moderation_notes_column`
never added its column (verified against `information_schema.columns` on 2026-09-03; the
moderation columns were finally created in `20260903000008`). A row in
`supabase_migrations.schema_migrations` is therefore not evidence that the schema change
happened — check the catalog.

## File version → ledger version

The ledger assigns its own timestamp at apply time, so a file's version string is never the
version recorded in `supabase_migrations.schema_migrations`. That divergence exists for every
file in this directory, not just the recent ones — **a drift check that compares file versions to
ledger versions will report all of them as unapplied, and that is expected, not a fault.** Match
on NAME, not version.

Applied 2026-09-09 (offer-schema repair; production-only, no staging database exists):

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260909180001` | `clinic_catalogue_public_read_policies` | `20260910000341` |
| `20260909180002` | `revoke_offer_table_write_grants` | `20260910000409` |
| `20260909180003` | `repair_get_offer_category_counts` | `20260910000453` |
| `20260909180004` | `drop_broken_match_documents` | `20260910000526` |
| `20260909180005` | `reinstate_deal_moderation` | `20260910000546` |
| `20260909180006` | `business_profile_tier` | `20260910000609` |
| `20260909180007` | `harden_legacy_tables_and_secdef_search_path` | `20260910001200` |

The ledger timestamps are a day ahead of the filenames because the ledger stamps UTC and these
were applied late on 2026-09-09 local time.

Applied 2026-09-09, later the same evening (adversarial review of the offer-schema repair found
four proven defects in it; production-only, no staging database exists):

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260909190001` | `restore_price_predicate_in_category_counts` | `20260910010628` |
| `20260909190002` | `price_history_trigger_security_definer` | `20260910010638` |
| `20260909190003` | `admin_read_offer_items_and_price_history` | `20260910010650` |
| `20260909190004` | `sync_item_unit_prices_security_definer` | `20260910011016` |

`…190002` and `…190004` are two halves of one defect and must be applied together — each on its
own leaves a business owner unable to save a price edit, with the 42501 merely naming a different
table. Note also `20260909043358 harden_promo_offer_price_triggers` in the ledger, applied
out-of-band: it pinned `search_path` on both of those trigger functions but left them SECURITY
INVOKER, which is what broke owner price edits once `20260910000409` revoked the client write
grants those invoker triggers had been silently relying on.

The earlier 14 files map the same way — `2026090300000N` in the repo against
`20260903112235`–`20260903194859` in the ledger, matched by name:

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260903000001` | `rls_policies_for_admin_tables` | `20260903112235` |
| `20260903000002` | `remove_admin_signup_escalation` | `20260903112413` |
| `20260903000003` | `revoke_self_service_privilege_columns` | `20260903113133` |
| `20260903000004` | `create_business_profiles_and_claims` | `20260903112838` |
| `20260903000005` | `fix_profiles_update_grants` | `20260903113229` |
| `20260903000006` | `fix_rpc_regular_price` | `20260903114926` |
| `20260903000007` | `tighten_permissive_rls` | `20260903150245` |
| `20260903000008` | `business_deal_write_policies` | `20260903171324` |
| `20260903000009` | `create_get_business_cities_rpc` | `20260903174818` |
| `20260903000010` | `single_admin_role` | `20260903175708` |
| `20260903000011` | `harden_claim_verification_and_approval` | `20260903181536` |
| `20260903000012` | `enforce_active_claim_limit` | `20260903182036` |
| `20260903000013` | `fix_ineffective_function_revokes` | `20260903183224` |
| `20260903000014` | `offer_category_provider_ids` | `20260903194859` |

Note `…0003` sorts before `…0004` in the repo but the ledger applied them the other way
(`112838` before `113133`): a replay in file order would revoke on a table that does not yet
exist. Another reason the baseline must come from `pg_dump --schema-only` against live state
rather than from replaying these files.

## Filenames sort below the applied history

Local files are named `2026090300000N`; the same migrations were applied remotely under
timestamps `20260903112235`–`20260903150245`. `supabase db push` would therefore treat every
local file as unapplied and try to re-run all of them. Apply migrations through the SQL editor
or `apply_migration` — which is how every migration on this project has actually landed — and
do not use `db push` until a baseline dump reconciles the two.

## Applied 2026-09-09, security remediation pass

Production-only; no staging database exists. The repo owner granted explicit authorisation for
these before they were applied.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260909190011` | `revoke_admin_table_write_grants` | `20260910012422` |

`20260909190011` is grants only — no DDL, no data touched — so its rollback is the two `GRANT
ALL` statements written in the file header. Verified against production with a real non-admin
token before and after: inserting yourself into `admin_profiles` and PATCHing `role` onto the
existing admin row both return `42501`, and the `role` PATCH specifically changed from a silent
`200 []` (the grant was there, only RLS refused, and it refused quietly) to a hard
`42501 permission denied for table admin_profiles`. The admin console path still works — a real
admin token reads its own `admin_profiles` row (200), reads `admin_audit_log` (200) and appends
to it (201).

## Applied 2026-09-10, security remediation pass (continued)

Same authorisation, same production-only caveat.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260909210001` | `data_rights_plumbing` | `20260910012445` |
| `20260909210002` | `scope_deal_image_storage_policies` | `20260910015250` |
| `20260909210003` | `revoke_business_profiles_client_write_grants` | `20260910015706` |

`20260909210002` replaces two `storage.objects` policies and adds a third. Rollback SQL —
including the verbatim prior definition of both replaced policies — is in the file header. It
closes a hole proven open first: with a real consumer token for an account holding **no**
`business_profiles` row at all, `POST` and `DELETE` on
`/storage/v1/object/deal-images/2059/h1probe.png` both returned `200`. After the migration the
same token gets `403 new row violates row-level security policy` on upload, and four further
attacks were run with a temporary approved-owner fixture: uploading into another business's
folder, `move`-ing an owned object into another business's folder, deleting an existing object
in another business's folder, and upserting over one — all four `403`, and the target object
survived. The allow path was exercised too, which no previous pass had managed (production has
no business owner): the approved owner of business 47 uploaded into `47/`, upserted over the
same key (this is what the new `UPDATE` policy is for — there was none before, so upsert had
never worked), and deleted their own object. All three `200`. Every fixture was removed;
`storage.objects` and `business_profiles` are both back to 0 rows.

`20260909210003` is grants only. `anon` held `DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
TRUNCATE` on `business_profiles` and `authenticated` those plus `UPDATE`, on a table whose RLS
carries no `INSERT` or `DELETE` policy at all — so RLS was the only refusal, and `TRUNCATE` is
not row-level so RLS never saw it. Attacked live before the change, in a transaction
deliberately aborted: `set local role anon; truncate table public.business_profiles cascade`
**succeeded**, leaving 0 rows, then rolled back (plain `TRUNCATE` got as far as `0A000`, the FK
to `business_claims` — the privilege check had already passed). After the change the same
statement returns `42501`, as do `anon` `DELETE`/`INSERT`/`SELECT` and `authenticated`
`TRUNCATE`/`DELETE`/`INSERT`. `authenticated` keeps `SELECT` and `UPDATE` because admins
authenticate as that role; `information_schema.column_privileges` confirms nothing survives
underneath the table-level revoke. Happy paths re-verified over HTTP: owner reads own row
(200), owner edits own profile (200), owner is still refused a `tier` write by
`trg_guard_business_profiles_privileged` (`42501`), admin reads all rows (200), admin sets
`tier` (204). And signup still works — a throwaway business account signed up through
`/auth/v1/signup` and `handle_new_business_user()` (SECURITY DEFINER) created its
`business_profiles` row despite `authenticated` no longer holding `INSERT`; the account and row
were then deleted.

Applied 2026-09-10 (the lead loop: a consumer claims, the business sees the lead, they talk).
Same authorisation, same production-only caveat.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260910040001` | `business_owner_lead_access` | `20260910172831` |
| `20260910040002` | `claim_conversation_rpc` | `20260910172842` |
| `20260910040003` | `publish_messages_realtime` | `20260910172846` |

The SQL applied is identical to the files; only the long header comments were trimmed in the
applied copy, with each pointing back at the file of the same name. The files remain the
source of truth for rationale, prior definitions and rollback.

`20260910040001` replaces `guard_claim_consumer_columns()`; its prior definition is quoted
verbatim in the file header, so the revert needs nothing but the repo. `public.claims` had two
SELECT policies and two UPDATE policies, all four matching either an admin or the consumer —
nothing matched a business owner, on a table whose whole purpose is to carry a lead to one.
Proven first: as the approved owner of business 765 (`set_config('request.jwt.claims', …)`,
`set local role authenticated`) `select count(*) from claims` returned **0** with two claims in
the table; the same session read 53 rows of `promo_offer_master` for the same business, so the
session was real and only `claims` was denied. A 0-row RLS denial is not an error, so
`business-claims.ts` returned `{success: true, claims: []}` and every lead screen rendered "No
leads yet" — and every `Mark Contacted` / `Save Notes` UPDATE returned PGRST116 and did
nothing, silently.

After: the owner sees 2 of 3 claims — both on business 765, neither on 1219 — and the consumer
still sees only their own 2, not the third claim on 765 that belongs to another account.
Checked in both directions. The UPDATE half was attacked with a real password-grant token for a
throwaway approved owner of business 1219: `PATCH /claims?id=eq.<lead of business 765>` returned
`[]` (0 rows), `{"notes":…}`, `{"booked_date":…}` and `{"expires_at":…}` each returned `403
42501 a business may not edit the consumer's side of a claim`, `{"status":"expired"}` returned
`42501 a business may not set that claim status`, and moving `business_id` returned the
pre-existing `42501 these claim fields are not user-editable`. The consumer path is unchanged:
`status='contacted'` is still refused with `a consumer may only cancel a claim`, and
`status='cancelled'` still succeeds.

`20260910040002` adds `get_or_create_claim_conversation(uuid)`. `conversations` requires both
participant ids and neither party can read the other's side — a consumer cannot read
`business_profiles` at all — so `getOrCreateConversationAction` failed on every call with
'Business owner profile not found for this claim.', `src/lib/actions/claims.ts` invoked it as
`.catch(() => {})`, and `select count(*) from conversations` was **0**. Verified end to end over
HTTP with two real tokens: the consumer opened a conversation, sent a message, the owner listed
their claims, read the message, replied, and marked the lead contacted — then the consumer read
the reply. Attacks: a third party calling the function for a claim they are not on gets `42501
not a party to this claim`; `anon` gets `42501 permission denied for function`; the other pair's
thread returns `[]` on read and `42501 new row violates row-level security policy` on write.
For a business with no owner account the function returns SQL NULL, which PostgREST renders as
an all-null object rather than `null` — the action tests `data.id`, not `data`.

`20260910040003` is one line. `public.messages` was in no publication, so the `postgres_changes`
subscription in `messageThread.tsx` could never fire and a reply appeared only on a page
reload. `supabase_realtime` now carries `public.messages` alongside `notifications`. Realtime
re-checks each subscriber's RLS before delivering, and the SELECT policy on `messages` already
restricts rows to the two conversation participants, so this publishes what those two could
already read over REST and nothing more.

Every fixture was removed: three throwaway accounts (one consumer, one approved owner of
business 1219) and their `business_profiles` row and claims are deleted, and `auth.users` holds
no `probe.*` address. One row was deliberately left in place for browser verification — a real
claim from `haris+user@brandrap.com` on deal 8556 of business 765, with the conversation to
`haris+biz@brandrap.com` that the new function created. `notes` on it is NULL: nothing was put
in a consumer's mouth.

Applied 2026-09-10 (the admin lead relay: the screen that hands a lead to a business).
Same authorisation, same production-only caveat.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260910050001` | `admin_lead_contact_access` | `20260910174131` |
| `20260910050002` | `bound_admin_user_emails_input` | `20260910174257`, `20260910175201` |

The SQL applied is identical to the files; only the long header comments were trimmed in the
applied copies, each pointing back at the file of the same name.

`20260910050002` carries two ledger versions because it was applied twice in the same session.
It is `create or replace` over its own output, so the second apply was a no-op and the function
is in exactly the state the file describes — verified after the fact, not assumed. Recorded
rather than tidied away, since the ledger is the audit trail.

`20260910050001` creates `public.admin_user_emails(uuid[])` and replaces nothing, so there is
no prior definition to quote and the revert is one line the file states verbatim:
`drop function if exists public.admin_user_emails(uuid[]);`. It exists because
`/admin/dashboard/leads` — the only path by which a lead reaches a business — had no way to
contact either party. `master_business_info` holds a website, two social URLs, an address and a
Google place id, and NO email and NO phone; `public.profiles` has no email column at all; the
consumer's address lives only in `auth.users`, which PostgREST does not expose. Not abstract:
the one live claim (399dfccf, deal 8556, business 765) belongs to a consumer whose `profiles`
row has `first_name`, `last_name` and `phone` all NULL, so the screen could render nothing but
`64567837` and a `Mark relayed` button, and an admin marked work relayed that they had no means
to perform.

The guard is `private.is_admin()` and it RAISES rather than returning zero rows, because a
silent empty result is precisely how an authorization failure gets rendered as "no data" —
the failure mode `20260910040001` was written to close on `public.claims`. Proven in both
directions with `set_config('request.jwt.claims', …)` and `set local role authenticated`: the
admin gets both requested addresses back; the consumer asking for the admin's and the owner's
addresses gets `42501 admin access required`; the approved owner of business 765 asking for the
address of the consumer **on their own lead** gets the same `42501`. Over real HTTP with the
anon key, `POST /rest/v1/rpc/admin_user_emails` returns `401 42501 permission denied for
function admin_user_emails` — the grant refuses `anon` before the body is read. It takes ids
rather than returning a list, so it identifies users the caller already holds and cannot be
used to enumerate accounts.

The relay write itself was exercised on the real row as the admin role and then reverted:
`relay_method='facebook'` persisted, the relayed-history read returned it, and the matching
`admin_audit_log` insert (`action='lead_relayed'`, which `markLeadRelayedAction` had never
written) was accepted under the admin's RLS. Both were undone — `claims` is back to
`relayed_at IS NULL` and `status='pending'`, and `admin_audit_log` holds no `target_type='lead'`
row — so the claim deliberately left in place for browser verification is untouched. The same
UPDATE attempted as the approved business owner is refused by the pre-existing
`guard_claim_consumer_columns()` trigger with `42501 these claim fields are not user-editable`,
so the relay columns are admin-only at the database and not merely in the action.

`20260910050002` bounds the accessor's input at 200 ids and raises `22023` above it rather than
truncating, because a silently short result renders as "no email on file" for the rows past the
cap. `private.is_admin()` is a real gate, but an unbounded array turns a per-screen lookup into
a whole-directory export in one call. Its header quotes `20260910050001`'s definition verbatim,
so the revert needs nothing but the repo, and `src/lib/actions/admin-leads.ts` chunks its
lookups at the same 200 so a larger queue costs a round trip rather than an error. Verified
after applying: a 200-id array containing the one real consumer returns 1 row, 201 ids raise
`22023 admin_user_emails accepts at most 200 ids per call, got 201`, the non-admin `42501`
still fires, and `anon` over HTTP still gets `401 42501 permission denied for function` —
`create or replace` preserved the grants.

`supabase/schema-snapshot.json` still predates both files. `npm run schema:check` will report
`migration file 20260910050001_admin_lead_contact_access.sql is in the repo but the snapshot
predates it` (and the same for `…050002…`) until `npm run schema:snapshot` is run —
deliberately not run here, because it would race the other migrations landing in the same
session. `src/types/supabase.generated.ts` does not declare `admin_user_emails` either; that
costs nothing today because `createSupabaseServerClient()` carries no `Database` generic, so
`supabase.rpc()` is unchecked, but the next regeneration should pick it up.

## Applied 2026-09-10/11, and one column that arrived with no migration at all

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260910060001` | `revoke_remaining_anon_write_grants` | `20260910175246` |
| `20260910070001` | `owner_lead_consumer_contact` | `20260911063619` |

(`bound_admin_user_emails_input` appears twice in the ledger, `20260910174257` and
`20260910175201`; the second is a re-apply of the same file.)

**`clinic_promotions.screenshot text NULL`** (ordinal 13) appeared in the live database on
2026-09-11 with **no ledger entry** — `schema_migrations.statements` contains no DDL mentioning
it, and the four pipeline migrations applied after the 06:38 snapshot
(`deactivate_p0_and_orphan_offers`, `deactivate_named_clinic_promotions`,
`rebuild_3570_refresh_3510_normalize_json`, `patch_glowup_lip_filler_and_insert_loulou_hylenex`)
are all data updates. It was added directly, presumably by the data pipeline. There is
deliberately no file here for it: a file would claim the repo applied it, and the drift gate
matches files to ledger names. It is recorded the way the gate asks — regenerated types plus a
snapshot diff — and the app does not read it.

## Applied 2026-09-16, after the pipeline's 09-12→09-15 pass

Two repairs for damage the ingestion pipeline did out-of-band. Both are grants/guards, no data
touched.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260916010000` | `regrant_public_is_admin_execute` | `20260916131747` |
| `20260916010001` | `owner_deals_start_inactive` | `20260916131753` |
| `20260916010002` | `resync_promo_offer_master_id_sequence` | `20260916133328` |
| `20260916010003` | `alerts_email_opt_in_by_default` | `20260916135337` |

`20260916010000` re-grants `EXECUTE ON public.is_admin()` to `authenticated`, which ledger entry
`20260911121709 costfinder_p0_p1_completion_repairs` revoked. This is the **second** time this
function has been broken from the pipeline side (see `20260910030001` above for the first). Its
rollback is the revoke it undoes — but doing so locks every admin out of `/admin/dashboard`
again, because `src/proxy.ts` calls it over PostgREST and PostgREST resolves only `public`.

`20260916010001` replaces the review gate that `20260915012142 drop_promo_offer_moderation_columns`
removed. That migration dropped `moderation_status` / `moderation_notes`, dropped
`trg_guard_deal_moderation_status` with them, and rewrote the public SELECT policy to
`USING (is_active = true)`. Since `is_active` DEFAULTS TO TRUE, owner-submitted deals went live
on insert with no admin ever seeing them. Rollback: `drop trigger trg_guard_offer_publication on
public.promo_offer_master;` plus `drop function public.guard_offer_publication();` and rename the
SELECT policy back — but that restores the hole, so prefer fixing forward.

The trigger short-circuits on `current_user <> 'authenticated'`, so the pipeline (which applies
as `postgres` and writes as `service_role`) is unaffected by it. **If the pipeline ever needs to
flip `is_active` as `authenticated`, this trigger is what will stop it.**

`20260916010002` is a `setval` with no DDL and no data change. It was found by attacking
`20260916010001`: the INSERT half of the attack could not reach the new trigger at all, because
`promo_offer_master_id_seq.last_value` was 10022 against `max(id)` 10048. `createDealAction`
lets the sequence assign the id, so the next 26 owner-submitted deals would each have died on
`23505 duplicate key`, shown to the owner as "try again". Verified after applying: an insert as
the owner allocated 10049 and the publication guard forced it inactive, as designed.

It will drift again — the pipeline inserts explicit ids, which do not advance a sequence.

`20260916010003` flips `profiles.alerts_email` to default TRUE and backfills the 8 existing
rows. Rollback is the reverse (`set default false`), but it re-mutes claim confirmations and
moderation decisions for everyone. See the file header for why the backfill is not overriding
anyone's choice, and for why this must not be treated as marketing consent.

### A note on the ledger for this date

`promo_offer_master.requires_cf_verification` was added by the pipeline before 13:30Z and
dropped again before 15:30Z **with no ledger entry for either operation** — the drift gate
caught the drop mid-session. Two type regenerations were needed in one afternoon. When the
version numbers above look like they have gaps, this is why: the ledger is not a complete
record of what has happened to this schema.

## Applied 2026-09-17/18

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260916020001` | `add_business_phone` | `20260917012531` |
| `20260916020002` | `category_counts_count_stated_discounts` | `20260917020059` |
| `20260916020003` | `extend_service_taxonomy_enums` | `20260917020720` |
| `20260916020004` | `link_unlinked_offer_items` | `20260917021304` |
| `20260918010001` | `owner_read_own_offer_items` | `20260918113312` |

The four `0200xx` rows were applied on 2026-09-17 UTC but never mapped here; they are recorded
now so the table stays the index the drift gate's name matching assumes.

`20260918010001` adds a SELECT policy on `promo_offer_items` for a deal's approved owner, the
same `business_profiles` rule `promo_offer_master` already uses, reached through the offer.
Before it, every off-site deal reached `/business/dashboard/deals` with an empty item list: no
category, no product title, and no quantity — "$1,049" where the admin saw "$1,049 for 100 units".
On the day it shipped all 49 of business 765's deals were off the site, so the owner could read
0 of their 49 items; afterwards 49. Attacked with a real owner session: requesting the items of
25 off-site offers from 19 other businesses by id returned 0 rows, and anon still reads 0 items
of the owner's off-site deals. Rollback: `drop policy "Owners can read their business offer
items" on public.promo_offer_items;` — which restores the empty lists and nothing else.

## Applied 2026-09-24, launch-readiness implementation

Twelve files, all applied through the Supabase MCP the same day, in the order below (the
security hardening last, because it replaces the claims guard the two earlier files revised).
Each file carries its own `-- ROLLBACK:` block.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260924000001` | `retire_leaked_admin_account` | `20260924060219` |
| `20260924010001` | `claims_keep_revealed_details` | `20260924065010` |
| `20260924010002` | `close_stale_claims_on_next_claim` | `20260924065035` |
| `20260924020002` | `admin_contact_and_deal_corrections` | `20260924065038` |
| `20260924030001` | `listing_request_add_type` | `20260924065040` |
| `20260924030002` | `owners_cannot_delete_deals` | `20260924065041` |
| `20260924030003` | `claim_owner_notice_email` | `20260924065045` |
| `20260924020001` | `admin_lead_workflow` | `20260924065113` |
| `20260924040002` | `email_preferences_by_user` | `20260924065116` |
| `20260924040003` | `delete_own_account` | `20260924065127` |
| `20260924040004` | `close_direct_business_signup` | `20260924065129` |
| `20260924040001` | `harden_direct_writes` | `20260924065229` |

Two data repairs were run the same day without files, as the governance note allows for
data-only changes: `master_business_info.city` filled from the address for businesses 2415
(Laguna Hills) and 2090 (Tustin), and `clinic_promotions.campaign_end_date = 2026-09-30` on
promotions 207 and 3416 (offers whose own text says "September").

## Applied 2026-09-24, the API-level identity gate (two steps, so production never broke)

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260924050001` | `public_catalogue_views` | `20260924173639` |
| `20260924050002` | `close_public_catalogue_reads` | `20260924174525` |
| `20260924050003` | `public_offers_withhold_unread_text` | `20260924175000` |

Step A (additive) created the identity-scrubbed `public_offers` and `public_business_directory`
views owned by postgres, made the five count RPCs SECURITY DEFINER, and gave admins, approved
owners and claimants their own SELECT policies on the catalogue tables. The code switched to the
views and deployed. Step B then revoked anon SELECT on the six catalogue tables, dropped the
public policies, and closed two side doors (`v_promotion_content_guardrail_violations`,
`promo_social_staging`). Verified live: every table answers the anon key with 42501; the feed
carries no clinic name, website, rating or source URL. Step C nulls the two text columns nothing
on the site reads (`conditions`, `promotion_title`): the verbatim clinic text stops leaving the
database, and the corpus query drops from ~400 ms to ~250 ms.

## Applied 2026-09-28, deal reports and clinic confirmations (spec: `.planning/DEAL-BROWSE-AND-TRUST.md` §4)

Owner-authorized; production-only, no staging database exists. The SQL applied is the file's
body; only the long header comment was trimmed in the applied copy, pointing back at the file.

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260928010001` | `deal_reports` | `20260928091039` |
| `20260928010002` | `offer_confirmations` | `20260928091128` |

Both are additive: two new tables, one view, one pure function, one RLS-scoped read function and
three trigger functions. Nothing existing was altered, so each file's `-- ROLLBACK:` is drops only.

Attacked live in one `DO` block that ends by raising its results, so every write rolled back
(`deal_reports` and `offer_confirmations` were 0 rows before and after; offer 7973's text, edited
to prove the badge hides, is unchanged). Identities are the three CLAUDE.md test accounts via
`request.jwt.claims` + `set local role`:

- anon: SELECT on either table `42501`; a deal-page report with no reporter inserts 1 row and its
  forged `status='resolved'`/`admin_note` are stored as `open`/null; with a reporter, or as a claim
  answer, `42501`; an offer id that does not exist `23503`; 301 reports in a row `PT429` (the cap).
- consumer: an answer for another consumer's claim `42501`; for their own claim 1 row, with the
  forged `offer_id`, `reporter_id` and `status` replaced by the claim's deal (8556), their own uid
  and `open`; changing it by upsert 1 row; they read 1 row (their own); setting `status` or
  `offer_id` `42501`; a deal-page report naming someone else as reporter `42501`; confirming a
  business-765 offer `42501`.
- owner of 765: confirming another business's offer while claiming `business_id = 765` `42501`;
  confirming their own offer with a forged snapshot, business and owner stores the real snapshot
  (no forged key), business 765, owner = caller, status `open`; their own off-site offer 1 row;
  editing a confirmation 0 rows (no UPDATE policy); a correction with a blank note `23514`;
  editing the consumer's answer 0 rows; DELETE `42501`.
- admin: reads both tables; resolving a report and dismissing a correction each 1 row with
  `resolved_by` = the admin and `resolved_at` stamped; rewriting a snapshot or a consumer's answer
  `42501`; TRUNCATE and DELETE `42501`. A consumer who changes a resolved answer reopens it.
- the badge view (as anon): exposes `offer_id, confirmed_at` only; shows the confirmed active offer
  and not the confirmed off-site one; hides it once the offer's text changes (and
  `latest_offer_confirmations()` reports `is_current = false` to the owner), shows it again on
  re-confirmation, hides it after a later correction, and shows it again once an admin dismisses
  that correction. anon calling `latest_offer_confirmations()` `42501`.

The Supabase advisor lists `public_offer_confirmations` under "Security Definer View" (the same
design as `public_offers`) and `offer_confirmation_snapshot` under "mutable search_path" (pure,
reads no table, the same reasoning as the scrub functions in `20260924050001`).

### Same day: admin notes stop leaking to owners and customers

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260928010003` | `feedback_admin_note_column_grants` | `20260928113020` |

The review found the two SELECT policies above (owner reads their business's confirmations, a
consumer reads their own claim answer) exposed `admin_note` and `resolved_by`: RLS filters rows,
not columns, and both tables had a table-wide SELECT grant. The file swaps that grant for
column-level SELECT without the two columns and adds `admin_feedback_notes(uuid[])` (SECURITY
DEFINER, gated per row on `private.is_admin()`), which the admin queue reads notes through.
Attacked live in a rolled-back `DO` block: owner and consumer reading `admin_note` or
`resolved_by` `42501`; the owner's app columns and `latest_offer_confirmations()` still read; the
consumer's upsert still returns its row; the admin's direct `admin_note` read `42501`, the RPC
returns both notes, and an update of `status`/`admin_note` returning `status` succeeds; owner and
consumer calling the RPC get 0 rows; anon `42501`.

## Applied 2026-09-28, membership plan names wait for a claim (owner decision)

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260928010004` | `public_offers_withhold_membership_name` | `20260928203433` |

The applied copy is the file's body; its header was trimmed to a pointer back at the file.
`public_offers` is re-created with the same columns, types and order, `membership_name` NULL flat
and inside `clinic_memberships` (365 of 947 rows carried one to anon before). New
`claimed_membership_name(bigint)`, SECURITY DEFINER, execute for `authenticated` only.
Rollback: the file's `-- ROLLBACK:`.

Anon read, warm, whole rows as `json_agg`: corpus 244-264 ms before, 211-225 ms after (measured on
the new view inside a rolled-back DO block before applying); Newport Beach 34-36 → 30-32 ms; one
deal 1-3 → 1-2 ms.

Attacked live in one `DO` block that ends by raising its results, so nothing it did persisted
(it wrote nothing: every claim used was already there). Identities via `request.jwt.claims` +
`set local role`:

- privileges: anon EXECUTE false, authenticated true, PUBLIC not in the ACL.
- anon: `claimed_membership_name(8107)` `42501`; `public_offers` rows with a plan name, flat or in
  the jsonb, 0 of 947 (444 rows still carry a plan object with its fee).
- consumer (`haris+user`, claims on 8556/765 contacted, 7737/346 cancelled, 7981/359 pending,
  8837/241 pending): 8107 (DermFx, unclaimed) NULL; 8837 (own claim) and 8836 (sibling, same
  business) "Greenspring The Insiders Membership"; 10300 (business 346, claim cancelled)
  "Skinjectables Vault Membership"; 7930 (business 359, claim on 7981) "Female Hormone Platinum";
  7802 (inactive, business 241) the plan name; a nonexistent id NULL; `public_offers` plan names 0;
  `clinic_memberships` directly 0 rows (RLS).
- owner of 765 and the admin, neither with a claim: NULL on 8836 and 8107. A JWT with no `sub`:
  NULL.

### Same day: the plan name leaves the offer's own wording

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260928010005` | `public_offers_scrub_plan_names` | `20260928205923` |

The applied copy is the file's body; its header was trimmed to a pointer back at the file.
`public_offers` is re-created with the same columns, types and order; `offer_raw_text` and each
`item_name` now pass through `private.scrub_plan_name()` (the row's own plan, only when the name is
distinctive per `private.plan_generic_words()`) before the identity scrub. Three new functions in
`private`, EXECUTE for anon/authenticated/service_role only, unreachable over PostgREST (rpc 404,
`Accept-Profile: private` 406). Rollback: the file's `-- ROLLBACK:`.

Measured live: 43 of 947 offers change text, 0 item names; as anon, no public text or item names
any of the 70 distinctive plan names attached to a live offer ("Beauty Bank" appears in 3 H-MD
offers, 10588-10590, which have no plan: another clinic's plan name, not their own, out of scope).
Every pricing field of every offer visible both before and after is identical through the app's
adapters; 4 offers (10302, 10318, 10340, 10341) drop out of the listings because forShoppers()
now finds them identical to a sibling on another plan (see the file's header). Anon read, warm:
corpus ~241 → ~260 ms, Newport Beach ~31 → ~37 ms, one deal unchanged.

## Applied 2026-09-30, the pipeline alone writes offer terms

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260930010001` | `revoke_promo_offer_terms_writes` | `20260930103538` |

The applied copy is the file's body; its header was trimmed to a pointer back at the file. anon and
authenticated keep SELECT only. Measured live: as the anon key, POST/PATCH/DELETE → 42501. As
haris+admin, reads 200 and every write 42501 `permission denied for table promo_offer_terms`. As
haris+biz, offer 1523 (own, inactive) 1 row, offer 10077 (another clinic, inactive) 0 rows, every
write 42501. The owner/admin write policies remain, inert without the grant; nothing in `src/` wrote
the table.

## Applied 2026-09-30, fixes from the data contract (`.planning/SCHEMA-GOVERNANCE-ASK.md` §5)

| Repo file version | Name | Ledger version |
|---|---|---|
| `20260930020001` | `service_rename_keeps_scraped_titles` | `20260930144637` |
| `20260930020002` | `revoke_staging_client_grants` | `20260930144639` |
| `20260930020003` | `repair_split_blankets_and_unstated_prices` | `20260930144725` |

The applied copies are the files' bodies with the header trimmed to a pointer. `020001` changes a
pipeline trigger function, `sync_promo_offer_item_name_from_service()`. It now moves titles only on
a real service rename, and only titles that still read as the old name. Proved in a rolled-back
block on a live Botox service: a price update changed no title, a rename moved the two generic
titles, and a scraped title survived both. `020002`: anon now gets 42501 on both staging tables
(was an RLS-empty result). `020003` is data only. It was dry-run first in a block that always
raised, and the read-back matches it row for row. 4 duplicate blanket rows at business 1720 are
inactive (visible offers 947 → 943). 8 unstated prices are now the stated discount. The price
baseline shrank from 16 to 8 (`prices:baseline`). Rendered on the dev server: 1386, 8788, 9216 and
7853 now read "As advertised", 10031 reads "Our math" ("buy 120, get 30 free" as 20% off), and 7856
returns 404.
