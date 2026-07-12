# ReachKit Design System — component inventory

The hand-authored `ds-src` components and the LIVE app surface each mirrors.
Keep this current when a component is added, retired, or its live counterpart
changes — it's the map that keeps the design system aligned with the product.
Groups map to the Claude Design pane's `@dsCard group=` sections (set in
`layout.mjs`'s `META`). Reconciled reality-first 2026-07-09.

> **Reality-first rule.** A `ds-src` component is **active** only if its live
> counterpart is reachable from a real page. Otherwise it is **archived**
> (`archived: true` in `layout.mjs` META) — delete-free: the files stay, only the
> `@dsCard` marker + manifest group flip to "Archive" (shown LAST in the pane).
> This keeps the design system a 1:1 reflection of what actually ships. Many
> granular components (`components/report/*`, `components/charts/*`, several
> `components/sections/*`) were superseded by the "captured" page snapshots and
> are therefore represented at the **page** level (the Screen templates) rather
> than as standalone atoms.

> **Machine-checked mirror tags.** Every active `ds-src` carries a
> `/* @mirrors <live-path> */` tag (primitives use `/* @mirrors - */`).
> `pnpm check:design` **fails** if an active component has no tag or its live
> file stops resolving, and warns on live components with no mirror. Archived
> components are exempt. Tags are the enforced source; this table is the
> human-readable view. See CLAUDE.md → "Consistency harness".

Counts: **45 active** (25 atomic + 20 Page templates) · **16 archived** · 61 total.

### Landing-page section components (11) — each a slice of the live "/" that `LandingScreen` composes
`LandingHero` (→ `scan-hero.tsx`) · `CompanyTicker` (→ `company-ticker.tsx`) · `StorySection` · `HowItWorks` · `ActionEngine` · `WhySwitch` · `Testimonials` · `Audience` · `PricingBlock` · `ScoreTravels` · `FinalCta` (the last nine → the live captured `landing-html.ts`). `LandingScreen` is a thin composition: `NavBar → LandingHero → CompanyTicker → StorySection → HowItWorks → ActionEngine → WhySwitch → Testimonials → Audience → PricingBlock → ScoreTravels → FinalCta → Footer`.

## Active atomic (14)
| Component | Group | Mirrors (live) — `@mirrors` |
|---|---|---|
| BrandMark | Foundations | `components/brand/logo.tsx` |
| Button | Foundations | primitive (`-`) — no 1:1 live file (inline/shadcn buttons) |
| Badge | Foundations | `components/app/intel/kit.tsx` (score-band + tone chips) |
| TextField | Foundations | primitive (`-`) — inline form inputs |
| UnlockBand | Report | `components/report/captured/unlock-button.tsx` (free→paid) |
| NavBar | Marketing | `components/sections/marketing-nav.tsx` |
| Footer | Marketing | `components/sections/footer.tsx` |
| ScanInput | Marketing | `components/sections/scan-hero.tsx` (the "Analyze my site" pill lives here) |
| AppShell | App | `components/app/captured/app-shell.tsx` sidebar chrome |
| KpiCard | App | `components/app/intel/kit.tsx` metric tiles |
| ScanningRing | App | `components/scan/scan-animation.tsx` |
| CompetitorEdgePanel | App | `components/app/intel/competitors-view.tsx` "their edge → your move" callout |
| CompetitorGapMap | App | `components/app/intel/competitor-gap-map.tsx` column-major gap matrix (also the rival selector) |
| ReferrerRow | App | `components/app/intel/referrer-row.tsx` one-line referrer with expandable detail |
| PlanItemCard | App | `components/app/intel/plan-entry-card.tsx` weekly action |
| LeverBanner | App | `components/app/intel/dashboard-hero.tsx` weakest-pillar callout |

## Pages (20) — full-page Screen templates (`cardGroup: "Pages"`, shown FIRST)
Each mirrors a real live route/screen (via `@mirrors`). Screens are self-contained
templates; they need not compose active atoms at build time.
- **App:** `DashboardScreen`→`app/intel/dashboard-hero.tsx` · `CompetitorsScreen`→`competitors-view.tsx` (REBUILT: no left rail — the gap-map matrix on top doubles as the rival selector, full-width detail below: stat strip → referrer rows → "referrers to pursue" → top pages/keywords → "their edge → your move") · `CustomersScreen`→`customers-view.tsx` · `PlanScreen`→`plan-timeline-view.tsx` · `ProgressScreen`→`progress-view.tsx` · `SettingsScreen`→`app/captured/settings-main.tsx` · `OnboardingScreen`→`app/setup/setup-overlay.tsx`
- **Report / flow:** `ResultsScreen`→`report/captured/results-screen.tsx` · `ScanningScreen`→`scan/captured-scanning.tsx`
- **Marketing:** `LandingScreen`→`sections/captured/landing-screen.tsx` · `PricingScreen`→`sections/captured/pricing-screen.tsx` · `GalleryScreen` · `TeardownsScreen` · `CompareScreen` · `AboutScreen` · `ContactScreen` · `ToolsScreen` · `RoadmapScreen` · `StatusScreen` · `LegalScreen` — each `@mirrors` its `app/(marketing)/*` route.

## Archive (17) — retained, not deleted; grouped "Archive" in the pane (shown LAST)
Archived because the live counterpart is not reachable from any real page (the
marketing/report surfaces ship as captured page snapshots, so these granular
atoms are dead). Exempt from `@mirrors` enforcement.

| Component | Why archived |
|---|---|
| Testimonial | Superseded by the active `Testimonials` landing section (the live logo ticker is `company-ticker.tsx`; this single-quote card is unused). |
| Alert | No live standalone `Alert` component. |
| Tabs | No live standalone `Tabs` component. |
| ScoreGauge | `report/score-gauge.tsx` not reachable (superseded by captured results-screen). |
| ScoreCard | `report/executive-summary.tsx` not reachable. |
| RankedFix | `report/action-plan-section.tsx` not reachable. |
| PositioningMirror | `report/what-you-offer-section.tsx` not reachable. |
| SearchGapTable | `report/keyword-gap-table.tsx` not reachable. |
| ComparisonTable | `sections/comparison-table.tsx` orphaned. |
| PricingTable | `sections/pricing-table.tsx` only via unused `pricing-plans.tsx`. |
| FaqItem | `sections/faq.tsx` orphaned. |
| FeatureStep | `sections/how-it-works-scroll.tsx` orphaned. |
| ChannelDonut | `charts/donut-chart.tsx` not reachable. |
| ProgressChart | `charts/score-history-chart.tsx` not reachable. |
| CompareCard | No live counterpart at all. |
| TeardownCard | `sections/teardown-grid.tsx` not reachable (hub renders inline). |

## Convergence backlog (live components with no mirror)
`pnpm check:design` warns on these. Under reality-first they are acceptable for
now; closing the gap (either mirroring them or, better, decomposing the captured
snapshots into real shared components so pages are truly component-composed) is
the forward path. Do NOT un-archive a component without giving it a resolving
`@mirrors` to a reachable live file.

## The build regenerates `_ds_manifest.json`
`layout.mjs` copies `.design-sync/tokens.css` → `ds-bundle/tokens/tokens.css`,
writes `_ds_manifest.json` (the card index) from `META` + tokens on every build.
Full rebuild = `build.mjs` → `layout.mjs`; upload the changed component dirs +
`_ds_manifest.json` + `_ds_sync.json` (sentinel LAST — it re-arms the pane's
re-index). If the pane looks stale, the manifest or sentinel wasn't re-uploaded.

## How to archive / un-archive (delete-free)
In `layout.mjs`'s `META`, add `archived: true` to a component's entry (keep its
real `group`). Rebuild — the files stay at `components/<group>/…`, only the
`@dsCard` marker flips to "Archive". Remove the flag to restore it — but then it
becomes active and MUST have a resolving `@mirrors` tag or `check:design` fails.
NEVER `delete_files` to archive.
