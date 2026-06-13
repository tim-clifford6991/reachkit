/**
 * Watermark-scoped delta collectors (Cycle 4 Task 8).
 *
 * `collectDeltas` fetches ONLY what is newer than each monitor's watermark and
 * returns the deltas plus the advanced watermarks. It is the cheap-by-construction
 * input to the weekly refresh pipeline (Task 9): each kind asks its source for the
 * recent window, then filters down to genuinely-new items against the stored marker.
 *
 * Resilience contract (mirrors runFullCollect):
 *   - every kind-collector runs under Promise.allSettled
 *   - a dead/failing source degrades to an EMPTY delta that preserves the input
 *     watermark (no marker advance, nothing re-emitted next time)
 *   - the function itself NEVER throws and always returns one DeltaResult per
 *     monitor, in input order.
 *
 * Fixtures mode: each collector returns a small NON-EMPTY canned delta with an
 * advanced watermark, so the whole refresh runs keyless.
 *
 * Baseline (null/empty watermark) handling:
 *   - reviews / threads: BASELINE run sets the marker to the newest observed
 *     id/timestamp but returns items:[] — we don't flood the first refresh with
 *     the entire backfill; deltas start from the run after baseline.
 *   - rank: no baseline special-case — every keyword whose position differs from
 *     the (empty) prior map counts as changed on the first run.
 *   - competitors: no baseline special-case — every discovered name not already
 *     in knownCompetitors is new.
 */

import type { ScanContext } from "@/lib/scan/pipeline";
import type {
  Competitor,
  MonitorKind,
  PreliminaryFacts,
  ReviewItem,
  TimedCommunity,
  WatermarkBody,
} from "@/lib/scan/types";
import {
  fixturesEnabled,
  fixtureCompetitorDelta,
  fixtureRankDelta,
  fixtureReviewDelta,
  fixtureThreadDelta,
} from "@/lib/dev/fixtures";
import { fetchAppReviews } from "@/lib/scan/adapters/app-store-rss";
import { appIdFromUrl, fetchItunesCompetitors } from "@/lib/scan/adapters/itunes";
import { rankLookup } from "@/lib/scan/adapters/dataforseo-rank";
import { hnSearchTimed } from "@/lib/scan/adapters/hn-algolia";
import { blueskySearchTimed } from "@/lib/scan/adapters/bluesky";
import { tavilyAlternatives } from "@/lib/scan/adapters/tavily";

export interface DeltaResult {
  kind: MonitorKind;
  items: unknown[];
  newWatermark: WatermarkBody;
}

const KINDS: readonly MonitorKind[] = ["reviews", "rank", "threads", "competitors"];

function isMonitorKind(k: string): k is MonitorKind {
  return (KINDS as readonly string[]).includes(k);
}

export async function collectDeltas(
  ctx: ScanContext,
  monitors: { kind: string; watermark: WatermarkBody }[],
  facts: PreliminaryFacts,
): Promise<DeltaResult[]> {
  // Each collector is wrapped so one dead source degrades to an empty delta that
  // preserves the input watermark — collectDeltas itself never throws.
  const settled = await Promise.allSettled(
    monitors.map((m) => collectOne(ctx, m.kind, m.watermark ?? {}, facts)),
  );

  return settled.map((res, i) => {
    const monitor = monitors[i];
    const kind = monitor ? monitor.kind : "";
    const watermark = monitor?.watermark ?? {};
    if (res.status === "fulfilled") return res.value;
    // Rejected (shouldn't happen — collectOne is internally guarded — but stay safe):
    // empty delta, watermark unchanged.
    return { kind: isMonitorKind(kind) ? kind : "reviews", items: [], newWatermark: watermark };
  });
}

// Dispatch + per-collector guard. Unknown kinds and failures degrade to an empty
// delta that preserves the input watermark.
async function collectOne(
  ctx: ScanContext,
  kind: string,
  watermark: WatermarkBody,
  facts: PreliminaryFacts,
): Promise<DeltaResult> {
  if (!isMonitorKind(kind)) {
    return { kind: "reviews", items: [], newWatermark: watermark };
  }
  try {
    switch (kind) {
      case "reviews":     return await collectReviews(ctx, watermark);
      case "rank":        return await collectRank(ctx, watermark, facts);
      case "threads":     return await collectThreads(ctx, watermark, facts);
      case "competitors": return await collectCompetitors(ctx, watermark, facts);
    }
  } catch {
    // Any failure → empty delta, watermark preserved (no advance, no re-emit).
    return { kind, items: [], newWatermark: watermark };
  }
}

// --- reviews ----------------------------------------------------------------
// Newest-first window; "newer than watermark" = items before the watermark id.
async function collectReviews(ctx: ScanContext, watermark: WatermarkBody): Promise<DeltaResult> {
  const lastReviewId = watermark.lastReviewId ?? null;

  if (fixturesEnabled()) {
    const { items, newestId } = fixtureReviewDelta();
    if (lastReviewId == null) {
      // baseline — set marker, emit nothing
      return { kind: "reviews", items: [], newWatermark: { ...watermark, lastReviewId: newestId } };
    }
    // Already at the newest fixture id → nothing new (idempotent re-run).
    const fresh = lastReviewId === newestId ? [] : items;
    return { kind: "reviews", items: fresh, newWatermark: { ...watermark, lastReviewId: newestId } };
  }

  const appId = appIdFromUrl(ctx.storeUrl);
  const reviews = await fetchAppReviews(appId);          // most-recent-first
  const withIds = reviews.filter((r): r is ReviewItem & { id: string } => typeof r.id === "string" && r.id !== "");
  const newest = withIds[0]?.id ?? lastReviewId;         // keep marker if window had no ids

  if (lastReviewId == null) {
    // baseline — set marker to newest, emit nothing
    return { kind: "reviews", items: [], newWatermark: { ...watermark, lastReviewId: newest } };
  }

  // Items above the watermark id in the most-recent-first list. If the id isn't
  // in the window (rolled past), every fetched review counts as new.
  const idx = withIds.findIndex((r) => r.id === lastReviewId);
  const fresh = idx === -1 ? withIds : withIds.slice(0, idx);
  return { kind: "reviews", items: fresh, newWatermark: { ...watermark, lastReviewId: newest } };
}

// --- rank -------------------------------------------------------------------
// items = entries whose position CHANGED vs watermark.topRanks; newWatermark.topRanks
// = the fresh full map.
async function collectRank(ctx: ScanContext, watermark: WatermarkBody, facts: PreliminaryFacts): Promise<DeltaResult> {
  const prev = watermark.topRanks ?? {};

  if (fixturesEnabled()) {
    const { changed, fresh } = fixtureRankDelta(prev);
    return { kind: "rank", items: changed, newWatermark: { ...watermark, topRanks: fresh } };
  }

  const keywords = rankKeywords(facts);
  if (keywords.length === 0) {
    return { kind: "rank", items: [], newWatermark: { ...watermark, topRanks: prev } };
  }
  const fresh = await rankLookup(keywords, ctx.storeUrl);  // never throws → {} on failure
  const changed = Object.entries(fresh).flatMap(([keyword, to]) => {
    const from = prev[keyword] ?? null;
    return from === to ? [] : [{ keyword, from, to }];
  });
  return { kind: "rank", items: changed, newWatermark: { ...watermark, topRanks: fresh } };
}

// A few keywords derived from facts.themes (fallback: listing name/category).
function rankKeywords(facts: PreliminaryFacts): string[] {
  const fromThemes = facts.themes.map((t) => t.term).filter((t) => t.length > 0).slice(0, 5);
  if (fromThemes.length > 0) return fromThemes;
  const fallback: string[] = [];
  if (facts.listing.name) fallback.push(facts.listing.name);
  if (facts.listing.category) fallback.push(facts.listing.category);
  return fallback;
}

// --- threads ----------------------------------------------------------------
// HN + Bluesky; keep threads with timestamp > lastThreadAt; baseline → items:[]
// with the marker set to the newest ts.
async function collectThreads(ctx: ScanContext, watermark: WatermarkBody, facts: PreliminaryFacts): Promise<DeltaResult> {
  const lastThreadAt = watermark.lastThreadAt ?? null;

  if (fixturesEnabled()) {
    const { items, newestAt } = fixtureThreadDelta();
    if (lastThreadAt == null) {
      return { kind: "threads", items: [], newWatermark: { ...watermark, lastThreadAt: newestAt } };
    }
    const fresh = items.filter((t) => t.at > lastThreadAt);
    return { kind: "threads", items: fresh, newWatermark: { ...watermark, lastThreadAt: newestAt } };
  }

  const topic = threadTopic(facts);
  const [hn, bsky] = await Promise.allSettled([hnSearchTimed(topic), blueskySearchTimed(topic)]);
  const all: TimedCommunity[] = [
    ...(hn.status === "fulfilled" ? hn.value : []),
    ...(bsky.status === "fulfilled" ? bsky.value : []),
  ];
  // Dedupe by url, keeping the first occurrence.
  const seen = new Set<string>();
  const deduped = all.filter((t) => (seen.has(t.url) ? false : (seen.add(t.url), true)));

  const newest = deduped.reduce<string | null>((max, t) => (max == null || t.at > max ? t.at : max), lastThreadAt);

  if (lastThreadAt == null) {
    return { kind: "threads", items: [], newWatermark: { ...watermark, lastThreadAt: newest } };
  }
  const fresh = deduped.filter((t) => t.at > lastThreadAt);
  return { kind: "threads", items: fresh, newWatermark: { ...watermark, lastThreadAt: newest } };
}

function threadTopic(facts: PreliminaryFacts): string {
  return facts.listing.name || facts.listing.category || "";
}

// --- competitors ------------------------------------------------------------
// items = discovered names NOT in watermark.knownCompetitors; newWatermark.knownCompetitors
// = union(old, found).
async function collectCompetitors(ctx: ScanContext, watermark: WatermarkBody, facts: PreliminaryFacts): Promise<DeltaResult> {
  const known = watermark.knownCompetitors ?? [];

  if (fixturesEnabled()) {
    const { newNames, found } = fixtureCompetitorDelta(known);
    return { kind: "competitors", items: newNames, newWatermark: { ...watermark, knownCompetitors: unionNames(known, found) } };
  }

  const found = await discoverCompetitorNames(ctx, facts);
  const knownSet = new Set(known);
  const newNames = found.filter((n) => !knownSet.has(n));
  return { kind: "competitors", items: newNames, newWatermark: { ...watermark, knownCompetitors: unionNames(known, found) } };
}

// Discover current competitor names. App modes use the iTunes search adapter; web
// mode uses Tavily. Each source degrades to [] on failure.
async function discoverCompetitorNames(ctx: ScanContext, facts: PreliminaryFacts): Promise<string[]> {
  const productName = facts.listing.name || "";
  if (productName === "") return [];

  const competitors: Competitor[] = ctx.mode === "web"
    ? (await tavilyAlternatives(productName).catch(() => ({ competitors: [] }))).competitors
    : await fetchItunesCompetitors(productName, appIdFromUrl(ctx.storeUrl)).catch(() => []);
  return competitors.map((c) => c.name).filter((n) => n.length > 0);
}

function unionNames(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}
