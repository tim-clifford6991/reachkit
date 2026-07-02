# ReachKit design-sync notes

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

## Status
- Project: "ReachKit Design System" (819c77dc-3b5b-42e1-a065-315f28ee4f0b).
- Foundations + 6 signature components built & bundle render-verified:
  BrandMark, Button, Badge, ScoreGauge, ScoreCard, ComparisonTable.

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
