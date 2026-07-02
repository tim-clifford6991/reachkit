# Align Design System to Analytics Dashboard Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Analytics Dashboard template's building blocks into canonical, reusable `ds-src` components and reconcile the overlapping existing ones so the design system is visually identical to the template.

**Architecture:** Each component is a standalone prop-driven React function in `.design-sync/ds-src/<Name>.tsx`, styled with inline styles reading `--c-*` CSS token vars (the established `ds-src` idiom — no CSS files, no Tailwind, no client state). Components are wired into the bundle (`index.tsx` + `build.mjs` exportsList) and the preview pipeline (`layout.mjs` META), then re-synced to the Claude Design project. Preview cards are static-prerendered (no client script).

**Tech Stack:** React 19 (presentational, inline styles), esbuild (bundle + prerender), `react-dom/server` (static prerender), the `/design-sync` DesignSync tool for upload.

## Global Constraints

- **Idiom (verbatim):** every component is a prop-driven function styled with inline styles reading `var(--c-*)` tokens; NO CSS files, NO Tailwind, NO `useState`/interactivity. Match the existing `ds-src/*.tsx` files exactly.
- **Every component MUST have:** a leading `/** … */` JSDoc summary line and an `export interface <Name>Props { … }`.
- **Adding a component = update FOUR places:** `ds-src/<Name>.tsx` (create), `ds-src/index.tsx` (add `export`), `ds-src/build.mjs` (add name to `exportsList`), `ds-src/layout.mjs` (add `META` entry, group `"App"`, with a JSON-literal sample `render`).
- **Fonts/colors ONLY from tokens:** `--c-bg`, `--c-bg2`, `--c-surface`, `--c-ink`, `--c-muted`, `--c-faint`, `--c-line`, `--c-fill`, `--c-action`, `--c-soft`, `--c-on-dark`, `--c-tint-{violet|orange|green|amber|red|blue}(-line)`, `--c-band-{invisible|hard|fair|findable|high}`, `--font-{display|sans|mono}`, `--radius-{sm|md|lg|xl|full}`. Verify names against `ds-bundle/tokens/tokens.css`.
- **Scope:** design system only. Do NOT edit `components/app/**` or `components/report/**`.
- **Upload guardrails (from `.design-sync/NOTES.md`):** hand-authored project, no `resync.mjs`. `finalize_plan` writes scoped to the managed set only (`components/**`, `tokens/**`, `styles.css`, `_ds_bundle.js`, `_ds_bundle.css`, `_ds_sync.json`, `_ds_needs_recompile`); deletes `[]`. NEVER touch `templates/analytics-dashboard/**`, `motion/`, `scraps/`, `screenshots/`, `uploads/`, promo HTMLs, `README.md`.

## Verification model (read before Task 1)

These are token-styled **presentational** components with no logic to unit-test and no test runner wired to `ds-src`. The per-component test cycle is therefore:

1. **Mechanical gate:** run `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs`. The prerender must finish with `static prerender: all N components rendered ✓` (no failures listed). A component that throws in `renderToStaticMarkup` is a hard failure.
2. **Fidelity gate:** serve `ds-bundle/` and open the component's card in a browser; compare to the corresponding template block screenshot. Refine geometry/spacing/color until visually indistinguishable at the sample props.
3. **Regression gate (reconcile tasks only):** confirm the internal consumers listed in the task still prerender (they're in the same `all N rendered ✓` line) and still look correct in their cards.

The representative code in each task is real and runnable — it establishes structure and the correct token idiom. The fidelity gate (step 2) is the acceptance criterion; treat the template block as the source of truth and refine the representative code to match it.

## File Structure

```
.design-sync/ds-src/
  build.mjs            MODIFY  — add new names to exportsList; generate _ds_sync.json
  index.tsx            MODIFY  — export the 5 new components
  layout.mjs           MODIFY  — add META entries for the 5 new components
  ScoreGauge.tsx       MODIFY  — reconcile to template gauge
  KpiCard.tsx          MODIFY  — reconcile to template KPI tile
  AppShell.tsx         MODIFY  — reconcile nav to template
  SearchGapTable.tsx   MODIFY  — reconcile to template keyword-gap table
  DashboardScreen.tsx  MODIFY  — rebuild as the template Dashboard composition
  ChannelDonut.tsx     CREATE
  CompetitorEdgePanel.tsx CREATE
  PlanItemCard.tsx     CREATE
  LeverBanner.tsx      CREATE
  ProgressChart.tsx    CREATE
  .reference/AnalyticsDashboard.dc.html  CREATE (gitignored ref, Task 1)
docs/superpowers/specs/2026-07-02-ds-align-analytics-dashboard-design.md  (the spec)
```

---

### Task 1: Pipeline prep — reference file + `_ds_sync.json` generation

**Files:**
- Create: `.design-sync/ds-src/.reference/AnalyticsDashboard.dc.html` (local template reference)
- Modify: `.design-sync/ds-src/build.mjs` (generate `_ds_sync.json` from `exportsList`)
- Modify: `.gitignore` (ignore `.design-sync/ds-src/.reference/`)

**Interfaces:**
- Produces: a committed `build.mjs` that writes `ds-bundle/_ds_sync.json` = `{"shape":"package-handauthored","global":"ReachKitDS","exports":[…exportsList…]}` on every build, so the anchor never drifts. All later tasks rely on this to keep the anchor correct when they add exports.

- [ ] **Step 1: Save the template reference locally** (so component tasks can read exact markup)

Run:
```bash
mkdir -p .design-sync/ds-src/.reference
```
Then fetch the template via the DesignSync tool and write it to `.design-sync/ds-src/.reference/AnalyticsDashboard.dc.html`:
`DesignSync(get_file, projectId:"819c77dc-3b5b-42e1-a065-315f28ee4f0b", path:"templates/analytics-dashboard/AnalyticsDashboard.dc.html")` → save the returned `content` to that file.

- [ ] **Step 2: Gitignore the reference dir**

Add to `.gitignore`:
```
.design-sync/ds-src/.reference/
```

- [ ] **Step 3: Make build.mjs emit `_ds_sync.json`**

In `.design-sync/ds-src/build.mjs`, after the line that writes `_ds_bundle.css` (currently the `writeFileSync(resolve(out, "_ds_bundle.css"), …)` call), add:
```js
// Emit the sync anchor from the same exportsList so it never drifts by hand.
writeFileSync(
  resolve(out, "_ds_sync.json"),
  JSON.stringify({ shape: "package-handauthored", global: GLOBAL, exports: exportsList }, null, 2) + "\n"
);
```

- [ ] **Step 4: Rebuild and verify the anchor matches**

Run:
```bash
cd .design-sync/ds-src && node build.mjs && node -e "const a=require('../../ds-bundle/_ds_sync.json');console.log(a.shape, a.exports.length)"
```
Expected: `package-handauthored 28`

- [ ] **Step 5: Commit**

```bash
git add .design-sync/ds-src/build.mjs .gitignore
git commit -m "chore(design-sync): generate _ds_sync.json from build; add template reference"
```

---

### Task 2: Reconcile `ScoreGauge` to the template gauge

**Files:**
- Modify: `.design-sync/ds-src/ScoreGauge.tsx`
- Reference: `.design-sync/ds-src/.reference/AnalyticsDashboard.dc.html` (search `gaugeBigFill`, `gaugeBigTrack`, `scoreColorCss`, `scoreBandLabel`)
- Consumers to keep rendering: `ScoreCard.tsx` (report, out of scope but must not break)

**Interfaces:**
- Produces: `ScoreGauge(props: ScoreGaugeProps)` where `ScoreGaugeProps = { score: number; size?: number; band?: string; showLabel?: boolean }`. Keep existing prop names; only ADD optional props. `DashboardScreen` (Task 11) consumes this.

- [ ] **Step 1: Read the template gauge block** in the reference file (the big score arc: `gaugeBigFill`/`gaugeBigTrack` path, the numeric center, `scoreBandLabel`, and `scoreColorCss` band color). Note arc sweep, stroke widths, center typography (`--font-mono` for the number).

- [ ] **Step 2: Read the current component**

Run: `cat .design-sync/ds-src/ScoreGauge.tsx` — note current props and SVG.

- [ ] **Step 3: Edit `ScoreGauge.tsx`** to match the template arc: same sweep/geometry, band color driven by score via `--c-band-*` tokens, big mono number + `/100` + band label centered. Keep `score`/`size` prop names. Follow the inline-style + token idiom exactly.

- [ ] **Step 4: Mechanical gate**

Run: `cd .design-sync/ds-src && node build.mjs && node layout.mjs`
Expected: ends with `static prerender: all 28 components rendered ✓`

- [ ] **Step 5: Fidelity + regression check**

Serve and open both `components/Report/ScoreGauge/ScoreGauge.html` and `components/Report/ScoreCard/ScoreCard.html`:
```bash
cd ds-bundle && python3 -m http.server 8810   # background; stop after
```
Open in a browser. ScoreGauge must match the template gauge; ScoreCard must still render correctly (regression).

- [ ] **Step 6: Commit**

```bash
git add .design-sync/ds-src/ScoreGauge.tsx
git commit -m "feat(design-sync): reconcile ScoreGauge to Analytics Dashboard template"
```

---

### Task 3: Reconcile `KpiCard` to the template KPI tile

**Files:**
- Modify: `.design-sync/ds-src/KpiCard.tsx`
- Reference: template blocks "Est. visits / mo" (`1.86k`), "Referring domains" (`42`)
- Consumers: `DashboardScreen.tsx` (rebuilt in Task 11)

**Interfaces:**
- Produces: `KpiCard(props: KpiCardProps)` where `KpiCardProps = { label: string; value: string; delta?: string; sub?: string }`. Keep existing names; add optional `sub`.

- [ ] **Step 1:** Read the template KPI tile markup (uppercase `--c-faint` label, large `--font-mono` value, optional delta chip, hairline border `--c-line`, `--radius-lg`).
- [ ] **Step 2:** `cat .design-sync/ds-src/KpiCard.tsx`.
- [ ] **Step 3:** Edit to match the tile chrome exactly (border, radius, padding, label/value/delta typography from tokens).
- [ ] **Step 4:** Mechanical gate — `node build.mjs && node layout.mjs` → `all 28 … ✓`.
- [ ] **Step 5:** Serve + open `components/App/KpiCard/KpiCard.html`; compare to template tiles.
- [ ] **Step 6:** Commit — `git commit -m "feat(design-sync): reconcile KpiCard to template KPI tile"`.

---

### Task 4: Reconcile `AppShell` nav to the template

**Files:**
- Modify: `.design-sync/ds-src/AppShell.tsx`
- Reference: template sidebar (`navDashboard`, `navAudComp`, `navAudCust`, `navPlanContent`, `navPlanDist`, `navProgress`/`navHistory`, `navSettings`; grouped headers "Audience" & "Plan"; user footer "Nadia L. · nudgi.ai · solo founder"; topbar "Re-scan now")
- Consumers: `DashboardScreen.tsx` (rebuilt in Task 11)

**Interfaces:**
- Produces: `AppShell(props: AppShellProps)` where `AppShellProps = { active?: string; user?: {name:string; sub:string}; headerTitle?: string; headerSub?: string; children?: React.ReactNode }`. Nav structure (Dashboard; Audience[Competitors, Customers]; Plan[Content, Distribution]; Progress; Settings) is fixed internally to match the template; `active` selects the highlighted item by key. `DashboardScreen` consumes this as the chrome wrapper.

- [ ] **Step 1:** Read the template sidebar + topbar markup: nav groups, icons, active-pill styling (`--c-soft`/`--c-action`), user footer, header title/sub, "Re-scan now" button.
- [ ] **Step 2:** `cat .design-sync/ds-src/AppShell.tsx` — note current nav items and props.
- [ ] **Step 3:** Edit `AppShell.tsx` so the nav exactly matches the template groups/items/labels and the user footer + topbar. Presentational only (no click state); `active` prop drives the highlight.
- [ ] **Step 4:** Mechanical gate — `node build.mjs && node layout.mjs` → `all 28 … ✓`.
- [ ] **Step 5:** Serve + open `components/App/AppShell/AppShell.html`; compare nav/topbar/footer to template.
- [ ] **Step 6:** Commit — `git commit -m "feat(design-sync): reconcile AppShell nav to template"`.

---

### Task 5: Reconcile `SearchGapTable` to the template keyword gap

**Files:**
- Modify: `.design-sync/ds-src/SearchGapTable.tsx`
- Reference: template "Keyword gap — high-volume terms you don't rank for yet" (`keywords`, `k.term`, `k.volLabel`, `k.inPlan`, `k.canAdd`)
- Consumers to keep rendering: `ResultsScreen.tsx` (report, out of scope but must not break)

**Interfaces:**
- Produces: `SearchGapTable(props: SearchGapTableProps)`. Inspect current props with `cat`; keep them. If the template needs an added column (e.g. `inPlan` chip), add an OPTIONAL field only.

- [ ] **Step 1:** Read the template keyword-gap block (term, volume label, "in plan"/"add" chip using `Badge` bands).
- [ ] **Step 2:** `cat .design-sync/ds-src/SearchGapTable.tsx` and `grep -n SearchGapTable .design-sync/ds-src/ResultsScreen.tsx` to see how ResultsScreen uses it.
- [ ] **Step 3:** Edit to match the template table visuals; keep the prop shape backward-compatible for ResultsScreen (optional additions only).
- [ ] **Step 4:** Mechanical gate — `node build.mjs && node layout.mjs` → `all 28 … ✓`.
- [ ] **Step 5:** Serve + open `components/Report/SearchGapTable/SearchGapTable.html` AND `components/Report/ResultsScreen/ResultsScreen.html` (regression); both must render correctly.
- [ ] **Step 6:** Commit — `git commit -m "feat(design-sync): reconcile SearchGapTable to template keyword gap"`.

---

### Task 6: New component `ChannelDonut`

**Files:**
- Create: `.design-sync/ds-src/ChannelDonut.tsx`
- Modify: `index.tsx`, `build.mjs` (exportsList), `layout.mjs` (META)
- Reference: template "Traffic by channel" donut (`donut`, `channelRows`, `c.label`, `c.pctLabel`, `c.visits`, `c.css`), center "46% Organic"

**Interfaces:**
- Produces: `ChannelDonut(props: ChannelDonutProps)` where
  `ChannelDonutProps = { segments: { label: string; pct: number; visits?: string; color?: string }[]; centerLabel?: string; size?: number }`.
  Consumed by `DashboardScreen` (Task 11).

- [ ] **Step 1: Create `ChannelDonut.tsx`** (representative, token-idiom; refine geometry to the template in Step 4):

```tsx
import * as React from "react";

/**
 * ChannelDonut — "Traffic by channel" donut: an SVG ring split into channel
 * segments with a centred percent/label, plus a legend of channels with share
 * and visits. Colours come from the channel palette (`--c-tint-*`).
 */
export interface ChannelDonutProps {
  /** Ordered channel segments; `pct` are shares that sum to ~100. */
  segments: { label: string; pct: number; visits?: string; color?: string }[];
  /** Big centred label, e.g. "46% Organic". */
  centerLabel?: string;
  /** Diameter in px. */
  size?: number;
}

const PALETTE = [
  "var(--c-tint-violet)", "var(--c-tint-blue)", "var(--c-tint-green)",
  "var(--c-tint-amber)", "var(--c-tint-orange)", "var(--c-tint-red)",
];

export function ChannelDonut({ segments, centerLabel, size = 180 }: ChannelDonutProps) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "center", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-fill)" strokeWidth={16} />
        {segments.map((s, i) => {
          const len = (s.pct / 100) * C, off = (acc / 100) * C; acc += s.pct;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color || PALETTE[i % PALETTE.length]} strokeWidth={16}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
        })}
      </svg>
      <div>
        {centerLabel && <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{centerLabel}</div>}
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color || PALETTE[i % PALETTE.length] }} />
            <span style={{ color: "var(--c-ink)" }}>{s.label}</span>
            <span style={{ color: "var(--c-faint)", marginLeft: "auto" }}>{s.pct}%{s.visits ? ` · ${s.visits}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it in.**
  - `index.tsx`: add `export { ChannelDonut } from "./ChannelDonut";`
  - `build.mjs` `exportsList`: add `"ChannelDonut"`.
  - `layout.mjs` `META`: add
    `ChannelDonut: { group: "App", render: "{centerLabel:'46% Organic',segments:[{label:'Organic',pct:46,visits:'1.86k'},{label:'Direct / brand',pct:24,visits:'970'},{label:'Referral',pct:18,visits:'720'},{label:'Social',pct:12,visits:'480'}]}" },`

- [ ] **Step 3: Mechanical gate** — `node build.mjs && node layout.mjs` → `static prerender: all 29 components rendered ✓`.

- [ ] **Step 4: Fidelity check** — serve; open `components/App/ChannelDonut/ChannelDonut.html`; refine ring/legend to match the template donut.

- [ ] **Step 5: Commit**
```bash
git add .design-sync/ds-src/ChannelDonut.tsx .design-sync/ds-src/index.tsx .design-sync/ds-src/build.mjs .design-sync/ds-src/layout.mjs
git commit -m "feat(design-sync): add ChannelDonut component from template"
```

---

### Task 7: New component `CompetitorEdgePanel`

**Files:**
- Create: `.design-sync/ds-src/CompetitorEdgePanel.tsx`
- Modify: `index.tsx`, `build.mjs`, `layout.mjs`
- Reference: template "You vs. top competitors" bars (`benchmarkRows`, `r.name`, `r.score`, `r.scoreCss`, `r.me`, `r.dots`) and "Their edge → your move" (`audSelName`, `audSelEdge`, `audSelMove`)

**Interfaces:**
- Produces: `CompetitorEdgePanel(props: CompetitorEdgePanelProps)` where
  `CompetitorEdgePanelProps = { rows: { name: string; score: number; isYou?: boolean; scoreColor?: string; dots?: string[] }[]; title?: string; variant?: "bars" | "edge"; edge?: { name: string; edge: string; move: string } }`.
  Consumed by `DashboardScreen` (Task 11, `variant:"bars"`).

- [ ] **Step 1: Create `CompetitorEdgePanel.tsx`** (representative):

```tsx
import * as React from "react";

/**
 * CompetitorEdgePanel — "You vs. top competitors": ranked horizontal score bars
 * with a highlighted YOU row and per-row pillar-health dots. The `edge` variant
 * renders the "their edge → your move" two-column callout instead.
 */
export interface CompetitorEdgePanelProps {
  rows: { name: string; score: number; isYou?: boolean; scoreColor?: string; dots?: string[] }[];
  title?: string;
  variant?: "bars" | "edge";
  edge?: { name: string; edge: string; move: string };
}

export function CompetitorEdgePanel({ rows, title = "You vs. top competitors", variant = "bars", edge }: CompetitorEdgePanelProps) {
  const wrap: React.CSSProperties = { fontFamily: "var(--font-sans)", color: "var(--c-ink)" };
  if (variant === "edge" && edge) {
    return (
      <div style={wrap}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{edge.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--c-tint-orange)", border: "1px solid var(--c-tint-orange-line)", borderRadius: "var(--radius-lg)", padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Their edge</div>
            <div style={{ fontSize: 14 }}>{edge.edge}</div>
          </div>
          <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: "var(--radius-lg)", padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Your move</div>
            <div style={{ fontSize: 14 }}>{edge.move}</div>
          </div>
        </div>
      </div>
    );
  }
  const max = Math.max(...rows.map(r => r.score), 100);
  return (
    <div style={wrap}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: "var(--radius-md)", background: r.isYou ? "var(--c-soft)" : "transparent" }}>
          <span style={{ width: 96, fontSize: 13, fontWeight: r.isYou ? 700 : 500, color: r.isYou ? "var(--c-action)" : "var(--c-ink)" }}>{r.isYou ? "YOU" : r.name}</span>
          <span style={{ flex: 1, height: 8, background: "var(--c-fill)", borderRadius: 99, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(r.score / max) * 100}%`, background: r.scoreColor || "var(--c-action)" }} />
          </span>
          {r.dots?.map((d, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: 99, background: d }} />)}
          <span style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13 }}>{r.score}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire in** — `index.tsx` export; `build.mjs` exportsList `"CompetitorEdgePanel"`; `layout.mjs` META:
  `CompetitorEdgePanel: { group: "App", render: "{title:'You vs. top competitors',rows:[{name:'YOU',score:54,isYou:true,scoreColor:'var(--c-band-fair)'},{name:'otter.ai',score:67},{name:'fireflies.ai',score:78},{name:'fathom.video',score:86}]}" },`
- [ ] **Step 3: Mechanical gate** — `node build.mjs && node layout.mjs` → `all 30 … ✓`.
- [ ] **Step 4: Fidelity check** — open `components/App/CompetitorEdgePanel/CompetitorEdgePanel.html`; refine to template bars.
- [ ] **Step 5: Commit** — `git add` the four files; `git commit -m "feat(design-sync): add CompetitorEdgePanel component from template"`.

---

### Task 8: New component `PlanItemCard`

**Files:**
- Create: `.design-sync/ds-src/PlanItemCard.tsx`
- Modify: `index.tsx`, `build.mjs`, `layout.mjs`
- Reference: template plan item (`a.title`, `a.type`, `a.why`, `a.pred`, `a.actual`, `a.hasActual`, `a.from`, `a.hasFrom`, `a.shipNote`, `a.doFirst`, `a.statusLabel`, `a.statusColorCss`)

**Interfaces:**
- Produces: `PlanItemCard(props: PlanItemCardProps)` where
  `PlanItemCardProps = { title: string; type?: string; why?: string; predictedPts?: string; actualPts?: string; from?: string; shipNote?: string; doFirst?: boolean; status?: string; statusColor?: string }`.
  Consumed by `DashboardScreen` (Task 11).

- [ ] **Step 1: Create `PlanItemCard.tsx`** (representative):

```tsx
import * as React from "react";

/**
 * PlanItemCard — a weekly action-plan item: title + type, the "why", a
 * provenance line ("from …"), predicted vs verified points, an optional
 * "Do this first" emphasis, and a status pill.
 */
export interface PlanItemCardProps {
  title: string;
  type?: string;
  why?: string;
  /** e.g. "+9 pts". */
  predictedPts?: string;
  /** verified points once shipped. */
  actualPts?: string;
  /** provenance, e.g. "Outreach gap vs fathom.video". */
  from?: string;
  shipNote?: string;
  doFirst?: boolean;
  status?: string;
  statusColor?: string;
}

export function PlanItemCard(p: PlanItemCardProps) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", border: `1px solid ${p.doFirst ? "var(--c-action)" : "var(--c-line)"}`, borderRadius: "var(--radius-lg)", padding: 16, background: "var(--c-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {p.doFirst && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-action)", textTransform: "uppercase", letterSpacing: ".04em" }}>Do this first</span>}
        {p.type && <span style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{p.type}</span>}
        {p.status && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--c-on-dark)", background: p.statusColor || "var(--c-action)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{p.status}</span>}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
      {p.why && <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 8 }}>{p.why}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--c-faint)" }}>
        {p.from && <span>from {p.from}</span>}
        {p.predictedPts && <span style={{ color: "var(--c-action)", fontFamily: "var(--font-mono)" }}>{p.predictedPts} predicted</span>}
        {p.actualPts && <span style={{ color: "var(--c-band-high)", fontFamily: "var(--font-mono)" }}>{p.actualPts} verified</span>}
      </div>
      {p.shipNote && <div style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-line)" }}>{p.shipNote}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Wire in** — export; exportsList `"PlanItemCard"`; META:
  `PlanItemCard: { group: "App", render: "{doFirst:true,type:'Outreach',title:'Guest post on 3 podcast-tool roundups',why:'Closes the referral gap vs fathom.video',from:'Outreach pillar · weakest lever',predictedPts:'+9 pts',status:'This week',statusColor:'var(--c-action)'}" },`
- [ ] **Step 3: Mechanical gate** — `all 31 … ✓`.
- [ ] **Step 4: Fidelity check** — `components/App/PlanItemCard/PlanItemCard.html` vs template.
- [ ] **Step 5: Commit** — `git commit -m "feat(design-sync): add PlanItemCard component from template"`.

---

### Task 9: New component `LeverBanner`

**Files:**
- Create: `.design-sync/ds-src/LeverBanner.tsx`
- Modify: `index.tsx`, `build.mjs`, `layout.mjs`
- Reference: template lever callout (`leverPillar`, `leverNote`, `leverPts`, "See your plan")

**Interfaces:**
- Produces: `LeverBanner(props: LeverBannerProps)` where
  `LeverBannerProps = { pillar: string; note: string; points?: string; ctaLabel?: string }`.
  Consumed by `DashboardScreen` (Task 11).

- [ ] **Step 1: Create `LeverBanner.tsx`** (representative):

```tsx
import * as React from "react";

/**
 * LeverBanner — the weakest-pillar lever callout: a tinted strip naming the
 * weakest pillar, the one-line rationale, the points on offer, and a CTA link
 * to the plan. Not to be confused with the report's UnlockBand.
 */
export interface LeverBannerProps {
  /** Weakest pillar, e.g. "Outreach". */
  pillar: string;
  /** One-line rationale. */
  note: string;
  /** Points on offer, e.g. "+9 pts". */
  points?: string;
  ctaLabel?: string;
}

export function LeverBanner({ pillar, note, points, ctaLabel = "See your plan" }: LeverBannerProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-sans)", color: "var(--c-ink)", background: "var(--c-tint-amber)", border: "1px solid var(--c-tint-amber-line)", borderRadius: "var(--radius-lg)", padding: "12px 16px" }}>
      <span style={{ fontSize: 18 }}>⚡</span>
      <div style={{ fontSize: 14, flex: 1 }}>
        <strong>{pillar} is your weakest pillar</strong> — {note}
        {points && <span style={{ color: "var(--c-action)", fontFamily: "var(--font-mono)", fontWeight: 700 }}> {points}</span>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", whiteSpace: "nowrap" }}>{ctaLabel} →</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire in** — export; exportsList `"LeverBanner"`; META:
  `LeverBanner: { group: "App", render: "{pillar:'Outreach',note:'closing the referral & directory gaps is worth the most right now',points:'+9 pts'}" },`
- [ ] **Step 3: Mechanical gate** — `all 32 … ✓`.
- [ ] **Step 4: Fidelity check** — `components/App/LeverBanner/LeverBanner.html` vs template.
- [ ] **Step 5: Commit** — `git commit -m "feat(design-sync): add LeverBanner component from template"`.

---

### Task 10: New component `ProgressChart`

**Files:**
- Create: `.design-sync/ds-src/ProgressChart.tsx`
- Modify: `index.tsx`, `build.mjs`, `layout.mjs`
- Reference: template "Discoverability over time" (`scoreLine`, `scoreArea`, `markers`, `m.x`, `m.y`, `m.wk`, events `e.wk`, `e.d`, `e.text`, "Week 1 · 38", "Week 8 · 54", "dots = a fix shipped")

**Interfaces:**
- Produces: `ProgressChart(props: ProgressChartProps)` where
  `ProgressChartProps = { points: { x: number; y: number }[]; markers?: { wk: string; score: number; x: number; y: number }[]; events?: { wk: string; date: string; text: string }[]; width?: number; height?: number }`.
  `x` is 0–1 (fraction of width), `y` is the score 0–100. Consumed by `DashboardScreen` (Task 11).

- [ ] **Step 1: Create `ProgressChart.tsx`** (representative):

```tsx
import * as React from "react";

/**
 * ProgressChart — "Discoverability over time": a tokenised score line/area over
 * weeks with fix-ship dots at score milestones and an optional events list
 * ("what changed"). x is a 0–1 fraction of width; y is a 0–100 score.
 */
export interface ProgressChartProps {
  points: { x: number; y: number }[];
  markers?: { wk: string; score: number; x: number; y: number }[];
  events?: { wk: string; date: string; text: string }[];
  width?: number;
  height?: number;
}

export function ProgressChart({ points, markers = [], events = [], width = 460, height = 160 }: ProgressChartProps) {
  const px = (x: number) => x * width;
  const py = (y: number) => height - (y / 100) * height;
  const line = points.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={area} fill="var(--c-soft)" />
        <path d={line} fill="none" stroke="var(--c-action)" strokeWidth={2.5} />
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={px(m.x)} cy={py(m.score)} r={4} fill="var(--c-action)" stroke="var(--c-bg)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-faint)", marginTop: 4 }}>
        {markers.map((m, i) => <span key={i} style={{ fontFamily: "var(--font-mono)" }}>{m.wk} · {m.score}</span>)}
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--c-line)", paddingTop: 10 }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: "var(--c-faint)", fontFamily: "var(--font-mono)", minWidth: 56 }}>{e.wk}</span>
              <span style={{ color: "var(--c-muted)" }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire in** — export; exportsList `"ProgressChart"`; META:
  `ProgressChart: { group: "App", render: "{points:[{x:0,y:38},{x:0.33,y:44},{x:0.66,y:49},{x:1,y:54}],markers:[{wk:'Week 1',score:38,x:0,y:38},{wk:'Week 8',score:54,x:1,y:54}],events:[{wk:'Week 3',date:'',text:'Shipped 3 podcast guest posts'},{wk:'Week 6',date:'',text:'Added comparison landing pages'}]}" },`
- [ ] **Step 3: Mechanical gate** — `all 33 … ✓`.
- [ ] **Step 4: Fidelity check** — `components/App/ProgressChart/ProgressChart.html` vs template.
- [ ] **Step 5: Commit** — `git commit -m "feat(design-sync): add ProgressChart component from template"`.

---

### Task 11: Rebuild `DashboardScreen` as the template Dashboard composition

**Files:**
- Modify: `.design-sync/ds-src/DashboardScreen.tsx`
- Reference: template Dashboard view (the default `showDash` view)

**Interfaces:**
- Consumes: `AppShell` (Task 4), `ScoreGauge` (Task 2), `CompetitorEdgePanel` (Task 7, `variant:"bars"`), `ChannelDonut` (Task 6), `KpiCard` (Task 3), `SearchGapTable` (Task 5), `LeverBanner` (Task 9). Import each from its own module (e.g. `import { ChannelDonut } from "./ChannelDonut";`) — NOT from `index`.
- Produces: `DashboardScreen(props?: DashboardScreenProps)`. Self-contained default props (a realistic canned dashboard) so the preview renders with `render: "{}"`.

- [ ] **Step 1:** Read the template Dashboard view layout (grid: score gauge + competitor bars top row; traffic donut + KPI tiles; lever banner; keyword gap) in the reference file.
- [ ] **Step 2:** `cat .design-sync/ds-src/DashboardScreen.tsx` — note current composition + props.
- [ ] **Step 3:** Rewrite `DashboardScreen.tsx` to wrap the pieces in `AppShell` (active="Dashboard") and lay them out to mirror the template Dashboard grid, using realistic canned default props (reuse the sample data from the META entries above). Import each child from `./<Name>`.
- [ ] **Step 4:** Mechanical gate — `node build.mjs && node layout.mjs` → `static prerender: all 33 components rendered ✓`.
- [ ] **Step 5:** Fidelity check — serve; open `components/App/DashboardScreen/DashboardScreen.html`; compare the whole composition to the template Dashboard view. Refine layout until it mirrors it.
- [ ] **Step 6:** Commit — `git commit -m "feat(design-sync): rebuild DashboardScreen to mirror Analytics Dashboard template"`.

---

### Task 12: Full rebuild, prerender sweep, and re-sync upload

**Files:** none (build + upload only)

- [ ] **Step 1: Clean rebuild + prerender**

Run:
```bash
cd .design-sync/ds-src && node build.mjs && node layout.mjs
```
Expected: bundle builds; `static prerender: all 33 components rendered ✓` (zero failures). Confirm `../../ds-bundle/_ds_sync.json` lists all 33 exports.

- [ ] **Step 2: Visual sweep**

Serve `ds-bundle/` and open the 5 new cards + the 5 reconciled/rebuilt cards + the two regression cards (`ScoreCard`, `ResultsScreen`). All render; new/changed ones match the template; regressions look correct.
```bash
cd ds-bundle && python3 -m http.server 8811   # background; stop when done
```

- [ ] **Step 3: Re-sync — finalize plan (guardrails)**

`DesignSync(finalize_plan, projectId:"819c77dc-3b5b-42e1-a065-315f28ee4f0b", localDir:"<abs>/ds-bundle", writes:["components/**","tokens/**","styles.css","_ds_bundle.js","_ds_bundle.css","_ds_sync.json","_ds_needs_recompile"], deletes:[])`.
NEVER add `templates/**`, `motion/**`, `uploads/**`, `README.md`, or `**`.

- [ ] **Step 4: Upload sequence** (sentinel → content → sentinel → anchor)

1. `write_files` `_ds_needs_recompile` (sentinel first).
2. `write_files` `_ds_bundle.js`, `_ds_bundle.css`, `styles.css`, `tokens/tokens.css`, and every `components/**` file (the 5 new dirs + all changed `.html`/`.d.ts`/`.prompt.md`/`.jsx`), in ≤256-file batches.
3. `write_files` `_ds_needs_recompile` again (re-arm).
4. `write_files` `_ds_sync.json` LAST.

- [ ] **Step 5: Verify remote + protected content**

`DesignSync(list_files)` — confirm the 5 new component dirs are present AND `templates/analytics-dashboard/`, `motion/`, `scraps/`, `screenshots/`, `uploads/`, promo HTMLs, `README.md` are all still present and untouched.

- [ ] **Step 6: Confirm render in the sandbox**

Reload the Claude Design project; scroll the App group; confirm the new cards render (static HTML) and match the template. (Use iframe height as the render signal per NOTES.)

- [ ] **Step 7: Update NOTES + memory, commit**

Append the new component set to `.design-sync/NOTES.md` (Status section) and update the `reachkit-design-system-workflow` memory. Commit any durable changes.

---

## Self-Review

**Spec coverage:** ChannelDonut (T6), CompetitorEdgePanel (T7), PlanItemCard (T8), LeverBanner (T9), ProgressChart (T10) = the 5 new (spec §4). ScoreGauge (T2), KpiCard (T3), AppShell (T4), SearchGapTable (T5) reconcile + DashboardScreen (T11) = spec §5. Guardrails (T12) = spec §8. Verification (T2–T12 gates) = spec §7. Consumer-regression risk (spec §9) covered in T2 (ScoreCard) and T5 (ResultsScreen). Pipeline `_ds_sync.json` drift found during planning → fixed in T1. No spec section unaddressed.

**Placeholder scan:** every new-component task carries complete runnable code and an exact META literal; reconcile tasks name the exact template block + consumer to check. No "TBD"/"handle edge cases"/"similar to". The representative code is explicitly the starting point with the visual gate as acceptance.

**Type consistency:** prop interface names used in DashboardScreen's Consumes (T11) exactly match the Produces blocks: `ChannelDonutProps.segments`, `CompetitorEdgePanelProps.rows/variant`, `PlanItemCardProps`, `LeverBannerProps.{pillar,note,points}`, `ProgressChartProps.{points,markers,events}`, `ScoreGaugeProps.score`, `KpiCardProps.{label,value}`, `AppShellProps.{active,children}`. Export names match exportsList additions and META keys.

**Count invariant:** component count rises 28 → 33 as new tasks land; the `all N … ✓` expected number is stated per task (29,30,31,32,33) — verify it matches at each gate.
