/**
 * Score pulse — the cheapest possible iterative tracking.
 *
 * When a founder ships something (publishes the article, fixes the meta,
 * posts the content), their score should move WITHOUT paid API calls. The
 * 18-signal score is deterministic and its on-page half comes from a plain
 * HTTP crawl of their own site; the paid wire signals (DataForSEO) live
 * behind the 7–30-day global cache and the Monday weekly refresh, and are
 * deliberately NOT touched here.
 *
 * A pulse = fresh own-site crawl (one GET) → recompute the free parse signals
 * (`persistScanSignals({market: null})` — never regresses cached wire
 * signals) → deterministic score → `score_snapshots` row (source "pulse").
 *
 * Triggers: action verification (verify.ts re-crawls before it snapshots) and
 * the Thursday score-pulse cron — so the score breathes between Monday
 * refreshes at zero marginal cost.
 */

import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { persistScanSignals } from "@/lib/scan/persist-signals";
import { headlineFromRows, unifiedHeadline, type RegistryScoreRow } from "@/lib/scan/registry-score";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

type Platform = ScanContext["mode"];

/**
 * Coerce a persisted preliminary_facts blob into the minimal PreliminaryFacts
 * the score gatherer reads. Degrades to a safe empty-shape for the platform
 * when the blob is missing/malformed. (Shared by verify + pulse.)
 */
export function coerceFacts(raw: Json | null, platform: Platform): PreliminaryFacts {
  const empty: PreliminaryFacts = {
    mode: platform,
    listing: { name: "", category: null, description: null },
    competitors: [],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: null,
    themes: [],
    sourcesUsed: [],
    coldStart: true, // no footprint in this degraded placeholder; overridden by the persisted blob below
  };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return empty;
  return { ...empty, ...(raw as Partial<PreliminaryFacts>), mode: platform };
}

/**
 * Fresh own-site crawl → raw_documents ("site_fetch", keyed by storeUrl, the
 * key `readSubjectHtml` reads newest-first). Free: one HTTP GET. Never throws —
 * a failed crawl just means the parse signals score from the last stored HTML.
 */
export async function refreshSiteCrawl(storeUrl: string): Promise<boolean> {
  try {
    const { raw } = await fetchSiteListing(storeUrl);
    if (!raw) return false;
    await upsertRawDocument({
      subjectType: "web",
      subjectKey: storeUrl,
      sourceType: "site_fetch",
      url: storeUrl,
      body: raw,
      mode: "web",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run one score pulse for an app. Zero paid calls by construction: the crawl
 * is a plain GET, `market: null` keeps DataForSEO untouched, and the score is
 * deterministic arithmetic over stored components.
 */
export async function runScorePulse(
  appId: string,
): Promise<{ skipped: boolean; total?: number }> {
  const db = serverDb();

  const { data: app } = await db
    .from("apps")
    .select("store_url, platform")
    .eq("id", appId)
    .maybeSingle();
  if (!app?.store_url) return { skipped: true };
  const mode: Platform =
    app.platform === "ios" || app.platform === "android" ? app.platform : "web";

  // An app that has never scanned has no components to score.
  const { data: scanRow } = await db
    .from("scans")
    .select("id, preliminary_facts")
    .eq("app_id", appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!scanRow) return { skipped: true };

  // The point of the pulse: score the LIVE page, not last week's copy.
  if (mode === "web") await refreshSiteCrawl(app.store_url);

  const facts = coerceFacts((scanRow.preliminary_facts as Json | null) ?? null, mode);
  const ctx: ScanContext = {
    scanId: scanRow.id,
    appId,
    storeUrl: app.store_url,
    mode,
    budget: new ScanBudget({ maxToolCalls: 10, budgetCents: env.scanBudgetCents }),
  };

  const components = await gatherScoreComponents(ctx, facts);
  const score = verifiedScore(components, mode);

  let rows: RegistryScoreRow[] = [];
  try {
    await persistScanSignals({ scanId: scanRow.id, mode, storeUrl: app.store_url, components, market: null });
    const { data } = await db
      .from("scan_signals")
      .select("signal_key, pillar, weight, normalised, state")
      .eq("scan_id", scanRow.id);
    rows = (data ?? []).map((r) => ({
      signalKey: (r.signal_key as string | null) ?? undefined,
      pillar: r.pillar as RegistryScoreRow["pillar"],
      weight: (r.weight as number | null) ?? 0,
      normalised: r.normalised as number | null,
      state: (r.state as string | null) ?? "unmeasured",
    }));
  } catch (e) {
    console.error("[pulse] persistScanSignals failed (best-effort)", e);
  }

  // v5: reuse the persisted search-presence score → the midweek pulse point lands on
  // the unified Discoverability scale.
  const { data: rpRow } = await db.from("scans").select("report_payload").eq("id", scanRow.id).maybeSingle();
  const searchPresence = (rpRow?.report_payload as { searchVisibility?: { score?: number } } | null)?.searchVisibility?.score ?? null;
  const headline = unifiedHeadline(headlineFromRows(mode, score, rows), searchPresence);
  const { error } = await db.from("score_snapshots").insert({
    app_id: appId,
    total: headline.total,
    breakdown: headline.breakdown as unknown as Json,
    score_version: headline.version,
    source: "pulse",
    scan_id: scanRow.id,
  });
  if (error) throw error;

  return { skipped: false, total: headline.total };
}
