# Design: Align the design system to the "Analytics Dashboard" template

**Date:** 2026-07-02
**Status:** Draft — awaiting user review
**Scope decision (confirmed by user):** Design-system source only (`.design-sync/ds-src/*`). Do NOT change the running app (`components/app/**`, `components/report/**`).
**Depth decision (proceeded on best judgment while user away; confirm on review):** Primitives + reconcile + rebuild `DashboardScreen`. NOT full per-view screen compositions.

## 1. Goal

The hand-authored **Analytics Dashboard** template (`templates/analytics-dashboard/AnalyticsDashboard.dc.html`, in the Claude Design project `819c77dc-…`) is now the canonical design standard. Today its UI is inline DC-format HTML — it is not built from named components, so its building blocks can't be reused when scaling the app or creating resources.

Make the template's building blocks **first-class, reusable components in `ds-src`**, and reconcile the overlapping existing components so they match the template exactly. Outcome: one unambiguous set of dashboard components, visually identical to the template, that the design agent (and future work) composes from — no confusion about "which component."

Non-goal: reproducing the template's *interactivity* (view switching, week toggles, selection state). `ds-src` components are **presentational and prop-driven** like the rest of the kit; state is an app concern.

## 2. What the template contains (source of truth)

The template is a multi-view dashboard (Dashboard · Competitors · Customers · Content Plan · Distribution · Progress · Settings), 183 data bindings. The distinct reusable visual blocks:

| Template block | Becomes | Status |
|---|---|---|
| "Traffic by channel" donut + channel list | `ChannelDonut` | **new** |
| "You vs. top competitors" bars / "Their edge → your move" | `CompetitorEdgePanel` | **new** |
| Weekly action-plan item (provenance, predicted/verified pts, "do this first") | `PlanItemCard` | **new** |
| "Outreach is your weakest pillar… See your plan" banner | `LeverBanner` | **new** |
| "Discoverability over time" annotated line (Week 1·38 → Week 8·54, fix dots, events) | `ProgressChart` | **new** |
| Score gauge (big arc, band label) | `ScoreGauge` | reconcile |
| KPI tiles (Est. visits/mo, Referring domains) | `KpiCard` | reconcile |
| Sidebar/topbar chrome (Audience & Plan groups, Progress, Settings, user footer) | `AppShell` | reconcile |
| "Keyword gap — high-volume terms you don't rank for yet" | `SearchGapTable` | reconcile |
| The Dashboard view itself | `DashboardScreen` | rebuild to mirror template |

Out of scope (not present in the template): marketing components (`LandingHero`, `NavBar`, `Footer`, `PricingTable`, `Testimonial`, `FaqItem`, `CompareCard`, `TeardownCard`, `ScanInput`, `FeatureStep`) and report components (`ResultsScreen`, `RankedFix`, `ScoreCard`, `PositioningMirror`, `UnlockBand`). Left untouched.

## 3. Approach

Chosen: **faithful port into the existing `ds-src` idiom.**

- Each new component is a standalone `ds-src/<Name>.tsx`: a prop-driven React function, styled with **inline styles reading `--c-*` token vars** (exactly the current kit convention — no CSS files, no Tailwind), with a JSDoc summary and an exported `<Name>Props` interface.
- Prop shapes are derived from the template's `{{mustache}}` data model (e.g. `PlanItemCard` gets `title/type/why/predictedPts/actualPts?/from?/shipNote?/doFirst?/status`), but the interactive callbacks (`setSel`, `toggleAud`, …) are dropped — presentational only.
- Reconciled components are edited in place to match the template's exact visuals (arc geometry, colors from the same tokens, spacing).
- Wire-up per the established pipeline: export from `index.tsx`; add a `META` entry (group `"App"`) in `layout.mjs` with a realistic sample `render`; the static-prerender path produces the preview card automatically.

Approaches considered and rejected:
- **B — replicate the DC format** (`<x-dc>`/`support.js`) for these components: the design system is React (the whole point of `ds-src` + `_ds_bundle.js`); the DC format is Claude's template runtime, not a component authoring model. Rejected.
- **C — extract to a shared package consumed by the app too:** out of the confirmed scope (design-system only). Deferred.

## 4. Component specs (new)

Fidelity requirement for all five: a side-by-side with the corresponding template block should be visually indistinguishable at the same props. Exact markup is read from the template during implementation.

- **`ChannelDonut`** — `{ segments: {label,pct,visits?,color?}[], centerLabel?, size? }`. SVG donut (matches the template's "46% Organic" donut) + optional legend rows. Colors from `--c-tint-*` / channel palette.
- **`CompetitorEdgePanel`** — `{ rows: {name,score,isYou?,pillarDots?,scoreColor?}[], title?, variant?: 'bars'|'edge' }`. Horizontal score bars with the "YOU" highlight row and pillar-health dots; `edge` variant renders the "their edge → your move" two-column layout.
- **`PlanItemCard`** — `{ title, type, why?, predictedPts?, actualPts?, from?, shipNote?, doFirst?, status?, statusLabel? }`. Bordered plan item with provenance line ("from …"), predicted vs verified points, optional "Do this first" emphasis, status pill (reuse `Badge` bands).
- **`LeverBanner`** — `{ pillar, note, points, ctaLabel? }`. The weakest-pillar lever callout ("Outreach is your weakest pillar — … +9 pts … See your plan"). Tinted surface + action link.
- **`ProgressChart`** — `{ series: {x,y}[], markers?: {wk,score}[], events?: {wk,date,text}[], area?: boolean }`. Annotated line/area of score over weeks with fix-ship dots and an optional events list. SVG, tokenized.

## 5. Reconciliation + composition

- **`ScoreGauge`, `KpiCard`, `AppShell`, `SearchGapTable`:** align visuals to the template (gauge arc, KPI tile chrome, nav groups Audience[Competitors/Customers] & Plan[Content/Distribution] + Progress/Settings + user footer, keyword-gap table). Keep existing prop names where possible; note any prop additions in the plan.
- **`DashboardScreen`:** rebuild its composition to mirror the template's **Dashboard view** — `AppShell` chrome wrapping: `ScoreGauge` + `CompetitorEdgePanel` (bars) + `ChannelDonut` + `KpiCard`s + `SearchGapTable` (keyword gap) + `LeverBanner`. This is the "no confusion" reference composition.

## 6. Conventions (unchanged, must follow)

- `ds-src/*.tsx`: prop-driven, inline styles + `--c-*` tokens, JSDoc + `export interface <Name>Props`.
- Register: `index.tsx` export + `layout.mjs` `META` (group, sample `render`).
- Preview cards are **static-prerendered** (the fix from earlier today) — no client script. Build prints "static prerender: all N components rendered ✓".
- Bundle (`_ds_bundle.js`) is the importable DS for the design agent; rebuilt via `build.mjs`.

## 7. Verification

1. `node build.mjs && node layout.mjs` — bundle builds; prerender reports all components rendered (no failures).
2. Serve `ds-bundle/` locally and eyeball each **new/changed** card in a browser vs the template block — fidelity check.
3. `/design-sync` re-sync uploads the managed set; reload the Claude Design project and confirm the new/updated cards render (static HTML) and match the template.

## 8. Re-sync + hard guardrails (protect hand-created content)

Per `.design-sync/NOTES.md` "PROTECTED remote content": this project is hand-authored (no `resync.mjs` driver), uploads are hand-derived.
- `finalize_plan` **writes** scoped to the managed set only: `components/**`, `tokens/**`, `styles.css`, `_ds_bundle.js`, `_ds_bundle.css`, `_ds_sync.json`, `_ds_needs_recompile`. Never broad globs.
- **deletes:** `[]` unless a component was removed (none here — only additions + edits). NEVER a protected dir.
- Must NOT touch `templates/analytics-dashboard/**` (the source of truth itself), `motion/`, `scraps/`, `screenshots/`, `uploads/`, promo HTMLs, `README.md`.

## 9. Risks / open questions

- **Fidelity of SVG blocks** (donut, gauge, progress line): geometry must be ported carefully; validated visually in §7.
- **Prop-shape churn on reconciled components:** changing `ScoreGauge`/`KpiCard`/`AppShell` props could affect other `ds-src` compositions that use them (e.g. `ResultsScreen`, `ScoreCard` use `ScoreGauge`). Plan must check every internal consumer and keep them rendering. This is the main correctness risk.
- **Depth confirmation:** proceeded on "primitives + reconcile + DashboardScreen." If the user wants full per-view compositions (CompetitorsView, CustomersView, etc.), that's an add-on phase.
- **`ProgressChart`/`CompetitorEdgePanel` naming** — confirm names are what the user wants as the canonical vocabulary.

## 10. Out of scope

- The running app (`components/app/**`, `components/report/**`) — unchanged.
- Marketing/report DS components — unchanged.
- Template interactivity (view switching, toggles, selection) — DS components are presentational.
