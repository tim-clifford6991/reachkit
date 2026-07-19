import { parse } from "node-html-parser";
import { serverDb } from "@/lib/db/client";
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { parseListingHtml } from "@/lib/scan/adapters/site-fetch";
import { upsertFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { fixtures } from "@/lib/scan/fixture-seam";
import {
  reviewThemesPrompt,
  positioningPrompt,
  competitorGapPrompt,
  keywordDataPrompt,
  EXTRACT_SYSTEM,
} from "@/lib/llm/prompts";
import {
  EMPTY_REVIEW_THEMES,
  EMPTY_POSITIONING,
  EMPTY_COMPETITOR_GAP,
  EMPTY_KEYWORD_SHEET,
} from "@/lib/llm/types";
import type {
  ReviewThemesSheet,
  PositioningSheet,
  CompetitorGapSheet,
  KeywordSheet,
} from "@/lib/llm/types";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { FactSheetKind } from "@/lib/scan/fact-sheets";

const MODEL = "claude-haiku-4-5-20251001" as const;

// Source type groupings
const REVIEW_SOURCES = Object.freeze(["app_store_rss", "web_reviews"] as const);
// Part C — "site_fetch_escalated" is the ONE Tavily Extract fallback's rendered
// text (get-listing.ts), written only when the raw site_fetch HTML was garbage
// (a JS-shell page) and the escalation itself was non-garbage. See
// `effectiveListingRows` below for the REPLACE (not additive) semantics.
const LISTING_SOURCES = Object.freeze(["itunes", "site_fetch", "site_fetch_escalated"] as const);
const COMPETITOR_SOURCES = Object.freeze(["dataforseo_serp", "itunes_search", "tavily", "product_hunt"] as const);
const KEYWORD_SOURCES = Object.freeze(["dataforseo_keywords"] as const);

type RawDocRow = {
  id: number;
  source_type: string;
  subject_key: string;
  body: unknown;
};

// Safely parse JSON from a model response, returning null on any failure.
// Strips ```json fences first (models often wrap output), so valid answers
// aren't silently discarded into an empty fact sheet.
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return null;
  }
}

/**
 * Part C — REPLACE (not additive) semantics: when a "site_fetch_escalated" row
 * exists for this subject, the raw "site_fetch" HTML row is dropped from what
 * feeds the identity/extract/synth path. The escalation only exists because the
 * raw HTML was garbage (a JS-shell capture) — feeding BOTH would let the
 * near-empty garbage text dilute/contradict the good escalated content instead
 * of being replaced by it. "itunes" (app mode) is never affected.
 *
 * NOTE: this does NOT touch `persist-signals.ts`'s `readSubjectHtml`, which
 * reads `source_type = "site_fetch"` directly and always measures the 8 on-page
 * HTML signals from the REAL fetched HTML — a JS-shell site genuinely lacks
 * server-rendered signals, which is honest measurement, not a bug this papers
 * over (documented boundary, task brief §3).
 */
function effectiveListingRows(listingRows: RawDocRow[]): RawDocRow[] {
  const hasEscalated = listingRows.some((r) => r.source_type === "site_fetch_escalated");
  return hasEscalated ? listingRows.filter((r) => r.source_type !== "site_fetch") : listingRows;
}

// Non-LLM positioning floor: derive a basic positioning from the fetched site
// (title / meta description / h1) so a LIVE app ALWAYS yields some real insight
// even if the extract LLM is unavailable (e.g. no credits) or returns nothing —
// the "always give insight when the app is live" rule. Handles BOTH shapes:
// real HTML (site_fetch — parsed via parseListingHtml) and the Part C escalated
// plain text (site_fetch_escalated — already-rendered text, no tags to parse).
function buildPositioningFloor(listingRows: RawDocRow[], storeUrl: string): PositioningSheet {
  const escalatedDoc = listingRows.find(
    (r) => r.source_type === "site_fetch_escalated" && typeof r.body === "string",
  );
  if (escalatedDoc) {
    const text = (escalatedDoc.body as string).trim();
    if (text.length === 0) return EMPTY_POSITIONING;
    // Already-rendered text/markdown, not HTML — no <title>/<meta> to parse.
    // Same "always some real insight" floor, text-shaped: first line as the
    // claim, next as a value prop.
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const claims = lines.slice(0, 1);
    const valueProps = lines.slice(1, 2);
    if (claims.length === 0) return EMPTY_POSITIONING;
    return { category: "", claims, valueProps };
  }

  const siteDoc = listingRows.find(
    (r) => r.source_type === "site_fetch" && typeof r.body === "string",
  );
  if (!siteDoc) return EMPTY_POSITIONING;
  try {
    const listing = parseListingHtml(siteDoc.body as string, storeUrl);
    const claims = [listing.name].filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
    const valueProps = [listing.description].filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
    if (claims.length === 0 && valueProps.length === 0) return EMPTY_POSITIONING;
    return { category: listing.category ?? "", claims, valueProps };
  } catch {
    return EMPTY_POSITIONING;
  }
}

// Reduce raw site HTML to capped visible text, so the LLM reads ~2K tokens of
// real content instead of ~24K tokens of 170KB markup (major cost + latency win,
// no quality loss — the model never needed the tags/scripts).
const SITE_TEXT_CAP = 8000;
function htmlToText(html: string): string {
  try {
    const root = parse(html);
    root.querySelectorAll("script,style,noscript,svg,template").forEach((n) => n.remove());
    return root.text.replace(/\s+/g, " ").trim().slice(0, SITE_TEXT_CAP);
  } catch {
    return html.slice(0, SITE_TEXT_CAP);
  }
}

// Format rows as a plain text block for injection into a prompt. `site_fetch`
// bodies are raw HTML — reduce them to capped visible text first.
// `site_fetch_escalated` (Part C) is ALREADY rendered plain text/markdown (the
// Tavily Extract fallback) — pass it through as-is, capped the same way, no
// HTML stripping needed (there are no tags to strip).
function formatDocBodies(rows: RawDocRow[]): string {
  return rows
    .map((row, i) => {
      let body: string;
      if (row.source_type === "site_fetch" && typeof row.body === "string") {
        body = htmlToText(row.body);
      } else if (row.source_type === "site_fetch_escalated" && typeof row.body === "string") {
        body = row.body.slice(0, SITE_TEXT_CAP);
      } else {
        body = JSON.stringify(row.body, null, 2);
      }
      return `[${i + 1}] source: ${row.source_type}\n${body}`;
    })
    .join("\n\n");
}

export async function runExtract(ctx: ScanContext, kinds?: FactSheetKind[]): Promise<void> {
  // 1. Read raw_documents for this scan's subject_key.
  // Query by subject_key ONLY — do NOT filter by subject_type here, because
  // collect tools write "app" for ios/android scans and "web" for web scans.
  // The storeUrl is unique per scan so all docs for this scan are returned
  // regardless of which subject_type collect wrote.
  const db = serverDb();
  const { data: rawDocs, error } = await db
    .from("raw_documents")
    .select("id, source_type, subject_key, body")
    .eq("subject_key", ctx.storeUrl);

  if (error) throw error;

  const rows: RawDocRow[] = (rawDocs ?? []).map((r) => ({
    id: r.id,
    source_type: r.source_type,
    subject_key: r.subject_key,
    body: r.body,
  }));

  // 2. Group by source category
  const reviewRows = rows.filter((r) => (REVIEW_SOURCES as readonly string[]).includes(r.source_type));
  // Part C REPLACE semantics — drops the raw "site_fetch" row when a good
  // "site_fetch_escalated" row exists for this subject (effectiveListingRows).
  const listingRows = effectiveListingRows(
    rows.filter((r) => (LISTING_SOURCES as readonly string[]).includes(r.source_type)),
  );
  const competitorRows = rows.filter((r) => (COMPETITOR_SOURCES as readonly string[]).includes(r.source_type));
  const keywordRows = rows.filter((r) => (KEYWORD_SOURCES as readonly string[]).includes(r.source_type));

  const usingFixtures = fixtures() !== null;
  // `kinds` lets the full-scan re-extract refresh ONLY keyword_data instead of
  // re-reading the (expensive) site HTML for every sheet a second time.
  const want = (k: FactSheetKind) => !kinds || kinds.includes(k);

  // Non-LLM floor so a live app always yields some real positioning insight.
  const positioningFloor = want("positioning")
    ? buildPositioningFloor(listingRows, ctx.storeUrl)
    : EMPTY_POSITIONING;

  // 3. For each requested kind: either use fixture or call model, then upsert
  const jobs: Promise<void>[] = [];
  if (want("review_themes"))
    jobs.push(extractKind<ReviewThemesSheet>(ctx, "review_themes", reviewRows, (docs) => reviewThemesPrompt(formatDocBodies(docs)), EMPTY_REVIEW_THEMES, usingFixtures));
  if (want("positioning"))
    jobs.push(extractKind<PositioningSheet>(ctx, "positioning", listingRows, (docs) => positioningPrompt(formatDocBodies(docs)), positioningFloor, usingFixtures));
  if (want("competitor_gap"))
    jobs.push(extractKind<CompetitorGapSheet>(ctx, "competitor_gap", competitorRows, (docs) => competitorGapPrompt(formatDocBodies(docs)), EMPTY_COMPETITOR_GAP, usingFixtures));
  if (want("keyword_data"))
    jobs.push(extractKind<KeywordSheet>(ctx, "keyword_data", keywordRows, (docs) => keywordDataPrompt(formatDocBodies(docs)), EMPTY_KEYWORD_SHEET, usingFixtures));
  await Promise.all(jobs);
}

async function extractKind<T>(
  ctx: ScanContext,
  kind: FactSheetKind,
  docs: RawDocRow[],
  buildPrompt: (docs: RawDocRow[]) => string,
  emptySheet: T,
  usingFixtures: boolean,
): Promise<void> {
  let body: T;

  if (usingFixtures) {
    // Fixture path: return canned body without any LLM call
    body = fixtures()!.extract(kind) as T;
  } else if (docs.length === 0) {
    // INVARIANT #3: never cache an empty sheet. No source docs → skip the upsert
    // entirely. synth's read-back falls back to the same empty shape
    // (readSheet default), so downstream sees {themes:[]}/{competitors:[]}/… WITHOUT
    // a stale blank row that a later read could serve as if it were measured. This
    // is the guard demand-intel already has (isEmptyDemandIntel), applied to
    // fact_sheets — and half of the fix for the invented reachkit.app reviews:
    // an empty review sheet must not exist to be synthesized from.
    return;
  } else {
    // Call Haiku and parse defensively
    try {
      const result = await callModel({
        model: MODEL,
        system: EXTRACT_SYSTEM,
        prompt: buildPrompt(docs),
        scanId: ctx.scanId,
        stage: "extract",
      });
      const parsed = safeJsonParse(result.text);
      body = parsed !== null ? (parsed as T) : emptySheet;
    } catch {
      body = emptySheet;
    }
  }

  await upsertFactSheet({
    subjectType: factSheetSubjectType(ctx.mode),
    subjectKey: ctx.storeUrl,
    kind,
    body,
    modelVersion: MODEL,
  });
}
