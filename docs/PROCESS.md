# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy.

There is no factory and no artboard task. Do not read `docs/archive/`. The one canvas an issue may cite is the owner-approved redesign of 2026-09-20 named in `docs/DESIGN.md` (#908) — for structure and wording, never pixels.

## Roles

| Who | Does |
|---|---|
| **Owner** | Product, copy, secrets, answers, tests live on `dev.reachkit.app`. Does not read galleries, digests or ticket piles. |
| **Engineer** | One session (Cursor or Claude). Issue → docs if behaviour changed → implement with libraries → PR → merge when the three checks are green. |

## Four steps

1. **State it.** GitHub issue: what the user can do afterwards. `feature` or `bug`. Board: Status (Ready is next) and Feature (F1–F9). P0 = the paying path is broken.
2. **Document if required.** New behaviour → that section of `docs/SPEC.md`. Look of a screen → `docs/DESIGN.md` (the three library rules, not a drawing). A bug in specified behaviour → no docs edit. An owner answer → one dated line in that SPEC section the same day.
3. **Implement.** Branch from `origin/main` in this checkout. daisyUI classes in the route, Recharts for series, lucide for icons, the libraries on `docs/DESIGN.md`’s list and no others, Stripe / Resend / Supabase for those jobs. No new wrapper, no new CSS sheet, no SVG chart. PR: what changed, how you proved it, `Closes #n`.
4. **Prove and ship.** Three checks green. `gh pr merge --squash --delete-branch`. Owner clicks `dev.reachkit.app`. Merges deploy to dev **and** production (owner ruling 2026-09-17, #844); run `scripts/smoke.sh` against production after a production deploy. Apply a merged migration through the Supabase connector after the target deploy is READY, then walk the path again.

`blocked-on-owner` is not implemented around. Missing copy is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759): the PR body names every new or changed string so the owner can correct the wording.

## Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC/code/tests still agree + runtime `npm audit`) | **Yes** |
| `schema · RLS (live Postgres)` | **Yes** |
| `no overflow · axe (390 / 768 / 1280, light and dark)` | **Yes** — the fourth gate (owner, 2026-09-21, closing #910). |
| Layout screenshots | Retired. There are none: no baseline, no gallery (owner, 2026-09-21, #976). The owner looks at the live site. |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

2026-09-22  **CI runs on the box** (owner, #1013). Every job runs on `reachkit-box`, the self-hosted runner on the shared box, because the repository's GitHub-hosted minutes ran out. The checks, their names and what each runs are unchanged. It is one runner, so jobs queue one at a time; a job stuck in *queued* means the runner service is down, not that the check failed.

`no overflow · axe` renders every `(public)` and `(account)` screen in a real browser, hydrated, at the three widths the 2026-09-20 ruling names, in light and dark, and runs `@axe-core/playwright` on the same page. It fails on an element wider than its container, on text its card cuts off, on a chart that did not fit or did not draw, and on a serious or critical axe finding. It takes no screenshot and keeps no baseline — `docs/DESIGN.md` forbids a pixel baseline as a merge gate.

2026-09-21  **It is the fourth merge gate** (owner, #910). A pull request merges when it is green beside `typecheck · lint · unit`, `audit` and `schema · RLS`; the "runs and reports" arrangement of #950 is superseded. Its known-defect list excuses only a defect found on `main` under an issue number, never one a pull request introduces, and it is empty as of #946.

2026-09-21  **The two main-only jobs folded into it** (owner). `layout conformance (browser)` and `review gallery` ran on `main` alone and had been red since before the redesign without anybody seeing it, because a job that runs after the merge reports too late to act on and cannot be tried on the branch that would fix it (#976). What they still said something true about is folded into this job; the rest is retired. Folded in are the five-check route sweep, the eyebrow rung, the heading scale, the live and week-0 accounts, Settings with a field open, the current Settings tab being on screen, the security headers, the theme slots and the values. Retired are the committed PNG baselines, the `regen-baselines` label and its workflow, the side-by-side render comment, and the review gallery. The one thing not folded in is the landing's script budget, which `main` breaches today and #988 carries.

Since 2026-09-21 it is therefore the only browser job.

The nightly `Layout (full matrix)` run walks the same suite at every width and band. It reports; it is not a gate.

Tests prove customer-observable behaviour. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

## Deploys

Vercel Hobby, Git deployments off. `rk-deployer` deploys `main` (dev every SHA, production at most every two hours). Production is deployed with each merge batch (`/root/ops/reachkit/bin/redeploy.sh`) as well as dev — no freeze (2026-09-17, #844). Manual: `bash /root/ops/reachkit/bin/deploy-dev-once.sh`.

## Never

- Invent a user-facing sentence.
- Match the pixels or copy the markup of any artboard or canvas. (Citing the 2026-09-20 redesign canvas for what a screen holds is expected — `docs/DESIGN.md`.)
- Add a custom component, CSS sheet or SVG chart where daisyUI or Recharts exists.
- Guess an owner decision.
- Write under `docs/archive/`.
- Bring back a factory role, dispatcher, lander, worktree-per-issue rule, or extra merge gate.
