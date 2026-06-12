/**
 * FORMAT stage (Task 6) — Haiku reads the 4 fact sheets + synthesis findings
 * and over-generates §10.2 ActionCards (2–3× per module).
 *
 * §11: draftRequiresEdit is always forced to true.
 * Fixture-aware: when fixturesEnabled()=true, returns fixtureActions() without any LLM call.
 * Defensive: malformed/partial JSON drops bad cards; on total failure returns a degraded set, never throws.
 */

import { callModel } from "@/lib/llm/anthropic";
import { ACTIONS_SYSTEM, buildActionsPrompt } from "@/lib/llm/prompts";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { fixturesEnabled, fixtureActions } from "@/lib/dev/fixtures";
import { serverDb } from "@/lib/db/client";
import type { ScanContext } from "@/lib/scan/pipeline";
import type {
  ActionCard,
  ReviewThemesSheet,
  PositioningSheet,
  CompetitorGapSheet,
  KeywordSheet,
  Finding,
} from "@/lib/llm/types";

const MODEL = "claude-haiku-4-5-20251001" as const;

// ---------------------------------------------------------------------------
// Degraded fallback — one card per category, returned when parsing fully fails
// ---------------------------------------------------------------------------
function buildDegradedActions(): ActionCard[] {
  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const base = {
    evidenceIds: [] as number[],
    evidence: [] as import("@/lib/llm/types").ActionCardEvidence[],
    effortMin: 30,
    suggestedDeadline: deadline,
    draft: null,
    draftRequiresEdit: true as const,
    verification: { method: "self_report" as const, state: "pending" as const },
    basis: "probability_based" as const,
    confidence: 0.1,
    expectedOutcome: { scoreComponent: "content", delta: 1 },
  };
  void today; // referenced only for context; deadline uses it implicitly
  return [
    {
      ...base,
      category: "content",
      title: "Review fact sheets and regenerate action cards",
      why: "Action generation failed (parse error) — re-run after verifying fact sheets are populated.",
      expectedOutcome: { scoreComponent: "content", delta: 1 },
    },
    {
      ...base,
      category: "outreach",
      title: "Review fact sheets and regenerate action cards",
      why: "Action generation failed (parse error) — re-run after verifying fact sheets are populated.",
      expectedOutcome: { scoreComponent: "outreach", delta: 1 },
    },
    {
      ...base,
      category: "seo_aso",
      title: "Review fact sheets and regenerate action cards",
      why: "Action generation failed (parse error) — re-run after verifying fact sheets are populated.",
      expectedOutcome: { scoreComponent: "seo", delta: 1 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Type guard for a single ActionCard from parsed output
// ---------------------------------------------------------------------------
function isValidActionCard(c: unknown): c is ActionCard {
  if (typeof c !== "object" || c === null) return false;
  const obj = c as Record<string, unknown>;
  if (
    typeof obj["category"] !== "string" ||
    !["content", "outreach", "seo_aso"].includes(obj["category"])
  ) return false;
  if (typeof obj["title"] !== "string" || obj["title"].length === 0) return false;
  if (typeof obj["why"] !== "string") return false;
  if (!Array.isArray(obj["evidenceIds"])) return false;
  if (typeof obj["effortMin"] !== "number") return false;
  if (typeof obj["suggestedDeadline"] !== "string") return false;
  if (typeof obj["draftRequiresEdit"] !== "boolean") return false;
  if (
    typeof obj["basis"] !== "string" ||
    !["evidence_based", "probability_based"].includes(obj["basis"])
  ) return false;
  if (typeof obj["confidence"] !== "number") return false;
  // expectedOutcome
  const eo = obj["expectedOutcome"];
  if (typeof eo !== "object" || eo === null) return false;
  const eoObj = eo as Record<string, unknown>;
  if (typeof eoObj["scoreComponent"] !== "string") return false;
  if (typeof eoObj["delta"] !== "number") return false;
  // verification
  const vf = obj["verification"];
  if (typeof vf !== "object" || vf === null) return false;
  const vfObj = vf as Record<string, unknown>;
  if (
    typeof vfObj["method"] !== "string" ||
    !["url", "self_report", "rank_check"].includes(vfObj["method"])
  ) return false;
  // evidence — optional array; coerceCard defaults to [] if missing
  if (obj["evidence"] !== undefined && !Array.isArray(obj["evidence"])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Coerce a validated card: clamp confidence, force §11 invariants, default evidence
// ---------------------------------------------------------------------------
function coerceCard(raw: ActionCard): ActionCard {
  return {
    ...raw,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence))),
    draftRequiresEdit: true, // §11 — always true regardless of model output
    evidenceIds: [], // always [] from generation; Critic step attaches real ids
    // Default evidence to [] if missing or malformed; filter out bad items
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.filter((e): e is import("@/lib/llm/types").ActionCardEvidence => {
          const obj = e as unknown as Record<string, unknown>;
          return (
            typeof obj["excerpt"] === "string" &&
            typeof obj["source"] === "string" &&
            typeof obj["sourceType"] === "string"
          );
        })
      : [],
    verification: {
      method: raw.verification.method,
      state: "pending", // always pending from generation
    },
  };
}

// ---------------------------------------------------------------------------
// Parse the model text into ActionCards — drop malformed; degrade on total failure
// ---------------------------------------------------------------------------
function parseActionCards(text: string): ActionCard[] | null {
  let parsed: unknown;
  try {
    // Strip optional markdown fences the model might emit despite instructions
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const valid: ActionCard[] = (parsed as unknown[])
    .filter(isValidActionCard)
    .map(coerceCard);

  return valid.length > 0 ? valid : null;
}

// ---------------------------------------------------------------------------
// Fact-sheet reader (degrade to empty on missing/expired/error)
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
// Read founder_voice for the app owner, or null if none / on error
// ---------------------------------------------------------------------------
async function readFounderVoice(appId: string): Promise<string | null> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("users")
      .select("founder_voice")
      .contains("app_ids", [appId])
      .maybeSingle();
    if (error || data === null) return null;
    const fv = data.founder_voice;
    if (fv === null || fv === undefined) return null;
    if (typeof fv === "string") return fv;
    return JSON.stringify(fv);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function generateActions(
  ctx: ScanContext,
  findings: Finding[],
): Promise<ActionCard[]> {
  // Fixture path — no LLM call, no DB reads
  if (fixturesEnabled()) {
    return fixtureActions();
  }

  // Read the 4 fact sheets in parallel
  const subjectType = factSheetSubjectType(ctx.mode);
  const [reviewThemesBody, positioningBody, competitorGapBody, keywordDataBody, founderVoice] =
    await Promise.all([
      readSheet<ReviewThemesSheet>(subjectType, ctx.storeUrl, "review_themes", { themes: [] }),
      readSheet<PositioningSheet>(subjectType, ctx.storeUrl, "positioning", { category: "", claims: [], valueProps: [] }),
      readSheet<CompetitorGapSheet>(subjectType, ctx.storeUrl, "competitor_gap", { competitors: [] }),
      readSheet<KeywordSheet>(subjectType, ctx.storeUrl, "keyword_data", { clusters: [] }),
      readFounderVoice(ctx.appId),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  const prompt = buildActionsPrompt({
    reviewThemes: JSON.stringify(reviewThemesBody, null, 2),
    positioning: JSON.stringify(positioningBody, null, 2),
    competitorGap: JSON.stringify(competitorGapBody, null, 2),
    keywordData: JSON.stringify(keywordDataBody, null, 2),
    findings: JSON.stringify(findings, null, 2),
    founderVoice,
    today,
  });

  let text: string;
  try {
    const result = await callModel({
      model: MODEL,
      system: ACTIONS_SYSTEM,
      prompt,
      scanId: ctx.scanId,
      stage: "format",
      maxTokens: 4096,
    });
    text = result.text;
  } catch {
    return buildDegradedActions();
  }

  const cards = parseActionCards(text);
  return cards ?? buildDegradedActions();
}
