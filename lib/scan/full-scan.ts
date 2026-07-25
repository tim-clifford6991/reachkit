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
import { runSynth, SYNTH_MODEL_FULL } from "@/lib/llm/synth";
import type { SynthResult, CategoryNicheSeeds } from "@/lib/llm/types";
import { generateActions } from "@/lib/llm/actions";
import { generateColdStartActions } from "@/lib/llm/cold-start-actions";
import { runCriticGate } from "@/lib/llm/critic";
import { algorithmSafety } from "@/lib/scan/algorithm-safety";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { persistScanSignals, computeSignalRowsForScan } from "@/lib/scan/persist-signals";
import { linkSignalKeys, topUpActions, recomputeActionImpacts, ensurePerCategoryFloor, MIN_ACTIONS } from "@/lib/scan/action-linking";
import { fillDeterministicDrafts } from "@/lib/scan/action-drafts";
import { headlineScore, marketPositionScore, HEADLINE_SCORE_VERSION, discoverabilityScore as unifiedDiscoverability, DISCOVERABILITY_SCORE_VERSION } from "@/lib/scan/registry-score";
import { gatherFreeSearchVisibility, type SearchVisibility } from "@/lib/scan/search-visibility";
import { shouldReuseFreeLayer } from "@/lib/scan/free-layer-freshness";
import { verifiedScoreFromRegistry } from "@/lib/scan/free-report";
import type { ScanSignalRow } from "@/lib/scan/compute-signals";
import { assembleReport, persistReport, bucketActions, type ReportPayload } from "@/lib/scan/report";
import type {
  ChannelOpportunities,
  KeywordCluster,
  EngagedCommunity,
} from "@/lib/scan/report";
import { seedMonitors } from "@/lib/scan/monitors";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { parseKeywords } from "@/lib/scan/adapters/keywords";
import { checkScanCostOverrun, checkAllInCostOverrun, checkUserDailyCostOverrun } from "@/lib/telemetry/pipeline-runs";
import { emitScanEvent } from "@/lib/scan/progress";
import { attachMarketAnalysis, writeMarketSnapshot } from "@/lib/scan/market";
import { externalCapBreached } from "@/lib/scan/cost-context";
import { writeScanScoreSnapshot, rollupScanCost } from "@/lib/scan/scan-telemetry";
import { countMentions } from "@/lib/scan/competitor-mentions";
import { normalizeName } from "@/lib/scan/competitor-filter";
import { discoverScanCompetitors } from "@/lib/scan/scan-competitors";
import { persistCompetitors } from "@/lib/scan/competitors";
import { hostname } from "@/lib/scan/url";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Finding, PositioningMirror, ActionCard, ActionGrounding } from "@/lib/llm/types";
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
// Deep synth persist — the deep pass re-runs the FULL synth (the findings step
// ran a lite Haiku teaser: mirror + seeds only, which does not carry the
// findings the paid action plan is built from). Overwrite the teaser in the
// findings table + findings_payload with the full synth output, preserving the
// v1 score the findings step wrote.
// ---------------------------------------------------------------------------
async function persistDeepSynth(scanId: string, synth: SynthResult): Promise<void> {
  const db = serverDb();
  // Idempotent under Inngest step retries: delete then re-insert the findings rows.
  const { error: delErr } = await db.from("findings").delete().eq("scan_id", scanId);
  if (delErr) throw delErr;
  const rows = synth.findings.map((f) => ({
    scan_id: scanId,
    category: f.category,
    basis: f.basis,
    confidence: Math.max(0, Math.min(1, Number(f.confidence))),
    body: { claim: f.claim, evidence: f.evidence } as unknown as Json,
    evidence_ids: [] as number[],
  }));
  if (rows.length > 0) {
    const { error } = await db.from("findings").insert(rows);
    if (error) throw error;
  }
  const { data } = await db.from("scans").select("findings_payload").eq("id", scanId).single();
  const existing = (data?.findings_payload ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    positioningMirror: synth.positioningMirror,
    findings: synth.findings,
    sampleAction: synth.sampleAction,
    categorySeeds: synth.categorySeeds ?? existing["categorySeeds"] ?? [],
  };
  const { error } = await db.from("scans").update({ findings_payload: merged as unknown as Json }).eq("id", scanId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// surfaces — where the audience is: communities raw_documents (subject_key =
// storeUrl; body = Community[]). The "youtube" source_type is queried too for
// legacy rows, but nothing writes it anymore (find_creators retired M3b,
// 2026-07-23, O-8), so that branch is permanently dead on a fresh scan.
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
          // legacy youtube rows — "name" was the channel/video title
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

// ---------------------------------------------------------------------------
// Persist the Critic-passed, algorithm-safe actions to the actions table.
// Idempotent: delete existing rows for this scan first, then insert.
// ---------------------------------------------------------------------------
async function persistActions(ctx: ScanContext, actions: ActionCard[]): Promise<void> {
  const db = serverDb();

  const { error: delErr } = await db.from("actions").delete().eq("scan_id", ctx.scanId);
  if (delErr) throw delErr;

  if (actions.length === 0) return;

  // Grounding persisted onto every action at creation (owner 2026-07-24) so the
  // plan always shows why it matters + its source, independent of title-matching:
  // fold the card's own `grounding` with its search `opportunity` (keyword+volume)
  // and its top inline evidence excerpt.
  const groundingFor = (a: ActionCard): ActionGrounding | null => {
    const g: ActionGrounding = { ...(a.grounding ?? {}) };
    if (a.opportunity) {
      if (!g.targetKeywords?.length) g.targetKeywords = [a.opportunity.keyword];
      if (g.volume == null) g.volume = a.opportunity.volume;
    }
    if (!g.evidence && a.evidence?.[0]?.excerpt) g.evidence = a.evidence[0].excerpt;
    return Object.keys(g).length > 0 ? g : null;
  };
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
    target: (a.target ?? null) as unknown as Json,
    evidence_ids: a.evidenceIds,
    expected_outcome: a.expectedOutcome as unknown as Json,
    score_component: a.expectedOutcome.scoreComponent,
    verification: a.verification as unknown as Json,
    signal_keys: a.signalKeys ?? [],
    grounding: groundingFor(a) as unknown as Json,
  }));

  const { error: insErr } = await db.from("actions").insert(rows);
  if (insErr) throw insErr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function runFullScan(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  try {
    // 0. Competitor discovery is a PAID capability (Phase S, R-1.5). A scan
    //    deepened from a stored FREE scan carries no competitors (the free
    //    collect skipped them), yet the paid surfaces below — full-collect's
    //    community/keyword seeds and the competitor-gap grounding — need them.
    //    Re-collect + persist once here, before anything reads facts.competitors,
    //    through the ONE shared discovery path (capability ledger). A fresh
    //    tier=full scan already has them, so this is a no-op there.
    if (facts.competitors.length === 0) {
      const productName = facts.listing.name || hostname(ctx.storeUrl).split(".")[0] || hostname(ctx.storeUrl);
      const { competitors } = await discoverScanCompetitors(ctx, { productName, listing: facts.listing });
      if (competitors.length > 0) {
        facts.competitors = competitors;
        await persistCompetitors(ctx.appId, competitors);
      }
    }

    // 1. Heavy collect (keywords / communities / creators)
    await runFullCollect(ctx, facts);

    // 2. Re-extract ONLY the keyword_data sheet to reflect the freshly-collected
    //    keyword docs — re-running positioning/review/competitor here would re-read
    //    the (expensive) site HTML for no benefit (those sources didn't change).
    await runExtract(ctx, ["keyword_data"]);

    // 3. FULL synth (Sonnet) — the findings step ran a lite Haiku TEASER (mirror +
    //    seeds only), so the deep pass OWNS the full synthesis its action plan is
    //    built FROM (generateActions below reads `findings`). Regenerate + persist,
    //    overwriting the teaser in findings_payload + the findings table.
    await emitScanEvent(ctx.scanId, "artifact", { label: "Analysing your positioning & gaps" });
    const synth = await runSynth(ctx, { model: SYNTH_MODEL_FULL });
    await persistDeepSynth(ctx.scanId, synth);
    const { findings, positioningMirror } = synth;

    // 4. Ground the generator in the ALREADY-COLLECTED market data (named
    //    competitors with community-mention counts, communities ranked by
    //    engagement). These readers only re-read persisted raw_documents / fact
    //    sheets — no new external calls — and the SAME variables are reused for
    //    report assembly below (each read exactly once). (Creators were retired
    //    M3b, 2026-07-23 — O-8, write-only: creatorsToReach had zero render
    //    consumers.)
    const subjectType = factSheetSubjectType(ctx.mode);
    const [competitorGap, channelOpportunities] = await Promise.all([
      readCompetitorGap(subjectType, ctx.storeUrl, facts),
      readChannelOpportunities(subjectType, ctx.storeUrl),
    ]);
    const grounding = {
      competitors: competitorGap.map((r) => ({
        name: r.competitor,
        positioning: r.positioning ?? null,
        themMentions: r.them,
        youMentions: r.you,
      })),
      communities: channelOpportunities.communitiesByEngagement,
    };

    // 4b. Action cards. §4.3: Cold Start subjects (little/no footprint) get the
    //     validation-through-distribution queue; everything else gets the standard
    //     over-generated set. Both flow through the SAME Critic → §11 gate below.
    await emitScanEvent(ctx.scanId, "artifact", { label: "Drafting your action plan" });
    const actions = facts.coldStart
      ? await generateColdStartActions(ctx, facts, grounding)
      : await generateActions(ctx, findings, grounding);

    // 5. Critic Gate v2 → §11 algorithm safety. Cold Start cards are templated
    //    and §11-compliant by construction, so we run the deterministic checks
    //    only (skipLlm) — avoiding up to ~3 Sonnet critic calls per card.
    await emitScanEvent(ctx.scanId, "artifact", { label: "Pressure-testing each recommendation" });
    const { passed } = await runCriticGate(ctx, actions, { skipLlm: facts.coldStart });
    const safe = await algorithmSafety(ctx, passed);

    // 6. Verified Discoverability Score + radar (§7)
    const components = await gatherScoreComponents(ctx, facts);
    const score = verifiedScore(components, ctx.mode);

    // 6b. Link every card to the registry signals it addresses, then floor the
    //     plan to a substantive size. The Critic/§11 gates can legitimately
    //     survive only 0–2 cards (a generation parse failure yields placeholder
    //     cards the critic always rejects; a strong site yields few fixes), and a
    //     paid report with a thin plan reads as low value and leaves the upgrade
    //     wall nothing to hold back. `linkSignalKeys` attaches signalKeys to the
    //     LLM cards (they carry none from generation); `topUpActions` appends
    //     deterministic signal-derived baseline fixes (deduped, capped) until the
    //     plan reaches MIN_ACTIONS. The floor cards bypass the critic by design
    //     (its evidence rules reject templated, evidence-free cards). Best-effort:
    //     a signal-compute failure keeps the gated set rather than failing the scan.
    let plan = safe;
    try {
      const signalRows = await computeSignalRowsForScan({
        mode: ctx.mode,
        storeUrl: ctx.storeUrl,
        components,
        market: null, // market analysis attaches later (8b); Wave A + existing inputs suffice
      });
      plan = linkSignalKeys(safe, signalRows);
      const before = plan.length;
      plan = topUpActions(plan, signalRows);
      // A3: fill the deterministic JSON-LD draft on any schema card missing one.
      plan = fillDeterministicDrafts(plan, facts.listing, ctx.storeUrl, ctx.mode);
      // §6 #4: overwrite every card's LLM-guessed `expectedOutcome.delta` with the
      // model-computed shortfall of the signals it links to, so the "+N pts" shown
      // and sorted on equals real modelled score movement (floor cards unchanged).
      plan = recomputeActionImpacts(plan, signalRows);
      // §6 #5: guarantee invariant #5 (per-category floor) at runtime, not just in
      // the eval — every pillar with recoverable points keeps ≥1 action.
      plan = ensurePerCategoryFloor(plan, signalRows);
      if (plan.length > before) {
        console.warn(
          `[full-scan] plan had ${before} critic-passed action(s) for scan ${ctx.scanId} — floored to ${plan.length} (MIN_ACTIONS=${MIN_ACTIONS}) with signal-derived baseline fixes`,
        );
      }
    } catch (e) {
      console.error("[full-scan] action floor/linking failed (best-effort)", e);
    }

    // 7. Gather the remaining report inputs + assemble the four-question report.
    //    Channels are surfaced here from already-persisted data — no new calls.
    //    competitorGap / channelOpportunities were already read above (for
    //    grounding) and are reused here — no second read. (icpSignals/
    //    competitiveLandscape/creatorsToReach/reviewThemes producers retired
    //    M3b, 2026-07-23 — O-7/O-8, write-only or superseded.)
    const surfaces = await readSurfaces(ctx.storeUrl);

    await emitScanEvent(ctx.scanId, "artifact", { label: "Finalising your report" });
    const payload = assembleReport({
      mode: ctx.mode,
      generatedAt: new Date().toISOString(),
      positioningMirror,
      findings,
      surfaces,
      competitorGap,
      actions: plan,
      score,
      channelOpportunities,
      fetchDegraded: facts.fetchDegraded,
    });

    // 8. Persist the report payload
    await persistReport(ctx.scanId, payload);

    // 8b. M4 market analysis (deep cohort + demand + gap + plan) — flag-gated and
    //     web-only (domain-centric). Best-effort: the core report is already
    //     persisted, so a market-analysis failure is logged but never breaks the
    //     scan. Patches `report_payload.market` when it succeeds.
    if (ctx.mode === "web" && externalCapBreached()) {
      // External soft cap (invariant #2): the scan's DFS+Tavily spend already
      // crossed the cap, so skip the market pass — the heaviest remaining
      // external fan-out. The core report is persisted; market:null renders
      // via the existing degraded path. Stamped on the scan by flushExternalCost.
      console.warn("[full-scan] external cap breached — skipping market analysis (degraded)");
    }
    if (ctx.mode === "web" && !externalCapBreached()) {
      const market = await attachMarketAnalysis(ctx.scanId, ctx.storeUrl).catch((e) => {
        console.error("[full-scan] market analysis failed (best-effort)", e);
        return null;
      });
      // B3: persist a market-history point so the trends reader is never empty on
      // a fresh paid scan (previously only the weekly refresh wrote these).
      if (market) {
        await writeMarketSnapshot(ctx.appId, market, new Date().toISOString()).catch((e) =>
          console.error("[full-scan] market snapshot failed (best-effort)", e),
        );

        // 8c. Market-aware re-floor. The §6b floor ran with market:null (this
        //     analysis hadn't happened yet), so market-derived failing signals
        //     (organic keywords, ranked positions, comparison pages, content
        //     cadence, community/marketplace presence) were invisible to it — a
        //     strong site could floor to only its on-site fixes (live trustmrr:
        //     2 actions vs 4 final fails). Recompute signals WITH the market and
        //     top the plan up again, then patch the persisted report's action
        //     buckets to match. Best-effort — a failure keeps the §6b plan.
        try {
          const marketRows = await computeSignalRowsForScan({
            mode: ctx.mode,
            storeUrl: ctx.storeUrl,
            components,
            market,
          });
          const before = plan.length;
          // §6 #4/#5: recompute impacts against the market-aware signal rows too
          // (off-site cards get their real modelled delta once market signals are
          // measured), then re-assert the per-category floor with those rows.
          const refloored = ensurePerCategoryFloor(
            recomputeActionImpacts(
              fillDeterministicDrafts(
                topUpActions(linkSignalKeys(plan, marketRows), marketRows),
                facts.listing,
                ctx.storeUrl,
                ctx.mode,
              ),
              marketRows,
            ),
            marketRows,
          );
          if (refloored.length > before) {
            plan = refloored;
            const rdb = serverDb();
            const { data } = await rdb.from("scans").select("report_payload").eq("id", ctx.scanId).maybeSingle();
            const rp = data?.report_payload as unknown as ReportPayload | null;
            if (rp) {
              rp.whatToDoThisWeek = bucketActions(plan);
              await rdb.from("scans").update({ report_payload: rp as unknown as Json }).eq("id", ctx.scanId);
            }
            console.warn(`[full-scan] market-aware re-floor grew plan ${before}→${plan.length} for scan ${ctx.scanId}`);
          }
        } catch (e) {
          console.error("[full-scan] market-aware re-floor failed (best-effort)", e);
        }
      }
      // NOTE: competitive intel is NOT pre-computed here. The user picks their own
      // benchmark competitors on the dashboard; intel is computed once at that point
      // (POST /api/competitors/select) and persisted — avoids wasted DataForSEO spend
      // on auto-discovered competitors the user would just replace.
    }
    // (attachMarketAnalysis lives in lib/scan/market.ts — shared with the free
    //  light pass + weekly refresh.)

    // 9. Persist the safe actions (idempotent) — `plan` = the gated set, or the
    //    signal-derived floor when the gate emptied it (matches report_payload).
    await persistActions(ctx, plan);

    // 10. Update the verified score on the scan row (v1 first; the web headline
    //     is flipped to the v2 registry score in 10a once signals are persisted).
    const db = serverDb();
    const { error: scoreErr } = await db
      .from("scans")
      .update({
        score_total: score.total,
        score_breakdown: score.breakdown as unknown as Json,
        score_version: 1,
        // Unambiguous "deep pass completed" marker — the robust sentinel for the
        // deepen guards (lib/scan/deepen.ts), set regardless of how many actions
        // survived the critic/floor (a 0-action deep pass still counts as deep).
        deepened_at: new Date().toISOString(),
        // Rank/keyword data is fetched during the web market pass above — stamp
        // its freshness so reports can show "Keyword data as of …".
        ...(ctx.mode === "web" ? { rank_data_fetched_at: new Date().toISOString() } : {}),
      })
      .eq("id", ctx.scanId);
    if (scoreErr) throw scoreErr;

    // 10a. Persist the 18-signal contributions, then set the WEB headline to the
    //      v4 on-site score (patches scans + report_payload.score so the gauge,
    //      bars and radar agree). Best-effort: a failure leaves the v1 score intact.
    try {
      const { data: persisted } = await db
        .from("scans")
        .select("report_payload, findings_payload, created_at")
        .eq("id", ctx.scanId)
        .maybeSingle();
      const payload = persisted?.report_payload as unknown as ReportPayload | null;
      const fpForSeeds = persisted?.findings_payload as { categorySeeds?: unknown; marketTiers?: unknown; categoryNiche?: unknown } | null;
      const market = payload?.market ?? null;
      await persistScanSignals({ scanId: ctx.scanId, mode: ctx.mode, storeUrl: ctx.storeUrl, components, market });

      const { data: rows } = await db
        .from("scan_signals")
        .select("signal_key, pillar, weight, normalised, state")
        .eq("scan_id", ctx.scanId);
      const signalRows = (rows ?? []).map((r) => ({
        signalKey: r.signal_key as string,
        pillar: r.pillar as "content" | "outreach" | "seo",
        weight: r.weight as number,
        normalised: r.normalised as number | null,
        state: (r.state as ScanSignalRow["state"]) ?? "unmeasured",
        rawValue: null,
        contribution: null,
        platform: ctx.mode,
      }));
      if (ctx.mode === "web" && payload) {
        // v4 headline = registryScore over the FIXED on-site basis ONLY
        // (headlineScore) — the 8 HTML signals measured identically on free and
        // paid, so the headline is stable free→paid and equals the on-site pillar
        // bars the dashboard shows. The deep pass's off-site strength (keyword
        // footprint, backlinks, marketplace/community/press) is NOT in the headline
        // — it is the separate `marketPosition` grade below.
        const head = headlineScore(signalRows);
        if (head.assessed.length > 0) {
          // v5 UNIFIED Discoverability Score = geomean(on-page readiness × search
          // presence). Compute the SAME free-tier Search Visibility here (cache-hits
          // the free pass's `ranked_keywords`, so ~free) so the number is identical
          // free↔paid but honest. Best-effort — a failure keeps the on-page score.
          const catSeeds = Array.isArray((fpForSeeds as { categorySeeds?: unknown })?.categorySeeds)
            ? ((fpForSeeds as { categorySeeds: unknown[] }).categorySeeds.filter((s): s is string => typeof s === "string"))
            : [];
          // M2 paid parity: thread the SAME broad/niche market-tier seeds the free
          // pass would use, sourced from the same findings_payload.marketTiers — so
          // the ladder doesn't silently vanish when a scan is deepened post-upgrade.
          // An OLDER persisted findings_payload may still carry a `medium` key
          // (pre bb6ef07/this fix) — it is simply never read here.
          const rawTiers = (fpForSeeds as { marketTiers?: { broad?: unknown; niche?: unknown } | null })?.marketTiers;
          const marketTierSeeds = rawTiers && typeof rawTiers === "object"
            ? {
                broad: Array.isArray(rawTiers.broad) ? rawTiers.broad.filter((s): s is string => typeof s === "string") : [],
                niche: Array.isArray(rawTiers.niche) ? rawTiers.niche.filter((s): s is string => typeof s === "string") : [],
              }
            : undefined;
          // P2 (2026-07-20, data board) paid parity: thread the SAME
          // category/niche seed the free pass would use, sourced from the
          // same findings_payload.categoryNiche — so categoryCard/nicheCard
          // don't silently vanish when a scan is deepened post-upgrade
          // (the same parity discipline as marketTierSeeds above).
          const rawCategoryNiche = (fpForSeeds as { categoryNiche?: unknown })?.categoryNiche;
          const categoryNicheSeeds: CategoryNicheSeeds | undefined =
            rawCategoryNiche && typeof rawCategoryNiche === "object" ? (rawCategoryNiche as CategoryNicheSeeds) : undefined;
          const seedText = [
            ...(facts.themes ?? []).map((t) => t.term).filter(Boolean),
            positioningMirror.listingSays ?? "",
            positioningMirror.reviewsValue ?? "",
          ].filter((s) => s.length > 0);
          // PR-5: thread the subject's REAL name (facts.listing.name) so the
          // brand vocabulary isn't limited to the domain label alone (the
          // brand≠domain class — "x.com" -> unusable "x").
          const brandNames = facts.listing.name ? [facts.listing.name] : [];
          // Free-layer freshness gate (owner rule, 2026-07-24): REUSE the free
          // scan's persisted search-visibility when it's ≤7 days old, so the
          // unified score is identical free↔paid (invariant #1) and the dashboard
          // never shows a false "▲ +N since last scan" from a re-measurement. Only
          // RECOMPUTE when the free layer is stale (>7d) — then fresh data is the
          // honest choice even though the score may legitimately move. Reuse also
          // skips the ranked_keywords re-fetch (a free DataForSEO saving).
          const persistedSv = (payload.searchVisibility ?? null) as SearchVisibility | null;
          const reuseFreeLayer = shouldReuseFreeLayer(persisted?.created_at, !!persistedSv);
          const sv = reuseFreeLayer
            ? persistedSv
            : await gatherFreeSearchVisibility(ctx.storeUrl, seedText, catSeeds, marketTierSeeds, brandNames, categoryNicheSeeds).catch(() => null);
          if (sv) sv.onPageReadiness = head.total;
          const unified = unifiedDiscoverability(head.total, sv?.score ?? 0);
          await db
            .from("scans")
            .update({
              score_total: unified,
              score_breakdown: head.breakdown as unknown as Json,
              score_version: DISCOVERABILITY_SCORE_VERSION,
            })
            .eq("id", ctx.scanId);
          // F2: the off-site "Market position" grade, distinct from the on-site
          // headline. Attach only when off-site signals were actually measured.
          const mp = marketPositionScore(signalRows);
          const marketPosition = mp.assessed.length > 0
            ? { total: mp.total, breakdown: mp.breakdown, assessed: mp.assessed }
            : null;
          await persistReport(ctx.scanId, {
            ...payload,
            score: { ...verifiedScoreFromRegistry(head), total: unified },
            marketPosition,
            ...(sv ? { searchVisibility: sv } : {}),
          });
        }
      }
    } catch (e) {
      console.error("[full-scan] signal persistence / score flip failed (best-effort)", e);
    }

    // 10b. B3: deep-pass score-history point — read back the final persisted
    //      score (v2 for web, v1 for app) so the dashboard timeline shows the
    //      deep-pass move. Best-effort.
    try {
      const { data: finalRow } = await db
        .from("scans")
        .select("score_total, score_breakdown, score_version")
        .eq("id", ctx.scanId)
        .maybeSingle();
      if (finalRow?.score_total != null) {
        await writeScanScoreSnapshot({
          appId: ctx.appId,
          scanId: ctx.scanId,
          total: finalRow.score_total,
          breakdown: finalRow.score_breakdown,
          version: finalRow.score_version ?? 1,
          source: "scan_deep",
        });
      }
    } catch (e) {
      console.error("[full-scan] deep score snapshot failed (best-effort)", e);
    }

    // 10c. §13 cost-overrun alerts — best-effort telemetry markers. The report is
    //      already persisted, so a hot scan is logged but never breaks the run.
    //      LLM-only (legacy) + all-in (LLM+DFS+Tavily) + the user's 24h total.
    try {
      await checkScanCostOverrun(ctx.scanId);
      await checkAllInCostOverrun(ctx.scanId);
      await checkUserDailyCostOverrun(ctx.scanId);
    } catch {
      // observe-only: never let the cost check fail the scan
    }

    // 11. Seed the weekly monitors (Cycle 4 Task 7) — best-effort & idempotent
    //     (upsert on app_id,kind), so it can't break the scan or duplicate rows.
    await seedMonitors(ctx, facts);

    // 12. Emit the report event
    await emitScanEvent(ctx.scanId, "report", {
      score: score as unknown as Json,
      actionCount: plan.length,
    });

    // 13. B3: roll the total pipeline cost (free + deep runs) onto scans.cost_cents.
    await rollupScanCost(ctx.scanId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitScanEvent(ctx.scanId, "error", { message });
    throw err;
  }
}

