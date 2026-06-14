/**
 * SYNTH stage (Task 5) — Sonnet reads the 4 fact sheets and produces:
 *   - PositioningMirror   (listing vs. reviews gap)
 *   - exactly 3 Findings  (evidence-linked, one per growth category)
 *   - 1 SampleAction      (with a ready-to-use draft)
 *
 * §13: Sonnet reads FACT SHEETS ONLY, never raw text.
 * Fixture-aware: when fixturesEnabled()=true, returns fixtureSynth() without any LLM call.
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { SYNTH_SYSTEM, buildSynthPrompt } from "@/lib/llm/prompts";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { fixturesEnabled, fixtureSynth } from "@/lib/dev/fixtures";
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
  gap: "",
};

const DEGRADED_FINDING: Finding = {
  category: "content",
  claim:
    "Your strongest discoverability lever right now is your own page: lead with one specific outcome and your highest-intent keyword in the title and first screen.",
  basis: "probability_based",
  confidence: 0.4,
  evidence: [{ excerpt: "(derived from your site)", source: "positioning" }],
};

const DEGRADED_SAMPLE_ACTION: SampleAction = {
  category: "content",
  title: "Sharpen your homepage headline around one outcome + one keyword",
  why: "A specific, keyword-aligned headline is the fastest discoverability win for an early-stage site.",
  draft: "",
};

// Always-insight fallback: when the model output truly can't be used, still
// reflect the user's REAL site (the positioning fact sheet) instead of an error.
// The free scan must deliver value whenever the app is live and available.
function buildDegradedResult(positioning?: PositioningSheet): SynthResult {
  const claims = (positioning?.claims ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  const valueProps = (positioning?.valueProps ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  const listingSays = [...claims, ...valueProps].slice(0, 3).join(" · ");
  if (!listingSays) {
    return { positioningMirror: DEGRADED_MIRROR, findings: [DEGRADED_FINDING], sampleAction: DEGRADED_SAMPLE_ACTION };
  }
  const lead = (claims[0] ?? valueProps[0] ?? "").slice(0, 160);
  return {
    positioningMirror: {
      listingSays,
      reviewsValue: "",
      gap: "This scan ran in early-stage mode with limited external signal, so this reflects what your site says about itself. As reviews, search demand and community mentions accrue, the gap analysis sharpens.",
    },
    findings: [
      {
        category: "content",
        claim: `Your site leads with “${lead}”. Make your single highest-intent keyword and one concrete outcome promise appear in the page title and first screen — the fastest discoverability win for an early-stage site.`,
        basis: "probability_based",
        confidence: 0.5,
        evidence: [{ excerpt: lead, source: "positioning" }],
      },
    ],
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
    (obj["evidence"] as unknown[]).length > 0 &&
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
    parsed = JSON.parse(extractJson(text));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const mirror: PositioningMirror = isValidPositioningMirror(obj["positioningMirror"])
    ? obj["positioningMirror"]
    : DEGRADED_MIRROR;

  const rawFindings = Array.isArray(obj["findings"]) ? (obj["findings"] as unknown[]) : [];
  const validFindings: Finding[] = rawFindings.filter(isValidFinding).map((f) => ({
    ...f,
    // Clamp confidence to [0, 1] so values like 99 don't overflow numeric(3,2)
    confidence: Math.max(0, Math.min(1, Number(f.confidence))),
  }));
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
  subjectType: string,
  subjectKey: string,
  kind: "review_themes" | "positioning" | "competitor_gap" | "keyword_data",
  fallback: T,
): Promise<T> {
  try {
    const row = await getFreshFactSheet(subjectType, subjectKey, kind);
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
  if (fixturesEnabled()) {
    return fixtureSynth();
  }

  // Read the 4 fact sheets (degrade gracefully on missing/expired sheets)
  // Use factSheetSubjectType so web-mode reads "web" sheets (matching extract's write).
  const subjectType = factSheetSubjectType(ctx.mode);
  const [reviewThemesBody, positioningBody, competitorGapBody, keywordDataBody] =
    await Promise.all([
      readSheet<ReviewThemesSheet>(subjectType, ctx.storeUrl, "review_themes", { themes: [] }),
      readSheet<PositioningSheet>(subjectType, ctx.storeUrl, "positioning", { category: "", claims: [], valueProps: [] }),
      readSheet<CompetitorGapSheet>(subjectType, ctx.storeUrl, "competitor_gap", { competitors: [] }),
      readSheet<KeywordSheet>(subjectType, ctx.storeUrl, "keyword_data", { clusters: [] }),
    ]);

  const prompt = buildSynthPrompt({
    reviewThemes: JSON.stringify(reviewThemesBody, null, 2),
    positioning: JSON.stringify(positioningBody, null, 2),
    competitorGap: JSON.stringify(competitorGapBody, null, 2),
    keywordData: JSON.stringify(keywordDataBody, null, 2),
  }, { storeUrl: ctx.storeUrl });

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
    return buildDegradedResult(positioningBody);
  }

  const parsed = parseSynthResult(text);
  return parsed ?? buildDegradedResult(positioningBody);
}
