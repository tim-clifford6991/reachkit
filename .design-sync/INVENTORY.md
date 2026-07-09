# ReachKit Design System — component inventory

The 33 hand-authored `ds-src` components and the LIVE app surface each mirrors.
Keep this current when a component is added, retired, or its live counterpart
changes — it's the map that keeps the design system aligned with the product.
Groups map to the Claude Design pane's `@dsCard group=` sections (set in
`layout.mjs`'s `META`). Verified against the app 2026-07-09.

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

## Archive (1) — retained, not deleted, grouped "Archive" in the pane
| Component | Why archived |
|---|---|
| Testimonial | The live product uses a **logo ticker** (`company-ticker.tsx`), not written customer quotes — no live testimonial surface. Files stay at `components/Marketing/Testimonial/`; only the `@dsCard` marker is "Archive" (set via `archived: true` in `layout.mjs`, so no delete and it survives rebuilds). Kept for future reuse.

## How to archive / un-archive (delete-free)
In `layout.mjs`'s `META`, add `archived: true` to a component's entry (keep its real
`group`). Rebuild — the files stay at their `components/<group>/…` path, only the
`@dsCard` marker flips to "Archive". Remove the flag to restore it to its group.
NEVER `delete_files` to archive.
