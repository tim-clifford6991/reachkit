/**
 * Weekly delta-refresh pipeline (Cycle 4 Task 9) — the cost-disciplined heart of
 * the paid engine. Run once a week per app by the Task-10 cron.
 *
 * The whole point is to spend almost nothing on the dominant case (nothing
 * changed) and to escalate to the expensive model only for genuinely-new signal:
 *
 *   watermark  →  Haiku digest  →  novelty gate (embeddings)  →  Sonnet synth
 *   (cheap collect) (per-kind   )  (the Sonnet brake)          (novel only)
 *                   (what changed)
 *
 * Stage flow (§ Task 9):
 *   1. Resolve weekOf; load this app's monitors + facts (latest scan's
 *      preliminary_facts, degrading to a minimal facts object if absent).
 *   2. collectDeltas — watermark-scoped, cheap by construction. CHEAP NO-OP
 *      (the common case): every delta empty → advance watermarks + last_run_at,
 *      record a refresh run at costCents:0, return noOp.
 *   3. Append non-empty delta items to raw_documents (audit trail, content-hash
 *      dedup) and run ONE Haiku "what changed" digest per non-empty kind.
 *   4. Novelty gate: embed each kind's digest and searchSimilar against existing
 *      finding embeddings; a delta is NOVEL when its max cosine similarity is
 *      below NOVELTY_SIM_THRESHOLD (i.e. not "already told you this").
 *   5. Escalate to Sonnet ONLY for novel deltas → new Finding[]. Non-novel
 *      deltas are digest-only (no findings). Nothing novel → skip Sonnet.
 *   6. generateActions → runCriticGate → algorithmSafety; APPEND the safe,
 *      Critic-passed cards to the actions table, deduped on title vs existing
 *      non-done actions for the app (in-function idempotency; the cron guards
 *      once-per-week on top).
 *   7. Wire the loops: if the competitors delta is non-empty, re-enter
 *      competitorDiscoveryLoop (continuous loop 4 — weekly re-entry) under a
 *      bounded budget to confirm/expand the new candidates; fold confirmed
 *      competitors into the facts the run reasons over.
 *   8. Write a score_snapshots row so score history gets a weekly point.
 *   9. Advance every monitor's watermark + last_run_at; record the refresh run
 *      with an estimated cost.
 *  10. Return the RefreshResult.
 *
 * Fixture-aware end-to-end: every model/embed call short-circuits, so the whole
 * refresh runs keyless in dev/test.
 *
 * Resilience: wrapped in try/catch → on failure record an error marker refresh
 * row and rethrow (the cron's onFailure handles the rest).
 */

import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import {
  attachMarketAnalysis,
  writeMarketSnapshot,
  latestMarketSnapshot,
  summarizeMarket,
  computeMarketAlerts,
  type MarketAlert,
} from "@/lib/scan/market";
import { callModel } from "@/lib/llm/anthropic";
import { callEmbed } from "@/lib/llm/embed";
import { searchSimilar, insertEmbeddings } from "@/lib/scan/embeddings";
import { collectDeltas } from "@/lib/scan/delta-collect";
import { generateActions } from "@/lib/llm/actions";
import { runCriticGate } from "@/lib/llm/critic";
import { algorithmSafety } from "@/lib/scan/algorithm-safety";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { competitorDiscoveryLoop } from "@/lib/scan/loops";
import { rankCompetitors } from "@/lib/scan/competitors";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import { factSheetSubjectType, getFreshFactSheet } from "@/lib/scan/fact-sheets";
import { fixturesEnabled, fixtureSynth } from "@/lib/dev/fixtures";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { DeltaResult } from "@/lib/scan/delta-collect";
import type {
  Competitor,
  MonitorKind,
  PreliminaryFacts,
  WatermarkBody,
} from "@/lib/scan/types";
import type { Finding } from "@/lib/llm/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RefreshChange {
  kind: MonitorKind;
  summary: string;
  novel: boolean;
}

export interface RefreshResult {
  weekOf: string;
  noOp: boolean;
  changes: RefreshChange[];
  newActions: number;
  costCents: number;
  /** Week-over-week market alerts (competitor launches, SOV shifts, keyword opps). */
  alerts: MarketAlert[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HAIKU_MODEL = "claude-haiku-4-5-20251001" as const;
const SONNET_MODEL = "claude-sonnet-4-6" as const;

// A delta is NOVEL when its max cosine similarity to existing findings is BELOW
// this threshold — i.e. it is NOT "already told you this". At/above it the signal
// is treated as a near-duplicate of something already surfaced (digest only, no
// Sonnet escalation, no new findings).
const NOVELTY_SIM_THRESHOLD = 0.85;

// Rough per-run cost estimate for the refresh aggregate telemetry row. The exact
// per-call cents are already written by callModel; this aggregate is a coarse
// roll-up so the no-op weeks (0) and escalation weeks are both visible in
// pipeline_runs without re-summing the per-call rows. PLACEHOLDER magnitudes —
// the STRUCTURE (0 on no-op, +Haiku per changed kind, +Sonnet once if novel) is
// what matters; precise numbers are tuned at launch.
const HAIKU_DIGEST_COST_CENTS = 0.05;
const SONNET_SYNTH_COST_CENTS = 0.6;

// ---------------------------------------------------------------------------
// Facts loading (degrade to a minimal object when no scan facts exist)
// ---------------------------------------------------------------------------

function minimalFacts(ctx: ScanContext): PreliminaryFacts {
  return {
    mode: ctx.mode,
    listing: { name: "", category: null, description: null },
    competitors: [],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: null,
    themes: [],
    sourcesUsed: [],
    coldStart: true, // no footprint in this degraded placeholder
  };
}

/** Latest scan's preliminary_facts for the app; minimal object if absent/unusable. */
async function loadFacts(ctx: ScanContext): Promise<PreliminaryFacts> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("scans")
      .select("preliminary_facts, started_at")
      .eq("app_id", ctx.appId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error || data === null) return minimalFacts(ctx);

    const pf = data.preliminary_facts;
    if (pf === null || typeof pf !== "object" || Array.isArray(pf)) return minimalFacts(ctx);
    // Trust the stored shape (it was written by the collect stage) but keep the
    // mode aligned to the context.
    return { ...minimalFacts(ctx), ...(pf as unknown as PreliminaryFacts), mode: ctx.mode };
  } catch {
    return minimalFacts(ctx);
  }
}

// ---------------------------------------------------------------------------
// Monitor loading
// ---------------------------------------------------------------------------

interface MonitorRecord {
  id: string;
  kind: MonitorKind;
  watermark: WatermarkBody;
}

const KINDS: readonly MonitorKind[] = ["reviews", "rank", "threads", "competitors"];
function isMonitorKind(k: string): k is MonitorKind {
  return (KINDS as readonly string[]).includes(k);
}

async function loadMonitors(ctx: ScanContext): Promise<MonitorRecord[]> {
  const db = serverDb();
  const { data, error } = await db
    .from("monitors")
    .select("id, kind, watermark")
    .eq("app_id", ctx.appId);
  if (error) throw error;
  return (data ?? [])
    .filter((r): r is { id: string; kind: string; watermark: Json } => isMonitorKind(r.kind))
    .map((r) => ({
      id: r.id,
      kind: r.kind as MonitorKind,
      watermark: (r.watermark ?? {}) as WatermarkBody,
    }));
}

/** Advance each monitor's watermark + last_run_at from the matching delta. */
async function advanceMonitors(
  monitors: MonitorRecord[],
  deltas: DeltaResult[],
  now: string,
): Promise<void> {
  const db = serverDb();
  const byKind = new Map<MonitorKind, DeltaResult>();
  for (const d of deltas) byKind.set(d.kind, d);

  for (const m of monitors) {
    const delta = byKind.get(m.kind);
    const watermark = (delta ? delta.newWatermark : m.watermark) as unknown as Json;
    const { error } = await db
      .from("monitors")
      .update({ watermark, last_run_at: now })
      .eq("id", m.id);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// raw_documents audit trail — one row per non-empty delta kind
// ---------------------------------------------------------------------------

async function appendDeltaDocs(
  ctx: ScanContext,
  deltas: DeltaResult[],
  weekOf: string,
): Promise<void> {
  const subjectType = factSheetSubjectType(ctx.mode);
  for (const d of deltas) {
    if (d.items.length === 0) continue;
    // Content-hash dedup is handled inside upsertRawDocument. weekOf is part of the
    // body so the same delta items in DIFFERENT weeks produce distinct audit rows,
    // while a re-run within the SAME week dedups to the existing row.
    await upsertRawDocument({
      subjectType,
      subjectKey: ctx.storeUrl,
      sourceType: `delta_${d.kind}`,
      body: { kind: d.kind, items: d.items, weekOf } as unknown,
      mode: ctx.mode,
    });
  }
}

// ---------------------------------------------------------------------------
// (3) Haiku "what changed" digest — one short string per non-empty kind
// ---------------------------------------------------------------------------

function fixtureDigest(kind: MonitorKind, count: number): string {
  switch (kind) {
    case "reviews":
      return `${count} new review(s): a 5-star praising the fixed home-screen widget and a 2-star reporting a crash on iPhone 11.`;
    case "rank":
      return `${count} keyword rank change(s): "habit tracker app" moved to #4, "best habit tracker" to #17.`;
    case "threads":
      return `${count} new community thread(s): a Show HN for a minimalist habit tracker and an Ask HN on switching to a simpler app.`;
    case "competitors":
      return `${count} newly-discovered competitor(s) entered the set.`;
  }
}

async function digestKind(ctx: ScanContext, delta: DeltaResult): Promise<string> {
  const count = delta.items.length;
  if (fixturesEnabled()) {
    return fixtureDigest(delta.kind, count);
  }

  try {
    const result = await callModel({
      model: HAIKU_MODEL,
      system:
        "You are a growth analyst. Summarise what changed for an app this week in ONE short, " +
        "specific sentence (<=40 words). Reference concrete details from the data. No preamble, no markdown.",
      prompt:
        `New "${delta.kind}" signal observed since last week (${count} item(s)). ` +
        `Summarise what changed:\n\n${JSON.stringify(delta.items, null, 2).slice(0, 6000)}`,
      scanId: ctx.scanId,
      stage: "format",
      maxTokens: 256,
    });
    const text = result.text.trim();
    return text.length > 0 ? text : `${count} new ${delta.kind} item(s) observed this week.`;
  } catch {
    // Digest failed — fall back to a deterministic one-liner (never throw).
    return `${count} new ${delta.kind} item(s) observed this week.`;
  }
}

// ---------------------------------------------------------------------------
// (4) Novelty gate — embed each digest, search existing findings, novel if low sim
// ---------------------------------------------------------------------------

async function markNovelty(
  ctx: ScanContext,
  changes: { kind: MonitorKind; summary: string }[],
): Promise<RefreshChange[]> {
  if (changes.length === 0) return [];

  let vecs: number[][];
  try {
    vecs = await callEmbed(changes.map((c) => c.summary));
  } catch {
    // Embedding failed — conservatively treat every change as novel (better to
    // surface a maybe-dup than to silently drop genuinely-new signal).
    return changes.map((c) => ({ ...c, novel: true }));
  }

  const out: RefreshChange[] = [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const vec = vecs[i];
    if (change === undefined) continue;
    if (vec === undefined) {
      out.push({ kind: changes[i]!.kind, summary: changes[i]!.summary, novel: true });
      continue;
    }

    let maxSim = 0;
    try {
      // Scope the search to THIS app's prior findings (p_app_id). Without the
      // appId filter the novelty gate would compare against every app's finding
      // embeddings, so another customer's similar finding could mark this app's
      // delta as non-novel and wrongly suppress the Sonnet escalation (lost signal).
      const matches = await searchSimilar(vec, {
        subjectType: "finding",
        appId: ctx.appId,
        k: 3,
      });
      for (const m of matches) if (m.similarity > maxSim) maxSim = m.similarity;
    } catch {
      // Search failed — no comparison set available → treat as novel.
      maxSim = 0;
    }

    // Novel when NOT already told you this: max similarity below the threshold.
    out.push({ kind: change.kind, summary: change.summary, novel: maxSim < NOVELTY_SIM_THRESHOLD });
  }
  return out;
}

// ---------------------------------------------------------------------------
// (5) Sonnet synth over novel delta summaries + the existing fact sheets
// ---------------------------------------------------------------------------

function parseFindings(text: string): Finding[] {
  let parsed: unknown;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { findings?: unknown })?.findings)
      ? (parsed as { findings: unknown[] }).findings
      : [];

  const valid: Finding[] = [];
  for (const f of arr) {
    if (typeof f !== "object" || f === null) continue;
    const o = f as Record<string, unknown>;
    const category = o["category"];
    const claim = o["claim"];
    const basis = o["basis"];
    const confidence = o["confidence"];
    if (
      (category === "content" || category === "outreach" || category === "seo_aso") &&
      typeof claim === "string" &&
      claim.length > 0 &&
      (basis === "evidence_based" || basis === "probability_based") &&
      typeof confidence === "number"
    ) {
      const evidence = Array.isArray(o["evidence"])
        ? (o["evidence"] as unknown[])
            .filter((e): e is { excerpt: string; source: string } => {
              if (typeof e !== "object" || e === null) return false;
              const eo = e as Record<string, unknown>;
              return typeof eo["excerpt"] === "string" && typeof eo["source"] === "string";
            })
            .map((e) => ({ excerpt: e.excerpt, source: e.source }))
        : [];
      valid.push({
        category,
        claim,
        basis,
        confidence: Math.max(0, Math.min(1, confidence)),
        evidence,
      });
    }
  }
  return valid;
}

async function readSheetJson(subjectType: string, subjectKey: string, kind:
  "review_themes" | "positioning" | "competitor_gap" | "keyword_data"): Promise<string> {
  try {
    const row = await getFreshFactSheet(subjectType, subjectKey, kind);
    return JSON.stringify(row?.body ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

async function synthNovelFindings(
  ctx: ScanContext,
  novel: RefreshChange[],
  facts: PreliminaryFacts,
): Promise<Finding[]> {
  if (novel.length === 0) return [];

  // Fixture path: deterministic findings (no Sonnet call). Tag them as derived
  // from the weekly refresh so they are clearly fresh-signal findings.
  if (fixturesEnabled()) {
    return fixtureSynth().findings;
  }

  const subjectType = factSheetSubjectType(ctx.mode);
  const [reviewThemes, positioning, competitorGap, keywordData] = await Promise.all([
    readSheetJson(subjectType, ctx.storeUrl, "review_themes"),
    readSheetJson(subjectType, ctx.storeUrl, "positioning"),
    readSheetJson(subjectType, ctx.storeUrl, "competitor_gap"),
    readSheetJson(subjectType, ctx.storeUrl, "keyword_data"),
  ]);

  const deltaBlock = novel.map((c) => `- [${c.kind}] ${c.summary}`).join("\n");
  const prompt = `An app's weekly monitors surfaced NEW signal this week. Using the new signal
together with the existing fact sheets, produce 1–3 fresh, evidence-grounded findings that
the new signal supports. Do NOT restate findings the fact sheets already imply — only what the
new signal adds.

=== NEW SIGNAL THIS WEEK ===
${deltaBlock}

=== POSITIONING SHEET ===
${positioning}

=== REVIEW THEMES SHEET ===
${reviewThemes}

=== COMPETITOR GAP SHEET ===
${competitorGap}

=== KEYWORD DATA SHEET ===
${keywordData}

Return ONLY a JSON array (no markdown, no code fences):
[
  {
    "category": "content" | "outreach" | "seo_aso",
    "claim": "<1–2 sentence actionable finding grounded in the new signal>",
    "basis": "evidence_based" | "probability_based",
    "confidence": <0.0–1.0>,
    "evidence": [ { "excerpt": "<verbatim quote from a sheet or the new signal>", "source": "<sheet name or delta kind>" } ]
  }
]`;

  try {
    const result = await callModel({
      model: SONNET_MODEL,
      system:
        "You are a product-growth strategist. You synthesise NEW weekly signal plus existing fact " +
        "sheets into fresh, evidence-grounded findings. Output ONLY valid JSON — no markdown, no prose.",
      prompt,
      scanId: ctx.scanId,
      stage: "synth",
      maxTokens: 2048,
    });
    return parseFindings(result.text);
  } catch {
    // Synth failed — no new findings this week (degrade, never throw).
    void facts;
    return [];
  }
}

// ---------------------------------------------------------------------------
// Finding embeddings — populate so the novelty gate improves week over week
// (and a repeat of the same delta becomes non-novel next run).
// ---------------------------------------------------------------------------

async function storeFindingEmbeddings(ctx: ScanContext, findings: Finding[]): Promise<void> {
  if (findings.length === 0) return;
  try {
    const texts = findings.map((f) => f.claim);
    const vecs = await callEmbed(texts);
    await insertEmbeddings(
      findings.map((f, i) => ({
        subjectType: "finding",
        subjectKey: `${ctx.appId}:${ctx.scanId}:finding:${i}:${Date.now()}`,
        appId: ctx.appId,
        content: f.claim,
        embedding: vecs[i] ?? [],
        model: fixturesEnabled() ? "fixture" : "voyage-3",
        modelVersion: "1",
      })),
    );
  } catch {
    // Non-fatal — novelty just stays conservative next week.
  }
}

// ---------------------------------------------------------------------------
// (6) Append Critic-passed safe actions, deduped on title vs existing non-done
// ---------------------------------------------------------------------------

async function appendActions(
  ctx: ScanContext,
  findings: Finding[],
): Promise<number> {
  if (findings.length === 0) return 0;

  const generated = await generateActions(ctx, findings);
  const { passed } = await runCriticGate(ctx, generated);
  const safe = await algorithmSafety(ctx, passed);
  if (safe.length === 0) return 0;

  const db = serverDb();

  // Existing non-done action titles for this app — the dedup key. (The Task-10
  // cron also guards once-per-week; this is the in-function idempotency so a
  // manual re-run in the same week never double-appends.)
  const { data: existing, error: exErr } = await db
    .from("actions")
    .select("title, status")
    .eq("app_id", ctx.appId);
  if (exErr) throw exErr;

  const existingTitles = new Set(
    (existing ?? [])
      .filter((r) => r.status !== "done")
      .map((r) => r.title),
  );

  // De-dupe within the batch too, so two freshly-generated cards with the same
  // title can't both insert.
  const seenThisRun = new Set<string>();
  const toInsert = safe.filter((a) => {
    if (existingTitles.has(a.title) || seenThisRun.has(a.title)) return false;
    seenThisRun.add(a.title);
    return true;
  });
  if (toInsert.length === 0) return 0;

  const rows = toInsert.map((a) => ({
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
  return rows.length;
}

// ---------------------------------------------------------------------------
// (7) Loop wiring — weekly re-entry of the competitor-discovery loop
// ---------------------------------------------------------------------------

/**
 * If the competitors delta is non-empty, re-enter competitorDiscoveryLoop to
 * confirm/expand the newly-discovered candidates within a bounded budget, then
 * fold the confirmed competitors back into the facts the run reasons over.
 */
async function refreshCompetitors(
  ctx: ScanContext,
  competitorDelta: DeltaResult | undefined,
  facts: PreliminaryFacts,
): Promise<PreliminaryFacts> {
  if (competitorDelta === undefined || competitorDelta.items.length === 0) return facts;

  const productName = facts.listing.name;
  if (productName.length === 0) return facts;

  // Seed the loop with the new candidate names (delta items are bare strings)
  // plus whatever competitors the facts already carry.
  const newNames = competitorDelta.items.filter((i): i is string => typeof i === "string");
  const seedFromDelta: Competitor[] = newNames.map((name, i) => ({
    name,
    url: "",
    source: "delta_competitors",
    rank: 50 + i,
  }));
  const seed = [...facts.competitors, ...seedFromDelta];

  try {
    const confirmed = await competitorDiscoveryLoop(ctx, productName, ctx.storeUrl, seed);
    if (confirmed.length === 0) return facts;
    // Fold confirmed competitors into facts (dedup by hostname via rankCompetitors).
    const merged = rankCompetitors([...facts.competitors, ...confirmed], { cap: 20 });
    return { ...facts, competitors: merged };
  } catch {
    // Loop is already budget-guarded internally; any leak degrades to no change.
    return facts;
  }
}

// ---------------------------------------------------------------------------
// (8) Score snapshot — one weekly point
// ---------------------------------------------------------------------------

async function writeScoreSnapshot(
  ctx: ScanContext,
  facts: PreliminaryFacts,
  now: string,
): Promise<void> {
  const components = await gatherScoreComponents(ctx, facts);
  const score = verifiedScore(components, ctx.mode);
  const db = serverDb();
  const { error } = await db.from("score_snapshots").insert({
    app_id: ctx.appId,
    taken_at: now,
    total: score.total,
    breakdown: score.breakdown as unknown as Json,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runWeeklyRefresh(
  ctx: ScanContext,
  opts?: { weekOf?: string },
): Promise<RefreshResult> {
  const weekOf = opts?.weekOf ?? new Date().toISOString().slice(0, 10);
  const started = Date.now();

  try {
    // 1. Load monitors + facts.
    const [monitors, facts] = await Promise.all([loadMonitors(ctx), loadFacts(ctx)]);

    // 2. Cheap, watermark-scoped delta collection.
    const deltas = await collectDeltas(
      ctx,
      monitors.map((m) => ({ kind: m.kind, watermark: m.watermark })),
      facts,
    );

    const now = new Date().toISOString();
    const nonEmpty = deltas.filter((d) => d.items.length > 0);

    // 2b. CHEAP NO-OP — the dominant case. Nothing changed: just advance the
    // watermarks + last_run_at, log a zero-cost refresh row, and return.
    if (nonEmpty.length === 0) {
      await advanceMonitors(monitors, deltas, now);
      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "refresh",
        costCents: 0,
        durationMs: Date.now() - started,
      });
      return { weekOf, noOp: true, changes: [], newActions: 0, costCents: 0, alerts: [] };
    }

    // 3. Audit trail + one Haiku digest per non-empty kind.
    await appendDeltaDocs(ctx, nonEmpty, weekOf);
    const digests = await Promise.all(
      nonEmpty.map(async (d) => ({ kind: d.kind, summary: await digestKind(ctx, d) })),
    );

    // 4. Novelty gate (the Sonnet brake). Scoped to THIS app's prior findings.
    const changes = await markNovelty(ctx, digests);
    const novel = changes.filter((c) => c.novel);

    // 5. Escalate to Sonnet ONLY for novel deltas.
    const newFindings = await synthNovelFindings(ctx, novel, facts);

    // 7. Wire the loops: weekly competitor-discovery re-entry (before actions so
    //    folded-in competitors inform action generation's fact sheets next run).
    const competitorDelta = nonEmpty.find((d) => d.kind === "competitors");
    const enrichedFacts = await refreshCompetitors(ctx, competitorDelta, facts);

    // 6. Actions from the new findings → Critic → safety → append (deduped).
    const newActions = await appendActions(ctx, newFindings);

    // 5b. Store the new findings' embeddings so novelty improves week over week.
    await storeFindingEmbeddings(ctx, newFindings);

    // 8. Weekly score-history point.
    await writeScoreSnapshot(ctx, enrichedFacts, now);

    // 8b. Re-run the market analysis so the paid competitive data doesn't go stale
    //     (decision G2). Only on this signal path (not the cheap no-op) to preserve
    //     the no-op cost discipline; shared 7-day profile cache keeps it cheap.
    //     Web-only + flag-gated + best-effort: never breaks the refresh.
    let alerts: MarketAlert[] = [];
    if (env.marketAnalysis && ctx.mode === "web") {
      try {
        const market = await attachMarketAnalysis(ctx.scanId, ctx.storeUrl);
        if (market) {
          // Diff against last week BEFORE writing the new snapshot → alerts.
          const prev = await latestMarketSnapshot(ctx.appId);
          alerts = computeMarketAlerts(prev, summarizeMarket(market));
          await writeMarketSnapshot(ctx.appId, market, now); // weekly history point
        }
      } catch (e) {
        console.error("[refresh] market analysis failed (best-effort)", e);
      }
    }

    // 9. Advance watermarks + last_run_at; estimate + record the refresh cost.
    await advanceMonitors(monitors, deltas, now);

    const costCents =
      nonEmpty.length * HAIKU_DIGEST_COST_CENTS +
      (novel.length > 0 ? SONNET_SYNTH_COST_CENTS : 0);

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "refresh",
      costCents,
      durationMs: Date.now() - started,
    });

    // 10. Return.
    return { weekOf, noOp: false, changes, newActions, costCents, alerts };
  } catch (err) {
    // On failure: record an error marker refresh row, then rethrow so the cron's
    // onFailure handler takes over.
    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "refresh",
      costCents: 0,
      durationMs: Date.now() - started,
    }).catch(() => {
      // If even the telemetry write fails, still rethrow the original error.
    });
    throw err;
  }
}
