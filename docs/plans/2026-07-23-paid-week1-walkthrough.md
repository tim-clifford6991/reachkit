# Paid week-1 story walkthrough (agent-verified static trace, 2026-07-23)

> Screen-by-screen trace of the €59 buyer's first week, judged against the contract (R-1.6). 7 incoherences, ranked. Feeds launch plan L2/L4 scope.

## The story as it stands
- **Minute 0:** deep scan is ENQUEUED (not done) before the magic link sends. First paint = the blocking SetupOverlay (Profile → Competitors → "Your data"), with the deepen running behind it. Step 3 pre-warms the `supply` gather. Hero + WhatToRankFor render instantly from the free payload; WeekPlanPreview is thin until deep actions land (renders only the daily X-post habit); a "refreshing" banner sits above the real hero. Competitor pick is FORCED as step 2 on the first app — the user can't reach an empty tab.
- **Hour 1:** dashboard spine reads score → targets → plan → market. The M1 keyword unify holds (no stale duplication in the blocks).
- **Tabs:** competitors = lessons (referrers + pursue chips ✅ R-1.6 p1+2), customers = ICP + communities chips (✅ p3), plan calendar, progress. Old supply/demand/synthesis are clean redirects — no zombie tabs.
- **Plan round-trip:** the M3a chips WORK — `Reach out to {host}` / `Engage in {surface}` POST `/api/action` and the plan board reads the exact titles back. ✅
- **Week-2 Monday:** weekly-refresh writes score_snapshot + market_snapshot + delta actions + a `"refresh"` digest scan_event — **which nothing renders** and nothing emails.

## Ranked incoherences (file:line verified)

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **HIGH** | **WhatToRankFor is a dead-end CTA.** "Build these into your plan →" but the keyword-page targets NEVER reach `/app/plan`: their titles come from `opportunityActionsFromSearch` (free path only, `free-report.ts:235`); the paid deepen's `persistActions` deletes+replaces with signal fixes (`full-scan.ts:466-496`). The flagship "score → targets → plan" spine breaks at targets→plan. | Give the board rows real `AddToPlanChip`s (the shared M3a module) POSTing `/api/action` — same round-trip the lessons/communities chips already prove. Optionally also wire opportunity actions into the deep pass. |
| 2 | MED-HIGH | **Week-2 is silent.** The `"refresh"` digest event (`weekly-refresh.ts:170`) has NO consumer — no feed UI, no email, no badge. | L4 digest email is the durable fix; a feed surface optional. |
| 3 | MED | **Plan nav badge permanently dead** — `actionsCount` hardcoded `0` (`app/(app)/app/layout.tsx:91,176,181`); the one "you have work" signal never fires. | Compute open-action count in the layout. |
| 4 | MED | **Two competing off-site scores on one screen** — hero "Market position" grade (Pipeline A) vs intel-block cohort score "#N of M" (Pipeline B) can disagree. | Reconcile/relabel the intel-block number against `marketPosition` (or render the persisted grade). |
| 5 | MED | **Deep pass still gathers CUT data** — `findCreators` in `full-collect.ts:44`; `full-scan.ts` still assembles creators + review themes (`:268-302`, `:410-436`, `:627,642-643`). O-7/O-8 vs code drift; R-8.3 violation. | = M3b (already planned; this pins the exact lines). |
| 6 | LOW-MED | **Two more cold ~minute gathers after onboarding** — setup step 3 warms only `supply`; first Customers visit pays cold `demand`, first Plan visit cold `synthesis`. | Warm all three in `setup-calculating-step.tsx`. |
| 7 | LOW | Stale targets: "See the full cohort →" + post-save push → `/app/supply` (redirect hop); identical-branch href ternary (`dashboard-view.tsx:274`); stale "Supply/Demand/Synthesis" docstrings. | Point at canonical routes; refresh comments. |

## Consequence for the launch plan
- **#1 joins L2** (zero scan cost, the same deep scan validates the full targets→plan round-trip) — it is arguably the highest-leverage paid-value fix in the whole program.
- #3, #4, #6, #7 fold into L2 as small app-side fixes. #2 is L4 (the digest email). #5 IS M3b.
