# Runbook — operating ReachKit alone

Only what the code cannot show: vendor dashboard settings, where each secret lives, the box's tools
and how to put them back, and the deploy, rollback and restore commands. How work flows is
`docs/PROCESS.md`. What the product does is `docs/SPEC.md`. Nothing here is read by the running app.

---

## 1. Landing a change

A change reaches `main` through the four gates (`typecheck · lint · unit`, `audit`, `schema · RLS`,
`no overflow · axe`) and GitHub auto-merge (`docs/PROCESS.md` rule 4). This page starts after the
merge.

**The box's own checks.** `scripts/hygiene.mjs` is part of `audit`. The nightly drift-audit run, and
`rk-hygiene.timer` at 05:30 UTC, open one `[hygiene]` issue when it is red and comment while it stays
red. The timer runs `/root/ops/reachkit/bin/hygiene.sh`, which runs that script with `--box`; its log
is `/root/ops/reachkit/log/hygiene.log`. `rk-guard` (`/root/ops/reachkit/bin/resource-guard.sh`)
reports low memory, swap, load, leaked processes and heavy work in the main checkout. `node
scripts/box.mjs` (`npm run box`) reports worktrees and leftovers by hand; `--clean` never removes a
worktree.

**Deploys.** `rk-deployer` (`/root/ops/reachkit/bin/deployer.sh`) deploys every SHA of `main` to dev,
runs `scripts/smoke.sh --free` against it, and takes a SHA to production only once that check reads
`pass` (`state/dev-check.<sha>`), with no batching (owner 2026-10-31, `PROD_EVERY_S=0`). Once
production is Ready it `PUT`s `https://reachkit.app/api/jobs` to sync Inngest and runs the same check
against production (`state/prod-check.last`). A red check files or comments on one
`[deploy] production check red` issue. The box's changes to these scripts are the patches in
`docs/ops/` (with dry cases `deployer-dry.sh` and `redeploy-dry.sh`); to recreate a script, apply them
in date order.

| Command | Does |
|---|---|
| `bash /root/ops/reachkit/bin/deploy-dev-once.sh` | deploys the tip of `main` to dev, when dev has not moved after a merge |
| `bash /root/ops/reachkit/bin/redeploy.sh --reason "<why>"` | deploys main's head to production by hand; refuses (exit 3) while `state/deploy-prod.inflight` is under 30 min old |

Every production deploy is one line in `/root/ops/reachkit/state/prod-redeploy.log`: UTC time,
target, SHA, deployment id, trigger and reason. `state/deploy-prod.sha` is the last Ready production
SHA. `/api/jobs` is served by production, so a job change takes effect only once production is
deployed. Vercel's own status on a commit is not a check: Git deployments are off (`vercel.json`
`git.deploymentEnabled: false`).

### Rolling back a deploy: we do not

**Roll forward only** (SPEC §2 Roll forward only). A bad production build is fixed by a revert commit on `main`,
deployed like any other change. A stored report lifts forward only (`src/lib/scan/report.ts`), so an
older build put back on `reachkit.app` fails on every report a newer build wrote.

No script on the box takes a SHA, a ref or a deployment id, so none can put an older build on
production. Vercel can (the dashboard's promote control, `vercel rollback`, `vercel promote`), and
that door stays shut by decision, not by a guard. A build that fails is never aliased, so a failed
deploy is not a rollback.

**When production is broken:** `KILL_SWITCH` (§5) first if it is spending or writing wrongly, then a
revert on `main`, then a deploy. Reverting code does not revert what a build already stored; that is
§9.

### Where CI runs

The repository is public (owner, 2026-10-22), so every job runs on GitHub-hosted `ubuntu-latest`.
The box runners are deregistered from the repository, and no variable chooses a runner. A pull
request from a fork waits for approval, and the default token is read-only. `Nightly`
(`.github/workflows/layout-nightly.yml`) runs every job on `main` at 02:41 UTC and opens or comments
on one `[nightly] full run on main is red` issue.

Never register a self-hosted runner on this repository while it is public.
`gh api repos/tim-clifford6991/reachkit/actions/runners` must read `total_count: 0`.

---

## 2. Environments

| | |
|---|---|
| Rule | one Vercel project, one Supabase project, one set of bindings (owner, 2026-09-08) — no duplicate projects, environments or databases |
| Vercel | team `timclifford` (`team_lFEcKlyuKD5risdEnak7iRIm`), **Pro plan** since 2026-11-07 (#2477); project **`reachkit`** (`prj_QJUivDYYshplvV0enuc2oZNIjcnd`), production branch `main`, Node 24, Next.js preset, no root directory. Spend Management (team, Settings, Billing) is the owner's: notify at the amount and do not auto-pause, because a pause is a 402 outage |
| Production | `reachkit.app` (and `www.`) |
| Development host | `dev.reachkit.app` — the same project, bound to `main`, and the same database. It is where the owner steers; it is not a separate environment |
| Preview | none; Git deployments are off |
| Database | one Supabase project, `reachkit` (`kleepxxddbcnfsfwudoe`), Postgres 17, us-east-1, **Free plan**. v2's objects sit in schema `v2_archive`, the rollback path (§9). The org is Vercel-Marketplace-managed: uninstalling that integration would delete the org and the database; the exit path is a transfer to a Supabase-managed org. Free pauses a project after seven idle days; unpause is a button in the Supabase dashboard |
| Jobs | Inngest app `reachkit`, registered at `https://reachkit.app/api/jobs` |
| Mail | Resend, sending domain `reachkit.app`; `MAIL_FROM` is `hello@reachkit.app` (§6) |
| Payments | Stripe: one product `ReachKit`, one €49/month tax-inclusive price bound as `STRIPE_PRICE_ID`, Stripe Tax off; webhook `/api/stripe/webhook`; customer portal on. Production's three Stripe bindings are live-mode values; the preview target, which `dev.reachkit.app` answers on, carries the test-mode trio and its own test webhook |
| Hosted CMS | customers point `content.{their-domain}` at `HOSTED_EDGE_CNAME_TARGET` (`edge.reachkit.app`); per-customer domains are added through the Vercel Domains API. The dogfood's hosted host is `content.reachkit.app` (owner, #1045), attached only through the product's own Check, never by hand |
| Local | `npm run dev` on `http://localhost:3000`, bindings from `.env.local` (names in `.env.example`) |

### Stripe dashboard

Each setting is the owner's, in live and in test mode separately unless it says otherwise.

- **Developers → Webhooks:** the endpoint `{app origin}/api/stripe/webhook` subscribes to exactly the
  events in `src/lib/account/provisioning/events.ts` (any other answers `400`); its signing secret is
  `STRIPE_WEBHOOK_SECRET`.
- **The price:** `unit_amount 4900` · `eur` · `month` · `tax_behavior inclusive`, the four fields
  `scripts/check-price.mjs` compares on every build. They are immutable on a Stripe price: a wrong
  one is fixed with a new price, never an edit.
- **The three Stripe bindings move together.** `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and
  `STRIPE_WEBHOOK_SECRET` are replaced as one, on both targets, then redeployed. A live key with a
  test price fails the build; a crossed webhook secret is silent until a payment's webhook answers
  `400` with `{"event":"stripe_webhook","outcome":"signature"}`, and the account opens a day late
  from the provisioning backstop.
- **Settings → Business → Branding:** icon `public/brand/mark-512.png`, logo
  `public/brand/logo@2x.png`, brand and accent colour `#5b4be0`. **Public details:** business name
  `ReachKit`, and Terms of service `https://reachkit.app/terms`. Checkout sends no terms tick
  (`consent_collection`), by owner ruling 2026-11-06/2026-11-07.
- **Settings → Customer emails:** whether Stripe mails the paying customer an invoice and receipt.
  Stripe sends none in test mode, and ReachKit sends no receipt of its own. The API cannot read it.
- **The customer portal** configures itself from `PORTAL_FEATURES` on first use; do not edit it in
  the dashboard.
- Two v2 prices are still `active` on archived products ("Solo Monthly €59", "Growth Monthly €129").
  Nothing binds them; deactivating them is a dashboard act.

### The first live payment

One payment on a real card, watching the production runtime log, in order:

1. `{"event":"stripe_webhook","outcome":"provision","type":"checkout.session.completed"}`.
   `"outcome":"signature"` instead means the webhook secret is crossed.
2. `{"event":"provision","outcome":"created"}`.
3. The `users` row: the paying address, `stripe_customer_id`, `checkout_session_id`, and a
   `paid_through` about a month out. One still on the column's default means the subscription could
   not be read: look for `{"event":"billing_open_subscription","outcome":"vendor"}`.
4. The sign-in mail, in a real inbox.
5. `{"event":"provisioning_backstop_fired"}` **must not appear**: it means the payment was rescued a
   day late.

ReachKit refunds nothing by itself (owner, 2026-11-06, #2448). A refund made by hand is three
dashboard acts, in `docs/walk/refund.md`.

---

## 3. The bindings

`src/lib/config/env.ts` is the schema: a missing or malformed binding is a boot failure, and
`.env.example` lists every name with a blank value. The owner pastes every value in the Vercel
dashboard, on **both** the production and the preview target; a target missing one cannot build.
Sensitive rows are write-only. Agents never see a value.

| Where it lives | Names |
|---|---|
| Vercel, both targets | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `MAIL_FROM`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `ANTHROPIC_API_KEY`, `NANO_API_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `IP_HASH_SALT`, `KILL_SWITCH`, `OWNER_EMAILS`, `NEXT_PUBLIC_APP_URL`, `HOSTED_EDGE_CNAME_TARGET`, `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `POSTHOG_API_KEY`, `POSTHOG_HOST`, `ANTHROPIC_ADMIN_KEY` (optional) |
| Vercel, dev and preview only | `HOSTED_TEST_HOST` (ignored on production) |
| The owner's shell only, never Vercel | `DATABASE_URL` (Supabase → Project Settings → Database) |
| Nowhere | `RK_FIXED_NOW`, a test fixture; a real deployment refuses to boot with it |
| The box, `/root/projects/reachkit/.env.local` | the keys box scripts read (`scripts/vendor-snapshot.mjs`, `npm run costs`); its `SUPABASE_*` are placeholders |

`VERCEL_API_TOKEN` must be scoped to the team `timclifford`; a token of another scope is answered 403
even with `VERCEL_TEAM_ID` set. `IP_HASH_SALT` is a fresh random value per environment.

### Rotating a secret

1. **Mint the new value at the vendor** (Stripe → API keys, Supabase → project API keys, Resend →
   API keys, DataForSEO → API access, Anthropic → API keys, Inngest → the app's keys). Where the
   vendor allows two live keys, create the new one before revoking the old.
2. **Paste it into Vercel** on **both** targets.
3. **Redeploy.** A binding is read once, at module load.
4. **Watch the boot:** one `{"event":"boot_invariants","check":"…","outcome":"checked"}` line per
   check; a failure names the binding (§7).
5. **Exercise the vendor once.** Stripe: open the customer portal from `/app/settings`. Resend: the
   vendor's dashboard shows the send. Supabase: any signed-in page. DataForSEO and Anthropic: one
   free scan.
6. **Revoke the old value at the vendor**, and only then. A wrong `SUPABASE_SERVICE_ROLE_KEY` takes
   the whole product down, and changing `IP_HASH_SALT` resets every free-scan rate limit at once.

---

## 4. The jobs

Ten, closed. The registry is `src/jobs/index.ts` and it is a frozen array — a definition that is
not in it is unreachable over HTTP. `src/jobs/client.ts` is the only file that names the platform.

| Job | Trigger | Does | In the kill switch |
|---|---|---|---|
| `scan/run` | event `scan/run` | the one pipeline; tier is a parameter | ● |
| `draft/generate` | cron `3 * * * *` | next opportunity → pipeline → `in_review`, veto clock starts, daily mail. The tick is hourly; a site's page for a date is written in the hour whose start plus its veto window is at, or less than an hour before, that date's publish time in the site's zone (#1337). The tick sends each due site as `draft/generate/subject`, keyed `draft:{site}:{date}`, to its own run (`draft-generate-subject`): one per site, five at once, ten starts a minute; steps `notice`, `select`, `write`, `review`. A day owed with nothing recorded in `draft_days` is sent on the next tick while its window is open | ● |
| `publish/execute` | event `publish/execute` | state machine → destination | ● |
| `publish/verify` | event `publish/verify`, +24h | liveness checks on a published page | |
| `publish/retry` | cron `0 * * * *` | claims failed pages whose retry moment has come round | ● |
| `weekly/refresh` | cron `41 * * * *` | weekly scan per active site, gated on that site's local Monday. The tick's step is `due`; each due site is sent as `weekly/refresh/subject`, keyed `weekly:{site}:{week}`, to its own run; an hour with no site due enters no step, (`weekly-refresh-subject`, bounded as the draft one), whose steps are `measure-…`, up to three `late-answers-…` (free reads of queued answers, #1160), `search-…` and `tell-…` | (stopped inside the run, not by the runner) |
| `lead/nurture` | cron `26 * * * *` | advances sequences over `next_touch_at` | |
| `account/maintenance` | cron `*/15 * * * *` | five due-work queries: a payment awaiting sign-in, a payment with no account, a hosting-end notice, a hosting stop, an account due for purge | |
| `scan/rescore` | cron `7 * * * *` (hourly) | answers the oldest `rescore_runs` request: every stored scan and rival set scored again, dry or applied (issue 1433, "Re-scoring every stored scan" below). Steps: `claim`, then `answer-<id>`; `skipped` / `no-subject`, with no step entered, when a read-only check finds nothing asked or due | |
| `scan/finish-reads` | event `scan/finish-reads` | sent by a free pass that stored a report with searches it chose and did not read (issue 1440): reads only those, once, inside the free cap the pass already spent from, and rewrites the report through `rescore_scan`. Step: `finish`; `degraded` where a search failed again, `skipped` / `no-subject` where the report has nothing left to finish. Log line `finish_reads` | ● |

Five ids are sendable events (`src/jobs/types.ts`, `JobEvent`): `scan/run`,
`publish/execute`, `publish/verify`, `lead/nurture`, `scan/finish-reads`. The five clock-triggered jobs have no event;
two of them send `…/subject` events to their own per-site runs, so twelve functions are synced.
Every mail carries `Idempotency-Key: {kind}:{digest of the mail}:{UTC day}`, so a retried send,
or the same ops alert from a later tick that day, is one mail.

### Running one by hand

**There is no endpoint, no script and no npm task that triggers a job.** `/api/jobs` accepts
`GET`, `POST` and `PUT`, but a `POST` is signature-verified by the SDK against
`INNGEST_SIGNING_KEY`, so it cannot be called by hand. The product itself sends exactly two
events: `scan/run` when a setup completes (`src/app/(account)/setup/_setup/store.ts`),
`publish/verify` after a publication (`src/jobs/engine.ts`), and `scan/finish-reads` after a free
pass that left searches unread (`src/lib/scan/run.ts`).

So the way to run one by hand is **the Inngest dashboard**, on the `reachkit` app:

- **A cron job** (`draft/generate`, `publish/retry`, `weekly/refresh`, `account/maintenance`, `scan/rescore`):
  find the function and use *Invoke*. A tick takes no data. Each of these is due-gated, so an
  out-of-hours invocation is expected to return `skipped` with reason `not-due` or `no-subject` —
  that is the job working, not failing.
- **An event job**: send the event with its payload, or *Replay* a past run. The payload keys are
  the job's `idempotencyKey` in `src/jobs/*.ts` — `scan/run` takes `scanId`, `publish/execute`
  takes `draftId` and `destinationId`, `publish/verify` takes `publicationId`, `scan/finish-reads`
  takes `scanId`. A delivery is
  deduplicated on those keys, so re-sending the same one is a no-op rather than a second run.
- **`publish/verify` sleeps 24 hours** before its body, by design. Invoking it is not a way to
  check a page now.

**Nothing ticks until the Inngest app is registered.** As of 2026-09-09 the owner still owes:
create the app, paste `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` on both Vercel targets, and
sync the functions from `https://reachkit.app/api/jobs` (#315). Until then the crons do not run
and the only sign is their absence.

### Reading what a job did

Every invocation writes exactly one structured line to the deployment's runtime log, and never
more: `{"event":"job","jobId":…,"subjectId":…,"outcome":…,"durationMs":…}`, plus `step` on a
degraded outcome. No payload, no vendor response, no error text — the allow-list is
`src/jobs/observability.ts` and a fifth field fails a test.

`outcome` is one of:

| Value | Means |
|---|---|
| `ran` | it did its work |
| `skipped` | nothing to do — `reason` is `not-due` (a tick outside this subject's hour) or `no-subject` (the due-work query was empty) |
| `stopped` | the kill switch refused it before any spend and any write; `by: "kill-switch"` |
| `degraded` | it exceeded its own budget and stopped; `step` names which step |
| `failed` | the body threw. The line says so and says nothing about what was thrown |

Routes log the same way: `{"event":"request","routeId":…,"status":…,"durationMs":…}` and, where
one exists, `scanId` (`src/app/api/_log.ts`). Vercel's runtime logs are the only place these go —
there is no log sink, no APM and no error tracker.

### Is it firing?

The heartbeat (#799) answers this without the Inngest dashboard or a Vercel log query. Every
invocation of every job — cron or event, whatever its outcome — upserts that job's one row in
`job_runs`: `last_run_at` and `last_outcome` (`ran`, `skipped`, `stopped`, `degraded`, `failed`).
Read it in the Supabase SQL editor on the target's project:

```sql
select job_id, last_run_at, last_outcome, stale_alerted_at, now() - last_run_at as quiet_for
from job_runs order by last_run_at;
```

| What you see | Means |
|---|---|
| every cron job within its interval (`account/maintenance` 15 min, the other five 60 min) | the crons fire; `skipped` is a tick with nothing due, not a fault |
| one job far behind the others | that function stopped — check it is synced on the `reachkit` app in Inngest |
| every row old, or the table empty | nothing is firing: the app is not registered or synced, or `/api/jobs` is not answering (*Running one by hand*, #315) |
| a job with no row at all | it has never run against this database — an event job nobody has sent yet, or a cron that never fired |

**The stale-job alert.** After recording its own run, each invocation reads the other rows. A
scheduled job whose `last_run_at` is more than **twice its interval** ago is mailed to
`OWNER_EMAILS` through the incident mail (§6): *"A scheduled job has not run for more than
twice its usual interval."* with the job, its last run and its interval. `stale_alerted_at` records
that mail; the job is not mailed again until it has run and gone quiet again.

**The failing-job mail.** A job that throws on its first delivery is mailed to `OWNER_EMAILS` at
most once per job, error class and Europe/Berlin day. The row in `job_error_mails` decides that, not
the mail vendor's key. A send that no owner address accepted deletes its row, so the next tick tries
again. A store that cannot answer still mails and logs
`{"event":"ops_incident_alert","outcome":"claim_unavailable"}`.

**The outside check.** The heartbeat cannot see *every* job stopping, so `GET /api/health`
reads the same rows on each request: `200 {"ok":true}` when every scheduled job with a row is within
twice its interval, `503` with `stale` (the job ids, mailed or not) or `reason` (`no-runs`,
`read-failed`) otherwise. It needs no session, is never cached, and writes nothing. It judges the
cron list in `src/jobs/schedule.ts`, which `tests/jobs/schedule.test.ts` holds equal to the registry.

**The box's clock.** `rk-deadman.timer` runs `scripts/deadman.mjs` every 2 minutes from the box,
which Vercel does not host, so it still runs when every deployment answers 402 (2026-11-07). It
sends a `GET` with a 10 s timeout and redirects not followed to `https://reachkit.app/`,
`https://reachkit.app/api/health` and `https://dev.reachkit.app/api/health`. Only a 2xx is up;
a 307, a 402, a 503, a timeout or a DNS or TLS failure is down. State is
`/root/ops/reachkit/state/deadman.json` (`RK_DEADMAN_STATE` elsewhere), and each run appends one
line to `/root/ops/reachkit/log/deadman.log`: each target's status or error class, and the outcome
(`up`, `down`, `mailed`, `mail-failed`). It reads only `RESEND_API_KEY`, `MAIL_FROM` and
`OWNER_EMAILS`, writes nothing to production and triggers no job. The mails, to every
`OWNER_EMAILS` address through Resend:

| Subject | Means |
|---|---|
| *ReachKit is down: n of 3 checks failing* | a target missed two probes in a row, about 4 minutes. Each target's status says which: 402 is the Vercel account, 503 with stale jobs is the jobs, a timeout or `ENOTFOUND` is the network or DNS |
| *ReachKit is still down* | the same outage, 6 hours on; one every 6 hours while it lasts |
| *ReachKit is back up* | the first 2xx after a mailed outage, with how long it lasted |
| *ReachKit deadman: test* | `node scripts/deadman.mjs --env-file /root/projects/reachkit/.env.local --test-mail`, run by hand; it probes nothing and writes no state |

When Resend does not accept a mail, the run opens one issue titled `[down] reachkit.app` with
`gh`, or comments on the open one, and GitHub's own notification carries the alert. One failed
probe followed by a 2xx sends nothing. UptimeRobot, if the owner keeps it, is the second clock,
for when the box itself is down: it polls `/api/health` every 5 minutes, must not follow
redirects, and alerts the same inbox.

To recreate the timer, as root, write these two units, then run
`systemctl daemon-reload && systemctl enable --now rk-deadman.timer`:

```ini
# /etc/systemd/system/rk-deadman.service
[Unit]
Description=ReachKit ops - the product answers 2xx, probed from outside Vercel
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=root
WorkingDirectory=/root/projects/reachkit
Environment=HOME=/root
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node /root/projects/reachkit/scripts/deadman.mjs --env-file /root/projects/reachkit/.env.local
StandardOutput=append:/root/ops/reachkit/log/deadman.log
StandardError=append:/root/ops/reachkit/log/deadman.log

# /etc/systemd/system/rk-deadman.timer
[Unit]
Description=ReachKit ops - probe the product every 2 minutes
[Timer]
OnCalendar=*:0/2
Persistent=true
AccuracySec=10s
[Install]
WantedBy=timers.target
```

`systemctl list-timers rk-deadman.timer` shows the next run. Remove it with
`systemctl disable --now rk-deadman.timer` and delete the two files.

Inside the product the alert is carried by the jobs themselves. One job stopping is caught by the
others (the 15-minute maintenance tick watches the hourly four, and they watch it). Every job
stopping is caught by the box's clock: `/api/health` answers 503 with `reason` `no-runs` or the
stale ids, and the deadman mails it. The heartbeat is installed only where `/api/jobs` mounts
the registry; a failed write logs `{"event":"job_heartbeat","outcome":"record-failed"}` and never
fails the job.

### Which job spent the CPU

Vercel reports Active CPU for `/api/jobs` as one figure, and every step is its own invocation of
that route. `job_days` splits it: one row per job, UTC day and site, with `invocations`, `cpu_ms`
and `wall_ms`, added by one atomic `job_days_add` per invocation. A per-site run counts under its
job with its `site_id`; a tick's own invocations have `site_id` null.

`cpu_ms` is the process's CPU over the invocation. Under Fluid compute, invocations that overlap on
one instance each see the others' CPU, so the figure is an upper bound; read it beside `wall_ms`.
A day with no row was not measured, which is not the same as 0. Rows older than 35 days are
deleted by `account/maintenance`. A failed write logs `{"event":"job_days","outcome":"record-failed"}`
and never changes the job's answer.

Per job and day, the costliest first:

```sql
select job_id, day, sum(invocations), sum(cpu_ms), sum(wall_ms)
from job_days group by 1, 2 order by 4 desc;
```

Per site, yesterday:

```sql
select site_id, job_id, invocations, cpu_ms, wall_ms
from job_days where day = current_date - 1 and site_id is not null order by cpu_ms desc;
```

### Why a site had no page on a date

`job_runs` keeps one row per job, so an hourly `skipped` overwrites the due hour that wrote nothing,
and Vercel Pro keeps one day of runtime logs. The draft tick also keeps one row per site and
date in `draft_days` (issue 1455): how that date's due hour ended (`drafted`, `no_page`, `failed`)
and why (`reason`, the engine's step such as `generate:no_opportunity`, or the error's class name):

```sql
select s.domain, d.publish_date, d.outcome, d.reason, d.decided_at, d.missing_alerted_at
from draft_days d join sites s on s.id = d.site_id
order by d.publish_date desc limit 30;
```

In the first due hour that starts at or after a paying, publishing site's publish time, a date with
neither a page delivered nor one the customer stopped is mailed to `OWNER_EMAILS` once, whether or
not a later page is going out (*"A site's publish time passed with no page for the day."*), with that
row's reason, and `missing_alerted_at` records it. A row with only `missing_alerted_at` set is a date
whose due hour never ran for that site, for example a tick that did not fire or a site not selected
then. `no_page` with `generate:no_opportunity` and open, ready rows on file means the ranking left
nothing for the day: read `opportunities` for the site and SPEC §7's *The cap never empties a day*.

The check after a tick (issue 1477) is each site's latest decided date, with how many open, ready
topics it held:

```sql
select distinct on (s.domain) s.domain, d.publish_date, d.outcome, d.reason,
  (select count(*) from opportunities o where o.site_id = s.id and o.status = 'open' and o.ready) as ready_open
from draft_days d join sites s on s.id = d.site_id
where d.outcome is not null
order by s.domain, d.publish_date desc;
```

A latest row that is not `drafted` while `ready_open` is above 0 means the run ended its day with a
topic still writable. Read the site's drafts for that date: each topic the run tried has a row with
its reason (`step_failed:pack:…` names what its pack lacked).

### Verifying a WordPress destination end to end

The walk, in order, with the observation each step should produce. It has not been run against a
real WordPress — when it is, §11 records it. The site must be **publicly addressed, over https, on
port 80 or 443**: the egress policy refuses loopback, private, link-local, multicast and reserved
addresses and every other port (`src/lib/egress/policy.ts`), so a laptop install or a tunnel on
`:8080` cannot be the site, and WordPress itself offers Application Passwords only over https. The
credential is sealed with a key derived from `IP_HASH_SALT` (§3), so that binding must exist in
whichever environment is walked.

1. **Connect.** `/app/settings` → Publishing → the WordPress row → **Connect WordPress**. Three
   fields: Site URL, Username, Application password — the last made in wp-admin under Users →
   Profile → Application Passwords. The Site URL is the site root, not the REST root; `/wp-json` is
   appended at every call. Expect the form to close and the row to read **ok** with no line under
   it. Underneath: the credential is sealed, then validated by the health check — one authenticated
   `GET {site}/wp-json` — and never by the act of connecting, so a refusal leaves the row reading
   *expired* or *error* with that reason's own written line and no vendor text, and the password
   field clears on both arms.
2. **The two probe results**, which is what this step exists to record. They are written beside
   health and never inside it: `destinations.publish_capable` from `capabilities.publish_posts`, and
   `destinations.stamp_capable` from `capabilities.manage_categories`, both read from one
   `GET /wp-json/wp/v2/users/me?context=edit`. A Contributor-level password is the case that makes
   the first `false`; the card then reads *error* and offers **Connect a different account**, never
   Reconnect, because re-entering a valid credential that cannot publish changes nothing.
3. **One page, delivered live.** Publication is a job (`publish/execute`, above) — no endpoint and
   no script — so either let a draft reach the end of its veto window or *Invoke* it from the
   Inngest dashboard with `draftId` and `destinationId`. Expect one post at status `publish`, and on
   the publication row the permalink **the site returned**, never one computed here. Expect the
   title and description in `_yoast_wpseo_title` / `_yoast_wpseo_metadesc` or `rank_math_title` /
   `rank_math_description`, for whichever plugin the REST index announced (`yoast/v1`,
   `rankmath/v1`) — read back from the create response, so a site that dropped the meta records
   *no SEO plugin was found* instead of a claim. Expect **both marks**: the `reachkit` tag, which
   the customer sees, and `<!-- reachkit-draft:{draftId} -->` at the foot of the post body, which
   only ReachKit reads. Re-run the same delivery: it must find that post by the comment and create
   nothing, and it must never search for the tag.
4. **Unpublish, once.** `/app/settings` → Danger zone → **unpublish all**, confirmed by typing
   `unpublish all`. A post ReachKit made live is returned to draft by one write of one field and
   stays in the site; the record reads *returned to draft in your WordPress*. The other three arms
   are *already gone from your site*, *your site couldn't be reached — the post may still be live*
   (the stop is taken all the same), and *never live there — yours to remove*.
5. **Revoke the password** in wp-admin, and watch a state rather than an error. Nothing re-reads
   health on the publish path: the card turns on the next check, which is the read path's own once
   the stored one is older than `DESTINATION_HEALTH_MAX_AGE_H` (24 h, debounced 60 s per process),
   or immediately on the next connect attempt. Expect **expired**, the line *The connection has
   expired. Your pages are being held — nothing is lost — and reconnecting releases them.*, and
   **Reconnect** offered — not an error page. A destination broken for 24 h whose customer has not
   been back since mails them once, from `draft/generate`'s per-site tick.
6. **What must never appear**, on a screen or in a log line: the password. The field is
   `type="password"`; the connect outcome is a boolean and a reason token, with no member a string
   could travel in; `safeFetch` logs five fields — host, reason, status, bytes, duration — and no
   header; the destination lifecycle line carries an id, a kind, a state and an actor; the seal logs
   the operation alone. A 401 becomes the token `credentials_expired` in
   `destinations/wordpress/errors.ts`, and the payload stops there.

### The deep pass, for real

`docs/SPEC.md` §6's supply and §7's calendar are built and have never run against a real domain. This is the one
walk that runs a pass, and where to read each thing it did. It needs a paid account whose setup is
finished and the Inngest app registered (above).

**What starts it: completing setup, and nothing else.** `enqueueDeepPass`
(`src/app/(account)/setup/_setup/store.ts`) sends `scan/run` with `tier: "deep"`. There is no
second trigger: payment provisioning queues no pass.

**It runs once per site.** The event's `scanId` is `setup-{siteId}`, which is the job's idempotency
key, so a second setup submit for the same site is deduplicated rather than run again. Running a
second pass against a site that has had one means a new site row, or an event sent from the Inngest
dashboard with a different `scanId` (*Running one by hand*, above).

**What it may spend:** `CAPS.DEEP_C` = 150¢, re-checked between stages. The report ceiling does not
apply to this tier (`TIER_PARAMETERS.deep.deadlineApplies` is `false`) and the founder is released
at `TIMING.deepReleaseMin` = 10 minutes whatever the pass is still doing. A cap degrades and never
throws (§8).

**The spend is ledgered per call, not per stage.** `fetches` has no stage column, and a paid pass
appends nothing to `scans.stage_events` — the two paid tiers insert their `scans` row only when
they store a report — so a stage's cost is read back through `fetches.source`:

| Stage | Buys | `fetches.source` |
|---|---|---|
| `reading_your_site` | the home and pricing documents | `egress.safeFetch` |
| `reading_access_rules` | nothing | — |
| `reading_your_market` | the profile, the twelve's wording, seed suggestions | `profile`, `question-phrasing`, `dataforseo_labs/google/keyword_suggestions` |
| `checking_your_presence` | the customer at 300 rows, then each tracked rival at 100 | `dataforseo_labs/google/ranked_keywords`, `dataforseo_labs/google/competitors_domain` |
| `asking_the_twelve` | twelve queued SERPs (high priority on a free scan and a first pass, #1352) and the paid battery | `serp/google/organic`, `serp/google/ai_mode`, `ai_optimization/chat_gpt/llm_scraper` |
| `scoring` | nothing | — |
| *after the report* | one typing call per candidate | `opportunity-typing` |

Per-stage *timing* is `sites.setup_stage_times`, one instant per stage, written by
`src/lib/scan/deep/run.ts`. One pass's own spend is
`select source, count(*), sum(cost_cents) from fetches where scan_id = …` (§8).

**What to read when it ends, in order.**

1. the job line — `{"event":"job","jobId":"scan/run","outcome":…}`: `ran`, or `degraded` naming the
   step it stopped at;
2. the supply line — `{"event":"supply_pass","tier":…,"added":…,"unused":…}`: `unused` is the
   writable days out of `PLAN_DEPTH` (a week of seven and three spares); below it, the evidence
   and the stored questions ran out first. The week
   itself is committed by the first evening run (`{"event":"week_planned",…}`) and, after that,
   every Monday;
3. `sites.setup_released_reason` — `completed`, `degraded`, `failed` or `deadline`;
4. `scans.stopped_reason` — `complete`, `time_ceiling`, `spend_ceiling`, `site_unreadable` or
   `failed`;
5. `/app/calendar` — the planned dates, at most one page each. Two pages on one date is a data
   defect and raises (`TwoPagesOnOneDateError`) rather than drawing both.

A pass that derived nothing still releases the founder and is not an error: zero proposals is legal
and never faked, and the calendar then states which kind of empty each date is.

### A pass's health

Every deep pass, weekly pass and re-measure ends by checking what it stored (SPEC §6, D58, #1287)
and keeps the answers on its own row, `scans.health`: `brand_volume`, `prompt_rivals`,
`market_terms`, `mention_rate` and `serp_timeouts` (D63, #1298: more than a fifth of the pass's
Google SERP reads met our own request bound), each with `pass`, a one-line `detail` and the
`items` that failed. The log line is `{"event":"pass_health"}` with the failing checks; `pass_health_failed`
means the checks could not be recorded, and the row then holds null, which nothing reads as
unhealthy. A pass with a failing check keeps its data and is left out of the rolling window the AI
mention rate is read from; the Monday owner digest lists it.

```sql
-- the passes a check failed on, newest first
select s.id, s.domain, s.tier, s.created_at, c->>'check' as failed, c->>'detail' as found
from scans s, jsonb_array_elements(s.health->'checks') c
where (c->>'pass')::boolean = false
order by s.created_at desc limit 20;
```

### An empty day, and which kind

One account per date, first match over `EMPTY_PRECEDENCE`
(`src/app/(account)/app/calendar/empty.ts`), total — so every empty date carries exactly one
written line and none is padded. What a real run can produce today is narrower than the union: the
calendar's own read supplies no instruction and no stopped day (`readCalendarFacts` leaves both
empty until #42 and #39 are built), so those two arms cannot fire from this screen yet.

| Cause | Fires when | Read it from |
|---|---|---|
| `instruction` | a Fix is dated to the day — not read yet | — |
| `reachkit_stopped` | ReachKit's own stopped-work record says so — not read yet | — |
| `page_cannot_go_live` | the date's draft is `skipped` or `unpublished` | the draft's state |
| `customer_change_holds_pages` | publishing is off, or the destination is disconnected | the site's publishing settings |
| `change_holds_generation` | a domain or category answer is being replaced | `generationHold()` |
| `page_held` | a page was planned for the date and did not go out | the publishing machine's held days |
| `supply_exhausted` | `supplyDepth().unused` was read **and** is zero | `{"event":"supply_pass"}`, `{"event":"week_planned"}` |
| `unattributed` | nothing above is established, or the publishing facts were unreadable | the last arm, never a widened one |

`supply_exhausted` is proven only: a depth that could not be read is `null` and not zero, and the
date falls to `unattributed` rather than telling a customer their market is empty on a day the
database merely broke.

### Rewriting a live page for a new search

`npm run retarget -- --url <live address> --target "<search>" [--volume <monthly searches>]`
(SPEC §7, D53, #1268) prints one SQL statement and writes nothing. Run the statement through the
Supabase connector: this box's database key is a placeholder. `<live address>` is the page's
`publications.live_url`. It must be a page ReachKit published.

The statement adds one open `refresh_page` at that address, for the new search, and returns its
row. The row is stored at business fit 3: the target is the operator's choice, and no pass judges
it (#1285). No row returned means the address is not a live page of ours. A unique violation means the
page already has that update open or queued. The next generation run records the row's readiness
and ranks it with the site's other topics; nothing publishes until that day's page is written. The
page is written as the new search's own type and published at the address the new search names;
the old address answers 301 to it, and each site page that linked it is planned a link refresh to the new one (issue 1487).

### Checking a stored pass again

`npm run pass -- --site <domain> --replay <scanId>` runs a stored deep pass again through the
pass's own steps (SPEC §6, D64, D65): which searches it would measure now, the sizing, the rival
conclusion, the prompts that follow the rivals, the topics and their prune, and the health checks.
It costs 0¢ and reaches neither production nor a vendor. It prints the measured searches and why a
stored one is no longer measured, the rivals with any left out or waiting, the sizings, the cost
against the stored pass, the checks, the topics and the prompts, and exits 0 when the acceptance
list holds. The baseline snapshot is `0e5c5228`; `d4bb3740` and `17f5bbff` predate D65's export
and replay with calls refused.

The pass is read from `scripts/pass/snapshot/<first 8 of the scan id>.json`. To add one, run the
statement in `scripts/pass/export.sql` through the Supabase connector, read-only, in the checked
chunks `scripts/pass/assemble.mjs` describes, and commit the file it writes.

| Flag | Does |
|---|---|
| `--live --env-file <path>` | Buys the calls the stored pass never made, and keeps them in `<first 8>.live.json` so the next replay is 0¢. |
| `--cap-cents <n>` | The live run's ceiling. Default 30. |
| `--keep` | Leaves the local database up afterwards. |

It rebuilds this worktree's local database (`scripts/db-substrate/`), so do not run it beside
`vitest --project db` or the layout sweep in the same worktree. `RK_PASS_VERBOSE=1` prints the
pass's own log lines.

### Re-scoring every stored scan

After **every deploy that changes scoring, rivals or markets**, every stored scan is re-scored
(owner, 2026-10-14, issue 1426; SPEC §2) by one guarded apply. It costs 0¢. It runs in
production as the `scan/rescore` job (issue 1433), with the deployed code, reading the rows
themselves. It asks no model, and the network is refused while each scan is scored. Nothing is
exported, and no change is typed back through the connector.

**Nobody asks for it (issue 1481).** The build stamps the deployment with its derivation
(`RK_DERIVATION`, from `scripts/derivation.mjs`: a fingerprint of the declarations under `src/lib`
the re-score executes to score a scan, followed name by name through imports and barrels, without
comments or layout. Types and a lazy `import()` are not followed, so the vendor transport, the copy
registry and the constants it never reads are not among them; `node scripts/derivation.mjs --files`
lists the files it reads from). Each run reads every stored report
once, and per domain only the home reads those reports are scored with. It scores each stored read
from its facts in `fetch_facts` (`src/lib/scan/page-facts.ts`: on-page facts, the pricing link, the
markets it declares, whether it was a protection's or error page or a render that drew the site),
kept at the deployed `RK_FACTS_VERSION`, the same fingerprint over the extractor files alone
(`node scripts/derivation.mjs` prints both). A read with no facts at that version has its payload
downloaded once and its facts kept, so only the first run after an extractor change reads pages;
the summary's `read ≈ N MB (facts refresh ≈ M MB)` line says how much it read and how much of that
was pages read for their facts. `fetch_facts` is a cache: a row is never trusted at another version,
the account purge deletes a scan's facts by `scan_id` before its `fetches` rows (no cascade, ADR-051), and dropping every row costs one refresh. Production's tick,
every hour, finds no run at the deployed derivation and asks one apply itself
(`auto = true`; `docs/SPEC.md` §2 Re-score follows each scoring deploy). That run scores every stored
scan in memory and decides the guard before it writes anything (`RESCORE_GUARD` in
`src/lib/config/constants.ts`: no score moves more than 15 points, no scored scan loses its
number, no more unreadable scans than the run before). Where the guard stops it, it writes
nothing. Where the guard passes, it writes, and `rescore_scan` raises on a change that did not
land, so no check run follows. Only when a scan was written by someone else between the read and
the write does the run read the stored scans again. Any finished run settles the derivation: one
`rescore_runs` row per scoring deploy. A deploy whose fingerprint did not change asks nothing.
Dev's ticks never ask: it reads the same database with newer code.

Where it stands at the deployed derivation:

```sql
select requested_at, mode, auto, derivation, finished_at, scans_changed, scans_left,
       scans_unreadable, held, error, cardinality(stale_scans) as stale
from rescore_runs order by requested_at desc limit 6;
```

**A held run.** `held` says why the guard stopped the apply before it wrote anything, or that a
scan written after the read still moves; `error` says a run failed. Nothing more is asked at that
derivation, and every tick records `scan/rescore` as `degraded` at `rescore-held` in `job_runs`
until it moves on. Each public report in `stale_scans` says when it was read and that the reading
has changed since. Read the summary (step 2 below). If the moves are the change you meant, ask the
apply by hand (step 3). A person's apply is not guarded, and it settles the derivation. If they
are not, the fix is a code change, and its deploy is a new derivation that starts over.

To ask by hand, as before:

1. **Ask for a dry run** through the Supabase connector:
   `insert into rescore_runs (mode) values ('dry') returning id;`. The job ticks every hour,
   claims the oldest request not yet started, and answers it on the same row.
2. **Read the summary**: `select finished_at, rescored_by, scans_read, scans_changed, sites_moved,
   held, error, summary from rescore_runs where id = '<id>';`. `finished_at` is null while it runs.
   `rescored_by` is the deployed commit. `summary` is a markdown table with one row per scan:
   score with its range and confidence (issue 1439), band, the three factors, the limiting factor, the rivals and the status, before → after.
   Then come the totals, what could not be fully recomputed and why, the site rival sets that move,
   and the stored site names the name rule reads differently (issue 1479). `sites_moved` counts both:
   a moved rival set and a rewritten name. If `error` is set, the run failed. Read the
   message and ask again.
3. **Ask for the apply**: `insert into rescore_runs (mode) values ('apply') returning id;`, then
   read it the same way. Each scan that moves is written by `rescore_scan`. The function rewrites
   only the members that moved. It keeps the original report under `report.previous` and the
   original `score`, `status` and `drivers` under `report.previousColumns`, and stamps
   `rescoredAt` and `rescoredBy`. It is guarded by the report's checksum as the job read it:
   `scans_left` counts the scans written after the read and left alone. Ask again for those. A moved
   site rival set keeps its old rivals under `market.rescored`. A stored name is written only where
   it is still the one the job read; the summary lists each one's before and after.
4. **No check run is needed.** `rescore_scan` raises on a change that did not land, and the apply
   reads again any scan it left alone. A dry run still may be asked; `scans_changed` and
   `sites_moved` read 0.

What it cannot recompute it leaves as stored and lists: Answerability on every scan (a report keeps
the home page's facts, not the pages beyond it), search presence where a report of version 8 or
before kept its ranked count without the rows, a home read no longer in `fetches`, a brand an AI
Overview named only in its text where the report kept no text (every scan before issue 1420), and
whether an AI Mode or ChatGPT answer named the site where its text is not in `fetches` under that
scan (issue 1420). A profile's products, claims and voice read off a protection's page need a model call and stand; its name is read again. Week-on-week movement and the
Overview are read from each week's report, so they follow; a Monday mail already sent is not sent
again.

To undo one scan:

```sql
update scans set report = report->'previous', score = (report->'previousColumns'->>'score')::int,
       status = report->'previousColumns'->>'status', drivers = report->'previousColumns'->'drivers'
 where id = '<scan id>' and report ? 'previous';
```

### Measuring how pages read

`npm run eval:content -- --prose` scores stored pages, and pages people wrote on the panel's sites,
with the prose check (SPEC §7, issue 1390) and rewrites `docs/walk/prose-gate.md`. It spends
nothing; `--cached` reads no page again. The thresholds are `PROSE` in
`src/lib/config/constants.ts`: change one, run this, and read how many of people's pages it stops.

`npm run eval:content -- --prose --write [--sites a,b] [--cap-cents 75]` writes one page for each
site of `scripts/eval-content/prose/proof-sites.json` through the write call, the prose check and
its fix call, and keeps them under `.review/walk/prose-gate/`. `--prose --judge` writes reachkit.app's
how-to, Q&A and documentation again from their stored packs and has them read blind against the
stored pages. Both spend on the writer tier and are in the spend log.

### Testing one page

`npm run page -- --site <domain> --type <type> [--topic "<q>"]` writes one page through the
product's own stages (SPEC §7, D41, D43) and prints its path, each check's result and the cost.
`<type>` is one of `listicle`, `how_to`, `documentation`, `research`, `qa`, `insights`, `update`.

| Flag | Does |
|---|---|
| `--topic "<q>"` | the question the page is for; without it, the type's own default for the site's market, or the site's first live page for an update |
| `--fresh` | rebuilds the context pack; without it a rerun reuses the one cached under `.review/page/packs/` and spends nothing on research |
| `--out <dir>` | where the page (`<type>.md`), its pack (`<type>.pack.json`) and the run's record are written; `.review/page` by default |
| `--cap-cents <n>` | what the page's spend is reported against — 25 by default; the calls themselves are bounded by `CAPS.DRAFT_C` |
| `--env-file <path>` | the bindings; `.env.local` by default. A worktree has none: pass the main checkout's |

The box holds no database key, so the site's production rows are read from
`scripts/page/snapshot/<domain>.json`: the report, the profile, the pages the scan read, the
market, the knowledge base with the founder's answers, and the pages ReachKit has live.
`scripts/page/run.ts` names each member, and `scripts/eval-content/snapshot.ts` gives the queries the
export is taken with through the Supabase connector. The research reads, the one search and the
model calls are live and count towards the day's €2 (`docs/PROCESS.md`, *Testing budget*). Nothing
is written to a database or published. A page the checks stop exits 2 and still writes its text, so
the failure can be read.

---

### Countries and languages (D66)

A site is measured in the country and language stored on it (`sites.country`, `sites.language`; SPEC §6, D66, #1311). To see or correct one site's:

```sql
select domain, country, language from sites where domain = 'example.de';
update sites set country = 'DE', language = 'de' where domain = 'example.de';  -- a pair from the list only
```

Both null means no pass has read the site yet; its next pass reads and stores the pair. A pair that is not on the list is read as none.

**To add a country** to a language that is already supported, add one row to `COUNTRIES` in `src/lib/locale/locales.ts`: the vendor's own name for it (DataForSEO `location_name`), its language, its domain ending, dialling prefix, currency marks and names. Check first that the vendor serves that country in that language on every endpoint a pass uses: one live call each to Labs `keyword_overview`, the organic SERP, AI Mode and the ChatGPT scraper, inside the testing budget (§8).

**To add a language**, add a row to `LANGUAGES`, a pack beside `src/lib/locale/language/de.ts` (shape words, stop words, stemming, the searches, questions and tracked prompts ReachKit writes, the title words and banned patterns), a template file beside `src/lib/generate/templates/de.ts`, and its sentences under `src/lib/presentation/copy/keys/<language>/`. `tests/locale/`, `tests/generate/templates-de.test.ts` and `tests/presentation/copy/translated.test.ts` show what each must hold. Then add a site in that language to the panel and run it.

### The customer panel

`npm run panel -- --env-file ../../.env.local` runs every site of
`docs/walk/panel/sites.json` through a paying site's first pass (SPEC §0, owner 2026-10-07, #1304):
the site read, the market concluded with its terms, the searches seeded and asked, the knowledge
base, the rivals with their demand, and the topics. The first page is not written, no second pass
is started, and a first pass asks no tracked prompts. It runs on the box's local database and takes
only the two vendors' keys from the env file, so it writes nothing to production; a request to any
other host is refused. The site's own pages, and each concluded rival's home page (to check the
domain is the rival's, #1314), are read by the product's own fetcher at no cost.

It prints each site's checks as `pass`, `FAIL` or `review`, with the site's cost, and writes
`.review/walk/panel/<date>.json` and `<date>.md` after every site; `--recheck` reads the runs kept in `scripts/panel/runs/`. `review` is a result the code
cannot judge, listed for a person to read. It exits 0 only when every site ran and no check failed.

| Flag | Does |
|---|---|
| `--cap-cents <n>` | The whole run's ceiling. Default 100. A site is started only while the cap holds what a site has cost so far (30¢ before one has run); the rest are listed as not run. Past the cap every paid request is refused. |
| `--sites a.com,b.de` | Runs only these sites of the panel. |
| `--continue` | Keeps the sites that date's run already holds, counts their spend against the cap, and runs the rest. |
| `--recheck` | Buys nothing and starts no database: judges that date's stored results again with the checks as they are now. |
| `--date YYYY-MM-DD` | The run's two result files. Default today. |
| `--keep` | Leaves the local database up. |

A first pass costs about 30¢ a site, about 20¢ of it the search vendor's reads. Those reads are
kept in `scripts/panel/evidence/<domain>.json` and loaded by the next run, which buys only what the
changed code asks differently and the model's own calls, inside the vendor's 30-day windows. Commit
the evidence with the run. One database per worktree: do not run it beside `vitest --project db`,
the layout sweep or `npm run pass`.

To change the panel, edit `sites.json`: `country`, `language`, `kinds` (the kinds of business it
may be recorded as, D69), `market` (word roots of what the business is) and `place` are what the
checks hold a pass to, so they are facts about the business, never a pass's own output.

A site with a `place` is held to it (SPEC §6, D67, #1318): the pass stored that place, every
searched term and measured search names it or says "near me", Google's results were read from the
city where the vendor lists it, and a national chain is a rival only where one of the pass's own
results shows it. A site with no `place` fails where the pass stored one. The 25 tracked prompts
the concluded market yields are generated at 0¢ and checked too: the kind recorded is one the
panel allows, a business that is not software is asked nothing in software's words, and a local
site's prompts name its place.

**The vendor's city list** is `GET /v3/serp/google/locations/<country>`, free, and 19 MB for the
United States. A pass reads it once for a site that serves one place and keeps the city's name on
`sites.market.area`; clear `located` there to have the next pass read it again.

### Free scans off production

`npm run free-scan -- --env-file ../../.env.local --sites a.com,b.com` runs the free
scan a stranger starts from the landing page on the named sites (#1438), on the same local database
and with the same two keys as the panel (`scripts/local-run.mjs`): the slot is claimed as
`POST /api/scan` claims it, one network per site, and the product's own
`runScan({ domain, tier: "free" })` runs under its 50 s ceiling and 12¢ cap, raced against the
route's request budget. Nothing is written to production.

Per site it writes the score, the four drivers or why each is unmeasured, the locale and stated
place, each question (its search, whether the results were read, where the site ranks, the AI
Overview and whether it names or cites the site, the local pack), the rivals, the cost and the time
to `.review/walk/free/<date>.json` and `<date>.md`. A second run on a date adds to that date's files.

| Flag | Does |
|---|---|
| `--cap-cents <n>` | The whole run's ceiling. Default 100. A site is started only while 12¢ is left; past the cap every paid request is refused. |
| `--recheck` | Buys nothing and starts no database: scores that date's stored scans again with the current code through the production re-score's path (`rescoreRow`), and writes `<date>.recheck.md`, the before and after. |
| `--date YYYY-MM-DD` | The run's result files. Default today. |
| `--keep` | Leaves the local database up. |

---

## 5. The kill switch

`KILL_SWITCH=true` stops the paid work; the scope is `KILL_SWITCH_SCOPE` in
`src/jobs/kill-switch.ts`. It is not a maintenance mode: sign-in, billing, hosted pages and the
webhook keep working.

1. Set `KILL_SWITCH` to `true` on **all** Vercel targets.
2. **Redeploy.** `process.env` is parsed once at module load, so a running instance keeps the old
   value: *a flip is a redeploy*.
3. Confirm: a stopped job logs `"outcome":"stopped","by":"kill-switch"`, and the account shell shows
   the stopped notice.

To release it, the same three steps with `false`. The flip writes no row; the log line is the only
record.

---

## 6. Mail

The From is `ReachKit <hello@reachkit.app>` (`MAIL_FROM`), and Reply-To is the same mailbox, which
must be one somebody reads. Resend's dashboard shows what left; the runtime log shows what did not.

**Resend → Domains → `reachkit.app`, and the DNS zone in Cloudflare** (the owner's):

| Record | What to check |
|---|---|
| DKIM | `resend._domainkey` TXT published, and Resend shows the domain **Verified** |
| SPF | the TXT on the return-path subdomain (`send.reachkit.app`) includes `include:amazonses.com`, never a second `v=spf1` on the root |
| Return path | the MX on `send.reachkit.app` pointing at Resend's feedback host; this is what makes SPF align for DMARC |
| DMARC | `_dmarc.reachkit.app` = `v=DMARC1; p=none; rua=mailto:hello@reachkit.app; fo=1` since 2026-09-23 (#1043). Once 7 days of `rua` reports are clean, `p=quarantine; pct=100`, then after 14 clean days `p=reject` (#1048). Rollback is `p=none` |
| BIMI | only after quarantine: TXT `default._bimi` = `v=BIMI1; l=https://reachkit.app/brand/mark-bimi.svg; a=;`. Gmail draws it only with a VMC or CMC (a paid, yearly owner decision), whose PEM goes to `public/brand/bimi.pem` and into `a=` |
| Inbound | Cloudflare Email Routing (MX `route{1,2,3}.mx.cloudflare.net`) forwards `hello@` to the owner |

The free sender picture is a Google account on `hello@reachkit.app` with `public/brand/mark-512.png`
as its photo, visible to Anyone, and 2-Step Verification on.

**Supabase → Authentication** (the owner's): Site URL is the app origin; the redirect allow-list
holds the product's sign-in address (`CONFIRM_PATH` in `src/lib/account/identity/addresses.ts`) on
each host; Email OTP expiry is 86400 s, which must equal `SIGNIN_LINK_TTL_H`.

---

## 7. When a deployment refuses to boot

`src/instrumentation.ts` runs the boot checks once per instance. Read the **runtime** log of the
failing deployment, not the build log: the last `boot_invariants` line names the check reached, and
the error after it names the binding, never a value.

1. **A binding:** confirm it exists on the target that failed. A value pasted on one target and not
   the other is the usual cause.
2. **`FixedClockRefused`:** unset `RK_FIXED_NOW`.
3. **`MissingJobsBindings`:** paste `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` on that target.
4. **The build failed on the price:** the build log's `price_check` line. `PriceObjectMismatch` names
   the field: build a new price to the spec and repoint `STRIPE_PRICE_ID`. `PriceObjectUnknown` means
   the price is not in the key's Stripe mode (§2). A Stripe outage logs `"outcome":"unchecked"` and
   the build goes on.
5. **Nothing in the log is a boot check:** has the Supabase project paused (§2)?

---

## 8. The cost ledger

`fetches` is the source of truth for production spend, reachable only through `dbAdmin()`; the caps
are `CAPS` and `DAILY_PRODUCT_CEILING` in `src/lib/config/constants.ts`. The owner's page is
`/app/costs`, signed in at one of `OWNER_EMAILS`. For anything else, read the ledger in the Supabase
SQL editor, which runs above the grants:

```sql
-- today, product-wide (the figure the ceiling is checked against)
select fetches_spend_since(date_trunc('day', now() at time zone 'utc'));

-- where the money went, last 30 days
select source, sum(cost_cents) as cents, count(*) as calls
  from fetches
 where created_at >= now() - interval '30 days'
 group by 1 order by 2 desc;
```

### Spend from the box

Paid calls a script makes from the box never reach `fetches`. Each appends a line to
**`/root/ops/reachkit/spend.jsonl`** through `appendSpend()` in `scripts/spend-log.mjs`, and a new
script that calls a vendor or a model calls it too. The file is created by the first paid call and is
not rotated.

**`rk-vendor-snapshot.timer`** runs `scripts/vendor-snapshot.mjs` hourly from the main checkout. It
appends to `/root/ops/reachkit/vendor-snapshots.jsonl` and logs to
`/root/ops/reachkit/log/vendor-snapshot.log`, reading free endpoints only: DataForSEO's
`appendix/user_data`, Anthropic's cost report when `.env.local` holds `ANTHROPIC_ADMIN_KEY` (made in
the Claude Console under Settings, Admin keys), and Vercel's billing charges with the Vercel CLI's
token (`/root/.local/share/com.vercel.cli/auth.json`). It mails `OWNER_EMAILS` at 50%, 80% and 100%
of the monthly Active CPU budget in that script; what it mailed is in
`/root/ops/reachkit/state/cpu-budget.json`. To recreate it, as root, write these two units, then
`systemctl daemon-reload && systemctl enable --now rk-vendor-snapshot.timer`:

```ini
# /etc/systemd/system/rk-vendor-snapshot.service
[Unit]
Description=ReachKit ops - what the vendors billed, read every hour (issue 1408)
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=root
WorkingDirectory=/root/ops/reachkit
Environment=HOME=/root
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node /root/projects/reachkit/scripts/vendor-snapshot.mjs
StandardOutput=append:/root/ops/reachkit/log/vendor-snapshot.log
StandardError=append:/root/ops/reachkit/log/vendor-snapshot.log

# /etc/systemd/system/rk-vendor-snapshot.timer
[Unit]
Description=ReachKit ops - hourly vendor billing snapshot (issue 1408)
[Timer]
OnCalendar=hourly
Persistent=true
AccuracySec=1min
[Install]
WantedBy=timers.target
```

**`npm run costs`** prints billed beside recorded for today and the last 7 days, and the Vercel
Active CPU block. The box's `.env.local` has no real database key, so production's side is read by
running this in the SQL editor, saving the JSON array, and passing `npm run costs -- --ledger <file>`:

```sql
select coalesce(jsonb_agg(d), '[]'::jsonb) from (
  select (created_at at time zone 'utc')::date as day, source,
         sum(cost_cents) as cost_cents, sum(billed_cents) as billed_cents
    from fetches
   where created_at >= date_trunc('day', now() at time zone 'utc') - interval '7 days'
     and (cost_cents > 0 or billed_cents > 0)
   group by 1, 2
) d;
```

`vendor_days` holds a `fixed` row a month for Vercel, Supabase, the job platform and Resend with no
figure; a figure learned from their dashboards is written into that row by hand in the SQL editor.

---

## 9. The database

### Migrations

`supabase/migrations/` holds them, applied in filename order. **There is no migration tool.** A
migration reaches the live project by hand, through the Supabase SQL editor or the connector:

1. An expand-only migration is applied before the deploy whose code reads it; any other after the
   target deploy is READY. Dev shares this database, so an unapplied migration breaks
   `dev.reachkit.app` as soon as code reads it.
2. Paste the file into the SQL editor on the `reachkit` project, one migration per run, oldest first.
3. Re-read the **security and performance advisors**. A finding not in the table below is new and
   gets a row in the same change that answers it.

Verify a migration against a throwaway database first, never the shared scratch one:

```sh
psql -h 127.0.0.1 -U reachkit -d postgres -c "create database reachkit_check"
# Supabase's auth schema, which a bare Postgres has not got; without it every
# migration carrying an RLS policy dies at: schema "auth" does not exist
psql -h 127.0.0.1 -U reachkit -d reachkit_check \
  -c "create schema auth" \
  -c "create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid \$\$"
for f in $(ls supabase/migrations/*.sql | sort); do
  psql -h 127.0.0.1 -U reachkit -d reachkit_check -v ON_ERROR_STOP=1 -q -f "$f" || echo "FAILED: $f"
done
psql -h 127.0.0.1 -U reachkit -d postgres -c "drop database reachkit_check"
```

### Advisor findings — the standing dispositions

| Finding | Disposition |
|---|---|
| `rls_enabled_no_policy` on the `dbAdmin()`-only tables in `public`, and `fetches`, `leads` in `v2_archive` | **By design.** Each `public` table carries a `comment on table` naming the rule. The `v2_archive` ones go with the v2 rollback path |
| `extension_in_public` — `pg_trgm` | **Accepted.** Its functions read no table; the one reader through it, `known_content_near`, is `service_role`'s alone |
| `auth_leaked_password_protection` | **Not applicable.** There are no passwords (`supabase/config.toml` `enable_password_signin = false`); this WARN is expected on every run |
| `auth_rls_initplan` in `v2_archive` | **Left**: v2's frozen rollback path |
| `unindexed_foreign_keys` on columns referencing `scans` | **Accepted.** Nothing deletes a `scans` row and no query filters by them. Revisit when one does |
| `unused_index` | **Kept.** Traffic is small; each index backs a uniqueness rule or a query that needs it at volume |
| `no_primary_key` in `archive` and `backup_20261005` | **Not v3's schema.** Dated snapshot copies, read by hand; they go when the owner retires them |

### The substrate

`scripts/db-substrate/` is the local Postgres + PostgREST + postgres-meta stack the `db` and
`layout` suites talk to; its `README.md` is the detail.

```sh
eval "$(scripts/db-substrate/up.sh --run)"   # one worktree, one database
npx vitest run --project db --maxWorkers=1
scripts/db-substrate/down.sh                 # the moment the suite finishes
```

Without `--run` you get the shared database, and two runs delete each other's rows. It does not
start PostgreSQL. Stop the stack before removing a worktree; `down.sh --orphans` finds every stack
whose directory is gone. To put the box's tools back after a reboot:

```sh
# PostgREST, pinned to the version up.sh pins its image to (v16.2), outside every worktree.
curl -sL -o /tmp/pgrst.tar.xz \
  https://github.com/PostgREST/postgrest/releases/download/v16.2/postgrest-v16.2-linux-static-x86-64.tar.xz
tar -xJf /tmp/pgrst.tar.xz -C /tmp && install -m 755 /tmp/postgrest /root/ops/bin/postgrest
export POSTGREST_BIN=/root/ops/bin/postgrest

# postgres-meta's install directory; a dangling symlink makes up.sh die on `mkdir: Already exists`.
mkdir -p /root/tmp/reachkit-pgmeta && ln -sfn /root/tmp/reachkit-pgmeta /tmp/reachkit-pgmeta
```

### Backups and restore

**The project is on Supabase Free: no point-in-time recovery and no scheduled backups** (accepted
for the first rollout, owner R18, 2026-10-22). Dev and production are one database, so a row deleted
while steering on dev is a customer's row. Treat every statement typed against `kleepxxddbcnfsfwudoe`
as unrecoverable.

**Turning recovery on** is the owner's. The org is Vercel-Marketplace-managed, so the plan change is
made at vercel.com → team `timclifford` → the Supabase integration → its plan. Pro gives 7 daily
backups (**Database → Backups → Scheduled**). PITR needs Pro and at least the Small compute add-on
(**Project Settings → Add-ons → Point-in-Time Recovery**); enabling it stops the daily backups, and
it is not covered by the Spend Cap. A PITR restore is in place; a restore into a fresh project is
**Duplicate Project**.

**Taking a dump** (`DATABASE_URL` from the owner's shell):

```sh
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  -n public -n auth \
  --file "reachkit-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Name the schemas: a bare `pg_dump` reaches internal schemas and errors, and `public` alone restores
rows nobody can sign in to. Add `-n v2_archive` only while the v2 rollback path is wanted. Keep the
file off the box; it holds every customer's data.

**The drill**, against a local scratch database, never the live project:

1. Take a fresh dump.
2. `psql -h 127.0.0.1 -U reachkit -d postgres -c "create database reachkit_restore_drill"`.
3. `pg_restore --no-owner --no-privileges --dbname "<scratch url>" reachkit-<stamp>.dump`.
4. Compare row counts of `users`, `sites`, `scans`, `drafts`, `publications`, `leads`, `fetches`
   with the source, and `select tablename, policyname from pg_policies where schemaname = 'public'`.
5. Point a local `next dev` at the scratch database, sign in, open `/app`.
6. Drop the scratch database and delete the dump copies. Record the date, size and restore time on
   the backups issue (#334).

**Restoring for real** from a dump: flip `KILL_SWITCH` (§5) and redeploy, restore, verify, release.
Everything after the dump is lost.

**The rollback to v2** is a different procedure: `alter table v2_archive.<t> set schema public` per
table, then promote the frozen v2 production deployment (`dpl_2NEUXishMXAkzXG4Ti85yTy7NDda`,
23 Aug 2026).

---

## 10. Quick reference

| Situation | Go to |
|---|---|
| the site is 500ing | §7 — the runtime log's last `boot_invariants` line |
| every page 500s and nothing changed | §2 — the Supabase project may have paused |
| nothing has published for days | §4 — is the Inngest app registered? |
| spend looks wrong | §8 — `fetches` is the truth |
| stop the spend now | §5 — `KILL_SWITCH=true` on every target, **then redeploy** |
| a key leaked | §3 — mint, paste both targets, redeploy, verify, revoke |
| the first live payment, or a Stripe setting | §2 *Stripe dashboard* |
| a migration needs to reach production | §9 — by hand, through the SQL editor |
| production is serving a bad build | §1 — **roll forward**; never promote an older deployment |
| "is not readable by this build" in a log | §1 — an older build is reading a newer report; deploy `main` |
| a check sits in *queued* for hours | §1 *Where CI runs* — a workflow regressed to a self-hosted label; fix its `runs-on` |
