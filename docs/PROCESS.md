# Process

Speed to a working MVP is the measure. Delivered means a stranger completes landing → scan → pay → onboard → a page on their domain, live, with real copy.

There is no factory, no artboard, no canvas task. Do not read `docs/archive/`.

## Roles

| Who | Does |
|---|---|
| **Owner** | Product, copy, secrets, answers, tests live on `dev.reachkit.app`. Does not read galleries, digests or ticket piles. |
| **Engineer** | One session (Cursor or Claude). Issue → docs if behaviour changed → implement with libraries → PR → merge when the three checks are green. |

## Four steps

1. **State it.** GitHub issue: what the user can do afterwards. `feature` or `bug`. Board: Status (Ready is next) and Feature (F1–F9). P0 = the paying path is broken.
2. **Document if required.** New behaviour → that section of `docs/SPEC.md`. Look of a screen → `docs/DESIGN.md` (the three library rules, not a drawing). A bug in specified behaviour → no docs edit. An owner answer → one dated line in that SPEC section the same day.
3. **Implement.** Branch from `origin/main` in this checkout. daisyUI classes in the route, Recharts for series, lucide for icons, Stripe / Resend / Supabase for those jobs. No new wrapper, no new CSS sheet, no SVG chart. PR: what changed, how you proved it, `Closes #n`.
4. **Prove and ship.** Three checks green. `gh pr merge --squash --delete-branch`. Owner clicks `dev.reachkit.app`. Merges deploy to dev **and** production (owner ruling 2026-09-17, #844); run `scripts/smoke.sh` against production after a production deploy. Apply a merged migration through the Supabase connector after the target deploy is READY, then walk the path again.

`blocked-on-owner` is not implemented around. Missing copy is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759): the PR body names every new or changed string so the owner can correct the wording.

## Gates

| Gate | Blocks merge? |
|---|---|
| `typecheck · lint · unit` | **Yes** |
| `audit` (SPEC/code/tests still agree + runtime `npm audit`) | **Yes** |
| `schema · RLS (live Postgres)` | **Yes** |
| Layout screenshots | No. Owner looks at the live site. |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

Tests prove customer-observable behaviour. Until a paying user, tests are at most one third of a product PR. A test that transcribes a markdown row is deleted.

## Deploys

Vercel Hobby, Git deployments off. `rk-deployer` deploys `main` (dev every SHA, production at most every two hours). Production is deployed with each merge batch (`/root/ops/reachkit/bin/redeploy.sh`) as well as dev — no freeze (2026-09-17, #844). Manual: `bash /root/ops/reachkit/bin/deploy-dev-once.sh`.

## Never

- Invent a user-facing sentence.
- Match, cite, or re-seed an artboard / canvas HTML file.
- Add a custom component, CSS sheet or SVG chart where daisyUI or Recharts exists.
- Guess an owner decision.
- Write under `docs/archive/`.
- Bring back a factory role, dispatcher, lander, worktree-per-issue rule, or extra merge gate.
