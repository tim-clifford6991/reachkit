/**
 * Full-scan orchestration (Cycle 3 Task 13) — the heavy second pass that turns
 * preliminary facts into a persisted four-question report (§5.6) + action plan.
 *
 * Stage order:
 *   1. runFullCollect   — keyword / community / creator raw_documents
 *   2. runExtract       — re-extract so the keyword_data sheet (and the others)
 *                         reflect the freshly-collected docs (idempotent upsert)
 *   3. read findings    — from scans.findings_payload (written by the Cycle 2
 *                         findings pipeline); degrade to empty if absent
 *   4. generateActions  — over-generate §10.2 ActionCards from the fact sheets
 *   5. runCriticGate    — Critic Gate v2 (drop/downgrade); then algorithmSafety (§11)
 *   6. verifiedScore    — §7 anti-vanity verified Discoverability Score + radar
 *   7. gather + assemble — icpSignals / surfaces / competitorGap → assembleReport
 *   8. persistReport    — scans.report_payload
 *   9. persist actions  — idempotent (delete by scan_id, then insert the safe set)
 *  10. update score     — scans.score_total / score_breakdown
 *  11. seedMonitors     — seed the 4 weekly monitors (best-effort, idempotent)
 *  12. emit "report"     — scan_event with the score + action count
 *
 * On any failure: emit an "error" scan_event and rethrow (so Inngest retries /
 * marks the run failed via onFailure).
 *
 * Fixture-aware throughout: every paid call (collect tools, extract, action-gen,
 * Critic LLM, embeddings) short-circuits to fixtures when REACHKIT_USE_FIXTURES=true,
 * so the whole pass runs keyless in dev/test.
 */

import { serverDb } from "@/lib/db/client";
import { runFullCollect } from "@/lib/scan/full-collect";
import { runExtract } from "@/lib/llm/extract";
import { generateActions } from "@/lib/llm/actions";
import { generateColdStartActions } from "@/lib/llm/cold-start-actions";
import { runCriticGate } from "@/lib/llm/critic";
import { algorithmSafety } from "@/lib/scan/algorithm-safety";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { assembleReport, persistReport } from "@/lib/scan/report";
import type {
  CompetitiveLandscapeRow,
  ChannelOpportunities,
  CreatorReach,
  KeywordCluster,
  EngagedCommunity,
  ReviewTheme,
} from "@/lib/scan/report";
import { seedMonitors } from "@/lib/scan/monitors";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { parseKeywords } from "@/lib/scan/adapters/keywords";
import { checkScanCostOverrun } from "@/lib/telemetry/pipeline-runs";
import { emitScanEvent } from "@/lib/scan/progress";
import { env } from "@/lib/config/env";
import { hostname } from "@/lib/scan/url";
import { runMarketAnalysis } from "@/lib/scan/gap";
import { countMentions } from "@/lib/scan/competitor-mentions";
import { normalizeName } from "@/lib/scan/competitor-filter";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Finding, PositioningMirror, ActionCard } from "@/lib/llm/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Report-input shapes (subset of assembleReport's input)
// ---------------------------------------------------------------------------
type Surface = { source: string; title: string; url: string };
type GapRow = { competitor: string; dimension: string; them: number; you: number; positioning?: string; gap?: string };

/** Max communities surfaced (by engagement) in the channel-opportunities section. */
const TOP_COMMUNITIES = 12;

const EMPTY_MIRROR: PositioningMirror = { listingSays: "", reviewsValue: "", gap: "" };

// ---------------------------------------------------------------------------
// findings_payload reader — degrade gracefully if absent / malformed
// ---------------------------------------------------------------------------
async function readFindingsPayload(
  scanId: string,
): Promise<{ findings: Finding[]; positioningMirror: PositioningMirror }> {
  const db = serverDb();
  const { data, error } = await db
    .from("scans")
    .select("findings_payload")
    .eq("id", scanId)
    .single();
  if (error) throw error;

  const payload = (data?.findings_payload ?? null) as {
    findings?: unknown;
    positioningMirror?: unknown;
  } | null;

  const findings = Array.isArray(payload?.findings) ? (payload.findings as Finding[]) : [];
  const mirror =
    payload?.positioningMirror !== undefined && payload.positioningMirror !== null
      ? (payload.positioningMirror as PositioningMirror)
      : EMPTY_MIRROR;

  return { findings, positioningMirror: mirror };
}

// ---------------------------------------------------------------------------
// icpSignals — theme strings from the review_themes fact sheet (degrade to [])
// ---------------------------------------------------------------------------
async function readIcpSignals(subjectType: string, subjectKey: string): Promise<string[]> {
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "review_themes");
    if (sheet === null) return [];
    const body = sheet.body as { themes?: unknown };
    const themes = Array.isArray(body.themes) ? body.themes : [];
    const signals: string[] = [];
    for (const t of themes) {
      const theme = (t as Record<string, unknown>)["theme"];
      if (typeof theme === "string" && theme.length > 0) signals.push(theme);
    }
    return signals;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// surfaces — where the audience is: communities + creators raw_documents
// (subject_key = storeUrl; communities body = Community[], youtube body = Creator[])
// ---------------------------------------------------------------------------
async function readSurfaces(subjectKey: string): Promise<Surface[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("source_type, body")
      .eq("subject_key", subjectKey)
      .in("source_type", ["communities", "youtube"]);
    if (error || data === null) return [];

    const surfaces: Surface[] = [];
    for (const row of data) {
      const items = Array.isArray(row.body) ? (row.body as unknown[]) : [];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        const url = obj["url"];
        if (typeof url !== "string" || url.length === 0) continue;

        if (row.source_type === "communities") {
          const source = typeof obj["source"] === "string" ? obj["source"] : "community";
          const title = typeof obj["title"] === "string" ? obj["title"] : url;
          surfaces.push({ source, title, url });
        } else {
          // youtube creators — Creator.name is the channel/video title
          const title = typeof obj["name"] === "string" ? obj["name"] : url;
          surfaces.push({ source: "youtube", title, url });
        }
      }
    }
    return surfaces;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Community raw_document bodies — used to count competitor mentions for a real
// "them vs you" signal (replaces the old 1-vs-0 placeholder).
// ---------------------------------------------------------------------------
async function readCommunityBodies(subjectKey: string): Promise<unknown[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("body")
      .eq("subject_key", subjectKey)
      .eq("source_type", "communities");
    if (error || data === null) return [];
    return data.map((r) => r.body);
  } catch {
    return [];
  }
}

// competitorGap — from the competitor_gap fact sheet (carrying the real
// positioning + gap strings), else derived from facts. `them`/`you` are real
// community-mention counts, not a placeholder.
// ---------------------------------------------------------------------------
async function readCompetitorGap(
  subjectType: string,
  subjectKey: string,
  facts: PreliminaryFacts,
): Promise<GapRow[]> {
  const communityBodies = await readCommunityBodies(subjectKey);
  const youMentions = countMentions(facts.listing.name, communityBodies);

  const rowFor = (name: string, positioning?: string, gap?: string): GapRow => ({
    competitor: name,
    dimension: "community presence",
    them: countMentions(name, communityBodies),
    you: youMentions,
    ...(positioning ? { positioning } : {}),
    ...(gap ? { gap } : {}),
  });

  const fromFacts = (): GapRow[] =>
    facts.competitors
      .filter((c) => typeof c.name === "string" && c.name.length > 0)
      .map((c) => rowFor(c.name));

  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "competitor_gap");
    if (sheet === null) return fromFacts();
    const body = sheet.body as { competitors?: unknown };
    const comps = Array.isArray(body.competitors) ? body.competitors : [];
    // Index the sheet's positioning/gap strings by normalised competitor name.
    const enrichByName = new Map<string, { positioning?: string; gap?: string }>();
    for (const c of comps) {
      const obj = c as Record<string, unknown>;
      const name = obj["name"];
      if (typeof name === "string" && name.length > 0) {
        enrichByName.set(normalizeName(name), {
          positioning: typeof obj["positioning"] === "string" ? (obj["positioning"] as string) : undefined,
          gap: typeof obj["gap"] === "string" ? (obj["gap"] as string) : undefined,
        });
      }
    }
    // Brand-ambiguity hard rule: the gap report is built ONLY from the
    // category-validated discovery set (facts.competitors, anchored by
    // extractCompetitorNames). The competitor_gap extract reads raw "alternatives"
    // content that can mix in a same-named DIFFERENT product's rivals
    // (e.g. acquire.io live-chat's Zendesk/Crisp for acquire.com) — those must
    // NEVER surface. We enrich each validated competitor with the sheet's
    // positioning/gap strings when the names match.
    const gap = facts.competitors
      .filter((c) => typeof c.name === "string" && c.name.length > 0)
      .map((c) => {
        const enrich = enrichByName.get(normalizeName(c.name));
        return rowFor(c.name, enrich?.positioning, enrich?.gap);
      });
    return gap.length > 0 ? gap : fromFacts();
  } catch {
    return fromFacts();
  }
}

// ---------------------------------------------------------------------------
// Deep sections — surfaced from already-persisted data (no new external calls).
// Every reader degrades to empty so legacy / partial scans never throw.
// ---------------------------------------------------------------------------

/** Creators/influencers from the youtube raw_documents (deduped by url). */
async function readCreatorDocs(subjectKey: string): Promise<CreatorReach[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("body")
      .eq("subject_key", subjectKey)
      .eq("source_type", "youtube");
    if (error || data === null) return [];

    const seen = new Set<string>();
    const out: CreatorReach[] = [];
    for (const row of data) {
      const items = Array.isArray(row.body) ? (row.body as unknown[]) : [];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const o = item as Record<string, unknown>;
        const url = typeof o["url"] === "string" ? o["url"] : "";
        if (url.length === 0 || seen.has(url)) continue;
        seen.add(url);
        out.push({
          name: typeof o["name"] === "string" && o["name"].length > 0 ? (o["name"] as string) : url,
          url,
          coveredCompetitor: typeof o["coveredCompetitor"] === "string" ? (o["coveredCompetitor"] as string) : "",
          // audienceProxy is currently always 0 (the youtube adapter doesn't
          // make the second videos.list call) — kept for forward-compat.
          audienceProxy: typeof o["audienceProxy"] === "number" ? (o["audienceProxy"] as number) : 0,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Communities sorted by engagement (the hidden Community.engagement signal). */
async function readCommunitiesByEngagement(subjectKey: string): Promise<EngagedCommunity[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("body")
      .eq("subject_key", subjectKey)
      .eq("source_type", "communities");
    if (error || data === null) return [];

    const seen = new Set<string>();
    const out: EngagedCommunity[] = [];
    for (const row of data) {
      const items = Array.isArray(row.body) ? (row.body as unknown[]) : [];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const o = item as Record<string, unknown>;
        const url = typeof o["url"] === "string" ? o["url"] : "";
        if (url.length === 0 || seen.has(url)) continue;
        seen.add(url);
        out.push({
          source: typeof o["source"] === "string" ? (o["source"] as string) : "community",
          title: typeof o["title"] === "string" ? (o["title"] as string) : url,
          url,
          engagement: typeof o["engagement"] === "number" ? (o["engagement"] as number) : 0,
        });
      }
    }
    out.sort((a, b) => b.engagement - a.engagement);
    return out.slice(0, TOP_COMMUNITIES);
  } catch {
    return [];
  }
}

/** cpc/competition per keyword from the raw dataforseo_keywords doc (the
 *  keyword_data fact sheet drops these — only volume survives there). */
async function readKeywordMetrics(
  subjectKey: string,
): Promise<Map<string, { cpc: number; competition: number }>> {
  const map = new Map<string, { cpc: number; competition: number }>();
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("body")
      .eq("subject_key", subjectKey)
      .eq("source_type", "dataforseo_keywords");
    if (error || data === null) return map;
    for (const row of data) {
      for (const r of parseKeywords(row.body)) {
        map.set(r.keyword.toLowerCase(), { cpc: r.cpc, competition: r.competition });
      }
    }
  } catch {
    /* ignore — degrade to volume-only */
  }
  return map;
}

/** Keyword clusters (from the keyword_data sheet) enriched with cpc/competition. */
async function readKeywordClusters(subjectType: string, subjectKey: string): Promise<KeywordCluster[]> {
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "keyword_data");
    if (sheet === null) return [];
    const body = sheet.body as { clusters?: unknown };
    const clusters = Array.isArray(body.clusters) ? body.clusters : [];
    const metrics = await readKeywordMetrics(subjectKey);

    const out: KeywordCluster[] = [];
    for (const c of clusters) {
      const co = c as Record<string, unknown>;
      const theme = typeof co["theme"] === "string" ? (co["theme"] as string) : "";
      const kws = Array.isArray(co["keywords"]) ? (co["keywords"] as unknown[]) : [];
      const keywords = kws
        .map((k) => {
          const ko = k as Record<string, unknown>;
          const keyword = typeof ko["keyword"] === "string" ? (ko["keyword"] as string) : "";
          const volume = typeof ko["volume"] === "number" ? (ko["volume"] as number) : 0;
          const m = metrics.get(keyword.toLowerCase());
          return { keyword, volume, cpc: m?.cpc ?? 0, competition: m?.competition ?? 0 };
        })
        .filter((k) => k.keyword.length > 0);
      if (theme.length > 0 && keywords.length > 0) out.push({ theme, keywords });
    }
    return out;
  } catch {
    return [];
  }
}

/** Channel & keyword opportunities — keyword clusters + communities by engagement. */
async function readChannelOpportunities(
  subjectType: string,
  subjectKey: string,
): Promise<ChannelOpportunities> {
  const [keywordClusters, communitiesByEngagement] = await Promise.all([
    readKeywordClusters(subjectType, subjectKey),
    readCommunitiesByEngagement(subjectKey),
  ]);
  return { keywordClusters, communitiesByEngagement };
}

/** Review themes partitioned by sentiment (sentiment + quote are dropped by
 *  readIcpSignals, which keeps only the theme string). */
async function readReviewThemesFull(
  subjectType: string,
  subjectKey: string,
): Promise<{ strengths: ReviewTheme[]; weaknesses: ReviewTheme[]; mixed: ReviewTheme[] }> {
  const empty = { strengths: [] as ReviewTheme[], weaknesses: [] as ReviewTheme[], mixed: [] as ReviewTheme[] };
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "review_themes");
    if (sheet === null) return empty;
    const body = sheet.body as { themes?: unknown };
    const themes = Array.isArray(body.themes) ? body.themes : [];
    const out = { strengths: [] as ReviewTheme[], weaknesses: [] as ReviewTheme[], mixed: [] as ReviewTheme[] };
    for (const t of themes) {
      const o = t as Record<string, unknown>;
      const theme = typeof o["theme"] === "string" ? (o["theme"] as string) : "";
      if (theme.length === 0) continue;
      const quote = typeof o["quote"] === "string" ? (o["quote"] as string) : "";
      const row: ReviewTheme = { theme, quote };
      const sentiment = o["sentiment"];
      if (sentiment === "positive") out.strengths.push(row);
      else if (sentiment === "negative") out.weaknesses.push(row);
      else out.mixed.push(row);
    }
    return out;
  } catch {
    return empty;
  }
}

/** Compose the competitive landscape from the (brand-validated) gap rows + the
 *  creators index — never resurrects collision data, since competitorGap is
 *  already built only from facts.competitors. */
function buildCompetitiveLandscape(
  competitorGap: GapRow[],
  creators: CreatorReach[],
): CompetitiveLandscapeRow[] {
  const byCompetitor = new Map<string, Array<{ name: string; url: string }>>();
  for (const c of creators) {
    if (c.coveredCompetitor.length === 0) continue;
    const key = normalizeName(c.coveredCompetitor);
    const list = byCompetitor.get(key) ?? [];
    if (!list.some((x) => x.url === c.url)) list.push({ name: c.name, url: c.url });
    byCompetitor.set(key, list);
  }
  return competitorGap.map((g) => ({
    competitor: g.competitor,
    positioning: g.positioning ?? null,
    gap: g.gap ?? null,
    communityMentions: g.them,
    creators: byCompetitor.get(normalizeName(g.competitor)) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Persist the Critic-passed, algorithm-safe actions to the actions table.
// Idempotent: delete existing rows for this scan first, then insert.
// ---------------------------------------------------------------------------
async function persistActions(ctx: ScanContext, actions: ActionCard[]): Promise<void> {
  const db = serverDb();

  const { error: delErr } = await db.from("actions").delete().eq("scan_id", ctx.scanId);
  if (delErr) throw delErr;

  if (actions.length === 0) return;

  const rows = actions.map((a) => ({
    app_id: ctx.appId,
    scan_id: ctx.scanId,
    category: a.category,
    title: a.title,
    why: a.why,
    basis: a.basis,
    confidence: a.confidence,
    deadline: a.suggestedDeadline,
    draft: a.draft,
    draft_requires_edit: a.draftRequiresEdit,
    effort_min: a.effortMin,
    evidence_ids: a.evidenceIds,
    expected_outcome: a.expectedOutcome as unknown as Json,
    score_component: a.expectedOutcome.scoreComponent,
    verification: a.verification as unknown as Json,
  }));

  const { error: insErr } = await db.from("actions").insert(rows);
  if (insErr) throw insErr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function runFullScan(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  try {
    // 1. Heavy collect (keywords / communities / creators)
    await runFullCollect(ctx, facts);

    // 2. Re-extract ONLY the keyword_data sheet to reflect the freshly-collected
    //    keyword docs — re-running positioning/review/competitor here would re-read
    //    the (expensive) site HTML for no benefit (those sources didn't change).
    await runExtract(ctx, ["keyword_data"]);

    // 3. Findings + positioning mirror from the Cycle 2 findings pipeline
    const { findings, positioningMirror } = await readFindingsPayload(ctx.scanId);

    // 4. Action cards. §4.3: Cold Start subjects (little/no footprint) get the
    //    validation-through-distribution queue; everything else gets the standard
    //    over-generated set. Both flow through the SAME Critic → §11 gate below.
    await emitScanEvent(ctx.scanId, "artifact", { label: "Drafting your action plan" });
    const actions = facts.coldStart
      ? await generateColdStartActions(ctx, facts)
      : await generateActions(ctx, findings);

    // 5. Critic Gate v2 → §11 algorithm safety. Cold Start cards are templated
    //    and §11-compliant by construction, so we run the deterministic checks
    //    only (skipLlm) — avoiding up to ~3 Sonnet critic calls per card.
    await emitScanEvent(ctx.scanId, "artifact", { label: "Pressure-testing each recommendation" });
    const { passed } = await runCriticGate(ctx, actions, { skipLlm: facts.coldStart });
    const safe = await algorithmSafety(ctx, passed);

    // 6. Verified Discoverability Score + radar (§7)
    const components = await gatherScoreComponents(ctx, facts);
    const score = verifiedScore(components, ctx.mode);

    // 7. Gather the remaining report inputs + assemble the four-question report.
    //    Deep sections (competitive landscape / channels / creators / review
    //    sentiment) are surfaced here from already-persisted data — no new calls.
    const subjectType = factSheetSubjectType(ctx.mode);
    const [icpSignals, surfaces, competitorGap, creatorsToReach, channelOpportunities, reviewThemes] =
      await Promise.all([
        readIcpSignals(subjectType, ctx.storeUrl),
        readSurfaces(ctx.storeUrl),
        readCompetitorGap(subjectType, ctx.storeUrl, facts),
        readCreatorDocs(ctx.storeUrl),
        readChannelOpportunities(subjectType, ctx.storeUrl),
        readReviewThemesFull(subjectType, ctx.storeUrl),
      ]);
    const competitiveLandscape = buildCompetitiveLandscape(competitorGap, creatorsToReach);

    await emitScanEvent(ctx.scanId, "artifact", { label: "Finalising your report" });
    const payload = assembleReport({
      mode: ctx.mode,
      generatedAt: new Date().toISOString(),
      positioningMirror,
      findings,
      icpSignals,
      surfaces,
      competitorGap,
      actions: safe,
      score,
      competitiveLandscape,
      channelOpportunities,
      creatorsToReach,
      reviewThemes,
    });

    // 8. Persist the report payload
    await persistReport(ctx.scanId, payload);

    // 8b. M4 market analysis (deep cohort + demand + gap + plan) — flag-gated and
    //     web-only (domain-centric). Best-effort: the core report is already
    //     persisted, so a market-analysis failure is logged but never breaks the
    //     scan. Patches `report_payload.market` when it succeeds.
    if (env.marketAnalysis && ctx.mode === "web") {
      await attachMarketAnalysis(ctx.scanId, ctx.storeUrl).catch((e) =>
        console.error("[full-scan] market analysis failed (best-effort)", e),
      );
    }

    // 9. Persist the safe actions (idempotent)
    await persistActions(ctx, safe);

    // 10. Update the verified score on the scan row
    const db = serverDb();
    const { error: scoreErr } = await db
      .from("scans")
      .update({
        score_total: score.total,
        score_breakdown: score.breakdown as unknown as Json,
      })
      .eq("id", ctx.scanId);
    if (scoreErr) throw scoreErr;

    // 10b. §13 cost-overrun alert — best-effort telemetry marker. The report is
    //      already persisted, so a hot scan is logged but never breaks the run.
    try {
      await checkScanCostOverrun(ctx.scanId);
    } catch {
      // observe-only: never let the cost check fail the scan
    }

    // 11. Seed the weekly monitors (Cycle 4 Task 7) — best-effort & idempotent
    //     (upsert on app_id,kind), so it can't break the scan or duplicate rows.
    await seedMonitors(ctx, facts);

    // 12. Emit the report event
    await emitScanEvent(ctx.scanId, "report", {
      score: score as unknown as Json,
      actionCount: safe.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitScanEvent(ctx.scanId, "error", { message });
    throw err;
  }
}

/**
 * Run the M4 market analysis for a scan's domain and patch it into the persisted
 * report payload. Best-effort: callers wrap this in `.catch`, so any failure is
 * logged without affecting the (already-persisted) core report.
 */
async function attachMarketAnalysis(scanId: string, storeUrl: string): Promise<void> {
  const market = await runMarketAnalysis(hostname(storeUrl), { scanId });

  const db = serverDb();
  const { data } = await db.from("scans").select("report_payload").eq("id", scanId).maybeSingle();
  if (!data?.report_payload) return;

  const payload = { ...(data.report_payload as Record<string, unknown>), market };
  const { error } = await db
    .from("scans")
    .update({ report_payload: payload as unknown as Json })
    .eq("id", scanId);
  if (error) throw new Error(`attachMarketAnalysis: persist failed: ${error.message}`);

  await emitScanEvent(scanId, "report", { market: true });
}
