# Runbook — operating ReachKit alone

The owner operates this product without a team. This page is what to do, in the order you would
do it, when something needs doing: landing a change, finding what a job did, stopping the spend,
rotating a key, getting the database back. It assumes nothing about the reader except that they
have the accounts.

It is the **operational** half of the corpus. Its neighbours own the facts it references and win
where they disagree: `docs/DEPLOYMENT.md` owns the environments, the one Vercel project and where
each binding lives; `PROCESS.md` owns how work is organised; `BUILD.md` §11 owns what the
jobs are; `DATA-COSTS.md` owns the price book. Nothing under `docs/` is read by the running
product, so nothing here can change behaviour — every procedure below acts through a dashboard, a
shell or a merge.

**Where the truth is when this page is wrong.** Every claim below is followed by the file that
holds it. Read the file.

---

## 1. Landing a change

One issue, one branch, one PR (`PROCESS.md` §1). The PR body carries `Closes #N`, and every
*Done when* box on the issue is ticked, or the hygiene check fails.

**Five required checks on `main`**, all from `.github/workflows/` (`PROCESS.md` §3). Branch
protection requires these five and a code-owner review:

| Check | Workflow | What it runs |
|---|---|---|
| `typecheck · lint · unit` | `ci.yml` | `npm run typecheck`, `npm run lint`, `npx vitest run --project node --project ui` |
| `layout conformance (browser)` | `ci.yml` | the browser sweep against the approved set, on a `postgres:18` service and the in-repo substrate; it also composes the renders comment |
| `schema · RLS (live Postgres)` | `ci.yml` | `npx vitest run --project db` against a migrated database |
| `closes one issue · done-when ticked` | `pr-hygiene.yml` | fails on a missing `Closes #N` and on any `- [ ]` left in the issue body |
| `audit` | `drift-audit.yml` | `npm audit --omit=dev --audit-level=high`, then `scripts/drift-audit.mjs --strict` (spec ↔ code ↔ tests) |

**`Vercel` is not one of them** (2026-09-09). Previews are off — the project's ignored-build step
builds `main` only — so a PR's Vercel row reports the production build's own state, and once the
day's Hobby quota is spent it fails with `build-rate-limit` on every open PR. That row is not a
gate: branch protection does not require it and the lander ignores it. Production builds from
`main` still deploy normally. The renders comment is the review surface in a preview's place.

**To land:** the master reviews the body, the boxes and the renders, records findings as a PR
comment, and approves by adding the **`master-approved`** label. The lander service
(`rk-lander.service`) does the rest — updates the branch when it is behind, waits while it is
conflicted or a check is pending, then merges with a merge commit and `--delete-branch`. Nobody
waits on a merge. `--admin` is deliberate: the owner's account cannot review its own PR, so the
checks are the gate and the flag only bypasses the review row.

`scripts/land.sh <pr> [<pr> ...]` is the same chain run by hand when the service is down. Run it
in a foreground shell, never as a background job — the box reclaims those under memory pressure.

**A merge to `main` is a production deployment.** There is one Vercel project and `main` is its
production branch, so landing a PR ships it to `reachkit.app`. There is no staging step between
the two. `dev.reachkit.app` is bound to the same branch on the same project and serves the same
deployment (`docs/DEPLOYMENT.md` §1).

---

## 2. Environments

| | |
|---|---|
| Production | `reachkit.app` (and `www.`), Vercel project `reachkit`, production branch `main` |
| Development host | `dev.reachkit.app` — the same project, bound to `main`, so the same deployment. It is the URL the owner steers on; it is not a separate environment |
| Preview | none. The ignored-build step builds `main` only |
| Database | one Supabase project, `reachkit` (`kleepxxddbcnfsfwudoe`), Postgres 17, us-east-1, **Free plan** |
| Jobs | Inngest app `reachkit`, registered at `https://reachkit.app/api/jobs` |
| Local | `npm run dev` on `http://localhost:3000`, bindings from `.env.local` (names in `.env.example`) |

One project, one database, one set of bindings — the owner's ruling of 2026-09-08. Full structure,
including the Supabase security-advisor dispositions and the cutover record, is
`docs/DEPLOYMENT.md`.

**The Supabase Free plan pauses a project after seven idle days.** The hourly job ticks keep it
awake once Inngest is registered (#315); until then, an untouched week pauses the database and
every page 500s. Unpause is a button in the Supabase dashboard.

---

## 3. The bindings

`src/lib/config/env.ts` is the schema, and it is the authority: **a missing or malformed binding
is a boot failure, not a runtime `undefined`.** There is no default and no fallback anywhere in
it, so a deployment cannot start half-configured. `.env.example` lists every name with a blank
value; a real credential in that file is a defect (`tests/app/env-example.test.ts`).

Where each lives and who pastes it is `docs/DEPLOYMENT.md` §2 — sensitive rows are write-only in
Vercel and the owner pastes them in the dashboard. **Every binding must exist on *both* the
production and the preview target**, even with previews off: a target missing one cannot build.

Nineteen names are in the schema. Two more sit outside it, for stated reasons.

| Binding | What it is for | Server-only | Notes |
|---|---|---|---|
| `SUPABASE_URL` | the project's REST origin | | must parse as a URL |
| `SUPABASE_ANON_KEY` | the browser's key, RLS-bound | | |
| `SUPABASE_SERVICE_ROLE_KEY` | `dbAdmin()`'s key, bypasses RLS | ● | reading it from a client bundle throws |
| `STRIPE_SECRET_KEY` | the API key | ● | |
| `STRIPE_WEBHOOK_SECRET` | verifies `/api/stripe/webhook` | | |
| `STRIPE_PRICE_ID` | the one €49/month tax-inclusive price | | checked against the spec at boot — §7 |
| `RESEND_API_KEY` | mail transport | ● | |
| `MAIL_FROM` | the mailbox every ReachKit mail comes from | | must be an address, at a verified Resend sending domain, and read by somebody — §6 |
| `DATAFORSEO_LOGIN` | vendor identity | | |
| `DATAFORSEO_PASSWORD` | vendor secret | ● | |
| `ANTHROPIC_API_KEY` | inference | ● | |
| `NANO_API_KEY` | the cheap tier's key | ● | the schema's one optional member; absent, it resolves to `ANTHROPIC_API_KEY` before any caller sees it |
| `INNGEST_SIGNING_KEY` | proves a delivery to `/api/jobs` came from the platform | ● | optional in the schema, required of a real deployment by the boot invariant |
| `INNGEST_EVENT_KEY` | puts work on the queue | ● | same |
| `IP_HASH_SALT` | the free path's per-IP hashing | ● | a fresh random value per environment |
| `KILL_SWITCH` | boolean-ish; §5 | | `false` in normal operation |
| `OWNER_EMAILS` | comma-separated; the only recipient of ops mail | | each entry must be an address |
| `NEXT_PUBLIC_APP_URL` | the app's own origin | | must parse |
| `HOSTED_EDGE_CNAME_TARGET` | what a customer points `content.{their-domain}` at | | `edge.reachkit.app` |
| `DATABASE_URL` | migration and test tooling only | — | no module under `src/` reads it; **never bound in Vercel** |
| `RK_FIXED_NOW` | a test fixture | — | **never set in any Vercel environment**; a real deployment refuses to boot with it — §7 |

*(The issue that asked for this page said "the 17 bindings" — that was the count before #315 added
the two Inngest keys and #81 added `MAIL_FROM`. The table above is the current set.)*

### Rotating a secret

The same six steps for every sensitive row. Nothing here is ever pasted into a shell that logs, a
PR, an issue, or a message to an agent — **agents never see these values.**

1. **Mint the new value at the vendor** (Stripe → API keys, Supabase → project API keys, Resend →
   API keys, DataForSEO → API access, Anthropic → API keys, Inngest → the app's keys). Where the
   vendor supports two live keys at once, create the new one before revoking the old.
2. **Paste it into Vercel** on **both** the production and the preview target, in the project's
   Environment Variables. Sensitive rows are write-only: the API never reads one back, so a typo
   is invisible until boot.
3. **Redeploy.** A binding is read once, at module load. An existing instance keeps the old value
   until it is replaced — redeploy `main` from the Vercel dashboard, or land the next PR.
4. **Watch the boot.** The deployment's runtime log carries one line per invariant,
   `{"event":"boot_invariants","check":"…","outcome":"checked"}`. A deployment that took the new
   value serves; one that did not fails at the door with the name of the binding — §7.
5. **Exercise the vendor once.** Stripe: open the customer portal from `/app/settings`. Resend:
   the vendor's own dashboard shows the send. Supabase: any signed-in page. DataForSEO and
   Anthropic: one free scan of any domain exercises both.
6. **Revoke the old value at the vendor**, and only then. Rotating `SUPABASE_SERVICE_ROLE_KEY` or
   `IP_HASH_SALT` has a consequence beyond the key: the service-role key is what every job and
   every admin read uses, so a wrong one takes the whole product down rather than one feature; and
   `IP_HASH_SALT` is the salt the free path's per-IP counters are keyed by, so changing it resets
   every rate-limit bucket at once. Rotate it deliberately, not on a schedule.

`STRIPE_PRICE_ID` is not a secret and is not rotated — it is repointed, and the boot invariant in
§7 refuses a price that does not match the spec.

---

## 4. The jobs

Eight, closed. The registry is `src/jobs/index.ts` and it is a frozen array — a definition that is
not in it is unreachable over HTTP. `src/jobs/client.ts` is the only file that names the platform.

| Job | Trigger | Does | In the kill switch |
|---|---|---|---|
| `scan/run` | event `scan/run` | the one pipeline; tier is a parameter | ● |
| `draft/generate` | cron `0 * * * *` | next opportunity → pipeline → `in_review`, veto clock starts, daily mail. The tick is hourly; the work is gated to the site's own evening hour | ● |
| `publish/execute` | event `publish/execute` | state machine → destination | ● |
| `publish/verify` | event `publish/verify`, +24h | liveness checks on a published page | |
| `publish/retry` | cron `0 * * * *` | claims failed pages whose retry moment has come round | ● |
| `weekly/refresh` | cron `0 * * * *` | weekly scan per active site, gated on that site's local Monday | (stopped inside the run, not by the runner) |
| `lead/nurture` | cron `0 * * * *` | advances sequences over `next_touch_at` | |
| `account/maintenance` | cron `*/15 * * * *` | five due-work queries: a payment awaiting sign-in, a payment with no account, a hosting-end notice, a hosting stop, an account due for purge | |

Only four ids are sendable events (`src/jobs/types.ts`, `JobEvent`): `scan/run`,
`publish/execute`, `publish/verify`, `lead/nurture`. The four clock-triggered jobs have no event.

### Running one by hand

**There is no endpoint, no script and no npm task that triggers a job.** `/api/jobs` accepts
`GET`, `POST` and `PUT`, but a `POST` is signature-verified by the SDK against
`INNGEST_SIGNING_KEY`, so it cannot be called by hand. The product itself sends exactly two
events: `scan/run` when a setup completes (`src/app/(account)/setup/_setup/store.ts`) and
`publish/verify` after a publication (`src/jobs/engine.ts`).

So the way to run one by hand is **the Inngest dashboard**, on the `reachkit` app:

- **A cron job** (`draft/generate`, `publish/retry`, `weekly/refresh`, `account/maintenance`):
  find the function and use *Invoke*. A tick takes no data. Each of these is due-gated, so an
  out-of-hours invocation is expected to return `skipped` with reason `not-due` or `no-subject` —
  that is the job working, not failing.
- **An event job**: send the event with its payload, or *Replay* a past run. The payload keys are
  the job's `idempotencyKey` in `src/jobs/*.ts` — `scan/run` takes `scanId`, `publish/execute`
  takes `draftId` and `destinationId`, `publish/verify` takes `publicationId`. A delivery is
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

---

## 5. The kill switch

`KILL_SWITCH=true` stops the paid work. The scope is closed and named:
`KILL_SWITCH_SCOPE` in `src/jobs/kill-switch.ts`.

**Stopped:** `scan/run` · `draft/generate` · `publish/execute` · `publish/retry`. The guard runs
before the body — before the first vendor call and before the first write — so a stopped job
spends nothing and changes nothing.

**Not stopped, deliberately:** `publish/verify` (holding it would leave a page that is already
published unchecked), `account/maintenance` (holding it would hold a purge, a hosting notice, or
a paid customer's sign-in link), `lead/nurture`. `weekly/refresh` is not in the scope either, but
is refused inside its own run (`src/lib/scan/weekly/run.ts`) — the effect is the same, the record
is a refusal rather than a stop.

The switch is read in four more places besides the job runner, so the door closes as well as the
engine: free-scan admission refuses with `switched_off` (`src/lib/scan/admission.ts`), the weekly
run refuses with `kill_switch` (`src/lib/scan/weekly/run.ts`), the publish state machine asks
`reachKitStopped()` (`src/lib/publish/switch/`), and the report-correction route refuses without
consuming one of the customer's attempts. The account shell reads the same answer to render the
stopped notice.

### Flipping it

1. Set `KILL_SWITCH` to `true` on **all** Vercel targets.
2. **Redeploy.** This is the part that is easy to get wrong: the value is read per call but
   `process.env` is parsed once at module load, so a running instance keeps the old value for its
   whole life. *A flip is a redeploy.* Until the new instances are serving, the old ones keep
   spending.
3. Confirm: a stopped job logs `"outcome":"stopped","by":"kill-switch"`, and the account shell
   shows the stopped notice.

To release it, the same three steps with `false`.

### What it does not do

- **It writes no row.** There is no table and no column recording an engagement; the record is the
  log line and nothing else. So there is no history of when it was on, and the release is not
  observed at all.
- **The alert mail cannot send.** `reportKillSwitchEngaged()` fires at most once per process, but
  every sentence of that mail is an owner-owed copy key that is still empty
  (`mail.ops.spend-ceiling.*` in `src/lib/presentation/copy/keys/mail.ts`). `copy()` refuses an
  unwritten key, `sendEmail` answers `not-composable`, and the send is logged rather than
  delivered. **Flipping the switch tells nobody but the log.** Until those keys are written,
  treat the flip as silent.
- **It is not a maintenance mode.** Sign-in, the account screens, billing, the hosted pages and
  the webhook all keep working. It stops work that costs money, and that is all it stops.

---

## 6. Mail

One transport (Resend), one shell, plain-text alternative, no generated prose — `BUILD.md` §12.

The sending mailbox is `MAIL_FROM`, read at the send in `src/lib/mail/vendor/resend.ts` (#81);
before that it was derived as `hello@<host of NEXT_PUBLIC_APP_URL>`, which was only ever the right
address on production. Its domain must be a verified Resend sending domain with SPF, DKIM and
DMARC in place, or nothing leaves — and the mailbox itself must be one somebody reads:
`optout.invalid` tells a reader to reply to it and ask to be removed by hand.

**A mail with an unwritten sentence does not send.** `copy()` refuses an empty key, `sendEmail`
answers `not-composable`, and the attempt is logged. This is the ruling of 2026-09-05 — a mail
never ships a placeholder — and it is why the ops alerts in §5 and §7 are currently silent. The
fix for every one of them is the owner writing the copy key, never a code change.

Failed and unsent mail is visible in two places: Resend's own dashboard for what left, and the
runtime log for what did not (`event: "spend_alert_failed"`, and the per-kind `*_not_sent` lines).

---

## 7. When a deployment refuses to boot

`src/instrumentation.ts` runs the invariants once per server instance, before that instance
answers anything, in this order. Each writes
`{"event":"boot_invariants","check":"<name>","outcome":"checked"}` when it passes; a failure is the
last thing in the log and the deployment serves nothing.

| # | Check | Error | Trips when | Fix |
|---|---|---|---|---|
| 0 | the schema | `Error: src/lib/config/env.ts: invalid or missing environment binding(s):` + the names | any member of the schema is missing or malformed | set the named binding on **that target** and redeploy. The message names the binding and never a value |
| 1 | `clock` | `FixedClockRefused` | `RK_FIXED_NOW` is set on a real deployment (or set and unparsable anywhere) | unset `RK_FIXED_NOW`. It is a test fixture and belongs in no Vercel environment |
| 2 | `jobs` | `MissingJobsBindings` | a real deployment is missing `INNGEST_SIGNING_KEY` or `INNGEST_EVENT_KEY` | paste both on that target. This is the #315 refusal: without them the ticks never run and nothing would otherwise say so |
| 3 | `access-gate` | (registration) | billing's gate could not register — in practice, the database is unreachable | check the Supabase project is awake and `SUPABASE_*` is right |
| 4 | `stamp-place` | none | — | non-throwing registration |
| 5 | `spend-alerts` | none | — | non-throwing; an unregistered sink costs an alert, never a refusal |
| 6 | `checkout` | `PriceObjectMismatch` | the live Stripe Price behind `STRIPE_PRICE_ID` differs from the spec at `unit_amount`, `currency`, `recurring.interval` or `tax_behavior` | the message names the field, the expected value and the found one. Those fields are immutable on a Stripe Price, so the fix is a **new** price built to the spec and `STRIPE_PRICE_ID` repointed at it. This is the only failure this check raises: any other error — a Stripe outage, say — logs `{"check":"checkout","outcome":"unchecked"}` and the deployment serves |

"A real deployment" is `isRealDeployment()` in `src/lib/config/now.ts`, and it **fails closed**:
anything on Vercel is real, and so is anything with an unset or unparsable `NEXT_PUBLIC_APP_URL`.
Only an app URL whose host is `localhost`, `127.0.0.1` or `[::1]` is not.

### The order to check things in

1. **Read the runtime log of the failing deployment**, not the build log. These invariants run at
   boot, so the build is green and the deployment 500s. The last `boot_invariants` line names the
   check that was reached; the error after it is the one to read.
2. **If it is a binding**: the name is in the message. Confirm it exists on the target that
   failed. A value pasted on one target and not the other is the most common cause — the
   deployment that boots is not evidence about the one that does not.
3. **If it is the price**: the message names the field and both values.
4. **If nothing in the log is a boot invariant**, it is not this section: check whether the
   Supabase project has paused (§2) and whether the Vercel build limit was reached (§1).

---

## 8. The cost ledger

Every vendor and model call goes through the seam in `src/lib/costs/`, and every call that
actually spent writes one row to **`fetches`**. That table is the source of truth for spend;
`scans.cost_cents` is a cached roll-up of it.

`fetches` — `supabase/migrations/20260903080000_fetches.sql`:

| Column | |
|---|---|
| `scan_id` | the scan the spend belongs to (a draft's spend is keyed to its grounding scan) |
| `source` | the vendor endpoint or model id, free text |
| `cache_key`, `policy_version` | what was bought, and under which generation of the derivation |
| `reserved_cents` | what the cap was checked against |
| `cost_cents` | what it settled at |
| `created_at` | when |

RLS is on with no policy — default-deny — so it is reachable only through `dbAdmin()`. **No cost
figure is ever rendered to a customer**, and there is no `site_id`: a site is reached through
`scans.site_id`.

### The caps

`src/lib/config/constants.ts`, `CAPS`, in cents. Per pass: free `12` · deep `150` · weekly `40` ·
draft `45`. Product-wide: `DAILY_PRODUCT_C = 5000` for one **UTC** day, measured over
`fetches.cost_cents`. The unit prices behind them are `PRICE_BOOK`, transcribed from
`DATA-COSTS.md` and held to it by `tests/pins.test.ts`.

**A cap degrades, it never throws.** Hitting one skips the remaining optional work and marks the
scan `degraded`; the run finishes with a smaller report rather than an error. Hitting the daily
ceiling refuses a free scan at the door with an honest retry time (next UTC midnight) and degrades
a paid pass inside the seam. The line to look for is
`{"event":"cap_hit","reason":"scan_cap"|"daily_ceiling",…}`, logged once per context.

**The guard fails open.** If the day's total cannot be read the ledger logs
`{"event":"daily_spend_unreadable"}` and admits the work — a guard that cannot see is not a
licence to stop the product. So an unreachable database means the ceiling is not enforced.

**Two known imprecisions, both erring the same way.** `cost_cents` is an integer while the
cheapest vendor rows cost fractions of a cent, so the stored day total is a floor: the ceiling can
be crossed slightly rather than triggered early. And the alerts at 80% and 100% of the ceiling
(`SPEND_ALERT_AT`) are mailed through the same ops template whose copy keys are empty (§6), so
**they are logged and not delivered.**

### Reading spend

**There is no owner-facing surface for spend — no page, no route, no script.** The only reader in
the product is `readDaySpendCents()`, which asks the ledger for the current UTC day and uses it as
a guard input. Until a surface exists, read it in the Supabase SQL editor:

```sql
-- today, product-wide (the figure the ceiling is checked against)
select fetches_spend_since(date_trunc('day', now() at time zone 'utc'));

-- the last 30 days, a row each
select (created_at at time zone 'utc')::date as day,
       sum(cost_cents) as cents,
       count(*)       as calls
  from fetches
 where created_at >= now() - interval '30 days'
 group by 1 order by 1 desc;

-- where the money went, same window
select source, sum(cost_cents) as cents, count(*) as calls
  from fetches
 where created_at >= now() - interval '30 days'
 group by 1 order by 2 desc;

-- the most expensive passes
select s.id, s.site_id, s.status, sum(f.cost_cents) as cents
  from fetches f join scans s on s.id = f.scan_id
 where f.created_at >= now() - interval '30 days'
 group by 1,2,3 order by 4 desc limit 20;
```

`fetches_spend_since(timestamptz)` is the function the product itself uses
(`supabase/migrations/20260909200000_fetches_daily_spend.sql`). Its `execute` is revoked from
`public`, `anon` and `authenticated` and granted to `service_role` alone; the SQL editor runs as
the project's `postgres` role, which is above those grants, so it can call it and read `fetches`
directly. Nothing else can.

---

## 9. The database

### Migrations

`supabase/migrations/` holds them, applied in filename order. The first six are zero-padded
ordinals, everything after is `YYYYMMDDHHMMSS_<topic>.sql`; the topic token is checked against a
closed registry by `tests/db/migration-naming.test.ts`, so a name outside it fails CI.

**`scripts/db-live/apply.sh` does not exist.** `ARCHITECTURE.md` says so plainly — live tooling is
M11 work — and `docs/DEPLOYMENT.md` §2 and §3 still describe it as though it did. Today a
migration reaches the live project **by hand, through the Supabase SQL editor or the connector**,
which is how the original 38 were applied (in five chunks) and how every one since has gone.

The procedure, per migration:

1. Land the PR. The migration is in `main`.
2. Re-read the file and paste it into the Supabase SQL editor on the `reachkit` project. One
   migration per run, in filename order, oldest first.
3. Re-read the **security advisor** afterwards. A new `plpgsql` function without
   `set search_path = ''` is a WARN, and `tests/db/functions-search-path.test.ts` should have
   caught it before the merge. The four `rls_enabled_no_policy` INFO rows and the
   leaked-password WARN are dispositioned in `docs/DEPLOYMENT.md` §1 and are expected on every
   run.
4. Note it in `docs/DEPLOYMENT.md` §4 with the date.

Verify a migration against a throwaway database before it reaches the live project — never against
the shared scratch database, which other work is using:

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

### The substrate

`scripts/db-substrate/` is the local Postgres + PostgREST + postgres-meta stack that the `db` and
`layout` suites talk to — a live, migrated database rather than migration text. Its own
`README.md` is the detail; the operational shape is:

```sh
eval "$(scripts/db-substrate/up.sh --run)"   # its own command; exports the bindings on stdout
npx vitest run --project db --maxWorkers=1
scripts/db-substrate/down.sh                 # the moment the suite finishes
```

- `--run` names the run after the working directory, so **one worktree, one database**. Without it
  you get the shared one, and two runs sharing a database delete each other's rows mid-flight —
  the seeded account vanishes and every `/app` address redirects to `/signin`, which reads exactly
  like a broken screen and is not.
- It exports `DATABASE_URL`, `SUPABASE_URL` (the `/rest/v1` proxy, not PostgREST directly),
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REACHKIT_DB_NAME`, `PGMETA_PORT`. Progress
  goes to stderr, which is what makes the `eval` safe.
- It applies `shim.sql` only — the roles and `auth.uid()`/`auth.role()` that live outside
  `supabase/migrations/`. The suites apply the migrations themselves.
- It does **not** start PostgreSQL; that must already be listening. It needs `psql`, `node`, and
  PostgREST via `POSTGREST_BIN` (on this box,
  `/root/projects/reachkitv3-wt/substrate/postgrest/postgrest`).
- **Stop the stack before removing a worktree.** A stack costs 150–190 MB and nothing else stops
  it: on 2026-09-07 forty-one orphaned processes from deleted worktrees held 1.66 GB of a 7.7 GB
  box, which is what the kernel was killing builds to reclaim. `scripts/db-substrate/reap.sh`
  finds every stack whose directory is gone. `down.sh --drop` also drops the database, which is
  deliberately not the default — keeping it is what makes the next `up.sh` cheap.

### Backups and restore

**The `reachkit` project is on the Supabase Free plan, which has no point-in-time recovery and no
scheduled backups to restore from.** PITR is a paid add-on on top of the Pro plan. So today the
only backup that exists is one the owner takes, and there is no automatic recovery point behind a
mistake. This is the single largest operational exposure in the product and it is owner-owed:
either upgrade to Pro and enable PITR, or run the dump below on a schedule.

**What is actually at risk.** The schema is in `supabase/migrations/` and is recoverable from the
repository. What is not recoverable from anywhere else is the *data*: accounts, sites, scans,
reports, drafts, publications, leads, and the `fetches` ledger. Stripe holds the subscriptions and
Resend holds the mail log, so billing and correspondence survive a database loss; the product's
own history does not.

**Taking a dump** (`DATABASE_URL` from the Supabase dashboard → Project Settings → Database →
connection string; it lives in the owner's shell, never in Vercel):

```sh
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  -n public -n auth \
  --file "reachkit-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Name the schemas rather than taking the default: a bare `pg_dump` of a Supabase project also
reaches internal schemas the connection role does not own and errors on them. `public` is the
product's data and `auth` is what makes a sign-in work — a dump of `public` alone restores rows
that nobody can log in to. `v2_archive` is v2's frozen objects (`docs/DEPLOYMENT.md` §1); add
`-n v2_archive` only while the v2 rollback path is still wanted.

`--format=custom` is restored with `pg_restore`, not `psql`. Keep the file off the box that runs
the product. A dump contains every customer's data: treat it as the most sensitive file the
project produces, and delete drill copies when the drill ends.

**The restore drill.** Rehearse it against a *scratch* database, never the live project. The point
of the drill is to find out that a step does not work while it does not matter.

1. Take a fresh dump, as above.
2. Create an empty scratch database. **A local one, not a second Supabase project** —
   `psql -h 127.0.0.1 -U reachkit -d postgres -c "create database reachkit_restore_drill"`.
   Restoring `auth` into another Supabase project collides with the objects that project already
   has there, which turns the drill into a debug of the drill.
3. Restore into it:
   `pg_restore --no-owner --no-privileges --dbname "<scratch url>" reachkit-<stamp>.dump`
4. Check the shape, not just the exit code. Row counts should match the source, table by table —

   ```sql
   select 'users' t, count(*) from users
   union all select 'sites',        count(*) from sites
   union all select 'scans',        count(*) from scans
   union all select 'drafts',       count(*) from drafts
   union all select 'publications', count(*) from publications
   union all select 'leads',        count(*) from leads
   union all select 'fetches',      count(*) from fetches
   order by 1;
   ```

   — and the policies should have come across with them:

   ```sql
   select tablename, policyname from pg_policies
    where schemaname = 'public' order by 1, 2;
   ```

   Both are cheap to run against the source first and diff.
5. Point a local `next dev` at the scratch database — `SUPABASE_URL` and the keys from that
   project — sign in, and open `/app`. A restore that produces rows but not a working sign-in has
   not restored the `auth` schema, which `pg_dump` of the `public` schema alone does not carry.
6. Drop the scratch database and delete the dump copies.
7. **Record the drill here**, in the log at §11, with the date, the dump size, the restore time
   and anything that did not work. A drill that is not written down did not happen.

**Restoring for real** is steps 3–4 against the live project with the product stopped first: flip
`KILL_SWITCH` (§5) and redeploy so nothing writes while the restore runs, restore, verify, then
release it. Expect to lose everything between the dump and the incident — with no PITR there is no
finer granularity than the last dump. That gap is the argument for taking dumps often.

**The rollback to v2** is a different procedure and is not this one: it is
`alter table v2_archive.<t> set schema public` per table plus promoting the frozen v2 deployment,
recorded in `docs/DEPLOYMENT.md` §3.6.

---

## 10. Quick reference

| Situation | Go to |
|---|---|
| a PR is green and should ship | §1 — `scripts/land.sh <pr>` |
| the site is 500ing | §7 — read the runtime log, find the last `boot_invariants` line |
| every page 500s and nothing changed | §2 — the Supabase project may have paused after seven idle days |
| nothing has published for days | §4 — is the Inngest app registered? The ticks are silent when it is not |
| spend looks wrong | §8 — the SQL is there; `fetches` is the truth |
| stop the spend now | §5 — `KILL_SWITCH=true` on every target, **then redeploy** |
| a key leaked | §3 — rotate: mint, paste both targets, redeploy, verify, revoke |
| a migration needs to reach production | §9 — by hand, through the SQL editor; `db-live` does not exist |
| the database is gone | §9 — and read the plan warning first |
| `Vercel` fails on every PR | §1 — the Hobby plan's 100 builds a day. It is not a required check; nothing is blocked |

---

## 11. Drill and incident log

Newest last. A drill or an incident that is not written here did not happen.

_(empty — this page was written 2026-09-10 and no drill has been run against it. The first
restore drill is owed; see §9.)_
