# Process — how work flows in reachkit

The lean process (owner ruling 2026-09-05; the sdlc-factory is retired and archived). Roles: the
**owner** rules on the product and writes copy; the **master** orchestrates (files issues, briefs
implementers, reviews and lands PRs, records rulings, maintains the corpus); **implementers**
build exactly one issue each in their own worktree, in a **fresh session per issue** (owner ruling
2026-09-09): an implementer's whole context is the issue plus the documents this file names. If an
issue cannot be built from that, the issue is under-specified — the fix is to the issue, never a
briefing in chat. Session history is not a source of truth and is not carried between issues.
Inside its session an implementer **may spawn subagents** for its own issue — reading, implementing,
documenting, testing — as the work requires (owner ruling 2026-09-09); they share the session's
limit and the box's memory, so they count against §5's capacity and never run heavy commands
outside `heavy.sh`. **Only the master files issues and merges to `main`** (owner ruling 2026-09-09):
an implementer that finds adjacent work records it under *Adjacent* in the PR body and builds
nothing beyond its issue; the master files what deserves an issue and lands every PR.

**Since 2026-09-10 the implementers are subagents of one worker** (owner ruling): each project has one
long-lived worker agent (`rk-worker`, Herdr w3) that never implements and never reads the repository — it
spawns one fresh subagent per issue with the standard brief from `bin/issue-prompt.sh`, relays the
dispatcher's `Fix:` / `Rebase:` messages to that subagent, and reports the PR URL. The subagent is the
implementer in every rule above — fresh context, one issue, its own worktree — and may spawn subagents of
its own; only the master files issues and merges.

## 1. Units of work

- **One issue = one branch = one PR.** Branch `feat/<n>-<slug>` or `fix/<n>-<slug>` (`docs/` for corpus PRs).
- Every issue has **Done when** boxes stating observable behaviour, cites the BUILD § it implements, the REQ criteria it satisfies (`archive/…/requirements/REQ-*.md`) and, for a screen, its `S<id>` in UI-SPEC.md.
- Issues live in GitHub milestones: M1–M10 the build order (BUILD §16), M11 live verification and environments, M12 go-live readiness, M13 copy (owner), M14 UI fidelity to the approved set.
- Labels: `feature` · `bug` · `process` · `documentation` · `fix-first` (lands before others) · `blocked-on-owner` (the owner must act) · `later` (v1.1) · `regen-baselines` (CI rewrites the moved pixels, §5) · `review-gallery` (CI photographs every screen on this branch, §3).

## 2. Building — ten steps, and no eleventh

1. `git fetch`, worktree from `origin/main`, `bash /root/ops/reachkit/bin/heavy.sh npm ci` (§5: every heavy command goes through `heavy.sh`, never bare).
2. Read the issue, then **only** what it cites: the `BUILD.md` § it names, the `ARCHITECTURE.md` rows for the paths you touch, and — for a screen — UI-SPEC.md §1 and that screen's `S<id>`. **`DECISIONS.md` is grepped, never read whole**: `grep -in '<the nouns in your issue>' DECISIONS.md` and read the index at its head. Reading 250 rulings to build one issue is how an implementer spends a session on a document instead of on the product.
3. Build to the Done-when. Copy is the owner's and travels one route: the master drafts from v2 and the spec, the owner approves the sheet, you apply it byte for byte (2026-09-10). A key with no approved value is `TODO(copy)`, listed in the PR — you never write the sentence yourself. Adding keys means regenerating the copy ledger (`UPDATE_COPY_COUNTS=1 npx vitest run --project node tests/presentation/copy/registry.test.ts`); no total is ever hand-edited, which is what lets two screen PRs adding keys in different domains merge clean (#402).
4. Verify **locally only what you touched; CI runs everything else.** `bash /root/ops/reachkit/bin/heavy.sh npm run typecheck && npm run lint`, then `npx vitest run --project node --project ui --maxWorkers=1 <the test files for the source you changed>`; the `db` project only when `supabase/` or `src/lib/db/` changed (substrate up for that run, down straight after — §5). Push when the targeted tests pass; fix what CI names.
5. **Three things are never run on the box at all (issue #404): `next build`, the layout suite, and a baseline regeneration.** They are the same suites CI runs in parallel on GitHub's machines. What each one was for now has a CI path:

   | you want | you now |
   |---|---|
   | the render the master reviews | read the **Renders** comment CI leaves on the PR (`.github/workflows/ci.yml`, `scripts/renders/`) — the approved screen beside your branch, per moved route |
   | a moved baseline, regenerated | label the PR **`regen-baselines`**; CI rewrites the PNGs that moved, pushes them as `test(layout): baselines (ci)` and takes the label off (`.github/workflows/baselines.yml`). The push re-runs `ci.yml`, which is the confirming run |
   | to know a screen you did not move still looks right | add a `Renders: /app/settings, /pricing` line — **only if your PR changed a screen**; CI composes those too |
   | a layout failure explained | the run's `renders-<id>` artifact carries every capture and every side-by-side |

   `UPDATE_BASELINES=1` locally is the exception, not the rule: it is for a change CI cannot reach, and it goes through `heavy.sh` like everything else. A layout-suite run on the box is a rule breach, and the guard reports it (§7).
6. Tick the boxes you satisfied (never an owner-review box). Small conventional commits ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
7. PR body, four required lines and nothing else: `Closes #n` · **What changed** · **How I verified it** · **Owner owes** (keys, owner-file amendments, questions) · **Adjacent** (findings outside the issue — never a new issue; the master files those). Two lines are conditional and are omitted when they do not apply: the **token table** (every value → token) **only if the PR touches tokens or `src/ui/**`**, and a **`Renders:`** line **only if the PR changed a screen**. The side-by-side render is never pasted into the body and never built on the box — CI composes it and comments it on the PR (§5), so what the master reviews is the run's render, not a picture an implementer chose.
8. `gh pr checks --watch`; fix what you caused. **`Vercel` is not a check here** (2026-09-09): previews are off and the lander ignores any Vercel row — a red Vercel line is never yours to explain.
9. **Review feedback arrives as PR comments, never in chat.** The master's findings are written on the PR; a fresh implementer acts on them from the PR alone.
10. When the PR is open and green, report its URL in one line and stop. The next issue is a new session.

## 3. Landing

**Production deploys are the lander\'s** (2026-09-10): Vercel creates no deployment from Git (`vercel.json` `git.deploymentEnabled: false` — every push, including CI\'s render-asset branches, used to spend one of Hobby\'s 100 deployments a day); after each merge the lander runs `bin/redeploy.sh`, which asks Vercel for a production deployment of `main` through the REST API and retries every 20 minutes while rate-limited.

Required checks on `main`: `typecheck · lint · unit`, `closes one issue · done-when ticked` (fails on any unticked box), `audit`, `layout conformance (browser)`, `schema · RLS (live Postgres)`. Branch protection on `main` requires those five checks and a code-owner review. **`Vercel` is not a gate** (2026-09-09): the Hobby plan allows 100 builds a day and PR previews spent them all; previews are skipped (the project's ignored-build step builds `main` only), CI's renders (§5) are the review surface, and the lander ignores any Vercel row. The master reviews body, boxes and renders, records findings as a PR comment, and approves by adding the **`master-approved`** label. The **lander** (`rk-lander.service`, §7) then does the rest: update the branch when BEHIND, wait while DIRTY (the author rebases) or while a check is pending, and merge (merge commit, `--delete-branch`; `--admin` because the owner's account cannot review its own PR — the checks are the gate) once every check passes. Nobody waits on a merge. `scripts/land.sh <pr…>` is the same chain run by hand when the service is down. **A merged migration is not on production until the master applies it**: the lander flags every merged PR touching `supabase/migrations/` as MIGRATION PENDING (`/root/ops/reachkit/state/migrations-pending.txt`), the master applies it through the Supabase connector the same hour and logs it in DEPLOYMENT §4 (2026-09-10: three merged migrations had silently never reached production, and one of them broke the admission path's daily-spend read). **Landing order matters**: `fix-first` and token/allow-list PRs land before screen PRs; screen PRs rebase.

**The review path, until the dev database exists** (issue #383). The owner reviews progress on dev.reachkit.app. Public routes render there; every `(account)` route needs a session and a v3 database, which the staged deployment has neither of until cutover — so Overview, Calendar, Draft, Settings, both setup screens, the day panel and the draft editor cannot be looked at there at all. The **review gallery** is that review path instead. `ci.yml`'s `review` job runs after the layout job on every merge to `main` and photographs every screen UI-SPEC S1–S20 draws, in every state the suite can reach — signed out, the reserved account, the founder still in setup, the live account, week 0, the published hosted page; S3's report arms; S15's day panel; S16's read arms and S17's editor; S18 with a field open; S20's composed mails — full page at 1280, light **and** dark, into `.review/<sha>/<S-id>-<state>-<theme>.png`, with an `index.html` that puts the approved render beside the build, one row per state, grouped by S-id. The run's summary links the artifact (14-day retention); the page is self-contained, so **the master publishes it as a Claude artifact when the owner asks** and steers off it. Corrections come back as issues, exactly as ship-then-steer says (§4). By hand on any branch: label the PR `review-gallery` and push, or run `npm run review:gallery` where a layout suite may run — which is CI, never the box (§5).

## 4. Rulings, copy, design

- **Ship-then-steer.** Where BUILD is silent the master rules under the requirements and the approved set, records it in `docs/pending-decisions.md`, and the owner steers on dev; a batch lands in `DECISIONS.md` as a docs PR.
- **Owner rulings** are asked once, as a decision sheet with lettered options and a recommendation (`1a 2b …`), answered in one line, recorded the same day.
- **Design approval gate.** No new or changed surface is built before its artifact is approved (BUILD §0.1). The approved set is `docs/design/approved/full-set/`; a new surface is drawn in its idiom, published as an artifact, approved, then landed into the set and UI-SPEC.md before code.
- **Copy** is the owner's. The registry (`src/lib/presentation/copy/`) holds every sentence; the per-surface copy issues (M13) list what is owed; mail with an empty key does not send.
- **Owner-owed environment**: the twelve sensitive bindings are pasted by the owner into Vercel; agents never see or log them; `RK_FIXED_NOW` is never set in any Vercel environment.

## 5. The box (one 7.7 GB VPS, four implementers)

- **Every heavy command runs as `bash /root/ops/reachkit/bin/heavy.sh <command>` and nothing else** — one at a time (`flock /tmp/heavy.lock`), `nice 15`, pinned to cores 0–1, so the sessions and the services keep cores 2–3. Heavy is: `npm ci`, `tsc` / `npm run typecheck`, and the three §5 forbids on the box. Never two at once, not in your own worktree, not in the background. Lint and targeted `node`/`ui` vitest runs are not heavy and stay as they are. Never copy `node_modules` or builds into `/tmp` (a 3.8 GB RAM-backed tmpfs shared by every worktree); use `/root/tmp/` on disk.
- `next build`, the layout suite and baseline regeneration **do not run here** (§5). CI renders and CI regenerates; the box compiles and runs unit tests. Run what is left in the **foreground**, `--maxWorkers=1` under 2 GB.
- Each worktree runs its own database substrate: `eval "$(scripts/db-substrate/up.sh --run)"` in its **own** command, before and outside the layout lock (daemons inherit a held lock); `POSTGREST_BIN=/root/projects/reachkitv3-wt/substrate/postgrest/postgrest`. **Up only while the RLS suite runs**: `down.sh` the moment it finishes, before you stop for the day or hit a session limit, and before `git worktree remove`; `reap.sh` for orphans. An idle trio is ~140 MB and swaps; three idle trios were once 400 MB of the box. `/tmp/reachkit-pgmeta` is a symlink to disk (`/root/tmp/reachkit-pgmeta`) — never recreate it under `/tmp`.
- A `next start`/`next-server` you launched for a render is yours to stop the moment the PNG exists.
- `/tmp` is RAM and swaps when cold: the guard (§7) prunes the compile cache, build temp dirs older than a day and scratchpads of ended sessions; nothing of yours may rely on surviving there.
- Visual baselines: the `regen-baselines` label (§5). CI rewrites only the pixels that moved, names them in the commit, and the next `ci.yml` run is the confirmation.
- Lock check: `flock -n /tmp/heavy.lock true` (exit 0 = free). Phantom holder: `ino=$(stat -c %i /tmp/heavy.lock); grep -i flock /proc/locks | grep $ino`.
- Merged worktrees are removed after landing; the reference design server and other tooling live under `/root/tmp/`.

## 6. Corpus maintenance (master)

A code PR never edits an owner file: it names the documented fact it changes under *Corpus* in its body (BUILD §, ARCHITECTURE row, UI-SPEC pointer, design-reference row), and the master lands the amendment in a docs PR the same day. Rulings wait in `docs/pending-decisions.md` and batch into `DECISIONS.md` within days. The drift audit is the check: an UNSPECCED route, a GAP section or an UNPINNED price-book name is a corpus defect and gets an issue. The authority table is `README.md`.

**The root corpus is six files and one deferral list** (owner ruling 2026-09-11): `README.md` ·
`BUILD.md` (the single WHAT, renamed `SPEC.md`) · `DECISIONS.md` · `ARCHITECTURE.md` ·
`PROCESS.md` · `CLAUDE.md`, plus `LATER.md`. No seventh root document is added. `DECISIONS.md`
holds **product** rulings only; a ruling about how a module does its work is written as a
`// SPEC §x.y` comment at that module, where the person changing the code will actually read it.
The system's job is to write code — documentation exists for decisions, process and architecture,
and for nothing else.

## 7. Operations on the box (always on, owner ruling 2026-09-09)

Monitoring and landing are **VPS services**, not tasks of the master's session, so they survive master restarts (needed for MCP connectors) and reboots. They live on disk in `/root/ops/reachkit/` (`bin/`, `state/`, `log/`) and run under systemd, `Restart=always`:

| Unit | Does |
|---|---|
| `rk-guard` | kills servers whose worktree is gone; prunes `/tmp` (compile cache at 40 %, build temp dirs > 24 h, scratchpads of ended sessions idle 3 d); reports low memory, swap, load, idle substrate trios, heavy work in the main checkout, and — since #404 — any `next build`, layout-suite or baseline-regeneration process on the box, and any heavy command not running under `heavy.sh`, each as a **rule breach** naming the worktree |
| `rk-refresher` | when an implementer's pane shows "session limit · resets H:MM", re-prompts it once the time has passed (skip list `state/refresher-skip.txt`) |
| `rk-lander` | merges every open, non-draft PR labelled `master-approved` once all checks pass (§3) |
| `rk-digest` | writes `state/digest.md` every 2 min — open PRs with merge state, checks and labels; implementers and their state; box vitals; the lander's last lines. **A (re)started master reads this file first** instead of re-deriving state |
| `rk-dispatch` | **dispatcher v3** (2026-09-10): feeds `state/queue.txt` — the master's issue queue, one number per line in landing order, written by nobody else — to the one worker. Every 2 min: in-flight = dispatched issues still open (`state/inflight.txt`; a closed issue leaves the set); for each in-flight PR, a red CI check sends the worker one `Fix: issue #n …` and a DIRTY merge state one `Rebase: issue #n …` per head, which the worker relays to the issue's subagent; if fewer than **3** are in flight and the queue has an open issue, the worker receives `Dispatch: issue #n. Brief: <bin/issue-prompt.sh n>` and the issue is popped (one dispatch per tick); when nothing is in flight and the queue is empty the worker is `/cleared` after three idle checks and re-sent its standing brief (`bin/worker-brief.sh`), so its context stays small. The 2026-09-09 rule stands: a dispatch or clear counts only if the session id changed |

`bin/issue-prompt.sh <issue>` prints the one-issue prompt every implementer gets (the issue, `CLAUDE.md`, this file — nothing else; one line, Herdr rejects multi-line arguments); `bin/worker-brief.sh` prints the worker's standing brief (spawn one subagent per `Dispatch:`, relay `Fix:`/`Rebase:`, report `#n -> <PR URL>`, never issues, never merges, no repo reads of its own). `bin/spawn.sh <issue> <pane>` starts a fresh Opus implementer in an empty pane and `bin/retire.sh <name>` ends one after its PR merged (substrate down, session exited) — both kept for running an implementer by hand when the worker is down. One worker and at most three issues in flight on this box (`RK_MAX_INFLIGHT`). The master's job every cycle is to ask what would make delivery faster, cheaper in tokens and closer to what the owner asked — and to change this process, not just the task.
