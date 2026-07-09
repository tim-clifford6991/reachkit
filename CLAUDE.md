# ReachKit — operating guardrails

ReachKit is a discoverability engine: a user submits a store/site URL, we scan it, score how findable it is, and hand back a ranked plan of actions. Next.js 16 App Router on Vercel · heavy work in Inngest at `/api/inngest` (`maxDuration=300`) · Supabase (Postgres + RLS + pgvector).

This file is the **rules of engagement** — the invariants and hard rules that must survive edits. It does not restate the architecture; two companion docs do that and must be kept in sync when they change:

- **`docs/architecture.md`** — living structural doc (3 Mermaid diagrams: system, scan sequence, billing). Verified accurate 2026-07-08.
- **`docs/score-calibration.md`** — scoring bands + the open calibration problem.
- **Interactive process/invariant map** — https://claude.ai/code/artifact/e2b1232f-a7fb-4071-9bf4-627740998700 (clickable nodes + the invariant enforcement ledger; snapshot, regenerate when stages/caps/guards change).

## Anchor files (start here)

| Concern | File |
|---|---|
| Scan orchestration spine | `lib/scan/full-scan.ts` |
| Scoring | `lib/scan/registry-score.ts`, `lib/scan/signals.ts`, `lib/scan/compute-signals.ts` |
| Cache-poison guards | `lib/scan/demand/gather.ts` |
| Billing redaction / gating | `lib/billing/entitlements.ts` |
| Config: the one flag + all keys | `lib/config/env.ts` |
| Auth session refresh | `middleware.ts`, `lib/auth/middleware.ts` |

## Invariants — do not break these

Each has (or should have) a guard test. Breaking one is a correctness regression, not a style nit.

1. **Free↔paid headline stability.** The headline gauge is `headlineScore` — `registryScore` over the **FIXED on-site basis** (`FIXED_BASIS_SIGNAL_KEYS`: the 8 HTML signals title/meta/schema/canonical/headings + content_depth/social_share/media). Those 8 are measured identically from the page HTML on free AND paid, so the number is **identical free↔paid — it never moves on upgrade** — and it equals the on-site pillar bars the dashboard shows (gauge == pillar average). `score_version 4` (2026-07-09). Off-site strength (keyword footprint, backlinks, marketplace/community/press) is NEVER in the headline — it is the separate **`marketPositionScore`** grade. Outreach has no on-site signal, so it is measured off-site only (in Market Position), not the headline. Guard: `registry-score.test.ts` asserts `headlineFromRows`/`headlineScore` give the same number with and without deep signals — on the REAL persisted path (full-scan 10a + free-report both call `headlineScore`). **History note:** PR #36 briefly made the headline `registryScore(all 18)` (v3), which folded off-site signals in and dropped the score on upgrade (free 74 → paid 66); v4 reverted the headline to the on-site basis and fixed the pillar bars to match.
2. **Cost caps (`ScanBudget`).** 60 tool-calls; cents free 15 / full 250 / weekly 120; `BudgetExceededError` on breach. Both heavy cost points (deep scan + competitor-select) bounded to `MAX_SELECTED=5` rivals, de-duped only by per-domain caches. NB: `ScanBudget` cents track **LLM only**; DataForSEO + Tavily spend is now *measured* per scan/user (`scans.{dataforseo,tavily}_cost_cents`, `lib/scan/cost-context.ts`) but **not** yet enforced against the cap — external spend is bounded only by the tool-call / `MAX_SELECTED` caps (see `docs/architecture.md` §4.3).
3. **Don't-cache-empties.** Never cache an LLM-failure `[]`; refuse stale blank rows on read-back (`isEmptyDemandIntel` / `buyerInsightsEmpty`).
4. **Always-insight action floor.** `topUpActions`+`linkSignalKeys` floor the plan to `MIN_ACTIONS` with deterministic fixes; the **market-aware re-floor** re-runs after market signals attach (the earlier floor ran with `market:null`). Floor cards bypass the critic by design.
5. **Per-category floor.** Every active category keeps ≥1 surviving safe action after the §11 cap. Guard: `tests/eval/golden-set.eval.test.ts`.
6. **Brand-ambiguity: discovery-only.** Competitor gap is built ONLY from the category-validated discovery set (`facts.competitors`). The raw "alternatives" extract may enrich matching names but must NEVER add competitors (acquire.io vs acquire.com class of bug).
7. **§11 algorithm safety.** Outreach cap 5 · divergence 0.92 · 1 action per evidence-host · every card `draftRequiresEdit=true` (no auto-send). `lib/scan/algorithm-safety.ts`.
8. **Abuse rate limit.** 10 scans / IP-hash / hour, 15-min in-flight window; only the IP hash is stored (`lib/scan/abuse.ts`).
9. **Terminal-status resilience.** A pipeline failure must leave a renderable `degraded` partial, never a permanent ACTIVE status.
10. **Deep-pass sentinel is `scans.deepened_at`** — NOT `report_payload` (both tiers write that now).

## Hard rules for working in this repo

- **Always live-test with `REACHKIT_USE_FIXTURES=false` before trusting a change.** Fixtures + eval + code-review all MASK real-adapter / LLM-on-mixed-content bugs (they return canned clean data). The `linear.app=22` SPA-fetch failure was invisible to the fixture suite.
- **Never run `pnpm build` while `next dev` is running** — it corrupts `.next` and looks like "no changes / stale UI".
- **`report_payload` is one JSON blob and older reports predate sections** — every consumer must null-coalesce (`?? []`). Don't add a typed per-domain intel table unless something reads it back (`demand_intel` is the one kept read-through cache; 7 write-only tables were retired).
- **`REACHKIT_USE_FIXTURES` is the only feature flag.** Owner-gated surfaces use `REACHKIT_OWNER_EMAILS`.
- **Inngest sync can go stale silently** — newer functions get dropped from Cloud; force with `PUT /api/inngest` and verify auto-sync-on-deploy.

## Known open risks (steer around these)

- **Score calibration is unresolved and unenforced** (the one red rule): headline fails band-separation on live data — SPA-fetch→SEO=0 gives false lows, tidy pages give false 100s. `scripts/score-calibration.mts` is a live tool, NOT run in CI.
- **Dev scaffolding surface** — `app/test-*`, `app/api/test-*`, `app/design/*` must be confirmed gated/removed before prod exposure.
- **Cohort cache-key stability** — deep-scan vs competitor-select cost de-dup relies entirely on per-domain cache keys; a key drift silently doubles DataForSEO spend.
- **`audienceProxy` always 0** — the YouTube 2nd `videos.list` call is never made; creator reach is a placeholder.

## Commands

- `pnpm test` — unit · `pnpm test:int` — integration (needs local Supabase) · `pnpm eval` — golden-set
- `pnpm dev` + `pnpm dev:inngest` — local (Inngest must run alongside)
