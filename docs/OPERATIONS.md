# Operations

Runbook for things that live outside the repository. Everything here is a manual step in a
third-party console — code cannot do it, and each item was found because something in the
app was broken or exposed by its absence.

## Google Places API key — REVOKE IT

`GOOGLE_PLACES_API_KEY` no longer backs anything. `searchGooglePlacesAction` and
`src/lib/actions/google-places.ts` were deleted on 2026-09-16 along with the Google branch of
the business-search modal: importing a result called `importGooglePlaceAction`, which inserted
into `master_business_info` as the signed-in user against an `is_admin()`-only INSERT policy, so
it was a guaranteed 42501 — *after* a billed Places lookup had been spent, with an error message
that invited the user to spend another one.

**Owner action:** Google Cloud project `1057913064286` → APIs & Services → Credentials → delete
the Places key. Nothing in this repo reads it, so deleting it cannot break anything, and it
closes the exposure that used to need a restriction fix: the key was created with an HTTP-referrer
restriction, which cannot work for a server-side call (no browser, no `Referer` header), so the
action never returned a result in production anyway.

The Vercel environment variable is deliberately left in place — removing it does not revoke the
key, and revoking is the step that matters. Remove it once the key is gone.

If Google Places search is ever rebuilt, the restriction must be **IP addresses** or *None*, the
API restriction **Places API (New)** only, and a daily quota cap set — the in-app rate limit is
per-instance and is a bound, not a guarantee (`src/lib/rate-limit.ts`).

## Error alerting

`ALERT_WEBHOOK_URL` (see `.env.example`) receives every `logger.error()` call and every
unhandled server-side App Router error, via `src/lib/alerting.ts` and
`src/instrumentation.ts`. Since 2026-09-23 that includes hard bounces and spam complaints from
the Resend delivery webhook (next section). Since 2026-09-24 it also includes a failed scheduled
gate (`[cron-gates]`, see "Scheduled gates").

**Set on 2026-09-26** (Production and Preview, sensitive) to the incoming webhook of the Slack
app **CostFinders alerts** (api.slack.com/apps/A0C4FHHB919), posting to **#costfinder-ops**. The
same URL is on the Railway `guides` service ("Weekly cost guides"). A direct POST answered 200
and the test message appeared in the channel. **The full path was proved at 2026-09-26 19:04Z:**
a `bounced@resend.dev` send → Resend webhook (signature valid, 200) → `logger.error` → the
message `CostFinders error [resend-delivery-webhook] Email hard-bounced (…)` in
#costfinder-ops three seconds after the send. The first attempt at 18:51Z reached
`logger.error` and went no further: the webhook fetch was fired without `waitUntil` and Vercel
froze the function on return (`src/lib/alerting.ts`, fixed the same day). Before this it was unset from 2026-09-23: errors
landed in Vercel's runtime logs, which nobody reads unless they go looking — the condition
issue #21 was filed about, and why the five-day outage of 09-11 went unnoticed. To rotate:
delete the webhook on the Slack app page, add a new one, and repeat steps 2–3 below.

To set it:

1. Create an incoming webhook in a channel someone reads on their phone. Slack: Apps →
   Incoming Webhooks → Add to Slack → pick the channel → copy the Webhook URL. Discord: Server
   Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
2. Vercel → team BrandRap → project **costfinders_v2** → Settings → Environment Variables →
   Add New. Key `ALERT_WEBHOOK_URL`, the URL as the value (typed, see "never paste" below),
   Environments **Production** and **Preview**. Save.
3. Redeploy production: Deployments → the current Production deployment → ⋯ → Redeploy. A
   deployment keeps the variables it was built with, so nothing changes until this runs.
4. Prove the whole path once the bounce webhook below is also live. Send one message to
   Resend's simulated hard-bounce address; within a minute the channel shows
   `CostFinders error [resend-delivery-webhook] Email hard-bounced (Resend email …)`.

   ```bash
   curl -s -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
     -d '{"from":"CostFinders <notifications@costfinders.ai>","to":["bounced@resend.dev"],"subject":"alert path test","text":"test"}'
   ```

Volume is bounded at 20 distinct errors per 5 minutes per instance, deduplicated by
fingerprint, so an outage cannot flood the channel into being muted.

## Bounce and inbound webhooks

Two routes, written 2026-09-23. **The bounce route went live on 2026-09-26**: webhook
`991f92a5-6711-4489-8536-f071f7c2a5d9` in Resend, endpoint
`https://costfindersv2.vercel.app/api/webhooks/resend`, events `email.bounced` and
`email.complained`, its signing secret in Vercel as `RESEND_WEBHOOK_SECRET` (Production,
sensitive, piped from the API response and never displayed). **At the domain cutover this
webhook's endpoint must change to `https://www.costfinders.ai/api/webhooks/resend`** — it is
step 8 of the cutover runbook below. **The inbound route went live on 2026-09-30** (mail
routing option A, owner decision): webhook `a701c882-259c-47ce-9953-d06d9f002211`, endpoint
`https://costfindersv2.vercel.app/api/webhooks/resend-inbound`, event `email.received`, its
secret in `RESEND_INBOUND_WEBHOOK_SECRET` (Production, sensitive, piped from the API response
and never displayed), forwarding to `SUPPORT_FORWARD_EMAIL` = haris@brandrap.com. Its endpoint
must also move to www at the cutover.

| Route | Resend events | Secret variable | What it does |
|---|---|---|---|
| `/api/webhooks/resend` | `email.bounced`, `email.complained` | `RESEND_WEBHOOK_SECRET` | A permanent bounce or a complaint goes through `logger.error`, so it reaches `ALERT_WEBHOOK_URL`. It logs the Resend email id and a 12-character hash of the recipient, never the address. Transient bounces are logged as warnings only. |
| `/api/webhooks/resend-inbound` | `email.received` | `RESEND_INBOUND_WEBHOOK_SECRET` | Fetches the body from Resend and forwards sender, subject and plain text to `SUPPORT_FORWARD_EMAIL` (see "Mail routing" below). |

Both verify Resend's signature in `src/lib/email/inbound.ts`: HMAC-SHA256 over
`svix-id.svix-timestamp.body`, keyed with the `whsec_` secret, with a 5-minute replay window.
A bad signature gets 401. An unset secret gets 503 with the variable's name in the body.
`tests/unit/resendWebhookSignature.test.ts` holds a reference vector checked against the
library the Resend SDK uses.

- **Two secrets, not one.** Resend gives every webhook its own signing secret, so the two
  routes cannot share a variable.
- **The Resend account is shared with twelve other client domains, and Resend webhooks are
  account-wide.** Every client's bounces reach the delivery route, and mail for every
  receiving-enabled domain reaches the inbound route. On 2026-09-23 that included
  sandiego-wellness.com. Both routes act only on costfinders.ai: the sender for bounces, the
  To and Cc addresses for inbound. Everything else gets a 200 and is dropped. Do not remove
  that filter, or another client's mail gets forwarded to CostFinders support.
- **Reading a received body needs a full-access Resend key.** A sending-only key answers
  401 `restricted_api_key`, the forward fails, and Resend retries for about 17 hours. On this
  shared account a full-access key can read and change all 13 domains. That trade-off is why
  "Mail routing" below also describes a DNS-only alternative.

### Setup (owner, Resend and Vercel consoles)

1. resend.com/webhooks → **Add Webhook**. Endpoint
   `https://costfindersv2.vercel.app/api/webhooks/resend`. After the domain cutover, use
   `https://www.costfinders.ai/api/webhooks/resend` instead. Events: `email.bounced` and
   `email.complained`. Save, open the webhook, and copy its **Signing secret** (`whsec_…`).
2. Vercel → costfinders_v2 → Settings → Environment Variables → `RESEND_WEBHOOK_SECRET` =
   that secret, **Production** only. Preview deployments have their own URLs and Resend
   never calls them.
3. Only if the inbound forward is the chosen mail route: **Add Webhook** again. Endpoint
   `…/api/webhooks/resend-inbound`, event `email.received`. Copy its secret into
   `RESEND_INBOUND_WEBHOOK_SECRET` (Production). Set `SUPPORT_FORWARD_EMAIL` (Production)
   to a monitored mailbox that is **not** on costfinders.ai. The route refuses an
   own-domain address, because forwarding to it would loop. Then check the key: Resend → API
   Keys → the key in `RESEND_API_KEY` → Permission must be **Full access**.
4. Redeploy production.
5. Verify:
   - `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://costfindersv2.vercel.app/api/webhooks/resend`
     prints 401. It printed 503 before the secret was set.
   - Resend → Webhooks → the webhook → recent deliveries show 200.
   - For the bounce path, run the `bounced@resend.dev` test in "Error alerting".
   - For the inbound path, mail support@costfinders.ai from a personal address. It arrives at
     `SUPPORT_FORWARD_EMAIL` with the subject `[support@costfinders.ai] …`.

**Rotating a secret:** resend.com/webhooks → the webhook → rotate the signing secret → put the
new value in the Vercel variable → redeploy. Deliveries fail with 401 in between. Resend
retries at 5s, 5m, 30m, 2h, 5h and 10h, and failed deliveries can be replayed from the
webhook's page, so nothing is lost if the redeploy follows within a few hours.

**Replies:** since 2026-09-30 a forward carries `Reply-To:` the original sender
(`forwardedEmail()` in `src/lib/email/inbound.ts`), so replying to it reaches them. A From that is
not a plain address gets no Reply-To, because Resend refuses a malformed `reply_to` with 422 and
would retry the forward for a day. The forward then says to write to the From address instead.

## Mail routing: leads@ and support@

**Decision (owner, 2026-09-30): option A.** The inbound webhook forwards everything addressed to
costfinders.ai to `SUPPORT_FORWARD_EMAIL` (haris@brandrap.com), and `CLAIM_NOTIFICATION_EMAIL`
names the same inbox. Keep Resend → Domains → costfinders.ai → Receiving **on**: turning it off
stops the forward. The text below is the background and the alternative.

**Before 2026-09-30 nobody received this mail.** The apex MX record of costfinders.ai points at Resend's
inbound server, which accepts mail for any address at the domain and stores it under Resend →
Emails → Receiving. No mailbox exists and nothing forwards it. The sender gets no bounce and
believes the message arrived. On 2026-09-23 Resend held one received message: a claim notice
sent to leads@ on 09-17.

What gets sent there:

- New-claim notices go to `CLAIM_NOTIFICATION_EMAIL`, which falls back to
  leads@costfinders.ai (`src/lib/email/claimNotification.ts`).
- Listing requests and "Do Not Sell or Share" requests (`/privacy/do-not-sell`) go to
  `LISTING_REQUEST_EMAIL`, then `CLAIM_NOTIFICATION_EMAIL`, then support@
  (`src/lib/email/opsInbox.ts`).
- The legal pages publish support@ (`contactEmail` in `src/lib/legal/companyFacts.ts`) for
  privacy rights, authorized agents and price corrections, and `/business/dashboard` names it
  for business claim review and notification settings. Account deletion is self-serve in
  `/dashboard/settings` and needs no email.

DNS records on costfinders.ai (Cloudflare), as Resend reports them:

| Name | Type | Role |
|---|---|---|
| `@` (apex) | MX, priority 1 | Resend inbound. **The only record that decides where incoming mail goes.** |
| `send` | MX, priority 10 | Bounce feedback for outgoing mail (return path). Leave it. |
| `send` | TXT (SPF) | Authorises Resend's sender for the return path. Leave it. |
| `resend._domainkey` | TXT (DKIM) | Signs outgoing mail. Leave it. |
| `_dmarc` | TXT | `p=quarantine`. Aggregate reports go to an old GoDaddy address. Point them at a read inbox or remove the `rua=` tag. |

Outgoing mail depends only on the `send` records and DKIM, so changing the apex MX does not
affect anything the site sends. Choose one fix (owner decision):

- **A. Forward through the inbound webhook.** The code is ready. Follow step 3 of the setup
  above. There is no DNS change. The costs: replies need copying by hand (see "Replies"),
  Resend stays the mail store, and the key must be full access on the shared account.
- **B. Point the apex MX at a real mailbox.** Cloudflare Email Routing is free and the zone
  is already on Cloudflare. Go to Cloudflare → costfinders.ai → Email → Email Routing →
  Enable. It offers to replace the existing MX records, so accept. Add routing rules for
  `leads@` and `support@` to a verified destination address. Then Resend → Domains →
  costfinders.ai → turn **Receiving** off, and never create the inbound webhook. Google
  Workspace, Fastmail or Zoho work the same way with their own MX values. Replies then come
  from a real mailbox, and no full-access key is needed.

Stopgap for either choice: set `CLAIM_NOTIFICATION_EMAIL` (and optionally
`LISTING_REQUEST_EMAIL`) in Vercel to an inbox someone reads, then redeploy. Lead notices
then stop depending on this section at all.

## Listing-request notifications

`LISTING_REQUEST_EMAIL` is where "add my business" / "correct this listing" submissions are
emailed from `src/app/business/listing-request/actions.ts`. It is **optional**: the recipient
falls back to `CLAIM_NOTIFICATION_EMAIL`, and then to `support@costfinders.ai`. Set it only to
route listing requests somewhere other than the claim inbox. Every submission is also written
to `public.listing_requests`, so an unread mailbox loses the notice, not the request.

"Do Not Sell or Share" requests from `/privacy/do-not-sell` go to the same address and have
**no table**: the email is the only record, so an unread mailbox loses the request. The form
tells the requester when the send fails. The CCPA gives 15 business days to act on an opt-out.

## Deal feedback notices and queue (2026-09-28)

Three kinds of deal feedback email the ops inbox through `sendOpsNotice()`
(`src/lib/email/opsInbox.ts`: `LISTING_REQUEST_EMAIL`, then `CLAIM_NOTIFICATION_EMAIL`, then
support@, which today reaches nobody, see "Mail routing"). Each is sent after the response and
is best-effort. The row is saved first, a failed send is a `logger.error` (so it posts to
#costfinder-ops), and `/admin/dashboard/feedback` is the record, not the inbox.

| Trigger | Subject | Row | The email lists |
|---|---|---|---|
| Report a problem on a deal page (signed out too; 5 per IP per 10 minutes) | `Deal report: {problem} (deal {id})` | `deal_reports`, source `deal_page` | the deal's link, the problem, the note, the reporter ("signed out" or the user id) |
| A customer answers "Did the clinic honor this price?" with anything but Yes | `Claim answer: {answer} (deal {id})` | `deal_reports`, source `claim` | the answer, the deal's link, the claim id, the note |
| An owner's Suggest a correction | `Deal correction requested (deal {id})` | `offer_confirmations`, kind `correction` | the deal's link, the admin deal editor's link, the correction |

Work the queue at `/admin/dashboard/feedback`: resolve, dismiss or reopen, each with a note that
only admins can read. Apply a correction in the deal editor on `/admin/dashboard/deals`, and warn
the data team: the pipeline may overwrite it. **Resolve a correction; do not dismiss it.** The
"Confirmed by the clinic" badge comes from the owner's latest row that is not dismissed, so
dismissing a correction brings back the earlier confirmation's badge while the deal is
unchanged.

### Test rows from the 2026-09-28 verification (closed)

All closed through the admin UI and checked with SQL the same day. The first three also sent a
notice, from the local dev server, so to support@ (neither address variable is in `.env.local`).

| Row | What it was | Final state |
|---|---|---|
| `deal_reports` `87d23f36-e542-4b5c-8650-620242dbc041` | signed-out Report a problem, deal 1386 | dismissed, note "verification test" |
| `deal_reports` `37cd21b1-fab8-4f1e-89d1-b04b49d1702f` | customer's honor answer, "A different price", deal 8837 (claim `842b7722…`) | dismissed, note "verification test" |
| `offer_confirmations` `622211dd-5047-4f46-a071-45e7428fe759` | owner's correction, deal 8590 | **resolved**, note "verification test". Leave it resolved |
| `offer_confirmations` `bd70308e-bcfc-432e-a52c-162ea4aae01a` | owner's confirmation, deal 8590 | **dismissed** by SQL the same day (confirmations are not queue items). While it was open, only the resolved correction on top kept its false "Confirmed by the clinic" badge hidden; dismissed, it can never resurface |

## Health check and uptime monitoring

`GET /api/health` (`src/app/api/health/route.ts`) runs four checks against the live database
with the anon key: the env vars are present, six required tables resolve, two required RPCs
execute, and the real featured-offers path returns at least one row. It answers **200
`{"status":"healthy"}`** or **503 `{"status":"unhealthy"}`**, `Cache-Control: no-store`.

`HEALTH_CHECK_TOKEN` is **optional and normally unset**. Unset, the body carries `status` and
`timestamp` only — everything a monitor needs. Set it and send it as the `x-health-token`
header to also get the per-check breakdown, the failing table and RPC names, and latency.
That detail stays behind the token because the unhealthy body used to hand live Supabase
error strings to anonymous callers.

### It can now actually pass, which it could not before

The endpoint answered 503 continuously for four days because it probed `business_claims` with
the anon client, and that table denies anon by design. A monitor wired to a permanently red
check gets muted on day one, which is how a genuinely broken `get_offer_category_counts` stayed
hidden. The route now splits its tables by who may read them (`PUBLIC_TABLES` vs
`OWNER_SCOPED_TABLES`) and treats a permission denial on an owner-scoped table as proof the
table exists.

Verified 2026-09-09 by running each probe against production with the anon key:

```
table promo_offer_master     code=200 OK    ok=true
table master_business_info   code=200 OK    ok=true
table profiles               code=42501     ok=true
table business_profiles      code=42501     ok=true
table business_claims        code=42501     ok=true
table claims                 code=42501     ok=true
rpc   get_city_deal_counts         status=200 rows=33
rpc   get_offer_category_counts    status=200 rows=12
offers_query rows = 1
```

### What watches it

**Nothing inside this project. External uptime monitoring is handled by the owner outside this
project (decision 2026-09-30), so it is not tracked here or listed as a blocker.** The
GitHub Actions `uptime` job that curled this URL hourly was deleted on 2026-09-24 with the rest of
the workflow (see "GitHub Actions (removed 2026-09-24)" below), and it has no in-platform
replacement on purpose. A self-check is not an uptime check: a Vercel cron runs inside the
deployment it would be checking, so when every function returns 500 (as from 09-11 to 09-16) the
check fails with it and reports nothing. Only something outside Vercel can see Vercel down.

**For reference, if a monitor is set up (owner, no engineer needed).** The URL returns 200 without a token. With
UptimeRobot, Better Stack or similar:

1. New monitor → type **HTTP(s)** → URL `https://costfindersv2.vercel.app/api/health`. After
   the cutover, use `https://www.costfinders.ai/api/health`.
2. Interval 5 minutes. Alert when the status is not 200. Optionally also require the keyword
   `healthy`.
3. Alert contacts: an email plus SMS or push for whoever is on call. If `ALERT_WEBHOOK_URL`
   is a Slack or Discord webhook, most monitors can post to it too.

The route allows 30 anonymous requests a minute per address, far above any monitor's interval.

**History: a monitor that worked and paged nobody.** From 09-11 to 09-16 every hourly GitHub run
reported `attempt 1/2/3: HTTP 500` and failed, for five days, while production served a static
`/500` to every function route. A 2026-09-11 audit recorded the opposite — that the scheduled
jobs "have never fired" — and the plan built on that finding; `gh run list --event schedule`
disproved it in one command. Then `schema-drift` sat red from 2026-09-19 04:43Z on four real
differences (a new `Skin Tightening` category and changed unit types), and nobody noticed that
either. GitHub also ran the hourly job only 12 times out of 48 between 09-22 and 09-24, and a
failed scheduled run emails only the user who last edited the workflow's `cron` lines. Two
lessons that still apply:

- Check the job's own run log before concluding a scheduled job is not running. For the Vercel
  crons that is `vercel crons ls` and the cron's logs (see "Scheduled gates").
- A red monitor that nobody is paged by is not monitoring. Until `ALERT_WEBHOOK_URL` is set in
  Vercel (owner-blocked, see "Error alerting") and an external monitor alerts a phone, a total
  outage can again go unnoticed for a week.

## Scheduled gates

Two Vercel cron jobs, declared in `vercel.json` `crons`. Vercel runs them on the **production**
deployment only, as a GET with `Authorization: Bearer <CRON_SECRET>` once that variable is set.

| Route | Schedule (UTC) | What it does |
|---|---|---|
| `/api/cron/gates` | `17 */6 * * *` | The schema drift check and the price-basis check (`npm run schema:check` and `npm run prices:check`, same code in `src/lib/gates/`), read-only, anon key |
| `/api/cron/rebuild` | `55 3 * * *` | POSTs the Vercel deploy hook (next section but one) |

`/api/cron/gates` answers **200** when both checks pass and **500** when either fails, so a red
run shows in the cron log. A failure also goes through `logger.error` as `[cron-gates]`, which
is what reaches `ALERT_WEBHOOK_URL`: one alert per failing check, carrying its summary (the drift
lines or the new unlabellable offers). The database moves with no commit, which is why this runs
on a timer as well as in the pre-push gate. A red run usually means the pipeline moved the
database, not that code broke; see "The database moves without the repo" in CLAUDE.md.

**`CRON_SECRET` — owner step.** Any long random string (`openssl rand -hex 32`). Vercel → team
BrandRap → project **costfinders_v2** → Settings → Environment Variables → Add New → key
`CRON_SECRET`, environment **Production**, typed not pasted (see "never paste" below). Redeploy.

**Set on 2026-09-24** as a sensitive Production variable through the Vercel CLI (`openssl rand -hex 32`
piped straight into `vercel env add`, so the value was never displayed or recorded). Rotating it is
the same two steps plus a redeploy.
Without it, `/api/cron/gates` stays callable by anyone at 6 requests an hour per address (it is
read-only), and `/api/cron/rebuild` answers 503 naming the variable, because a build trigger
must never be public.

Check and run them:

```bash
vercel crons ls                      # both jobs listed against costfinders_v2
vercel crons run /api/cron/gates     # triggers the production job now
curl -s -H "Authorization: Bearer $CRON_SECRET" https://costfindersv2.vercel.app/api/cron/gates
```

The body is `{"schema":{"ok":…,"summary":…},"prices":{"ok":…,"summary":…}}`. Run history is in
the Vercel dashboard under the project's Cron Jobs settings, and each run's output is in Runtime
Logs, filtered on `cron-gates`.

## GitHub Actions (removed 2026-09-24)

The org **BrandRap-LLC is on GitHub Free**: 2,000 Linux minutes a month shared by every private
repo. On 2026-09-23 it had used 1,969 (campus_ui 1,272, costfinders_v2 326, cms-v2 152), and
once the pool ran out none of this repo's workflow ran: not the push gate, the drift timer, the
uptime check or the nightly rebuild. On 2026-09-24 `.github/workflows/ci.yml` was deleted and
each job moved:

| Was (GitHub Actions) | Now |
|---|---|
| `quality`, on every push and PR | The Husky pre-push hook runs `npm run gate` (`scripts/gate.sh`) on the pusher's machine |
| `schema-drift` timer, every 6 hours | Vercel cron `/api/cron/gates` ("Scheduled gates") |
| `rebuild-for-new-deals`, daily | Vercel cron `/api/cron/rebuild` ("Nightly rebuild" below) |
| `uptime`, hourly | Nothing in the platform: an external monitor, handled by the owner outside this project ("What watches it") |
| — (never existed) | Weekly guide generation is a Railway cron ("Weekly cost guides" below), not Actions: it needs git, a token and ~15 minutes including the gate build |

The pre-push gate runs only where Husky is installed (`npm install` runs `prepare`), and a push
from anywhere else, or with `HUSKY=0`, skips it. `HUSKY=0 git push` is forbidden outside an
incident. Nothing on the server re-runs the gate: Vercel's own `next build` is the only check a
push meets there.

**Owner cleanup**, once `VERCEL_DEPLOY_HOOK_URL` and `CRON_SECRET` are set in Vercel:
github.com/BrandRap-LLC/costfinders_v2 → Settings → Secrets and variables → Actions → delete
the secrets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`VERCEL_DEPLOY_HOOK_URL`, and on the Variables tab `HEALTH_CHECK_URL` if it exists. Nothing reads
them any more, and the anon key is one fewer copy to rotate.

## Supabase email templates (dashboard-managed, no file in this repo)

Authentication → Emails → Templates, project `kdlpkjzcnbkjcvwsvlwn`. These are config the repo
cannot hold, so the current text is recorded here — the same discipline the schema snapshot
enforces for the database.

### Magic link or OTP — changed 2026-09-10

```html
<h2>Magic Link</h2>

<p>Follow this link to login:</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Log In</a></p>
```

**Rollback** (the Supabase default, and what this replaced):

```html
<h2>Magic Link</h2>

<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

**Why it changed.** `{{ .ConfirmationURL }}` routes through `/auth/v1/verify`, which for a
PKCE client returns `?code=` — and exchanging that code requires the code-verifier cookie
written on the device that *requested* the link. Magic links are opened on a different device
constantly (request on a laptop, open on a phone), and every one of those failed. The
`token_hash` form is verified server-side by `verifyOtp()` in `src/app/auth/callback/route.ts`
and needs no cookie, so it works cross-device. Verified live: a link requested with `curl` (no
browser, so no verifier could exist) signed a browser in and landed on its `next` path.

Notes for whoever touches this next:
- `{{ .TokenHash }}` arrives prefixed `pkce_` whenever the caller sent a code challenge, which
  `@supabase/ssr` always does. That is fine — GoTrue's POST `/verify` handler has no PKCE
  branch and accepts the prefixed hash directly.
- The `&` before `token_hash` depends on the allowlist. See step 3 of the cutover below.

### Confirm signup and Reset password — changed 2026-09-30

**Applied 2026-09-30 ~11:25 UTC** in the dashboard, with the text below. In the same session,
`https://www.costfinders.ai/**` and `https://costfinders.ai/**` were added to Redirect URLs (Site URL
unchanged, `https://costfindersv2.vercel.app`). Verified the same hour:
- A recovery link requested with `curl`, so no browser held a code verifier, rendered as
  `https://costfindersv2.vercel.app/auth/callback?next=/auth/reset-password&token_hash=…&type=recovery`.
  Opened in a Chrome tab that never requested it, it landed on "Set new password", signed in as
  haris+user (`amr: otp`). No password was set.
- Magic links requested for `https://www.costfinders.ai/…` and `https://costfinders.ai/…` rendered on
  those origins, not Site URL, so the allowlist trap in cutover step 3 is already closed.
- Confirm signup was checked in the dashboard, where it matched exactly after a reload. It was not
  exercised end to end, because that needs a new signup. Open one on a second device after the
  cutover.

Before, both used `{{ .ConfirmationURL }}` and failed on a second device (item 5c of the
2026-09-16 pre-launch queue): the PKCE `?code=` cannot be exchanged without the code-verifier
cookie on the requesting device. A link that falls back to Site URL (a `redirect_to` not on the
allowlist, or a reset sent from the Supabase dashboard's Users page, which passes none) renders
malformed with these templates, exactly as Magic Link does.

The code side was already in place and verified 2026-09-16:

- `src/lib/auth/callbackParams.ts:16` — `OTP_TYPES` already allowlists `signup` and `recovery`
  alongside `magiclink`, and `callbackAttempts()` already tries `token_hash` BEFORE `code`.
- `src/lib/actions/auth.ts:102` passes
  `emailRedirectTo: ${getSiteOrigin()}/auth/callback?next=/dashboard` on signup, and `:224` passes
  `redirectTo: ${getSiteOrigin()}/auth/callback?next=/auth/reset-password` on reset. Both already
  carry a query string, which is why `&token_hash=` below is `&` and not `?`.
- `src/lib/actions/business-auth.ts:63,209` and `src/lib/actions/admin-auth.ts:157` pass their own
  `next` targets, so the owner and admin signup flows are fixed by the same one template.

**Confirm signup** → Authentication → Emails → Templates → Confirm signup:

```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your email:</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Confirm your email</a></p>
```

**Reset password** → Templates → Reset password:

```html
<h2>Reset your password</h2>

<p>Follow this link to choose a new password:</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
```

**Rollback for both** (the current text, i.e. the Supabase default):

```html
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

**Verify it on the device that did NOT request the link** — that is the entire point, and testing on
one device passes either way. Send the mail with `curl` so no browser and therefore no code verifier
can exist anywhere, then open the link in a browser:

```bash
set -a; . ./.env.local; set +a
RT=$(python3 -c "import urllib.parse;print(urllib.parse.quote('http://localhost:3000/auth/callback?next=/dashboard',safe=''))")
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/recover?redirect_to=$RT" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"haris+user@brandrap.com"}'
```

`redirect_to` is a **query parameter**; in the JSON body it is silently ignored and the link falls
back to Site URL, which looks exactly like a misconfigured allowlist. Read the `href` out of the
DOM rather than reconstructing it — the plaintext part mangles the token.

**The trap that will cost an hour.** If the origin in `redirect_to` is not on the Redirect URL
allowlist, GoTrue substitutes Site URL, which has NO query string. `{{ .RedirectTo }}&token_hash=…`
then renders `https://costfinders.ai&token_hash=…` — one malformed path segment with no `token_hash`
parameter at all, and nothing logged anywhere. Add the origin to the allowlist BEFORE changing the
template, exactly as step 3 of the cutover below says for Magic Link.

- The remaining templates (Invite, Change email) still use `{{ .ConfirmationURL }}`. `OTP_TYPES`
  already covers `invite`, `email_change` and `email`, so they convert the same way when a flow
  needs to survive a cross-device open. Neither is reachable in the product today.

## The two Vercel projects

There are two, both git-linked to `BrandRap-LLC/costfinders_v2` `main`, and confusing them costs
an afternoon.

| Project | ID | Holds | Status |
|---|---|---|---|
| **`costfinders_v2`** | `prj_IClRMlFvKrAW1yNaJRKGoqKPwX3y` | `costfindersv2.vercel.app` | **Production.** Every env change, deploy and verification targets this one |
| `costfinders` | `prj_BDygzYC8B6u5Np78h5pfCoYfQ7Ph` | `costfinders.ai` + `www` | **Frozen** 2026-09-16. Serves a March build. Never add env vars to it |

`costfinders` has 0 environment variables and failed a build on every push for 31 consecutive
pushes — only because of the missing vars. Adding them would have shipped HEAD onto
`costfinders.ai`, indexable, with no RESEND/BASE_URL/SITE_URL/CLAIM_NOTIFICATION_EMAIL.

It is frozen with an Ignored Build Step so a push stops rebuilding it:

```bash
vercel api '/v9/projects/prj_BDygzYC8B6u5Np78h5pfCoYfQ7Ph' \
  -X PATCH -f 'commandForIgnoringBuildStep=exit 0'
```

`exit 0` means *skip the build*. Verify with
`vercel api '/v6/deployments?projectId=prj_BDyg…&limit=1'` after a push — no new deployment
should appear, and `costfinders.ai` should still serve v1 unchanged. **This is step 0 of the
cutover below**, which moves the two domains onto `costfinders_v2`.

## Environment variables: never paste, always type

Three production values were stored with a trailing newline 175 days ago
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`). `next.config.ts` interpolated one into the CSP response
header; Node throws `ERR_INVALID_CHAR` on an embedded LF, so **every Node function invocation on
production returned a static `/500`** — auth callback, every Server Action, OG images,
`/api/health`, ISR revalidation — with no function log, while prerendered pages answered 200 and
lint, tsc, tests and the build all stayed green. The same newline was inlined into the client
bundle, where `apikey=…%0A` made the Realtime websocket 401.

The code trims now (`src/lib/env.ts`, `src/lib/siteUrl.ts`, `next.config.ts`, and
`tests/unit/envWhitespace.test.ts` fails if a configured response header ever carries a control
character). That is a seatbelt, not a licence.

Set values non-interactively and verify:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production --force --no-sensitive --value 'https://…'
vercel env pull --environment=production /tmp/x --yes && ! grep -nP '\\n"$' /tmp/x
```

`--no-sensitive` matters for the `NEXT_PUBLIC_*` pair: they are inlined into the client bundle
already, so marking them sensitive hides nothing and breaks the `env pull | grep` check above.
Use `printf '%s'`, never `echo`, if you pipe a value — `echo` appends the newline that caused all
of this.

## Nightly rebuild for newly ingested deals

`src/app/deals/[[...slugs]]/page.tsx` sets `dynamicParams = false` and enumerates the deal corpus
at **build** time, so an offer the ingestion pipeline lands after the last build is a hard 404
with `s-maxage=3600` while the homepage and every browse grid link to it. The pipeline landed
47/69/31/58 priced visible offers on four consecutive days with zero deploys in between.

A Vercel Deploy Hook on `costfinders_v2` (`nightly-rebuild`, branch `main`) is fired at 03:55
UTC, after the pipeline's ~02:42Z window, by the Vercel cron `/api/cron/rebuild`
(`src/app/api/cron/rebuild/route.ts`). Verified 2026-09-16, when a GitHub Actions job fired it:
the hook answered HTTP 201 and produced a production deployment tagged `hook=nightly-rebuild`.

**Owner step: the route needs two Vercel environment variables (Production).** `CRON_SECRET`
(see "Scheduled gates") and `VERCEL_DEPLOY_HOOK_URL`. The hook URL used to live in a GitHub
secret, and GitHub never shows a secret's value again, so copy it from Vercel: project
**costfinders_v2** → Settings → Git → Deploy Hooks → `nightly-rebuild`. Then Settings →
Environment Variables → Add New → `VERCEL_DEPLOY_HOOK_URL`, Production, and redeploy.

**Set on 2026-09-24.** A hook named `nightly-rebuild-for-new-deals` (branch `main`) was created
through the Vercel API and its URL stored as a sensitive Production variable through the CLI, never
displayed. The older `nightly-rebuild` hook from the GitHub Actions era still exists and can be
deleted; nothing reads it.

Without `CRON_SECRET` the route answers 503 and never calls the hook. Without the hook URL it logs
a warning naming the variable and answers 503. A hook that answers anything but 201 goes through
`logger.error` and the route answers 502, because a silent no-op here reads exactly like "no new
deals". To recreate the hook:

```bash
vercel api '/v9/projects/prj_IClRMlFvKrAW1yNaJRKGoqKPwX3y/deploy-hooks' \
  -X POST -f 'name=nightly-rebuild' -f 'ref=main'
# then set the returned url as the VERCEL_DEPLOY_HOOK_URL env var on costfinders_v2 (Production)
```

This is a timer, not a webhook: the pipeline is operated by someone else and cannot currently
call us. When that changes, have it hit the same hook on insert and delete the cron.

## Weekly cost guides (Railway cron)

`/guides/<treatment>-cost-<city>` pages are JSON files in `src/content/guides/`, and the route
only serves the files that exist. The database keeps adding cities that qualify for a guide (10+
visible offers from 3+ providers, `qualifyingGuidePairs()` in `src/lib/data/guide-stats.ts`), so
the files are generated on a schedule instead of written when someone notices: on 2026-09-25
Newport Beach, the largest city in the database, had qualified for five guides and had none.

**What runs.** Railway project `costfinders-guides`, service `guides`, built from this repo's
`railway/guides.Dockerfile` with the cron schedule `0 5 * * 1` (Mondays 05:00 UTC, after the
pipeline's nightly window and the 03:55 rebuild). The container runs `scripts/guides-cron.sh`:
clone `main`, `npm ci`, `npm run generate:guides`, commit the new files, `git push`. `npm ci`
installs the Husky hook, so the push runs the full `npm run gate` inside the container — a guide
that breaks a test or the build is refused, and the log names the step. Nothing new to add is a
clean exit with no commit. Railway skips a scheduled run if the previous one is still going.

The generator (`scripts/generate-guides.ts`) reads the live figures the page itself prints, asks
Perplexity for a research brief on the city, and has Claude (`claude-opus-5`) draft the prose in
the voice of the hand-written guides, with one existing guide of the same treatment as the style
reference. The prose deliberately states no exact live figure or count — the page prints those
and refreshes them daily — except the one local median the national comparison plots. Roughly
$0.30–0.50 per guide across both APIs, about 100 seconds each.

**Service variables** (Railway → `costfinders-guides` → `guides` → Variables):

| Variable | Source |
|---|---|
| `GITHUB_TOKEN` | A fine-grained personal access token: repository `BrandRap-LLC/costfinders_v2` only, permissions Contents **read and write** and Metadata read. **Set 2026-09-25 with a one-year expiry — renew before 2027-09-25** (GitHub → Settings → Developer settings → Fine-grained tokens). When it expires the job exits 1 at its first line and, once `ALERT_WEBHOOK_URL` is set, says so in Slack |
| `ANTHROPIC_API_KEY` | The same key as `.env.local` |
| `PERPLEXITY_API_KEY` | The same key as `.env.local`. Optional: without it the city context is drafted from the model's own knowledge and hedged |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The production values; the generator and the gate's live steps read them |
| `ALERT_WEBHOOK_URL` | Set 2026-09-26, same value as Vercel ("Error alerting"); the job's own success/failure messages are queued work (guides hardening plan, C4: Obsidian vault `Projects/CostFinders/Plans/guides-hardening.md`) |

Set them with the CLI from a shell that has `.env.local` loaded, so the values are never typed
or pasted: `railway variables --set "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"` and so on, after
`railway link` to the project and service.

**First run, 2026-09-26 04:51 UTC (schedule moved forward for the test, then restored):**
clone, `npm ci` (415 packages, 12 s), generator against the live database, "18 qualifying
pairs, 18 with a guide, 0 without", `nothing new to publish`, exit 0 — 22 seconds end to end.
The push-and-gate branch has not run yet; it runs the first time a new pair qualifies. Two
things the log shows that matter: npm 11 prints `install-scripts` warnings for `esbuild` and
`unrs-resolver` (their postinstall is skipped, and the generator still ran, so the platform
binaries are found without it), and a cron-schedule change on the service only takes effect
after a redeploy — the MCP `update-service` result says so, and the first attempt sat idle.

**Check it.** Railway → the service's deployments: each cron run is a deployment whose log ends
`guides-cron: published <slugs>` or `guides-cron: nothing new to publish`. A push lands as a
commit on `main` by `costfinders-guides` and Vercel builds it like any other. `git log --author
costfinders-guides` is the history.

**Run it by hand.** `npm run generate:guides -- --dry-run` lists the qualifying pairs with no
guide (the pre-push gate prints this on every push, never failing on it);
`npm run generate:guides` writes them; `--city <slug> --treatment <slug>` narrows to one and
`--force` overwrites. `--existing` regenerates guides that are already published even where
their market has since dropped under the 10-offer bar (the 3-clinic bar still applies). Every
run skips a pair the page would print no market figure for (`publishedGuideStats()`: a typical
for neurotoxins, 3 priced deals from 3 clinics otherwise). Review the JSON, then commit it like
any other change.

**Not in scope.** The weekly job never regenerates or removes an existing guide; 19 of the first
30 sat under the 10-offer bar on 2026-09-25 and stay live on purpose — the page hides its
stats blocks when the sample thins, and a hard 404 on an indexed URL throws away ranking over a
data dip.

**2026-09-28 refresh.** The 30 guides drafted on 2026-09-03 carried researched local averages
our data never backed (Irvine Botox said $14 where the live median was $10). 13 were
regenerated with `--existing`; the 17 whose market is too thin to regenerate (fewer than 3
priced deals, or one or two clinics) had their local figures and local price claims removed by
hand and now state that too few clinics publish a price. Each page's median, range and "typical"
follow `publishedGuideStats()`, so a thin page prints only "Starting at" and the counts.

## Domain cutover: costfinders.ai → this project

`costfinders.ai` serves v1 today; v2 lives at `costfindersv2.vercel.app`. **The order below is
load-bearing.** Two of the steps are things code cannot do, and step 4 is the one that is easy
to skip and impossible to notice.

1. **Attach both hostnames** in Vercel → Project → Domains: `costfinders.ai` *and*
   `www.costfinders.ai`. v1 redirects apex → www, so both must resolve.
2. **Make the two site URLs agree** on the new origin, in Vercel → Settings → Environment
   Variables, for Production:
   - `NEXT_PUBLIC_BASE_URL` — canonical tags, sitemap, `metadataBase`, and the indexing gate.
   - `NEXT_PUBLIC_SITE_URL` — where auth and transactional email links send people.
   They are read by different modules and have already drifted apart once. Both must name the
   same origin, including the same `www.`/apex choice.
3. **Add the origin to Supabase Auth → URL Configuration → Redirect URLs** (dashboard only,
   project `kdlpkjzcnbkjcvwsvlwn`). Miss this and Supabase silently falls back to its own Site
   URL, so password resets and magic links land on the wrong host — no error anywhere.

   **Since 2026-09-10 this step does more than misroute — it breaks magic links outright.**
   The Magic Link email template is now:

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Log In</a>
   ```

   That `&` assumes `{{ .RedirectTo }}` ends in a query string, which it does for every URL the
   app sends (all six `emailRedirectTo` values carry `?next=…`). But GoTrue's `GetReferrer()`
   falls back to **Site URL** when the requested `redirect_to` is not on the allowlist, and Site
   URL has no query string — so the emailed href becomes
   `https://www.costfinders.ai&token_hash=…`, a single malformed path segment with no
   `token_hash` parameter at all. The user gets "We couldn't finish signing you in" and nothing
   is logged anywhere. Add the new origin to the allowlist BEFORE anyone requests a link on it.
4. **Redeploy.** `NEXT_PUBLIC_*` is inlined at build time and `next.config.ts`'s `headers()` is
   build-time config, so nothing in steps 2–3 reaches the running site until a new build ships.
   Changing the variables alone leaves the site `noindex` with the old canonicals.
5. **Verify the indexing gate flipped**, before telling any search engine the site exists:

   ```
   curl -sI https://www.costfinders.ai/ | grep -i x-robots-tag   # must print NOTHING
   curl -s  https://www.costfinders.ai/robots.txt                # must say Allow: /
   ```

   `isCanonicalDeployment()` (`src/lib/seo/metadata.ts`) is what both of those depend on, and it
   compares the deployed host against the canonical one with `www.` stripped from both sides —
   Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` to the *shortest* production custom domain, so it
   will name the apex while `NEXT_PUBLIC_BASE_URL` names www.
   `tests/unit/canonicalDeployment.test.ts` holds that comparison; if it ever fails, expect the
   site to launch permanently noindex.
6. **Only then submit the sitemap** in Search Console: `https://www.costfinders.ai/sitemap.xml`.
   Submitting before step 5 gets the whole site crawled while it still says `Disallow: /`.

### While you are there

- **v1 URLs**: measured 2026-09-30 against v1's live sitemap (118 URLs), 16 are live v2 pages,
  `next.config.ts` redirects 46, and 56 are left to 404 deliberately: v1's fake demo providers,
  its `/deals/deal-N` placeholders, `/deals/…` listings for cities v2 has no deals in, and the
  New York neighbourhoods. Pointing those at the homepage would be a soft 404. Austin's
  neighbourhoods go to `/texas/austin`; Dallas, Houston and Miami city pages go to their state
  hub (owner decision). `tests/unit/redirectMap.test.ts` asserts no rule loops or shadows a
  live page.
- **Uptime**: tell the owner the site is on www, so they can repoint their external monitor at
  `https://www.costfinders.ai/api/health` (handled outside this project).
- **Resend webhooks**: resend.com/webhooks → edit each endpoint to the www origin. Do this
  BEFORE turning on Vercel deployment protection. A protection mode that exempts only custom
  domains puts the vercel.app address behind a Vercel login, and every webhook delivery to it
  then fails.

**Also at cutover (added 2026-09-26, inbound added 2026-09-30):** Resend → Webhooks → the bounce
webhook (`991f92a5-…`, endpoint `costfindersv2.vercel.app/api/webhooks/resend`) → change the
endpoint to `https://www.costfinders.ai/api/webhooks/resend`, and the inbound webhook
(`a701c882-…`, `…/api/webhooks/resend-inbound`) → `https://www.costfinders.ai/api/webhooks/resend-inbound`.
The signing secrets do not change, so no Vercel edit is needed. Until this is done, bounces keep posting to the `.vercel.app` URL,
which still serves the route, so nothing is lost — but the `.vercel.app` host is the one the
cutover makes non-canonical, and a later cleanup that removes it would silently drop bounces.

## Account deletion requests

A customer can delete their own account from **Settings → Delete my account** (`/dashboard/settings`) once
`20260924040003_delete_own_account.sql` is applied (`delete_own_account()`). Point people there
first. This section is for a request that arrives by email instead.

1. **Verify the requester owns the account.** Never act on the address in the From line alone.
   Reply to the address on file for the account (find it on `/admin/dashboard/users` by
   searching the email) and ask them to confirm. Only continue once the confirmation comes back
   from that same address.
2. **Look up the account** in the Supabase SQL editor (runs as `postgres`). Expect exactly one
   row, and `is_admin` false. An admin account is never deleted this way: stop and ask the owner.

   ```sql
   select u.id, u.email, u.created_at,
          exists (select 1 from public.admin_profiles a where a.id = u.id) as is_admin,
          (select count(*) from public.claims c where c.consumer_id = u.id) as claims,
          (select count(*) from public.messages m where m.sender_id = u.id) as messages
     from auth.users u
    where lower(u.email) = lower('<address>');
   ```

3. **Delete it**, in one transaction. The first two deletes are only needed while
   `20260924040003` is not applied: until then `conversations` and `messages` reference
   `auth.users` without `ON DELETE CASCADE`, and the final delete fails with `23503`. Everything
   else (profile, claims, saved deals, notifications, a business owner's `business_profiles`
   row) cascades.

   ```sql
   begin;
   delete from public.messages where sender_id = '<user id>';
   delete from public.conversations
    where consumer_id = '<user id>' or business_owner_id = '<user id>';
   delete from auth.refresh_tokens where user_id = '<user id>';
   delete from auth.users where id = '<user id>';
   -- Must return 0 before you commit.
   select count(*) from auth.users where id = '<user id>';
   insert into public.admin_audit_log (admin_id, admin_email, action, target_type, target_id, details)
   values ('<your admin user id>', '<your admin email>', 'account_deleted', 'user', '<user id>',
           '{"requested_by": "email"}');
   commit;
   ```

4. **Reply to the customer** that the account and its claims are deleted. Their earlier claims
   were passed to clinics by hand; the clinic's own records are outside CostFinders and are not
   touched by this.

The audit row makes the deletion show under **Users** on `/admin/dashboard/data`.

## Admin lead queue: daily routine

Every customer claim lands on `/admin/dashboard/leads` and is emailed to the claim inbox
(`CLAIM_NOTIFICATION_EMAIL`). The admin home page leads with the number waiting and how many
expire within 48 hours. A claim leaves the queue seven days after it is filed unless it is
relayed or extended. The customer keeps the clinic's details either way.

- **Relay:** contact the clinic (phone first), then **Mark relayed** and record the channel,
  what happened, and a short note. Tick **Tell the customer we passed this on** to email them
  the clinic's phone and website. The box is disabled for "No answer" and "Clinic declined",
  because the email says the request was passed on. If the clinic has an approved owner
  account, that owner also gets a "New lead" email when you save the relay.
- **Wrong contact details:** fix them on `/admin/dashboard/businesses` → **Edit contact**. This
  writes the live directory (migration `20260924020002`) and sets `phone_source = 'admin'`. The
  data pipeline may overwrite it on its next import, so tell the data team.
- **Not reachable yet:** **Extend 7 days** gives the lead 7 more days before it expires from
  the queue. It also works on an expired claim from the Closed list, unless the customer has
  since claimed the same deal again (then work the newer claim).
- **Should not be relayed** (duplicate, test, customer asked to stop): **Close without
  relaying** with a reason. **Reopen** from the Closed list undoes it.
- **Recorded a relay by mistake:** **Undo** on the relayed row puts the claim back in the queue
  and clears its outcome and note.

Cancelled claims, expired claims and claims a clinic owner already handled leave the queue on
their own and appear under **Closed** with the reason. Every action is written to the activity
log (`/admin/dashboard/data` → Lead relay).
