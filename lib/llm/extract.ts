import { serverDb } from "@/lib/db/client";
import { callModel } from "@/lib/llm/anthropic";
import { upsertFactSheet } from "@/lib/scan/fact-sheets";
import { useFixtures, fixtureExtract } from "@/lib/dev/fixtures";
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
const REVIEW_SOURCES = ["app_store_rss"] as const;
const LISTING_SOURCES = ["itunes", "site_fetch"] as const;
const COMPETITOR_SOURCES = ["dataforseo_serp", "itunes_search", "tavily", "product_hunt"] as const;
const KEYWORD_SOURCES = ["dataforseo_keywords"] as const;

type RawDocRow = {
  id: number;
  source_type: string;
  subject_key: string;
  body: unknown;
};

// Safely parse JSON from a model response, returning null on any failure.
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Format rows as a plain text block for injection into a prompt.
function formatDocBodies(rows: RawDocRow[]): string {
  return rows
    .map((row, i) => `[${i + 1}] source: ${row.source_type}\n${JSON.stringify(row.body, null, 2)}`)
    .join("\n\n");
}

export async function runExtract(ctx: ScanContext): Promise<void> {
  // 1. Read raw_documents for this scan's subject_key
  const db = serverDb();
  const { data: rawDocs, error } = await db
    .from("raw_documents")
    .select("id, source_type, subject_key, body")
    .eq("subject_type", "app")
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
  const listingRows = rows.filter((r) => (LISTING_SOURCES as readonly string[]).includes(r.source_type));
  const competitorRows = rows.filter((r) => (COMPETITOR_SOURCES as readonly string[]).includes(r.source_type));
  const keywordRows = rows.filter((r) => (KEYWORD_SOURCES as readonly string[]).includes(r.source_type));

  const fixtures = useFixtures();

  // 3. For each kind: either use fixture or call model, then upsert
  await Promise.all([
    extractKind<ReviewThemesSheet>(
      ctx,
      "review_themes",
      reviewRows,
      (docs) => reviewThemesPrompt(formatDocBodies(docs)),
      EMPTY_REVIEW_THEMES,
      fixtures,
    ),
    extractKind<PositioningSheet>(
      ctx,
      "positioning",
      listingRows,
      (docs) => positioningPrompt(formatDocBodies(docs)),
      EMPTY_POSITIONING,
      fixtures,
    ),
    extractKind<CompetitorGapSheet>(
      ctx,
      "competitor_gap",
      competitorRows,
      (docs) => competitorGapPrompt(formatDocBodies(docs)),
      EMPTY_COMPETITOR_GAP,
      fixtures,
    ),
    extractKind<KeywordSheet>(
      ctx,
      "keyword_data",
      keywordRows,
      (docs) => keywordDataPrompt(formatDocBodies(docs)),
      EMPTY_KEYWORD_SHEET,
      fixtures,
    ),
  ]);
}

async function extractKind<T>(
  ctx: ScanContext,
  kind: FactSheetKind,
  docs: RawDocRow[],
  buildPrompt: (docs: RawDocRow[]) => string,
  emptySheet: T,
  fixtures: boolean,
): Promise<void> {
  let body: T;

  if (fixtures) {
    // Fixture path: return canned body without any LLM call
    body = fixtureExtract(kind) as T;
  } else if (docs.length === 0) {
    // No source documents: write empty/degraded sheet
    body = emptySheet;
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
    subjectType: "app",
    subjectKey: ctx.storeUrl,
    kind,
    body,
    modelVersion: MODEL,
  });
}
