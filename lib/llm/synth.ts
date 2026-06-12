/**
 * SYNTH stage (Task 5) — Sonnet reads the 4 fact sheets and produces:
 *   - PositioningMirror   (listing vs. reviews gap)
 *   - exactly 3 Findings  (evidence-linked, one per growth category)
 *   - 1 SampleAction      (with a ready-to-use draft)
 *
 * §13: Sonnet reads FACT SHEETS ONLY, never raw text.
 * Fixture-aware: when useFixtures()=true, returns fixtureSynth() without any LLM call.
 */

import { callModel } from "@/lib/llm/anthropic";
import { SYNTH_SYSTEM, buildSynthPrompt } from "@/lib/llm/prompts";
import { getFreshFactSheet } from "@/lib/scan/fact-sheets";
import { useFixtures, fixtureSynth } from "@/lib/dev/fixtures";
import type { ScanContext } from "@/lib/scan/pipeline";
import type {
  SynthResult,
  Finding,
  PositioningMirror,
  SampleAction,
  ReviewThemesSheet,
  PositioningSheet,
  CompetitorGapSheet,
  KeywordSheet,
} from "@/lib/llm/types";

const MODEL = "claude-sonnet-4-6" as const;

// ---------------------------------------------------------------------------
// Minimal valid fallback when JSON parsing fails
// ---------------------------------------------------------------------------
const DEGRADED_MIRROR: PositioningMirror = {
  listingSays: "",
  reviewsValue: "",
  gap: "Unable to determine gap (parse failure).",
};

const DEGRADED_FINDING: Finding = {
  category: "content",
  claim: "Insufficient data to produce a finding (parse failure).",
  basis: "probability_based",
  confidence: 0.1,
  evidence: [{ excerpt: "(no evidence available)", source: "parse_error" }],
};

const DEGRADED_SAMPLE_ACTION: SampleAction = {
  category: "content",
  title: "Review fact sheets and re-run synth",
  why: "Parse failure — model output could not be decoded.",
  draft: "",
};

function buildDegradedResult(): SynthResult {
  return {
    positioningMirror: DEGRADED_MIRROR,
    findings: [DEGRADED_FINDING],
    sampleAction: DEGRADED_SAMPLE_ACTION,
  };
}

// ---------------------------------------------------------------------------
// Type guards for parsed model output
// ---------------------------------------------------------------------------
function isValidFinding(f: unknown): f is Finding {
  if (typeof f !== "object" || f === null) return false;
  const obj = f as Record<string, unknown>;
  return (
    typeof obj["claim"] === "string" &&
    Array.isArray(obj["evidence"]) &&
    typeof obj["category"] === "string" &&
    typeof obj["confidence"] === "number"
  );
}

function isValidPositioningMirror(m: unknown): m is PositioningMirror {
  if (typeof m !== "object" || m === null) return false;
  const obj = m as Record<string, unknown>;
  return (
    typeof obj["listingSays"] === "string" &&
    typeof obj["reviewsValue"] === "string" &&
    typeof obj["gap"] === "string"
  );
}

function isValidSampleAction(a: unknown): a is SampleAction {
  if (typeof a !== "object" || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj["title"] === "string" &&
    typeof obj["why"] === "string" &&
    typeof obj["draft"] === "string" &&
    typeof obj["category"] === "string"
  );
}

function parseSynthResult(text: string): SynthResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const mirror: PositioningMirror = isValidPositioningMirror(obj["positioningMirror"])
    ? obj["positioningMirror"]
    : DEGRADED_MIRROR;

  const rawFindings = Array.isArray(obj["findings"]) ? (obj["findings"] as unknown[]) : [];
  const validFindings: Finding[] = rawFindings.filter(isValidFinding);
  const findings: Finding[] = validFindings.length > 0 ? validFindings : [DEGRADED_FINDING];

  const sampleAction: SampleAction = isValidSampleAction(obj["sampleAction"])
    ? obj["sampleAction"]
    : DEGRADED_SAMPLE_ACTION;

  return { positioningMirror: mirror, findings, sampleAction };
}

// ---------------------------------------------------------------------------
// Fact-sheet helpers: read and serialise for prompt injection
// ---------------------------------------------------------------------------
async function readSheet<T>(
  subjectKey: string,
  kind: "review_themes" | "positioning" | "competitor_gap" | "keyword_data",
  fallback: T,
): Promise<T> {
  try {
    const row = await getFreshFactSheet("app", subjectKey, kind);
    if (row === null) return fallback;
    return row.body as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function runSynth(ctx: ScanContext): Promise<SynthResult> {
  // Fixture path — no LLM call, no fact-sheet reads
  if (useFixtures()) {
    return fixtureSynth();
  }

  // Read the 4 fact sheets (degrade gracefully on missing/expired sheets)
  const [reviewThemesBody, positioningBody, competitorGapBody, keywordDataBody] =
    await Promise.all([
      readSheet<ReviewThemesSheet>(ctx.storeUrl, "review_themes", { themes: [] }),
      readSheet<PositioningSheet>(ctx.storeUrl, "positioning", { category: "", claims: [], valueProps: [] }),
      readSheet<CompetitorGapSheet>(ctx.storeUrl, "competitor_gap", { competitors: [] }),
      readSheet<KeywordSheet>(ctx.storeUrl, "keyword_data", { clusters: [] }),
    ]);

  const prompt = buildSynthPrompt({
    reviewThemes: JSON.stringify(reviewThemesBody, null, 2),
    positioning: JSON.stringify(positioningBody, null, 2),
    competitorGap: JSON.stringify(competitorGapBody, null, 2),
    keywordData: JSON.stringify(keywordDataBody, null, 2),
  });

  let text: string;
  try {
    const result = await callModel({
      model: MODEL,
      system: SYNTH_SYSTEM,
      prompt,
      scanId: ctx.scanId,
      stage: "synth",
      maxTokens: 4096,
    });
    text = result.text;
  } catch {
    return buildDegradedResult();
  }

  const parsed = parseSynthResult(text);
  return parsed ?? buildDegradedResult();
}
