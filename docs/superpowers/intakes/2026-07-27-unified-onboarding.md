# Intake — one unified onboarding flow (URL → Scan → Profile → Competitors → Build)

**Date:** 2026-07-27
**Owner sign-off:** approved — "build it on that basis, exactly."

## Requirement

One blocking, stepped onboarding used for **every** entry (first-app after upgrade AND add-product from the dashboard), with a consistent step indicator:

1. **URL** — "What is your product URL?"
2. **Scanning** — the lightweight scan runs (progress).
3. **Profile** — confirm detected audience (ICP).
4. **Competitors** — the `cc:` picker (R-3.20).
5. **Building** — the **deep scan runs on the picked cohort**.

**Entry mapping (skip steps whose work is already done):**
- **Add-product**: nothing done → start at **URL**.
- **Upgrade-from-free-scan**: the free scan they were enticed by is the starting point → URL known + lightweight scan done → **skip 1–2, start at Profile**. The URL step stays reachable via **Back** (changing it triggers a fresh scan).

## The money-path deferral (core of this change)

Today the Stripe webhook (`provision.ts → deepenOwnedScans`) runs the **deep scan immediately at payment, against a GUESSED competitor cohort**, before the user picks anyone — so `report_payload.market` benchmarks against competitors they didn't choose. **Defer it:** remove the webhook deep-scan; the onboarding **Build step** drives the deep scan on the **picked** cohort (via the existing `/api/competitors/select → ensureDeepScan`, which is already the post-pick trigger and is idempotent). Safety net: onboarding is **blocking** (they must complete it → deep scan runs), plus the **weekly self-heal** (`weekly-refresh → ensureDeepScan`) catches any abandoned paid app within 7 days.

## Staged build (each stage verified before the next)

- **S1 — Unified overlay component.** Add `url` + `scanning` steps to `SetupOverlay` (steps `url → scanning → profile → competitors → building`); a `mode`/entry prop picks the start step. Reuse `AddProductForm` (url), `DashboardScanProgress` (scanning, advance on `facts`), `SetupProfileStep`, `CompetitorSetup`, `SetupCalculatingStep`. Step indicator counts only the steps that will render.
- **S2 — Entry unification.** `/app/add` renders the overlay in `add` mode (blocking modal); the layout keeps mounting it in `first-run` mode; `AddFlow` retired (route renders the overlay). The layout renders the shell `inert` for the add surface too, so it's blocking like first-run. Back-from-URL supported.
- **S3 — Deferral.** Remove `deepenOwnedScans` from `provision.ts` (keep `linkScanToUser`). The Build step watches the **deep scan** to completion (`deepened_at`) — not just `supply` — so the dashboard unlocks only when the deepened data is ready; the select route stays the trigger.
- **S4 — Verify.** typecheck/tests/arch; local render of both entries; confirm the deep scan fires on pick (not at webhook) and the market cohort == the pick.

## Permutation matrix

| Entry × state | Steps shown |
|---|---|
| Add-product (no app yet) | URL → Scanning → Profile → Competitors → Building |
| Upgrade (free scan done, not deepened) | Profile → Competitors → Building (URL/Scan reachable via Back) |
| Upgrade, user hits Back on Profile | URL (re-scan on change) |
| Second+ product while others ready | Same 5 steps; blocking, with Switch-product/Settings/Sign-out escapes |
| Abandoned mid-onboarding | Blocking holds; weekly self-heal deepens within 7d |

## Acceptance

- ONE component renders every onboarding entry; `AddFlow` gone.
- `provision.ts` no longer deep-scans at payment; the deep scan fires from the pick; `report_payload.market.cohort` reflects the **picked** competitors.
- Build step unlocks the dashboard only once `deepened_at` is set (no free-data flash).
- Blocking + escapes (Switch/Settings/Sign-out) intact; Back from URL re-scans.
- typecheck/tests/arch green; both entries render locally.
- `docs/architecture.md` scan-sequence note updated (deep scan is post-pick, not post-payment).

## Risk

Revenue-critical path. Mitigations: staged + verified; the deep scan trigger (`ensureDeepScan` on select) already exists and is idempotent; blocking flow + weekly self-heal cover abandonment; provision keeps `linkScanToUser` + the magic-link send unchanged.
