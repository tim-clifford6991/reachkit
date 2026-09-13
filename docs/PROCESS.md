# Process

How a change reaches production. Speed to a working MVP is the measure: a step that does not get a stranger through landing → scan → pay → onboard is removed.

There is no factory. No Master, Worker, dispatcher, lander, implementer agents, worktree farm, or `master-approved` label. Those are gone.

## Roles

| Who | Does |
|---|---|
| **Owner** | Decides the product, writes user-facing sentences, answers questions, tests live on `dev.reachkit.app` (and production when unfrozen). Does not read CI galleries, digests, or ticket piles. |
| **Engineer** | You in Cursor, or one agent session. Files or picks a GitHub issue, updates docs if behaviour changed, implements, opens a PR, merges when the three checks are green. |

## Four steps

1. **State it.** A GitHub issue: what the user can do afterwards. Label `feature` or `bug`. On the [Project board](https://github.com/users/tim-clifford6991/projects/1), set **Status** (Backlog → Ready → In progress → In review → Done) and **Feature** (F1–F9). **Ready** is the next work. Priority P0 = the paying path is broken.
2. **Document if required.** New or changed behaviour → the matching section of `docs/SPEC.md`. Screen look → `docs/DESIGN.md`. A bug in already-specified behaviour → no docs edit. An owner answer in chat → one dated line in that SPEC section the same day.
3. **Implement.** Branch from `origin/main` in the repo checkout (or locally). Prefer an existing library (daisyUI, Recharts, Stripe, Resend, Supabase) over new code. Open a PR: what changed, how you proved it, `Closes #n` when it closes an issue.
4. **Prove and ship.** The three required checks pass. Merge (`gh pr merge --squash --delete-branch`). Dev deploys from `main`. The owner tests the path live on `dev.reachkit.app` — that is the review. Production is batched and stays frozen until the owner lifts it. A migration is applied through the Supabase connector after the target deploy is READY, then the path is walked again.

A product question the owner has not answered is labelled `blocked-on-owner` and is not implemented around. Copy is owner-owed: a missing sentence is `TODO(copy)`, never invented.

## Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (`scripts/drift-audit.mjs --strict` + runtime `npm audit`) | **Yes** — SPEC/code/tests still agree |
| `schema · RLS (live Postgres)` | **Yes** |
| Browser layout screenshots | No — evidence, not a gate. The owner looks at the live site. |
| Production smoke (`scripts/smoke.sh` / `scripts/land.sh`) | **Yes** for a production deploy, by hand |

Drift is a merge blocker, not a report to read. Nightly audit still runs; it does not file issues.

## Tests

A test proves behaviour a customer can observe. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

## Deploys

Vercel Hobby: Git deployments off (`vercel.json`). `rk-deployer` asks for each deploy of `main` (dev on every SHA, production at most every two hours, honour `prod-frozen`). Manual: `bash /root/ops/reachkit/bin/deploy-dev-once.sh`. `Vercel` is not a required check.

## Never

- Invent a user-facing sentence.
- Add a custom component, CSS sheet or token where daisyUI, Recharts or the canvas already has one.
- Guess an owner decision — label `blocked-on-owner` and ask.
- Write under `docs/archive/`.
- Bring back a factory role, a dispatcher, a lander, a worktree-per-issue rule, or a fifth merge gate.
