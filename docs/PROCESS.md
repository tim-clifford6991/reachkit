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
| **Engineer** | One session, one issue. Issue → docs if behaviour changed → implement with libraries → PR → merge when the four gates are green. |

The orchestration session holds no implementation and no state. It writes the decision into the repository before anyone builds it. One engineer per issue, in a clean context. The next issue is a new session.

### Four steps

1. **State it.** GitHub issue: what the user can do afterwards. `feature` or `bug`. Board: Status (Ready is next) and Feature (F1–F9). P0 = the paying path is broken.
2. **Document if required.** New behaviour → that section of `docs/SPEC.md`. Look of a screen → `docs/DESIGN.md` (the three library rules, not a drawing). A bug in specified behaviour → no docs edit. An owner answer → one dated line in that SPEC section the same day.
3. **Implement.** One issue, one worktree, at `/root/projects/reachkitv3-wt/issue-<N>`, branched from `origin/main`. The checkout at `/root/projects/reachkitv3` stays on `main`. daisyUI classes in the route, Recharts for series, lucide for icons, the libraries on `docs/DESIGN.md`'s list and no others, Stripe / Resend / Supabase for those jobs. No new wrapper, no new CSS sheet, no SVG chart. PR: what changed, how you proved it, `Closes #n`. An issue cites a screen's board in `docs/DESIGN.md` for structure and wording, never pixels.
4. **Prove and ship.** The four gates below are green. `gh pr merge --squash --delete-branch`, then remove the worktree and close the tab. Owner clicks `dev.reachkit.app`. Merges deploy to dev and production (owner ruling 2026-09-17, #844); run `scripts/smoke.sh` against production after a production deploy. Apply a merged migration through the Supabase connector after the target deploy is READY, then walk the path again. There is no production freeze.

`blocked-on-owner` is not implemented around. Missing copy is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759): the PR body names every new or changed string so the owner can correct the wording.

Every owner decision is a dated line in `docs/SPEC.md`, `docs/DESIGN.md`, `docs/PROCESS.md` or `docs/RUNBOOK.md` before it is implemented. A decision that lives only in a chat is not one an engineer can read. Boards and their renders live in `docs/design/`. A canvas is a review surface, and where it and the repository disagree the repository wins. The tools on the box are described in `docs/RUNBOOK.md`, with how to recreate them.

### Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC/code/tests still agree + runtime `npm audit`) | **Yes** |
| `schema · RLS (live Postgres)` | **Yes** |
| `no overflow · axe (390 / 768 / 1280, light and dark)` | **Yes** |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

`no overflow · axe` renders every `(public)` and `(account)` screen in a real browser, hydrated, at 390, 768 and 1280, in light and dark, and runs `@axe-core/playwright` on the same page. It fails on an element wider than its container, on text its card cuts off, on a chart that did not fit or did not draw, and on a serious or critical axe finding. It takes no screenshot and keeps no baseline. The owner looks at the live site.

A documentation-only pull request runs `audit` alone (owner, #1053). When every file it changes is under `docs/` or is markdown outside `src/`, `tests/`, `supabase/`, `.github/` and `scripts/`, the other three gates report skipped. Any other file runs all four.

Before pushing, an engineer runs `npm run typecheck`, `npm run lint`, and the test files that cover the files it changed (`npx vitest run <paths>`). Each heavy command goes through `bash /root/ops/reachkit/bin/heavy.sh`. CI runs the full `typecheck · lint · unit` suite. An engineer does not run the whole `vitest run --project node --project ui` locally. A red full suite is read from the CI log (owner, 2026-10-08).

Where the jobs run is `docs/RUNBOOK.md` §1. There is no fifth merge gate.

`scripts/hygiene.mjs` runs inside `audit`. It fails when an authority page is missing, when Current and the workflows disagree on the four gates, when a second process page appears, or when a name in that script's list is back in the tree. The nightly run of the audit workflow, and `rk-hygiene.timer` at 05:30 UTC, open one issue titled `[hygiene]` when the check is red, or comment on the open one. The check does not edit the tree. An engineer starts from that issue, one worktree, then the tab closes. It is not a fifth gate.

### Testing budget

Tests prove customer-observable behaviour. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

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

The Herdr workspace labelled `reachkit` gets one tab per issue, named `rk-<N>`. The tab is closed when the pull request merges or the issue closes. The orchestration session does not spawn that engineer as a subagent and does not share its transcript. An agent already running may finish. The next one is a new tab (owner, 2026-09-24).

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
- Schedule a standing agent to re-read these pages. The hygiene check is the daily pass, and an engineer starts only from the issue it files.

## History

Dated rulings. They explain Current. They are not instructions to carry out.

2026-09-21  **`no overflow · axe` is the fourth merge gate** (owner, #910). A pull request merges when it is green beside `typecheck · lint · unit`, `audit` and `schema · RLS`. Its known-defect list excuses only a defect found on `main` under an issue number, never one a pull request introduces, and it is empty as of #946.

2026-09-21  **The browser checks that used to run only after a merge were folded into that gate** (owner, #976, #988). Folded in: the five-check route sweep, the eyebrow rung, the heading scale, the live and week-0 accounts, Settings with a field open, the current Settings tab on screen, the security headers, the theme slots and the values, and the landing's script budget. The gate takes no screenshot and keeps no baseline. The owner looks at the live site. It is the only browser job.

2026-09-22  **CI runs on the box** (owner, #1013). Superseded in part on 2026-09-25: light jobs are hosted, and the browser job stays on the box.

2026-09-23  **One runner on this box for the browser job** (owner, #1035). The machine has four cores and 7.6 GB. On 2026-09-23 `reachkit-box` peaked at 4.5 GB while the load was already above the core count. A second browser sweep on this box was refused. With that measurement the owner accepted the queue.

2026-09-23  **The nightly full matrix is retired** (#1029). It walked six widths, three bands and both themes every night, after the merge, and its runs concluded failure. A job that runs after the merge reports too late to act on. Its last run failed 91 cases. 84 were the gate's own screens measured against an older allow-list: the off-canvas drawer, and text the 2026-09-20 ruling clamps on purpose. Five were real defects at widths the gate cannot reach, filed as #1040 and #1041. Two were the landing's script budget, folded into the gate by #988. The command in Current is what remains.

2026-09-23  **The repository is the only store of decisions and boards** (owner, #1026). The orchestration session holds no implementation and no state. One engineer per issue, retired when that issue's pull request merges or the issue closes. All implementation work traces to an open, documented issue.

2026-09-24  **No second run on `main`** (#1052). `ci.yml` runs on `pull_request` and `workflow_dispatch` only. A post-merge run cannot stop the merge it follows, and it held the one runner while the next pull request waited. The deployers read `main`'s SHA, not its checks.

2026-09-24  **A documentation-only pull request runs `audit` alone** (owner, #1053). Stated in Current.

2026-09-25  **Light jobs hosted, the browser job on the box** (owner, #1113; partly reverses #1013). `what changed`, `typecheck · lint · unit`, `schema · RLS` and `audit` run on GitHub-hosted runners, in parallel. `no overflow · axe` stays on `reachkit-box`. The light jobs take `runs-on` from `CI_LIGHT_RUNNER`. When the hosted minutes run out, those jobs fail with a billing error, and the fix is `gh variable set CI_LIGHT_RUNNER --body '["self-hosted","reachkit-light"]'`. `gh variable delete CI_LIGHT_RUNNER` sends them back to hosted. The minutes switch and the second runner are `docs/RUNBOOK.md` §1.

2026-09-25  **A second runner on the box, for light jobs only** (owner, #1113; revises #1035). `reachkit-light` carries only the `reachkit-light` label and takes the light jobs when `CI_LIGHT_RUNNER` sends them to the box. It is capped at 1.5 GB (`MemoryMax`) at the lowest CPU priority, so it cannot starve the browser job or the implementation agents. The browser job stays on the single `reachkit` runner, so two browser sweeps never run at once.

2026-10-03  **The smallest test that gives the same result** (owner, D34, #1210). The seven rules in Current.

2026-10-06  **Test spend is logged, and `npm run costs` reads it** (owner, D57, #1286). Stated under rule 4 in Current.

2026-10-07  **The customer panel is the acceptance test for market understanding** (owner, #1304). Stated in Current. The product is validated for the variety of customers who sign up, not tuned to make reachkit.app score well.

2026-10-08  **Engineers run only the tests their change touches** (owner). CI runs the full `typecheck · lint · unit` suite on the box. An engineer does not run the whole `vitest run --project node --project ui` locally. Stated in Current. This frees the box's two heavy cores for the gates.

2026-10-08  **The hygiene check keeps the documents and the box on Current** (owner). Stated in Current. It is part of `audit`, not a fifth gate. The timer is `docs/RUNBOOK.md`.

2026-10-11  **Test spend is judged on what the vendors billed** (owner, #1408). An audit found the price book overstated DataForSEO by about 1.7× on the day, and about $56 of lifetime DataForSEO spend in no record. Fixtures are the default, a live vendor call needs the master session's approval with a cap (default 20¢), the panel runs only for a change to how markets are read on at most five sites, and the €2 cap is judged on billed spend recorded in USD. Stated in Current.
