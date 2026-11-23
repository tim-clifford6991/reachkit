# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy (`README.md`).

This page states the approach of the open `simplify` tracking issue (#2513) and the owner rulings on #2513 and #2299. Where this page and those rulings disagree, the rulings win and this page is fixed in the same change that finds it. How the rules got here is in git.

## Current

### 1. Rules and rulings

`docs/SPEC.md` holds one table of current rules per section (owner C7, 2026-11-08): `name | block/warn | outcome protected | ruling`. Once a section's table has landed, an owner ruling edits its row, with the date and the ruling, in the same pull request, and no new decision file is added for that section. Until then a ruling is a dated decision file, `docs/spec/decisions/YYYY-MM-DD-<issue>.md`, headed by its section (`node scripts/spec-decisions.mjs new <issue> <§n>`); a file that supersedes another names it on a `replaces:` line.

A rule may stop a topic or a page for five reasons only, the five `block` rows of `docs/SPEC.md` §0 (owner, 2026-11-23, #2722 rulings 97 and 98): a duplicate of a live or planned page; not a buyer's search for what the business sells; a claim no stored source supports; harm (the law, a platform's terms, or the customer's no); a spend or volume cap. Each reason is checked once, where the pipeline needs it; every other rule is a ranking weight or is deleted. A sixth reason needs an owner ruling, and an incident fix never adds one. An issue or pull request that adds or changes a check that can stop a topic or a page names, under Conditions, the reason it enforces and the one check it extends. `blockRules` in `scripts/budgets.json` is 5 for §0 and 0 elsewhere, and `scripts/hygiene.mjs` fails any other count.

### 2. The queue

The queue is the wave table in #2513. Labels decide order, with `urgent` and `now` before everything else; `Post Launch` is not started (owner 2026-11-06 and 2026-11-09; D5's held performance issues are now Post Launch, except #2478, which is un-parked). The GitHub milestone is not a queue.

An issue is Ready when it carries Conditions, Invariants, Surfaces and Overlaps. The product manager writes it and classifies owner feedback before a worktree exists; the session that classifies does not also implement.

### 3. Space and the one loop

One issue, one worktree, one session; no session directs another. There is no master and no orchestrator, with one exception: the coordinator session, whose loop is `/root/ops/reachkit/box-loop/scripts/autopilot.md` (owner, 2026-11-08 and 2026-11-22). It starts the next eligible issue from #2513's queue, starts `release-qa` on a green `risk:*` pull request and `ux-designer` on a built UI pull request, and removes merged worktrees; it reads #2513 and does not copy its dependencies.

A session is started with `space.sh reachkit <issue> [role]` in the Herdr workspace `reachkit`, one tab per issue. The engineer works in `/root/projects/reachkit/.wt/issue-<N>`, branched from `origin/main`, and stops at one pull request or one comment. The checkout at `/root/projects/reachkit` stays on `main`. A worktree is removed when its pull request merges. The agent roles are the files in `.claude/agents/`.

Two agents are scheduled, both read-only and 0¢. The first is the Monday weekly review, `.claude/skills/weekly-review/`, which files no issues: its findings go to the owner in its report (owner, 2026-11-23, #2722 ruling 99). The second is the daily check, `.claude/agents/daily-check.md`, run by `rk-daily-check.timer`.

### 4. Merge and deploy

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC, code and tests agree; `scripts/hygiene.mjs`; runtime `npm audit`) | **Yes** |
| `schema · RLS` (live Postgres) | **Yes** |
| `no overflow · axe` (390 / 768 / 1280, light and dark) | **Yes**, success with a reason where no screen can change |

An ordinary pull request is opened as a draft (rule 6, Where checks run), marked ready once its gates are green, and armed then (`gh pr merge <n> --auto --squash --delete-branch`); GitHub squashes it when the four gates pass. A pull request labelled `risk:paid`, `risk:migration` or `risk:job`, or one that adds a migration, is never armed by its engineer; release QA arms it with `--match-head-commit <sha>` in the same step as its GO comment on that SHA (owner, 2026-11-08). An expand-only migration is applied by hand before the deploy whose code reads it (`docs/RUNBOOK.md` §9). `rk-deployer` ships `main`: dev every SHA, then production once that SHA's free dev check passes, then the production check, which is the PASS. Release QA returns PASS or FAIL only for a migration, a job, a paid path or a red check. Roll forward only.

`scripts/hygiene.mjs` runs inside `audit`, and nightly and on `rk-hygiene.timer` it opens or comments on one `[hygiene]` issue when it is red. A file over 600 lines or a folder over its cap may only shrink.

### 5. Spend

0¢ by default. A paid vendor or model call needs the owner's comment on that issue naming the calls and the cap (owner, 2026-11-08, #2543). Answer from stored rows and replays first; the pull request reports what was spent.

### 6. Tests

The speed-first test policy (owner, 2026-11-08, https://github.com/tim-clifford6991/reachkit/issues/2513#issuecomment-6728550219):

- A test is required only for money (checkout, webhooks, the paid check, cost caps), data loss (delete, unpublish, migrations, database access rules), one duplicate-run case per production job, and one case for a bug that reached production.
- Everything else is proven in the pull request body: a free replay of stored scans, a golden diff, one case added to an existing journey, or the free smoke run on dev after merge.
- Never write a test that mocks our own modules, renders markup or checks copy, icons or styling, reads `src` or `docs` as text, or pins a ruling number.
- Test lines changed are at most a third of `src` lines changed. A pull request without money in it adds zero test lines.
- `tests/archive/` holds the old suite, outside the runner, typecheck, lint and CI. A test outside the safety net that goes red only because code moved goes there in the same pull request; it is not repaired. The archive is deleted when the owner says the new system has proven itself.

**Where checks run.** The repository is public, so GitHub Actions minutes are free and unlimited, and nothing that CI can run is run on the box (owner, 2026-11-21, #3134). An engineer opens the pull request early as a draft (`gh pr create --draft`), pushes, and lets the four gates prove the change, watching them in the same turn (`gh pr checks <n> --watch`); a red gate is fixed and pushed before the engineer stops. On the box an engineer runs only eslint on the changed files and the single unit test file being edited (`npm run test:unit -- <file>`): no local typecheck, `next build`, layout suite, db suite, full unit suite or `scripts/hygiene.mjs`. `bash /root/ops/reachkit/bin/heavy.sh` is the exception path, used only while CI is down, to reproduce a failure that happens only in CI, or for release QA to check two open pull requests merged together, which no CI run sees. When the gates are green the draft is marked ready (`gh pr ready <n>`) and armed as rule 4 says. Every other page links here rather than restating this.

### 7. Owner, copy and gates

- `blocked-on-owner` is not built around. What a ruling, this page, SPEC or DESIGN answers is decided, with its basis recorded on the issue. Anything else is asked on the issue, and the session stops.
- Never ship `TODO(copy)` (#759): draft the string in the voice of `src/lib/presentation/copy/keys/` and name every new or changed string in the pull request body.
- Never a fifth gate.
- Agents at once: as many as the box's free memory allows, keeping at least 2,500 MB free. The old cap of 4 was set for the local heavy runs that rule 6 retired (coordinator, 2026-11-21, under the owner's 2026-11-22 ruling that the coordinator decides the most efficient path).

### 8. UX review before a UI build

Owner, 2026-11-15 (#2712): "ensure for any future UX improvements or fixes, teh ux designer agent is resolved to ensure these simple errors are not faced again."

- Any issue that changes what a person sees, reads or does (a screen, dialog, mail, copy or layout) gets a **ux-designer** review before an engineer builds it.
- A screen only the owner can see (for example `/app/review` and other owner-only keys and boards) needs no UX review; customer-facing screens, mail and public pages always do.
- The product manager copies the ux-designer's conditions into the issue as a comment headed `UX review`. Until that comment exists the issue is not Ready.
- A pull request that changes a screen, dialog, mail, public page or customer-facing wording also gets a ux-designer read of the built change (390 and 1280, the strings as built) before merge, labelled or not; the read is a PR comment headed `UX check`, and until it exists the pull request is not armed (owner, 2026-11-20, #2722 ruling 55). It is one pass: the designer names blocking defects only and never asks for a test, and a non-blocking note goes to one follow-up issue. These two, the review before build and the check of the built pull request, are the only UX checkpoints (owner, 2026-11-23, #2722 ruling 99).
- The pull request lists those conditions under Conditions, and its body says it meets each one with its proof.
- The automatic half is the daisyUI include-list check from #2711: it fails when `src/**/*.tsx` uses a daisyUI component that `src/ui/tailwind.css`'s `include:` leaves out. It runs inside the existing gates; it is not a fifth gate.

### Coherence

A pull request body has `Conditions`, `Overlaps` and `Surfaces`, and `audit` fails one that is missing or empty; `none` is a real answer. Each condition names its proof under rule 6.

| Parent | Surface | Condition | Check |
|---|---|---|---|
| #1458 | public | A ranked URL does not 404 | tests/app/library/old-paths.test.ts |

`#1454` (scan), `#1127` (content) and `#1457` (app) have no row: the weekly review reads them, and they stay open. A pull request names any of the four parents with `Refs #n`, never Closes, and `scripts/hygiene.mjs` fails while a parent with a row here is closed.
