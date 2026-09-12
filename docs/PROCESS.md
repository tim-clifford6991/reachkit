# Process

How work gets from an outcome to production — process only: the features and their rulings are `SPEC.md`, the UI is `DESIGN.md`. Speed of delivery is the measure of this process: every step exists to get the product into users' hands sooner, and a step that does not is removed.

## Roles
| Who | Does | Never does |
|---|---|---|
| **Owner** | Decides the product. Writes every user-facing sentence. Answers pending decisions. Holds secrets and payment. | Implement. Review code line by line. |
| **Master** — one session, Fable | Orchestrates only: files issues, keeps board order, reviews PRs and labels `master-approved`, records rulings the same day, maintains the corpus, applies merged migrations, runs the smoke check. | Implement. Write product code, tests or migrations. |
| **Worker** — one Opus session per project | Spawns exactly one defined agent per task. Relays `Fix:` / `Rebase:`. Reports `#n -> <PR URL>`. | Implement. Read the repository. File issues. Merge. |
| **`rk-implementer`** — Opus, one per issue | Builds one issue end to end in its own worktree, fresh context, and opens one PR. | File issues. Merge. Invent copy. Pad scope. |
| **`rk-fixer`** — Opus | Rebases a DIRTY PR; fixes a red check on an existing PR. | Add scope. Touch a file outside the PR. |
| **`rk-reader`** — Sonnet | Read-only errands: check CI, read a PR or diff, summarise a file. | Write anything. Push. |
| **Services** — dispatcher, lander, deployer, guard | Relay issues to the worker; keep one branch at a time up to date with `main` and flag a merged migration; deploy; police the box. | Decide. Review. Merge. |

No general-purpose subagents: every spawn names one of the three `rk-*` agents.

## Where things live
Priority is the [project board](https://github.com/users/tim-clifford6991/projects/1) — flat, one issue per row, board order **is** dispatch order — and its `Phase` field carries the value-chain order. The five corpus files hold the features and their rulings, the design, and this process; nothing else does. Work is GitHub issues and PRs, one issue = one PR. Review findings are PR comments, never chat. State is GitHub only: **nothing on the VPS is authoritative** — its queues, digests and logs are caches, and deleting them loses nothing.

No queue files, no milestones, no `pending-decisions` file. Implementation notes live in code comments at the seam they govern, never in a document.

Operations — envs, bindings, the kill switch, restore — are `docs/RUNBOOK.md`, the one operational file.

## Skills per stage
An implementer loads the repository skill for the issue's feature before writing code (`.claude/skills/`): any screen → `design-system` + `daisyui`; React/Next code → `vercel-react-best-practices`; database, RLS, migrations → `supabase` + `supabase-postgres-best-practices`; payment → `stripe-best-practices`; mail → `resend`; technical site issues and targeting → `seo-audit`; deploys and domains → `deploy-to-vercel`. A new screen is drawn on the canvas first (`docs/DESIGN.md`).

## Ten steps
1. **Owner** names an outcome: one sentence about what a user can do afterwards.
2. **Master** writes the issue — outcome, evidence, done-when — with one link to its `SPEC.md` section.
3. **Master** places it on the board in the right phase, in dispatch order.
4. **Dispatcher** hands the top eligible row to the worker, at most three issues in flight.
5. **Worker** spawns one `rk-implementer` with that issue's brief and nothing else.
6. **Implementer** builds to the done-when in its own worktree, ticks the boxes it satisfied, opens one PR with `Closes #n`.
7. **CI** runs the five required checks and comments the renders for any screen the PR moved.
8. **Master** reviews body, evidence and renders, writes findings as PR comments, labels `master-approved`; a red check or a DIRTY branch goes back through the worker to `rk-fixer`.
9. **GitHub auto-merge** merges the approved PR the moment its checks pass and deletes the branch; the lander only brings one branch at a time up to `main` and flags a merged migration as pending.
10. **Deployer** deploys dev on the merge and production in batches; **master** applies the migration and then runs the production smoke check by hand.

All nine features are MVP: the value chain is the order, never a licence to drop one. Post-payment screen fidelity waits until a Stripe test-mode payment reaches `/setup` (#319).

## Issue and PR shape
| Field | Means |
|---|---|
| **Outcome** | What a user sees or can do once this lands. |
| **Evidence** | How the implementer proves it — the command, the route, the screenshot. |
| **Done-when** | Boxes only the implementer can tick; CI green is never a box. |
| **Implements** | One link to the `SPEC.md` section it implements. |

Those three fields and the link are all an issue needs. Labels: `chain` for value-chain work, `needs-owner-ruling` for a question, `parked` for work a ruling holds.
```
Closes #n
## What changed   one paragraph
## Evidence       the command run, the route looked at, what it showed
## Corpus         the documented fact this PR changes — named here, landed by the master — or "nothing"
```
Length (2026-09-12): a PR body is at most 40 lines; a code comment says what and why in at most three lines, never history and never a quoted document; a migration file carries at most five comment lines. Over that, the review asks for the cut before reading anything else.
A token table (every value → its token) only if tokens changed; a `Renders:` line naming routes only if a screen changed; adjacent findings under *Adjacent*, and the master decides whether they become issues.

## Gates
| Gate | Proves | Run by | Blocking? |
|---|---|---|---|
| `typecheck · lint · unit` | It compiles, obeys the lint rules, and the unit suites pass. | CI on every push and PR | **Yes** |
| `closes one issue · done-when ticked` | The PR closes exactly one issue and every box is ticked. | CI on every PR | **Yes** |
| `audit` | Spec, code and tests still agree (`--strict` on a PR). | CI on every PR | **Yes** |
| `layout conformance (browser)` | Every route renders in a real browser and matches its baseline. | CI on every PR | **Yes** |
| `schema · RLS (live Postgres)` | Constraints and row-level security hold against a live schema, not migration text. | CI on every PR | **Yes** |
| `review gallery` | Every screen in every state it can reach, beside its approved artifact. | CI on merge, or the `review-gallery` label | No — review surface |
| Master review | The PR does what the issue asked, the evidence is real, the copy is owner-owed. | Master: `master-approved` plus the approval auto-merge needs | **Yes** |
| Production smoke check | The real chain works on production. | By hand after every production deploy | **Yes** — the gate that matters |
| Drift audit | Nothing drifted overnight; findings become issues. | Scheduled CI, 05:17 UTC | No — files issues |

Those five CI checks are the **only** merge gate on `main` (the code-owner review rule was dropped: the owner's own account could not satisfy it and every merge bypassed it). Auto-merge and delete-branch-on-merge are on. `Vercel` is not a gate; its rows are ignored by everything that merges.

## Test budget
- A test exists to prove customer-observable behaviour. Nothing else earns a test.
- Tests are **at most one third of a chain PR's lines** until the first paying user.
- **No test transcribes a document.** A test that asserts a markdown row is deleted, not fixed.
- The layout sweep runs **one band × one theme per PR**; the full matrix runs nightly.
- A production smoke check beats any suite: nine scan defects shipped in 36 h with CI green, because nothing in CI walked the live chain.

## Decisions
1. A pending owner decision is an issue labelled **`needs-owner-ruling`** — options lettered, recommendation first.
2. The master asks it in session as an inline selector, recommendation first; the owner answers in one line.
3. The answer becomes **one dated line in the `SPEC.md` section it changes, the same day** (the superseded line struck in place), and the issue closes.

Where the spec is silent the master rules under it, ships, and the owner steers; corrections come back as issues.

## Copy
Every user-facing sentence is a key in `src/lib/presentation/copy/keys/`, and every key is **owner-owed**. An implementer that needs a sentence adds the key as `TODO(copy)` and names it in the PR. **Copy is never invented** — not a heading, not a button, not an error. Mail with an empty key does not send.

## Deploys and migrations
Dev (`dev.reachkit.app`) deploys every time `main` moves; production (`reachkit.app`) is batched — at most one deployment every two hours, and only if `main` moved. Vercel Hobby: one concurrent build, 100 deployments a day, no deployment protection, previews off; Vercel's Git integration creates nothing — the deployer asks for each deployment and backs off when refused.

A migration merges, then production deploys, then it is applied: an additive one at once, a destructive one **only after the production deploy is READY**, or the running deployment loses columns it still reads. A merged migration not yet applied is a defect. Then the production smoke check, by hand.

## Never (implementers)
- File an issue, merge anything, label anything, or edit the Project board — the master does all four.
- Edit an owner file: the corpus, `.github/`, `scripts/`, lint or test config, pinned constants.
- Invent a user-facing sentence.
- Add a custom component, CSS sheet or token vocabulary where daisyUI has one — the UI is daisyUI plus Recharts 3 plus the Claude Design canvas (`DESIGN.md`).
- Add a dependency, a top-level directory or a vendor call without asking; or tick a box that is the master's or the owner's to tick.
- Run a heavy command bare — it is `bash /root/ops/reachkit/bin/heavy.sh <command>` — or work in the main checkout instead of a worktree.
- Spawn a general-purpose subagent; pad scope past the issue; or loosen a rule to make its own PR pass.
- Write under `docs/archive/`, or set `RK_FIXED_NOW` in any Vercel environment.
