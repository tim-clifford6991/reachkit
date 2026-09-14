# Runbook — operating ReachKit alone

Operations only: envs, bindings, jobs, kill switch, mail, boot failures, cost ledger, database.
How work flows is `docs/PROCESS.md`. What the product does is `docs/SPEC.md`. Nothing here is read
by the running app.

---

## 1. Landing a change

How a change reaches `main` is `docs/PROCESS.md`: three required checks, then
`gh pr merge --squash --delete-branch` (or the GitHub UI). This page starts after the merge.

Dev (`dev.reachkit.app`) deploys from `main` via `rk-deployer`. If it has not moved after a
merge, run `bash /root/ops/reachkit/bin/deploy-dev-once.sh`. Production is batched (at most
every two hours) and stays frozen while `/root/ops/reachkit/state/prod-frozen` exists. `Vercel`
is not a check: Git deployments are off (`vercel.json` `git.deploymentEnabled: false`).

The owner tests the path live on `dev.reachkit.app`. A merged migration is applied through the
Supabase connector after the target deploy is READY, then the path is walked again
(`scripts/smoke.sh` / `scripts/land.sh`).

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
| Mail | Resend, sending domain `reachkit.app` (SPF, DKIM, DMARC) — pending #325; `MAIL_FROM` is `hello@reachkit.app` (§6) |
| Payments | Stripe live: one product `ReachKit`, one €49/month tax-inclusive price bound as `STRIPE_PRICE_ID`; v2's products and prices inactive; webhook `/api/stripe/webhook`; customer portal on. The dashboard steps, and the test-mode walk that proves them, are `docs/stripe-setup.md` |
| Hosted CMS | customers point `content.{their-domain}` at `HOSTED_EDGE_CNAME_TARGET` (`edge.reachkit.app`); per-customer domains are added to the project through the Vercel Domains API (#322) |
| Local | `npm run dev` on `http://localhost:3000`, bindings from `.env.local` (names in `.env.example`) |

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
| `asking_the_twelve` | twelve live SERPs and the paid battery | `serp/google/organic`, `serp/google/ai_mode`, `ai_optimization/chat_gpt/llm_scraper` |
| `scoring` | nothing | — |
| *after the report* | one typing call per candidate | `opportunity-typing` |

Per-stage *timing* is `sites.setup_stage_times`, one instant per stage, written by
`src/lib/scan/deep/run.ts`. One pass's own spend is
`select source, count(*), sum(cost_cents) from fetches where scan_id = …` (§8).

**What to read when it ends, in order.**

1. the job line — `{"event":"job","jobId":"scan/run","outcome":…}`: `ran`, or `degraded` naming the
   step it stopped at;
2. the supply line — `{"event":"supply_depth","stop":…,"unused":…,"created":…}`: `target_met` (the
   30 days `SUPPLY_TARGET_DEPTH` asks for), `evidence_spent` (the market supported fewer), or
   `pass_ended_early` (the cap went first);
3. `sites.setup_released_reason` — `completed`, `degraded`, `failed` or `deadline`;
4. `scans.stopped_reason` — `complete`, `time_ceiling`, `spend_ceiling`, `site_unreadable` or
   `failed`;
5. `/app/calendar` — the planned dates, at most one page each. Two pages on one date is a data
   defect and raises (`TwoPagesOnOneDateError`) rather than drawing both.

A pass that derived nothing still releases the founder and is not an error: zero proposals is legal
and never faked, and the calendar then states which kind of empty each date is.

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
| `supply_exhausted` | `supplyDepth().unused` was read **and** is zero | `{"event":"supply_depth"}` |
| `unattributed` | nothing above is established, or the publishing facts were unreadable | the last arm, never a widened one |

`supply_exhausted` is proven only: a depth that could not be read is `null` and not zero, and the
date falls to `unattributed` rather than telling a customer their market is empty on a day the
database merely broke.

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

One transport (Resend), one shell, plain-text alternative, no generated prose — `docs/SPEC.md` §8.

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

### Verifying the sign-in link end to end

The only door into the paid product, walked in order. Every observation below is one the browser or
`curl` shows; nothing here changes a setting.

1. **An account must exist for the address.** A link is only ever sent to an address the `users`
   table already holds (`src/lib/account/provisioning/magic-link.ts`), and the account is created by
   the payment webhook, never by a form (`docs/SPEC.md` §3). So either complete one checkout at
   `/pricing` with an `OWNER_EMAILS` address (#319), or confirm the row first: Supabase → Table
   editor → `users`, one row whose `email` is that address, with an `auth.users` row of the same
   `id`. An address with no row is answered at step 2 by *There's no ReachKit account for that
   address* — which is that check, done from the outside.
2. **Ask for the link.** Open `https://reachkit.app/signin`, type the address, press **Send my
   link**. Expect *Check your inbox* and *Your sign-in link is on its way. It works once…*.
3. **The mail.** Subject **Your sign-in link**, from `MAIL_FROM`, one action reading **Sign in**.
   Resend's dashboard shows what left; a mail that did not compose or send is in the runtime log as
   `mail_not_composable` or `sign_in_link_not_issued` (§6 above).
4. **Follow it.** The link is `https://reachkit.app/auth/confirm?token_hash=…&type=magiclink` — this
   product's own host, never Supabase's `action_link`. Expect `307` to `/setup` on a first sign-in
   and to `/app` afterwards, carrying an `sb-…-auth-token` cookie on that same redirect.
5. **Use it twice.** Re-open the same confirm URL: `307` to `/signin?link=dead`, and the screen says
   *This link no longer works*. An expired link, a link superseded by a newer one and a token this
   product never issued all answer identically — that sameness is the point.
6. **The gate.** Signed out, `https://reachkit.app/app` answers `307` to `/signin`; with the session
   from step 4 it serves.

A link lasts 24 h (`SIGNIN_LINK_TTL_H`), but it is Supabase's own OTP expiry that spends it, so the
two must agree. The Auth dashboard settings this walk depends on — Site URL, `/auth/confirm` on the
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
the price book archived at `docs/archive/2026-09-11/DATA-COSTS.md`.

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

**There is no migration tool.** A migration reaches the live project **by hand, through the Supabase SQL editor or the connector**,
which is how the original 38 were applied (in five chunks) and how every one since has gone.

The procedure, per migration:

1. Land the PR. The migration is in `main`.
2. Re-read the file and paste it into the Supabase SQL editor on the `reachkit` project. One
   migration per run, in filename order, oldest first.
3. Re-read the **security advisor** afterwards. A new `plpgsql` function without
   `set search_path = ''` is a WARN, and `tests/db/functions-search-path.test.ts` should have
   caught it before the merge. The four `rls_enabled_no_policy` INFO rows and the
   leaked-password WARN are dispositioned below and are expected on every run.
4. Note it in the log (§11) with the date.

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

### Security advisor — the standing dispositions

The advisor is re-read after every schema change. What it reports on the `reachkit` project, and
what each report means here:

| Finding | Disposition |
|---|---|
| `function_search_path_mutable` — eight plpgsql functions | **Fixed** by `supabase/migrations/20260909130000_rls_functions_search_path.sql` (#384): each function pins `set search_path = ''` and names this schema's tables `public.<table>`. Re-applied to the project through the connector after the merge; the WARN count is then 0. A new function without the clause fails `tests/db/functions-search-path.test.ts` before it can reach the project |
| `rls_enabled_no_policy` — `domain_blocks`, `email_suppressions`, `fetches` in `public` (`auth_links` dropped 2026-09-10, #468), and two tables in `v2_archive` | **By design, and now said in place.** The three in `public` are `dbAdmin()`-only (BUILD §10 default-deny) and each carries a `comment on table` naming the rule, so the intent is where the advisor reads. The two in `v2_archive` are v2's frozen objects, kept as the v2 rollback path (*Backups and restore*); they are not v3's to change and go when the rollback path is retired |
| `auth_leaked_password_protection` — HaveIBeenPwned check disabled | **Not applicable.** v3 has no passwords: sign-in is a one-time link and nothing else (REQ-098 — "no password field, no social sign-in"; `supabase/config.toml` sets `enable_password_signin = false`). There is no password for the check to read, so the setting stays off and this WARN is expected on every advisor run |

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
  box, which is what the kernel was killing builds to reclaim. `scripts/db-substrate/down.sh --orphans`
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
that nobody can log in to. `v2_archive` is v2's frozen objects (§2); add
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
| a migration needs to reach production | §9 — by hand, through the SQL editor; `db-live` does not exist |
| the database is gone | §9 — and read the plan warning first |
| `Vercel` fails on every PR | §1 — the Hobby plan's 100 builds a day. It is not a required check; nothing is blocked |

---

## 11. History

Do not extend this section. Cutover and incident narrative live in git. Rollback to v2 is §9.
