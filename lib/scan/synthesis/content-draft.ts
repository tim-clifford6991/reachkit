/**
 * Content draft engine (automation enablement — Phase 1).
 *
 * Turns ONE approved ContentPlanItem into a first-draft article on demand.
 * Deliberately NOT a batch generator and NOT a publisher: we draft a single
 * real piece for a single real topic, run it through the §11 generic-tell
 * scrub, and always return it as `requiresEdit: true`. The founder reviews,
 * fact-checks, and publishes on their own site.
 *
 * Why this is algorithm-safe: Google's scaled-content-abuse / site-reputation
 * penalties target LOW-VALUE content produced AT SCALE (method-agnostic — AI or
 * human). A single, specific, human-reviewed draft per genuine topic is exactly
 * the "human review before publish" path Google endorses. We never mass-generate
 * pages and never auto-publish, so there is no automation footprint to flag.
 *
 * Prompt is pure/testable; the LLM call is fixtures-aware.
 */
import { callModel } from "@/lib/llm/anthropic";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { scrubGenericTells } from "@/lib/scan/algorithm-safety";
import type { ContentPlanItem } from "./synthesize";

// Sonnet for draft quality (mirrors the distribution draft engine); the §11
// scrub rewrite uses Haiku internally.
const MODEL = "claude-sonnet-4-6" as const;

export interface ContentDraft {
  /** The first-draft article as Markdown (title + body). */
  markdown: string;
  /** Always true — §11 No-auto: a human must edit before anything is published. */
  requiresEdit: true;
}

/** Build the draft prompt from an approved content-plan item. PURE. */
export function buildContentDraftPrompt(item: ContentPlanItem): string {
  const kws = item.targetKeywords.filter(Boolean).join(", ");
  return `Write a first-draft ${item.format || "article"} on: ${item.topic}

TARGET KEYWORDS: ${kws || "(none provided)"}
DEPTH: ${item.depthTarget || "800–1,500 words"}
BUYER ANGLE: ${item.buyerAngle || "(none)"}
BRIEF: ${item.brief || "(none)"}${item.agentPrompt ? `\nWRITING GUIDANCE: ${item.agentPrompt}` : ""}

Hard rules:
- Write for a real reader with genuine, specific value — never for search engines.
- Ground every claim in specifics; no filler, no AI clichés (leverage, unlock, seamless, game-changer, effortlessly, etc.).
- Use the target keywords naturally. Do NOT keyword-stuff.
- This is a FIRST DRAFT the founder will edit and fact-check before publishing.

Return the article as Markdown — a title, then the body. No preamble, no commentary.`;
}

/**
 * Generate a single review-required content draft for one content-plan item.
 * Fixtures mode returns a labelled stub (zero paid calls). Always `requiresEdit`.
 */
export async function generateContentDraft(item: ContentPlanItem): Promise<ContentDraft> {
  if (fixturesEnabled()) {
    return {
      markdown: `# [draft] ${item.topic}\n\n_${item.format || "article"} · ${item.depthTarget || ""}_`,
      requiresEdit: true,
    };
  }

  const { text } = await callModel({
    model: MODEL,
    system:
      "You are a founder's writing assistant. You write specific, genuinely useful first drafts, " +
      "never generic SEO filler. Return only the article as Markdown.",
    prompt: buildContentDraftPrompt(item),
    scanId: null,
    stage: "synth",
    maxTokens: 4096,
  });

  // §11 (6): strip AI tells before the founder ever sees it.
  const scrubbed = await scrubGenericTells(text.trim());
  return { markdown: scrubbed, requiresEdit: true };
}
