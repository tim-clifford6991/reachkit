# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy (`README.md`).

This page states the approach of the open `simplify` tracking issue (#2513) and the owner rulings on #2513 and #2299. Where this page and those rulings disagree, the rulings win and this page is fixed in the same change that finds it. How the rules got here is in git.

## Current

### 1. Rules and rulings

`docs/SPEC.md` holds one table of current rules per section (owner C7, 2026-11-08): `name | block/warn | outcome protected | ruling`. Once a section's table has landed, an owner ruling edits its row, with the date and the ruling, in the same pull request, and no new decision file is added for that section. Until then a ruling is a dated decision file, `docs/spec/decisions/YYYY-MM-DD-<issue>.md`, headed by its section (`node scripts/spec-decisions.mjs new <issue> <§n>`); a file that supersedes another names it on a `replaces:` line.

Agents add only `warn` rules, and only the owner makes a rule `block`. An incident fix adds no block rule: it relaxes or deletes one, or it goes to the owner. `blockRules` in `scripts/budgets.json` holds each section's count of `block` rows, and `scripts/hygiene.mjs` fails a count that differs from it.

### 2. The queue

The queue is the wave table in #2513. Labels decide order: `urgent` before `Post Launch`; `parked` and `later` are not started (owner 2026-11-06; D5 2026-11-08: the parked four stay on hold unless urgent or essential to revenue). The GitHub milestone is not a queue.

An issue is Ready when it carries Conditions, Invariants, Surfaces and Overlaps. The product manager writes it and classifies owner feedback before a worktree exists; the session that classifies does not also implement.

### 3. Space and the one loop

One issue, one worktree, one session; no session directs another. There is no master and no orchestrator, with one exception: the box loop in `/root/ops/reachkit/box-loop/RULES.md` (owner, 2026-11-08), which starts the next eligible issue from #2513's wave table, starts `release-qa` on a green `risk:*` pull request, and removes merged worktrees; it reads #2513 and does not copy its dependencies.

A session is started with `space.sh reachkit <issue> [role]` in the Herdr workspace `reachkit`, one tab per issue. The engineer works in `/root/projects/reachkit/.wt/issue-<N>`, branched from `origin/main`, and stops at one pull request or one comment. The checkout at `/root/projects/reachkit` stays on `main`. A worktree is removed when its pull request merges. The agent roles are the files in `.claude/agents/`.

The one scheduled agent is the Monday weekly review, `.claude/skills/weekly-review/`: read-only, 0¢, at most five unready `from-weekly` issues.

### 4. Merge and deploy

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC, code and tests agree; `scripts/hygiene.mjs`; runtime `npm audit`) | **Yes** |
| `schema · RLS` (live Postgres) | **Yes** |
| `no overflow · axe` (390 / 768 / 1280, light and dark) | **Yes**, success with a reason where no screen can change |

An ordinary pull request is opened with auto-merge armed (`gh pr merge <n> --auto --squash --delete-branch`), and GitHub squashes it when the four gates pass. A pull request labelled `risk:paid`, `risk:migration` or `risk:job`, or one that adds a migration, is opened without it; release QA arms it with `--match-head-commit <sha>` in the same step as its GO comment on that SHA (owner, 2026-11-08). An expand-only migration is applied by hand before the deploy whose code reads it (`docs/RUNBOOK.md` §9). `rk-deployer` ships `main`: dev every SHA, then production once that SHA's free dev check passes, then the production check, which is the PASS. Release QA returns PASS or FAIL only for a migration, a job, a paid path or a red check. Roll forward only.

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

Locally, run `npm run typecheck`, eslint on the changed files, and only the tests that cover them with `bash /root/ops/reachkit/bin/heavy.sh npm run test:unit -- <paths>`. Never the full suite; CI runs it.

### 7. Owner, copy and gates

- `blocked-on-owner` is not built around: ask on the issue and stop.
- Never ship `TODO(copy)` (#759): draft the string in the voice of `src/lib/presentation/copy/keys/` and name every new or changed string in the pull request body.
- Never a fifth gate.
- At most 4 engineers at once while 2.5 GB is free (owner, 2026-10-31).

### Coherence

A pull request body has `Conditions`, `Overlaps` and `Surfaces`, and `audit` fails one that is missing or empty; `none` is a real answer. Each condition names its proof under rule 6.

| Parent | Surface | Condition | Check |
|---|---|---|---|
| #1458 | public | The public offer matches the product, and a ranked URL does not 404 | tests/archive/presentation/copy/public-claims.test.ts |

`#1454` (scan), `#1127` (content) and `#1457` (app) have no row: the weekly review reads them, and they stay open. A pull request names any of the four parents with `Refs #n`, never Closes, and `scripts/hygiene.mjs` fails while a parent with a row here is closed.
