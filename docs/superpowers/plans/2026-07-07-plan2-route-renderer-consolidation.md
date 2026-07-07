# Plan 2 — Single `/scan/<slug>` URL + One Locked Renderer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `/scan/<slug>` the single canonical public page for a scan — live → result at one URL, **always free-redacted** (the public lead magnet, no auth branching). 301 the old `/scan/<id>/results` and `/report/<slug>` into it, move the OG image + share badge + JSON-LD onto it, and retire the duplicate renderers (`FindingsReveal`, `FreeScanTeardown`).

**Architecture:** Phase 1 made free scans persist a `report_payload`, so every completed scan can render the same `ResultsScreen`. This plan folds the `/scan/[id]/results` result view into `/scan/[id]` itself (rendered inline when the scan is done, live `ScanStream` otherwise), hard-redacts the public page to the free tier (`redactReportForTier(payload, "free")` — paid users see their full report in the authenticated `/app`, unchanged), and removes the now-duplicate `/report/[slug]` route in favor of redirects.

**Tech Stack:** Next.js 16 App Router (`cacheComponents: true`), TypeScript, Supabase, Vitest.

## Global Constraints

- **Public page is ALWAYS free-redacted.** The canonical `/scan/<slug>` renders `redactReportForTier(payload, "free")` for EVERY viewer — no `currentUser()`/`entitlementsFor()` branching on this route. (This is the deliberate two-surface split: paid full report lives in the authenticated `/app`.)
- **One renderer:** every completed-scan result renders `ResultsScreen` (locked, with the upgrade CTA). `FindingsReveal` and `FreeScanTeardown` are deleted.
- **One URL:** the canonical page is `/scan/<slug>` (domain slug via `resolveScanParam`). `/scan/<id>/results` and `/report/<slug>` permanently (301) redirect to it. No user-facing link points at the retired paths.
- **Preserve share/SEO:** the OG score-card image, Article JSON-LD, and the copy-paste badge move onto `/scan/[id]` — shareability must not regress.
- **No score/data changes** — this plan is routing + rendering only. Do not touch scoring or the pipeline.
- Match existing patterns; keep `"use cache"` boundaries valid under `cacheComponents`.

## File Structure

- **Create** `app/(funnel)/scan/[id]/public-report.tsx` — the shared server component that renders a completed scan's public (always-free) result: reads `report_payload`, hard-free-redacts, renders `ResultsScreen` locked + JSON-LD + `<BadgeEmbed>`.
- **Modify** `app/(funnel)/scan/[id]/page.tsx` — render `PublicReport` inline when the scan is done+has report (instead of redirecting to `/results`); add OG/JSON-LD metadata.
- **Modify** `app/(funnel)/scan/[id]/scan-stream.tsx` — hand off via `router.refresh()` (same URL) instead of `router.replace('/scan/${id}/results')`; drop the partial-failure `FindingsReveal` embed.
- **Create** `app/(funnel)/scan/[id]/opengraph-image.tsx` — ported from `app/report/[slug]/opengraph-image.tsx`.
- **Move** `app/report/[slug]/badge-embed.tsx` → `app/(funnel)/scan/[id]/badge-embed.tsx` (update the hard-coded `/report/` URLs to `/scan/`).
- **Modify** `next.config.ts` — add `redirects()` (301) for the retired paths.
- **Delete** `app/(funnel)/scan/[id]/results/` (whole dir), `app/report/` (whole group: `[slug]/page.tsx`, `score-block.tsx`, `layout.tsx`, the OG route once ported), `app/(funnel)/scan/[id]/findings-reveal.tsx`, `components/report/upgrade-cta.tsx` if unused.
- **Modify** every file referencing `/report/<slug>` URLs (sitemap, teardowns index, share buttons, llms.txt, landing display literals).
- **Tests:** redirect tests, `public-report` hard-free-redaction test; delete/retarget `tests/integration/report-public-page.test.ts`.

---

## Task 1: `PublicReport` — the always-free public result renderer

**Files:**
- Create: `app/(funnel)/scan/[id]/public-report.tsx`
- Test: `app/(funnel)/scan/[id]/public-report.test.tsx` (or a focused unit test of the redaction wiring)

**Interfaces:**
- Consumes: `serverDb`, `resolveScanParam`, `redactReportForTier` (`lib/billing/entitlements.ts`), `ResultsScreen` + `toResultsProps` (`components/report/captured/*`), `CapturedUnlockButton`, `brandFromUrl`, `buildScoreCard` (`lib/badge/score-card.ts`), `articleLd`/`buildMetadata` (`lib/seo.ts`), the new `<BadgeEmbed>` (Task 5 moves it — for now import from its new path `./badge-embed`).
- Produces: `export async function PublicReport({ scanId, slug, storeUrl, payload }: { scanId: string; slug: string; storeUrl: string; payload: ReportPayload }): Promise<JSX.Element>` — a server component rendering the always-free result.

**What it does (port from `app/report/[slug]/page.tsx` `ReportContent`, lines 185-247):**
- `const report = redactReportForTier(payload, "free")` — ALWAYS free, no viewer/entitlement lookup.
- `brand = brandFromUrl(storeUrl)`; compute `fullActions`/`fullGapQueries` from the PRE-redaction `payload` (so the locked counts name the withheld total).
- Render the Article JSON-LD `<script type="application/ld+json">`, then `<ResultsScreen {...toResultsProps(report, brand?.host ?? "your site", fullActions, fullGapQueries)} logoUrl siteHost slug={slug} unlockButton={<CapturedUnlockButton scanId={scanId} />} />` (do NOT pass `hideUnlock` → the locked band + upgrade CTA always show), then `<BadgeEmbed slug={slug} total={buildScoreCard(report).total} />`.

- [ ] **Step 1: Write the test** — assert `PublicReport` calls `redactReportForTier(payload, "free")` regardless of any auth state (no `currentUser` import in the module), and renders `ResultsScreen` with an unlock button and no `hideUnlock`. (Shallow-render or assert the redaction call via a spy; match the style of existing component tests. If server-component rendering is hard to unit-test, instead write a pure helper `publicReportProps(payload, slug, storeUrl)` returning the `ResultsScreen` props + redaction, and test that.)
- [ ] **Step 2: Run it, see it fail.** `pnpm test app/(funnel)/scan/[id]/public-report.test.tsx`
- [ ] **Step 3: Implement** `public-report.tsx` per above.
- [ ] **Step 4: Run test → pass; `pnpm exec tsc --noEmit` clean.**
- [ ] **Step 5: Commit** `feat(scan): PublicReport — always-free public result renderer`

---

## Task 2: Render the result inline at `/scan/[id]` (no redirect to /results)

**Files:**
- Modify: `app/(funnel)/scan/[id]/page.tsx`
- Modify: `app/(funnel)/scan/[id]/scan-stream.tsx`

**Interfaces:**
- Consumes: `PublicReport` (Task 1).
- Produces: `/scan/<slug>` renders the live scan OR the completed result at the SAME URL.

**Changes:**
- `page.tsx` `ScanHydrator`: it currently `redirect('/scan/${slug}/results')` when `initialStatus === "done" || "degraded"` (lines ~71-73). Replace that redirect: also select `report_payload, apps(store_url)`; when done/degraded AND `report_payload` present, `return <PublicReport scanId={id} slug={resolved.slug} storeUrl={storeUrl} payload={report_payload} />` inside the existing `<main>`/`<Suspense>`. If done but no `report_payload` (rare post-Phase-1 edge), fall through to `ScanStream` (which will refresh) or a minimal "finalising" state.
- `scan-stream.tsx`: the hand-off effect currently does `router.replace('/scan/${id}/results')`. Change it to `router.refresh()` so the same-URL server component re-renders and shows `PublicReport`. Keep the `shouldHandOffToResults` gating (free → on findings/report-ready; full → report-ready). Remove the `PreparingResults` redirect assumption if needed — after `router.refresh()` the server component swaps in the result.
- `scan-stream.tsx` partial-failure branch (`if (failed && facts) return <FactsView ...>`): `FactsView` embeds `FindingsReveal` (being deleted in Task 6). Replace the partial-failure view with a simple inline "we gathered partial results — try again" message + a link to `/scan` (drop the FindingsReveal teaser). Keep `ScanError` for the no-facts failure.

- [ ] **Step 1: Write/adjust a test** for `page.tsx` behavior if feasible (`scan-route`/`scan-stream` tests exist — `tests/integration/scan-route.test.ts`, `tests/integration/scan-stream.test.ts`). At minimum add a unit assertion that the hand-off uses refresh (or that `ScanHydrator` returns `PublicReport` for a done+report scan). If server-side is hard to unit test, rely on the integration test in Task 7 and note it here.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** the page + scan-stream changes.
- [ ] **Step 4: `pnpm test app/(funnel)/scan/[id]/handoff.test.ts components/scan/scan-narrative.test.ts` (existing) pass; `tsc --noEmit` clean.**
- [ ] **Step 5: Commit** `feat(scan): /scan/[id] renders the result inline (one URL, no /results redirect)`

---

## Task 3: Move OG image + JSON-LD metadata onto `/scan/[id]`

**Files:**
- Create: `app/(funnel)/scan/[id]/opengraph-image.tsx` (port from `app/report/[slug]/opengraph-image.tsx`)
- Modify: `app/(funnel)/scan/[id]/page.tsx` `generateMetadata`

**Changes:**
- Port `opengraph-image.tsx` verbatim (it already resolves the slug via `resolveScanParam`, reads `report_payload`, builds the score card). It works unchanged at the new path since it keys off the `[id]` param.
- `generateMetadata` on `/scan/[id]`: when the scan has a `report_payload`, produce the score-titled metadata + OG image pointing at `/scan/${slug}/opengraph-image` and Article JSON-LD (port the branch from `app/report/[slug]/page.tsx:57-131`). When not, keep the existing "Scanning…" metadata.

- [ ] **Step 1: Test** — a metadata unit test if the repo has one for `/report` (`report-public-page.test.ts` may cover it); otherwise a focused assertion that `generateMetadata` returns the OG image URL under `/scan/`. 
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: `tsc --noEmit` clean; the OG route renders (smoke).**
- [ ] **Step 5: Commit** `feat(scan): OG score-card image + JSON-LD on /scan/[id]`

---

## Task 4: 301 redirects for the retired paths + delete the old routes

**Files:**
- Modify: `next.config.ts` (add `async redirects()`)
- Delete: `app/(funnel)/scan/[id]/results/` (whole dir), `app/report/` (whole group)

**Changes:**
- Add to `next.config.ts`:
```ts
async redirects() {
  return [
    { source: "/scan/:id/results", destination: "/scan/:id", permanent: true },
    { source: "/report/:slug", destination: "/scan/:slug", permanent: true },
    { source: "/report/:slug/opengraph-image", destination: "/scan/:slug/opengraph-image", permanent: true },
  ];
}
```
- Delete `app/(funnel)/scan/[id]/results/` entirely (page.tsx, report-pending.tsx, report-reveal.tsx, score-block.tsx, animated-reveal.tsx) — the result now lives on `/scan/[id]`. If any of those components (e.g. `report-pending`) is still needed for the done-but-no-report edge in Task 2, move it up to `app/(funnel)/scan/[id]/` first.
- Delete `app/report/` (page.tsx, score-block.tsx, badge-embed.tsx [moved in Task 5], opengraph-image.tsx [ported in Task 3], layout.tsx).
- Verify no remaining imports reference the deleted files (`rg` for them).

- [ ] **Step 1: Test** — add `tests/integration/scan-redirects.test.ts` (or unit) asserting the three redirects resolve (if the harness can test next.config redirects; else assert the config shape). 
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** config + deletions.
- [ ] **Step 4: `pnpm test` (full unit) + `tsc --noEmit` clean — fix any import breaks from the deletions.**
- [ ] **Step 5: Commit** `feat(scan): 301 /scan/:id/results and /report/:slug → /scan/:slug; delete old routes`

---

## Task 5: Move the share badge onto `/scan/[id]`

**Files:**
- Create: `app/(funnel)/scan/[id]/badge-embed.tsx` (from `app/report/[slug]/badge-embed.tsx`)
- Delete: `app/report/[slug]/badge-embed.tsx` (folded into Task 4's `app/report/` deletion — ensure the new copy exists first)

**Changes:**
- Copy `badge-embed.tsx` to the new path. Update the hard-coded URLs (`badge-embed.tsx:28-29`): `reportUrl = ${SITE.url}/scan/${slug}` and `imageUrl = ${SITE.url}/scan/${slug}/opengraph-image`.
- Update `PublicReport` (Task 1) to import `<BadgeEmbed>` from `./badge-embed`.

- [ ] **Step 1–2:** (small move) `tsc` after wiring.
- [ ] **Step 3: Implement** the move + URL updates.
- [ ] **Step 4: `tsc --noEmit` clean.**
- [ ] **Step 5: Commit** `feat(scan): move share badge to /scan/[id] (URLs → /scan/)`

---

## Task 6: Retire `FindingsReveal` + `FreeScanTeardown`

**Files:**
- Delete: `app/(funnel)/scan/[id]/findings-reveal.tsx`
- `FreeScanTeardown` lives inside `app/report/[slug]/page.tsx` (deleted in Task 4) — nothing extra to delete, just confirm gone.
- Modify: any remaining importer of `FindingsReveal` (`scan-stream.tsx` — handled in Task 2; confirm no others via `rg`).
- Delete `components/report/upgrade-cta.tsx` if it is now unused (`rg UpgradeCta`).

- [ ] **Step 1: `rg "FindingsReveal|FreeScanTeardown|UpgradeCta"`** — confirm the only remaining refs are the definitions to delete.
- [ ] **Step 2: Delete** the files and remove any lingering imports.
- [ ] **Step 3: `pnpm test` + `tsc --noEmit` clean.**
- [ ] **Step 4: Commit** `chore(scan): retire FindingsReveal + FreeScanTeardown (one renderer)`

---

## Task 7: Repoint all `/report/<slug>` URL references → `/scan/<slug>` + fix tests

**Files (from the dossier — update each `/report/` URL to `/scan/`):**
- `app/sitemap.ts:70` — `${SITE.url}/report/${scan.slug}` → `/scan/`.
- `app/(marketing)/teardowns/page.tsx:115` — `href={\`/report/${s.slug}\`}` → `/scan/`.
- `app/llms.txt/route.ts:44` — the `/report/{scan-id}` description → `/scan/`.
- `components/report/captured/share-button.tsx:26` and `components/report/share-score-button.tsx:29` — `${origin}/report/${slug}` → `/scan/`.
- `components/sections/scan-hero.tsx:126` + `components/sections/captured/landing-html.ts:25` — display literals `app.reachkit.io/report/bloom.io` → `/scan/`.
- Any doc-comment refs in `lib/seo.ts`, `lib/badge/score-card.ts` (cosmetic — update if trivial).
- Tests: `tests/integration/report-public-page.test.ts` imports `@/app/report/[slug]/page` (deleted) — delete this test, and if its coverage (public teardown renders free-redacted) still matters, add an equivalent assertion to Task 1's `public-report` test. `components/sections/sections.test.ts:337` (`/report/demo`) and `tests/integration/scan-demo.test.ts` — update any `/report` expectations to `/scan`.

- [ ] **Step 1: `rg -n "/report/"`** across `app/ components/ lib/ tests/` — enumerate every hit.
- [ ] **Step 2: Update** each to `/scan/` (or delete, for the removed test).
- [ ] **Step 3: `pnpm test` (full) + `tsc --noEmit` clean.**
- [ ] **Step 4: Commit** `chore(scan): repoint all /report/<slug> links → /scan/<slug>`

---

## Task 8: Integration test — one URL, redirects, always-free public view

**Files:**
- Create: `tests/integration/scan-public-consolidation.test.ts`

**Asserts (adapt to the harness; local Supabase is available):**
- A completed FREE scan renders the public result via `PublicReport` free-redacted (deep sections locked; upgrade CTA present).
- A completed scan viewed by a PAID/authenticated context on the PUBLIC `/scan/<slug>` is STILL free-redacted (no paid drafts leak) — the public page ignores viewer entitlement.
- The `/scan/:id/results` and `/report/:slug` redirects resolve to `/scan/:slug` (assert via the next.config redirect list or a route test).

- [ ] **Step 1: Write it.**
- [ ] **Step 2: `pnpm test:int tests/integration/scan-public-consolidation.test.ts` → pass.**
- [ ] **Step 3: Commit** `test(scan): public consolidation — one URL, redirects, always-free`

---

## Self-Review

- **Spec coverage:** single URL (T2,T4), always-free public render (T1), OG/badge/JSON-LD moved (T3,T5), retired renderers (T6), repointed links (T7), redirects (T4), tests (T1,T8). Matches Plan 2 in the spec's rollout.
- **Risk:** the biggest is the same-URL live→result swap (T2) — the `router.refresh()` hand-off must reliably re-render the server component into `PublicReport`. Covered by T8 + manual verify.
- **Out of scope:** no scoring/pipeline changes; the paid `/app` surface is untouched.

## Execution Handoff
Subagent-driven. Dependency waves: **T1 → T2 ∥ T3 ∥ T5** (T2 needs T1; T3/T5 independent) **→ T4 (needs T3,T5 moved) → T6 → T7 → T8**. T4 deletes routes so must run after T3/T5 have ported OG/badge out of `/report`.
