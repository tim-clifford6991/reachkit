# Runbook — operating ReachKit alone

Operations only: envs, bindings, jobs, kill switch, mail, boot failures, cost ledger, database.
How work flows is `docs/PROCESS.md`. What the product does is `docs/SPEC.md`. Nothing here is read
by the running app.

---

## 1. Landing a change

How a change reaches `main` is `docs/PROCESS.md`: the four gates (`typecheck · lint · unit`,
`audit`, `schema · RLS`, `no overflow · axe`), then `gh pr merge --squash --delete-branch`
(or the GitHub UI). A documentation-only pull request merges on a green `audit` alone; the
browser gate reports success with a reason wherever no screen can change.
This page starts after the merge.

2026-10-08  **The guard watches the box** (owner, #1348). `rk-guard` reports low memory,
swap, load, leaked processes whose directory is gone, and heavy work in the main checkout
`/root/projects/reachkitv3`. A layout run, a browser sweep, and a production build on this box
are the gates and the deploys.

2026-10-08  **Hygiene runs every day** (owner). `scripts/hygiene.mjs` is part of the
`audit` gate. On a pull request a finding fails the check. The nightly drift-audit
run, and `rk-hygiene.timer` at 05:30 UTC, file one open issue titled `[hygiene]` when
the check is red and comment on it when it is still red. The timer runs
`/root/ops/reachkit/bin/hygiene.sh`, which executes that script with `--box` so the
template, the units, and `/root/ops/reachkit` are included. The shell file only finds
the script. The log is `/root/ops/reachkit/log/hygiene.log`. A green run changes nothing.

2026-10-15  **The box folders are checked by hand** (owner, #1463). `node scripts/box.mjs`
reports worktrees and leftovers. `node scripts/box.mjs --clean` removes only an empty
directory on its list, a loadgen folder that holds a Next cache, and a closed-sessions
spreadsheet. It leaves every worktree, including a dirty one. It is not on the timer
and it is not a gate.

Dev (`dev.reachkit.app`) deploys from `main` via `rk-deployer`. If it has not moved after a
merge, run `bash /root/ops/reachkit/bin/deploy-dev-once.sh`. Production is batched (at most
every two hours) and receives every merge, the same as dev (no freeze, owner 2026-09-17, #844).
`/api/jobs` is served by production, so a job or pass change takes effect only once production is
deployed. `Vercel` is not a check: Git deployments are off (`vercel.json` `git.deploymentEnabled: false`).

The owner tests the path live on `dev.reachkit.app` for taste and for the stranger walk. Conditions and screen strategy are already the gates (`docs/PROCESS.md` Coherence, `docs/DESIGN.md`). This live pass is not a second check of those. A merged migration is applied through the
Supabase connector after the target deploy is READY, then the path is walked again
(`scripts/smoke.sh` / `scripts/land.sh`).

### Rolling back a deploy: we do not

**Roll forward only** — SPEC §2, 2026-09-18 (#887). A bad production build is fixed by the *next*
production deploy: a revert commit merged to `main` and deployed like any other change. Production
is never pointed back at an earlier build.

That is not a preference, it is what the stored report format allows. A report blob carries the
version of the build that wrote it, and `src/lib/scan/report.ts` lifts a blob **forward only** —
`upgradeFromVersion3` … `upgradeFromVersion9`, chained, with nothing going the other way.
`readStoredReport` throws `stored report version N is not readable by this build (expected M)` on a
blob it cannot lift, and that includes every blob written by a *newer* build. So an older build put
back on `reachkit.app` does not degrade on a newer report; it fails on it. Of the nine call sites
that read a stored report, three catch (the lead-mail offer reader and page writer, the Monday
market digest) and degrade to "could not read"; the other six — the Overview, opportunities,
verdicts, both weekly readers, the draft generator — let it throw, as do `readCurrentReport` and
`readScanReport`. The owner met exactly this on 2026-09-17: *"stored report version 9 is not
readable by this build (expected 6)"*, which is what made a frozen production look like a broken
app.

`REPORT_VERSION` is **10** today and has risen most weeks. The set of builds production could
safely be pointed back at is therefore only those since the last bump, and that set empties at the
next one, silently. Nothing in a deploy checks it.

**What can hand you a rollback, and what cannot:**

| | |
|---|---|
| `bin/redeploy.sh`, `bin/deploy-dev-once.sh`, `bin/deployer.sh` | **Cannot.** All three POST `gitSource.ref: "main"` — the tip of `main` at the moment of the call. None takes a commit, a ref or a deployment id, so no script on this box can put an older build on `reachkit.app`. This is already protected, by having no argument to abuse |
| Vercel — the dashboard's rollback/promote control, `vercel rollback`, `vercel promote`, `POST /v1/projects/{id}/rollback/{dpl}`, `POST /v10/projects/{id}/promote/{dpl}` | **Can.** Production deployments are retained and the previous one is flagged a rollback candidate; promoting it re-aliases `reachkit.app` with no rebuild, in one click. Nothing prevents it. This door stays shut by decision, not by a guard — do not walk through it |
| A deploy that fails to build | **Not a rollback at all.** A failed build is never aliased: `reachkit.app` keeps serving the build it already had. Nothing was reverted because nothing was replaced |

**So when production is broken:** `KILL_SWITCH` (§5) first if it is spending or writing wrongly,
then a revert commit on `main`, then a deploy. Reverting the *code* does not revert the *blobs* an
intervening build already wrote — if the break is in what a pass stored, that is a data problem and
§9 is the page for it.

Supporting a real rollback was costed and declined under #887: `readStoredReport` would have to
tolerate a newer blob by reading only the members it understands, every one of its ~30 members
would need a not-present arm at every reader, and every future version bump would have to state
what an older build silently loses. It buys back one click that has never been needed.

### Where CI runs

Owner, 2026-09-25 (#1113); the rules are in `docs/PROCESS.md` Gates. The light jobs — `what
changed`, `typecheck · lint · unit`, `schema · RLS` and `audit` — take their runner from the
repository variable `CI_LIGHT_RUNNER`. Unset, they run GitHub-hosted and in parallel. Set to
`["self-hosted","reachkit-light"]`, they run on the box's second runner. The browser job always
runs on `reachkit-box` (label `reachkit`), the only runner that takes it, when the pull request
can change a screen. Where it cannot (`scripts/ci-changes.mjs`), the browser job is a light job
that prints its reason and passes, and `Layout nightly` (`.github/workflows/layout-nightly.yml`)
sweeps `main` on `reachkit-box` at 02:41 UTC and opens or comments on one issue titled
`[layout] nightly sweep on main is red` when it fails (owner, 2026-10-18, #1525).

| Do | Command |
|---|---|
| light jobs to the box (hosted jobs fail with *"recent account payments have failed or your spending limit needs to be increased"*) | `gh variable set CI_LIGHT_RUNNER --body '["self-hosted","reachkit-light"]'` |
| light jobs back to hosted | `gh variable delete CI_LIGHT_RUNNER` |
| see which | `gh variable list` (no `CI_LIGHT_RUNNER` = hosted) |

**The runners on the box.** Both run as `ghrunner`, one directory each under `/home/ghrunner`:

| Runner | Labels | systemd unit | Limits |
|---|---|---|---|
| `reachkit-box` | `self-hosted, reachkit` | `actions.runner.tim-clifford6991-reachkit.reachkit-box.service` | drop-in `nice.conf`: `Nice=15`, cores 0–1 |
| `reachkit-light` | `self-hosted, reachkit-light` | `actions.runner.tim-clifford6991-reachkit.reachkit-light.service` | drop-in `limits.conf`: `MemoryMax=1536M`, `MemorySwapMax=1G`, `Nice=19`, `CPUWeight=20`, `IOWeight=20` |

`reachkit-light` has no `reachkit` label, so a browser sweep never lands on it. To recreate it, run
`sudo bash scripts/ci-runners/install-light-runner.sh` from a checkout, as root. It copies the
first runner's binaries, registers the new runner with a registration token, installs the service
and writes the limits. The script's header says how to remove it. If a typecheck on it is
killed for memory, the ceiling is too low for that job. Raise `MemoryMax` in the drop-in, keeping
`rk-guard`'s 1.2 GB available-memory floor in mind.

**The minutes switch.** `rk-ci-switch.timer` runs `/root/ops/reachkit/bin/ci-minutes-switch.sh`
hourly, beside `rk-deployer` and `rk-guard`, and logs every flip to
`/root/ops/reachkit/log/ci-switch.log`:

- **To the box:** it sets `CI_LIGHT_RUNNER` when a hosted job this cycle was refused for
  billing, or at 90% or more of the cycle's included Actions minutes. A billing refusal is a
  failed payment or the spending limit, and minutes have nothing to do with it (#1119). It
  records the cycle and which of the two it was in `/root/ops/reachkit/state/ci-switch`.
- **Back to hosted, after minutes:** only in a new cycle (day `RK_CI_RESET_DAY` of the month,
  UTC), with the minutes readable and below 90%, and with the last hosted job not refused for
  billing. Minutes it cannot read count as unavailable.
- **Back to hosted, after billing: by hand only**, once Billing & plans is fixed. Run
  `gh variable delete CI_LIGHT_RUNNER` and `rm /root/ops/reachkit/state/ci-switch`. A failed
  payment does not reset with the month.
- **A value set by hand is left alone.** On 2026-09-25 the orchestrator set
  `["self-hosted","reachkit"]` after #1119's hosted jobs were refused for billing.

To recreate it, run `sudo bash scripts/ci-runners/install-minutes-switch.sh`. It ends with a dry
run, which says what the switch can read.

**What it cannot read yet.** The minutes are `GET /users/tim-clifford6991/settings/billing/actions`,
which needs the `user` scope. The box's `gh` token lacks it. Until someone runs
`gh auth refresh -h github.com -s user` as root, the switch cannot flip at 90%. It still flips to
the box on a billing refusal, and it never flips back by itself.

---

## 2. Environments

| | |
|---|---|
| Rule | one Vercel project, one Supabase project, one set of bindings (owner, 2026-09-08) — no duplicate projects, environments or databases |
| Vercel | team `timclifford` (`team_lFEcKlyuKD5risdEnak7iRIm`), **Hobby plan** (one concurrent build, 100 deployments a day, no deployment protection); project **`reachkit`** (`prj_QJUivDYYshplvV0enuc2oZNIjcnd`), Git-linked to `tim-clifford6991/reachkit`, production branch `main`, Node 24, Next.js preset, no root directory |
| Production | `reachkit.app` (and `www.`) |
| Development host | `dev.reachkit.app` — the same project, bound to `main`. It is the URL the owner steers on; it is not a separate environment |
| Preview | none. Git deployments are off (`vercel.json` `git.deploymentEnabled: false`): every push used to create a cancelled deployment that still counted toward the Hobby quota. The deployer asks for each deployment of `main`; the owner reviews on `dev.reachkit.app` |
| Database | one Supabase project, `reachkit` (`kleepxxddbcnfsfwudoe`), Postgres 17, us-east-1, **Free plan**. v2's objects sit in schema `v2_archive`, the rollback path (§9). The org is Vercel-Marketplace-managed: uninstalling that integration would delete the org and the database; the exit path is a transfer to a Supabase-managed org |
| Jobs | Inngest app `reachkit`, registered at `https://reachkit.app/api/jobs` — owed by the owner: create the app, paste the two keys, sync the functions (#315, §4) |
| Mail | Resend, sending domain `reachkit.app`; `MAIL_FROM` is `hello@reachkit.app` (§6). #325 got the domain sending; DMARC, the return path and one real inbox are `docs/GO-LIVE.md` §2 and #339 |
| Payments | Stripe: one product `ReachKit`, one €49/month tax-inclusive price bound as `STRIPE_PRICE_ID`; v2's products and prices inactive; webhook `/api/stripe/webhook`; customer portal on. **Production's three Stripe bindings are live-mode values**; the preview target, which `dev.reachkit.app` answers on, carries the test-mode trio and its own test webhook. No live payment has completed yet: what remains is `docs/GO-LIVE.md` §1.1. The dashboard steps, and the test-mode walk that proves them, are `docs/stripe-setup.md` |
| Hosted CMS | customers point `content.{their-domain}` at `HOSTED_EDGE_CNAME_TARGET` (`edge.reachkit.app`); per-customer domains are added to the project through the Vercel Domains API (#322) |
| Local | `npm run dev` on `http://localhost:3000`, bindings from `.env.local` (names in `.env.example`) |

2026-10-02  **The dogfood's hosted host is `content.reachkit.app`** (owner, #1045: "fix this to be content.reachkit.app for dogfooding purposes"). Its destination row (`9fae8a2d…`, site `reachkit.app`) is re-pointed from the preview-only `reachkit-hosted-test.vercel.app` with one SQL update through the Supabase connector, because no product path changes an existing hosted host: `hostname = 'content.reachkit.app'`, `hostname_state = 'pending_dns'`, `hostname_checked_at = null`. The row keeps its id, so its publications stay attached. The host is then attached to the project only through the product's own code (`checkHostnameNow` → `addProjectDomain`, the Settings › Publishing Check), never by hand in the Vercel dashboard, so the path is proven.

**The Supabase Free plan pauses a project after seven idle days.** The hourly job ticks keep it
awake once Inngest is registered (#315); until then, an untouched week pauses the database and
every page 500s. Unpause is a button in the Supabase dashboard.

---

## 3. The bindings

`src/lib/config/env.ts` is the schema, and it is the authority: **a missing or malformed binding
is a boot failure, not a runtime `undefined`.** There is no default and no fallback anywhere in
it, so a deployment cannot start half-configured. `.env.example` lists every name with a blank
value; a real credential in that file is a defect (`tests/app/env-example.test.ts`).

**Who sets each.** The owner pastes every secret and every plain row in the Vercel dashboard
(production and preview). Sensitive rows are write-only. **Every binding must exist on both
targets**; a target missing one cannot build.

Twenty-four names are in the schema. Two more sit outside it, for stated reasons.

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
| `VERCEL_API_TOKEN` | adds a customer's hosted host to the project's domain list and reads back whether it is verified (`src/lib/vendors/vercel/domains.ts`) | ● | optional in the schema, **required for any hosted host to reach "live"**. Absent, setup's save and the scheduled pass attach nothing, and the founder's "check connection" press answers "could not ask" (#757). **It must be scoped to the team `timclifford`**: a token of another scope is answered 403 even with `VERCEL_TEAM_ID` set. On production and preview since 2026-09-23, replaced by a team-scoped token on 2026-10-02 (#1045) |
| `VERCEL_PROJECT_ID` | the project those hosts are added to | | same: optional in the schema, required with the token. An identifier, not a secret |
| `VERCEL_TEAM_ID` | the team that owns the project (`team_lFEcKlyuKD5risdEnak7iRIm`), sent as `?teamId=` on every Domains API call | | optional in the schema, **required with the token for this team-owned project**: without it the vendor answered 403 to every attach on production (2026-10-02, #1045). Set on production and preview 2026-10-02. An identifier, not a secret |
| `POSTHOG_API_KEY` | product analytics ingestion — the three events of issue 336 | ● | optional; absent, nothing is captured |
| `POSTHOG_HOST` | the PostHog region's ingestion host | | optional; defaults to `https://us.i.posthog.com` |
| `HOSTED_TEST_HOST` | one generated `*.vercel.app` host the middleware serves as a customer's hosted blog, so hosted publishing can be walked with no domain (#762) | | **a dev/preview testing aid only.** Optional; exact host, no pattern. Ignored when `VERCEL_ENV` is `production` and when it equals `NEXT_PUBLIC_APP_URL`'s host. A destination row whose hostname is this host is what it resolves to |
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

Ten, closed. The registry is `src/jobs/index.ts` and it is a frozen array — a definition that is
not in it is unreachable over HTTP. `src/jobs/client.ts` is the only file that names the platform.

| Job | Trigger | Does | In the kill switch |
|---|---|---|---|
| `scan/run` | event `scan/run` | the one pipeline; tier is a parameter | ● |
| `draft/generate` | cron `0 * * * *` | next opportunity → pipeline → `in_review`, veto clock starts, daily mail. The tick is hourly; a site's page for a date is written in the hour whose start plus its veto window is at, or less than an hour before, that date's publish time in the site's zone (#1337). The tick sends each due site as `draft/generate/subject`, keyed `draft:{site}:{date}`, to its own run (`draft-generate-subject`): one per site, five at once, ten starts a minute; steps `notice`, `select`, `write`, `review`. A day owed with nothing recorded in `draft_days` is sent on the next tick while its window is open | ● |
| `publish/execute` | event `publish/execute` | state machine → destination | ● |
| `publish/verify` | event `publish/verify`, +24h | liveness checks on a published page | |
| `publish/retry` | cron `0 * * * *` | claims failed pages whose retry moment has come round | ● |
| `weekly/refresh` | cron `0 * * * *` | weekly scan per active site, gated on that site's local Monday. The tick's step is `due`; each due site is sent as `weekly/refresh/subject`, keyed `weekly:{site}:{week}`, to its own run (`weekly-refresh-subject`, bounded as the draft one), whose steps are `measure-…`, up to three `late-answers-…` (free reads of queued answers, #1160), `search-…` and `tell-…` | (stopped inside the run, not by the runner) |
| `lead/nurture` | cron `0 * * * *` | advances sequences over `next_touch_at` | |
| `account/maintenance` | cron `*/15 * * * *` | five due-work queries: a payment awaiting sign-in, a payment with no account, a hosting-end notice, a hosting stop, an account due for purge | |
| `scan/rescore` | cron `*/15 * * * *` | answers the oldest `rescore_runs` request: every stored scan and rival set scored again, dry or applied (issue 1433, "Re-scoring every stored scan" below). Steps: `claim`, then `answer-<id>`; `skipped` / `no-subject` when nothing is asked | |
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
| every cron job within its interval (`account/maintenance` 15 min, the other four 60 min) | the crons fire; `skipped` is a tick with nothing due, not a fault |
| one job far behind the others | that function stopped — check it is synced on the `reachkit` app in Inngest |
| every row old, or the table empty | nothing is firing: the app is not registered or synced, or `/api/jobs` is not answering (*Running one by hand*, #315) |
| a job with no row at all | it has never run against this database — an event job nobody has sent yet, or a cron that never fired |

**The stale-job alert.** After recording its own run, each invocation reads the other rows. A
scheduled job whose `last_run_at` is more than **twice its interval** ago is mailed to
`OWNER_EMAILS` through the incident mail (§6): *"A scheduled job has not run for more than
twice its usual interval."* with the job, its last run and its interval. `stale_alerted_at` records
that mail; the job is not mailed again until it has run and gone quiet again.

The alert is carried by the jobs themselves — Vercel Hobby's crons are daily, so there is no
second clock to watch the first. One job stopping is caught by the others (the 15-minute
maintenance tick watches the hourly four, and they watch it). **Every job stopping sends no
mail**, because nothing runs to notice: that is the "every row old" line above, and the reason to
read the table after a deploy or a sync. The heartbeat is installed only where `/api/jobs` mounts
the registry; a failed write logs `{"event":"job_heartbeat","outcome":"record-failed"}` and never
fails the job.

### Why a site had no page on a date

`job_runs` keeps one row per job, so an hourly `skipped` overwrites the due hour that wrote nothing,
and Vercel Hobby keeps one hour of runtime logs. The draft tick also keeps one row per site and
date in `draft_days` (issue 1455): how that date's due hour ended (`drafted`, `no_page`, `failed`)
and why (`reason`, the engine's step such as `generate:no_opportunity`, or the error's class name):

```sql
select s.domain, d.publish_date, d.outcome, d.reason, d.decided_at, d.missing_alerted_at
from draft_days d join sites s on s.id = d.site_id
order by d.publish_date desc limit 30;
```

In the hour a paying, publishing site's publish time falls in, a date with no page going out is
mailed to `OWNER_EMAILS` once (*"A site's publish time passed with no page for the day."*), with that
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
finished (`docs/stripe-setup.md`) and the Inngest app registered (above).

**What starts it: completing setup, and nothing else.** `enqueueDeepPass`
(`src/app/(account)/setup/_setup/store.ts`) sends `scan/run` with `tier: "deep"`. There is no
second trigger — the port `src/lib/account/provisioning/deep-pass.ts` offers is registered by
nothing, so the `queueDeepPass` call provisioning makes at payment answers `not_wired` and queues
no pass.

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
   writable days out of `PLAN_DEPTH` (a week of seven and three spares), after the 0¢ refill;
   `{"event":"supply_refill",…,"short":true}` says the stored questions ran out first. The week
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
(owner, 2026-10-14, issue 1426; SPEC §2): a dry run, then an apply. It costs 0¢. It runs in
production as the `scan/rescore` job (issue 1433), with the deployed code, reading the rows
themselves. It asks no model, and the network is refused while each scan is scored. Nothing is
exported, and no change is typed back through the connector.

**Nobody asks for it (issue 1481).** The build stamps the deployment with its derivation
(`RK_DERIVATION`, from `scripts/derivation.mjs`: a fingerprint of the files under `src/lib` the
re-score reads a scan with; `node scripts/derivation.mjs --files` lists them). Production's tick,
every 15 minutes, finds no run at the deployed derivation and asks a dry run itself
(`auto = true`). A dry run that moves nothing settles it. Where the dry run's guard holds
(`RESCORE_GUARD` in `src/lib/config/constants.ts`: no score moves more than 15 points, no scored
scan loses its number, no more unreadable scans than the run before), the next tick asks the
apply, and the tick after it a dry run that checks the apply. A deploy whose fingerprint did not
change asks nothing. Dev's ticks never ask: it reads the same database with newer code.

Where it stands at the deployed derivation:

```sql
select requested_at, mode, auto, derivation, finished_at, scans_changed, scans_left,
       scans_unreadable, held, error, cardinality(stale_scans) as stale
from rescore_runs order by requested_at desc limit 6;
```

**A held run.** `held` says why the guard stopped the apply, or that the check still found scans
moving after it; `error` says a run failed. Nothing more is asked at that derivation, and every
tick records `scan/rescore` as `degraded` at `rescore-held` in `job_runs` until it moves on. Each
public report in `stale_scans` says when it was read and that the reading has changed since. Read
the summary (step 2 below). If the moves are the change you meant, ask the apply by hand (step 3);
the tick then asks the check itself. If they are not, the fix is a code change, and its deploy is a
new derivation that starts over.

To ask by hand, as before:

1. **Ask for a dry run** through the Supabase connector:
   `insert into rescore_runs (mode) values ('dry') returning id;`. The job ticks every 15 minutes,
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
4. **Check**: ask for another dry run. `scans_changed` and `sites_moved` read 0.

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
its fix call, and keeps them under `docs/walk/prose-gate/`. `--prose --judge` writes reachkit.app's
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

`npm run panel -- --env-file ../../reachkitv3/.env.local` runs every site of
`docs/walk/panel/sites.json` through a paying site's first pass (SPEC §0, owner 2026-10-07, #1304):
the site read, the market concluded with its terms, the searches seeded and asked, the knowledge
base, the rivals with their demand, and the topics. The first page is not written, no second pass
is started, and a first pass asks no tracked prompts. It runs on the box's local database and takes
only the two vendors' keys from the env file, so it writes nothing to production; a request to any
other host is refused. The site's own pages, and each concluded rival's home page (to check the
domain is the rival's, #1314), are read by the product's own fetcher at no cost.

It prints each site's checks as `pass`, `FAIL` or `review`, with the site's cost, and writes
`docs/walk/panel/<date>.json` and `<date>.md` after every site. `review` is a result the code
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

`npm run free-scan -- --env-file ../../reachkitv3/.env.local --sites a.com,b.com` runs the free
scan a stranger starts from the landing page on the named sites (#1438), on the same local database
and with the same two keys as the panel (`scripts/local-run.mjs`): the slot is claimed as
`POST /api/scan` claims it, one network per site, and the product's own
`runScan({ domain, tier: "free" })` runs under its 50 s ceiling and 12¢ cap, raced against the
route's request budget. Nothing is written to production.

Per site it writes the score, the four drivers or why each is unmeasured, the locale and stated
place, each question (its search, whether the results were read, where the site ranks, the AI
Overview and whether it names or cites the site, the local pack), the rivals, the cost and the time
to `docs/walk/free/<date>.json` and `<date>.md`. A second run on a date adds to that date's files.

| Flag | Does |
|---|---|
| `--cap-cents <n>` | The whole run's ceiling. Default 100. A site is started only while 12¢ is left; past the cap every paid request is refused. |
| `--recheck` | Buys nothing and starts no database: scores that date's stored scans again with the current code through the production re-score's path (`rescoreRow`), and writes `<date>.recheck.md`, the before and after. |
| `--date YYYY-MM-DD` | The run's result files. Default today. |
| `--keep` | Leaves the local database up. |

## 5. The kill switch

`KILL_SWITCH=true` stops the paid work. The scope is closed and named:
`KILL_SWITCH_SCOPE` in `src/jobs/kill-switch.ts`.

**Stopped:** `scan/run` · `scan/finish-reads` · `draft/generate` · `publish/execute` · `publish/retry`. The guard runs
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

One transport (Resend), one shell, plain-text alternative, no generated prose — `docs/SPEC.md` §8.

The sending mailbox is `MAIL_FROM`, read at the send in `src/lib/mail/vendor/resend.ts` (#81);
before that it was derived as `hello@<host of NEXT_PUBLIC_APP_URL>`, which was only ever the right
address on production. Its domain must be a verified Resend sending domain with SPF, DKIM and
DMARC in place, or nothing leaves — and the mailbox itself must be one somebody reads:
`optout.invalid` tells a reader to reply to it and ask to be removed by hand.

The From carries the product's name, `ReachKit <hello@reachkit.app>`, and Reply-To is the same mailbox
(#1568). The sender logo in inboxes (DMARC, BIMI, a mark certificate, or the Google-account fallback)
and Stripe Checkout's branding are owner steps in `docs/runbooks/brand-in-inboxes-and-checkout.md`.

**A mail with an unwritten sentence does not send.** `copy()` refuses an empty key, `sendEmail`
answers `not-composable`, and the attempt is logged. This is the ruling of 2026-09-05 — a mail
never ships a placeholder — and it is why the ops alerts in §5 and §7 are currently silent. The
fix for every one of them is the owner writing the copy key, never a code change.

Failed and unsent mail is visible in two places: Resend's own dashboard for what left, and the
runtime log for what did not (`event: "spend_alert_failed"`, and the per-kind `*_not_sent` lines).

### Verifying the sign-in link end to end

The only door into the paid product, walked in order. Every observation below is one the browser or
`curl` shows; nothing here changes a setting. Last walked on dev on 2026-09-22 (#542), which this
sequence is written from. On dev use `https://dev.reachkit.app`; on production, `https://reachkit.app`.

1. **An account must exist for the address — and the screen will not tell you whether it does.** A
   link is only ever sent to an address the `users` table already holds
   (`src/lib/account/provisioning/magic-link.ts`), and the account is created by the payment
   webhook, never by a form (`docs/SPEC.md` §3). So either complete one checkout at `/pricing` with
   an `OWNER_EMAILS` address (#319), or confirm the row first: Supabase → Table editor → `users`,
   one row whose `email` is that address, with an `auth.users` row of the same `id`. Since #718 the
   sign-in screen answers every address with the same line, so it is not a way to check this.
2. **Ask for the link.** Open `/signin` on the host under test, type the address into the one field
   and press **Send my sign-in link**. Expect the screen to turn to **Check your inbox** — *If that
   address has an account, a sign-in link is on its way.*, the address echoed under it (*sent to …*),
   and *It works for 24 hours, and a newer link replaces an older one.* The same screen appears
   whether or not the address has an account.
3. **The mail.** Subject **Your sign-in link**, from `MAIL_FROM` (`ReachKit <hello@reachkit.app>`), within a
   second or two; the line *One click signs you in on this device. The link works once and expires
   in 24 hours.*; one **Sign in** action. Resend's dashboard shows what left; a mail that did not
   compose or send is in the runtime log as `mail_not_composable` or `sign_in_link_not_issued`
   (§6 above).
4. **Follow it.** The action is `…/auth/confirm?token_hash=…&type=magiclink` **on the host you
   started from** — this product's own, never Supabase's `action_link`. Expect `307` to `/app`
   (to `/setup` on a first-ever sign-in), one `sb-…-auth-token` cookie set on that same redirect,
   and `/app` rendering the dashboard with *Overview · Plan · Settings*.
5. **Use it twice.** Re-open the same confirm URL: `307` to `/signin?link=dead`, no cookie, and the
   screen **This link no longer works** with the request form on it (**Send a new link**). A spent
   link, a link superseded by a newer one, a token this product never issued and a confirm URL with
   no query all answer identically — that sameness is the point.
6. **The gate.** In a private window, `/app` answers `307` to `/signin` — a redirect, never an error;
   with the session from step 4 it serves.

A link lasts 24 h (`SIGNIN_LINK_TTL_H`), but it is Supabase's own OTP expiry that spends it, so the
two must agree. So must what the customer is told: the mail's line and the answered screen's line
both state the lifetime, and `tests/account/identity/otp-expiry.test.ts` holds the setting and both
sentences to that one number (#1019). The Auth dashboard settings this walk depends on — Site URL, `/auth/confirm` on the
redirect allow-list, Email OTP expiry 86400 s — are the owner's, listed in §11 under 2026-09-10.

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
| 6 | `checkout` | `PriceObjectMismatch` | the live Stripe Price behind `STRIPE_PRICE_ID` differs from the spec at `unit_amount`, `currency`, `recurring.interval` or `tax_behavior` | the message names the field, the expected value and the found one. Those fields are immutable on a Stripe Price, so the fix is a **new** price built to the spec and `STRIPE_PRICE_ID` repointed at it |
| 6b | `checkout` | `PriceObjectUnknown` | Stripe answered that the price behind `STRIPE_PRICE_ID` does not exist — in practice, a test-mode price id asked for with a live-mode key or the reverse (#889) | the message names the mode of the configured `STRIPE_SECRET_KEY`, never the key. Bind a price created in that mode, or repoint the key. The three Stripe bindings move together (`docs/GO-LIVE.md` §1.3). Any *other* error — a Stripe outage, say — still logs `{"check":"checkout","outcome":"unchecked"}` and the deployment serves: a read that did not happen establishes nothing |

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
3. **If it is the price**: `PriceObjectMismatch` names the field and both values; `PriceObjectUnknown` means the price is not in the configured key's Stripe mode, and the message names that mode.
4. **If nothing in the log is a boot invariant**, it is not this section: check whether the
   Supabase project has paused (§2) and whether the Vercel build limit was reached (§1).

---

## 8. The cost ledger

Every vendor and model call goes through the seam in `src/lib/costs/`, and every call that
actually spent writes one row to **`fetches`**. That table is the source of truth for spend.
`scans.cost_cents` and `drafts.cost_cents` are its roll-ups, and the database computes them
(issue 1478): whatever a process writes there is replaced by the ledger's sum.

`fetches` — `supabase/migrations/20260903080000_fetches.sql`:

| Column | |
|---|---|
| `scan_id` | the scan the spend belongs to (a draft's spend is keyed to its grounding scan) |
| `source` | the vendor endpoint or model id, free text |
| `cache_key`, `policy_version` | what was bought, and under which generation of the derivation |
| `reserved_cents` | what the cap was checked against |
| `cost_cents` | what it settled at, from our own price list |
| `billed_cents` | what the vendor says it charged for the call, read from its response (#1408). Null where the response carried no charge: a model call, an own-page read, a timeout, and every row before 2026-10-11 |
| `site_id` | the scan's site, filled on insert (issue 1478). Null for a free scan |
| `activity` | why: `free_scan`, `onboarding`, `weekly`, `draft`, `rescore` (a deep pass after the site's first), `smoke`, `test` (a reserved example domain) or `box`. Filled on insert from the scan; a draft's cost context writes `draft` |
| `draft_id` | the draft the call was made for, named once the draft has a row |
| `outcome` | `ok`, `failed` or `timeout`, read from the stored payload on insert |
| `created_at` | when |

RLS is on with no policy — default-deny — so it is reachable only through `dbAdmin()`. **No cost
figure is ever rendered to a customer.** Migration `20261017130000_fetches_attribution.sql`
(issue 1478) added the four attribution columns, filled them for every older row at 0¢, and
added the roll-up triggers: `scans.cost_cents = carried_cents + Σ cost_cents` over the scan's
rows that are not a draft's, `drafts.cost_cents = carried_cents + Σ cost_cents` over the draft's.
`carried_cents` is what a retry carries from the report it retries, and on a draft written before
2026-10-17 the part of its figure no row could be matched to.

### The caps

`src/lib/config/constants.ts`, `CAPS`, in cents. Per pass: free `12` · deep `150` · weekly `40` ·
draft `45`. Product-wide: `DAILY_PRODUCT_C = 5000` for one **UTC** day, measured over
`fetches.cost_cents`. The unit prices behind them are `PRICE_BOOK` in that same file.

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

**The owner's surface for production spend is the Monday digest** (SPEC §6, D57, #1286). Its cost
section reports the seven dates before that Monday: per site the average cost of a measurement and
of a page written (stopped pages included) with how many there were, the site's total, free scans
and smoke tests on separate lines, the ledger's total for the week, and (D63, #1298) the share of
the week's Google SERP reads that timed out with what those reads were billed. `scripts/smoke.sh` sends
`"smoke": true` with its scan start and the route stores it as `scans.smoke`, which is what tells a
smoke test from a customer's free scan:

```sql
-- last 7 days of free passes, smoke tests apart
select smoke, count(*) as scans, sum(cost_cents) as cents
  from scans
 where tier = 'free' and created_at >= now() - interval '7 days'
 group by 1;
```

**The owner's page is `/app/costs`** (issue 1478), signed in at one of `OWNER_EMAILS`; every
other account gets the 404, and it is not in the navigation. It reads `cost_site_day` and
`vendor_days` for the seven UTC days to today: each site's and each segment's week (free,
smoke, test, box), estimated beside billed, with its month at that pace against €40.50 net; each
site each day; the week by activity with its failed and timed-out calls; each vendor-day's
recorded spend beside the vendor's own bill, and the gap; and each day against D34's €2, judged
on billed spend where known. `cost_site_day` is the ledger grouped by UTC day, site or segment,
vendor and activity; a free scan's rows count for the site provisioned from it:

```sql
-- the week by site or segment, estimated beside billed
select coalesce(site_id::text, segment) as who, sum(estimated_cents), sum(billed_cents),
       sum(billed_calls) as priced, sum(calls) as calls, sum(judged_cents)
  from cost_site_day where day >= current_date - 6 group by 1 order by 6 desc;
```

For anything the digest does not say, read the ledger in the Supabase SQL editor. The only other
reader in the product is `readDaySpendCents()`, which asks the ledger for the current UTC day and
uses it as a guard input:

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

### Test spend from the box

Paid calls a script makes from the box never reach `fetches`: the box has no database key. Each one
appends a line to **`/root/ops/reachkit/spend.jsonl`** instead (SPEC §6, D57, #1286):

```json
{"at":"2026-10-06T09:14:02.118Z","issue":"1286","script":"page","source":"llm:writer","cents":4.21}
{"at":"2026-10-11T08:43:24.949Z","issue":"1408","script":"pass","source":"serp/google/organic","cents":0.2,"billed":0.2}
```

`issue` is the number of an `issue-<N>` branch, else the branch's name. `cents` is the price
book's figure. `billed` is the vendor's own charge for that call (#1408), and is absent where the
response carried none, which is every model call. A call that settled at nothing and was billed
nothing writes no line. The scripts that write it are `npm run page`, `npm run pass -- --live`, `npm run panel`, `npm run free-scan`, `scripts/market-inference.mjs`,
`npm run eval:content`, `scripts/d19-cost.mjs` and `scripts/llm-mentions-pilot.mjs`; they all go
through `appendSpend()` in `scripts/spend-log.mjs`, and **a new script that calls a vendor or a
model calls it too**. `RK_SPEND_LOG=<file>` writes to another file. The file is not in the
repository and is not rotated: to recreate it, nothing is needed — the first paid call creates it.

### What the vendors billed

Every cent above is our own estimate. The audit of 2026-10-11 found the price list 1.7 times
DataForSEO's bill for that day, and $56 of the account's lifetime spend in no record (#1408).
Three things now hold the estimate against the bill.

**Each call.** A DataForSEO response states its own charge (`tasks[0].cost`, US dollars).
`fetches.billed_cents` and the spend log's `billed` keep it in cents beside the estimate. The
caps and the reservations still read the estimate: it is the figure known before the call.
A line `{"event":"vendor_cost_mismatch",…}` is logged when the two differ.

**Each hour.** `rk-vendor-snapshot.timer` runs `scripts/vendor-snapshot.mjs` from the main
checkout on the hour. It appends one line to **`/root/ops/reachkit/vendor-snapshots.jsonl`**
and logs to `/root/ops/reachkit/log/vendor-snapshot.log`:

```json
{"at":"2026-10-11T09:00:03.412Z","dataforseo":{"balanceCents":3113.1168,"depositedCents":10100,"dayCents":49.028,"day":"2026-10-11","timezone":"Europe/Berlin"}}
```

It reads `GET https://api.dataforseo.com/v3/appendix/user_data`, which the vendor does not
charge for: the balance, everything deposited, and the vendor's total for its own day (the
account's timezone, Europe/Berlin). It takes the keys from `/root/projects/reachkitv3/.env.local`
and prints no credential. When that file holds `ANTHROPIC_ADMIN_KEY`, the line also carries
`"anthropic":{"days":{"2026-10-11":96.2,…}}`: the organisation's cost report
(`GET /v1/organizations/cost_report`) for today and the seven days before, in cents. That report
covers everything billed to the organisation, not only ReachKit's key. An admin key is made in
the Claude Console under Settings, Admin keys; the key the product calls the model with cannot
read the report. Without it nothing fails.

To recreate the timer, as root, write these two units, then run
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
ExecStart=/usr/bin/node /root/projects/reachkitv3/scripts/vendor-snapshot.mjs
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

Remove it with `systemctl disable --now rk-vendor-snapshot.timer` and delete the two files. The
snapshot file is not rotated; a line is about 200 bytes.

**Each day: `npm run costs`.** For today and each of the last 7 days (UTC days) it prints
**billed** beside **recorded**, for DataForSEO and for AI:

- *Billed*, DataForSEO: the balance at the reading on the day's first hour, less the balance at
  the next day's, with any deposit added back. For today it runs to a reading the command takes
  itself, so the figure is current. Where no reading stands at the day's opening, it is the
  vendor's own day total, and the line says so; that day is Berlin's, two hours off UTC.
- *Billed*, AI: Anthropic's cost report for the day. Without an admin key it prints
  `AI spend: estimated from tokens; no admin key`.
- *Recorded*: the spend log plus production's `fetches`.

It warns when billed and recorded differ by more than 10% or by more than 10¢. It then judges
the day against D34's €2 (`docs/PROCESS.md`, *Testing budget*), on billed spend where it is
known and recorded spend where it is not, warns past €1.50 and says stop at €2. Everything is in
US cents; €2 is converted with `USD_PER_EUR` in `src/lib/config/constants.ts`, the ECB reference
rate with its date. Change the rate there when the dollar has moved a few per cent.

**Production's side needs a database key the box does not have.** `npm run costs` reads
`fetches` when `.env.local` holds a real `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The
box's are placeholders, so it prints `Production ledger: not read` and recorded is test spend
only. Until the owner puts a key there, run this in the Supabase SQL editor or through the
connector, save the JSON array it returns, and pass it as `npm run costs -- --ledger <file>`:

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

Other flags: `--stored` takes no fresh reading, and `--log`, `--snapshots` and `--env-file`
name other files.

**Each day, stored: `vendor_days`** (issue 1478). One row per vendor per UTC day, `kind` `usage`,
`fixed` (one a month, `day` its first) or `box` (one per day, vendor and `domain`). `billed_cents`
is in cents of `currency`, null where nothing reported it, never 0. `account/maintenance` writes it
on every tick until the day's row exists (`src/jobs/vendor-days.ts`, `src/lib/costs/vendor-days.ts`),
and every reading is free:

- *DataForSEO*: the balance and deposits at the day's first tick; the day before gets its bill,
  the fall between the two openings with deposits added back.
- *Anthropic*: the cost report for the last eight days, closed days only, when the deployment
  holds `ANTHROPIC_ADMIN_KEY`. Without it the page says AI spend is estimated.
- *Fixed*: on the first tick of a month, last month's Stripe fees from its balance transactions
  (euro cents), and a row with no figure for Vercel, Supabase, the job platform and Resend, which
  report no bill the product can read. A figure learned elsewhere is written into that row by hand
  in the SQL editor.
- *Box*: `scripts/vendor-snapshot.mjs` writes the spend log's last eight days as `box` rows when
  `.env.local` holds a real `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the box's are
  placeholders today, so it says `no database key` and box spend stays in the spend log, which now
  carries each line's `domain` where the script knows it.

---

## 9. The database

### Migrations

`supabase/migrations/` holds them, applied in filename order. The first six are zero-padded
ordinals, everything after is `YYYYMMDDHHMMSS_<topic>.sql`; the topic token is checked against a
closed registry by `tests/db/migration-naming.test.ts`, so a name outside it fails CI.

**There is no migration tool.** A migration reaches the live project **by hand, through the Supabase SQL editor or the connector**,
which is how the original 38 were applied (in five chunks) and how every one since has gone.

The procedure, per migration:

1. Land the PR. The migration is in `main`.
2. Re-read the file and paste it into the Supabase SQL editor on the `reachkit` project. One
   migration per run, in filename order, oldest first.
3. Re-read the **security and performance advisors** afterwards. A new `plpgsql` function without
   `set search_path = ''` is a WARN, and `tests/db/functions-search-path.test.ts` should have
   caught it before the merge. Every finding the advisors return is in the dispositions table
   below; a finding that is not is new, and gets a row in the same change that answers it.
4. Record it in this section with the date.

### Applied 2026-09-16

The seven migrations this section listed as pending were applied to the `reachkit` project
(`kleepxxddbcnfsfwudoe`) on 2026-09-16 on the owner's instruction, one `apply_migration` call
each, in this order:

1. `sites_profile`: `site_profiles`, `sites.voice_edited_at`
2. `destinations_hostname`: `destinations.hostname*`, 4-arg `apply_setup_choice`
3. `opportunities_readiness`: `cluster_key` / `absorbed_queries` / `ready` / `unready_reason`
4. `sites_autopilot`: `sites_veto_hours_floor` (both `update`s matched 0 rows)
5. `opportunities_fix_page`: `fix_page` in the type, family and reason constraints
6. `users_retention`: `users.last_seen_at` and the four retention stamps
7. `drafts_retention`: `drafts.opened_at`, `veto_reminded_at`

Verified afterwards: every object present, and `apply_setup_choice` at
`(p_site_id uuid, p_mode text, p_kind text, p_hostname text)`. The security advisor returned only
the standing dispositions below — five `rls_enabled_no_policy` INFO rows and the leaked-password
WARN — and nothing new.

Until then `POST /api/setup` answered 500 on `dev.reachkit.app` (the deployed code called
`apply_setup_choice` with four arguments; the live function still took three), and `GET /app`
logged `retention store: seen: column users.last_seen_at does not exist`.

### Applied 2026-10-16

The master session applied two migrations to the `reachkit` project through the connector on
2026-10-16:

1. `20261015120000_jobs_draft_days`: `draft_days` (issue 1455)
2. `20261015120000_sites_profile_ours`: removed 5 `known_content` rows on `content.reachkit.app`

The security advisor afterwards showed the expected `rls_enabled_no_policy` INFO row for
`draft_days` and the `known_content_near` finding of issue 1472, which
`20261016120000_sites_content_known_grants` closes.

**Dev shares this database.** There is one Supabase project (§2). A migration merged to `main` and
left unapplied breaks `dev.reachkit.app` as soon as a code path reads its columns, as the two
failures above did.

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

### Pending: `20261017120000_rls_privileges` (issue 1483)

Merged, applied by the master session through the connector after the deploy is READY. It
revokes the default `execute` that `PUBLIC`, `anon` and `authenticated` get on every new function
in `public` (production's `pg_default_acl` granted both, role `postgres`), revokes it from the nine
functions created under that default, and rewrites the 22 policies the performance advisor names
to `(select auth.uid())`. Afterwards: the advisor's `auth_rls_initplan` rows in `public` are 0, and

```sql
select p.proname from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
```

returns no row. `tests/db/function-privileges.test.ts` (`schema · RLS`) runs the same query on
the migrated substrate, with production's default privileges, and fails a function a session can
execute unless it is allow-listed there with a reason.

### Advisor findings — the standing dispositions

Both advisors are re-read after every schema change. Every finding they returned on the
`reachkit` project on 2026-10-17, and what each means here. Security first, then performance:

| Finding | Disposition |
|---|---|
| `function_search_path_mutable` — eight plpgsql functions | **Fixed** by `supabase/migrations/20260909130000_rls_functions_search_path.sql` (#384): each function pins `set search_path = ''` and names this schema's tables `public.<table>`. Re-applied to the project through the connector after the merge; the WARN count is then 0. A new function without the clause fails `tests/db/functions-search-path.test.ts` before it can reach the project |
| `rls_enabled_no_policy` — eight tables in `public`: `domain_blocks`, `draft_days`, `email_suppressions`, `fetches`, `job_runs`, `llm_mention_reads`, `llm_mentions`, `rescore_runs`; and `fetches`, `leads` in `v2_archive` (ten INFO rows) | **By design, and said in place.** The eight in `public` are `dbAdmin()`-only (BUILD §10 default-deny) and each carries a `comment on table` naming the rule, so the intent is where the advisor reads; `tests/db/functions-search-path.test.ts` holds the list and fails a ninth without the comment. The two in `v2_archive` are v2's frozen objects, kept as the v2 rollback path (*Backups and restore*); they are not v3's to change and go when the rollback path is retired |
| `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable` — `known_content_near` | **Fixed** by `supabase/migrations/20261016120000_sites_content_known_grants.sql` (issue 1472): `execute` is revoked from `public`, `anon` and `authenticated`, and kept for `service_role`, the only caller (`dbAdmin()`). Apply it through the connector after the merge; neither finding should remain. A `security definer` function that a session can execute fails `tests/db/functions-search-path.test.ts` before it can reach the project |
| Default `execute` on new functions in `public` for `PUBLIC`, `anon` and `authenticated` (no advisor lint; issue 1483) | **Fixed** by `supabase/migrations/20261017120000_rls_privileges.sql`: a new function is its owner's and `service_role`'s, and one a session must call is granted by name in its own migration. `tests/db/function-privileges.test.ts` reads live `pg_proc` in `schema · RLS`, so an `alter function`, a `do` block or a forgotten revoke fails there too |
| `extension_in_public` — `pg_trgm` | **Accepted.** Its functions and operators read no table, so a session that can call `similarity()` learns nothing about any row; the one reader of `known_content` through it is `known_content_near`, which is `service_role`'s alone. Moving the extension would rewrite that function's `public.similarity` calls for no change in what anyone can read. Extension-owned functions are left out of `function-privileges.test.ts` for the same reason. Revisit if an extension that reads data lands in `public` |
| `auth_leaked_password_protection` — HaveIBeenPwned check disabled | **Not applicable.** v3 has no passwords: sign-in is a one-time link and nothing else (REQ-098 — "no password field, no social sign-in"; `supabase/config.toml` sets `enable_password_signin = false`). There is no password for the check to read, so the setting stays off and this WARN is expected on every advisor run |
| `auth_rls_initplan` — 22 policies in `public` (`users`, `sites`, `scans`, `opportunities`, `drafts`, `publications`, `destinations`, `leads`, `page_verdicts`, `site_profiles`, `site_profile_edits`, `known_content`, `publication_reads`) and 4 in `v2_archive` | **Fixed in `public`** by `20261017120000_rls_privileges.sql`: each reads `(select auth.uid())`, evaluated once per statement instead of once per row, with the same command, roles and predicate, so every policy admits the rows it did. `tests/db/function-privileges.test.ts` fails a policy that calls an auth function bare, and one whose predicate changed. **Left** in `v2_archive`, v2's frozen rollback path |
| `unindexed_foreign_keys` — `llm_mention_reads.scan_id`, `page_verdicts.scan_id`, `scans.supersedes_scan_id`, `sites.provisioned_from_scan_id`; and `v2_archive.actions.scan_id` | **Accepted.** Each references `scans`, and nothing deletes a `scans` row (no cascade, tombstones only), so the index a foreign key needs to make a parent's delete cheap would never be read; no query in `src/` filters by one of these four columns (checked 2026-10-17). Table design was left alone (issue 1483). Revisit when a code path deletes scans or filters by one of these columns |
| `unused_index` — 30 in `public`, 7 in `v2_archive` | **Kept.** The counters reset with the project's statistics and production traffic is small, so the planner reads most small tables by sequential scan today; each index in `public` backs a uniqueness rule or a query in `src/` (the retention sweeps, the publish queue, `known_content_near`'s trigram search) that will need it at volume. Dropping one is table design and was left alone (issue 1483). The `v2_archive` ones go with the rollback path |
| `no_primary_key` — 18 tables in `archive` and `backup_20261005` | **Not v3's schema.** They are dated snapshot copies, read by hand only; no code path reads them. They go when the owner retires the snapshots |

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
  PostgREST via `POSTGREST_BIN`.
- **Where PostgREST and postgres-meta live on this box, and how to put them back** (2026-09-21,
  #910). The path this section used to name — `…/substrate/postgrest/postgrest` — went with the
  worktree it was inside, so for some weeks `up.sh` could not start a stack here at all and both
  the `db` and `layout` suites were CI-only. Two things fixed that, neither of them in the
  repository, and `/tmp` does not survive a reboot:

  ```sh
  # 1. PostgREST, pinned to the version up.sh pins its image to (v16.2).
  #    /root/ops/bin is outside every worktree, so removing one cannot take it again.
  curl -sL -o /tmp/pgrst.tar.xz \
    https://github.com/PostgREST/postgrest/releases/download/v16.2/postgrest-v16.2-linux-static-x86-64.tar.xz
  tar -xJf /tmp/pgrst.tar.xz -C /tmp && install -m 755 /tmp/postgrest /root/ops/bin/postgrest
  export POSTGREST_BIN=/root/ops/bin/postgrest   # or put /root/ops/bin on PATH

  # 2. postgres-meta's install directory. /tmp/reachkit-pgmeta is a symlink to
  #    /root/tmp/reachkit-pgmeta; after a reboot the symlink is gone, and if it is
  #    ever left dangling `up.sh` dies on `mkdir: Already exists`, which reads like
  #    nothing at all.
  mkdir -p /root/tmp/reachkit-pgmeta && ln -sfn /root/tmp/reachkit-pgmeta /tmp/reachkit-pgmeta
  ```

  With both in place `eval "$(scripts/db-substrate/up.sh --run)"` works here, and
  `npx vitest run --project db` and `npm run test:layout` can be run on the box rather than
  only in CI.
- **Stop the stack before removing a worktree.** A stack costs 150–190 MB and nothing else stops
  it: on 2026-09-07 forty-one orphaned processes from deleted worktrees held 1.66 GB of a 7.7 GB
  box, which is what the kernel was killing builds to reclaim. `scripts/db-substrate/down.sh --orphans`
  finds every stack whose directory is gone. `down.sh --drop` also drops the database, which is
  deliberately not the default — keeping it is what makes the next `up.sh` cheap.

### Backups and restore

**The `reachkit` project is on the Supabase Free plan, which has no point-in-time recovery and no
scheduled backups to restore from.** Re-verified 2026-09-18 (#887): org `timclifford`
(`vercel_icfg_qHQSeWwkm34ehAw2Kc5FUrCH`) reports plan `free`; project `reachkit`
(`kleepxxddbcnfsfwudoe`), Postgres `17.6.1.127`, `ACTIVE_HEALTHY`, us-east-1. So today the only
backup that exists is one the owner takes, and there is no automatic recovery point behind a
mistake — a bad migration, a wrong `delete`, or a reset like 2026-09-17's takes the data with it.
This is the single largest operational exposure in the product, it is owner-owed, and it has been
open since #334.

**Dev and production are one database, and nothing guards that.** There is one Supabase project
(§2) and `dev.reachkit.app` is the same Vercel project bound to `main` (§2), reading the same
`SUPABASE_URL`. A dev experiment *is* a production write. A row deleted while steering on dev is a
customer's row. There is no second project, no branch, no read-only mode, no confirmation step and
no environment check in `src/lib/config/env.ts` that could tell the two apart — the only guard that
exists today is care. `KILL_SWITCH` (§5) stops the product writing; it does nothing about a hand on
the SQL editor. Until recovery exists, treat every statement typed against `kleepxxddbcnfsfwudoe`
as unrecoverable, because it is.

**Turning recovery on — the cost, the screens, the retention.** Owner-gated: the owner holds the
account, and every step below is theirs. None of it has been done.

| | |
|---|---|
| What Pro alone buys | Daily backups, 7 days of them, restorable in place from **Database → Backups → Scheduled**. That alone ends "there is nothing to restore from". ~$25/mo plan + ~$15/mo compute, less the $10 compute credit |
| What PITR adds | Restore to any chosen second inside the retention window. WAL is shipped every two minutes, so the worst-case loss is **two minutes**, against up to a day with daily backups alone |
| Prerequisites | Pro (or Team/Enterprise) **and** at least the Small compute add-on. This project is on Postgres `17.6.1.127`, well past the `15.8.1.079` that physical backups need, so **no Postgres upgrade is required first** |
| Retention to ask for | **7 days** — ~$0.137/h, ~$100/mo. 14 days is ~$200/mo and 28 is ~$400/mo; neither buys anything 7 does not for a product whose incidents are noticed the same week |
| All-in, at 7 days | ~$130/mo (Supabase's own worked example: $25 Pro + $15 Small compute + $100 PITR − $10 credit). At €49/mo a seat that is roughly three paying customers |
| The plan screen | The org is **Vercel-Marketplace-managed** (the `vercel_icfg_` prefix is what says so), and for such an org invoices and plan changes live on Vercel, not Supabase. Start at Supabase dashboard → org `timclifford` → **Billing → Subscription Plan → Change subscription plan**; where that panel refuses because the org is marketplace-managed, it links out — the change is made at **vercel.com → team `timclifford` → the Supabase integration → its plan** |
| The PITR screen | Supabase dashboard → project `reachkit` → **Project Settings → Add-ons → Point-in-Time Recovery**. Then **Database → Backups → Point in Time** shows the earliest and latest recovery points |
| Two things to know before pressing it | Enabling PITR **stops** the daily backups (it replaces them, finer-grained). And PITR is **not** covered by the Spend Cap — it bills by the hour whether or not the cap is on |
| What it still does not cover | A PITR restore is **in place**: the project is inaccessible while it runs, for as long as the database size and WAL volume take. Restoring into a *fresh* project is the **Duplicate Project** path, not the restore button |

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
that nobody can log in to. `v2_archive` is v2's frozen objects (§2); add
`-n v2_archive` only while the v2 rollback path is still wanted.

`--format=custom` is restored with `pg_restore`, not `psql`. Keep the file off the box that runs
the product. A dump contains every customer's data: treat it as the most sensitive file the
project produces, and delete drill copies when the drill ends.

**The dump drill.** Rehearse it against a *scratch* database, never the live project. The point
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

**The one drill.** Not a rehearsal of the dump — a rehearsal of the *platform*, which is the only
thing that can rewind a mistake nobody dumped ahead of. It is runnable the day PITR is on and not
before; until then the dump drill above is what there is. **The owner triggers it** — no agent runs
any of it. It writes and then deletes one sentinel row on production and restores into a *clone*;
production itself is never restored over and never goes down.

1. Insert one sentinel row into `domain_blocks` — a table `dbAdmin()` alone reads, whose `domain`
   is unique and whose rows block a scan of that domain and nothing else. Use a reserved name so it
   can never match a customer:

   ```sql
   insert into domain_blocks (domain, note)
   values ('restore-drill.invalid', 'issue 887 restore drill, <date>, owner');
   ```

2. Note the clock. Wait five minutes. Delete it:
   `delete from domain_blocks where domain = 'restore-drill.invalid';`
3. Restore **to a point five minutes ago** — between the insert and the delete — into a *scratch
   project*, via **Duplicate Project** (Supabase's clone-project path) rather than the in-place
   restore button, so production is never taken down by a drill. On a Vercel-Marketplace org a new
   project is created from the **Vercel** dashboard, and it bills under this same org: delete it
   the moment the drill ends.
4. Confirm the named row is back:
   `select domain, note, blocked_at from domain_blocks where domain = 'restore-drill.invalid';`
   One row, with the note, is the whole pass condition. No row means the restore did not reach the
   point asked for, and that is the finding.
5. **Record the wall-clock time** — from pressing restore to the clone answering a query — with
   the database size and the date, in this section. That number is the recovery time the product
   actually has; until it is written down, "how long would this take" has only a guess for an
   answer.
6. Delete the scratch project. Production needs no cleanup: step 2 already removed the sentinel
   there, and the clone is where it came back.

**Restoring for real**, from a dump, is the dump drill's steps 3–4 against the live project with
the product stopped first: flip
`KILL_SWITCH` (§5) and redeploy so nothing writes while the restore runs, restore, verify, then
release it. Expect to lose everything between the dump and the incident — with no PITR there is no
finer granularity than the last dump. That gap is the argument for taking dumps often.

**The rollback to v2** is a different procedure and is not this one:
`alter table v2_archive.<t> set schema public` per table, then promote the frozen v2 production
deployment (`dpl_2NEUXishMXAkzXG4Ti85yTy7NDda`, 23 Aug 2026).

---

## 10. Quick reference

| Situation | Go to |
|---|---|
| a PR is green and should ship | §1 — merge it; the owner tests on `dev.reachkit.app` |
| the site is 500ing | §7 — read the runtime log, find the last `boot_invariants` line |
| every page 500s and nothing changed | §2 — the Supabase project may have paused after seven idle days |
| nothing has published for days | §4 — is the Inngest app registered? The ticks are silent when it is not |
| a WordPress destination needs proving | §4 — the six-step walk, and what each step should show |
| a real deep pass needs running, or the calendar shows empty days | §4 — the deep-pass walk, and which kind of empty each date is |
| spend looks wrong | §8 — the SQL is there; `fetches` is the truth |
| stop the spend now | §5 — `KILL_SWITCH=true` on every target, **then redeploy** |
| a key leaked | §3 — rotate: mint, paste both targets, redeploy, verify, revoke |
| Stripe must go live, or mail must reach a real inbox | `docs/GO-LIVE.md` — the go-live gate, worked through in order |
| a migration needs to reach production | §9 — by hand, through the SQL editor; `db-live` does not exist |
| the database is gone | §9 — and read the plan warning first |
| production is serving a bad build | §1 — **roll forward**: revert on `main` and deploy. Never promote an older deployment |
| someone is asking to roll back | §1 — the scripts cannot; Vercel can, and must not. Why is there |
| "is not readable by this build" in a log | §1 — an older build is reading a newer report. Deploy `main`, do not roll back further |
| how long would a restore take | §9 — unknown until the drill runs. Enabling it and running it are the owner's |
| CI jobs fail with a billing or spending-limit error | §1 *Where CI runs* — one `gh variable set` sends the light jobs to the box |
| a check sits in *queued* for hours | §1 *Where CI runs* — is the runner its label names online? `gh api repos/tim-clifford6991/reachkit/actions/runners` |
| `Vercel` fails on every PR | §1 — the Hobby plan's 100 builds a day. It is not a required check; nothing is blocked |

---

## 11. History

Do not extend this section. Cutover and incident narrative live in git. Rollback to v2 is §9.
