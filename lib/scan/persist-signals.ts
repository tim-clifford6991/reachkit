/**
 * persistScanSignals — computes the 18-signal rows for a scan and writes them to
 * scan_signals. Best-effort and idempotent (clears + re-inserts per scan). The
 * headline score is unchanged (still v1); these rows power the explainability
 * panel + breakdown chart and the future score-model flip.
 */

import { serverDb } from "@/lib/db/client";
import { extractHtmlSignals } from "./extract-html";
import { computeScanSignals, type MarketSignalInputs } from "./compute-signals";
import type { ScoreComponents } from "./score-full";
import type { Platform } from "./router";
import type { MarketAnalysis } from "./gap";

/** Derive the thin layer-3 signal inputs from a (paid) market analysis. */
export function marketToSignalInputs(
  market: MarketAnalysis | null | undefined,
): MarketSignalInputs | null {
  if (!market) return null;
  const self = market.cohort?.self;
  const seo = self?.seo ?? null;
  const channels = self?.channels ?? [];
  return {
    organicKeywords: seo?.organicKeywords ?? null,
    rankedKeywordCount: seo?.rankedKeywords?.length ?? null,
    referringDomains: seo?.referringDomains ?? null,
    marketplaceCount: self?.marketplace?.filter((m) => m.present).length ?? null,
    communityMentions: self?.communities?.reduce((a, c) => a + (c.mentions ?? 0), 0) ?? null,
    shareOfVoicePct: market.gap?.shareOfVoice?.selfPct ?? null,
    ownedChannelCount: self ? channels.length : null,
    contentPostsPerMonth: self ? channels.reduce((a, c) => Math.max(a, c.cadence?.postsPerMonth ?? 0), 0) : null,
    recentBuzzCount: market.recentBuzz?.length ?? null,
  };
}

async function readSubjectHtml(subjectKey: string): Promise<string | null> {
  const { data } = await serverDb()
    .from("raw_documents")
    .select("body")
    .eq("subject_type", "web")
    .eq("subject_key", subjectKey)
    .eq("source_type", "site_fetch")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const body = data?.body as unknown;
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const raw = rec.raw ?? rec.html;
    if (typeof raw === "string") return raw;
  }
  return null;
}

export async function persistScanSignals(args: {
  scanId: string;
  mode: Platform;
  storeUrl: string;
  components: ScoreComponents;
  market: MarketAnalysis | null | undefined;
}): Promise<void> {
  const { scanId, mode, storeUrl, components, market } = args;

  const rawHtml = mode === "web" ? await readSubjectHtml(storeUrl) : null;
  const html = rawHtml ? extractHtmlSignals(rawHtml) : null;
  const rows = computeScanSignals(mode, html, components, marketToSignalInputs(market));

  const db = serverDb();
  await db.from("scan_signals").delete().eq("scan_id", scanId);
  await db.from("scan_signals").insert(
    rows.map((r) => ({
      scan_id: scanId,
      signal_key: r.signalKey,
      pillar: r.pillar,
      raw_value: r.rawValue,
      normalised: r.normalised,
      weight: r.weight,
      contribution: r.contribution,
      state: r.state,
      platform: r.platform,
    })),
  );
}
