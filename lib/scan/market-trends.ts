/**
 * Market trends reader (ChannelIntel UX — the trends UI).
 *
 * The weekly refresh writes a `market_snapshots` row per app (self + rival SEO,
 * share-of-voice, keyword-gap + demand-pocket counts). Nothing surfaced it. This
 * turns the snapshot history into sparkline-ready series:
 *   - share of voice (%)
 *   - your organic keywords vs the rival median
 *   - keyword-gap count
 *   - demand-pocket count
 *
 * `buildMarketTrend` is PURE + defensive (older/partial summaries are skipped per
 * metric), so it's unit-testable without a DB. A metric is only included when it
 * has ≥2 points (a single point is no trend).
 */

import { serverDb } from "@/lib/db/client";

export interface TrendMetric {
  key: string;
  label: string;
  /** Chronological values, oldest-first. */
  values: number[];
  current: number | null;
  previous: number | null;
  /** Display unit suffix, e.g. "%" or " kw". */
  unit: string;
}

export interface MarketTrend {
  /** Number of weekly snapshots considered. */
  weeks: number;
  metrics: TrendMetric[];
}

interface SnapshotInput {
  takenAt: string;
  summary: unknown;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Extract one metric's chronological value from each snapshot (null → skipped). */
function extract(snapshots: SnapshotInput[], pick: (summary: Record<string, unknown>) => number | null): number[] {
  const out: number[] = [];
  for (const s of snapshots) {
    if (!s.summary || typeof s.summary !== "object") continue;
    const v = pick(s.summary as Record<string, unknown>);
    if (v !== null) out.push(v);
  }
  return out;
}

function metric(key: string, label: string, unit: string, values: number[]): TrendMetric | null {
  if (values.length < 2) return null;
  return {
    key,
    label,
    unit,
    values,
    current: values[values.length - 1] ?? null,
    previous: values[values.length - 2] ?? null,
  };
}

/** PURE: build the trend series from chronological (oldest-first) snapshots. */
export function buildMarketTrend(snapshots: SnapshotInput[]): MarketTrend {
  const sov = extract(snapshots, (s) => (isNum(s.selfSharePct) ? Math.round(s.selfSharePct * 100) : null));
  const selfKw = extract(snapshots, (s) => {
    const self = s.self as Record<string, unknown> | undefined;
    return self && isNum(self.organicKeywords) ? self.organicKeywords : null;
  });
  const rivalMedianKw = extract(snapshots, (s) => {
    const rivals = Array.isArray(s.rivals) ? (s.rivals as Array<Record<string, unknown>>) : [];
    const kws = rivals.map((r) => r.organicKeywords).filter(isNum);
    return kws.length > 0 ? Math.round(median(kws)) : null;
  });
  const keywordGap = extract(snapshots, (s) => (isNum(s.keywordGapCount) ? s.keywordGapCount : null));
  const demandPockets = extract(snapshots, (s) => (isNum(s.demandPocketCount) ? s.demandPocketCount : null));

  const metrics = [
    metric("sov", "Share of voice", "%", sov),
    metric("self_keywords", "Your organic keywords", " kw", selfKw),
    metric("rival_median_keywords", "Rival median keywords", " kw", rivalMedianKw),
    metric("keyword_gap", "Keyword opportunities", "", keywordGap),
    metric("demand_pockets", "Demand pockets", "", demandPockets),
  ].filter((m): m is TrendMetric => m !== null);

  return { weeks: snapshots.length, metrics };
}

/** Read an app's market-snapshot history and build the trend series. */
export async function marketTrendSeries(appId: string): Promise<MarketTrend> {
  const { data, error } = await serverDb()
    .from("market_snapshots")
    .select("taken_at, summary")
    .eq("app_id", appId)
    .order("taken_at", { ascending: true });
  if (error || !data) return { weeks: 0, metrics: [] };
  return buildMarketTrend(data.map((r) => ({ takenAt: r.taken_at, summary: r.summary })));
}
