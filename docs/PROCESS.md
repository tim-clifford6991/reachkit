# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy.

Follow **Current**. **History** is the dated record of how these rules got here. Do not treat History as steps. When the two disagree, Current wins, and the stale sentence is corrected in the same change.

2026-09-25  **Nothing survives because it is protected** (owner). Code, tokens, tests and rules stay only while they are the simplest thing for the product as it runs today. A test, a gate, a quoted ruling or an approved file is not a reason to keep something. When a library, framework or platform feature already does the job, the custom version is deleted, and so is the test that pinned it. Anyone may question anything: an agent that finds something kept only because it is guarded says so in its issue or PR instead of working around it. Owner decisions still need a dated line; this line is that decision for removing things that fail this test.

## Current

### Source of truth

The repository and the GitHub issues are the only record. A chat, a memory file, and anything under `/root/ops` do not overrule these pages. If two of them disagree, fix the stale one in the same change. Do not leave the correction only in a comment or a memory file.

| Question | Where it is answered |
|---|---|
| What the product is, and what delivered means | `README.md` |
| What the product does | `docs/SPEC.md` |
| How a screen is built | `docs/DESIGN.md` |
| How work moves, the gates, the worktrees, the queue | this file, Current |
| What is left before a stranger pays | `docs/GO-LIVE.md` — the only launch checklist |
| How the box and the vendors are operated | `docs/RUNBOOK.md` |
| Which open issues are that launch | the GitHub milestone **Launch** |

### Roles

| Who | Does |
|---|---|
| **Owner** | Product, copy, secrets, answers, tests live on `dev.reachkit.app`. Does not read ticket piles. |
| **Engineer** | One session, one issue. Issue → docs if behaviour changed → implement with libraries → PR with Conditions, Overlaps and Surfaces. Never merges or deploys (owner, 2026-10-19). |
| **Architect** | Sets the build order, dependencies, hot-file rules and the proof for each step. Advises; never implements. |
| **Product manager** | Turns an approved plan step into a ready issue (Conditions, Invariants, Surfaces, Overlaps), classifies feedback under Coherence, sequences waves of at most 3 engineers, keeps the delivery status and verifies each condition in production after deploy. |
| **Release QA** | Before a merge: each condition proven, CI green, overlaps tested together, migration order; returns GO or NO-GO with the head SHA. After a deploy, only when it carries a migration, a new or changed Inngest job or a paid path, or the deployer's production check is red: Ready, Inngest synced, smoke, errors, conditions in production; returns PASS or FAIL. Otherwise the deployer's logged production check is the PASS (owner, 2026-10-31). |
| **Orchestrator** | Merges on GO with `--match-head-commit`, applies migrations in the order step 4 gives, deploys, syncs Inngest. Holds no implementation. |

Delivery flow (owner, 2026-10-19): approved plan step → architect (order, proof) → product manager (issue) → engineer (PR) → release QA (GO) → orchestrator (merge, migration, deploy) → deployer's production check (PASS; release QA only for a migration, a job, a paid path or a red check) → product manager (accepted). The agent definitions live in `~/.claude/agents/`, named in `CLAUDE.md`. The orchestration session holds no implementation and no state. It writes the decision into the repository before anyone builds it. One engineer per issue, in a clean context. The next issue is a new session.

### Four steps

1. **State it.** GitHub issue: what the user can do afterwards. `feature` or `bug`. Board: Status (Ready is next) and Feature (F1–F9). P0 = the paying path is broken. The issue carries Surfaces, Invariants and Overlaps before it is Ready. An example of a parent in Coherence is a comment on that parent, not a new issue.
2. **Document if required.** New behaviour → that section of `docs/SPEC.md`. Look of a screen → `docs/DESIGN.md` (the three library rules, not a drawing). A bug in specified behaviour → no docs edit. An owner answer → one dated decision file the same day, `docs/spec/decisions/YYYY-MM-DD-<issue>.md`, headed by the SPEC section it belongs to (`node scripts/spec-decisions.mjs new <issue> <§n>` writes the head). A new ruling is never a new line in `docs/SPEC.md` itself, so two pull requests that each add one never conflict (owner, 2026-10-18, #1525).
3. **Implement.** One issue, one worktree, at `/root/projects/reachkitv3-wt/issue-<N>`, branched from `origin/main`. The checkout at `/root/projects/reachkitv3` stays on `main`. daisyUI classes in the route, Recharts for series, lucide for icons, the libraries on `docs/DESIGN.md`'s list and no others, Stripe / Resend / Supabase for those jobs. No new wrapper, no new CSS sheet, no SVG chart. PR: what changed, how you proved it, `Closes #n`. An issue cites a screen's board in `docs/DESIGN.md` for structure and wording, never pixels.
4. **Prove and ship.** The four gates below are green, including the Coherence reading inside `audit` and the strategy checks inside `no overflow · axe`. The engineer stops at the pull request. Release QA checks it and returns GO with the head SHA; the orchestrator merges with `gh pr merge --squash --delete-branch --match-head-commit <sha>`, removes the worktree and closes the tab. An expand-only migration is applied through the Supabase connector before the deploy whose code reads it; any other migration after the target deploy is READY. Merges deploy to dev and production (owner ruling 2026-09-17, #844); after a production deploy `deployer.sh` waits for Ready, syncs Inngest and runs `scripts/smoke.sh --free`, and its logged production check is the PASS; release QA returns PASS or FAIL only for a deploy that carries a migration, a new or changed Inngest job or a paid path, or when that check is red (owner, 2026-10-31). The owner looks at `dev.reachkit.app` for taste. There is no production freeze.

`blocked-on-owner` is not implemented around. Missing copy is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759): the PR body names every new or changed string so the owner can correct the wording.

Every owner decision is a dated line in a decision file under `docs/spec/decisions/`, `docs/DESIGN.md`, `docs/PROCESS.md` or `docs/RUNBOOK.md` before it is implemented. The dated lines already in `docs/SPEC.md` stay where they are. A decision that lives only in a chat is not one an engineer can read. Boards and their renders live in `docs/design/`. A canvas is a review surface, and where it and the repository disagree the repository wins. The tools on the box are described in `docs/RUNBOOK.md`, with how to recreate them.

### Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC/code/tests still agree + runtime `npm audit`) | **Yes** |
| `schema · RLS (live Postgres)` | **Yes** |
| `no overflow · axe (390 / 768 / 1280, light and dark)` | **Yes** — sweeps where a screen can change, success with a reason otherwise |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

`no overflow · axe` renders every `(public)` and `(account)` screen in a real browser, hydrated, at 390, 768 and 1280, and every `/app` screen at 1023 too, in light and dark, and runs `@axe-core/playwright` on the same page. It fails on an element wider than its container, on text its card cuts off, on a chart that did not fit or did not draw, on a serious or critical axe finding, and on a skeleton of `/app`, `/app/calendar` or `/setup` whose columns or rows differ from the screen that arrives (#1484). It takes no screenshot and keeps no baseline. The strategy list in `docs/DESIGN.md` is checked with it, by `tests/ui/design/strategy.test.ts` on the same code change. The owner looks at the live site for taste.

The design parity reading runs inside `no overflow · axe` (owner, 2026-10-20, #1714): `tests/ui/layout/parity.test.ts` reads each canvas board's strings with `scripts/design/parity.mjs`, and on a page or hosted route its components (lucide icons, rings, bars, charts, cards) with `scripts/design/components.mjs`, against what its route ships, and on the routes a pull request touches neither missing count goes up. Each is a count in `docs/design/parity/baseline.json` (`missing`, `components`), never a picture; a `component:<token> <n>` allow line excuses up to n of one component's gap. A board an issue claims to finish reaches 0.

A documentation-only pull request runs `audit` alone (owner, #1053). When every file it changes is under `docs/` or is markdown outside `src/`, `tests/`, `supabase/`, `.github/` and `scripts/`, `typecheck · lint · unit` and `schema · RLS` report skipped. Any other file runs them. The canvas boards and `docs/design/parity/` are not documentation here: a change to them runs the component tests that read the state boards (#1970).

`no overflow · axe` sweeps only a pull request that can change a screen (owner, 2026-10-18, #1525, amending #910): a path under `src/app`, `src/components`, `src/ui` or `src/lib/presentation`, the middleware, a stylesheet, `public/`, `tests/ui`, `package*.json`, `next.config.*`, or the sweep itself — its config, migrations, substrate, actions and `ci.yml`. `scripts/ci-changes.mjs` holds the list and prints why each path counts. Any other pull request still gets the check, as success with one reason line, so "every job reports on every pull request" holds as success-with-reason. It stays a required check.

A check may report *skipped* by path (owner C1 and C3, 2026-10-19, #1585): on a pull request `typecheck · lint · unit` runs only the unit tests vitest's module graph links to the diff (the full suite when a path in `scripts/ci-changes.mjs`'s list reaches tests through no import), `schema · RLS` runs only where the database can change, and `no overflow · axe` sweeps each width in one theme. `Nightly` runs every job in full on `main` at 02:41 UTC and opens or comments on one `[nightly]` issue when it is red; it is not a merge gate.

Before pushing, an engineer runs `npm run typecheck`, `npm run lint`, and only the test files that cover the files it changed, with `bash /root/ops/reachkit/bin/heavy.sh npm run test:unit -- <paths>`. Release QA runs unit tests the same way. `npm run test:unit` is the command CI's unit step runs, with the same projects, workers and 20 s timeout, so a red or green means the same everywhere (#1784). Each heavy command goes through `bash /root/ops/reachkit/bin/heavy.sh`. CI runs the unit tests the change reaches, and the nightly run all of them. An engineer does not run the whole `vitest run --project node --project ui` locally. A red full suite is read from the CI log (owner, 2026-10-08).

Two open pull requests may edit one hot copy key file only in separate key blocks (owner R14, 2026-10-22): release QA proves it at GO with `git merge-tree --write-tree` of the two heads; `docs/design/parity/baseline.json` is excepted, as its rows rebase by line.

Where the jobs run is `docs/RUNBOOK.md` §1: GitHub-hosted, no self-hosted runner while the repo is public. There is no fifth merge gate.

### Coherence

A change is finished when its conditions are checks and every screen it touches still matches the product strategy. Both readings sit inside the four gates. This is not a fifth gate, and it is not a standing agent.

**Feedback.** The session that hears the owner classifies it before a worktree exists. An example of a parent below is a comment on that parent. A word, a label, or a screen is the strategy in `docs/DESIGN.md`, and the change extends `tests/ui/design/strategy.test.ts` or the layout gate. A new condition is an issue whose Surfaces, Invariants and Overlaps are filled. An engineer starts only after that classification is on the issue. The session that classifies does not also implement.

**Before Ready.** The issue states the surfaces it touches (`scan`, `content`, `app`, `public`), the invariant that must stay true, and the overlaps: the `docs/SPEC.md` sections and open issues it was read against, and what was left alone. A slice of a parent is a sub-issue. An issue with any of those three empty is not Ready. An example of a parent below is a comment on that parent, not a new issue.

**On the pull request.** The body has `Conditions`, `Overlaps` and `Surfaces`. `audit` reads that body on a pull request and fails a missing or empty section. A section that is still only the template's note is empty. `none` is a real answer when the change cannot break a condition or cannot touch a surface. Each condition names the check that fails when it breaks. `audit` reads the registry below and fails when a named check file is missing, or when a new row is `pending`.

**UI.** Every change that can touch a screen runs `no overflow · axe` (Gates), which renders every `(public)` and `(account)` screen at 390, 768 and 1280, in light and dark. `tests/ui/design/strategy.test.ts` runs in `typecheck · lint · unit` on the same change. Together they hold the strategy in `docs/DESIGN.md`: the stack, the calm layer, the names, a title of at most six words, and no retired vocabulary. The owner looks at `dev.reachkit.app` for taste — voice, and an asset only the owner holds. Taste is not a second review of a condition the gates already check.

**After merge.** A witness of the same shape as the hygiene check reads stored production rows and comments on the one open parent for that surface. It does not edit the tree, it does not merge, and an engineer starts only from the issue it files. No witness runs until its script is named in this section and in `.github/workflows/drift-audit.yml`. Until that line is here, these parents stay open and the pull request is the enforcement.

| Parent | Surface | Condition | Check |
|---|---|---|---|
| #1454 | scan | One profile describes the business for a free scan, a paid site and the dogfood | pending |
| #1127 | content | A page is about the business and sourced, and a paying site on autopilot has its next page | pending |
| #1457 | app | Every figure on Overview equals the rows it opens, and the four tiles are the strategy | pending |
| #1458 | public | The public offer matches the product, and a ranked URL does not 404 | tests/presentation/copy/public-claims.test.ts |

`pending` is allowed only on `#1454`, `#1127` and `#1457`, the three parents whose check is not written yet. A later condition names a file. `#1455` is the silence inside `#1127`, not a fifth parent. A pull request names a parent with `Refs #n`: `audit` fails a body that says Closes, Fixes or Resolves for one, and `scripts/hygiene.mjs` fails while a parent with a row here is closed.

The box is checked by hand with `node scripts/box.mjs` (`npm run box`). It reports a dirty worktree, a worktree with no open pull request, a worktree ahead of or behind its remote, and a leftover that is not a worktree. `--clean` removes only an empty directory on its list, a loadgen folder that holds a Next cache, and a closed-sessions spreadsheet. It never removes a worktree and it never edits `main`. It is not a gate and it does not run on the timer.

`scripts/hygiene.mjs` runs inside `audit`. It fails when an authority page is missing, when Current and the workflows disagree on the four gates, when a second process page appears, when a name in that script's list is back in the tree, or when a Coherence registry parent is closed. The nightly run of the audit workflow, and `rk-hygiene.timer` at 05:30 UTC, open one issue titled `[hygiene]` when the check is red, or comment on the open one. The check does not edit the tree. An engineer starts from that issue, one worktree, then the tab closes. It is not a fifth gate.

### Testing budget

Tests prove customer-observable behaviour. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

New fixtures are synthetic: no copied third-party page, no real person's address. Stored panel evidence holds no email address.

1. **Stored evidence first, fixtures by default.** A question is answered from stored rows and stored vendor responses (`fetches` payloads, `scripts/panel/evidence/`, `npm run panel -- --recheck`) where they can answer it. Tests and proofs use recorded responses unless the question cannot be answered without a new call. A live run happens once, as proof after the merge.
2. **One dogfood site.** Live tests run on `reachkit.app`, plus at most one control site.
3. **A live vendor call needs the master session's approval first.** An engineer asks on its issue, naming the calls, the sites and the cap, and waits for the master session's comment before any paid DataForSEO or model call. The cap defaults to 20¢ per issue. The pull request reports the spend.
4. **€2 a day across all live testing, judged on what the vendors billed.** Spend is recorded in USD cents and the cap is converted at the rate in `constants.ts`. `npm run costs` shows billed beside recorded and judges the cap on billed spend where it is known, recorded spend where it is not (`docs/RUNBOOK.md` §8). Paid calls made by a script on the box are in `/root/ops/reachkit/spend.jsonl`. It warns at €1.50. Run it before a live test. An agent that would exceed the cap stops and asks the owner first.
5. **At most three implementation agents at once.** No new issue is started while a proof is pending.
6. **One smoke test per deploy batch.**
7. **The Monday weekly pass is the default live proof.**

Every change to market understanding, the knowledge base, rivals, terms, measured searches or topics passes `npm run panel` before the owner is asked to measure. A pass on reachkit.app alone is not proof. The panel is `docs/walk/panel/sites.json`. It runs only when a change touches how markets, rivals, terms, measured searches or topics are read, on at most five sites a run, after a 0¢ `--recheck` of the stored run could not answer the question. Its cap is 100¢ a run unless the issue states another. `npm run panel -- --recheck --date <date>` judges a stored run again for 0¢ (`docs/RUNBOOK.md` §4).

The full matrix is a tool, not a job: `npm run test:layout:full` with `RK_LAYOUT_FULL=1`, on the box, against `scripts/db-substrate/up.sh --run`, when a width the gate does not reach needs an answer. Read the answer the same day.

### Deploys

Vercel Hobby, Git deployments off. `rk-deployer` deploys `main` (dev every SHA, production at most every two hours). Production is deployed with each merge batch (`/root/ops/reachkit/bin/redeploy.sh`) as well as dev. There is no freeze (2026-09-17, #844). Manual: `bash /root/ops/reachkit/bin/deploy-dev-once.sh`.

`supabase/migrations` is the schema. A file under `/root/ops` that lists migrations is a log, not a queue. Do not re-apply a migration because a log still names it.

### Worktrees

One open issue, one worktree, one session: `/root/projects/reachkitv3-wt/issue-<N>`, branched from `origin/main`. When the pull request merges, remove the worktree. Do not brief the same session onto a second issue.

A worktree whose commits are already on `origin/main`, and whose issue is closed, is deleted. Untracked `node_modules` is not a reason to keep it. A worktree with its own commits that are not on `main`, or with an open pull request, stays.

The Herdr workspace labelled `reachkit` gets one tab per issue, named `rk-<N>`. The tab is closed when the pull request merges or the issue closes. The engineer is started in that tab with its role, `claude --agent engineer` (owner, 2026-10-19, #1578). The orchestration session does not spawn that engineer as a subagent and does not share its transcript. An agent already running may finish. The next one is a new tab (owner, 2026-09-24).

### What gets worked

The milestone **Launch** is the launch queue. Take an open Launch issue that is not `blocked-on-owner` before any issue outside that milestone.

`later` and `parked` are not started while a Launch issue is open. `blocked-on-owner` is not implemented around: the owner acts, the issue stays open, and nobody codes a guess.

### Never

- Invent a user-facing sentence.
- Match the pixels or copy the markup of any board or canvas. Citing a screen's board for what it holds is expected (`docs/DESIGN.md`).
- Add a custom component, CSS sheet or SVG chart where daisyUI or Recharts exists.
- Guess an owner decision.
- Add a merge gate beyond the four above.
- Spawn an implementation agent as a subagent of the orchestration session. It is a Herdr tab in the reachkit workspace, one issue, then the tab is closed.
- Keep a second copy of these rules in a memory file, a settings note, or `/root/ops`.
- Schedule a standing agent to re-read these pages. The hygiene check is the daily pass. The coherence witness, once its script is named in Coherence, is the same kind of pass. An engineer starts only from the issue either one files.
  2026-10-19  **One weekly review run is the exception** (owner, C7, #1631). `.claude/skills/weekly-review/` reads code, CI and production read-only at 0¢ on Mondays and files at most five unready `from-weekly` issues, classified under Coherence; it never edits the tree, merges, deploys or spends. No other scheduled agent.

## History

Dated rulings. They explain Current. They are not instructions to carry out.

2026-10-31  **Less coordination spend** (owner, efficiency review: "do all four"). From 10-24 to 10-31 the master session used about 36% of all agent spend and engineering about 41%. One `--continue` session had run for 10 days and carried about 470k tokens into every call, and about 37% of its calls were polling. Release QA ran 41 times for 31 merges, and its post-deploy pass repeated the deployer's Ready, Inngest and smoke check with a paid test scan. Nothing merged from 10-26 to 10-30 while the master waited for a reply. (1) The master restarts fresh each day and after each wave, from `/root/ops/reachkit/handoff/master.md`. (2) It waits on one batched watcher, `/root/ops/reachkit/bin/master-watch.sh`. (3) The deployer's production check is the post-deploy PASS; release QA runs after a deploy only for a migration, a job, a paid path or a red check. (4) The master never ends a turn waiting on the owner while the queue holds work. Stated in Current.

2026-10-19  **Delivery agents** (owner, #1578). Dedicated agents do the delivery: product manager (issues, waves, acceptance), engineer (one issue, one PR, never merges), release QA (GO before a merge, PASS after a deploy), with the architect setting order and proof. The orchestrator merges, migrates and deploys. Definitions live in `~/.claude/agents/`.

2026-09-21  **`no overflow · axe` is the fourth merge gate** (owner, #910). A pull request merges when it is green beside `typecheck · lint · unit`, `audit` and `schema · RLS`. Its known-defect list excuses only a defect found on `main` under an issue number, never one a pull request introduces, and it is empty as of #946.

2026-09-21  **The browser checks that used to run only after a merge were folded into that gate** (owner, #976, #988). Folded in: the five-check route sweep, the eyebrow rung, the heading scale, the live and week-0 accounts, Settings with a field open, the current Settings tab on screen, the security headers, the theme slots and the values, and the landing's script budget. The gate takes no screenshot and keeps no baseline. The owner looks at the live site. It is the only browser job.

2026-09-22  **CI runs on the box** (owner, #1013). Superseded in part on 2026-09-25: light jobs are hosted, and the browser job stays on the box. Superseded 2026-10-22 (#1815): CI runs only on GitHub-hosted runners.

2026-09-23  **One runner on this box for the browser job** (owner, #1035). The machine has four cores and 7.6 GB. On 2026-09-23 `reachkit-box` peaked at 4.5 GB while the load was already above the core count. A second browser sweep on this box was refused. With that measurement the owner accepted the queue. Superseded 2026-10-22 (#1815): CI runs only on GitHub-hosted runners.

2026-09-23  **The nightly full matrix is retired** (#1029). It walked six widths, three bands and both themes every night, after the merge, and its runs concluded failure. A job that runs after the merge reports too late to act on. Its last run failed 91 cases. 84 were the gate's own screens measured against an older allow-list: the off-canvas drawer, and text the 2026-09-20 ruling clamps on purpose. Five were real defects at widths the gate cannot reach, filed as #1040 and #1041. Two were the landing's script budget, folded into the gate by #988. The command in Current is what remains.

2026-09-23  **The repository is the only store of decisions and boards** (owner, #1026). The orchestration session holds no implementation and no state. One engineer per issue, retired when that issue's pull request merges or the issue closes. All implementation work traces to an open, documented issue.

2026-09-24  **No second run on `main`** (#1052). `ci.yml` runs on `pull_request` and `workflow_dispatch` only. A post-merge run cannot stop the merge it follows, and it held the one runner while the next pull request waited. The deployers read `main`'s SHA, not its checks.

2026-09-24  **A documentation-only pull request runs `audit` alone** (owner, #1053). Stated in Current.

2026-09-25  **Light jobs hosted, the browser job on the box** (owner, #1113; partly reverses #1013). `what changed`, `typecheck · lint · unit`, `schema · RLS` and `audit` run on GitHub-hosted runners, in parallel. `no overflow · axe` stays on `reachkit-box`. The light jobs take `runs-on` from `CI_LIGHT_RUNNER`. When the hosted minutes run out, those jobs fail with a billing error, and the fix is `gh variable set CI_LIGHT_RUNNER --body '["self-hosted","reachkit-light"]'`. `gh variable delete CI_LIGHT_RUNNER` sends them back to hosted. The minutes switch and the second runner are `docs/RUNBOOK.md` §1. Superseded 2026-10-22 (#1815): CI runs only on GitHub-hosted runners.

2026-09-25  **A second runner on the box, for light jobs only** (owner, #1113; revises #1035). `reachkit-light` carries only the `reachkit-light` label and takes the light jobs when `CI_LIGHT_RUNNER` sends them to the box. It is capped at 1.5 GB (`MemoryMax`) at the lowest CPU priority, so it cannot starve the browser job or the implementation agents. The browser job stays on the single `reachkit` runner, so two browser sweeps never run at once. Superseded 2026-10-22 (#1815): CI runs only on GitHub-hosted runners.

2026-10-03  **The smallest test that gives the same result** (owner, D34, #1210). The seven rules in Current.

2026-10-06  **Test spend is logged, and `npm run costs` reads it** (owner, D57, #1286). Stated under rule 4 in Current.

2026-10-07  **The customer panel is the acceptance test for market understanding** (owner, #1304). Stated in Current. The product is validated for the variety of customers who sign up, not tuned to make reachkit.app score well.

2026-10-08  **Engineers run only the tests their change touches** (owner). CI runs the full `typecheck · lint · unit` suite on the box. An engineer does not run the whole `vitest run --project node --project ui` locally. Stated in Current. This frees the box's two heavy cores for the gates. Superseded 2026-10-22 (#1815): CI runs only on GitHub-hosted runners.

2026-10-08  **The hygiene check keeps the documents and the box on Current** (owner). Stated in Current. It is part of `audit`, not a fifth gate. The timer is `docs/RUNBOOK.md`.

2026-10-11  **Test spend is judged on what the vendors billed** (owner, #1408). An audit found the price book overstated DataForSEO by about 1.7× on the day, and about $56 of lifetime DataForSEO spend in no record. Fixtures are the default, a live vendor call needs the master session's approval with a cap (default 20¢), the panel runs only for a change to how markets are read on at most five sites, and the €2 cap is judged on billed spend recorded in USD. Stated in Current.

2026-10-15  **A change is finished when its conditions are checks and the UI still matches the strategy** (owner, #1463). Stated in Current, Coherence. It is inside `audit` and `no overflow · axe`. It is not a fifth gate. The witness does not run until its script is named there.

2026-10-18  **CI throughput: rulings in their own files, the sweep where a screen can change** (owner, #1525: "yes to all four"). Merges took one to two hours: each pull request held the one box runner for about 35 minutes (unit 14, layout 17, db 3.5), and `docs/SPEC.md` changed in 31 recent merges, so nearly every merge sent the next pull request back with a conflict and a second run. (1) A new dated SPEC ruling is its own file under `docs/spec/decisions/`; `audit` reads those files with SPEC.md. (2) `no overflow · axe` sweeps only where a screen can change and otherwise passes with a reason; this amends #910's "every job reports on every pull request", which now holds as success-with-reason. (3) `Layout nightly` sweeps `main` every night and files a `[layout]` issue when red. It is the gate's own project, not the full matrix #1029 retired, and unlike the post-merge run #1052 removed it runs once a night, not after every merge, and nothing waits on it. Four gates, no fifth. Stated in Current.

2026-10-22  **CI runs only on GitHub-hosted runners** (owner action: the repository is public; #1815, PR #1813). No self-hosted runner is registered while the repository is public: a fork's pull request would run its own workflow on the box. This supersedes the runner parts of #1013, #1035 and #1113 and the "on the box" part of the 2026-10-08 line. `docs/RUNBOOK.md` §1.
2026-10-22  **One unit command** (architect, #1784). The 5000 ms timeouts agents reported came from plain `npx vitest run`, which uses vitest's default timeout and worker count; CI had run `--maxWorkers=2 --testTimeout=20000` since #1569 with no timeout in 200 runs. `npm run test:unit` carries CI's flags, CI calls it, and engineers and release QA run it through `heavy.sh`. `vitest.config.*` keeps the defaults.
