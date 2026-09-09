# Process — how work flows in reachkit

The lean process (owner ruling 2026-09-05; the sdlc-factory is retired and archived). Roles: the
**owner** rules on the product and writes copy; the **master** orchestrates (files issues, briefs
implementers, reviews and lands PRs, records rulings, maintains the corpus); **implementers**
build exactly one issue each in their own worktree.

## 1. Units of work

- **One issue = one branch = one PR.** Branch `feat/<n>-<slug>` or `fix/<n>-<slug>` (`docs/` for corpus PRs).
- Every issue has **Done when** boxes stating observable behaviour, cites the BUILD § it implements, the REQ criteria it satisfies (`archive/…/requirements/REQ-*.md`) and, for a screen, its `S<id>` in UI-SPEC.md.
- Issues live in GitHub milestones: M1–M10 the build order (BUILD §16), M11 live verification and environments, M12 go-live readiness, M13 copy (owner), M14 UI fidelity to the approved set.
- Labels: `feature` · `bug` · `process` · `documentation` · `fix-first` (lands before others) · `blocked-on-owner` (the owner must act) · `later` (v1.1).

## 2. Building

1. `git fetch`, worktree from `origin/main`, `flock /tmp/npm-ci.lock npm ci`.
2. Read, in order: `CLAUDE.md` → the issue → the BUILD § it cites → `DECISIONS.md` (whole) → the ARCHITECTURE rows for the paths touched → for a screen, UI-SPEC.md §1 and the screen section → the REQ criteria.
3. Build to the Done-when. Never invent copy: the approved set's unbracketed strings are approved (ruling 11a); anything else is a key with `TODO(copy)`, listed in the PR.
4. Verify: `npm run typecheck && npm run lint && npx vitest run --project node --project ui --maxWorkers=2`; the `db` project when `supabase/` or `src/lib/db/` changed; the layout suite when anything visual changed (see §5).
5. Tick the boxes you satisfied (never an owner-review box). Small conventional commits ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
6. PR body: `Closes #n` · What changed · How I verified it · Owner owes (keys, owner-file needs, questions). For a UI PR: the **token table** (every value → token) and the **side-by-side render** (the approved set's screen beside the local build at 1280, every state touched).
7. `gh pr checks --watch`; fix what you caused; a Vercel failure unrelated to the diff is named with its cause.

## 3. Landing

Required checks on `main`: `typecheck · lint · unit`, `closes one issue · done-when ticked` (fails on any unticked box), `audit`, `layout conformance (browser)`, `schema · RLS (live Postgres)`, `Vercel`. Branch protection on `main` requires those six checks and a code-owner review. The master reviews body, boxes and renders, then lands with the chain (`scripts/land.sh <pr…>`: update branch if behind → wait green → merge commit with `--delete-branch`; `--admin` because the owner's account cannot review its own PR — the checks are the gate). Run the chain in a foreground shell or a Herdr pane, never as a harness background job. **Landing order matters**: `fix-first` and token/allow-list PRs land before screen PRs; screen PRs rebase.

## 4. Rulings, copy, design

- **Ship-then-steer.** Where BUILD is silent the master rules under the requirements and the approved set, records it in `docs/pending-decisions.md`, and the owner steers on dev; a batch lands in `DECISIONS.md` as a docs PR.
- **Owner rulings** are asked once, as a decision sheet with lettered options and a recommendation (`1a 2b …`), answered in one line, recorded the same day.
- **Design approval gate.** No new or changed surface is built before its artifact is approved (BUILD §0.1). The approved set is `docs/design/approved/full-set/`; a new surface is drawn in its idiom, published as an artifact, approved, then landed into the set and UI-SPEC.md before code.
- **Copy** is the owner's. The registry (`src/lib/presentation/copy/`) holds every sentence; the per-surface copy issues (M13) list what is owed; mail with an empty key does not send.
- **Owner-owed environment**: the twelve sensitive bindings are pasted by the owner into Vercel; agents never see or log them; `RK_FIXED_NOW` is never set in any Vercel environment.

## 5. The box (one 7.7 GB VPS, up to five implementers)

- `npm ci` only under `flock /tmp/npm-ci.lock`. Never copy `node_modules` or builds into `/tmp` (a 3.8 GB RAM-backed tmpfs shared by every worktree); use `/root/tmp/` on disk.
- One heavy job at a time: `next build` and the layout suite under `flock /tmp/layout.lock`, after `free -m` shows ≥ 2600 MB available; `--maxWorkers=1` under 2 GB. Run them in the **foreground**.
- Each worktree runs its own database substrate: `eval "$(scripts/db-substrate/up.sh --run)"` in its **own** command, before and outside the layout lock (daemons inherit a held lock); `POSTGREST_BIN=/root/projects/reachkitv3-wt/substrate/postgrest/postgrest`. `down.sh` before `git worktree remove`; `reap.sh` for orphans.
- Visual baselines: regenerate only pixels that changed (`UPDATE_BASELINES=1 npm run test:layout`), run once more to confirm zero changed bytes, list them in the PR.
- Lock check: `flock -n /tmp/layout.lock true` (exit 0 = free). Phantom holder: `ino=$(stat -c %i /tmp/layout.lock); grep -i flock /proc/locks | grep $ino`.
- Merged worktrees are removed after landing; the reference design server and other tooling live under `/root/tmp/`.

## 6. Corpus maintenance (master)

A code PR never edits an owner file: it names the documented fact it changes under *Corpus* in its body (BUILD §, ARCHITECTURE row, UI-SPEC pointer, design-reference row), and the master lands the amendment in a docs PR the same day. Rulings wait in `docs/pending-decisions.md` and batch into `DECISIONS.md` within days. The drift audit is the check: an UNSPECCED route, a GAP section or an UNPINNED price-book name is a corpus defect and gets an issue. See `docs/README.md` for the authority order.
