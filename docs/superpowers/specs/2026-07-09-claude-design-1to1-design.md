# Claude Design ↔ app 1:1 hardening — design

**Date:** 2026-07-09 · **Branch:** `harden/claude-design-1to1` (stacked on `harden/consistency-harness`)

## Why

The Claude Design system (`.design-sync/ds-src/*`) had drifted from the app: audits
showed the DS mirrored **two different realities** — some components mirror what
actually ships, but ~13 atoms mirror *dead* granular components (`report/score-gauge`,
`sections/faq`, `charts/*`, …) that no live page renders. The live marketing/report/
shell pages are served by **captured HTML snapshots**, not composed from shared atoms;
only the `/app/*` intel pages are genuinely component-composed. So "the design system
reflects the current system 1:1" was false.

## Decision (chosen by product owner)

**Reality-first + converge.** Make the DS honest to what SHIPS now; converge toward the
"every page = shared components" ideal incrementally (a later, separate app refactor to
decompose the captured snapshots). Specifics:

- **Archive, don't delete** the dead-mirror atoms (DS `archived: true`, delete-free).
- **Fix scope for design-language drift:** active `ds-src` + live hand-written components
  only. Leave the **captured** snapshots as-is (verbatim mockup lifts). Leave
  archived/dead components untouched.
- **Terminology:** standardize the core noun on "discoverability"; normalize score-band
  labels to one form; KEEP the "AI visibility check" tool name.
- **Domain** (`.io` vs `.app`): deferred — a flagged follow-up, no copy touched.

## What was done

1. **Inventory reconciliation** — archived 13 dead-mirror atoms in `layout.mjs` META
   (ScoreGauge, ScoreCard, RankedFix, PositioningMirror, SearchGapTable, ComparisonTable,
   PricingTable, FaqItem, FeatureStep, ChannelDonut, ProgressChart, CompareCard,
   TeardownCard), joining the 4 already archived → **17 archived, 34 active**
   (14 atomic + 20 Page templates). `INVENTORY.md` rewritten to match.
2. **`@mirrors` on every active component** — 28 added (34 total active mapped; Button/
   TextField are `-` primitives). Page templates mirror their live route/screen.
3. **Ratchet tightened** — `scripts/check-design-parity.mjs` now requires every
   non-archived `ds-src` to declare a resolving `@mirrors` (archived exempt). A new active
   component with no live mirror, or a mirror whose file disappears, fails CI.
4. **Band label normalized** — `SCORE_BANDS.fair` "Fair — room to climb" → "Fair"
   (guard test updated in the same change).
5. **Design-language fixes (live, visually safe):** raw font-name literals →
   `var(--font-*)` (`synthesis-view`, `billing/page`, `billing-actions`); `color:"#fff"`
   on accent backgrounds → `var(--c-on-dark)` (5 plan/paywall components).

## Deferred follow-up (flagged, not guessed)

**Semantic status/category color tokens.** Live intel views pass raw hex chart colors
(`#46a758`, `#3b6fe0`, `#e0b341`, `#1F9D5B`) and `kit.tsx` holds green/amber/blue fg as
raw hex — there is **no CSS-var token** for these, and the values are inconsistent across
sites. Unifying them safely needs a small semantic scale (e.g. `--c-pos` / `--c-warn` /
`--c-info`, sourced from the canonical kit values) + visual QA, so it was NOT done blind.
This is the main remaining palette-consistency gap. Also deferred: the `.io`/`.app`
domain conflict; decomposing captured snapshots into real shared components (the true
"pages = components" convergence).

## Verification

`pnpm check:design` (tightened) green; DS build regenerates the manifest with the new
Archive grouping; `pnpm test` + `check:arch` unaffected; band-parity holds. Negative test:
un-archiving a component without a resolving `@mirrors` fails the check.
