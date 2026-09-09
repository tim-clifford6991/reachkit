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

## 1. Units of work

- **One issue = one branch = one PR.** Branch `feat/<n>-<slug>` or `fix/<n>-<slug>` (`docs/` for corpus PRs).
- Every issue has **Done when** boxes stating observable behaviour, cites the BUILD § it implements, the REQ criteria it satisfies (`archive/…/requirements/REQ-*.md`) and, for a screen, its `S<id>` in UI-SPEC.md.
- Issues live in GitHub milestones: M1–M10 the build order (BUILD §16), M11 live verification and environments, M12 go-live readiness, M13 copy (owner), M14 UI fidelity to the approved set.
- Labels: `feature` · `bug` · `process` · `documentation` · `fix-first` (lands before others) · `blocked-on-owner` (the owner must act) · `later` (v1.1).

## 2. Building

1. `git fetch`, worktree from `origin/main`, `flock /tmp/npm-ci.lock npm ci`.
2. Read, in order: `CLAUDE.md` → the issue → the BUILD § it cites → `DECISIONS.md` (whole) → the ARCHITECTURE rows for the paths touched → for a screen, UI-SPEC.md §1 and the screen section → the REQ criteria.
3. Build to the Done-when. Never invent copy: the approved set's unbracketed strings are approved (ruling 11a); anything else is a key with `TODO(copy)`, listed in the PR.
4. Verify **locally only what you touched; CI runs everything else.** `npm run typecheck && npm run lint`, then `npx vitest run --project node --project ui --maxWorkers=1 <the test files for the source you changed>`; the `db` project only when `supabase/` or `src/lib/db/` changed (substrate up for that run, down straight after — §5); the layout tests for the routes you changed (`npx vitest run --project layout -t "<route>"`, under the lock), regenerating only their baselines. **Never the full unit suite, the full layout suite or a full baseline regeneration on the box**: on four shared cores a full run takes 7–10 minutes per agent and three at once put the load at 7+, while CI runs the identical suites in parallel on GitHub's machines. Push when the targeted tests pass; fix what CI names.
5. Tick the boxes you satisfied (never an owner-review box). Small conventional commits ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
6. PR body: `Closes #n` · What changed · How I verified it · Owner owes (keys, owner-file needs, questions). For a UI PR: the **token table** (every value → token) and the **side-by-side render** (the approved set's screen beside the local build at 1280, every state touched).
7. `gh pr checks --watch`; fix what you caused; a Vercel failure unrelated to the diff is named with its cause.
8. **Review feedback arrives as PR comments, never in chat.** The master's findings are written on the PR; a fresh implementer acts on them from the PR alone. When the PR is open and green, report its URL in one line and stop — the next issue is a new session.

## 3. Landing

Required checks on `main`: `typecheck · lint · unit`, `closes one issue · done-when ticked` (fails on any unticked box), `audit`, `layout conformance (browser)`, `schema · RLS (live Postgres)`, `Vercel`. Branch protection on `main` requires those six checks and a code-owner review. The master reviews body, boxes and renders, records findings as a PR comment, and approves by adding the **`master-approved`** label. The **lander** (`rk-lander.service`, §7) then does the rest: update the branch when BEHIND, wait while DIRTY (the author rebases) or while a check is pending, and merge (merge commit, `--delete-branch`; `--admin` because the owner's account cannot review its own PR — the checks are the gate) once every check passes. Nobody waits on a merge. `scripts/land.sh <pr…>` is the same chain run by hand when the service is down. **Landing order matters**: `fix-first` and token/allow-list PRs land before screen PRs; screen PRs rebase.

## 4. Rulings, copy, design

- **Ship-then-steer.** Where BUILD is silent the master rules under the requirements and the approved set, records it in `docs/pending-decisions.md`, and the owner steers on dev; a batch lands in `DECISIONS.md` as a docs PR.
- **Owner rulings** are asked once, as a decision sheet with lettered options and a recommendation (`1a 2b …`), answered in one line, recorded the same day.
- **Design approval gate.** No new or changed surface is built before its artifact is approved (BUILD §0.1). The approved set is `docs/design/approved/full-set/`; a new surface is drawn in its idiom, published as an artifact, approved, then landed into the set and UI-SPEC.md before code.
- **Copy** is the owner's. The registry (`src/lib/presentation/copy/`) holds every sentence; the per-surface copy issues (M13) list what is owed; mail with an empty key does not send.
- **Owner-owed environment**: the twelve sensitive bindings are pasted by the owner into Vercel; agents never see or log them; `RK_FIXED_NOW` is never set in any Vercel environment.

## 5. The box (one 7.7 GB VPS, four implementers)

- `npm ci` only under `flock /tmp/npm-ci.lock`. Never copy `node_modules` or builds into `/tmp` (a 3.8 GB RAM-backed tmpfs shared by every worktree); use `/root/tmp/` on disk.
- One heavy job at a time: `next build` and the layout suite under `flock /tmp/layout.lock`, after `free -m` shows ≥ 2600 MB available; `--maxWorkers=1` under 2 GB. Run them in the **foreground**.
- Each worktree runs its own database substrate: `eval "$(scripts/db-substrate/up.sh --run)"` in its **own** command, before and outside the layout lock (daemons inherit a held lock); `POSTGREST_BIN=/root/projects/reachkitv3-wt/substrate/postgrest/postgrest`. **Up only while the RLS suite runs**: `down.sh` the moment it finishes, before you stop for the day or hit a session limit, and before `git worktree remove`; `reap.sh` for orphans. An idle trio is ~140 MB and swaps; three idle trios were once 400 MB of the box. `/tmp/reachkit-pgmeta` is a symlink to disk (`/root/tmp/reachkit-pgmeta`) — never recreate it under `/tmp`.
- A `next start`/`next-server` you launched for a render is yours to stop the moment the PNG exists.
- `/tmp` is RAM and swaps when cold: the guard (§7) prunes the compile cache, build temp dirs older than a day and scratchpads of ended sessions; nothing of yours may rely on surviving there.
- Visual baselines: regenerate only pixels that changed (`UPDATE_BASELINES=1 npm run test:layout`), run once more to confirm zero changed bytes, list them in the PR.
- Lock check: `flock -n /tmp/layout.lock true` (exit 0 = free). Phantom holder: `ino=$(stat -c %i /tmp/layout.lock); grep -i flock /proc/locks | grep $ino`.
- Merged worktrees are removed after landing; the reference design server and other tooling live under `/root/tmp/`.

## 6. Corpus maintenance (master)

A code PR never edits an owner file: it names the documented fact it changes under *Corpus* in its body (BUILD §, ARCHITECTURE row, UI-SPEC pointer, design-reference row), and the master lands the amendment in a docs PR the same day. Rulings wait in `docs/pending-decisions.md` and batch into `DECISIONS.md` within days. The drift audit is the check: an UNSPECCED route, a GAP section or an UNPINNED price-book name is a corpus defect and gets an issue. See `docs/README.md` for the authority order.

## 7. Operations on the box (always on, owner ruling 2026-09-09)

Monitoring and landing are **VPS services**, not tasks of the master's session, so they survive master restarts (needed for MCP connectors) and reboots. They live on disk in `/root/ops/reachkit/` (`bin/`, `state/`, `log/`) and run under systemd, `Restart=always`:

| Unit | Does |
|---|---|
| `rk-guard` | kills servers whose worktree is gone; prunes `/tmp` (compile cache at 40 %, build temp dirs > 24 h, scratchpads of ended sessions idle 3 d); reports low memory, swap, load, idle substrate trios, concurrent layout runs, heavy work in the main checkout |
| `rk-refresher` | when an implementer's pane shows "session limit · resets H:MM", re-prompts it once the time has passed (skip list `state/refresher-skip.txt`) |
| `rk-lander` | merges every open, non-draft PR labelled `master-approved` once all checks pass (§3) |
| `rk-digest` | writes `state/digest.md` every 2 min — open PRs with merge state, checks and labels; implementers and their state; box vitals; the lander's last lines. **A (re)started master reads this file first** instead of re-deriving state |

`bin/spawn.sh <issue> <pane>` starts a fresh Opus implementer with the fixed one-issue prompt (the issue, `CLAUDE.md`, this file — nothing else); `bin/retire.sh <name>` ends one after its PR merged (substrate down, session exited). Four implementers at a time on this box. The master's job every cycle is to ask what would make delivery faster, cheaper in tokens and closer to what the owner asked — and to change this process, not just the task.
