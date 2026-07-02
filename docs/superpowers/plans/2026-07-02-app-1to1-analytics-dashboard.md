# Plan: App → 1:1 with the Claude Design "Analytics Dashboard" template (Full IA match)

**Goal:** Restructure the in-app dashboard so its navigation, views, and components are 1:1 with the Claude Design template: **Dashboard · Audience[Competitors, Customers] · Plan[Content, Distribution] · Progress · Settings**.

**Approach:** Full IA match (user-chosen). Adopt the template's grouped nav + view split, remapping existing data layers; add a new Progress view. Reuse the existing intel kit (`components/app/intel/kit.tsx`, `--c-*` idiom) and data (`useIntel` layers, scan reads) — no new API/gatherer. Build on a branch, verify visually, PR, merge, deploy.

## Global constraints
- **RSC discipline (the bandFor lesson):** server components import helpers from server-safe modules (`@/components/app/intel/bands`, `@/lib/scan/*`), NEVER from the `"use client"` kit. Client-only interactive views stay `"use client"`.
- Intel-kit `--c-*` inline-style idiom only (no Tailwind/`--color-*`/recharts in these views).
- Reuse existing data adapters (`useIntel("supply"|"demand"|"synthesis")`, `resolveIntelContext`, `engagementSummary`, `scoreHistoryMarkers`). No new gatherers.
- Preserve auth/onboarding gating via `resolveIntelContext`.

## URL scheme (default — confirm)
Grouped, matching the nav:
- `/app/dashboard` (exists) · `/app/audience/competitors` · `/app/audience/customers` · `/app/plan/content` · `/app/plan/distribution` · `/app/progress` · `/app/settings` (exists)
- **Redirects** (keep old links working): `/app/supply → /app/audience/competitors`, `/app/demand → /app/audience/customers`, `/app/synthesis → /app/plan/content`, `/app/plans → /app/plan/content`.

## Verification strategy (no auth/cost needed)
The prod account (nudgi.ai) is empty (no competitors, score 0), so live views show setup/empty states. Use the existing **`/test-*` routes** (`test-funnel`, `test-demand`, `test-synthesis`, `test-keywords`, `test-competitors`) which render intel views with **fixture data, no auth** — extend them (or add `/test-*` pages) to render each NEW view populated, and compare 1:1 to the template in the browser. Final live check on prod after populating a real account (optional).

---

## Phase 1 — Nav + routing skeleton (the IA)
**Files:** `components/app/captured/app-shell.tsx` (grouped nav), new `page.tsx` under `app/(app)/app/audience/{competitors,customers}/`, `app/(app)/app/plan/{content,distribution}/`, `app/(app)/app/progress/`; redirects in old route files; `app/(app)/app/page.tsx` stays `→ /app/dashboard`.
- Rebuild `NAV` into a grouped structure: top-level items (Dashboard, Progress, Settings) + expandable groups (Audience → Competitors, Customers; Plan → Content, Distribution) with carets, matching the template's sidebar. Active state highlights the item + its parent group (reference the DS `AppShell.tsx` grouped-nav pattern). Add TITLES/DESCRIPTIONS for the new routes.
- New route pages initially render the existing view components at their new URLs (thin move), so nav + routing work before the view rebuilds.
- Old routes `redirect()` to new URLs.
- **Verify:** nav renders grouped with working active state; every new URL resolves; old URLs redirect.

## Phase 2 — Audience views
**Competitors** (`components/app/intel/competitors-view.tsx`) — ranked competitor rows with pillar-health dots + a selected-competitor **edge panel** (top referrers/pages/keywords, "their edge → your move"). Data: `useIntel("supply")` (`funnel.competitors`, `keyActions`, referral breakdown). Reuse kit `HBars`/`Bar`/`Card`/`Badge`.
**Customers** (`components/app/intel/customers-view.tsx`) — ICP, jobs-to-be-done, use cases, demand themes, communities, buyer insights. Data: `useIntel("demand")` (`icp`, `searchDemand.themes`, `community.pockets`, `buyerInsights`).
- **Verify:** each view via a fixture `/test-*` route in the browser, matched to the template's Competitors/Customers sections.

## Phase 3 — Plan views
**Content plan** (`content-plan-view.tsx`) — content plan item cards (topic/format/why/volume/provenance). Data: `useIntel("synthesis")` `contentPlan`.
**Distribution plan** (`distribution-plan-view.tsx`) — distribution item cards (channel/action/ease/impact/why). Data: `synthesis.distributionPlan`.
- Plan header progress strip (done/total/pct) from the actions board where available.
- **Verify:** fixture routes vs template Plan views.

## Phase 4 — Progress view (NEW)
`progress-view.tsx` + server data on `app/(app)/app/progress/page.tsx`: score-over-time chart (kit-idiom SVG, pillar series + verified-fix markers) + "what changed" events. Data: `engagementSummary` (history) + `scoreHistoryMarkers` + `market_snapshots`/`computeMarketAlerts`. Server component imports `bandFor` from `bands` (RSC rule).
- **Verify:** fixture/populated route vs template Progress view.

## Phase 5 — Dashboard fidelity + full 1:1 sweep
- Refine the Dashboard home to match the template exactly (spacing, the empty-state copy noted earlier).
- Full browser sweep of every view against the template; fix gaps.
- Optional: populate a real account (select competitors) for a live prod 1:1 check.

## Rollout
Each phase = its own commit; the whole feature = one PR → review → merge → prod. Verify `/app/dashboard` renders authed on the deploy (the RSC runtime gate) before closing.
