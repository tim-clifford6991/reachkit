# ReachKit Design System — component inventory

The 33 hand-authored `ds-src` components and the LIVE app surface each mirrors.
Keep this current when a component is added, retired, or its live counterpart
changes — it's the map that keeps the design system aligned with the product.
Groups map to the Claude Design pane's `@dsCard group=` sections (set in
`layout.mjs`'s `META`). Verified against the app 2026-07-09.

> **Machine-checked mirror tags.** A `ds-src` file can carry a `/* @mirrors <live-path> */`
> tag naming its live counterpart; `pnpm check:design` fails if that path stops
> resolving (and warns on live components with no mirror). This table stays the
> human-readable view; the tags are the enforced source. Add a tag when you add a
> component. See CLAUDE.md → "Consistency harness".

## Foundations (6) — primitives, used everywhere
| Component | Mirrors (live) |
|---|---|
| Alert | scan/status notices |
| Badge | score-band + tone chips (`components/app/intel/kit.tsx`) |
| BrandMark | the violet reach tile (nav, footer, app shell) |
| Button | primary / secondary / ghost actions |
| Tabs | Audience tab switcher |
| TextField | form inputs (settings, auth) |

## Report (7) — the free-scan report / results surfaces
| Component | Mirrors (live) |
|---|---|
| ScoreGauge | the 270° discoverability gauge (dashboard + results) |
| ScoreCard | results hero (gauge + pillars) |
| RankedFix | a ranked action-fix card |
| PositioningMirror | "What you offer" you-think vs page-reads panels |
| SearchGapTable | "Keyword gap" card |
| UnlockBand | free→paid unlock banner (`entitlements` redaction) |
| ResultsScreen | the composed `/scan/[id]` public report |

## App (9) — the in-app workspace
| Component | Mirrors (live) |
|---|---|
| AppShell | `components/app/captured/app-shell.tsx` sidebar chrome |
| DashboardScreen | `dashboard-hero.tsx` — **v4**: on-site readiness gauge + Market Position + on-site pillars |
| ScoreGauge/CompetitorEdgePanel | dashboard "You vs competitors" |
| ChannelDonut | "Traffic by channel" |
| KpiCard | dashboard metric tiles |
| LeverBanner | weakest-pillar lever callout |
| PlanItemCard | `plan-entry-card.tsx` weekly action item |
| ProgressChart | `/app/progress` score-over-time |
| ScanningRing | scan-in-progress ring |

## Marketing (10 active) — the marketing site
| Component | Mirrors (live) |
|---|---|
| LandingHero | `scan-hero.tsx` radial-fade hero |
| NavBar | `marketing-nav.tsx` |
| Footer | `footer.tsx` |
| ScanInput | the "Analyze my site" pill |
| ComparisonTable | landing feature matrix |
| PricingTable | `pricing-table.tsx` |
| FaqItem | `faq.tsx` |
| FeatureStep | `how-it-works-scroll.tsx` numbered steps (01/02/03) |
| CompareCard | `/compare` hub index card |
| TeardownCard | `/teardowns` hub index card |

## Archive (4) — retained, not deleted, grouped "Archive" in the pane (shown LAST)
**Rule (2026-07-09): a component is active only if a Page template composes it.** The 11 Pages use
exactly 25 atomic components (see the union below); anything else is archived (delete-free — files
stay at their folder, only the `@dsCard` marker + manifest group flip to "Archive" via `archived: true`).

| Component | Why archived (not used by any Page) |
|---|---|
| Testimonial | Live product uses a logo ticker, not written quotes. |
| Alert | No Page composes it. |
| Tabs | No Page composes it. |
| LandingHero | `LandingScreen` composes its split hero inline from `ScanInput`; this single-column hero is unused. |

**25 active atomic components** (the exact union used by the 11 Pages): AppShell, Badge, BrandMark,
Button, ChannelDonut, ComparisonTable, CompetitorEdgePanel, FaqItem, FeatureStep, Footer, KpiCard,
LeverBanner, NavBar, PlanItemCard, PositioningMirror, PricingTable, ProgressChart, RankedFix,
ScanInput, ScanningRing, ScoreCard, ScoreGauge, SearchGapTable, TextField, UnlockBand.

## Pages (20) — full-page screen templates, grouped "Pages" in the pane (shown FIRST in the pane; Archive shows LAST — ordered via GROUP_ORDER in layout.mjs)
Compose the components above into a whole page (like the reference `templates/analytics-dashboard`).
Folders stay in their functional group; `cardGroup: "Pages"` in `layout.mjs` puts them in the Pages
pane section.
- **App:** `DashboardScreen` (v4) · `CompetitorsScreen` · `CustomersScreen` · `PlanScreen` ·
  `ProgressScreen` · `SettingsScreen` · `OnboardingScreen` (setup overlay)
- **Report/flow:** `ResultsScreen` (free report) · `ScanningScreen` (scan-in-progress)
- **Marketing:** `LandingScreen` (mirrors the live split-hero + ticker + sections) · `PricingScreen`

- **Public:** `LandingScreen` · `PricingScreen` · `GalleryScreen` · `TeardownsScreen` (uses TeardownCard) · `CompareScreen` (uses CompareCard) · `AboutScreen` · `ContactScreen` · `ToolsScreen` · `RoadmapScreen` · `StatusScreen` · `LegalScreen` (privacy/terms template)

All app + public pages are now templated.

> The `templates/analytics-dashboard` **template** (Design Composer `.dc.html`) is a separate,
> RETAINED reference — never delete it; it's a component source.

## The build regenerates `_ds_manifest.json`
`layout.mjs` writes `_ds_manifest.json` (the card index the Design pane reads) from `META` +
`tokens.css` on every build — so a direct `DesignSync` upload is never stale. Full rebuild =
`build.mjs` → `layout.mjs`; upload the changed component dirs + `_ds_manifest.json` + `_ds_sync.json`
(sentinel LAST — it re-arms the pane's re-index). If the pane looks stale, the manifest or sentinel
wasn't re-uploaded.

## How to archive / un-archive (delete-free)
In `layout.mjs`'s `META`, add `archived: true` to a component's entry (keep its real
`group`). Rebuild — the files stay at their `components/<group>/…` path, only the
`@dsCard` marker flips to "Archive". Remove the flag to restore it to its group.
NEVER `delete_files` to archive.
