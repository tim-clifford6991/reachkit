# Requirement Intake — product-contract-reset

> First intake on disk. Covers the 2026-07-21 project-reset program: the per-tier
> product contract, the market model (D1–D4), the free-spine slim-down, and the
> harness/quality-contract upgrades. Plan of record:
> `~/.claude/plans/im-becoming-increasing-disappointed-optimized-pancake.md`.

## 1. Verbatim requirement

> "The simple point of the free scan is to drill that wow effect for the user so
> that they can immediately get an understanding of: what their category is, what
> their niche is, where they're standing versus their industry, effectively,
> defining three actions that they can take to improve their standing and their
> niche in their category. That's the goal: to drive the user to basically
> upgrade. When they have upgraded, in the deep scan, this is something we were
> running once per week. The one big scan should showcase the user what their
> competitors are doing, more specifically: who their referers are, who the top
> referers of their competitors are, what lessons they can also learn from that.
> We then also do the drill down into the customers, who the user's potential
> customers are, where they're sitting (i.e., what communities they're talking
> about), and where the user can also go in and work with them, hear from them,
> and learn from them. This is the simple goal. For any data that we pull that is
> irrelevant to that side of this, we should simply remove it. On a very simple
> basis, I can see that would be the reviews for the free scan, for example, but
> this probably exists everywhere else. […] We should also generally avoid using
> long sentences that are LLM-generated. We should only really use LLMs to
> synthesize these dynamics of different information, but really showcase it in
> simple words, not in full sentences." — Tim, 2026-07-21

Plus the four decisions taken in the same session:
D1 market cards = market size + your share · D2 one category-leader
`ranked_keywords` fetch allowed on free (~2¢) · D3 LLM relevance judge primary
for category/niche relevance+labels (score-side classifier frozen) · D4 free
floor of 3 real fixes + blurred lorem-class placeholder rows (no LLM spend).

## 2. Restatement

The free and paid scans each get an explicit content contract; every pipeline
step, data call, and rendered section must serve a contract line or be deleted.
Deltas called out:

- "Where they stand vs their industry" is implemented as the D1 market model:
  market-level demand (leader-grounded) + the subject's share/position. This is
  a REVERSAL of the current site-grounded semantics (which structurally caps a
  weak site's market at its own footprint).
- D2 AMENDS the owner's 2026-07-17 lock "no rival fetch on free" — raised
  explicitly in-session and approved. Per-rival gap/intel stays paid.
- "Three actions" = exactly 3 REAL floored fixes; the blurred extras are
  placeholders with no numbers and no fabricated specifics (assumption:
  placeholder titles are generic, e.g. "More fixes inside", never lorem ipsum
  literally rendered — the blur must not claim a specific finding).
- Reviews are cut from the FREE path now; cutting them from PAID (plus creators
  and content-intel scope) is pushed to the owner as OPEN(O-7/O-8/O-9), defaults
  proposed CUT / cut-unless-it-feeds-actions.
- The style rule is product-wide (free + paid surfaces), machine-enforced as a
  terseness rubric rule, not a copy guideline.

## 3. Open questions — asked BEFORE design

| # | Question | Answer | Answered by / date |
|---|---|---|---|
| 1 | What should CATEGORY/NICHE numbers represent — site-grounded footprint or market-level demand? | Market size + your share (D1) | Tim, 2026-07-21 |
| 2 | May the free scan fetch one category-leader footprint (contradicts the 2026-07-17 "no rival fetch on free" lock)? | Yes — amend the rule; per-rival analysis stays paid (D2) | Tim, 2026-07-21 |
| 3 | LLM's role in category relevance — judge, heuristics, or hybrid? | LLM relevance judge primary; heuristics as pre-filter (D3) | Tim, 2026-07-21 |
| 4 | Free fixes floor? | Always 3 real fixes + blurred placeholder rows, no LLM tokens on placeholders (D4) | Tim, 2026-07-21 |
| 5 | Cut reviews/creators/content-intel from PAID too? | Pushed to owner: OPEN(O-7/O-8/O-9) with proposed CUT defaults | pending |

## 4. Permutation matrix

| Cell | Covered / Excluded | How / why |
|---|---|---|
| free × anon/authed/paid-viewer × public `/scan` × fresh | covered | contract pipeline: listing + ranked_keywords + overview + volumes + leader fetch + lite synth; no reviews/competitor collect (Phase S); market cards + 3-fix floor render |
| free × any × public `/scan` × legacy-payload | covered | `sv.market` optional; props boundary maps legacy `categoryCard`/`marketTiers`; legacy render test gains `market` in omitted set |
| free × any × public `/scan` × empty-inputs (0-ranking site) | covered | grounding degrades: leader-thin → seed basket → zero-state; floor still yields 3 deterministic fixes |
| free × any × public `/scan` × pathological (directory/SPA) | covered | trustmrr fixture = the "before" oracle; corpus archetypes directory/zero-ranking/normal-saas exercised |
| free × any × public `/scan` × wrong-subject | covered | leader validation (≠ subject, not aggregator/mega-brand); judge rejects off-category phrases; reviews no longer fetched on free (wrong-subject review class disappears from free) |
| free × any × public `/scan` × leader-name-only / leader-fetch-thin / no-competitors | covered | degrade ladder: leader → seeds; never a second paid fetch; no Tavily resolution on free (v1) |
| paid × authed × `/app/add` + checkout/webhook × fresh | covered | deep scan unchanged in PR 1–8; contract alignment lands in Phase E per resolved OPEN rows |
| paid × authed × `/app` dashboard × fresh/legacy | covered | Phase E: report_payload becomes the single source; paid rubric fixtures captured before each collapse |
| paid × authed × cron/Inngest (weekly refresh, pulse) × fresh | covered | trend writers reuse persisted searchVisibility.score (invariant #1 untouched); refresh sites keep phase:"post-scan" tagging |
| any × owner × `/app/diagnostics` × any | covered | cost/wall-clock deltas visible; leader fetch attributed via costedStep |
| free × any × checkout/webhook entry | excluded | checkout provisions PAID scans only; free contract does not touch provisioning |
| paid × anon | excluded | impossible — paid surfaces require auth (`assertPaid`, R-2.4) |

## 5. Acceptance criteria (written FIRST, watched fail)

- trustmrr fixture captured verbatim (`pnpm capture:report 4a3b346a-a87c-4630-ab84-958d1f4cde2b --archetype=directory`) — the misleading render ("Business Intelligence & Marketplaces 14,800", "NICHE 10" as bare hero, 1 fix) is the before-oracle.
- Per-phase, corpus-first (each written at the head of its implementation PR, watched fail there — not committed red across PRs):
  - Phase H: magnitude rule (tiny hero number must carry qualifier/context; hollow 1-phrase market card degrades to zero-state) + terseness rule (no LLM sentence renders) — both FAIL on the trustmrr fixture, mutation-proven.
  - Phase S: free fixtures assert no review-derived section renders on free.
  - Phase A: R7 (market reconciliation: `marketDemand === Σ phrases`, category ≥ niche) + R8 (your-share derives from the same phrase rows); no-score-drift guard (gather with/without market → identical score/brandPct/categoryPct).
  - Phase B: verdict-fixture corpus cases (trustmrr judge rejects "business intelligence tools"; resend/spacex controls keep categories).
  - Phase C: trustmrr renders ≥3 fix rows + ≥2 blurred slots; placeholders never alter lockedCount/lockedWorth.
- Non-render guards: capability-ledger entries mutation-proven; `scan-caps.test.ts` pins free-report step spend incl. leader fetch ≤ free ceiling (D2 guard, this PR).

## 6. Class statement

The class is **off-contract data and duplicate producers**: reviews on free is
one instance; siblings = the creators pass (always-0 placeholder), content-intel
breadth, the two paid data pipelines (report_payload vs /api/app/intel), three
competitor-discovery engines, two keyword-gap engines, score
computed-then-discarded, two persisted ladder representations. The fix is the
contract as a standing filter (R-1.5/R-1.6) + the capability ledger (one
implementation per capability) — not a per-instance cleanup.

## 7. Rendered-surface ledger

- NEW call: ONE `cachedRankedKeywords(leader, 50)` per free scan (~1.8¢,
  per-domain cached) → renders as the market card's market-size number + its
  provenance line + the your-share strip (G9 ledger entry ships with Phase A).
- NEW call: one batched relevance-judge `callModel` (Haiku-class, «1¢, cached as
  `fact_sheets:relevance_verdicts`) → renders as the category/niche labels and
  the phrase selection on the market cards.
- DELETED calls: free-path `get-reviews`/`web-reviews` (Tavily ~1.6¢) and
  `find-competitors`+`extractCompetitorNames` — their renders are removed from
  the free report in the same phase (both directions of R-8.3).
- Net free-scan cost: ~12.4¢ worst case → target ≤ ~11¢ after Phase S; cap 25¢.

## 8. REQUIREMENTS.md delta

Same PR: R-1.5/R-1.6/R-1.7 (the contract + style rule) · R-3.14–R-3.17 (market
model, leader fetch, judge, free floor) · OPEN(O-7/O-8/O-9) (paid cuts).
Phase H adds the Quality Contract section; Phase E edits §6 per resolved OPEN
rows.
