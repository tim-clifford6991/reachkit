# ReachKit design-sync notes

## WS2 Customers redesign reconcile 2026-07-13
Live Customers page (`components/app/intel/customers-view.tsx`) was rebuilt into
three analytical rows, every data point wired into the shared `EvidenceDrawer`:
(1) two columns — "Who your buyer is" (compact ICP→JTBD + use-case chips) |
"Demand themes" (each theme = name + volume + intent, sample keywords as chips
beneath); (2) full-width "Where they hang out" = the intent×recency map
(`IntentRecencyMap`) over the filterable buyer-thread feed (`BuyerThreadFeed`);
(3) full-width "Top buyer pains" = mention-ranked frequency bars (`PainBars`).
Four NEW atomic mirrors were added for this build (already present in `ds-src`
+ wired into `build.mjs`/`layout.mjs`/`index.tsx` before this reconcile pass):
`EvidenceDrawer`, `IntentRecencyMap`, `BuyerThreadFeed`, `PainBars` — each a
static-markup mirror of its live client-only counterpart (the live components
draw to canvas / use client state; the DS sandbox only pre-renders static
markup via `renderToStaticMarkup`, so each mirror ships a representative fixed
sample dataset with the same visual language, documented in its own header
comment). This pass reconciled the one remaining STALE mirror,
`CustomersScreen.tsx` (@mirrors `customers-view.tsx`), rewriting it to compose
the three-row layout (reusing `IntentRecencyMap`/`BuyerThreadFeed`/`PainBars`
directly, plus `Card`/`Eyebrow`/`Badge` from `IntelKit`) with realistic
meeting-AI-buyer sample data (nudgi.ai ICP, demand themes with per-theme
keywords, r/SaaS + Indie Hackers threads with dates/engagement, mention-counted
pains with sources). `INVENTORY.md` updated: the 4 atomics added as ACTIVE with
their `@mirrors`, `CustomersScreen`'s page entry rewritten to describe the
redesign, atomic count corrected 14→19. `pnpm check:design` = 0 STALE + parity
OK after `bless:design`.

## WS1 Competitors redesign reconcile 2026-07-12
Live Competitors page was rebuilt (browsing-first: gap-map matrix that doubles as
the competitor selector + full-width detail; the old second left rail removed).
Two NEW atomic mirrors added during the build (coverage ratchet forced them
inline): `CompetitorGapMap` (@mirrors `competitor-gap-map.tsx`) and `ReferrerRow`
(@mirrors `referrer-row.tsx`). After the live gap-map went **column-major** (one
surround per selected column, not per-cell) and ReferrerRow swapped InfoTip →
native `title` (bundle: keep Base UI Tooltip out of the `(app)` chunk), all four
Competitor mirrors were reconciled to match and re-blessed: `CompetitorGapMap`,
`ReferrerRow`, `CompetitorEdgePanel` + `CompetitorsScreen` (both @mirrors
`competitors-view.tsx`). `pnpm check:design` = 0 STALE + parity OK; INVENTORY.md
updated. **Setup reference for future changes: the pipeline below ("Adding a
component = 4 edits" + `build.mjs`→`layout.mjs`→`bless:design`→`/design-sync`) is
the canonical how-to; CLAUDE.md's "Keeping Claude Design and the code in EXACT
sync" is the governing rule.**


ReachKit is a **Next.js app**, not a packaged component library — no Storybook,
no compiled component `dist/`, no `exports`. The standard package-shape converter
cannot run. We **hand-author** the Claude Design layout from standalone, adapted
versions of the app's components.

## Pipeline (proven)
- Component sources: `.design-sync/ds-src/*.tsx` — clean, prop-driven React, no
  Next/server/data coupling, styled with inline styles + `var(--c-*)` tokens.
- Bundle: `node .design-sync/ds-src/build.mjs` → `ds-bundle/_ds_bundle.js`
  (IIFE → `window.ReachKitDS`). React is **external**, resolved to the vendored
  global the preview cards load.
- **JSX gotcha**: the repo tsconfig sets `jsx: react-jsx` (automatic runtime),
  which esbuild picks up and emits `require("react/jsx-runtime")` → crashes in
  the browser. Fixed by passing `tsconfigRaw` with `jsx: "react"` (classic) in
  build.mjs so the bundle needs only the React global.
- React 19 dropped UMD, so `_vendor/` ships **React 18 UMD** (unpkg) for preview
  rendering — fine for these simple components.
- Tokens: `ds-bundle/tokens/tokens.css` (full `--c-*` light+dark + fonts via
  Google Fonts @import); `styles.css` @imports tokens + `_ds_bundle.css`.
- esbuild lives in `.ds-sync/node_modules`; `.design-sync/node_modules` is a
  symlink to it so build.mjs resolves esbuild (recreate per clone:
  `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`).

## ⚠ Full build pipeline is 3 steps — `tokens.css` is now COMMITTED + parity-checked (updated 2026-07-09)
`ds-bundle/` is **gitignored** (never committed). The design tokens are now a
**committed source of truth at `.design-sync/tokens.css`** (the app's `--c-*`
palette in plain CSS + Google-Fonts @import). `layout.mjs` READS
`.design-sync/tokens.css` and COPIES it into `ds-bundle/tokens/tokens.css` on
build, so the bundle stays self-contained and the tokens are no longer re-fetched
from the remote project. `.design-sync/tokens.css` is **parity-checked against
`app/globals.css`** by `pnpm check:design` (every `--c-*` must match; bands must
match `SCORE_BANDS`) — so it can never silently drift from the app. `styles.css`
is still curated (it just `@import`s tokens + `_ds_bundle.css`).
The complete rebuild is therefore:
  1. `node .design-sync/ds-src/build.mjs`   → `_ds_bundle.js`, `_ds_bundle.css`, `_ds_sync.json`
  2. **ensure `ds-bundle/styles.css` exists** (curated; restore from remote or a
     prior `ds-bundle` if wiped). `tokens/tokens.css` is regenerated by step 3
     from the committed `.design-sync/tokens.css` — no re-fetch needed.
  3. `node .design-sync/ds-src/layout.mjs` → copies tokens + all component cards + static prerender.
`README.md` in the managed set is likewise curated/hand-stitched (no converter
stitches `readmeHeader`); conventions.md is validated, not re-authored, on re-sync.

## LandingHero updated 2026-07-06 → live-landing hero
`ds-src/LandingHero.tsx` was stale ("Stop guessing… isn't getting found", ~90s).
Rewrote it to mirror the current captured landing hero (`landing-html.ts`):
radial-fade section, evidence pill (dot + "Grounded in your live page…"),
headline "Your competitors are being found. <em>You aren't.</em> <violet>See
exactly why.</violet>", updated subhead, ScanInput with note "Under a minute ·
No login for your first scan · Try: bloom.io". New optional `emphasis` prop.
Rebuilt + card render-verified (served static, screenshot-matched the live hero).
Uploaded SCOPED (atomic path): `_ds_bundle.js` + `components/Marketing/LandingHero/**`
+ sentinel + `_ds_sync.json` (unchanged, re-armed last). Protected content
re-confirmed intact via list_files. planId plan_819c77dc3b5b42e1_ad375d1462f4.

## ⚠ The LIVE landing hero is `components/sections/scan-hero.tsx`, NOT landing-html.ts
`landing-screen.tsx` slices the captured hero OUT (`REST_HTML = LANDING_HTML.slice(
after first </section>)`) and renders `<ScanHero showScrollCue/>` in its place
(PR 37caa07: split layout + evidence pill + "See how it works" scroll cue + the
report-card mock on the right). So the hero <section> in `landing-html.ts` is DEAD
— editing it does nothing. To change the real landing hero, edit `scan-hero.tsx`.

## Hero iteration 5 — ShipFast two-line lockup, ONE consistent size (final)
Per user + ShipFast reference: fixed structure at ALL widths — line 1 "Your
competitors are being", line 2 "found. <You aren't. highlighted inline>". ONE
consistent font size (dropped the 0.62/1.18 split). Each line is white-space:
nowrap; `.rkh-h1` clamps retuned so line 1 fits the 46% column (desktop
clamp(1.7rem,3vw,36px)) and scales down on mobile (clamp(1.4rem,6vw,44px)) —
verified rects=1/no-overflow at 36px desktop + narrow sim. Violet highlight
(color-mix var(--c-action) onto surface) kept. DS LandingHero mirrors it
(headline default now "Your competitors are being", "found." bridge hardcoded);
re-synced.

## Hero iteration 4 — restored missing PR work + violet punch, "See exactly why" dropped
Missing commit **4a10aef** (on feat/story-copy-hero, NOT in feat/scan-slugs — my branch
was cut at 8fe66e2, before it) carried: one-line eyebrow "Every claim grounded in your
live page." (nowrap), the punchier lockup (setup 0.62em / punch 1.18em), and smooth-glide
Lenis anchor scrolling for the "See how it works" cue (motion-provider.tsx). Cherry-picked
it in (resolved the scan-hero h1 conflict to the final design). Then per user: highlight
now uses the CENTRAL palette — `color-mix(in oklab, var(--c-action) 20%, var(--c-surface))`
(violet, not the red band-invisible) — and "See exactly why." REMOVED so the two-line
lockup puts all weight on the highlighted italic "You aren't." DS LandingHero mirrors it
(dropped the `accent` prop) + re-synced.

## Hero title treatment 2026-07-06 (iteration 3 — SOLID box, on the real hero)
Fixed on `scan-hero.tsx` (the punch was `fontSize:1.14em` italic block → oversized).
Now: all 3 headline lines ONE size; "You aren't." is a SOLID highlight marker
(ShipFast style) — `display:inline-block; background: color-mix(in oklab,
var(--c-band-invisible) 22%, var(--c-surface))` (solid soft-red from our palette,
NOT a new colour), italic, small radius; "See exactly why." stays violet. DS
`LandingHero.tsx` mirrors it; re-synced scoped. Reverted the earlier dead
landing-html.ts hero edit.

## Hero title treatment 2026-07-06 (iteration 2)
Title reworked: all 3 phrases ONE size; the negative phrase "You aren't." gets a
soft-red highlight marker `background: color-mix(in oklab, var(--c-band-invisible)
16%, transparent)` + italic (ShipFast-marker inspiration, but our palette — no new
colours); "See exactly why." stays `var(--c-action)` violet. Applied to BOTH
`ds-src/LandingHero.tsx` AND app `components/sections/captured/landing-html.ts`
(the h1 `<em>`). DS re-synced scoped (reused session planId). NOTE: user's running
app (localhost:3001) showed an UNEVEN-sized hero not present in feat/scan-slugs
(uniform 57px here) — their instance is a different/newer version; target design
applied to this branch + DS regardless.

## Re-sync verdict 2026-07-06 — NO-OP (no drift)
ds-src + build.mjs + layout.mjs all unchanged since the 2026-07-02 sync; rebuilt
`_ds_sync.json` exports IDENTICAL to remote (33); ScoreGauge card byte-matches
remote; conventions.md all 34 tokens + 7 components verify. `app/globals.css`
changed 2026-07-03 but only to add the `--c-band-*` tokens in `oklch()` — the DS
already carries those bands as the equivalent hex (tokens.css == bands.ts), so no
DS drift. Nothing uploaded. Protected remote content untouched.

## Status
- Project: "ReachKit Design System" (819c77dc-3b5b-42e1-a065-315f28ee4f0b).
- Foundations + 6 signature components built & bundle render-verified:
  BrandMark, Button, Badge, ScoreGauge, ScoreCard, ComparisonTable.
- **2026-07-02 — DS aligned to the Analytics Dashboard template (33 components).**
  The template (`templates/analytics-dashboard/`) is the canonical standard.
  Added 5 components extracted from it (group "App"): `ChannelDonut`,
  `CompetitorEdgePanel`, `PlanItemCard`, `LeverBanner`, `ProgressChart`.
  Reconciled `ScoreGauge`, `KpiCard`, `AppShell`, `SearchGapTable` and rebuilt
  `DashboardScreen` to mirror the template's Dashboard view. All visually verified
  locally + confirmed rendering in the sandbox. `build.mjs` now GENERATES
  `_ds_sync.json` from `exportsList` (no more hand-drift). Adding a component =
  4 edits: `<Name>.tsx`, `index.tsx` export, `build.mjs` exportsList, `layout.mjs`
  META. Spec+plan: `docs/superpowers/specs|plans/2026-07-02-ds-align-*`.

## Re-sync risks
- The bundle is hand-built, NOT from a published dist — it can drift from the
  app's real components. Treat ds-src as the DS's own source of truth.
- Fonts load from Google Fonts at runtime (`[FONT_REMOTE]`), not shipped woff2.

## PROTECTED remote content — created directly in Claude Design, NOT by this sync
The remote project (819c77dc-…) contains hand-created content that is **NOT**
produced by `build.mjs` and must **NEVER** be deleted or overwritten by a sync.
Verified present via `list_files` on 2026-07-02:
- `templates/analytics-dashboard/` — **CRITICAL** user template
  (`AnalyticsDashboard.dc.html`, `ds-base.js`, `support.js`, `.thumbnail`).
- `motion/` (animation kits, scene jsx, logo svg), `scraps/`, `screenshots/`,
  `uploads/` (assets), and `ReachKit Product Tour.html`,
  `ReachKit Promo Reel.html`, `ReachKit Story Video.html`.
- Server-generated: `_ds_manifest.json`, `_adherence.oxlintrc.json`.

**Upload rules for this project (hand-authored, no resync.mjs driver → deletes
are hand-derived):**
- `finalize_plan` **writes** must be scoped to the managed set ONLY:
  `components/**`, `tokens/**`, `styles.css`, `_ds_bundle.js`, `_ds_bundle.css`,
  `README.md`, `_ds_sync.json`, `_ds_needs_recompile`. Do NOT use broad globs
  like `templates/**`, `motion/**`, `uploads/**`, `**`.
- **deletes**: only ever managed component paths that a rebuild dropped
  (hand-derived by diffing local `components/` vs remote). Given source is
  usually unchanged, deletes is normally `[]`. NEVER put a protected dir in it.
- Do NOT upload local `_vendor/` — the bundle is self-contained; remote has no
  `_vendor/` and it must stay that way.
- Only upload when the managed set actually drifted (local `_ds_sync.json`
  exports / rebuilt bundle differ from remote). A no-op re-sync uploads nothing.

## Preview rendering in Claude Design — RESOLVED 2026-07-02 via STATIC prerender
**Root cause:** the Claude Design sandbox does NOT render our preview cards'
client `<script>` (inline OR external) — a card that mounts React on load stays
blank. (The working `templates/analytics-dashboard/` card renders because it's
Claude's DC format: `<x-dc>` + `<helmet>` + `support.js`/`ds-base.js` runtime,
static markup + {{mustache}}, no app-owned mount script.) Cards are served as
LIVE cross-origin sandboxed iframes from
`https://<projid>.claudeusercontent.com/.../serve/<path>?t=<token>`
(`sandbox="allow-scripts allow-same-origin"`) — cross-origin from claude.ai, so
you CANNOT read their console/DOM from the parent tab (this made diagnosis slow;
use iframe **height** as the render signal: content-sized = rendered, ~0/60px =
blank). Direct nav to a /serve/ URL without the token = "preview token required".

**Fix (current mechanism — DO NOT regress to client-mount):** each `<Name>.html`
card is now **self-contained STATIC HTML** — `layout.mjs` pre-renders every
component to markup at build time with `react-dom/server` `renderToStaticMarkup`
(esbuild builds a tiny `.prerender.mjs` with `packages:"external"` so react/
react-dom stay native → ONE React instance, node builtins resolve). The card is
`<style>{inlined tokens.css}…</style>` + the pre-rendered markup in `#root`,
**no `<script>`, no `_ds_bundle.js` link**. Static HTML always renders in the
sandbox. Full visual fidelity because components style via inline styles + `--c-*`
vars. `_ds_bundle.js` is still built + uploaded (it's the importable DS the design
agent builds with) but the CARDS no longer depend on it.
- Failed attempts this session (for the record, don't repeat): (1) re-upload of
  the client-mount bundle+cards; (2) defensive inline poll for `ReachKitDS.mount`;
  (3) external-only `data-rk-mount` auto-mount in the bundle. All render LOCALLY
  but stay blank in the sandbox — because the sandbox doesn't run the card script.
- Prerender caveat: `renderToStaticMarkup` shows initial render only — components
  that need `useEffect` to show content would render empty (none did; build prints
  "static prerender: all N components rendered ✓" or lists failures).
- User confirmed cards load after this upload.

## Preview rendering in Claude Design (older "FIXED" note — both superseded above)
- First upload: cards registered (sidebar) but rendered BLANK. Two causes:
  (1) the bundle's `require` banner defined a GLOBAL `require` that interfered
  with the host runtime; (2) vendored React 18 vs a differently-versioned React
  → React error #31 (cross-instance element mismatch).
- Fix: bundle React + ReactDOM INTO `_ds_bundle.js` (self-contained, no external,
  no `require` hack) and expose a `mount(Comp, props, el)` helper. Preview `.html`
  is now just `<script src=_ds_bundle.js>` + `ReachKitDS.mount(...)` — ONE React,
  no `_vendor/`. build.mjs: no `external`, `define process.env.NODE_ENV`, minify.
- There is NO manual "publish" — the `_ds_needs_recompile` sentinel triggers the
  app self-check on project open, which builds `_ds_manifest.json`.
