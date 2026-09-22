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
| `no overflow · axe (390 / 768 / 1280, light and dark)` | **Yes** (owner, 2026-09-21, #910). The fourth gate. |
| Layout screenshots | No. Evidence on `main`; the owner looks at the live site. Folded into the pull-request sweep and retired once #976 lands (2026-09-21). |
| Production smoke (`scripts/smoke.sh`) | **Yes** for a production deploy, by hand |

`no overflow · axe` renders every `(public)` and `(account)` screen in a real browser, hydrated, at the three widths the 2026-09-20 ruling names, in light and dark, and runs `@axe-core/playwright` on the same page. It fails on an element wider than its container, on text its card cuts off, on a chart that did not fit or did not draw, and on a serious or critical axe finding. It takes no screenshot and keeps no baseline — `docs/DESIGN.md` still forbids a pixel baseline as a merge gate.

2026-09-21  **It is the fourth merge gate** (owner, #910). A pull request merges when it is green beside `typecheck · lint · unit`, `audit` and `schema · RLS`; the "runs and reports" arrangement of #950 is superseded. Its known-defect list excuses only a defect found on `main` under an issue number, never one a pull request introduces, and it is empty as of #946.

2026-09-21  **The two main-only jobs fold into it** (owner). `layout conformance (browser)` and `review gallery` run on `main` as evidence until #976 lands, and are retired then: what they check at merge time is what the pull-request sweep already checks, at the same three widths and in both themes.

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
