# The stranger walk — the pack

What #1044 needs ready before the owner runs the walk on production: one person the owner picks, a
real site, unaided, refunded afterwards (owner ruling 2026-09-23). The walk is the last open item on
the owner's list (#2299). This folder holds no rules and no launch status of its own.
Where it quotes RUNBOOK and they disagree, RUNBOOK is right and this one is stale.

| File | Who reads it | When |
|---|---|---|
| `docs/walk/tester-script.md` | the tester, and nobody else | handed over at the start, one printed page |
| `docs/walk/findings-form.md` | the tester fills it in; the owner files it | during the walk, one block per step |
| `docs/walk/watch.md` | the owner | open in a second window for the whole walk |
| `docs/walk/refund.md` | the owner | after the walk ends |
| `docs/walk/d19-cost.md` | the owner, ruling on issue 1162 | rewritten by `node scripts/d19-cost.mjs --run`; not part of the walk |
| `docs/walk/panel/` | whoever changes market understanding, the knowledge base, rivals, terms, searches or topics (#1304) | `sites.json` is the customer panel; `<date>.json` and `<date>.md` are written by `npm run panel`; not part of the walk |
| `tests/fixtures/walk/free/` | whoever changes the free scan's score, questions or rivals (#1438) | the kept runs; a new `npm run free-scan` run, and its `--recheck`, write to the gitignored `.review/walk/free/`; not part of the walk |

## Readiness — what must be true before the walk starts

Read on 2026-11-09 from the issues and `curl` against production. #2299 is the status; where it
disagrees with this list, this list is stale. Stripe live (#1042), a hosted page reachable (#1045),
the legal bodies (#335), the sign-in split (#1025) and DMARC (#1043) are closed. There are no
backups on the Free plan (owner R18, #334), so the walk writes the first live customer's rows with
none behind them. The demo video (#1030) is optional.

| # | Must be true | Blocks the walk? | Whose |
|---|---|---|---|
| 1 | **The jobs fire on production.** On the day, every `job_runs` row is inside its interval (`docs/walk/watch.md`). | **Yes** | owner |
| 2 | **The owner has picked the tester and the site** (#1044). A WordPress site with an application password, or a domain whose DNS the tester can change. | **Yes** | owner |

## How long the walk takes

The tester should plan for **two or three days**. The walk is not one sitting:

- **Day 1:** landing, then the scan, the report, paying and setup. Setup opens with *What you do*,
  *Who you serve* and *Words you use* filled in from the free scan. For a hosted page, add the DNS
  record. The first page is ready within the hour after setup, or the app says the market is too
  small.
- **Day 1 or 2:** the first page waits 24 h, the default stop window (SPEC §7 *The veto window*),
  then publishes at the site's next publish time. Until the website is connected it reads as ready
  and goes live once it is. The tester checks that it is live on their own domain.
- **Day 2 or 3:** the next day's page is written the evening before and comes with its mail. The
  tester presses *Stop this page* in that mail. That ends the walk.

Nobody helps during the walk. The owner watches (`docs/walk/watch.md`) and writes down what the
tester did, but does not answer questions. After the walk: one issue per finding, sized for one PR,
unless the finding is an example of a parent in `docs/PROCESS.md` Coherence, which is a comment on
that parent. Then the refund (`docs/walk/refund.md`), then #1044 is closed with the walk's timeline.
