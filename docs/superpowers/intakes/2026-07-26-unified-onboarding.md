# Requirement intake — Unified onboarding + scan restructure

**Date:** 2026-07-26 · **Owner ask (verbatim):** adding an app must trigger ONE full onboarding process (first app AND new app alike), with competitor selection ("Who are you up against?") as a simple call shown EARLY in that process — not a disconnected tab-switch to `/app/audience/customers`. Also: the loading takes too long — investigate + fix.

## Diagnosis (evidence-based, prod scan `ce1f51ee`, reachkit.app, 92s)

- **Disconnection:** competitor selection is a scattered FALLBACK gate on 7 surfaces (`if (ctx.competitors.length === 0) return <CompetitorSetup/>` on customers/competitors/demand/plan + the overlay + `/app/add`). Miss the `/app/add` inline step and every intel page independently sends the user elsewhere. Not one flow.
- **Slow + wasteful:** a paid add runs the FULL heavy pass (synth 18s + critic 15-20s + market 15-20s) on an AUTO-picked cohort BEFORE the user picks — then the user picks and intel recomputes on their cohort (A2). Building the report for the wrong opponents first. Critic runs cards SERIALLY; the market pass runs after the report is already persisted and re-discovers a 3rd cohort from scratch.

## Owner decision (2026-07-26): "Both, A restructured fully"

Restructure the paid ADD to: **fast lightweight pass (collect + score + discover competitors, ~20s) → "Who are you up against?" (early, warm candidates ~1s) → build the deep report on the APPROVED cohort.** No wasted auto-cohort work. Plus the independent speed wins.

## The target flow (one path, first app AND new app)

1. **URL** (new app; first app already scanned) → run a lightweight scan: collect + competitor discovery + score + free-report. STOP before the deep pass.
2. **"Who are you up against?"** — the competitor pick, shown early from warm candidates (persisted by collect). One step, un-missable, not a scattered gate.
3. **Build your report** — the deep pass (synth/actions/market/funnel/demand) runs on the APPROVED cohort, triggered by the pick (reuses the A2 select→synthesis path + `ensureDeepScan`).

## Workstreams

**Part B — speed (independent, safe):**
- B1 parallelize the critic gate (cards independent; `Promise.all` bounded) — save ~15s.
- B2 reuse `facts.competitors` in the market cohort — kill the redundant 3rd discovery.
- B3 persist RESOLVED competitor domains in collect — picker serves warm in <1.5s (no name-resolution round).

**Part A — flow restructure:**
- A1 paid add runs the lightweight + competitor-discovery pass (tier stays free-shaped until the pick; competitor discovery ON regardless of tier for the add).
- A2 competitor pick (`/api/competitors/select`) → `ensureDeepScan` on the approved cohort.
- A3 the deep pass's market/intel uses `getSelectedCompetitors` (never re-discovers when a cohort is chosen).
- A4 unify first-app (SetupOverlay) + new-app (`/app/add`) so the competitor pick is the SAME early step; intel-page gates become an unreachable fallback on the happy path.

## Permutation matrix (cells touched)

- **Tier:** paid (the whole onboarding + deep pass). Free public scan (`/api/scan`) UNCHANGED (invariant #12 — always free, no deepen, no enrol).
- **Entry:** first app (post-checkout/overlay) · new app (`/app/add`) · settings add form (must funnel into the same flow, not a dead end).
- **Data-state:** competitors found (normal) · none found (pick step shows "we couldn't find rivals — add your own / skip") · pick skipped ("I'll pick later" → deep pass runs on auto-cohort as today, the graceful fallback) · re-add of an existing app.
- **Excluded:** the public free preview (surface-driven free, no onboarding).

## Acceptance criteria (written first)

1. A paid add shows the competitor pick within ~20s of URL submit (warm candidates), as ONE inline onboarding step — never a redirect to a different tab.
2. The deep intel (report_payload.market, synthesis, plan) is computed on the user's APPROVED cohort; picking competitors is what triggers/【re】computes it.
3. Skipping the pick still yields a valid report (auto-cohort fallback) — no dead end.
4. Deep-scan wall-clock drops materially (target ~50s from 92s) via B1/B2 + the market pass off the report critical path.
5. First-app and new-app onboarding run the SAME competitor-pick step (no per-entry special-casing) — the class fix, not a per-symptom patch.

## Class statement

The competitor pick is ONE capability shown at ONE point in ONE onboarding — not a fallback gate replicated on every intel surface and forked per entry-path. Fix the class (unify the flow) so the scattered gates become unreachable on the happy path, per CLAUDE.md "one entry point, one path, no special-casing per tier/product/entry."

## Rendered-surface ledger

collect's discovered+resolved competitors → the pick candidates (warm) → the approved cohort → the deep pass's market/funnel/demand/plan → the dashboard + audience surfaces. No cohort discovered that isn't rendered; no intel computed on a cohort the user didn't approve (except the explicit skip fallback).
