# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy.

There is no factory and no artboard task. Do not read `docs/archive/`. The one canvas an issue may cite is the owner-approved redesign of 2026-09-20 named in `docs/DESIGN.md` (#908) — for structure and wording, never pixels.

## Source of truth

The repository and the GitHub issues are the only record. A chat, a memory file, and anything under `/root/ops` do not overrule these pages. If two of them disagree, fix the stale one in the same change. Do not leave the correction only in a comment or a memory file.

| Question | Where it is answered |
|---|---|
| What the product is, and what delivered means | `README.md` |
| What the product does | `docs/SPEC.md` |
| How a screen is built | `docs/DESIGN.md` |
| How work moves, the gates, the worktrees, the queue | this file |
| What is left before a stranger pays | `docs/GO-LIVE.md` — the only launch checklist |
| How the box and the vendors are operated | `docs/RUNBOOK.md` |
| Which open issues are that launch | the GitHub milestone **Launch** |

## Roles

| Who | Does |
|---|---|
| **Owner** | Product, copy, secrets, answers, tests live on `dev.reachkit.app`. Does not read galleries, digests or ticket piles. |
| **Engineer** | One session, one issue. Issue → docs if behaviour changed → implement with libraries → PR → merge when the four gates are green. |

## Four steps

1. **State it.** GitHub issue: what the user can do afterwards. `feature` or `bug`. Board: Status (Ready is next) and Feature (F1–F9). P0 = the paying path is broken.
2. **Document if required.** New behaviour → that section of `docs/SPEC.md`. Look of a screen → `docs/DESIGN.md` (the three library rules, not a drawing). A bug in specified behaviour → no docs edit. An owner answer → one dated line in that SPEC section the same day.
3. **Implement.** One issue, one worktree, at `/root/projects/reachkitv3-wt/issue-<N>`, branched from `origin/main`. The checkout at `/root/projects/reachkitv3` stays on `main`. daisyUI classes in the route, Recharts for series, lucide for icons, the libraries on `docs/DESIGN.md`’s list and no others, Stripe / Resend / Supabase for those jobs. No new wrapper, no new CSS sheet, no SVG chart. PR: what changed, how you proved it, `Closes #n`.
4. **Prove and ship.** The four gates below are green. `gh pr merge --squash --delete-branch`, then remove the worktree. Owner clicks `dev.reachkit.app`. Merges deploy to dev **and** production (owner ruling 2026-09-17, #844); run `scripts/smoke.sh` against production after a production deploy. Apply a merged migration through the Supabase connector after the target deploy is READY, then walk the path again. There is no production freeze.

`blocked-on-owner` is not implemented around. Missing copy is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759): the PR body names every new or changed string so the owner can correct the wording.

2026-09-23  **The repository is the only store of decisions and boards** (owner, #1026). The orchestration session holds no implementation and no state: every implementation agent starts one issue in a clean context and reads that issue and these documents from the repository. Every owner decision is a dated line in `docs/SPEC.md`, `docs/DESIGN.md`, `docs/PROCESS.md` or `docs/RUNBOOK.md` **before** it is implemented — a decision that lives only in a chat, a canvas or a session log is not one an implementer can read, which is how the Round 6 sign-in and stop cards shipped against the 2026-09-20 ruling (#986, #1025). Boards and their renders live in `docs/design/`, never only on the box and never only in a canvas; a ledger or canvas is a review surface, and where it and the repository disagree the repository wins. The tools on the box — the runner, the deployer, the scripts — are described in `docs/RUNBOOK.md`, with how to recreate them. **One agent per issue**: an implementation agent exists for exactly one GitHub issue, works in its own worktree from `origin/main`, and is retired when that issue's pull request merges or the issue closes — the next issue is a new agent in a clean context. All implementation work traces to an open, documented issue; the master session orchestrates only, toward the MVP and marketing. This dated line is the newer ruling where **Never** below still forbids a worktree-per-issue rule.

## Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC/code/tests still agree + runtime `npm audit`) | **Yes** |
| `schema · RLS (live Postgres)` | **Yes** |
| `no overflow · axe (390 / 768 / 1280, light and dark)` | **Yes** — the fourth gate (owner, 2026-09-21, closing #910). |
| Layout screenshots | Retired. There are none: no baseline, no gallery (owner, 2026-09-21, #976). The owner looks at the live site. |
| Nightly full matrix | Retired (2026-09-23, #1029). The widths and bands the gate does not walk are walked by hand now — see below. |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

2026-09-22  **CI runs on the box** (owner, #1013). Every job runs on `reachkit-box`, the self-hosted runner on the shared box, because the repository's GitHub-hosted minutes ran out. The checks, their names and what each runs are unchanged. It is one runner, so jobs queue one at a time; a job stuck in *queued* means the runner is busy or its service is down, not that the check failed.

2026-09-23  **One runner on this box, no second one** (owner ruling, #1035). The machine has four cores and 7.6 GB. On 2026-09-23 `reachkit-box` peaked at 4.5 GB while the load was already above the core count, so a second runner here would put a second heavy job beside the axe sweep. With that measurement in hand the owner ruled one runner and accepted the queue at about two hours for six pull requests. This supersedes the owner's earlier ruling of the same day, which had asked for a second runner for the light jobs.

`no overflow · axe` renders every `(public)` and `(account)` screen in a real browser, hydrated, at the three widths the 2026-09-20 ruling names, in light and dark, and runs `@axe-core/playwright` on the same page. It fails on an element wider than its container, on text its card cuts off, on a chart that did not fit or did not draw, and on a serious or critical axe finding. It takes no screenshot and keeps no baseline — `docs/DESIGN.md` forbids a pixel baseline as a merge gate.

2026-09-21  **It is the fourth merge gate** (owner, #910). A pull request merges when it is green beside `typecheck · lint · unit`, `audit` and `schema · RLS`; the "runs and reports" arrangement of #950 is superseded. Its known-defect list excuses only a defect found on `main` under an issue number, never one a pull request introduces, and it is empty as of #946.

2026-09-21  **The two main-only jobs folded into it** (owner). `layout conformance (browser)` and `review gallery` ran on `main` alone and had been red since before the redesign without anybody seeing it, because a job that runs after the merge reports too late to act on and cannot be tried on the branch that would fix it (#976). What they still said something true about is folded into this job; the rest is retired. Folded in are the five-check route sweep, the eyebrow rung, the heading scale, the live and week-0 accounts, Settings with a field open, the current Settings tab being on screen, the security headers, the theme slots and the values. Retired are the committed PNG baselines, the `regen-baselines` label and its workflow, the side-by-side render comment, and the review gallery. The one thing not folded in was the landing's script budget, which `main` breached; #988 brought `/` inside it and folded it in, so the job runs the whole `layout` project and `test:layout:gate` is gone (2026-09-22).

Since 2026-09-21 it is therefore the only browser job.

2026-09-23  **The nightly full matrix is retired** (#1029). `Layout (full matrix)` (`.github/workflows/layout-full.yml`) walked the same suite at all six widths, three bands and both themes every night. Every run it completed from 2026-09-16 on concluded *failure*, and the 2026-09-22 run never started at all — that was the night the GitHub-hosted minutes ran out, which is what #1013 moved CI to the box over. It is gone, for the reason #976 gave for the two jobs before it: a job that runs after the merge reports too late to act on, cannot be tried on the branch that would fix it, and so is not read.

Its last run (2026-09-23) failed 91 cases. **84** were the gate's own screens measured against `checks.ts`'s pre-ruling allow-lists rather than the gate's: the off-canvas drawer panel, 240px left of `.drawer-side` at every width below `lg`, which the gate excuses by name; and text the 2026-09-20 ruling clamps on purpose (`.truncate`, `.line-clamp-*`), which the gate allows and `TRUNCATION_ALLOWLIST` does not. Neither shows at 1280, which is the width the gate runs those same suites at on every pull request, so the gate already asserts every one of the 84. **Five** were real defects at widths the gate cannot reach, and are filed: #1040 (the account tree overflows its cards at 320px, four of the five) and #1041 (the report's rival table still scrolls at 1024px). The remaining **two** were the landing's script budget, which #988 fixed and folded into the gate the same week.

The full matrix itself stays a tool, not a job: `npm run test:layout:full` sets `RK_LAYOUT_FULL=1` and walks the six widths, three bands and both themes. Run it on the box, against `scripts/db-substrate/up.sh --run`, when a question about a width the gate does not reach needs an answer — and read the answer the same day.

Tests prove customer-observable behaviour. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

## Deploys

Vercel Hobby, Git deployments off. `rk-deployer` deploys `main` (dev every SHA, production at most every two hours). Production is deployed with each merge batch (`/root/ops/reachkit/bin/redeploy.sh`) as well as dev — no freeze (2026-09-17, #844). The file `/root/ops/reachkit/state/prod-frozen` does not exist and is not a gate. Manual: `bash /root/ops/reachkit/bin/deploy-dev-once.sh`.

`supabase/migrations` is the schema. `/root/ops/reachkit/state/migrations-pending.txt` is a log that stopped on 2026-09-12. It is not a queue. Do not re-apply a migration because that file still says pending.

## Worktrees

One open issue, one worktree, one session: `/root/projects/reachkitv3-wt/issue-<N>`, branched from `origin/main`. When the pull request merges, remove the worktree. Do not brief the same session onto a second issue.

A worktree whose commits are already on `origin/main`, and whose issue is closed, is deleted. Untracked `node_modules` is not a reason to keep it. A worktree with its own commits that are not on `main`, or with an open pull request, stays.

This is how two sessions avoid editing one checkout. It is not a factory, and it is not a reason to add a dispatcher.

## What gets worked

The milestone **Launch** is the launch queue. Take an open Launch issue that is not `blocked-on-owner` before any issue outside that milestone.

`later` and `parked` are not started while a Launch issue is open. `blocked-on-owner` is not implemented around: the owner acts, the issue stays open, and nobody codes a guess.

There is no master agent and no `REQUEST_NEXT`. An implementer does not pick a second issue, and does not wait for an agent named master.

## Never

- Invent a user-facing sentence.
- Match the pixels or copy the markup of any artboard or canvas. (Citing the 2026-09-20 redesign canvas for what a screen holds is expected — `docs/DESIGN.md`.)
- Add a custom component, CSS sheet or SVG chart where daisyUI or Recharts exists.
- Guess an owner decision.
- Write under `docs/archive/`.
- Bring back a factory role, a dispatcher, a lander, or an extra merge gate.
- Keep a second copy of these rules in a memory file, a settings note, or `/root/ops`.
