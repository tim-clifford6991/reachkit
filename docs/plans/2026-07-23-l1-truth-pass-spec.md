# L1 truth-pass — surgical implementation spec (agent-verified, 2026-07-23)

> Execution spec for launch plan L1 (`2026-07-23-launch-readiness-atoz.md` §2). 24 changes across 16 files. Every claim below was verified against source at file:line by a dedicated audit agent. Execute mechanically; judgment items flagged for owner.

## Architecture facts that gate everything
- Live pricing page renders **captured** HTML (`PRICING_HTML` + `LandingHydrate rootId="rk-pricing"`); the "Start Solo/Growth" buttons are inert template-string buttons wired only by `landing-hydrate.tsx`.
- `PlansGrid` / `PricingCheckoutLinks` / `BillingToggle` / section `pricing-table.tsx` are **fully orphaned** — the "real" anonymous-checkout + annual-toggle impl, unmounted.
- The free report already passed number-honesty (G6 — no numeric signal count renders); the marketing pages never got that pass.

## Task 1 — pricing sells (captured buttons → anonymous checkout)
Today: `landing-hydrate.tsx:71-72` routes upgrade CTAs to `/login?next=/app/billing`.
- **1.1** `landing-hydrate.tsx:71-75`: `UPGRADE_CTA_PATTERN.test(t) ? () => openCheckout(/growth/i.test(t) ? "growth" : "solo") : …`
- **1.2** Add `openCheckout(plan)` helper beside `openScanEntry` (copy ~12 lines from `pricing-checkout-links.tsx:33-55`): POST `/api/billing/checkout/anonymous` `{plan, interval:"month"}` → `window.location.href = d.url`, `.catch(() => router.push(UPGRADE_CTA_HREF))` (keep the constant as graceful fallback).
- Covers BOTH captured pricing (`rk-pricing`) and landing pricing cards (`rk-landing`, `landing-html.ts:160,171`) in one edit.
- **No test change** (labels unchanged; `UPGRADE_CTA_HREF` kept). **No DS drift** (behavior-only). Orphan cleanup of the 4 dead pricing components = optional separate PR.

## Task 2 — 18-signal claim (honest count)
Ground truth: registry = 18 (`signals.ts:43-96`), 2 are `source:"new"` (render "not measured"); free measures **~9** (6 parse + 3 exists; corroborated `results-screen.tsx:990` + guard `search-visibility.test.ts:1077-1084`).
Recommended wording: free surfaces → **"every signal we can measure from your live page"**; tool sub-pages keep numerator, drop denominator.

**2A — change (12 edits, 9 files):**
| File:line | Current → New |
|---|---|
| `tools/page.tsx:24` | "score across 18 signals" → "score across every signal we can measure from your live page" |
| `tools/page.tsx:62` | "full 18-signal Discoverability Score" → "full ReachKit Discoverability Score" |
| `tools/ai-visibility-check/page.tsx:73` | "5 of the 18 signals ReachKit scores" → "5 of the signals in the full ReachKit scan" |
| `tools/on-page-check/page.tsx:69` | "8 of the 18 signals" → "8 of the on-page signals in the full ReachKit scan" |
| `tools/meta-preview/page.tsx:182` | "1 of the 18 signals" → "one of the signals in the full ReachKit scan" |
| `scan/page.tsx:24` (JSON-LD) | "extracts 18 discoverability signals" → "extracts every discoverability signal it can read from your live page" |
| `how-it-works/page.tsx:30` | "score 18 discoverability signals" → "score every discoverability signal on your live page" |
| `how-it-works/page.tsx:38` | "scores 18 discoverability signals in under a minute" → "scores your live page across every signal it can read in under a minute" |
| `how-it-works/page.tsx:47` | "scores all 18 in under a minute" → "scores your page in under a minute" |
| `sections/how-it-works-scroll.tsx:63` | "runs it through 18 checks" → "and scores them" |
| `sections/dashboard-glimpse.tsx:83` | `meta="18 signals"` → `meta="live-page signals"` |
| `design/captured/scanning-capture.tsx:24` | "Scoring 18 signals across 3 pillars" → "Scoring your live-page signals across 3 pillars" |

**2B — paid/registry context (owner judgment):** `pricing-html.ts:20,:53` + `landing-html.ts:157` "Full 18-signal breakdown" describe the paid registry (genuinely 18 rows, unmeasured render honestly). KEEP defensible; if strict → "Full signal breakdown" + update DS mirrors `PlanCards.tsx:29` / `PricingTable.tsx:25` in the same change. `how-it-works/page.tsx:157,179,220` registry sections = KEEP (accurate).

**2C — compare pages (owner judgment):** 16 lines in `compare/compare-content.ts` say "18-signal discoverability score" — uniform find/replace to "discoverability score across every signal we can measure", or keep as registry-accurate.

**2D — internal comments/tests:** KEEP all (accurate about the registry; `signals.test.ts:13` "exactly 18" is correct).

## Task 3 — rival-why teaser
**Finding:** the audited quote ("how each one ranks, why they win…") is NOT live — removed in the P4 terseness pass; survives only as a stale comment (`results-screen.tsx:563-570` — update it, 3.6). Live levers:
- **3.1 (primary)** `results-screen.tsx:1007-1011` unlock-band items: `Daily fix calendar / Weekly rank tracking / Distribution & outreach` → **`Weekly action plan + keyword spine / Weekly rank tracking & score history / Referrer lessons & community targets`** (sells the post-M3a contract; folds Task 4).
- **3.2** `results-screen.tsx:575` bare "🔒 unlock →" → "🔒 See how each rival ranks + your keyword spine →".
- **3.3** `:579` optionally "🔒 See who wins these + your weekly plan →". **3.4** `:654` KEEP. **3.5** `:839` KEEP.
- Risk: render test pins price line + grid, NOT the three band literals — grep before editing.

## Task 4 — "Daily fix calendar" → weekly
Folded into 3.1. It's the only "daily" claim (plan has a daily X-post habit but fix/verify cadence is weekly everywhere else). No test pins it.

## Task 5 — nav stubs
- **Sharpest violation:** `status/page.tsx:11` claims `"All systems operational"` with **no monitoring behind it**.
- **5.1** Remove Status footer link in BOTH blocks: `app/(marketing)/layout.tsx:33` + `components/sections/site-chrome.tsx:37` (keep the two blocks in sync).
- **5.2** Roadmap stub is honest ("in the works", noindex) — KEEP or remove `layout.tsx:26`/`site-chrome.tsx:30` for symmetry (owner call).
- **5.3** If `/status` stays URL-reachable: title → "Status page coming soon".
- Imprint: live, noindex, honest-as-is; residual = no postal address/VAT ("available on request") — **owner input pending**, no code change for L1.
- Risk: `sections.test.ts:328-345` validates footer SHAPE not these items — safe.

## Task 6 — cardpointers marketing surfaces: KEEP all three
- Teardown `content/teardowns/cardpointers.ts` = genuine editorial + SEO asset — KEEP.
- Ticker `lib/marketing/scanned-companies.ts:34` = "scanned companies" (true) — KEEP unless surrounding copy implies "customers".
- Golden fixture = test-only, pins eval + cost regressions — KEEP.
(The DB purge of the orphaned app row is separate — L2, AFTER the O-4 capture; see A→Z plan §6.)

## Task 7 — annual honesty (loud-fail)
- **7.1** `lib/billing/stripe.ts:45-55` `priceIdFor`: annual selected + id unset currently falls back to MONTHLY while `checkout.ts:57,152` stamps `metadata.interval:"year"` — record says annual, customer pays monthly. Change to **throw**: `annual price not configured for plan "X" … refusing to bill monthly under an annual label`.
- **7.2** Fix now-false comments `stripe.ts:40-44` + `env.ts:59-60`.
- No live annual toggle exists (BillingToggle orphaned; captured pricing is monthly-only; hydrate posts `interval:"month"`) — but the API accepts `interval:"year"` publicly, so the throw is required regardless.
- Risk: flip any `priceIdFor(_, "year")` fallback test to `.toThrow()`.

## Roll-up
24 concrete edits / 16 files. Owner-judgment batch: 2B paid copy (+2 DS mirrors), 2C compare sweep, 5.2 roadmap link, 6.2 ticker copy. Tests to touch only if flagged literals move.
