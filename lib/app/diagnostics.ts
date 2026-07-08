/**
 * Per-scan diagnostics loader — the transparency backbone. For the app's latest
 * scan it surfaces, in one place, the three things that were previously invisible
 * (only transient SSE progress + logs ever showed them):
 *
 *   1. PIPELINE — every pipeline_runs row (stage · model · tokens · cost · latency)
 *      plus the scan total, so per-scan cost/latency is auditable after the fact.
 *   2. DATA MAP — each report_payload section rendered populated / empty / absent
 *      with a count and WHICH UI tab consumes it, so "why is this screen blank?"
 *      is a lookup, not a re-scan.
 *   3. SIGNALS — the persisted scan_signals (state + normalised) and the two score
 *      numbers (on-site readiness vs off-site market position).
 *
 * PURE data assembly (server-only reads); the page renders it. Read-only — never
 * triggers a gather, so it is cheap and safe to open repeatedly.
 */

import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";

export interface StageRun {
  stage: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  durationMs: number;
}

/** A report_payload section and whether the scan actually produced it. */
export interface DataPoint {
  label: string;
  /** Which UI surface reads this section (so a blank screen is traceable). */
  consumedBy: string;
  /** Item count where the section is a list; null for singletons. */
  count: number | null;
  state: "populated" | "empty" | "absent";
}

export interface SignalRow {
  key: string;
  pillar: string;
  state: string;
  normalised: number | null;
  weight: number;
}

export interface ScanDiagnostics {
  scan: {
    id: string;
    status: string | null;
    startedAt: string | null;
    completedAt: string | null;
    deepenedAt: string | null;
    mode: string | null;
  };
  onSiteScore: number | null;
  marketPositionScore: number | null;
  /** LLM cost (sum of pipeline_runs) — the Anthropic spend. */
  totalCostCents: number;
  /** External metered spend for this scan (DataForSEO real USD; Tavily from credits). */
  dataforseoCostCents: number;
  tavilyCostCents: number;
  /** LLM + DataForSEO + Tavily — the true all-in cost of this scan. */
  allInCostCents: number;
  totalDurationMs: number;
  stages: StageRun[];
  dataMap: DataPoint[];
  signals: SignalRow[];
}

/** Per-user spend rollup across all of a user's apps' scans. */
export interface UserSpend {
  scanCount: number;
  llmCostCents: number;
  dataforseoCostCents: number;
  tavilyCostCents: number;
  totalCostCents: number;
}

/** Classify a section: absent (undefined/null), empty (0-length), else populated. */
function pointFor(label: string, consumedBy: string, value: unknown): DataPoint {
  if (value === undefined || value === null) return { label, consumedBy, count: null, state: "absent" };
  if (Array.isArray(value)) {
    return { label, consumedBy, count: value.length, state: value.length ? "populated" : "empty" };
  }
  // Object singleton — "empty" when it has no own enumerable keys.
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return { label, consumedBy, count: null, state: keys.length ? "populated" : "empty" };
  }
  return { label, consumedBy, count: null, state: "populated" };
}

function buildDataMap(p: ReportPayload | null): DataPoint[] {
  if (!p) return [];
  const market = p.market;
  return [
    pointFor("Positioning mirror", "Report · What you offer", p.whatYouOffer?.positioningMirror),
    pointFor("Audience signals", "Audience → Customers", p.whoItsFor?.signals),
    pointFor("Discovery surfaces", "Audience → Competitors", p.whereTheyAre?.surfaces),
    pointFor("Competitor gap", "Audience → Competitors", p.whereTheyAre?.competitorGap),
    pointFor("Quick wins", "Plan", p.whatToDoThisWeek?.quickWins),
    pointFor("Medium plays", "Plan", p.whatToDoThisWeek?.medium),
    pointFor("Long plays", "Plan", p.whatToDoThisWeek?.longPlay),
    pointFor("Market position grade", "Dashboard hero", p.marketPosition),
    pointFor("Competitive landscape", "Audience → Competitors", p.competitiveLandscape),
    pointFor("Channel opportunities", "Audience → Competitors / Keywords", p.channelOpportunities),
    pointFor("Creators to reach", "Audience → Creators", p.creatorsToReach),
    pointFor("Strengths & weaknesses", "Audience → Customers", p.strengthsAndWeaknesses),
    // M4 deep market analysis — supersedes the lighter sections above when present.
    pointFor("Market · cohort rivals", "Dashboard intel blocks", market?.cohort?.competitors),
    pointFor("Market · demand pockets", "Audience → Customers", market?.demand?.pockets),
    pointFor("Market · keyword gap", "Audience → Keywords", market?.gap?.keywordGap),
    pointFor("Market · channel gaps", "Audience → Competitors", market?.gap?.channelGaps),
  ];
}

export async function loadScanDiagnostics(appId: string): Promise<ScanDiagnostics | null> {
  const db = serverDb();
  const { data: scan } = await db
    .from("scans")
    .select("id, status, started_at, completed_at, deepened_at, score_total, report_payload, dataforseo_cost_cents, tavily_cost_cents")
    .eq("app_id", appId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!scan) return null;

  const payload = scan.report_payload as unknown as ReportPayload | null;

  const [{ data: runRows }, { data: sigRows }] = await Promise.all([
    db.from("pipeline_runs").select("stage, model, tokens_in, tokens_out, cost_cents, duration_ms").eq("scan_id", scan.id),
    db.from("scan_signals").select("signal_key, pillar, state, normalised, weight").eq("scan_id", scan.id),
  ]);

  const stages: StageRun[] = (runRows ?? []).map((r) => ({
    stage: r.stage,
    model: r.model,
    tokensIn: Number(r.tokens_in ?? 0),
    tokensOut: Number(r.tokens_out ?? 0),
    costCents: Number(r.cost_cents ?? 0),
    durationMs: Number(r.duration_ms ?? 0),
  }));
  // Heaviest stages first — the audit reflex is "what cost the most?".
  stages.sort((a, b) => b.costCents - a.costCents || b.durationMs - a.durationMs);

  const signals: SignalRow[] = (sigRows ?? []).map((r) => ({
    key: r.signal_key,
    pillar: r.pillar,
    state: r.state ?? "unmeasured",
    normalised: r.normalised,
    weight: Number(r.weight ?? 0),
  }));

  const llmCostCents = stages.reduce((n, s) => n + s.costCents, 0);
  const dataforseoCostCents = Number(scan.dataforseo_cost_cents ?? 0);
  const tavilyCostCents = Number(scan.tavily_cost_cents ?? 0);

  return {
    scan: {
      id: scan.id,
      status: scan.status,
      startedAt: scan.started_at,
      completedAt: scan.completed_at,
      deepenedAt: scan.deepened_at,
      mode: payload?.mode ?? null,
    },
    onSiteScore: scan.score_total,
    marketPositionScore: payload?.marketPosition?.total ?? null,
    totalCostCents: llmCostCents,
    dataforseoCostCents,
    tavilyCostCents,
    allInCostCents: llmCostCents + dataforseoCostCents + tavilyCostCents,
    totalDurationMs: stages.reduce((n, s) => n + s.durationMs, 0),
    stages,
    dataMap: buildDataMap(payload),
    signals,
  };
}

/**
 * Sum external + LLM spend across every scan of every app a user owns.
 * User↔app linkage is `users.app_ids` (an array of app ids). Best-effort: a
 * missing user row or empty app list returns a zeroed rollup.
 */
export async function loadUserSpend(userId: string): Promise<UserSpend> {
  const zero: UserSpend = { scanCount: 0, llmCostCents: 0, dataforseoCostCents: 0, tavilyCostCents: 0, totalCostCents: 0 };
  const db = serverDb();
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
  const appIds = (user?.app_ids ?? []) as string[];
  if (appIds.length === 0) return zero;

  const { data: scans } = await db
    .from("scans")
    .select("cost_cents, dataforseo_cost_cents, tavily_cost_cents")
    .in("app_id", appIds);
  if (!scans || scans.length === 0) return zero;

  return scans.reduce<UserSpend>((acc, s) => {
    acc.scanCount += 1;
    acc.llmCostCents += Number(s.cost_cents ?? 0);
    acc.dataforseoCostCents += Number(s.dataforseo_cost_cents ?? 0);
    acc.tavilyCostCents += Number(s.tavily_cost_cents ?? 0);
    acc.totalCostCents = acc.llmCostCents + acc.dataforseoCostCents + acc.tavilyCostCents;
    return acc;
  }, { ...zero });
}
