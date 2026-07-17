/**
 * Pure free-report assembly helpers.
 *
 * `verifiedScoreFromRegistry` wraps a `RegistryScore` (the v2 18-signal
 * registry total) into a `VerifiedScore` with the same 3-axis radar shape the
 * paid pipeline produces, so downstream consumers (the report renderer, the
 * badge/score-card) don't need to special-case the free path.
 *
 * `buildFreeReport` assembles a lightweight `ReportPayload` for the free scan:
 * the real score + positioning + findings + cheap signal-derived baseline
 * fixes, with all deep (paid) sections left empty. It reuses `assembleReport`
 * verbatim so the free and paid reports share one renderer.
 */

import type { Platform } from "./router";
import type { PreliminaryFacts } from "./types";
import type { Finding, PositioningMirror, ActionCard, ScoreResult } from "@/lib/llm/types";
import type { RegistryScore } from "./registry-score";
import type { VerifiedScore, RadarAxis } from "./score-full";
import { assembleReport, type ReportPayload } from "./report";

/** Build the 7-axis radar (3 active + 4 locked) from a RegistryScore breakdown. */
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
      { axis: "Ads", value: 0, active: false, assessed: false },
      { axis: "Partnerships", value: 0, active: false, assessed: false },
      { axis: "PR", value: 0, active: false, assessed: false },
      { axis: "Positioning", value: 0, active: false, assessed: false },
    ],
  };
}

/**
 * Wrap the v1 (Cycle 2 heuristic) `discoverabilityScore` result as a full
 * 7-axis `VerifiedScore`, via `verifiedScoreFromRegistry`. `discoverabilityScore`
 * always measures all three pillars, so `assessed` is the full pillar set.
 */
export function verifiedScoreFromV1(v1: ScoreResult): VerifiedScore {
  const reg: RegistryScore = {
    total: v1.total,
    breakdown: v1.breakdown,
    assessed: ["content", "outreach", "seo"],
  };
  return verifiedScoreFromRegistry(reg);
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
  /** iteration 2 — subject-only Search Visibility (free web scans). */
  searchVisibility?: SearchVisibility;
}): ReportPayload {
  const { mode, generatedAt, facts, positioningMirror, findings, actions, score, searchVisibility } = args;
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
    searchVisibility,
    // deep sections omitted → assembleReport defaults them to empty
  });
}

// ---------------------------------------------------------------------------
// runFreeReport — the I/O runner (Task 3)
// ---------------------------------------------------------------------------

import type { ScanContext } from "./pipeline";
import { serverDb } from "@/lib/db/client";
import { emitScanEvent } from "./progress";
import { computeSignalRowsForScan, persistScanSignals } from "./persist-signals";
import { fallbackActionsFromSignals } from "./fallback-actions";
import { fillDeterministicDrafts } from "./action-drafts";
import { writeScanScoreSnapshot, rollupScanCost } from "./scan-telemetry";
import { headlineScore, HEADLINE_SCORE_VERSION, discoverabilityScore as unifiedDiscoverability, DISCOVERABILITY_SCORE_VERSION } from "./registry-score";
import { discoverabilityScore } from "./score";
import { gatherFreeSearchVisibility, type SearchVisibility } from "./search-visibility";
import { persistReport } from "./report";
import type { ScoreComponents } from "./score-full";
import type { Json } from "@/lib/db/types";

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
 *
 * Resilience: if a web scan has no usable HTML (headlineScore finds nothing
 * assessed), falls back to the v1 discoverabilityScore wrapped as a VerifiedScore
 * (score_version 1) rather than persisting a hollow 0 score.
 */
export async function runFreeReport(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  const db = serverDb();

  // Findings + positioning mirror written by runFindings.
  const { data } = await db.from("scans").select("findings_payload").eq("id", ctx.scanId).maybeSingle();
  const fp = (data?.findings_payload ?? null) as {
    findings?: Finding[];
    positioningMirror?: PositioningMirror;
    categorySeeds?: string[];
  } | null;
  const findings = Array.isArray(fp?.findings) ? fp.findings : [];
  const positioningMirror = fp?.positioningMirror ?? { listingSays: "", reviewsValue: "", gap: "" };
  const categorySeeds = Array.isArray(fp?.categorySeeds) ? fp!.categorySeeds.filter((s): s is string => typeof s === "string") : [];

  // Wave-A signals from already-persisted HTML (market null → deep signals unmeasured).
  const signalRows = await computeSignalRowsForScan({
    mode: ctx.mode,
    storeUrl: ctx.storeUrl,
    components: ZERO_COMPONENTS,
    market: null,
  });
  await persistScanSignals({ mode: ctx.mode, storeUrl: ctx.storeUrl, scanId: ctx.scanId, components: ZERO_COMPONENTS, market: null });

  // Headline v4 = registryScore over the FIXED on-site basis (headlineScore) for
  // web — the 8 HTML signals measured identically on free and paid, so the free
  // gauge EXACTLY equals the number the paid deep pass will show (no free→paid
  // jump) and equals its own on-site pillar bars. Off-site strength appears only
  // later, as the separate paid "Market position" grade — never in the headline.
  // v1 findings score for app (no HTML), and the same v1 fallback when a web scan
  // has no usable HTML to assess.
  let scoreVersion = HEADLINE_SCORE_VERSION;
  let score: VerifiedScore;
  const reg: RegistryScore = ctx.mode === "web" ? headlineScore(signalRows) : { total: 0, breakdown: { content: 0, outreach: 0, seo: 0 }, assessed: [] };
  if (ctx.mode === "web" && reg.assessed.length > 0) {
    score = verifiedScoreFromRegistry(reg);
  } else {
    score = verifiedScoreFromV1(discoverabilityScore(facts, null));
    scoreVersion = 1;
  }

  const actions = fillDeterministicDrafts(
    fallbackActionsFromSignals(signalRows),
    facts.listing,
    ctx.storeUrl,
    ctx.mode,
  );

  // iteration 2 — the free "wow": one subject-only ranked_keywords call → Search
  // Visibility (brand/category/off-topic split of what the site actually ranks
  // for). The seed vocabulary is the site's OWN language (its ICP themes + what
  // its listing says) so category searches are told apart from other-brand noise.
  // Web only; best-effort. Rivals stay a paid reveal (never touches competitors).
  const seedText = [
    ...(facts.themes ?? []).map((t) => t.term).filter(Boolean),
    positioningMirror.listingSays ?? "",
    positioningMirror.reviewsValue ?? "",
  ].filter((s) => s.length > 0);
  // Make the footprint gather VISIBLE — it's the free report's most valuable data
  // (the whole Search Visibility panel) and was the last silent stretch of the
  // scan. An artifact keeps the progress alive through the DataForSEO round-trips.
  if (ctx.mode === "web") await emitScanEvent(ctx.scanId, "artifact", { label: "Checking your search footprint" });
  const searchVisibility = ctx.mode === "web" ? await gatherFreeSearchVisibility(ctx.storeUrl, seedText, categorySeeds) : undefined;

  // v5 UNIFIED Discoverability Score = geomean(on-page readiness × search presence).
  // Both drivers are computed on free (on-site signals + ranked_keywords), so the
  // number is still identical free↔paid — but honest: a flawless page nobody finds
  // scores low. The two drivers are carried on `searchVisibility` for the hero.
  if (ctx.mode === "web" && reg.assessed.length > 0 && searchVisibility) {
    searchVisibility.onPageReadiness = reg.total;
    score = { ...score, total: unifiedDiscoverability(reg.total, searchVisibility.score) };
    scoreVersion = DISCOVERABILITY_SCORE_VERSION;
  }

  const payload = buildFreeReport({
    mode: ctx.mode,
    generatedAt: new Date().toISOString(),
    facts,
    positioningMirror,
    findings,
    actions,
    score,
    searchVisibility,
  });

  await persistReport(ctx.scanId, payload);

  // Hand off to the report the MOMENT it's renderable — not at the later `done`
  // step boundary. The funnel's handoff waits on `reportReady` (a `report`/`done`
  // event); free never emitted `report`, so it stalled on the live view until
  // `done`, making the handoff.ts comment ("free scans reach reportReady too")
  // aspirational. This makes it true: report_payload is persisted above, so the
  // client can swap to <PublicReport> now.
  await emitScanEvent(ctx.scanId, "report", { free: true });

  const { error } = await db
    .from("scans")
    .update({
      score_total: score.total,
      score_breakdown: score.breakdown as unknown as Json,
      score_version: scoreVersion,
    })
    .eq("id", ctx.scanId);
  if (error) throw error;

  // B3: seed the score-history timeline so the dashboard chart is never empty,
  // and roll the free pass's pipeline cost onto scans.cost_cents.
  await writeScanScoreSnapshot({
    appId: ctx.appId,
    scanId: ctx.scanId,
    total: score.total,
    breakdown: score.breakdown,
    version: scoreVersion,
    source: "scan",
  });
  await rollupScanCost(ctx.scanId);
}
