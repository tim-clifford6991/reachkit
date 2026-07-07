# Plan 1 — Free Scan Emits a Lightweight Report (+ Unified Fixed-Basis Score)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FREE scan persist a lightweight `report_payload` (assembled from findings + preliminary facts + cheap signal-derived baseline fixes) and compute a single fixed-basis headline score that is identical on free and paid — so one renderer and one score can work everywhere.

**Architecture:** The free path already fetches and persists the site HTML (`raw_documents`, `source_type "site_fetch"`), so the 8 Wave-A on-site signals compute with **zero new API cost**. Those 8 signals are always measured on a web scan in **both** tiers, so a headline computed over that **fixed 8-signal subset** is byte-identical free↔paid without changing the registry math. A new pipeline step assembles a minimal `ReportPayload` (deep sections empty) for free scans; the paid pass is switched to the same fixed-basis headline so the number never moves on upgrade.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`serverDb()`), Inngest (`scan-requested`), Vitest (co-located `*.test.ts`).

## Global Constraints

- **Free scan must stay cheap (CAC):** the free path may add only pure computation + reads of already-persisted data. **No new network/paid API calls.** `computeSignalRowsForScan` and `fallbackActionsFromSignals` are pure over the already-fetched HTML — allowed. Do NOT call market/keyword/community collectors in the free path.
- **Score parity:** the headline for a web scan is computed over the fixed subset `FIXED_BASIS_SIGNAL_KEYS` in BOTH the free step and the paid pass. The number must be identical for the same signals regardless of tier.
- **Fixed-basis subset (web, always-measured):** `["title_tag","meta_description","schema_jsonld","canonical_url","heading_structure","content_depth","social_share_tags","media_richness"]` (SEO ×5 + Content ×3; Outreach has no HTML signal → not in the headline).
- **App mode (`mode !== "web"`):** no persisted HTML (`readSubjectHtml` is web-only) → keep the existing v1 `discoverabilityScore` for the free report; do not attempt the fixed basis.
- **Purity for testability:** new scoring/assembly helpers are pure and unit-tested without Supabase, matching `lib/scan/registry-score.test.ts` / `fallback-actions.test.ts` conventions.
- **Idempotency:** the free-report pipeline step must be safe to re-run (Inngest retries) — `persistScanSignals`, `persistReport`, and the scan-row update are all idempotent upserts/overwrites.

---

## File Structure

- **Modify** `lib/scan/registry-score.ts` — add `FIXED_BASIS_SIGNAL_KEYS` + `headlineScore(rows: ScanSignalRow[])` (fixed-subset registry score); export.
- **Create** `lib/scan/free-report.ts` — `verifiedScoreFromRegistry()` (pure, builds a `VerifiedScore` from a `RegistryScore`), `buildFreeReport()` (pure assembly), and `runFreeReport(ctx, facts)` (the I/O runner).
- **Create** `lib/scan/free-report.test.ts` — unit tests for the pure helpers.
- **Modify** `lib/scan/registry-score.test.ts` — tests for `headlineScore` parity.
- **Modify** `lib/inngest/functions/scan-requested.ts` — new `step.run("free-report", …)` gated on `tier === "free"`.
- **Modify** `lib/scan/full-scan.ts` — step 10a uses `headlineScore` over the fixed subset instead of `headlineFromRows` (paid parity).
- **Modify** `lib/scan/full-scan.test.ts` / add coverage — paid headline uses fixed basis.
- **Create** `tests/integration/free-report-e2e.test.ts` — free scan persists a valid `report_payload` and score parity.

---

## Task 1: Fixed-basis headline scorer (pure)

**Files:**
- Modify: `lib/scan/registry-score.ts`
- Test: `lib/scan/registry-score.test.ts`

**Interfaces:**
- Consumes: `ScanSignalRow` (`lib/scan/compute-signals.ts:37-46` — has `signalKey`, `pillar`, `weight`, `normalised`, `state`), `registryScore` + `RegistryScore` (`lib/scan/registry-score.ts`).
- Produces:
  - `export const FIXED_BASIS_SIGNAL_KEYS: readonly string[]`
  - `export function headlineScore(rows: ScanSignalRow[]): RegistryScore` — registry score computed over ONLY the fixed-subset rows. Identical output whether or not deep (market) rows are also present.

- [ ] **Step 1: Write the failing test**

Add to `lib/scan/registry-score.test.ts`:

```ts
import { headlineScore, FIXED_BASIS_SIGNAL_KEYS } from "./registry-score";
import type { ScanSignalRow } from "./compute-signals";

// Minimal ScanSignalRow factory (only fields headlineScore reads matter).
function sig(signalKey: string, pillar: "content" | "outreach" | "seo", weight: number, normalised: number | null): ScanSignalRow {
  return {
    signalKey, pillar, weight, normalised,
    rawValue: null,
    contribution: null,
    state: normalised == null ? "unmeasured" : normalised >= 70 ? "pass" : normalised >= 40 ? "warn" : "fail",
    platform: "web",
  };
}

// The 8 fixed HTML signals, all measured (a typical web scan).
const FIXED_ROWS: ScanSignalRow[] = [
  sig("title_tag", "seo", 0.1, 80),
  sig("meta_description", "seo", 0.1, 60),
  sig("schema_jsonld", "seo", 0.12, 0),
  sig("canonical_url", "seo", 0.08, 100),
  sig("heading_structure", "seo", 0.1, 50),
  sig("content_depth", "content", 0.25, 70),
  sig("social_share_tags", "content", 0.15, 40),
  sig("media_richness", "content", 0.15, 90),
];

// Deep (paid-only) rows that must NOT affect the headline.
const DEEP_ROWS: ScanSignalRow[] = [
  sig("organic_keywords", "seo", 0.25, 20),
  sig("keyword_rankings", "seo", 0.15, 10),
  sig("community_presence", "outreach", 0.25, 30),
  sig("marketplace_presence", "outreach", 0.25, 40),
];

describe("headlineScore (fixed basis)", () => {
  it("is identical whether or not deep signals are present (free == paid)", () => {
    const free = headlineScore(FIXED_ROWS);
    const paid = headlineScore([...FIXED_ROWS, ...DEEP_ROWS]);
    expect(paid.total).toBe(free.total);
    expect(paid.breakdown).toEqual(free.breakdown);
  });

  it("assesses only SEO + Content (outreach has no fixed signal)", () => {
    const h = headlineScore([...FIXED_ROWS, ...DEEP_ROWS]);
    expect(h.assessed.sort()).toEqual(["content", "seo"]);
    expect(h.breakdown.outreach).toBe(0);
  });

  it("FIXED_BASIS_SIGNAL_KEYS is exactly the 8 HTML-derived signals", () => {
    expect([...FIXED_BASIS_SIGNAL_KEYS].sort()).toEqual(
      ["canonical_url","content_depth","heading_structure","media_richness","meta_description","schema_jsonld","social_share_tags","title_tag"],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/scan/registry-score.test.ts`
Expected: FAIL — `headlineScore`/`FIXED_BASIS_SIGNAL_KEYS` not exported.

- [ ] **Step 3: Implement**

Append to `lib/scan/registry-score.ts` (add the `ScanSignalRow` import at top):

```ts
import type { ScanSignalRow } from "./compute-signals";

/**
 * The fixed headline basis: the 8 on-site HTML signals that are computable from
 * the site HTML EVERY scan already fetches (source_type "site_fetch"), and are
 * therefore always measured on a web scan in both the free and paid tiers.
 * Computing the headline over exactly these keys makes the number identical
 * free↔paid — it never moves on upgrade. Deep/off-site signals (keywords,
 * communities, press) enrich the explainability panel but are NOT in the headline.
 */
export const FIXED_BASIS_SIGNAL_KEYS: readonly string[] = [
  "title_tag", "meta_description", "schema_jsonld", "canonical_url", "heading_structure",
  "content_depth", "social_share_tags", "media_richness",
];

/**
 * The single source-of-truth headline score: `registryScore` over the fixed
 * 8-signal subset. Same signals → same number, regardless of what deep signals a
 * paid scan additionally measured.
 */
export function headlineScore(rows: ScanSignalRow[]): RegistryScore {
  const fixed = rows
    .filter((r) => FIXED_BASIS_SIGNAL_KEYS.includes(r.signalKey))
    .map((r) => ({ pillar: r.pillar, weight: r.weight, normalised: r.normalised, state: r.state }));
  return registryScore(fixed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/scan/registry-score.test.ts`
Expected: PASS (all, including existing tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/registry-score.ts lib/scan/registry-score.test.ts
git commit -m "feat(score): fixed-basis headlineScore over the 8 always-measured HTML signals"
```

---

## Task 2: Pure free-report helpers (`verifiedScoreFromRegistry`, `buildFreeReport`)

**Files:**
- Create: `lib/scan/free-report.ts`
- Test: `lib/scan/free-report.test.ts`

**Interfaces:**
- Consumes: `RegistryScore` + `headlineScore` (Task 1), `assembleReport` + `ReportPayload` (`lib/scan/report.ts:189`), `VerifiedScore` + `RadarAxis` (`lib/scan/score-full.ts:61,71`), `PreliminaryFacts` (`lib/scan/types`), `Finding` + `PositioningMirror` + `ActionCard` (`lib/llm/types`), `ScanSignalRow` (`lib/scan/compute-signals.ts`).
- Produces:
  - `export function verifiedScoreFromRegistry(v: RegistryScore): VerifiedScore`
  - `export function buildFreeReport(args: { mode: Platform; generatedAt: string; facts: PreliminaryFacts; positioningMirror: PositioningMirror; findings: Finding[]; actions: ActionCard[]; score: VerifiedScore }): ReportPayload`

- [ ] **Step 1: Write the failing test**

Create `lib/scan/free-report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verifiedScoreFromRegistry, buildFreeReport } from "./free-report";
import type { RegistryScore } from "./registry-score";
import type { PreliminaryFacts } from "./types";

const REG: RegistryScore = { total: 62, breakdown: { content: 55, outreach: 0, seo: 68 }, assessed: ["content", "seo"] };

const FACTS: PreliminaryFacts = {
  mode: "web",
  listing: { name: "Acme", category: "SaaS", description: "d" },
  reviewVolume: 12,
  competitors: [{ rank: 1, name: "Rival A", source: "serp" }],
  themes: [{ term: "fast onboarding", count: 4 }],
  coldStart: false,
} as unknown as PreliminaryFacts;

describe("verifiedScoreFromRegistry", () => {
  it("wraps a RegistryScore into a VerifiedScore with 3 radar axes", () => {
    const s = verifiedScoreFromRegistry(REG);
    expect(s.total).toBe(62);
    expect(s.breakdown).toEqual({ content: 55, outreach: 0, seo: 68 });
    expect(s.basis).toBe("verified");
    expect(s.radar.map((a) => a.axis).sort()).toEqual(["Content", "Outreach", "SEO/ASO"]);
    // Outreach is not assessed on the fixed basis → axis marked unassessed.
    expect(s.radar.find((a) => a.axis === "Outreach")!.assessed).toBe(false);
    expect(s.radar.find((a) => a.axis === "SEO/ASO")!.assessed).toBe(true);
  });
});

describe("buildFreeReport", () => {
  const report = buildFreeReport({
    mode: "web",
    generatedAt: "2026-07-07T00:00:00.000Z",
    facts: FACTS,
    positioningMirror: { listingSays: "l", reviewsValue: "r", gap: "g" },
    findings: [{ category: "seo", claim: "thin copy", basis: "site", confidence: 0.7, evidence: [] } as never],
    actions: [],
    score: verifiedScoreFromRegistry(REG),
  });

  it("produces a valid ReportPayload with the score and empty deep sections", () => {
    expect(report.score.total).toBe(62);
    expect(report.mode).toBe("web");
    expect(report.whatYouOffer.positioningMirror.gap).toBe("g");
    // Deep sections are empty on a free report.
    expect(report.competitiveLandscape).toEqual([]);
    expect(report.channelOpportunities).toEqual({ keywordClusters: [], communitiesByEngagement: [] });
    expect(report.creatorsToReach).toEqual([]);
  });

  it("derives icpSignals from facts.themes and competitorGap from facts.competitors", () => {
    expect(report.whoItsFor.signals).toContain("fast onboarding");
    expect(report.whereTheyAre.competitorGap.map((g) => g.competitor)).toContain("Rival A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/scan/free-report.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/scan/free-report.ts` (pure helpers only in this task; the runner is Task 3):

```ts
import type { Platform } from "./router";
import type { PreliminaryFacts } from "./types";
import type { Finding, PositioningMirror, ActionCard } from "@/lib/llm/types";
import type { RegistryScore } from "./registry-score";
import type { VerifiedScore, RadarAxis } from "./score-full";
import { assembleReport, type ReportPayload } from "./report";

/** Build the 3 radar axes from a RegistryScore breakdown (assessed pillars only). */
export function verifiedScoreFromRegistry(v: RegistryScore): VerifiedScore {
  const axis = (label: string, pillar: "content" | "outreach" | "seo", value: number): RadarAxis => ({
    axis: label,
    value,
    active: true,
    assessed: v.assessed.includes(pillar),
  });
  return {
    total: v.total,
    breakdown: { content: v.breakdown.content, outreach: v.breakdown.outreach, seo: v.breakdown.seo },
    basis: "verified",
    radar: [
      axis("Content", "content", v.breakdown.content),
      axis("Outreach", "outreach", v.breakdown.outreach),
      axis("SEO/ASO", "seo", v.breakdown.seo),
    ],
  };
}

/**
 * Assemble a lightweight free `ReportPayload`: the score + positioning + findings
 * + cheap signal-derived baseline fixes, with all deep sections empty (locked in
 * the UI). Pure — reuses the same `assembleReport` the paid pass uses, so the
 * shape is identical and one renderer handles both.
 */
export function buildFreeReport(args: {
  mode: Platform;
  generatedAt: string;
  facts: PreliminaryFacts;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  actions: ActionCard[];
  score: VerifiedScore;
}): ReportPayload {
  const { mode, generatedAt, facts, positioningMirror, findings, actions, score } = args;
  const icpSignals = (facts.themes ?? []).map((t) => t.term).filter(Boolean).slice(0, 6);
  const competitorGap = (facts.competitors ?? [])
    .filter((c) => typeof c.name === "string" && c.name.length > 0)
    .map((c) => ({ competitor: c.name, dimension: "community presence", them: 0, you: 0 }));
  return assembleReport({
    mode,
    generatedAt,
    positioningMirror,
    findings,
    icpSignals,
    surfaces: [],
    competitorGap,
    actions,
    score,
    // deep sections omitted → assembleReport defaults them to empty
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/scan/free-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/free-report.ts lib/scan/free-report.test.ts
git commit -m "feat(scan): pure free-report assembly helpers (VerifiedScore wrap + lightweight report)"
```

---

## Task 3: `runFreeReport` runner (I/O)

**Files:**
- Modify: `lib/scan/free-report.ts` (add the runner)
- Test: covered by the integration test in Task 6 (the runner is thin I/O over Task-2 pure helpers + existing tested functions).

**Interfaces:**
- Consumes: `ScanContext` (`lib/scan/pipeline`), `serverDb` (`lib/db/client`), `computeSignalRowsForScan` + `persistScanSignals` (`lib/scan/persist-signals.ts:64,76`), `headlineScore` (Task 1), `verifiedScoreFromRegistry` + `buildFreeReport` (Task 2), `fallbackActionsFromSignals` (`lib/scan/fallback-actions.ts:53`), `discoverabilityScore` (`lib/scan/score.ts:92`, app fallback), `persistReport` (`lib/scan/report.ts:368`), `ScoreComponents` (`lib/scan/score-full.ts`).
- Produces: `export async function runFreeReport(ctx: ScanContext, facts: PreliminaryFacts): Promise<void>`

- [ ] **Step 1: Write the runner**

Append to `lib/scan/free-report.ts`:

```ts
import type { ScanContext } from "./pipeline";
import { serverDb } from "@/lib/db/client";
import { computeSignalRowsForScan, persistScanSignals } from "./persist-signals";
import { fallbackActionsFromSignals } from "./fallback-actions";
import { headlineScore, type RegistryScore } from "./registry-score";
import { discoverabilityScore } from "./score";
import { persistReport } from "./report";
import type { ScoreComponents } from "./score-full";
import type { Json } from "@/lib/db/types";
import { EMPTY_MIRROR } from "./report"; // if not exported, inline { listingSays:"", reviewsValue:"", gap:"" }

/** Zero components — the free basis reads only HTML; comparison_pages → 0. */
const ZERO_COMPONENTS: ScoreComponents = {
  keywordsRanking: 0,
  directoriesLive: 0,
  comparisonPagesLive: 0,
  asoCoverage: 0,
  contentSurfaces: 0,
  outreachSurfaces: 0,
};

/**
 * Free-tier lightweight report. Cheap: computes the Wave-A HTML signals from the
 * already-fetched site HTML (no new API calls), the fixed-basis headline, and
 * signal-derived baseline fixes, then assembles + persists a minimal report_payload.
 * Idempotent (safe on Inngest retry).
 */
export async function runFreeReport(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  const db = serverDb();

  // Findings + positioning mirror written by runFindings.
  const { data } = await db.from("scans").select("findings_payload").eq("id", ctx.scanId).maybeSingle();
  const fp = (data?.findings_payload ?? null) as {
    findings?: Finding[];
    positioningMirror?: PositioningMirror;
  } | null;
  const findings = Array.isArray(fp?.findings) ? fp.findings : [];
  const positioningMirror = fp?.positioningMirror ?? { listingSays: "", reviewsValue: "", gap: "" };

  // Wave-A signals from already-persisted HTML (market null → deep signals unmeasured).
  const signalRows = await computeSignalRowsForScan({
    mode: ctx.mode,
    storeUrl: ctx.storeUrl,
    components: ZERO_COMPONENTS,
    market: null,
  });
  await persistScanSignals({ mode: ctx.mode, storeUrl: ctx.storeUrl, scanId: ctx.scanId, components: ZERO_COMPONENTS, market: null });

  // Headline: fixed-basis for web; v1 findings score for app (no HTML).
  let scoreVersion = 2;
  let score;
  if (ctx.mode === "web") {
    const reg: RegistryScore = headlineScore(signalRows);
    score = verifiedScoreFromRegistry(reg);
  } else {
    const v1 = discoverabilityScore(facts, null);
    score = { ...v1, radar: [], basis: "verified" as const };
    scoreVersion = 1;
  }

  const actions = fallbackActionsFromSignals(signalRows);

  const payload = buildFreeReport({
    mode: ctx.mode,
    generatedAt: new Date().toISOString(),
    facts,
    positioningMirror,
    findings,
    actions,
    score,
  });

  await persistReport(ctx.scanId, payload);

  const { error } = await db
    .from("scans")
    .update({
      score_total: score.total,
      score_breakdown: score.breakdown as unknown as Json,
      score_version: scoreVersion,
    })
    .eq("id", ctx.scanId);
  if (error) throw error;
}
```

Note: add the `Finding`/`PositioningMirror` imports already present from Task 2. If `EMPTY_MIRROR` isn't exported from `report.ts`, use the inline literal shown (no import).

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `lib/scan/free-report.ts` (ignore pre-existing `.next/types/validator.ts` noise).

- [ ] **Step 3: Commit**

```bash
git add lib/scan/free-report.ts
git commit -m "feat(scan): runFreeReport — persist a cheap lightweight report_payload for free scans"
```

---

## Task 4: Wire `runFreeReport` into the pipeline (free tier)

**Files:**
- Modify: `lib/inngest/functions/scan-requested.ts` (add a step after `findings`, gated on `tier === "free"`)
- Test: `tests/integration/scan-requested-e2e.test.ts` (extend — see Task 6)

**Interfaces:**
- Consumes: `runFreeReport` (Task 3), the existing `facts`/`tier` from the `collect` step, the ScanContext-reconstruction pattern at `scan-requested.ts:110-124`.
- Produces: after a free scan, `scans.report_payload` is populated before the `done` step.

- [ ] **Step 1: Add the import**

In `lib/inngest/functions/scan-requested.ts`, add:

```ts
import { runFreeReport } from "@/lib/scan/free-report";
```

- [ ] **Step 2: Add the free-report step**

Insert between the `findings` step (ends ~`:141`) and the `full-scan` block (`:149`):

```ts
    // Step 2b: free-report — free scans get a lightweight report_payload (score +
    // positioning + findings + signal-derived baseline fixes; deep sections empty)
    // so the single results renderer works for the public lead magnet. Cheap:
    // pure computation over already-fetched HTML, no new API calls.
    if (tier === "free") {
      await step.run("free-report", async () => {
        const db = serverDb();
        const { data: scanRow, error: scanErr } = await db
          .from("scans")
          .select("id, app_id, apps(store_url, platform)")
          .eq("id", scanId)
          .single();
        if (scanErr) throw scanErr;
        if (!scanRow) throw new Error(`scan ${scanId} not found`);
        const appsRaw = scanRow.apps;
        if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);
        const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };
        const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: budgetCentsForTier(tier) });
        await runFreeReport(
          { scanId, appId: scanRow.app_id, mode: app.platform, storeUrl: app.store_url, budget },
          facts,
        );
      });
    }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean (ignore `.next/types` noise).

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/functions/scan-requested.ts
git commit -m "feat(scan): free scans persist a lightweight report_payload (new free-report step)"
```

---

## Task 5: Paid pass uses the same fixed-basis headline (parity)

**Files:**
- Modify: `lib/scan/full-scan.ts` (step 10a — replace `headlineFromRows` with `headlineScore` over the fixed subset)
- Test: `lib/scan/full-scan.test.ts` (or a focused new test) + `lib/scan/registry-score.test.ts`

**Interfaces:**
- Consumes: `headlineScore` (Task 1), `verifiedScoreFromRegistry` (Task 2), the persisted `scan_signals` rows.
- Produces: paid `score_total` / `report_payload.score` computed over the SAME fixed basis as free → identical number for identical signals.

Background (current code, `full-scan.ts:614-643`): step 10a persists signals, reads back `scan_signals` (`pillar, weight, normalised, state`), then `headlineFromRows(mode, v1, rows)` → v2 via the measured-only denominator, and `applyRegistryScore` patches `report_payload.score`. We swap the headline source to the fixed-basis `headlineScore` while keeping the v1 `verifiedScore` as the app-mode fallback.

- [ ] **Step 1: Write the failing/parity test**

Add to `lib/scan/registry-score.test.ts` (proves the paid path's chosen basis matches free):

```ts
it("headlineScore ignores deep-signal quality → paid basis equals free basis", () => {
  // Same 8 fixed rows; paid additionally measured weak deep signals.
  const free = headlineScore(FIXED_ROWS);
  const paidRows = [...FIXED_ROWS, sig("organic_keywords", "seo", 0.25, 5), sig("community_presence", "outreach", 0.25, 5)];
  const paid = headlineScore(paidRows);
  expect(paid.total).toBe(free.total);
});
```

Run: `pnpm test lib/scan/registry-score.test.ts` → PASS (headlineScore already exists from Task 1; this locks the intent for Task 5's wiring).

- [ ] **Step 2: Change the paid headline source**

In `lib/scan/full-scan.ts`, replace the read-back rows select + `headlineFromRows` block so it selects `signal_key` too and uses `headlineScore`. Update imports:

```ts
import { registryScore, headlineScore, verifiedScoreFromRegistry } from "@/lib/scan/registry-score";
// verifiedScoreFromRegistry is exported from free-report.ts; import it from there instead:
import { verifiedScoreFromRegistry } from "@/lib/scan/free-report";
```

Then, in step 10a, change the rows query to include `signal_key` and compute the fixed-basis headline (web only; app keeps v1):

```ts
      const { data: rows } = await db
        .from("scan_signals")
        .select("signal_key, pillar, weight, normalised, state")
        .eq("scan_id", ctx.scanId);
      const signalRows = (rows ?? []).map((r) => ({
        signalKey: r.signal_key as string,
        pillar: r.pillar as "content" | "outreach" | "seo",
        weight: r.weight as number,
        normalised: r.normalised as number | null,
        state: (r.state as string) ?? "unmeasured",
        rawValue: null,
        contribution: null,
        platform: ctx.mode,
      }));
      if (ctx.mode === "web" && payload) {
        const reg = headlineScore(signalRows);
        if (reg.assessed.length > 0) {
          await db
            .from("scans")
            .update({
              score_total: reg.total,
              score_breakdown: reg.breakdown as unknown as Json,
              score_version: 2,
            })
            .eq("id", ctx.scanId);
          await persistReport(ctx.scanId, { ...payload, score: verifiedScoreFromRegistry(reg) });
        }
      }
```

Remove the now-unused `headlineFromRows` / `applyRegistryScore` / `registryScore` imports if they are no longer referenced elsewhere in the file (check with a grep before deleting).

- [ ] **Step 3: Run tests**

Run: `pnpm test lib/scan/full-scan.test.ts lib/scan/registry-score.test.ts`
Expected: PASS. Fix any test that asserted the old measured-only v2 total (update the expected value to the fixed-basis total, documenting why in the test comment).

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → clean.

```bash
git add lib/scan/full-scan.ts lib/scan/registry-score.test.ts lib/scan/full-scan.test.ts
git commit -m "feat(score): paid pass uses the fixed-basis headline — score is identical free and paid"
```

---

## Task 6: Integration test — free scan persists a valid report + score parity

**Files:**
- Create: `tests/integration/free-report-e2e.test.ts` (follow the style of `tests/integration/scan-requested-e2e.test.ts`)

**Interfaces:**
- Consumes: `runFreeReport` (Task 3), the integration DB harness used by existing `tests/integration/*` (service-role `serverDb`, seeded `apps`/`scans` rows, `REACHKIT_USE_FIXTURES`).

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
// Reuse the integration harness pattern from scan-requested-e2e.test.ts:
// seed an app + a web scan with a site_fetch raw_document + a findings_payload,
// then run runFreeReport and assert the persisted report_payload.

describe("free-report e2e", () => {
  it("persists a lightweight report_payload with a fixed-basis score and no deep sections", async () => {
    // 1. seed app (web) + scan (tier free, status synthesizing)
    // 2. upsert a raw_documents row: source_type "site_fetch", body = <sample HTML with title/meta/h1/og>
    // 3. update scans.findings_payload = { findings: [...], positioningMirror: {...}, score: {...} }
    // 4. await runFreeReport(ctx, facts)
    // 5. read scans.report_payload
    const row = await readScan(scanId); // helper: select report_payload, score_total, score_version
    expect(row.report_payload).toBeTruthy();
    expect(row.report_payload.competitiveLandscape).toEqual([]);
    expect(row.report_payload.channelOpportunities).toEqual({ keywordClusters: [], communitiesByEngagement: [] });
    expect(typeof row.report_payload.score.total).toBe("number");
    expect(row.score_version).toBe(2);
    // score parity: computing headlineScore over the same signal rows equals the persisted total
    expect(row.report_payload.score.total).toBe(row.score_total);
  });
});
```

(Fill the seed helpers from the existing integration harness; the sample HTML need only contain a `<title>`, `<meta name="description">`, one `<h1>`, and an `og:title` so several fixed signals measure.)

- [ ] **Step 2: Run**

Run: `pnpm test:int tests/integration/free-report-e2e.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/free-report-e2e.test.ts
git commit -m "test(scan): e2e — free scan persists a valid lightweight report + score parity"
```

---

## Self-Review

- **Spec coverage:** Plan 1 delivers the spec's "Plan 1 — Free scan emits a lightweight report (foundation)" — free `report_payload` (Tasks 2–4), unified fixed-basis score identical free↔paid (Tasks 1, 5), cheap/no-new-calls (Global Constraints; Task 3 uses only HTML reads + pure fns). Renderer/route consolidation is deliberately out of scope (Plan 2).
- **Placeholder scan:** the only intentionally-templated section is Task 6's seed helpers, which reference the existing integration harness rather than reinventing it; all pure-function code is complete.
- **Type consistency:** `headlineScore(rows: ScanSignalRow[])` (Task 1) is consumed with the exact `ScanSignalRow` field names (`signalKey`, `pillar`, `weight`, `normalised`, `state`) in Tasks 3 & 5; `verifiedScoreFromRegistry` returns `VerifiedScore` consumed by `assembleReport`/`persistReport`; `RegistryScore` shape (`total`/`breakdown`/`assessed`) matches `registry-score.ts`.
- **Open risk carried forward:** confirm in Task 6 that a real `site_fetch` HTML row yields ≥1 measured SEO and ≥1 measured Content signal so `assessed.length > 0` (else the free web report would fall back to total 0). If a domain returns no usable HTML, `runFreeReport` should still persist a report — consider a v1 `discoverabilityScore` fallback when `headlineScore(...).assessed.length === 0` (add as a follow-up step if Task 6 surfaces it).

---

## Execution Handoff

Plan complete. Two execution options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
