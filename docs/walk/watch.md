# What to watch in production during the walk

For the owner, open in a second window for the whole walk. Everything here comes from
`docs/RUNBOOK.md` and `docs/GO-LIVE.md` §1.6. If this page and those two disagree, they are right.
**Watch, write down times, and do not step in.** A fix during the walk is a finding afterwards,
unless it is the kill switch below.

## The five places to look

| Where | What it shows | How to open it |
|---|---|---|
| **Vercel runtime logs** | Every structured line the product writes. There is no other log sink, APM or error tracker (RUNBOOK §4). | Vercel → team `timclifford` → project `reachkit` → Logs, environment **Production**. Filter on the `event` names below. |
| **Inngest** | The runs of `scan/run`, `draft/generate`, `publish/execute` and `publish/verify`. | Inngest → app `reachkit` → Runs |
| **Supabase** | The rows each step writes, and the `job_runs` heartbeat | SQL editor on project `kleepxxddbcnfsfwudoe`. Dev and production share it, so filter by the tester's address. |
| **Resend** | Every mail that left, with delivery status | Resend → Emails. A mail that never left is in the Vercel log instead (`mail_not_composable`, `sign_in_link_not_issued`, `*_not_sent`). |
| **Stripe, live mode** | The checkout, the payment, the subscription and each webhook delivery with its response code | Stripe → Developers → Events, and Webhooks → the `reachkit.app/api/stripe/webhook` endpoint → deliveries |

Before the walk starts, check `job_runs` (RUNBOOK §4 *Is it firing?*). Every cron job should be
inside its interval: 15 min for `account/maintenance`, 60 min for the rest. If every row is old, the
walk will stall after setup. Do not start it.

```sql
select job_id, last_run_at, last_outcome, now() - last_run_at as quiet_for
from job_runs order by last_run_at;
```

## What a healthy step looks like

| Tester's step | Healthy | Unhealthy — write down the time and the line |
|---|---|---|
| 1 Landing | `{"event":"request",…,"status":200}` lines | any `5xx`. A page with no logs at all may mean the Supabase project paused (RUNBOOK §2). |
| 2 Free scan | a `request` line carrying a `scanId`; the report renders | `{"event":"cap_hit","reason":"daily_ceiling"}` (RUNBOOK §8), or a refusal with `switched_off` (the kill switch is on) |
| 4 Pay | In order (GO-LIVE §1.6): `{"event":"stripe_webhook","outcome":"provision","type":"checkout.session.completed"}`, then `{"event":"provision","outcome":"created"}`. The browser lands on `/setup`, signed in. Stripe shows the webhook delivery **200**. | `"outcome":"signature"` means the webhook secret is crossed (GO-LIVE §1.5). A `4xx` on the Stripe delivery. `{"event":"billing_open_subscription","outcome":"vendor"}`. |
| 4 Pay — the row | the query below returns one `users` row with `stripe_customer_id`, `checkout_session_id` and a `paid_through` about a month out | `paid_through` still on the column default |
| 5 Setup | `sites.setup_stage` moves through the stages (`setup_stage_times` gets a timestamp for each); in Inngest one `scan/run` (`scanId` `setup-{siteId}`); then `{"event":"job","jobId":"scan/run","outcome":"ran"}` and a `{"event":"supply_pass",…}` line (RUNBOOK §4 *The deep pass, for real*) | `"outcome":"degraded"` or `"failed"` on `scan/run`; `setup_released_reason` = `failed` |
| 5/6 Hosted host | `destinations.hostname_state` moves from `pending_dns` to `live` after the tester's DNS record and a press of the check; `{"event":"destination",…}` lines | The check answers *could not ask*. That is the #1045 risk: the token's team scope. |
| 5/6 WordPress | `destinations.health` = `ok`, `publish_capable` = true (RUNBOOK §4 *Verifying a WordPress destination*) | `health` = `expired` / `error`; `publish_capable` = false (a Contributor-level password) |
| 6 First page | a `drafts` row in `in_review` with a `veto_deadline`; the draft-ready mail in Resend. After the deadline: `publish_transition` lines `in_review → approved → publishing → published`, a `publications` row with the `live_url` **the site returned**, `{"event":"job","jobId":"publish/execute","outcome":"ran"}`. `publish/verify` runs 24 h later. | `"outcome":"refused"` with a `failedGuard` on `publish_transition`; `delivery_state` failing with a `failure_reason`; a `live_url` that does not open |
| 7 Stop the next page | the next evening's `draft/generate` run writes a second `drafts` row in `in_review` and sends its mail; after the tester's press, `veto_token_used_at` is set and the draft moves `in_review → skipped` | the link says the moment has passed (`publish.veto.expired`) before `veto_deadline`; the draft still publishes |
| any | — | `{"event":"provisioning_backstop_fired"}` **must never appear** — it means the payment was rescued a day late (GO-LIVE §1.6) |

The tester's rows, with one query:

```sql
select u.email, u.plan_status, u.paid_through, u.first_signed_in_at,
       s.id as site_id, s.domain, s.setup_stage, s.setup_released_reason, s.setup_completed_at,
       d.kind, d.hostname, d.hostname_state, d.health, d.publish_capable
  from users u
  left join sites s on s.user_id = u.id
  left join destinations d on d.site_id = s.id and d.deleted_at is null
 where lower(u.email) = lower('<the tester''s address>');

select id, state, title, veto_deadline, veto_token_used_at, created_at
  from drafts where site_id = '<site_id>' order by created_at;

select draft_id, delivery_state, live_url, published_at, failure_reason
  from publications where site_id = '<site_id>' order by published_at;
```

## The kill switch — if the walk goes wrong

Use it **only** if the product is spending money or writing wrongly. A confusing screen or a slow
step is a finding, not an emergency. The switch is RUNBOOK §5:

1. Set `KILL_SWITCH` to `true` on **all** Vercel targets.
2. **Redeploy.** A flip is a redeploy: running instances keep the old value until they are
   replaced, and keep spending until then.
3. Confirm: a stopped job logs `"outcome":"stopped","by":"kill-switch"`, and the account shell shows
   the stopped notice.

What it stops: `scan/run`, `draft/generate`, `publish/execute`, `publish/retry`, free-scan
admission, the weekly run, and publishing. What it **does not** stop: sign-in, the account screens,
billing, the Stripe webhook and hosted pages that are already live. It writes no row and sends no
mail (its alert copy is still empty), so write down the time yourself. To release it, do the same
three steps with `false`.

**A bad production build is never rolled back.** Fix it forward: revert on `main`, then deploy
(RUNBOOK §1). Do not promote an older deployment in Vercel. If the walk stops for any reason, write
the time and the last log line in the findings, and file it as a finding afterwards.
