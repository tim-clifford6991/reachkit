# The stranger walk — the pack

What #1044 needs ready before the owner runs the walk on production: one person the owner picks, a
real site, unaided, refunded afterwards (owner ruling 2026-09-23). The walk is the last row of the
launch gate in `docs/GO-LIVE.md` §3. This folder holds no rules and no launch status of its own.
Where it quotes GO-LIVE or RUNBOOK and they disagree, those pages are right and this one is stale.

| File | Who reads it | When |
|---|---|---|
| `docs/walk/tester-script.md` | the tester, and nobody else | handed over at the start, one printed page |
| `docs/walk/findings-form.md` | the tester fills it in; the owner files it | during the walk, one block per step |
| `docs/walk/watch.md` | the owner | open in a second window for the whole walk |
| `docs/walk/refund.md` | the owner | after the walk ends |
| `docs/walk/content-eval.md` | whoever changes generation (#1127) | the retired pipeline's last table (the run went with it, SPEC §7 D41); a page is tested with `npm run page`; not part of the walk |
| `docs/walk/d19-cost.md` | the owner, ruling on issue 1162 | rewritten by `node scripts/d19-cost.mjs --run`; not part of the walk |
| `docs/walk/panel/` | whoever changes market understanding, the knowledge base, rivals, terms, searches or topics (#1304) | `sites.json` is the customer panel; `<date>.json` and `<date>.md` are written by `npm run panel`; not part of the walk |
| `docs/walk/free/` | whoever changes the free scan's score, questions or rivals (#1438) | `<date>.json` and `<date>.md` are written by `npm run free-scan`, `<date>.recheck.md` by its `--recheck`; not part of the walk |

## Readiness — what must be true before the walk starts

Read on 2026-09-25 from the Launch milestone, `vercel env ls production`, `curl` against
production, and the production `job_runs` table. Re-check each row the day of the walk. When a row
here and GO-LIVE §3 disagree, GO-LIVE §3 is the status and this table is out of date.

| # | Must be true | State on 2026-09-25 | Blocks the walk? | Whose |
|---|---|---|---|---|
| 1 | **Stripe is live** (GO-LIVE §1.3, **#1042**) | **Half done** (corrected 2026-10-02, GO-LIVE §1.1). The three production Stripe bindings are live-mode values; the 2026-09-25 reading of them as test mode was wrong. No live payment has completed, and the Customer emails setting is unread. The walk's own payment is the first. | **No.** A real card can pay. GO-LIVE §1.3 step 7 is still the owner's to decide. | owner |
| 2 | **A hosted page is reachable** (GO-LIVE §3 row 5, **#1045**) | **Done 2026-10-02 (GO-LIVE row 5).** | No | — |
| 3 | **The legal pages carry real bodies** (GO-LIVE §3 row 3, **#335**) | **Not done.** `/imprint` on production still renders `[[imprint: owner fills legal entity, address, VAT id]]`. The same placeholder is in every mail footer. | **Yes.** A stranger is asked to pay on a page with no legal entity. | owner |
| 4 | **The sign-in split** (**#1025**) | **Done.** Closed. | No | — |
| 5 | **Mail reaches a real inbox** (GO-LIVE §2, **#1043**) | **Done.** DMARC `p=none` is published, and a real mail passed DKIM, SPF and DMARC on 2026-09-23. | No | — |
| 6 | **The jobs fire on production** (RUNBOOK §4) | **Done.** On 2026-09-25 the `job_runs` table showed every cron job within its interval. The last production `scan/run` was 2026-09-19, and the walk's own setup is the next one. | No | — |
| 7 | **A way back from data loss** (GO-LIVE §3 row 4, **#334**) | **Not done.** Free plan, no PITR, no restore drill. | No, but the walk writes the first live customer's rows with no backup behind them. | owner |
| 8 | **The landing's demo video** (**#1030**) | **Not done.** The frame is empty on purpose (#734). | No. It is optional for the walk. | owner |
| 9 | **The owner has picked the tester and the site** (#1044) | **Open.** A WordPress site with an application password, or a domain whose DNS the tester can change. | **Yes.** | owner |

**Open items that block the walk:** 3 (#335) and 9. Item 1 (#1042) still has its Customer emails setting open.

## How long the walk takes

The tester should plan for **two or three days, then the first Monday**. The walk is not one sitting:

- **Day 1:** landing, then the scan, the report, paying and setup. For a hosted page, add the DNS
  record. After setup, the deep pass and the first page are written in the background.
- **Day 1 or 2:** the first page waits in review for the stop window, which is 24 h by default
  (SPEC §0 *Veto*). Then it publishes. The tester checks that it is live on their own domain.
- **Day 2 or 3:** the next evening's page comes with its mail. The tester presses *Stop this page*
  in that mail.
- **The first Monday:** the Monday mail arrives, and the tester reads it.
- **After that Monday, within 14 days of paying:** the tester downloads the export in Settings,
  then presses Cancel in Settings. Once #1707 is live this refunds automatically (GO-LIVE §1.7).

Nobody helps during the walk. The owner watches (`docs/walk/watch.md`) and writes down what the
tester did, but does not answer questions. After the walk: one issue per finding, sized for one PR,
unless the finding is an example of a parent in `docs/PROCESS.md` Coherence, which is a comment on
that parent. Then the refund (`docs/walk/refund.md`), then #1044 is closed with the walk's timeline.
